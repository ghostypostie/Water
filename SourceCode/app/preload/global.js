"use strict";

require("v8-compile-cache");

let Events = require("events");
let { ipcRenderer, remote } = require("electron");
let Store = require("electron-store");
let log = require("electron-log");

let UrlUtils = require("../utils/url-utils");
let UserscriptInitiator = require("../modules/userscript-manager/userscript-initiator");
let UtilManager = require("../modules/util-manager");

// Fix electron-store for Electron 10 — remote may not be available
let config;
try {
	config = new Store({ cwd: remote && remote.app ? remote.app.getPath('userData') : undefined });
} catch (e) {
	console.warn('[Water] Failed to init Store with remote, using default path:', e.message);
	config = new Store();
}

Object.assign(console, log.functions);
localStorage.setItem("logs", "true");

window.prompt = (message, defaultValue) => ipcRenderer.sendSync("prompt", message, defaultValue);

let windowType = UrlUtils.locationType(location.href);

UtilManager.instance.clientUtils = {
	events: new Events(),
	settings: require("../exports/settings"),
	setCSetting(name, value) {
		let entry = Object.values(this.settings).find(_entry => _entry.id === name);
		let newValue = entry.min && entry.max ? Math.max(entry.min, Math.min(value, entry.max)) : value;

		config.set(name, newValue);
		entry.val = newValue;
		if (entry.set) entry.set(newValue);

		/** @type {HTMLInputElement} */
		let element = (document.getElementById("c_slid_" + entry.id));
		if (element) element.value = newValue;

		/** @type {HTMLInputElement} */
		element = (document.getElementById("c_slid_input_" + entry.id));
		if (element) element.value = newValue;
	},
	delayIDs: {},
	delaySetCSetting(name, target, delay = 600) {
		if (this.delayIDs[name]) clearTimeout(this.delayIDs[name]);
		this.delayIDs[name] = setTimeout(() => {
			this.setCSetting(name, target.value);
			delete this.delayIDs[name];
		}, delay);
	},
	initUtil() {
		for (let [key, entry] of Object.entries(this.settings)) {
			if (!("name" in entry && "id" in entry && "cat" in entry && "type" in entry && "val" in entry && "html" in entry)) {
				console.log(`Ignored a setting entry ${entry.id ? `"${entry.id}"` : "with no ID"}, missing a required property`);
				delete this.settings[key];
				continue;
			}
			if (entry.platforms && !entry.platforms.includes(process.platform)) {
				delete this.settings[key];
				continue;
			}
			if (entry.dontInit) continue;

			let savedVal = config.get(entry.id, null);

			if (savedVal !== null) entry.val = savedVal;
			if (entry.min && entry.max) entry.val = Math.max(entry.min, Math.min(entry.val, entry.max));
			if (entry.set) entry.set(entry.val, true);
		}
	}
};

switch (windowType) {
	case "game": {
		// @ts-ignore
		process.dlopen = () => {
			throw new Error("Load native module is not safe");
		};
		// let worker = new Worker("./game.js");
		// worker.addEventListener("error", console.log);
		require("./game.js");
		break;
	}
	default: () => { };
}

ipcRenderer.invoke("get-app-info")
	.then(info => {
		const initalize = async () => {
			UtilManager.instance.clientUtils.initUtil();
			
			// Note: Userscripts are now initialized in game.js
			// This ensures they run in the proper renderer context with correct timing
		};

		(windowType === "game")
			? UtilManager.instance.clientUtils.events.on("game-load", () => initalize())
			: initalize();
	});
