import {
    app,
    autoUpdater,
    BrowserWindow,
    screen,
    protocol,
    ipcMain,
} from 'electron';
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
    moduleManager.load(RunAt.LoadStart);

    await app.whenReady();
    moduleManager.load(RunAt.LoadEnd);
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
        autoUpdater.on('update-available', (info) => {
            setTitle(`New update found: v${info.version}`);
        });

        autoUpdater.on('download-progress' as any, (progress) => {
            setTitle(`Downloading update... ${progress.percent.toFixed(2)}%`);
        });

        autoUpdater.on('update-downloaded', () => {
            setTitle('Update downloaded. Restarting...');
            setTimeout(
                autoUpdater.quitAndInstall.bind(autoUpdater, true, true),
                1000
            );
        });

        autoUpdater.on('error', (error) => {
            console.error('[Water] Auto-updater error:', error);
            resolve();
        });

        autoUpdater.on('update-not-available', resolve);
        
        if (!app.isPackaged) {
            console.log('[Water] Running in development mode, skipping update check');
            return resolve();
        }

        try {
            const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux';
            autoUpdater.setFeedURL({
                provider: 'github',
                owner: 'ghostypostie',
                repo: 'Water',
            } as any);
            
            console.log('[Water] Checking for updates...');
            autoUpdater.checkForUpdates();
        } catch (error) {
            console.error('[Water] Failed to check for updates:', error);
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
        },
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
    
    const mainWindow = createMainWindow();
    
    mainWindow.once('ready-to-show', () => {
        ipcMain.off('resetCSS', onResetCSSEvent);
        
        // Keep splash screen open in development mode
        if (!app.isPackaged) {
            console.log('[Water] Development mode: Splash screen will stay open');
            mainWindow.show();
            return;
        }
        
        app.on('window-all-closed', (event) => event.preventDefault());
        splashWindow.close();
        app.removeAllListeners('window-all-closed');
        app.on('window-all-closed', app.quit.bind(app));
        
        mainWindow.show();
    });
}
