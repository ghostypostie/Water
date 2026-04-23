import { screen, app, BrowserWindow, shell, ipcMain } from 'electron';
import config from './config';
import { Context, RunAt, fromURL } from './context';
import ModuleManger from './module/manager';
import { join } from 'path';

// IPC handler for getting user data path
ipcMain.on('get-user-data-path', (event) => {
    event.returnValue = app.getPath('userData');
});

export let window: BrowserWindow;
const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

function quit() {
    let size = window.getSize();
    let pos = window.getPosition();
    let fullscreen = window.isFullScreen();

    config.set('window', {
        width: size[0],
        height: size[1],
        x: pos[0],
        y: pos[1],
        fullscreen,
    });

    app.quit();
}

async function handleKeyEvent(
    context: Context,
    window: BrowserWindow,
    event: Electron.Event,
    input: Electron.Input
) {
    if (input.type !== 'keyDown') return;

    let binds = config.get('keybinds', {
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
        case Context.Game:
            if (input.key == binds.newGame)
                window.loadURL('https://krunker.io');
        default:
            if (input.key == binds.refresh) window.reload();

            if (input.key == binds.fullscreen) {
                // Respect display mode setting - don't toggle if in borderless mode
                const displayMode = config.get('modules.display.mode', 'windowed') as string;
                if (displayMode === 'borderless') {
                    // Borderless mode - F11 does nothing
                    return;
                }
                
                const goFullscreen = !window.isFullScreen();
                const targetMode = goFullscreen ? 'fullscreen' : 'windowed';
                
                if (goFullscreen) {
                    window.setFullScreen(true);
                    config.set('modules.display.mode', 'fullscreen');
                } else {
                    window.setFullScreen(false);
                    config.set('modules.display.mode', 'windowed');
                }
            }

            if (input.key == binds.devtools) {
                let devtools = window.webContents.isDevToolsOpened();

                if (devtools) window.webContents.closeDevTools();
                else window.webContents.openDevTools({ mode: 'detach' });
            }
            break;
    }
}

export default async function createMainWindow(): Promise<BrowserWindow> {
    let { workAreaSize: displaySize } = screen.getPrimaryDisplay();

    let windowParams = config.get('window', {
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

    window = new BrowserWindow({
        ...windowParams,
        title: app.getName(),
        show: false,
        backgroundColor: '#000000',
        icon: 'assets/img/logo.png',

        webPreferences: {
            preload: join(__dirname, 'preload/index.js'),
            sandbox: false,
            contextIsolation: false,
        },
    });

    // Suppress GL error spam
    const filterGLErrors = (...args: any[]) => {
        const message = args.join(' ');
        return message.includes('GL ERROR') || 
               message.includes('glCopySubTexture') || 
               message.includes('raster_decoder.cc') ||
               message.includes('GL_INVALID_VALUE');
    };

    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args: any[]) => {
        if (!filterGLErrors(...args)) originalError.apply(console, args);
    };
    
    console.warn = (...args: any[]) => {
        if (!filterGLErrors(...args)) originalWarn.apply(console, args);
    };

    // Also filter process stderr
    if (process.stderr && process.stderr.write) {
        const originalStderrWrite = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk: any, encoding?: any, callback?: any) => {
            const message = chunk.toString();
            if (filterGLErrors(message)) {
                if (typeof encoding === 'function') encoding();
                else if (callback) callback();
                return true;
            }
            return originalStderrWrite(chunk, encoding, callback);
        }) as any;
    }

    let moduleManager = new ModuleManger(Context.Common);
    await moduleManager.load(RunAt.LoadStart);

    // IPC handler for focusing window (robust implementation like ranked match)
    ipcMain.on('focus-window', () => {
        if (window && !window.isDestroyed()) {
            if (window.isMinimized()) window.restore();
            if (!window.isVisible()) window.show();
            window.setAlwaysOnTop(true, 'screen-saver');
            window.focus();
            window.moveTop();
            window.flashFrame(true);
            // Reset always on top after a short delay
            setTimeout(() => {
                if (window && !window.isDestroyed()) {
                    window.setAlwaysOnTop(false);
                }
            }, 1000);
        }
    });

    window.setMenu(null);
    window.on('close', quit);

    window.webContents.on(
        'did-fail-load',
        (event, errorCode, errorDesc, validatedURL, isMainFrame) => {
            if (isMainFrame) window.loadFile('assets/html/disconnected.html');
        }
    );

    window.once('ready-to-show', async () => {
        let enableSplash = config.get('modules.performance.enableSplash', true);
        if (!enableSplash) {
            // Show immediately when splash is disabled
            window.show();
        }
        await moduleManager.load(RunAt.LoadEnd);
    });

    window.webContents.on('page-title-updated', (event) => {
        event.preventDefault();
        window.setTitle(app.getName());
    });
    window.webContents.on('will-navigate', (event, url) => {
        event.preventDefault();
        handleNavigation(new URL(url));
    });
    window.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        handleNavigation(new URL(url));
    });
    window.webContents.on(
        'before-input-event',
        handleKeyEvent.bind(null, Context.Game, window)
    );
    
    // Start loading immediately
    window.loadURL('https://krunker.io');
    
    return window;
}

export function handleNavigation(url: URL) {
    let context = fromURL(url);

    switch (context) {
        case Context.Game:
            window.loadURL(url.toString());
            window.focus();
            break;
        case null:
            shell.openExternal(url.toString());
            break;
        default:
            let win = new BrowserWindow({
                width: 800,
                height: 600,
                title: app.getName(),
                icon: 'assets/img/logo.png',
                webPreferences: {
                    preload: join(__dirname, 'preload/index.js'),
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
            win.webContents.on(
                'before-input-event',
                handleKeyEvent.bind(null, context, win)
            );
            win.webContents.on('will-prevent-unload', (event) =>
                event.preventDefault()
            );
            win.webContents.on('page-title-updated', (event, title) => {
                event.preventDefault();
                win.setTitle(app.getName() + ' - ' + title);
            });

            win.loadURL(url.toString(), { userAgent });
            break;
    }
}
