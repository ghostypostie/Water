"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.window = void 0;
exports.default = createMainWindow;
exports.handleNavigation = handleNavigation;
const electron_1 = require("electron");
const config_1 = __importDefault(require("./config"));
const context_1 = require("./context");
const manager_1 = __importDefault(require("./module/manager"));
const path_1 = require("path");
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
function quit() {
    let size = exports.window.getSize();
    let pos = exports.window.getPosition();
    let fullscreen = exports.window.isFullScreen();
    config_1.default.set('window', {
        width: size[0],
        height: size[1],
        x: pos[0],
        y: pos[1],
        fullscreen,
    });
    electron_1.app.quit();
}
async function handleKeyEvent(context, window, event, input) {
    if (input.type !== 'keyDown')
        return;
    let binds = config_1.default.get('keybinds', {
        newGame: 'F6',
        refresh: 'F5',
        fullscreen: 'F11',
        devtools: 'F12',
    });
    binds.newGame = binds.newGame || 'F6';
    binds.refresh = binds.refresh || 'F5';
    binds.fullscreen = binds.fullscreen || 'F11';
    binds.devtools = binds.devtools || 'F12';
    switch (context) {
        case context_1.Context.Game:
            if (input.key == binds.newGame)
                window.loadURL('https://krunker.io');
        default:
            if (input.key == binds.refresh)
                window.reload();
            if (input.key == binds.fullscreen)
                window.setFullScreen(!window.isFullScreen());
            if (input.key == binds.devtools) {
                let devtools = window.webContents.isDevToolsOpened();
                if (devtools)
                    window.webContents.closeDevTools();
                else
                    window.webContents.openDevTools({ mode: 'detach' });
            }
            break;
    }
}
function createMainWindow() {
    let { workAreaSize: displaySize } = electron_1.screen.getPrimaryDisplay();
    let windowParams = config_1.default.get('window', {
        width: displaySize.width,
        height: displaySize.height,
        x: 0,
        y: 0,
        fullscreen: false,
    });
    windowParams.width = windowParams.width || displaySize.width;
    windowParams.height = windowParams.height || displaySize.height;
    windowParams.x = windowParams.x || 0;
    windowParams.y = windowParams.y || 0;
    windowParams.fullscreen = windowParams.fullscreen || false;
    exports.window = new electron_1.BrowserWindow({
        ...windowParams,
        title: electron_1.app.getName(),
        show: false,
        backgroundColor: '#000000',
        icon: 'assets/img/logo.png',
        webPreferences: {
            preload: (0, path_1.join)(__dirname, 'preload/index.js'),
            sandbox: false,
            contextIsolation: false,
        },
    });
    // Suppress GL error spam
    const filterGLErrors = (...args) => {
        const message = args.join(' ');
        return message.includes('GL ERROR') ||
            message.includes('glCopySubTexture') ||
            message.includes('raster_decoder.cc') ||
            message.includes('GL_INVALID_VALUE');
    };
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...args) => {
        if (!filterGLErrors(...args))
            originalError.apply(console, args);
    };
    console.warn = (...args) => {
        if (!filterGLErrors(...args))
            originalWarn.apply(console, args);
    };
    // Also filter process stderr
    if (process.stderr && process.stderr.write) {
        const originalStderrWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk, encoding, callback) => {
            const message = chunk.toString();
            if (filterGLErrors(message)) {
                if (typeof encoding === 'function')
                    encoding();
                else if (callback)
                    callback();
                return true;
            }
            return originalStderrWrite(chunk, encoding, callback);
        });
    }
    let moduleManager = new manager_1.default(context_1.Context.Common);
    moduleManager.load(context_1.RunAt.LoadStart);
    // IPC handler for focusing window (robust implementation like ranked match)
    electron_1.ipcMain.on('focus-window', () => {
        if (exports.window && !exports.window.isDestroyed()) {
            if (exports.window.isMinimized())
                exports.window.restore();
            if (!exports.window.isVisible())
                exports.window.show();
            exports.window.setAlwaysOnTop(true, 'screen-saver');
            exports.window.focus();
            exports.window.moveTop();
            exports.window.flashFrame(true);
            // Reset always on top after a short delay
            setTimeout(() => {
                if (exports.window && !exports.window.isDestroyed()) {
                    exports.window.setAlwaysOnTop(false);
                }
            }, 1000);
        }
    });
    exports.window.setMenu(null);
    exports.window.on('close', quit);
    exports.window.webContents.on('did-fail-load', (event, errorCode, errorDesc, validatedURL, isMainFrame) => {
        if (isMainFrame)
            exports.window.loadFile('assets/html/disconnected.html');
    });
    exports.window.once('ready-to-show', () => {
        let enableSplash = config_1.default.get('modules.performance.enableSplash', true);
        if (!enableSplash) {
            // Show immediately when splash is disabled
            exports.window.show();
        }
        moduleManager.load(context_1.RunAt.LoadEnd);
    });
    exports.window.webContents.on('page-title-updated', (event) => {
        event.preventDefault();
        exports.window.setTitle(electron_1.app.getName());
    });
    exports.window.webContents.on('will-navigate', (event, url) => {
        event.preventDefault();
        handleNavigation(new URL(url));
    });
    exports.window.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        handleNavigation(new URL(url));
    });
    exports.window.webContents.on('before-input-event', handleKeyEvent.bind(null, context_1.Context.Game, exports.window));
    // Start loading immediately
    exports.window.loadURL('https://krunker.io');
    return exports.window;
}
function handleNavigation(url) {
    let context = (0, context_1.fromURL)(url);
    switch (context) {
        case context_1.Context.Game:
            exports.window.loadURL(url.toString());
            exports.window.focus();
            break;
        case null:
            electron_1.shell.openExternal(url.toString());
            break;
        default:
            let win = new electron_1.BrowserWindow({
                width: 800,
                height: 600,
                title: electron_1.app.getName(),
                icon: 'assets/img/logo.png',
                webPreferences: {
                    preload: (0, path_1.join)(__dirname, 'preload/index.js'),
                    sandbox: false,
                    contextIsolation: false,
                },
            });
            win.setMenu(null);
            win.webContents.on('will-navigate', (event, url) => {
                event.preventDefault();
                handleNavigation(new URL(url));
            });
            win.webContents.on('new-window', (event, url) => {
                event.preventDefault();
                handleNavigation(new URL(url));
            });
            win.webContents.on('before-input-event', handleKeyEvent.bind(null, context, win));
            win.webContents.on('will-prevent-unload', (event) => event.preventDefault());
            win.webContents.on('page-title-updated', (event, title) => {
                event.preventDefault();
                win.setTitle(electron_1.app.getName() + ' - ' + title);
            });
            win.loadURL(url.toString(), { userAgent });
            break;
    }
}
