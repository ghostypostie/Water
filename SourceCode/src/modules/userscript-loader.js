"use strict";

/**
 * Water Client userscript loader
 * Executes userscripts in renderer context with proper timing and context
 */

const { readFileSync, readdirSync, existsSync } = require('fs');
const { resolve: pathResolve } = require('path');

/** Shared userscript data */
const su = {
	userscriptsPath: '',
	userscripts: [],
	config: null // electron-store config
};

/** Simple error alert for userscripts */
const errAlert = (err, name) => {
	alert(`Userscript '${name}' had an error:\n\n${err.toString()}\n\nPlease fix the error, disable the userscript in the 'tracker.json' file or delete it.\nFeel free to check console for stack trace`);
};

/** Stripped console that works even when Krunker disables it */
const strippedConsole = {
	log: (...args) => console.log(...args),
	warn: (...args) => console.warn(...args),
	error: (...args) => console.error(...args)
};

/** CSS toggle helper for userscripts */
const userscriptToggleCSS = (css, identifier, value) => {
	// This will be implemented via electron's insertCSS/removeCSS
	// For now, use style tags
	const styleId = `userscript-css-${identifier}`;
	
	if (value === false || value === 'toggle' && document.getElementById(styleId)) {
		const existing = document.getElementById(styleId);
		if (existing) existing.remove();
		return;
	}
	
	if (value === true || value === 'toggle') {
		let style = document.getElementById(styleId);
		if (!style) {
			style = document.createElement('style');
			style.id = styleId;
			document.head.appendChild(style);
		}
		style.textContent = css;
	}
};

/**
 * Convert a config object to settings format
 * Detects type based on value and creates appropriate setting
 */
const configToSettings = (config, scriptName) => {
	const settings = {};
	
	for (const [key, value] of Object.entries(config)) {
		const setting = {
			title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
			desc: `Configure ${key}`,
			value: value,
			changed: (newValue) => {
				config[key] = newValue;
				strippedConsole.log(`[Water] ${scriptName} config.${key} = ${newValue}`);
			}
		};
		
		// Detect type based on value
		if (typeof value === 'boolean') {
			setting.type = 'bool';
		} else if (typeof value === 'number') {
			setting.type = 'num';
			// Set reasonable defaults based on value
			if (value >= 0 && value <= 1) {
				// Likely a percentage or volume
				setting.min = 0;
				setting.max = 1;
				setting.step = 0.01;
			} else if (value < 100) {
				setting.min = 0;
				setting.max = 500;
				setting.step = 1;
			} else {
				// Large numbers (like milliseconds)
				setting.min = 0;
				setting.max = value * 2;
				setting.step = 100;
			}
		} else if (typeof value === 'string') {
			// Check if it's a color
			if (value.match(/^#([0-9a-fA-F]{3}){2}$/)) {
				setting.type = 'color';
			} else {
				// For now, skip string configs (could add text input later)
				continue;
			}
		} else {
			// Skip complex types
			continue;
		}
		
		settings[key] = setting;
	}
	
	return settings;
};
/**
 * Parse userscript metadata from comment block
 */
const parseMetadata = (meta) => meta.split(/[\r\n]/u)
	.filter(line => /\S+/u.test(line)
		&& line.indexOf('==UserScript==') === -1
		&& line.indexOf('==/UserScript==') === -1)
	.reduce((obj, line) => {
		const arr = line.trim().replace(/^\/\//u, '')
			.trim()
			.split(/\s+/u);
		const key = arr[0].slice(1);
		const value = arr.slice(1).join(' ');

		if (!(key in obj)) obj[key] = value;
		else if (Array.isArray(obj[key])) obj[key].push(value);
		else obj[key] = [obj[key], value];

		return obj;
	}, {});

/** Userscript class */
class Userscript {
	constructor(props) {
		this.hasRan = false;
		this.strictMode = false;

		this.name = props.name;
		this.fullpath = props.fullpath;

		this.meta = false;
		this.unload = false;
		this.settings = {};

		this.runAt = 'document-end';
		this.priority = 0;

		this.content = readFileSync(this.fullpath, { encoding: 'utf-8' });
		if (this.content.startsWith('"use strict"')) this.strictMode = true;

		// Parse metadata if present
		if (this.content.includes('// ==UserScript==') && this.content.includes('// ==/UserScript==')) {
			let chunk = this.content.split('\n');
			chunk = (chunk.length === 1 ? [chunk] : chunk);
			const startLine = chunk.findIndex(line => line.includes('// ==UserScript=='));
			const endLine = chunk.findIndex(line => line.includes('// ==/UserScript=='));

			if (startLine !== -1 && endLine !== -1) {
				chunk = chunk.slice(startLine, endLine + 1).join('\n');
				this.meta = parseMetadata(chunk);

				// If metadata defines a prop twice, take the last value
				for (const metaKey of Object.keys(this.meta)) {
					const meta = this.meta[metaKey];
					if (Array.isArray(meta)) this.meta[metaKey] = meta[meta.length - 1];
				}

				// Parse @run-at
				if ('run-at' in this.meta && this.meta['run-at'] === 'document-start') {
					this.runAt = 'document-start';
				}

				// Parse @priority
				this.priority = 0;
				if ('priority' in this.meta && typeof this.meta['priority'] === "string") {
					try {
						this.priority = parseInt(this.meta['priority']);
					} catch (e) {
						strippedConsole.log("Error while parsing userscript priority: ", e);
						this.priority = 0;
					}
				}
			}
		}
	}

	/** Runs the userscript */
	load() {
		try {
			strippedConsole.log(`[Water] Attempting to execute '${this.name}'...`);
			
			// Execute script with proper context binding
			// eslint-disable-next-line no-new-func
			const exported = new Function(this.content).apply({
				unload: false,
				settings: {},
				_console: strippedConsole,
				_css: userscriptToggleCSS
			});

			strippedConsole.log(`[Water] '${this.name}' executed, exported:`, typeof exported, exported);

			// Userscript can return an object with unload and settings properties
			if (typeof exported !== 'undefined') {
				if ('unload' in exported) this.unload = exported.unload;
				if ('settings' in exported) {
					this.settings = exported.settings;
					strippedConsole.log(`[Water] '${this.name}' has ${Object.keys(this.settings).length} settings from return value`);
				}
			}
			
			// Try to detect and extract config object from script content
			// This supports scripts that define: const config = { ... }
			if (!this.settings || Object.keys(this.settings).length === 0) {
				try {
					const configMatch = this.content.match(/const\s+config\s*=\s*\{([^}]+)\}/s);
					if (configMatch) {
						// Extract config object
						const configStr = '{' + configMatch[1] + '}';
						// eslint-disable-next-line no-new-func
						const configObj = new Function('return ' + configStr)();
						
						// Convert config to settings
						this.settings = configToSettings(configObj, this.name);
						strippedConsole.log(`[Water] Auto-detected ${Object.keys(this.settings).length} config settings from ${this.name}`);
					}
				} catch (e) {
					// Config detection failed, that's okay
					strippedConsole.warn(`[Water] Failed to auto-detect config from ${this.name}:`, e);
				}
			}

			// Apply custom settings if they exist (stored in config)
			if (this.settings && Object.keys(this.settings).length > 0 && su.config) {
				try {
					const configKey = `userscript.${this.name.replace(/\.js$/, '')}`;
					const savedSettings = su.config.get(configKey, {});
					
					Object.keys(savedSettings).forEach(settingKey => {
						if (settingKey in this.settings
							&& typeof this.settings[settingKey].changed === 'function'
							&& savedSettings[settingKey] !== this.settings[settingKey].value
							&& typeof savedSettings[settingKey] === typeof this.settings[settingKey].value) {
							this.settings[settingKey].changed(savedSettings[settingKey]);
						}
					});
				} catch (err) {
					// Preferences for script are probably corrupted
					strippedConsole.error(`[Water] Failed to load settings for ${this.name}:`, err);
				}
			}

			strippedConsole.log(`%c[Water]${this.strictMode ? '%c[strict]' : '%c[non-strict]'} %cran %c'${this.name.toString()}' `,
				'color: lightblue; font-weight: bold;', this.strictMode ? 'color: #62dd4f' : 'color: orange',
				'color: white;', 'color: lightgreen;');
		} catch (error) {
			errAlert(error, this.name);
			strippedConsole.error(error);
		}
	}
}

/**
 * Initialize userscripts
 * @param {string} userscriptsPath - Path to userscripts directory
 * @param {object} config - Electron-store config instance
 */
function initializeUserscripts(userscriptsPath, config) {
	su.userscriptsPath = userscriptsPath;
	su.config = config;

	// Ensure directories exist
	const { mkdirSync } = require('fs');
	try {
		if (!existsSync(su.userscriptsPath)) {
			mkdirSync(su.userscriptsPath, { recursive: true });
			strippedConsole.log(`[Water] Created userscripts directory: ${su.userscriptsPath}`);
		}
	} catch (err) {
		strippedConsole.error('[Water] Failed to create userscript directories:', err);
		su.userscripts = [];
		return;
	}

	// Read all .js files from userscripts directory
	try {
		su.userscripts = readdirSync(su.userscriptsPath, { withFileTypes: true })
			.filter(entry => entry.name.endsWith('.js'))
			.map(entry => new Userscript({
				name: entry.name,
				fullpath: pathResolve(su.userscriptsPath, entry.name).toString()
			}));

		// Sort userscripts by priority (descending)
		su.userscripts = su.userscripts.sort((a, b) => b.priority - a.priority);
	} catch (err) {
		strippedConsole.error('[Water] Failed to read userscripts directory:', err);
		su.userscripts = [];
		return;
	}

	// Execute userscripts based on their run-at timing
	su.userscripts.forEach(u => {
		strippedConsole.log(`[Water] Processing script: ${u.name}, runAt: ${u.runAt}`);
		
		// Check if script is enabled (stored in electron-store)
		const isEnabled = config.get(`userscripts.${u.name}.enabled`, true);
		
		strippedConsole.log(`[Water] Script ${u.name} enabled:`, isEnabled);
		
		if (isEnabled) {
			if (u.runAt === 'document-start') {
				strippedConsole.log(`[Water] Running ${u.name} at document-start`);
				u.load();
				u.hasRan = true;
			} else {
				strippedConsole.log(`[Water] Scheduling ${u.name} for document-end`);
				// document-end: wait for DOMContentLoaded
				const callback = () => {
					strippedConsole.log(`[Water] DOMContentLoaded fired, running ${u.name}`);
					u.load();
					u.hasRan = true;
				};
				try { document.removeEventListener('DOMContentLoaded', callback); } catch (e) { }
				document.addEventListener('DOMContentLoaded', callback, { once: true });
			}
		} else {
			strippedConsole.log(`[Water] Skipping disabled script: ${u.name}`);
		}
	});
}

module.exports = {
	initializeUserscripts,
	su,
	strippedConsole,
	userscriptToggleCSS
};
