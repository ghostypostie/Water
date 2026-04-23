// Load environment variables from .env file
import 'dotenv/config';

import {
    app,
    BrowserWindow,
    screen,
    protocol,
    ipcMain,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import ModuleManager from './module/manager';
import createMainWindow from './main';
import config from './config';
import { Context, RunAt } from './context';
import { join } from 'path';

// Suppress Chromium GL error spam
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.commandLine.appendSwitch('disable-logging');
app.commandLine.appendSwitch('log-level', '3');

export async function launch() {
    let moduleManager = new ModuleManager(Context.Startup);
    await moduleManager.load(RunAt.LoadStart);

    await app.whenReady();
    await moduleManager.load(RunAt.LoadEnd);
    moduleManager.initBeforeRequest();

    protocol.registerFileProtocol('client-resource', (request, callback) => {
        let path = request.url.replace('client-resource://', '');
        callback({ path: join(__dirname, '..', path) });
    });

    app.name = 'Water';
    startClient();
}

function updater(setTitle: (title: string) => void) {
    return new Promise<void>((resolve) => {
        // Configure auto-updater
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        
        // Enable detailed logging
        autoUpdater.logger = {
            info: (msg: string) => console.log('[Water] [Updater]', msg),
            warn: (msg: string) => console.warn('[Water] [Updater]', msg),
            error: (msg: string) => console.error('[Water] [Updater]', msg),
            debug: (msg: string) => console.log('[Water] [Updater] [Debug]', msg),
        };
        
        autoUpdater.on('checking-for-update', () => {
            console.log('[Water] Checking for updates...');
            console.log('[Water] Current version:', app.getVersion());
            console.log('[Water] Update feed:', 'https://github.com/ghostypostie/Water/releases');
            setTitle('Checking for updates...');
        });

        autoUpdater.on('update-available', (info) => {
            console.log('[Water] Update available!');
            console.log('[Water] Current version:', app.getVersion());
            console.log('[Water] New version:', info.version);
            console.log('[Water] Release date:', info.releaseDate);
            console.log('[Water] Download URL:', info.files?.[0]?.url);
            setTitle(`New update found: v${info.version}`);
        });

        autoUpdater.on('download-progress', (progress) => {
            const percent = progress.percent.toFixed(2);
            const downloaded = (progress.transferred / 1024 / 1024).toFixed(2);
            const total = (progress.total / 1024 / 1024).toFixed(2);
            console.log(`[Water] Download progress: ${percent}% (${downloaded}MB / ${total}MB)`);
            setTitle(`Downloading update... ${percent}%`);
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log('[Water] Update downloaded successfully!');
            console.log('[Water] Version:', info.version);
            console.log('[Water] Files:', info.files);
            console.log('[Water] Will restart in 1 second...');
            setTitle('Update downloaded. Restarting...');
            setTimeout(() => {
                console.log('[Water] Quitting and installing update...');
                autoUpdater.quitAndInstall(true, true);
            }, 1000);
        });

        autoUpdater.on('error', (error) => {
            console.error('[Water] Auto-updater error:', error);
            console.error('[Water] Error message:', error.message);
            console.error('[Water] Error stack:', error.stack);
            setTitle('Update check failed');
            resolve();
        });

        autoUpdater.on('update-not-available', (info) => {
            console.log('[Water] No updates available');
            console.log('[Water] Current version:', info.version);
            console.log('[Water] You are running the latest version');
            resolve();
        });
        
        if (!app.isPackaged) {
            console.log('[Water] Running in development mode, skipping update check');
            console.log('[Water] Auto-updater only works in packaged/installed apps');
            return resolve();
        }

        try {
            console.log('[Water] Starting update check...');
            console.log('[Water] App version:', app.getVersion());
            console.log('[Water] Platform:', process.platform);
            console.log('[Water] Arch:', process.arch);
            console.log('[Water] GitHub repo: ghostypostie/Water');
            
            autoUpdater.checkForUpdates().catch((error) => {
                console.error('[Water] Failed to check for updates:', error);
                console.error('[Water] Error details:', error.message);
                resolve();
            });
        } catch (error: any) {
            console.error('[Water] Failed to initialize updater:', error);
            console.error('[Water] Error details:', error.message);
            resolve();
        }
    });
}

function splash() {
    let { workArea: primaryDisplay } = screen.getPrimaryDisplay();
    let biggest = Math.max(primaryDisplay.width, primaryDisplay.height) * 0.5;
    let size = {
        width: ~~biggest,
        height: ~~((biggest / 16) * 9),
    };

    let win = new BrowserWindow({
        ...size,
        x: primaryDisplay.x + primaryDisplay.width / 2 - size.width / 2,
        y: primaryDisplay.y + primaryDisplay.height / 2 - size.height / 2,
        frame: false,
        resizable: false,
        show: false,
        icon: 'assets/img/logo.png',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false, // Keep splash responsive
        },
    });

    // Keep splash window responsive
    win.webContents.on('did-start-loading', () => {
        win.webContents.executeJavaScript(`
            // Prevent "not responding" by processing events
            setInterval(() => {
                // Empty interval to keep event loop active
            }, 100);
        `).catch(() => {});
    });

    return new Promise<BrowserWindow>((resolve) => {
        win.once('ready-to-show', win.show.bind(win));
        win.webContents.on('did-finish-load', resolve.bind(null, win));

        win.setMenu(null);
        win.loadFile('assets/html/splash.html');
    });
}

async function startClient() {
    ipcMain.on('getArgv', (event) => (event.returnValue = process.argv));

    let shouldUpdate = config.get('update', true);
    let enableSplash = config.get('modules.performance.enableSplash', true);

    if (!enableSplash) {
        createMainWindow();
        return;
    }

    let splashWindow = await splash();

    let setTitle = splashWindow.webContents.send.bind(
        splashWindow.webContents,
        'setTitle'
    );

    let onResetCSSEvent: (event: Electron.IpcMainEvent) => void;

    ipcMain.on(
        'resetCSS',
        (onResetCSSEvent = (event) => {
            if (event.sender !== splashWindow.webContents) return;
            config.set('modules.easycss.active', -1);
        })
    );

    if (shouldUpdate) {
        setTitle('Checking for updates...');
        await updater(setTitle);
    }

    setTitle('Loading game...');
    
    // Defer main window creation slightly to let splash render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const mainWindow = await createMainWindow();
    
    mainWindow.once('ready-to-show', () => {
        ipcMain.off('resetCSS', onResetCSSEvent);
        
        // Keep splash screen open in development mode
        if (!app.isPackaged) {
            console.log('[Water] Development mode: Splash screen will stay open');
            mainWindow.show();
            return;
        }
        
        // Add 500ms delay before closing splash screen (reduced from 5000ms)
        setTimeout(() => {
            app.on('window-all-closed', (event) => event.preventDefault());
            splashWindow.close();
            app.removeAllListeners('window-all-closed');
            app.on('window-all-closed', app.quit.bind(app));
            
            mainWindow.show();
        }, 500);
    });
}
