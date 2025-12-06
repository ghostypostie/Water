"use strict";

let fs = require("fs");
let path = require("path");
const DEBUG_SWAP = false;

/**
 * Swapping Handler
 *
 * @class Swapper
 */
class Swapper {
	/**
	 * Creates an instance of Swapper.
	 *
	 * @param {import("electron").BrowserWindow} win
	 * @param {string} swapperMode
	 * @param {string} swapDir
	 * @param {Object} [options={}]
	 * @memberof Swapper
	 */
	constructor(win, swapperMode, swapDir, options = {}) {
		this.win = win;
		this.swapperMode = swapperMode;
		this.swapDir = swapDir;
		this.urls = [];
		/**
		 * Ignore swapping for specific assets. By default, we ignore headshot_0.* so
		 * that removing legacy folders doesn't unexpectedly keep overrides active.
		 */
		this.ignoreHeadshot = options.ignoreHeadshot !== false;
	}

	/**
	 * Normal Swapper
	 *
	 * @private
	 * @param {import("electron").BrowserWindow} win
	 * @param {string} [prefix=""]
	 * @memberof Swapper
	 */
	#recursiveSwapNormal = (win, prefix = "") => {
		try {
			// Sanitize prefix for filesystem usage (no leading slash)
			const fsPrefix = String(prefix).replace(/^[/\\]+/, "");
			fs.readdirSync(path.join(this.swapDir, fsPrefix), { withFileTypes: true }).forEach(dirent => {
				if (dirent.isDirectory()) {
					// Build next prefix as a relative path (no leading slash)
					const nextPrefix = prefix ? `${prefix}/${dirent.name}` : dirent.name;
					this.#recursiveSwapNormal(win, nextPrefix);
				}
				else {
					// URL pathname should have leading slash, filesystem prefix is handled separately above
					const urlBase = prefix ? `/${prefix}` : "";
					let pathname = `${urlBase}/${dirent.name}`;
					// For sound files, also register the alternate extension (.ogg <-> .mp3) so we can fallback
					let pathnamesToRegister = [pathname];
					if (/^\/sound\//.test(pathname)) {
						let m = dirent.name.match(/^(.*)\.(ogg|mp3)$/i);
						if (m) {
							let base = m[1];
							let alt = m[2].toLowerCase() === "ogg" ? "mp3" : "ogg";
							pathnamesToRegister.push(`${urlBase}/${base}.${alt}`);
						}
					}
					for (const pn of pathnamesToRegister) {
						this.urls.push(
							...(/^\/(?:models|scares|sound|sounds|textures|videos)\//.test(pn)
								? [
									`*://assets.krunker.io${pn}`,
									`*://assets.krunker.io${pn}?*`
								] : [
									`*://krunker.io${pn}`,
									`*://krunker.io${pn}?*`,
									`*://comp.krunker.io${pn}`,
									`*://comp.krunker.io${pn}?*`
								]
							)
						);
						// Also register '/sounds/' variant if we built '/sound/'
						if (/^\/sound\//.test(pn)) {
							const pnAlt = pn.replace(/^\/sound\//, "/sounds/");
							this.urls.push(
								...(["/models/", "/scares/", "/sound/", "/sounds/", "/textures/", "/videos/"].some(p => pnAlt.startsWith(p))
									? [
										`*://assets.krunker.io${pnAlt}`,
										`*://assets.krunker.io${pnAlt}?*`
									] : [
										`*://krunker.io${pnAlt}`,
										`*://krunker.io${pnAlt}?*`,
										`*://comp.krunker.io${pnAlt}`,
										`*://comp.krunker.io${pnAlt}?*`
									]
								)
							);
						}
					}
				}
			});
		}
		catch (err) {
			console.error("Failed to swap resources in normal mode", err, prefix);
		}
	};

	/**
	 * Advanced Swapper
	 *
	 * @private
	 * @param {import("electron").BrowserWindow} win
	 * @param {string} [prefix=""]
	 * @param {string} [hostname=""]
	 * @memberof Swapper
	 */
	#recursiveSwapHostname = (win, prefix = "", hostname = "") => {
		try {
			fs.readdirSync(path.join(this.swapDir, prefix), { withFileTypes: true }).forEach(dirent => {
				if (dirent.isDirectory()) {
					this.#recursiveSwapHostname(
						win,
						hostname ? `${prefix}/${dirent.name}` : prefix + dirent.name,
						hostname || dirent.name
					);
				}
				else if (hostname) {
					// For sound files, also register the alternate extension (.ogg <-> .mp3) so we can fallback
					let names = [dirent.name];
					if (/^\/sound(?:\/|$)/.test(prefix)) {
						let m = dirent.name.match(/^(.*)\.(ogg|mp3)$/i);
						if (m) {
							let base = m[1];
							let alt = m[2].toLowerCase() === "ogg" ? "mp3" : "ogg";
							names.push(`${base}.${alt}`);
						}
					}
					for (const n of names) this.urls.push(`*://${prefix}/${n}`, `*://${prefix}/${n}?*`);
				}
			});
		}
		catch (err) {
			console.error("Failed to swap resources in advanced mode", err, prefix, hostname);
		}
	};

	/**
	 * Initialize the Swapping process
	 *
	 * @memberof Swapper
	 */
	init() {
		switch (this.swapperMode) {
			case "normal": {
				this.#recursiveSwapNormal(this.win);
				// Ensure we intercept all sound requests even if the specific file wasn't pre-scanned
				this.urls.push(
					"*://assets.krunker.io/sound/*", "*://assets.krunker.io/sound/*?*",
					"*://assets.krunker.io/sounds/*", "*://assets.krunker.io/sounds/*?*",
					"*://krunker.io/sound/*", "*://krunker.io/sound/*?*",
					"*://krunker.io/sounds/*", "*://krunker.io/sounds/*?*",
					"*://comp.krunker.io/sound/*", "*://comp.krunker.io/sound/*?*",
					"*://comp.krunker.io/sounds/*", "*://comp.krunker.io/sounds/*?*"
				);
				this.urls.length && this.win.webContents.session.webRequest.onBeforeRequest({ urls: this.urls }, (details, callback) => {
					let pathname = new URL(details.url).pathname;
					// Sanitize to relative path for Windows-safe join
					let relPath = String(pathname).replace(/^[/\\]+/, "");
					// Normalize sounds -> sound for matching
					let normRel = relPath.replace(/^sounds\//, "sound/");
					// If ignoring headshot overrides, allow request to continue
					if (this.ignoreHeadshot && /^sound\/headshot_0\.(?:mp3|ogg)$/i.test(normRel)) {
						return callback({ cancel: false });
					}
					let localPath = path.join(this.swapDir, relPath);
					try {
						const hitLocal = fs.existsSync(localPath);
						DEBUG_SWAP && console.log(`[Swapper:normal] url=${details.url} rel=${relPath} local=${localPath} exists=${hitLocal}`);
						if (hitLocal) {
							DEBUG_SWAP && console.log(`[Swapper:normal] HIT ${localPath}`);
							return callback({ redirectURL: "Water-Swap:///" + encodeURI(localPath.replace(/\\/g, "/")) });
						}
						// Handle '/sounds/' by mapping to local '/sound/' folder
						if (/^\/sounds\//.test(pathname)) {
							let mappedRel = relPath.replace(/^sounds\//, "sound/");
							let mappedLocal = path.join(this.swapDir, mappedRel);
							const hitMapped = fs.existsSync(mappedLocal);
							DEBUG_SWAP && console.log(`[Swapper:normal] map sounds->sound rel=${mappedRel} local=${mappedLocal} exists=${hitMapped}`);
							if (hitMapped) {
								DEBUG_SWAP && console.log(`[Swapper:normal] HIT mapped ${mappedLocal}`);
								return callback({ redirectURL: "Water-Swap:///" + encodeURI(mappedLocal.replace(/\\/g, "/")) });
							}
							// Extension fallback on mapped local
							let parsedM = path.parse(mappedLocal);
							let extM = (parsedM.ext || "").toLowerCase();
							let altM = extM === ".ogg" ? ".mp3" : (extM === ".mp3" ? ".ogg" : "");
							if (altM) {
								let altMapped = path.join(parsedM.dir, parsedM.name + altM);
								const hitAltMapped = fs.existsSync(altMapped);
								DEBUG_SWAP && console.log(`[Swapper:normal] ALT mapped=${altMapped} exists=${hitAltMapped}`);
								if (hitAltMapped) return callback({ redirectURL: "Water-Swap:///" + encodeURI(altMapped.replace(/\\/g, "/")) });
							}
						}
						// Extension fallback for '/sound/' requests
						if (/^\/sound\//.test(pathname)) {
							let parsed = path.parse(localPath);
							let ext = (parsed.ext || "").toLowerCase();
							let alt = ext === ".ogg" ? ".mp3" : (ext === ".mp3" ? ".ogg" : "");
							if (alt) {
								let altPath = path.join(parsed.dir, parsed.name + alt);
								const hitAlt = fs.existsSync(altPath);
								DEBUG_SWAP && console.log(`[Swapper:normal] ALT local=${altPath} exists=${hitAlt}`);
								if (hitAlt) return callback({ redirectURL: "Water-Swap:///" + encodeURI(altPath.replace(/\\/g, "/")) });
							}
						}
					}
					catch (_) { /* noop */ }
					// No local file found; allow the request to continue normally
					return callback({ cancel: false });
				});
				break;
			}
			case "advanced": {
				this.#recursiveSwapHostname(this.win);
				// Ensure we intercept all sound requests in advanced mode too
				this.urls.push(
					"*://*/sound/*", "*://*/sound/*?*",
					"*://*/sounds/*", "*://*/sounds/*?*"
				);
				this.urls.length && this.win.webContents.session.webRequest.onBeforeRequest({ urls: this.urls }, (details, callback) => {
					let { hostname, pathname } = new URL(details.url);
					// Sanitize to relative path for Windows-safe join
					let relPath = String(pathname).replace(/^[/\\]+/, "");
					// Normalize sounds -> sound for matching
					let normRel = relPath.replace(/^sounds\//, "sound/");
					if (this.ignoreHeadshot && /^sound\/headshot_0\.(?:mp3|ogg)$/i.test(normRel)) {
						return callback({ cancel: false });
					}
					let localPath = path.join(this.swapDir, hostname, relPath);
					try {
						const hitLocal = fs.existsSync(localPath);
						DEBUG_SWAP && console.log(`[Swapper:adv] url=${details.url} host=${hostname} rel=${relPath} local=${localPath} exists=${hitLocal}`);
						if (hitLocal) {
							DEBUG_SWAP && console.log(`[Swapper:adv] HIT ${localPath}`);
							return callback({ redirectURL: "Water-Swap:///" + encodeURI(localPath.replace(/\\/g, "/")) });
						}
						// Handle '/sounds/' by mapping to local '/sound/' folder (advanced mode)
						if (/^\/sounds\//.test(pathname)) {
							let mappedRel = relPath.replace(/^sounds\//, "sound/");
							let mappedLocal = path.join(this.swapDir, hostname, mappedRel);
							const hitMapped = fs.existsSync(mappedLocal);
							DEBUG_SWAP && console.log(`[Swapper:adv] map sounds->sound rel=${mappedRel} local=${mappedLocal} exists=${hitMapped}`);
							if (hitMapped) return callback({ redirectURL: "Water-Swap:///" + encodeURI(mappedLocal.replace(/\\/g, "/")) });
							// Extension fallback on mapped local
							let parsedM = path.parse(mappedLocal);
							let extM = (parsedM.ext || "").toLowerCase();
							let altM = extM === ".ogg" ? ".mp3" : (extM === ".mp3" ? ".ogg" : "");
							if (altM) {
								let altMapped = path.join(parsedM.dir, parsedM.name + altM);
								const hitAltMapped = fs.existsSync(altMapped);
								DEBUG_SWAP && console.log(`[Swapper:adv] ALT mapped=${altMapped} exists=${hitAltMapped}`);
								if (hitAltMapped) return callback({ redirectURL: "Water-Swap:///" + encodeURI(altMapped.replace(/\\/g, "/")) });
							}
						}
						// Try extension fallback for '/sound/' requests
						if (/\/sound\//.test(pathname)) {
							let parsed = path.parse(localPath);
							let ext = (parsed.ext || "").toLowerCase();
							let alt = ext === ".ogg" ? ".mp3" : (ext === ".mp3" ? ".ogg" : "");
							if (alt) {
								let altPath = path.join(parsed.dir, parsed.name + alt);
								const hitAlt = fs.existsSync(altPath);
								DEBUG_SWAP && console.log(`[Swapper:adv] ALT local=${altPath} exists=${hitAlt}`);
								if (hitAlt) return callback({ redirectURL: "Water-Swap:///" + encodeURI(altPath.replace(/\\/g, "/")) });
							}
						}
						// Final fallback: check global (normal-mode) sound path if host-scoped file not present
						if (/\/sounds?\//.test(pathname)) {
							let normalRel = relPath.replace(/^sounds\//, "sound/");
							let normalLocal = path.join(this.swapDir, normalRel);
							const hitNormal = fs.existsSync(normalLocal);
							DEBUG_SWAP && console.log(`[Swapper:adv] normal fallback rel=${normalRel} local=${normalLocal} exists=${hitNormal}`);
							if (hitNormal) return callback({ redirectURL: "Water-Swap:///" + encodeURI(normalLocal.replace(/\\/g, "/")) });
							let parsedN = path.parse(normalLocal);
							let extN = (parsedN.ext || "").toLowerCase();
							let altN = extN === ".ogg" ? ".mp3" : (extN === ".mp3" ? ".ogg" : "");
							if (altN) {
								let altNormal = path.join(parsedN.dir, parsedN.name + altN);
								const hitAltNormal = fs.existsSync(altNormal);
								DEBUG_SWAP && console.log(`[Swapper:adv] ALT normal=${altNormal} exists=${hitAltNormal}`);
								if (hitAltNormal) return callback({ redirectURL: "Water-Swap:///" + encodeURI(altNormal.replace(/\\/g, "/")) });
							}
						}
					}
					catch (_) { /* noop */ }
					// No local file found; allow the request to continue normally
					return callback({ cancel: false });
				});
				break;
			}
			default: return;
		}
	}
}

module.exports = Swapper;
