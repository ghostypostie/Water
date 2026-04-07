"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.launch = launch;
const electron_1 = require("electron");
const manager_1 = __importDefault(require("./module/manager"));
const main_1 = __importDefault(require("./main"));
const config_1 = __importDefault(require("./config"));
const context_1 = require("./context");
const path_1 = require("path");
// Suppress Chromium GL error spam
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
electron_1.app.commandLine.appendSwitch('disable-logging');
electron_1.app.commandLine.appendSwitch('log-level', '3');
async function launch() {
    let moduleManager = new manager_1.default(context_1.Context.Startup);
    moduleManager.load(context_1.RunAt.LoadStart);
    await electron_1.app.whenReady();
    moduleManager.load(context_1.RunAt.LoadEnd);
    moduleManager.initBeforeRequest();
    electron_1.protocol.registerFileProtocol('client-resource', (request, callback) => {
        let path = request.url.replace('client-resource://', '');
        callback({ path: (0, path_1.join)(__dirname, '..', path) });
    });
    electron_1.app.name = 'Water';
    startClient();
}
function updater(setTitle) {
    return new Promise((resolve) => {
        electron_1.autoUpdater.on('update-available', (info) => {
            setTitle(`New update found: v${info.version}`);
        });
        electron_1.autoUpdater.on('download-progress', (progress) => {
            setTitle(`Downloading update... ${progress.percent.toFixed(2)}%`);
        });
        electron_1.autoUpdater.on('update-downloaded', () => {
            setTitle('Update downloaded. Restarting...');
            setTimeout(electron_1.autoUpdater.quitAndInstall.bind(electron_1.autoUpdater, true, true), 1000);
        });
        electron_1.autoUpdater.on('error', (error) => {
            console.error('[Water] Auto-updater error:', error);
            resolve();
        });
        electron_1.autoUpdater.on('update-not-available', resolve);
        if (!electron_1.app.isPackaged) {
            console.log('[Water] Running in development mode, skipping update check');
            return resolve();
        }
        try {
            const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux';
            electron_1.autoUpdater.setFeedURL({
                provider: 'github',
                owner: 'ghostypostie',
                repo: 'Water',
            });
            console.log('[Water] Checking for updates...');
            electron_1.autoUpdater.checkForUpdates();
        }
        catch (error) {
            console.error('[Water] Failed to check for updates:', error);
            resolve();
        }
    });
}
function splash() {
    let { workArea: primaryDisplay } = electron_1.screen.getPrimaryDisplay();
    let biggest = Math.max(primaryDisplay.width, primaryDisplay.height) * 0.5;
    let size = {
        width: ~~biggest,
        height: ~~((biggest / 16) * 9),
    };
    let win = new electron_1.BrowserWindow({
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
    return new Promise((resolve) => {
        win.once('ready-to-show', win.show.bind(win));
        win.webContents.on('did-finish-load', resolve.bind(null, win));
        win.setMenu(null);
        win.loadFile('assets/html/splash.html');
    });
}
async function startClient() {
    electron_1.ipcMain.on('getArgv', (event) => (event.returnValue = process.argv));
    let shouldUpdate = config_1.default.get('update', true);
    let enableSplash = config_1.default.get('modules.performance.enableSplash', true);
    if (!enableSplash) {
        (0, main_1.default)();
        return;
    }
    let splashWindow = await splash();
    let setTitle = splashWindow.webContents.send.bind(splashWindow.webContents, 'setTitle');
    let onResetCSSEvent;
    electron_1.ipcMain.on('resetCSS', (onResetCSSEvent = (event) => {
        if (event.sender !== splashWindow.webContents)
            return;
        config_1.default.set('modules.easycss.active', -1);
    }));
    if (shouldUpdate) {
        setTitle('Checking for updates...');
        await updater(setTitle);
    }
    setTitle('Loading game...');
    const mainWindow = (0, main_1.default)();
    mainWindow.once('ready-to-show', () => {
        electron_1.ipcMain.off('resetCSS', onResetCSSEvent);
        // Keep splash screen open in development mode
        if (!electron_1.app.isPackaged) {
            console.log('[Water] Development mode: Splash screen will stay open');
            mainWindow.show();
            return;
        }
        electron_1.app.on('window-all-closed', (event) => event.preventDefault());
        splashWindow.close();
        electron_1.app.removeAllListeners('window-all-closed');
        electron_1.app.on('window-all-closed', electron_1.app.quit.bind(electron_1.app));
        mainWindow.show();
    });
}
