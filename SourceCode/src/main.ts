import { screen, app, BrowserWindow, shell, ipcMain } from 'electron';
import config from './config';
import { Context, RunAt, fromURL } from './context';
import ModuleManger from './module/manager';
import { join } from 'path';

// IPC handler for getting user data path
ipcMain.on('get-user-data-path', (event) => {
    event.returnValue = app.getPath('userData');
});

// Keybind cache for instant updates
let keybindCache: {
    newGame: { key: string, shift: boolean, alt: boolean, ctrl: boolean } | null;
    refresh: { key: string, shift: boolean, alt: boolean, ctrl: boolean } | null;
    fullscreen: { key: string, shift: boolean, alt: boolean, ctrl: boolean } | null;
    devtools: { key: string, shift: boolean, alt: boolean, ctrl: boolean } | null;
} | null = null;

// IPC handler for keybind changes - reload cache instantly
ipcMain.on('keybinds-changed', (event, keybindData?: any) => {
    console.log('[Main] ========================================');
    console.log('[Main] Keybinds changed IPC received!');
    
    if (keybindData) {
        // Direct update from renderer - use this data immediately
        console.log('[Main] Received keybind data directly from renderer:', keybindData);
        keybindCache = {
            newGame: keybindData.newGame || { key: 'F6', shift: false, alt: false, ctrl: false },
            refresh: keybindData.refresh || { key: 'F5', shift: false, alt: false, ctrl: false },
            fullscreen: keybindData.fullscreen || { key: 'F11', shift: false, alt: false, ctrl: false },
            devtools: keybindData.devtools || { key: 'F12', shift: false, alt: false, ctrl: false }
        };
        console.log('[Main] Cache updated directly from IPC data');
    } else {
        // Fallback: clear cache and reload from config
        console.log('[Main] No keybind data provided, clearing cache and reloading from config...');
        keybindCache = null;
        
        // Small delay to ensure file system sync
        setTimeout(() => {
            const newBinds = loadKeybinds();
            console.log('[Main] Keybinds reloaded from config');
        }, 100);
    }
    
    console.log('[Main] Current keybinds:', {
        newGame: keybindCache?.newGame.key,
        refresh: keybindCache?.refresh.key,
        fullscreen: keybindCache?.fullscreen.key,
        devtools: keybindCache?.devtools.key
    });
    console.log('[Main] ========================================');
});

// Helper to parse keybind from serialized format
function parseKeybind(serialized: number[] | null): { key: string, shift: boolean, alt: boolean, ctrl: boolean } | null {
    if (!serialized || !Array.isArray(serialized) || serialized.length === 0) return null;
    
    const type = serialized[0] & 1;
    if (type === 0) {
        // Keyboard key
        const shift = !!(serialized[0] & 2);
        const alt = !!(serialized[0] & 4);
        const ctrl = !!(serialized[0] & 8);
        const key = String.fromCharCode(...serialized.slice(1));
        return { key, shift, alt, ctrl };
    }
    return null; // Mouse buttons not supported in main process
}

// Load keybinds from config (with caching)
function loadKeybinds() {
    if (keybindCache) return keybindCache;
    
    console.log('[Main] Loading keybinds from config...');
    
    // Read raw values from config to see what's actually stored
    const rawNewGame = config.get('keybinds.newGame', null);
    const rawRefresh = config.get('keybinds.refresh', null);
    const rawFullscreen = config.get('keybinds.fullscreen', null);
    const rawDevtools = config.get('keybinds.devtools', null);
    
    console.log('[Main] Raw config values:', {
        newGame: rawNewGame,
        refresh: rawRefresh,
        fullscreen: rawFullscreen,
        devtools: rawDevtools
    });
    
    keybindCache = {
        newGame: parseKeybind(rawNewGame) || { key: 'F6', shift: false, alt: false, ctrl: false },
        refresh: parseKeybind(rawRefresh) || { key: 'F5', shift: false, alt: false, ctrl: false },
        fullscreen: parseKeybind(rawFullscreen) || { key: 'F11', shift: false, alt: false, ctrl: false },
        devtools: parseKeybind(rawDevtools) || { key: 'F12', shift: false, alt: false, ctrl: false }
    };
    
    console.log('[Main] Parsed keybinds:', {
        newGame: `${keybindCache.newGame.key}`,
        refresh: `${keybindCache.refresh.key}`,
        fullscreen: `${keybindCache.fullscreen.key}`,
        devtools: `${keybindCache.devtools.key}`
    });
    
    return keybindCache;
}

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

    // Load keybinds from cache (reloads if cache was cleared by IPC)
    const binds = loadKeybinds();

    const matchesKeybind = (input: Electron.Input, bind: { key: string, shift: boolean, alt: boolean, ctrl: boolean } | null): boolean => {
        if (!bind) return false;
        return input.key.toUpperCase() === bind.key.toUpperCase() &&
               input.shift === bind.shift &&
               input.alt === bind.alt &&
               input.control === bind.ctrl;
    };

    // Global keybinds (work in all contexts)
    
    // Fullscreen toggle
    if (matchesKeybind(input, binds.fullscreen)) {
        console.log('[Main] Fullscreen keybind triggered');
        const displayMode = config.get('modules.display.mode', 'windowed') as string;
        
        if (displayMode === 'borderless') {
            console.log('[Main] Borderless mode active - fullscreen disabled');
            return;
        }
        
        const isFullscreen = window.isFullScreen();
        window.setFullScreen(!isFullscreen);
        config.set('modules.display.mode', !isFullscreen ? 'fullscreen' : 'windowed');
        console.log('[Main] Fullscreen:', !isFullscreen ? 'enabled' : 'disabled');
        return;
    }

    // DevTools toggle
    if (matchesKeybind(input, binds.devtools)) {
        console.log('[Main] DevTools keybind triggered');
        const isOpen = window.webContents.isDevToolsOpened();
        
        if (isOpen) {
            window.webContents.closeDevTools();
            console.log('[Main] DevTools closed');
        } else {
            window.webContents.openDevTools({ mode: 'detach' });
            console.log('[Main] DevTools opened');
        }
        return;
    }

    // Refresh page
    if (matchesKeybind(input, binds.refresh)) {
        console.log('[Main] Refresh keybind triggered');
        window.reload();
        return;
    }

    // New Game (only in game context)
    if (context === Context.Game && matchesKeybind(input, binds.newGame)) {
        console.log('[Main] New Game keybind triggered');
        window.loadURL('https://krunker.io');
        return;
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
