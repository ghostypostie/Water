"use strict";

require("v8-compile-cache");

let path = require("path");
let fs = require("fs");
let { app, protocol } = require("electron");
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
// Bot client removed
const adblock = require("./modules/adblock");


Object.assign(console, log.functions);

console.log(`Water@${app.getVersion()} { Electron: ${process.versions.electron}, Node: ${process.versions.node}, Chromium: ${process.versions.chrome} }`);
if (!app.requestSingleInstanceLock()) app.quit();

const { argv } = yargs;
const config = new Store();

// Add error handlers to debug crashes
process.on('uncaughtException', (error) => {
	console.error('[Water] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('[Water] Unhandled Rejection at:', promise, 'reason:', reason);
});


/** @type {string} */
let userscriptsDirConfig = (config.get("userscriptsPath", ""));
const userscriptsDir = PathUtils.isValidPath(userscriptsDirConfig) ? userscriptsDirConfig : path.join(app.getPath("documents"), "Water/Scripts");
cliSwitches(app, config);

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
	// Workaround for Electron 8.x
	protocol.registerSchemesAsPrivileged([
		{
			scheme: "Water-Swap",
			privileges: {
				secure: true,
				corsEnabled: true,
				standard: true,
				supportFetchAPI: true,
				stream: true,
				bypassCSP: true
			}
		},
		{
			scheme: "water-swap",
			privileges: {
				secure: true,
				corsEnabled: true,
				standard: true,
				supportFetchAPI: true,
				stream: true,
				bypassCSP: true
			}
		}
	]);

	/** @type {any} */
	BrowserLoader.load(Boolean(argv.debug), config);
	IpcLoader.load(config);
	IpcLoader.initRpc(config);

	// Bot client removed

	app.once("ready", async () => {
		// Initialize AutoUpdater
		autoUpdater.logger = log;
		autoUpdater.logger.transports.file.level = "info";
		console.log('[Water] Checking for updates...');
		autoUpdater.checkForUpdatesAndNotify().catch(err => {
			console.error('[Water] Update check failed:', err);
		});

		// Select random loading background
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

		// IPC handler for splash screen to get the background
		const { ipcMain } = require("electron");
		ipcMain.handle('get-loading-bg', () => {
			return global.loadingBg || null;
		});

		try {
			console.log('[Water] App ready event fired');
			await PathUtils.ensureDirs(BrowserLoader.getSwapDir(), userscriptsDir);
			// Seed built-in default swaps (never overwrites existing user files)
			try {
				await seedDefaults(__dirname, BrowserLoader.getSwapDir());
				console.log("[SwapperSeeder] Defaults check complete");
			} catch (e) {
				console.warn("[SwapperSeeder] Seed error:", e);
			}
			function resolveSwapPath(url) {
				try {
					let raw = decodeURI(url);
					// Strip any scheme (case-insensitive) like 'Water-Swap:' or 'water-swap:'
					raw = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:/, "");
					// Remove leading '//' if present (e.g., '///C:/...' or '//C:/...')
					raw = raw.replace(/^\/{2}/, "");
					if (process.platform === "win32") {
						// '/C:/' => 'C:/'
						raw = raw.replace(/^\/([A-Za-z]:)/, "$1");
						// '/C/...' => 'C:/...'
						raw = raw.replace(/^\/([A-Za-z])\//, "$1:/");
						// 'C/...' or 'C\' (missing colon) => 'C:/...'
						if (/^[A-Za-z](?:[\\/]|$)/.test(raw) && !/^[A-Za-z]:/.test(raw)) raw = raw[0] + ":" + raw.slice(1);
						// Normalize slashes
						raw = raw.replace(/\//g, path.sep);
						raw = path.normalize(raw);
					}
					return raw;
				}
				catch (_) { return ""; }
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
				console.log(`[Water Swap] ${request.url} -> ${p}`);
				callback({ path: p, mimeType: guessMime(p) });
			});
			protocol.registerFileProtocol("water-swap", (request, callback) => {
				const p = resolveSwapPath(request.url);
				console.log(`[water-swap] ${request.url} -> ${p}`);
				callback({ path: p, mimeType: guessMime(p) });
			});

			// Set up global ad blocking interceptor
			if (config.get("adBlock", false)) {
				const { session } = require("electron");
				console.log("[Water] Ad blocking enabled, setting up interceptor");
				session.defaultSession.webRequest.onBeforeRequest(async (details, callback) => {
					const result = await adblock(details);
					callback(result);
				});
			}

			app.on("second-instance", (_, _argv) => {
				let instanceArgv = yargs.parse(_argv);
				console.log("Second instance: " + _argv);
				if (!["unknown", "external"].includes(UrlUtils.locationType(String(instanceArgv["new-window"])))) {
					BrowserLoader.initWindow(String(instanceArgv["new-window"]), config);
				}
			});

			// Single Window Creation - Pre-render game window behind splash
			console.log('[Water] Starting single-window loader sequence...');
			const { ipcMain } = require('electron');

			let splashWindow = null;
			let gameWindow = null;
			let gameReady = false;
			let gameShown = false;

			// Step 1: Create splash window (visible)
			splashWindow = BrowserLoader.initSplashWindow(
				app.isPackaged ? String(argv.update || config.get("autoUpdate", "download")) : "skip",
				config
			);
			console.log('[Water] Splash window created');

			// Step 2: Create game window (hidden, pre-loading)
			splashWindow.once('show', () => {
				console.log('[Water] Splash shown, creating game window...');
				setTimeout(() => {
					console.log('[Water] Creating game window (hidden)...');
					gameWindow = BrowserLoader.initWindow("https://krunker.io/", config, null, { preloadOnly: true });
					console.log('[Water] Game window created, loading in background');

					// Listen for game-ready IPC from game.js preload
					ipcMain.once('game-ready', () => {
						console.log('[Water] Game ready IPC received');
						gameReady = true;
						// Don't auto-show, wait for splash to trigger
					});

					// Error handling
					gameWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
						console.error('[Water] Game window failed to load:', errorCode, errorDescription);
					});

					// Timeout failsafe - mark ready after 15 seconds
					setTimeout(() => {
						if (!gameReady) {
							console.warn('[Water] Game load timeout (15s), marking as ready');
							gameReady = true;
						}
					}, 15000);

					// CRITICAL: Absolute maximum timeout (30s) - force transition even if IPC never arrives
					// This prevents splash hang when GPU settings cause initialization failure
					setTimeout(() => {
						if (!gameShown) {
							console.warn('[Water] CRITICAL TIMEOUT: Forcing game window show after 30s (GPU initialization may have failed)');
							// Trigger the open-game handler
							ipcMain.emit('open-game');
						}
					}, 30000);
				}, 500);
			});

			// Handle manual close button (close splash and prevent game window)
			ipcMain.on('close-splash', () => {
				console.log('[Water] Close-splash IPC received, closing splash and canceling game window');
				if (splashWindow && !splashWindow.isDestroyed()) {
					splashWindow.close();
					console.log('[Water] Splash window closed by user');
				}
				if (gameWindow && !gameWindow.isDestroyed()) {
					gameWindow.destroy();
					console.log('[Water] Game window destroyed (user closed splash)');
				}
			});

			// Step 3: Handle 'open-game' IPC from splash (ONCE ONLY)
			ipcMain.once('open-game', () => {
				console.log('[Water] ========== OPEN-GAME IPC RECEIVED ==========');
				console.log('[Water] gameWindow exists:', !!gameWindow);
				console.log('[Water] gameWindow destroyed:', gameWindow ? gameWindow.isDestroyed() : 'N/A');
				console.log('[Water] gameShown:', gameShown);

				if (!gameWindow) {
					console.warn('[WaterClient] Game window missing, cannot show');
					return;
				}

				if (gameShown) {
					console.warn('[WaterClient] Game window already shown, ignoring duplicate request');
					return;
				}

				gameShown = true;
				console.log('[Water] open-game IPC received, triggering transition...');

				// Trigger splash fade-out
				if (splashWindow && !splashWindow.isDestroyed()) {
					splashWindow.webContents.send('fade-out');
					console.log('[Water] Sent fade-out to splash');
				}

				// Wait 800ms for fade, then show game and close splash
				setTimeout(() => {
					if (gameWindow && !gameWindow.isDestroyed()) {
						console.log('[Water] ========== SHOWING GAME WINDOW ==========');
						console.log('[Water] Window state before show:');
						console.log('  - isVisible:', gameWindow.isVisible());
						console.log('  - isMinimized:', gameWindow.isMinimized());
						console.log('  - isFocused:', gameWindow.isFocused());
						console.log('  - bounds:', gameWindow.getBounds());

						// CRITICAL FIX: Force window to be visible
						try {
							// Restore if minimized
							if (gameWindow.isMinimized()) {
								console.log('[Water] Window was minimized, restoring...');
								gameWindow.restore();
							}

							// Center the window to ensure it's on screen
							console.log('[Water] Centering window...');
							gameWindow.center();

							// Force window to top temporarily
							console.log('[Water] Setting window always on top...');
							gameWindow.setAlwaysOnTop(true, 'screen-saver');

							// Show and focus
							console.log('[Water] Calling show()...');
							gameWindow.show();
							console.log('[Water] Calling focus()...');
							gameWindow.focus();

							// Remove always-on-top after 2 seconds
							setTimeout(() => {
								if (gameWindow && !gameWindow.isDestroyed()) {
									console.log('[Water] Removing always-on-top...');
									gameWindow.setAlwaysOnTop(false);
								}
							}, 2000);

							console.log('[Water] Window state after show:');
							console.log('  - isVisible:', gameWindow.isVisible());
							console.log('  - isMinimized:', gameWindow.isMinimized());
							console.log('  - isFocused:', gameWindow.isFocused());
							console.log('  - bounds:', gameWindow.getBounds());
							console.log('[Water] ========== GAME WINDOW SHOULD BE VISIBLE NOW ==========');
						} catch (err) {
							console.error('[Water] ERROR showing game window:', err);
						}
					}

					// Close splash after transition
					setTimeout(() => {
						if (splashWindow && !splashWindow.isDestroyed()) {
							splashWindow.close();
							console.log('[Water] Splash window closed');
						}
					}, 300);
				}, 800);
			});

		} catch (error) {
			console.error('[Water] Error in ready callback:', error);
			console.error('[Water] Stack:', error.stack);
		}
	});

	// Quit app when all windows are closed (except on macOS)
	app.on('window-all-closed', () => {
		console.log('[Water] All windows closed');
		if (process.platform !== 'darwin') {
			console.log('[Water] Quitting app');
			app.quit();
		}
	});
};

init();
