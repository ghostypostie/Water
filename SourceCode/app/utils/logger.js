"use strict";

/**
 * Centralized logging utility for Water Client
 * Respects the debugLogging setting
 */

let Store;
let config;

try {
	Store = require("electron-store");
	config = new Store();
} catch (e) {
	// Fallback if electron-store not available
	config = null;
	console.warn('[Water Logger] Could not load electron-store, debug logging disabled');
}

/**
 * Check if debug logging is enabled
 * @returns {boolean}
 */
function isDebugEnabled() {
	try {
		if (!config) return false;
		return config.get("debugLogging", false);
	} catch (e) {
		return false;
	}
}

/**
 * Conditional console.log
 * @param {...any} args
 */
function log(...args) {
	try {
		if (isDebugEnabled()) {
			console.log(...args);
		}
	} catch (e) {
		// Silently fail
	}
}

/**
 * Conditional console.warn
 * @param {...any} args
 */
function warn(...args) {
	try {
		if (isDebugEnabled()) {
			console.warn(...args);
		}
	} catch (e) {
		// Silently fail
	}
}

/**
 * Conditional console.error (always shows errors)
 * @param {...any} args
 */
function error(...args) {
	console.error(...args);
}

/**
 * Conditional console.info
 * @param {...any} args
 */
function info(...args) {
	try {
		if (isDebugEnabled()) {
			console.info(...args);
		}
	} catch (e) {
		// Silently fail
	}
}

module.exports = {
	log,
	warn,
	error,
	info,
	isDebugEnabled
};
