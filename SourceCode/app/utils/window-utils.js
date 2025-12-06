"use strict";

let { BrowserWindow } = require("electron");

/**
 * Collection of Window Utilities
 *
 * @class WindowUtils
 */
class WindowUtils {
	/**
	 * Attempt to toggle the devtools with
	 * a fallback if the regular method fails.
	 *
	 * @static
	 * @param {Electron.BrowserWindow} window
	 * @param {Electron.OpenDevToolsOptions} [options]
	 * @memberof WindowUtils
	 */
	static openDevToolsWithFallback(window, options) {
		// Toggle DevTools - close if already open
		if (window.webContents.isDevToolsOpened()) {
			window.webContents.closeDevTools();
			return;
		}

		// Always open in detached mode (separate window) for better performance
		const devToolsOptions = { mode: "detach", ...options };

		let assumeFallback = true;
		window.webContents.openDevTools(devToolsOptions);
		window.webContents.once("devtools-opened", () => {
			assumeFallback = false;
			console.log('[Water] DevTools opened in detached mode');
		});

		setTimeout(() => {
			if (assumeFallback) {
				// Fallback if openDevTools fails
				window.webContents.closeDevTools();

				const devtoolsWindow = new BrowserWindow();
				devtoolsWindow.setMenuBarVisibility(false);

				window.webContents.setDevToolsWebContents(devtoolsWindow.webContents);
				window.webContents.openDevTools({ mode: "detach" });
				window.once("closed", () => devtoolsWindow.destroy());
				console.log('[Water] DevTools opened using fallback method');
			}
		}, 500);
	}
}

module.exports = WindowUtils;
