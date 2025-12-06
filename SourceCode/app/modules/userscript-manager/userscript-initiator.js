"use strict";

/* eslint-disable no-new-func */

let fs = require("fs");
let path = require("path");

let PathUtils = require("../../utils/path-utils");
let ScriptExecutor10 = require("./userscript-executors/1_0/1-0-script-executor");
let OldScriptExecutor = require("./userscript-executors/old/old-script-executor");
let RawScriptExecutor = require("./userscript-executors/raw/raw-script-executor");

/**
 * @typedef {import("./userscript-executors/script-executor.interface")} IScriptExecutor
 */

/**
 * Initiate and inject usescripts
 *
 * @class UserscriptInitiator
 */
class UserscriptInitiator {
	/**
	 * Creates an instance of UserscriptInitiator.
	 *
	 * @param {import("electron-store")} config
	 * @param {string} dest
	 * @param {object} clientUtils
	 * @memberof UserscriptInitiator
	 */
	constructor(config, dest, clientUtils) {
		/** @type {string} */
		this.scriptsPath = PathUtils.isValidPath(dest) ? dest : "";
		this.clientUtils = clientUtils;
		this.config = config;

		/** @type {IScriptExecutor[]} */
		this.scripts = [];
	}

	/**
	 * Executes all loaded scripts
	 * @returns {Promise<Boolean>[]}
	 */
	executeScripts() {
		return this.scripts.map(script => script.executeScript());
	}

	/**
	 * Loads all scripts
	 *
	 * @public
	 * @param {string} windowType
	 * @returns {Promise<void>}
	 * @memberof UserscriptInitiator
	 */
	async loadScripts(windowType) {
		await Promise.all(
			(await fs.promises.readdir(this.scriptsPath)).filter(filename => path.extname(filename).toLowerCase() === ".js")
				.map(filename => {
					try {
						// Check if script is enabled (Default: enabled if not set)
						const scriptId = filename.replace('.js', '');
						const savedState = localStorage.getItem(`water-script-${scriptId}`);
						const isEnabled = savedState === null ? true : savedState === 'true';

						if (!isEnabled) {
							console.log(`[Water] Skipping disabled script: ${filename}`);
							return null;
						}

						let data = fs.readFileSync(path.join(this.scriptsPath, filename));

						// Try 1.0 Format
						let executor10 = new ScriptExecutor10(data, this.clientUtils, windowType, this.config);
						if (executor10.isValidScript()) {
							this.#addScript(executor10);
							return executor10.preloadScript();
						}

						// Try Old Format
						let executorOld = new OldScriptExecutor(data, this.clientUtils, windowType, this.config);
						if (executorOld.isValidScript()) {
							this.#addScript(executorOld);
							return executorOld.preloadScript();
						}

						// Try Raw/Tampermonkey Format (fallback for any JS)
						let executorRaw = new RawScriptExecutor(data, this.clientUtils, windowType, this.config);
						if (executorRaw.isValidScript()) {
							this.#addScript(executorRaw);
							return executorRaw.preloadScript();
						}
					}
					catch (err) {
						console.error(`[Water] Failed to load script-file [${filename}]`);
						console.error(err);
					}

					console.error(`[Water] No valid Userscript executor found for file [${filename}]`);
					return null;
				})
		);
	}

	/**
	 * Adds a script to the scriptlist
	 *
	 * @param {IScriptExecutor} script
	 */
	#addScript = (script) => {
		this.scripts.push(script);
	};

	/**
	 * Removes a script from the script list
	 *
	 * @param {IScriptExecutor} script
	 */
	#removeScript = (script) => {
		this.scripts.splice(this.scripts.indexOf(script), 1);
	};
}

module.exports = UserscriptInitiator;
