"use strict";

let yargs = require("yargs");
const logger = require("../utils/logger");

/**
 * Append CLI switches to the underlying Chromium instance for maximum performance.
 *
 * @param {import("electron").App} app
 * @param {import("electron-store")} config
 */
let cliSwitchHandler = function(app, config) {
	const angleBackend = /** @type {string} */ (config.get("angleBackend", "d3d11"));
	const colorProfile = /** @type {string} */ (config.get("colorProfile", "default"));

	// ── Media ──────────────────────────────────────────────────────────────────
	app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
	app.commandLine.appendSwitch("enable-usermedia-screen-capturing");
	app.commandLine.appendSwitch("allow-http-screen-capture");

	// ── Disable telemetry / background noise ───────────────────────────────────
	app.commandLine.appendSwitch("disable-breakpad");
	app.commandLine.appendSwitch("disable-print-preview");
	app.commandLine.appendSwitch("disable-metrics");
	app.commandLine.appendSwitch("disable-metrics-repo");
	app.commandLine.appendSwitch("disable-hang-monitor");
	app.commandLine.appendSwitch("disable-component-update");
	app.commandLine.appendSwitch("disable-domain-reliability");
	app.commandLine.appendSwitch("disable-background-networking");
	app.commandLine.appendSwitch("disable-sync");
	app.commandLine.appendSwitch("disable-translate");
	app.commandLine.appendSwitch("no-first-run");
	app.commandLine.appendSwitch("no-default-browser-check");

	// ── GPU / Rasterization ────────────────────────────────────────────────────
	app.commandLine.appendSwitch("ignore-gpu-blacklist");
	app.commandLine.appendSwitch("disable-gpu-driver-bug-workarounds");
	app.commandLine.appendSwitch("enable-gpu-rasterization");
	app.commandLine.appendSwitch("enable-zero-copy");
	app.commandLine.appendSwitch("disable-software-rasterizer");
	app.commandLine.appendSwitch("num-raster-threads", "4");
	app.commandLine.appendSwitch("enable-oop-rasterization");
	app.commandLine.appendSwitch("enable-gpu-memory-buffer-compositor-resources");
	app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");

	// ── WebGL & Canvas ─────────────────────────────────────────────────────────
	app.commandLine.appendSwitch("enable-webgl");
	app.commandLine.appendSwitch("enable-webgl2-compute-context");
	app.commandLine.appendSwitch("max-active-webgl-contexts", "100");
	app.commandLine.appendSwitch("enable-accelerated-2d-canvas");
	app.commandLine.appendSwitch("disable-2d-canvas-clip-aa");

	// ── Mouse / Input latency ──────────────────────────────────────────────────
	app.commandLine.appendSwitch("enable-highres-timer");
	app.commandLine.appendSwitch("disable-input-event-coalescing");
	app.commandLine.appendSwitch("enable-pointer-lock-options");

	// ── Network ────────────────────────────────────────────────────────────────
	app.commandLine.appendSwitch("enable-quic");
	app.commandLine.appendSwitch("disable-ipc-flooding-protection");

	// ── V8 JavaScript engine ───────────────────────────────────────────────────
	app.commandLine.appendSwitch("enable-javascript-harmony");
	// expose-gc lets us call global.gc() for post-match cleanup
	app.commandLine.appendSwitch("js-flags", "--max-old-space-size=4096 --expose-gc --max-semi-space-size=64");

	// ── Frame pacing / throttling ──────────────────────────────────────────────
	app.commandLine.appendSwitch("disable-frame-rate-limit");
	app.commandLine.appendSwitch("disable-gpu-vsync");
	app.commandLine.appendSwitch("max-gum-fps", "9999");
	// Single disable-features call (multiple calls only keep the last one)
	app.commandLine.appendSwitch("disable-features",
		"CalculateNativeWinOcclusion,BackgroundTimerThrottling,HardwareMediaKeyHandling,MediaSessionService,BackgroundFetch,BackgroundSync");
	app.commandLine.appendSwitch("disable-renderer-backgrounding");
	app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
	app.commandLine.appendSwitch("disable-background-timer-throttling");
	app.commandLine.appendSwitch("disable-partial-raster");
	app.commandLine.appendSwitch("disable-low-end-device-mode");
	app.commandLine.appendSwitch("disable-features-list", "BackgroundTimerThrottling");
	app.commandLine.appendSwitch("disable-ipc-flooding-protection");

	// ── Blink features ─────────────────────────────────────────────────────────
	// Single call - multiple appendSwitch calls for the same flag only keep the last
	app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");

	// ── Accelerated canvas (user-configurable) ─────────────────────────────────
	if (!config.get("acceleratedCanvas", true)) {
		app.commandLine.appendSwitch("disable-accelerated-2d-canvas");
	}

	// ── In-process GPU (user-configurable, helps on some systems) ─────────────
	if (config.get("inProcessGPU", false)) {
		app.commandLine.appendSwitch("in-process-gpu");
	}

	// ── ANGLE backend & color profile ─────────────────────────────────────────
	if (angleBackend !== "default") app.commandLine.appendSwitch("use-angle", angleBackend);
	if (colorProfile !== "default") app.commandLine.appendSwitch("force-color-profile", colorProfile);

	// ── User-defined extra Chromium flags ─────────────────────────────────────
	yargs.parse(
		/** @type {string} */ (config.get("chromiumFlags", "")),
		(_, argv) => Object.entries(argv).slice(1, -1).forEach(entry => app.commandLine.appendSwitch(entry[0], entry[1]))
	);

	if (logger.isDebugEnabled()) {
		console.log('[Water] CLI switches applied. ANGLE:', angleBackend, '| Color profile:', colorProfile);
	}
};

module.exports = cliSwitchHandler;
