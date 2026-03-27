"use strict";

require("v8-compile-cache");

let path = require("path");
let fs = require("fs");
let { app, protocol, powerSaveBlocker } = require("electron");
let Store = require("electron-store");
let log = require("electron-log");
const { autoUpdater } = require("electron-updater");
let yargs = require("yargs");

let PathUtils = require("./utils/path-utils");
let UrlUtils = require("./utils/url-utils");
let cliSwitches = require("./modules/cli-switches");
let BrowserLoader = require("./loaders/browser-loader");
let IpcLoader = require("./loaders/ipc-loader");
const { seedDefaults } = require("./modules/swapper-seeder");
const adblock = require("./modules/adblock");
const logger = require("./utils/logger");

Object.assign(console, log.functions);

const config = new Store();
const debugLog = (...args) => logger.isDebugEnabled() ? console.log(...args) : null;

debugLog(`Water@${app.getVersion()} { Electron: ${process.versions.electron}, Node: ${process.versions.node}, Chromium: ${process.versions.chrome} }`);
if (!app.requestSingleInstanceLock()) app.quit();

const { argv } = yargs;

process.on('uncaughtException', (error) => {
	console.error('[Water] Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
	console.error('[Water] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Prevent system sleep/throttling — keeps game running at full speed even when unfocused
let powerSaveBlockerId = null;
try {
	powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
	console.log('[Water] Power save blocker started:', powerSaveBlockerId);
} catch (e) {
	console.error('[Water] Failed to start power save blocker:', e);
}

/** @type {string} */
let userscriptsDirConfig = (config.get("userscriptsPath", ""));
const userscriptsDir = PathUtils.isValidPath(userscriptsDirConfig) ? userscriptsDirConfig : path.join(app.getPath("documents"), "Water/Scripts");
cliSwitches(app, config);

// Set AppUserModelId for Windows notifications (must be before app ready)
if (process.platform === "win32") {
	app.setAppUserModelId("io.water.client");
}

if (process.platform === "win32") {
	app.setUserTasks([{
		program: process.execPath,
		arguments: "--new-window=https://krunker.io/",
		title: "New game window",
		description: "Opens a new game window",
		iconPath: process.execPath,
		iconIndex: 0
	}, {
		program: process.execPath,
		arguments: "--new-window=https://krunker.io/social.html",
		title: "New social window",
		description: "Opens a new social window",
		iconPath: process.execPath,
		iconIndex: 0
	}]);
}

let init = function () {
	// Protocol registration (must be before app ready)
	protocol.registerSchemesAsPrivileged([
		{
			scheme: "Water-Swap",
			privileges: { secure: true, corsEnabled: true, standard: true, supportFetchAPI: true, stream: true, bypassCSP: true }
		},
		{
			scheme: "water-swap",
			privileges: { secure: true, corsEnabled: true, standard: true, supportFetchAPI: true, stream: true, bypassCSP: true }
		}
	]);

	BrowserLoader.load(Boolean(argv.debug), config);
	IpcLoader.load(config);

	app.once("ready", async () => {
		// Auto-updater (production only)
		if (!app.isPackaged) {
			debugLog('[Water] Development mode - skipping auto-updater');
		} else {
			autoUpdater.logger = log;
			autoUpdater.logger.transports.file.level = "info";
			autoUpdater.autoDownload = true;
			autoUpdater.allowPrerelease = false;
			autoUpdater.on('error', err => console.error('[Water] Auto-updater error:', err));
			autoUpdater.on('update-downloaded', info => {
				const { dialog } = require('electron');
				dialog.showMessageBox({
					type: 'info',
					title: 'Update Ready',
					message: `Water Client v${info.version} has been downloaded and will be installed when you close the app.`,
					buttons: ['OK']
				});
			});
			autoUpdater.checkForUpdatesAndNotify().catch(err => console.error('[Water] Update check failed:', err.message));
		}

		// Random loading background
		try {
			const bgDir = path.join(__dirname, "assets", "bg");
			if (fs.existsSync(bgDir)) {
				const files = fs.readdirSync(bgDir).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
				if (files.length > 0) {
					const randomFile = files[Math.floor(Math.random() * files.length)];
					global.loadingBg = path.join(bgDir, randomFile).replace(/\\/g, "/");
					console.log('[Water] Selected loading background:', global.loadingBg);
				}
			}
		} catch (e) {
			console.error('[Water] Failed to select loading background:', e);
		}

		const { ipcMain, Notification, shell } = require("electron");
		ipcMain.handle('get-loading-bg', () => global.loadingBg || null);
		ipcMain.handle('shell-show-item', (_, filePath) => { try { shell.showItemInFolder(filePath); } catch (_) {} });

		// Helper: show a ranked match notification
		const showRankedNotification = (gameWindow) => {
			try {
				const iconPath = path.join(__dirname, 'imgs/logo.png');
				const notif = new Notification({
					title: 'Water Client',
					body: 'Ranked Match Found!',
					icon: fs.existsSync(iconPath) ? iconPath : undefined,
					urgency: 'critical'
				});
				notif.on('click', () => {
					if (gameWindow && !gameWindow.isDestroyed()) {
						if (gameWindow.isMinimized()) gameWindow.restore();
						gameWindow.show();
						gameWindow.focus();
						gameWindow.moveTop();
					}
				});
				notif.show();
				console.log('[Water] Ranked match notification shown');
			} catch (err) {
				console.error('[Water] Notification error:', err);
			}
		};

		// Helper: focus game window
		const focusGameWindow = (gameWindow) => {
			if (!gameWindow || gameWindow.isDestroyed()) return;
			if (gameWindow.isMinimized()) gameWindow.restore();
			if (!gameWindow.isVisible()) gameWindow.show();
			gameWindow.setAlwaysOnTop(true, 'screen-saver');
			gameWindow.focus();
			gameWindow.moveTop();
			gameWindow.flashFrame(true);
			setTimeout(() => {
				if (gameWindow && !gameWindow.isDestroyed()) {
					gameWindow.flashFrame(false);
					gameWindow.setAlwaysOnTop(false);
				}
			}, 2000);
		};

		try {
			console.log('[Water] App ready event fired');
			await PathUtils.ensureDirs(BrowserLoader.getSwapDir(), userscriptsDir);
			try {
				await seedDefaults(__dirname, BrowserLoader.getSwapDir());
				console.log("[SwapperSeeder] Defaults check complete");
			} catch (e) {
				console.warn("[SwapperSeeder] Seed error:", e);
			}

			function resolveSwapPath(url) {
				try {
					let raw = decodeURI(url);
					raw = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:/, "");
					raw = raw.replace(/^\/{2}/, "");
					if (process.platform === "win32") {
						raw = raw.replace(/^\/([A-Za-z]:)/, "$1");
						raw = raw.replace(/^\/([A-Za-z])\//, "$1:/");
						if (/^[A-Za-z](?:[\\/]|$)/.test(raw) && !/^[A-Za-z]:/.test(raw)) raw = raw[0] + ":" + raw.slice(1);
						raw = raw.replace(/\//g, path.sep);
						raw = path.normalize(raw);
					}
					return raw;
				} catch (_) { return ""; }
			}

			function guessMime(p) {
				const ext = String(p).toLowerCase().split('.').pop();
				switch (ext) {
					case 'mp3': return 'audio/mpeg';
					case 'ogg': return 'audio/ogg';
					case 'wav': return 'audio/wav';
					default: return undefined;
				}
			}

			protocol.registerFileProtocol("Water-Swap", (request, callback) => {
				const p = resolveSwapPath(request.url);
				callback({ path: p, mimeType: guessMime(p) });
			});
			protocol.registerFileProtocol("water-swap", (request, callback) => {
				const p = resolveSwapPath(request.url);
				callback({ path: p, mimeType: guessMime(p) });
			});

			if (config.get("adBlock", false)) {
				const { session } = require("electron");
				session.defaultSession.webRequest.onBeforeRequest(async (details, callback) => {
					callback(await adblock(details));
				});
			}

			app.on("second-instance", (_, _argv) => {
				let instanceArgv = yargs.parse(_argv);
				if (!["unknown", "external"].includes(UrlUtils.locationType(String(instanceArgv["new-window"])))) {
					BrowserLoader.initWindow(String(instanceArgv["new-window"]), config);
				}
			});

			// ─────────────────────────────────────────────────────────────
			// WINDOW LIFECYCLE
			// ─────────────────────────────────────────────────────────────
			console.log('[Water] Starting window sequence...');

			let splashWindow = null;
			let gameWindow = null;
			let gameShown = false;

			const autoUpdateMode = app.isPackaged ? config.get("autoUpdate", "download") : "skip";

			// ── Step 1: Splash window (visible, NOT always-on-top) ────────
			splashWindow = BrowserLoader.initSplashWindow(autoUpdateMode, config);
			console.log('[Water] Splash window created');

			// ── Step 2: Preload CSS during splash ─────────────────────────
			splashWindow.once('ready-to-show', () => {
				setTimeout(() => {
					try {
						if (splashWindow && !splashWindow.isDestroyed()) {
							splashWindow.webContents.send('message', 'Preloading Water...', '');
						}
						const cssFiles = [
							path.join(__dirname, 'assets/css/main_custom.css'),
							path.join(__dirname, 'styles/adblock.css')
						];
						const cachedCSS = {};
						cssFiles.forEach(filePath => {
							try {
								if (fs.existsSync(filePath)) {
									cachedCSS[path.basename(filePath)] = fs.readFileSync(filePath, 'utf8');
									console.log(`[Water] Preloaded CSS: ${path.basename(filePath)}`);
								}
							} catch (e) { console.error(`[Water] Failed to preload ${filePath}:`, e); }
						});
						global.waterPreloadedCSS = cachedCSS;
						if (splashWindow && !splashWindow.isDestroyed()) {
							splashWindow.webContents.send('message', 'Water Ready', '✓');
						}
					} catch (e) {
						console.error('[Water] Failed to preload CSS:', e);
					}
				}, 200);
			});

			// ── Step 3: Create game window (hidden/minimized) once splash shows ──
			splashWindow.once('show', () => {
				console.log('[Water] Splash shown, creating game window in background...');
				setTimeout(() => {
					// Create game window hidden - it loads krunker.io in the background
					gameWindow = BrowserLoader.initWindow("https://krunker.io/", config, null, { preloadOnly: true });
					console.log('[Water] Game window created (hidden, loading in background)');

					gameWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
						console.error('[Water] Game window failed to load:', errorCode, errorDescription);
					});

					// In skip mode, trigger transition after a short delay
					if (autoUpdateMode === "skip") {
						setTimeout(() => {
							if (splashWindow && !splashWindow.isDestroyed()) {
								splashWindow.webContents.send('open-game');
							}
						}, 800);
					}

					// Failsafe: force transition after 30s
					setTimeout(() => {
						if (!gameShown) {
							console.warn('[Water] Failsafe: forcing game window show after 30s');
							triggerTransition();
						}
					}, 30000);
				}, 300);
			});

			// ── Transition: fade splash → show game ───────────────────────
			const triggerTransition = () => {
				if (gameShown || !gameWindow || gameWindow.isDestroyed()) return;
				gameShown = true;

				// Fade out splash
				if (splashWindow && !splashWindow.isDestroyed()) {
					splashWindow.webContents.send('fade-out');
				}

				// After fade, show game window and close splash
				setTimeout(() => {
					if (gameWindow && !gameWindow.isDestroyed()) {
						if (gameWindow.isMinimized()) gameWindow.restore();
						gameWindow.show();
						gameWindow.focus();
						console.log('[Water] Game window shown');
					}
					setTimeout(() => {
						if (splashWindow && !splashWindow.isDestroyed()) {
							splashWindow.close();
							console.log('[Water] Splash closed');
						}
					}, 300);
				}, 600);
			};

			// Game window signals DOM is ready
			ipcMain.once('game-ready', () => {
				console.log('[Water] Game ready IPC received - transitioning');
				triggerTransition();
			});

			// Splash signals it's done (update check complete)
			ipcMain.once('open-game', () => {
				console.log('[Water] open-game IPC received - transitioning');
				triggerTransition();
			});

			// ── Close splash button ───────────────────────────────────────
			ipcMain.on('close-splash', () => {
				if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
				if (gameWindow && !gameWindow.isDestroyed()) gameWindow.destroy();
			});

			// ── Ranked match found ────────────────────────────────────────
			ipcMain.on('ranked-match-found', () => {
				console.log('[Water] Ranked match found');
				focusGameWindow(gameWindow);
				showRankedNotification(gameWindow);
			});

			// Legacy handler
			ipcMain.on('focus-window', () => {
				focusGameWindow(gameWindow);
				showRankedNotification(gameWindow);
			});

			ipcMain.on('ranked-match-cancelled', () => {
				console.log('[Water] Ranked match cancelled');
			});

		} catch (error) {
			console.error('[Water] Error in ready callback:', error);
			console.error('[Water] Stack:', error.stack);
		}
	});

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') app.quit();
	});
};

init();
