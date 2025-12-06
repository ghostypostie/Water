"use strict";
let path = require("path");
let fs = require("fs");

let { BrowserWindow, app, shell, dialog, clipboard, screen } = require("electron");
let log = require("electron-log");
let shortcuts = require("electron-localshortcut");

let UrlUtils = require("../utils/url-utils");
let PathUtils = require("../utils/path-utils");
let WindowUtils = require("../utils/window-utils");
let Swapper = require("../modules/swapper");

class BrowserLoader {
	static load(isDebug = false, config) {
		this.DEBUG = isDebug;
		/** @type {string} */
		let swapDirConfig = (config.get("resourceSwapperPath", ""));
		const doc = app.getPath("documents");
		const unified = path.join(doc, "Water", "Swap");
		const legacy = path.join(doc, "Water Swap");

		// If user explicitly configured a custom absolute path that is NOT the legacy path, respect it
		if (PathUtils.isValidPath(swapDirConfig) && path.resolve(swapDirConfig) !== path.resolve(legacy)) {
			this.swapDir = swapDirConfig;
			console.log(`[Water] Swap dir (configured): ${this.swapDir}`);
			return;
		}

		// Ensure unified path exists
		try { fs.mkdirSync(unified, { recursive: true }); } catch { }

		// If legacy exists, migrate contents to unified (copy only missing files)
		if (fs.existsSync(legacy)) {
			const copyTreeIfMissing = (src, dest) => {
				try { fs.mkdirSync(dest, { recursive: true }); } catch { }
				for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
					const s = path.join(src, entry.name);
					const d = path.join(dest, entry.name);
					if (entry.isDirectory()) copyTreeIfMissing(s, d);
					else if (entry.isFile()) {
						if (!fs.existsSync(d)) {
							try { fs.copyFileSync(s, d); } catch { }
						}
					}
				}
			};
			copyTreeIfMissing(legacy, unified);
			console.log(`[Water] Migrated legacy swap folder from "${legacy}" to "${unified}" (copied missing files)`);
		}

		// Use unified path and persist it in config
		this.swapDir = unified;
		try { config.set("resourceSwapperPath", this.swapDir); } catch { }
		console.log(`[Water] Swap dir: ${this.swapDir}`);
	}

	/**
	 * Get the swap dir path
	 *
	 * @static
	 * @return {string}
	 * @memberof BrowserLoader
	 */
	static getSwapDir() {
		return this.swapDir;
	}

	/**
	 * Initialize the browser window
	 *
	 * @param {string} url
	 * @param {import("electron-store")} config
	 * @param {object} webContents
	 * @param {object} options - Additional options (preloadOnly, onReady)
	 * @returns
	 */
	static initWindow(url, config, webContents, options = {}) {
		const { preloadOnly = false, onReady = null } = options;

		// Determine display mode from config (compatibly handle legacy boolean values)
		let rawMode = config && config.get ? config.get("fullscreen", "windowed") : "windowed";
		let displayMode = (typeof rawMode === "boolean") ? (rawMode ? "fullscreen" : "windowed") : String(rawMode || "windowed");
		if (typeof rawMode === "boolean") {
			try { config.set("fullscreen", displayMode); } catch (_) { }
		}

		// Base window props
		let mainWindowProps = {
			width: 1600,
			height: 900,
			show: !preloadOnly, // Hide window if pre-loading
			title: "Water",
			backgroundColor: "#000000", // Prevent white flash
			autoHideMenuBar: true,
			// @ts-ignore
			webContents,
			webPreferences: {
				preload: path.join(__dirname, "../preload/global.js"),
				autoplayPolicy: "no-user-gesture-required",
				enableRemoteModule: true, // Required for Electron 10+
				contextIsolation: false
				// nodeIntegrationInWorker: true
			}
		};

		// Apply borderless at creation time for best visual behavior
		if (displayMode === "borderless") {
			try {
				const bounds = screen.getPrimaryDisplay().bounds;
				const borderlessProps = {
					frame: false,
					kiosk: true,
					fullscreenable: false,
					fullscreen: false,
					width: bounds.width,
					height: bounds.height
				};
				Object.assign(mainWindowProps, borderlessProps);
			} catch (_) { }
		} else if (displayMode === "fullscreen") {
			mainWindowProps.fullscreen = true;
		} else {
			// windowed or maximized -> leave defaults; maximized will be applied on ready-to-show
			mainWindowProps.fullscreen = false;
		}

		let win = new BrowserWindow(mainWindowProps);

		if (displayMode === "borderless") {
			try { win.moveTop(); } catch (_) { }
		}

		this.setupWindow(win, config, true, options);

		if (!webContents) win.loadURL(url);

		return win; // Ensure window instance is returned
	}

	/**
	 * Set window defaults
	 *
	 * @param {BrowserWindow} win
	 * @param {import("electron-store")} config
	 * @param {Boolean} [isWeb=false]
	 * @param {object} [options={}] - Window options (e.g., preloadOnly)
	 * @returns {any}
	 */
	static setupWindow(win, config, isWeb = false, options = {}) {
		const { preloadOnly = false } = options;
		let contents = win.webContents;

		// Open external links from splash in the user's default browser
		try {
			contents.on("new-window", (event, url) => {
				event.preventDefault();
				try {
					if (/^https?:/i.test(url)) return shell.openExternal(url);
				} catch (_) { }
			});
			contents.on("will-navigate", (event, url) => {
				if (/^https?:/i.test(url)) {
					event.preventDefault();
					try { shell.openExternal(url); } catch (_) { }
				}
			});
		} catch (_) { }

		// Always enforce a custom title and block page title changes
		try {
			win.setTitle(app.name || "Water");
			contents.on("page-title-updated", (event) => {
				event.preventDefault();
				try { win.setTitle(app.name || "Water"); } catch (_) { }
			});
		} catch (_) { }

		if (this.DEBUG) WindowUtils.openDevToolsWithFallback(win);

		// Hide any application menu so no top menu bar is shown
		try { win.setMenuBarVisibility(false); } catch (_) { }
		try { win.removeMenu(); } catch (_) { }

		// Only auto-show window on ready-to-show if NOT preloadOnly
		if (!preloadOnly && !isWeb) {
			// Normalize display mode here as well (defensive)
			let rawMode = config && config.get ? config.get("fullscreen", "windowed") : "windowed";
			let displayMode = (typeof rawMode === "boolean") ? (rawMode ? "fullscreen" : "windowed") : String(rawMode || "windowed");
			if (typeof rawMode === "boolean") { try { config.set("fullscreen", displayMode); } catch (_) { } }

			win.once("ready-to-show", () => {
				let windowType = UrlUtils.locationType(contents.getURL());

				win.on("maximize", () => config.set(`windowState.${windowType}.maximized`, true));
				win.on("unmaximize", () => config.set(`windowState.${windowType}.maximized`, false));
				win.on("enter-full-screen", () => config.set(`windowState.${windowType}.fullScreen`, true));
				win.on("leave-full-screen", () => config.set(`windowState.${windowType}.fullScreen`, false));

				/** @type {object} */
				let windowStateConfig = (config.get("windowState." + windowType, {}));
				// Apply startup display mode preference; only restore windowState if user chose 'windowed'
				if (displayMode === "fullscreen") {
					try { if (!win.isFullScreen()) win.setFullScreen(true); } catch (_) { }
				} else if (displayMode === "maximized") {
					try { if (!win.isMaximized()) win.maximize(); } catch (_) { }
				} else if (displayMode === "windowed") {
					if (windowStateConfig.maximized) win.maximize();
					if (windowStateConfig.fullScreen) win.setFullScreen(true);
				}

				win.show();
			});
		}

		let isMac = process.platform === "darwin";
		shortcuts.register(win, [isMac ? "Command+Option+I" : "Control+Shift+I", "F12"], () => WindowUtils.openDevToolsWithFallback(win));
		shortcuts.register(win, isMac ? "Command+Left" : "Alt+Left", () => contents.canGoBack() && contents.goBack());
		shortcuts.register(win, isMac ? "Command+Right" : "Alt+Right", () => contents.canGoForward() && contents.goForward());
		shortcuts.register(win, "CommandOrControl+Shift+Delete", () => {
			contents.session.clearCache().then(() => {
				app.relaunch();
				app.quit();
			});
		});
		shortcuts.register(win, "Escape", () => contents.executeJavaScript("document.exitPointerLock()", true));
		shortcuts.register(win, "Control+F1", () => {
			config.clear();
			app.relaunch();
			app.quit();
		});
		shortcuts.register(win, "Shift+F1", () => config.openInEditor());

		if (!isWeb) return win;

		// Codes only runs on web windows

		win.once("ready-to-show", () => {
			let windowType = UrlUtils.locationType(contents.getURL());

			win.on("maximize", () => config.set(`windowState.${windowType}.maximized`, true));
			win.on("unmaximize", () => config.set(`windowState.${windowType}.maximized`, false));
			win.on("enter-full-screen", () => config.set(`windowState.${windowType}.fullScreen`, true));
			win.on("leave-full-screen", () => config.set(`windowState.${windowType}.fullScreen`, false));

			/** @type {object} */
			let windowStateConfig = (config.get("windowState." + windowType, {}));
			// Respect display mode over prior windowState except when 'windowed'
			if (displayMode === "fullscreen") {
				try { if (!win.isFullScreen()) win.setFullScreen(true); } catch (_) { }
			} else if (displayMode === "maximized") {
				try { if (!win.isMaximized()) win.maximize(); } catch (_) { }
			} else if (displayMode === "windowed") {
				if (windowStateConfig.maximized) win.maximize();
				if (windowStateConfig.fullScreen) win.setFullScreen(true);
			}
		});

		contents.on("dom-ready", () => (
			(UrlUtils.locationType(contents.getURL()) === "game")
			&& (shortcuts.register(win, "F6", () => win.loadURL("https://krunker.io/"))))
		);

		contents.on("new-window", (event, url, frameName, disposition, options) => {
			event.preventDefault();
			if (UrlUtils.locationType(url) === "external") shell.openExternal(url);
			else if (UrlUtils.locationType(url) !== "unknown") {
				if (frameName === "_self") contents.loadURL(url);
				else this.initWindow(url, config, /** @type {object} */(options).webContents);
			}
		});

		contents.on("will-navigate", (event, url) => {
			event.preventDefault();
			if (UrlUtils.locationType(url) === "external") shell.openExternal(url);
			else if (UrlUtils.locationType(url) !== "unknown") contents.loadURL(url);
		});

		contents.on("will-prevent-unload", event => {
			if (!dialog.showMessageBoxSync({
				buttons: ["Leave", "Cancel"],
				title: "Leave site?",
				message: "Changes you made may not be saved.",
				noLink: true
			})) event.preventDefault();
		});

		shortcuts.register(win, "F5", () => contents.reload());
		shortcuts.register(win, "Shift+F5", () => contents.reloadIgnoringCache());
		shortcuts.register(win, "F11", () => win.setFullScreen(!win.isFullScreen()));
		shortcuts.register(win, "CommandOrControl+L", () => clipboard.writeText(contents.getURL()));
		shortcuts.register(win, "CommandOrControl+N", () => this.initWindow("https://krunker.io/", config));
		shortcuts.register(win, "CommandOrControl+Shift+N", () => this.initWindow(contents.getURL(), config));
		shortcuts.register(win, "CommandOrControl+Alt+R", () => {
			app.relaunch();
			app.quit();
		});

		let swapper = new Swapper(
			win,
			/** @type {string} */(config.get("resourceSwapperMode", "normal")),
			/** @type {string} */(this.swapDir),
			{ ignoreHeadshot: false }
		);
		swapper.init();

		return win;
	}

	/**
	 * Default prompt window configuration
	 *
	 * @static
	 * @param {string} message
	 * @param {object} defaultValue
	 * @param {import("electron-store")} config
	 * @returns {any}
	 * @memberof BrowserLoader
	 */
	static initPromptWindow(message, defaultValue, config = null) {
		let win = new BrowserWindow({
			width: 480,
			height: 240,
			center: true,
			show: false,
			frame: false,
			resizable: false,
			transparent: true,
			autoHideMenuBar: true,
			title: "Water",
			webPreferences: {
				preload: path.join(__dirname, "../preload/prompt.js"),
				enableRemoteModule: true, // Required for Electron 10+
				contextIsolation: false
			}
		});
		let contents = win.webContents;

		// Ensure external links (e.g., Discord invites) open in the default browser
		try {
			contents.on("new-window", (event, url) => {
				event.preventDefault();
				try {
					if (UrlUtils.locationType(url) === "external" || /^https?:/i.test(url)) shell.openExternal(url);
				} catch (_) { }
			});
			contents.on("will-navigate", (event, url) => {
				event.preventDefault();
				try {
					if (UrlUtils.locationType(url) === "external" || /^https?:/i.test(url)) shell.openExternal(url);
				} catch (_) { }
			});
		} catch (_) { }

		this.setupWindow(win, config);
		win.once("ready-to-show", () => contents.send("prompt-data", message, defaultValue));

		win.loadFile("app/html/prompt.html");

		return win;
	}

	static initSplashWindow(shouldAutoUpdate, config) {
		let win = new BrowserWindow({
			width: 1366,
			height: 768,
			minWidth: 1366,
			maxWidth: 1366,
			minHeight: 768,
			maxHeight: 768,
			center: true,
			resizable: false,
			alwaysOnTop: false, // Allow window switching
			show: false,
			frame: false,
			transparent: false,
			useContentSize: false,
			autoHideMenuBar: true,
			title: "Water",
			webPreferences: {
				preload: path.join(__dirname, "../preload/splash.js"),
				enableRemoteModule: true, // Required for Electron 10+
				backgroundThrottling: false,
				spellcheck: false,
				contextIsolation: false
			}
		});

		let contents = win.webContents;

		async function autoUpdate() {
			return new Promise((resolve, reject) => {
				if (shouldAutoUpdate === "skip") return resolve();

				return contents.on("dom-ready", () => {
					contents.send("message", "Initializing the auto updater...");
					const { autoUpdater } = require("electron-updater");
					autoUpdater.logger = log;

					autoUpdater.on("error", err => {
						console.error(err);
						contents.send("message", "Error: " + err.name);
						reject(`Error occurred: ${err.name}`);
					});
					autoUpdater.on("checking-for-update", () => contents.send("message", "Checking for update"));
					autoUpdater.on("update-available", info => {
						console.log(info);
						contents.send("message", `Update v${info.version} available`, info.releaseDate);
						if (shouldAutoUpdate !== "download") resolve();
					});
					autoUpdater.on("update-not-available", info => {
						console.log(info);
						contents.send("message", "No update available");
						resolve();
					});
					autoUpdater.on("download-progress", info => {
						contents.send("message", `Downloaded ${Math.floor(info.percent)}%`, Math.floor(info.bytesPerSecond / 1000) + "kB/s");
						win.setProgressBar(info.percent / 100);
					});
					autoUpdater.on("update-downloaded", info => {
						contents.send("message", null, `Installing v${info.version}...`);
						autoUpdater.quitAndInstall(true, true);
					});

					autoUpdater.autoDownload = shouldAutoUpdate === "download";
					autoUpdater.checkForUpdates();
				});
			});
		}

		// Keep splash visible for a minimum duration (configurable, default 2000ms)
		const splashMinMs = Math.max(0, parseInt(String((config && config.get) ? config.get("splashMinMs", 2000) : 2000), 10) || 2000);
		if (String(shouldAutoUpdate) === "skip") {
			// Development mode: simulate update progress and then respect min duration
			const start = Date.now();
			let i = 0;
			const interval = setInterval(() => {
				if (i > 100) {
					clearInterval(interval);
					const elapsed = Date.now() - start;
					const wait = Math.max(0, splashMinMs - elapsed);
					// Emit IPC to trigger game window show (main.js handles it)
					setTimeout(() => {
						contents.send('open-game');
					}, wait);
				} else {
					try { contents.send("message", "Updating...", `${i}% complete`); } catch (_) { }
					i += 10;
				}
			}, 400);
		} else {
			// Production: run auto-updater in parallel with min show time
			const minShow = new Promise(resolve => setTimeout(resolve, splashMinMs));
			Promise.all([autoUpdate().catch((err) => {
				console.error('[Water] Auto-update error (possibly GPU initialization failure):', err);
				// Continue anyway - don't block game window
			}), minShow]).then(() => {
				// Emit IPC to trigger game window show (main.js handles it)
				contents.send('open-game');
			}).catch((err) => {
				console.error('[Water] Critical splash error, forcing open-game anyway:', err);
				// Force send even on critical failure to prevent splash hang
				try {
					contents.send('open-game');
				} catch (e) {
					console.error('[Water] Failed to send open-game IPC:', e);
				}
			});
		}

		BrowserLoader.setupWindow(win, config, false, { preloadOnly: true }); // Prevent window state restoration
		console.log('[Water] Loading splash.html...');
		win.loadFile("app/html/splash.html");
		win.once('ready-to-show', () => {
			console.log('[Water] Splash ready-to-show, centering and showing...');
			win.center(); // Center the window
			win.show();
		});
		win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
			console.error('[Water] Splash failed to load:', errorCode, errorDescription);
		});
		return win;
	}
}

module.exports = BrowserLoader;
