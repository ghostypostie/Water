"use strict";

let { BrowserWindow, ipcMain, app, dialog, globalShortcut } = require("electron");
let path = require("path");

let BrowserLoader = require("./browser-loader");

class IpcLoader {
    /**
     * Initializes IPC event handlers
     * @param {import("electron-store")} config
     */
    static load(config) {
        ipcMain.handle("get-app-info", () => ({
            name: app.name,
            version: app.getVersion(),
            documentsDir: app.getPath("documents")
        }));

        ipcMain.on("get-path", (event, name) => (event.returnValue = app.getPath(name)));

        ipcMain.on("prompt", (event, message, defaultValue) => {
            let promptWin = BrowserLoader.initPromptWindow(message, defaultValue, config);
            let returnValue = null;
            ipcMain.on("prompt-return", (_, value) => (returnValue = value));
            promptWin.on("closed", () => (event.returnValue = returnValue));
        });

        ipcMain.handle("set-bounds", (event, bounds) =>
            BrowserWindow.fromWebContents(event.sender).setBounds(bounds)
        );

        ipcMain.on("set-config", (_event, { key, value }) => {
            try { config.set(String(key), value); } catch (e) { console.error("[Config] set-config error:", e); }
        });

        // F11 fullscreen toggle via IPC (renderer → main)
        ipcMain.on("f11-toggle", (event) => {
            IpcLoader._handleF11(config, BrowserWindow.fromWebContents(event.sender));
        });

        // Matchmaker
        ipcMain.on("trigger-matchmaker", () => {
            const matchmaker = require("../modules/matchmaker");
            const windows = BrowserWindow.getAllWindows();
            const mainWindow = windows.find(w => w.webContents.getURL().includes('krunker.io')) || windows[0];
            if (mainWindow && config.get('betterMatchmaker.enable', false)) {
                matchmaker(mainWindow);
            } else if (mainWindow) {
                mainWindow.loadURL('https://krunker.io');
            }
        });

        // Global shortcuts (registered after app ready)
        app.whenReady().then(() => {
            // F11 — fullscreen toggle (OS-level fallback)
            try {
                globalShortcut.register('F11', () => {
                    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
                    IpcLoader._handleF11(config, win);
                });
                console.log('[Water] F11 globalShortcut registered');
            } catch (e) {
                console.error('[Water] Failed to register F11 globalShortcut:', e);
            }

            // F4 — matchmaker
            try {
                globalShortcut.register('F4', () => {
                    const matchmaker = require("../modules/matchmaker");
                    const windows = BrowserWindow.getAllWindows();
                    const mainWindow = windows.find(w => w.webContents.getURL().includes('krunker.io')) || windows[0];
                    if (mainWindow && config.get('betterMatchmaker.enable', false)) {
                        matchmaker(mainWindow);
                    } else if (mainWindow) {
                        mainWindow.loadURL('https://krunker.io');
                    }
                });
                console.log('[Water] F4 matchmaker shortcut registered');
            } catch (e) {
                console.error('[Water] Failed to register F4 shortcut:', e);
            }
        });

        app.on('will-quit', () => {
            try { globalShortcut.unregisterAll(); } catch (_) {}
        });
    }

    /**
     * Shared F11 handler — windowed↔fullscreen, maximized→fullscreen, borderless no-op
     * @param {import("electron-store")} config
     * @param {Electron.BrowserWindow} win
     */
    static _handleF11(config, win) {
        try {
            if (!win) return;
            const storedMode = String(config.get('fullscreen', 'windowed') || 'windowed');
            if (storedMode === 'borderless') return;

            const goFullscreen = !win.isFullScreen();
            const targetMode = goFullscreen ? 'fullscreen' : 'windowed';

            if (goFullscreen) {
                if (win.isMaximized()) win.unmaximize();
                win.setFullScreen(true);
            } else {
                win.setFullScreen(false);
            }

            config.set('fullscreen', targetMode);

            // Sync the renderer dropdown + entry.val live
            const t = targetMode;
            try {
                win.webContents.executeJavaScript(`
                    (function() {
                        try {
                            var el = document.getElementById('c_slid_fullscreen');
                            if (el) el.value = '${t}';
                            var s = require('../exports/settings');
                            if (s && s.fullscreen) s.fullscreen.val = '${t}';
                        } catch(_) {}
                    })();
                `).catch(() => {});
            } catch (_) {}

            console.log('[Water] F11:', storedMode, '→', targetMode);
        } catch (e) {
            console.error('[Water] F11 error:', e);
        }
    }
}

module.exports = IpcLoader;
