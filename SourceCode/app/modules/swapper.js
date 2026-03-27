"use strict";

let fs = require("fs");
let path = require("path");
const DEBUG_SWAP = false;

const ASSETS_PATH_PREFIXES = new Set(["models", "scares", "sound", "sounds", "textures", "videos"]);
const URL_FILTER_CACHE = new Map();

function buildNormalUrlFilters(swapDir) {
	const urls = new Set();

	const add = (u) => urls.add(u);
	const addHostPath = (host, p) => {
		add(`*://${host}${p}`);
		add(`*://${host}${p}?*`);
	};

	[
		"assets.krunker.io",
		"krunker.io",
		"comp.krunker.io"
	].forEach(host => {
		addHostPath(host, "/sound/*");
		addHostPath(host, "/sounds/*");
	});

	try {
		const entries = fs.readdirSync(swapDir, { withFileTypes: true });
		for (const entry of entries) {
			const name = String(entry.name || "");
			const key = name.toLowerCase();
			if (!name) continue;

			if (entry.isDirectory && entry.isDirectory()) {
				const isAssets = ASSETS_PATH_PREFIXES.has(key);
				const hosts = isAssets ? ["assets.krunker.io"] : ["krunker.io", "comp.krunker.io"];
				for (const host of hosts) addHostPath(host, `/${name}/*`);
				if (key === "sound") {
					for (const host of hosts) addHostPath(host, `/sounds/*`);
				}
			}
			else if (entry.isFile && entry.isFile()) {
				addHostPath("krunker.io", `/${name}`);
				addHostPath("comp.krunker.io", `/${name}`);
			}
		}
	}
	catch (_) { }

	return Array.from(urls);
}

function buildAdvancedUrlFilters(swapDir) {
	const urls = new Set();

	const add = (u) => urls.add(u);
	const addHostPath = (host, p) => {
		add(`*://${host}${p}`);
		add(`*://${host}${p}?*`);
	};

	addHostPath("*", "/sound/*");
	addHostPath("*", "/sounds/*");

	try {
		const hostEntries = fs.readdirSync(swapDir, { withFileTypes: true });
		for (const hostDirent of hostEntries) {
			if (!(hostDirent.isDirectory && hostDirent.isDirectory())) continue;
			const hostname = String(hostDirent.name || "");
			if (!hostname) continue;

			addHostPath(hostname, "/sound/*");
			addHostPath(hostname, "/sounds/*");

			try {
				const root = path.join(swapDir, hostname);
				const entries = fs.readdirSync(root, { withFileTypes: true });
				for (const entry of entries) {
					const name = String(entry.name || "");
					if (!name) continue;
					if (entry.isDirectory && entry.isDirectory()) {
						addHostPath(hostname, `/${name}/*`);
						if (name.toLowerCase() === "sound") addHostPath(hostname, `/sounds/*`);
					}
					else if (entry.isFile && entry.isFile()) {
						addHostPath(hostname, `/${name}`);
					}
				}
			}
			catch (_) {
				addHostPath(hostname, "/*");
			}
		}
	}
	catch (_) { }

	return Array.from(urls);
}

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
		const session = this.win && this.win.webContents && this.win.webContents.session;
		if (!session || !session.webRequest) return;
		if (session.__waterSwapperRegistered) return;
		session.__waterSwapperRegistered = true;

		const cacheKey = `${this.swapperMode}|${this.swapDir}`;
		let cachedUrls = URL_FILTER_CACHE.get(cacheKey);
		if (!cachedUrls) {
			cachedUrls = (this.swapperMode === "advanced")
				? buildAdvancedUrlFilters(this.swapDir)
				: buildNormalUrlFilters(this.swapDir);
			URL_FILTER_CACHE.set(cacheKey, cachedUrls);
		}
		this.urls = cachedUrls.slice();
		const redirectCache = new Map();
		const MAX_REDIRECT_CACHE_SIZE = 1000;

		// Helper to add to cache with size limit
		const addToCache = (key, value) => {
			if (redirectCache.size >= MAX_REDIRECT_CACHE_SIZE) {
				const firstKey = redirectCache.keys().next().value;
				redirectCache.delete(firstKey);
			}
			redirectCache.set(key, value);
		};

		switch (this.swapperMode) {
			case "normal": {
				this.urls.length && session.webRequest.onBeforeRequest({ urls: this.urls }, (details, callback) => {
					let urlObj = new URL(details.url);
					let pathname = urlObj.pathname;
					const cacheKey = `${urlObj.hostname}|${pathname}`;
					const cachedRedirect = redirectCache.get(cacheKey);
					if (cachedRedirect) return callback({ redirectURL: cachedRedirect });
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
							const redirectURL = "Water-Swap:///" + encodeURI(localPath.replace(/\\/g, "/"));
							addToCache(cacheKey, redirectURL);
							return callback({ redirectURL });
						}
						// Handle '/sounds/' by mapping to local '/sound/' folder
						if (/^\/sounds\//.test(pathname)) {
							let mappedRel = relPath.replace(/^sounds\//, "sound/");
							let mappedLocal = path.join(this.swapDir, mappedRel);
							const hitMapped = fs.existsSync(mappedLocal);
							DEBUG_SWAP && console.log(`[Swapper:normal] map sounds->sound rel=${mappedRel} local=${mappedLocal} exists=${hitMapped}`);
							if (hitMapped) {
								DEBUG_SWAP && console.log(`[Swapper:normal] HIT mapped ${mappedLocal}`);
								const redirectURL = "Water-Swap:///" + encodeURI(mappedLocal.replace(/\\/g, "/"));
								addToCache(cacheKey, redirectURL);
								return callback({ redirectURL });
							}
							// Extension fallback on mapped local
							let parsedM = path.parse(mappedLocal);
							let extM = (parsedM.ext || "").toLowerCase();
							let altM = extM === ".ogg" ? ".mp3" : (extM === ".mp3" ? ".ogg" : "");
							if (altM) {
								let altMapped = path.join(parsedM.dir, parsedM.name + altM);
								const hitAltMapped = fs.existsSync(altMapped);
								DEBUG_SWAP && console.log(`[Swapper:normal] ALT mapped=${altMapped} exists=${hitAltMapped}`);
								if (hitAltMapped) {
									const redirectURL = "Water-Swap:///" + encodeURI(altMapped.replace(/\\/g, "/"));
									addToCache(cacheKey, redirectURL);
									return callback({ redirectURL });
								}
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
								if (hitAlt) {
									const redirectURL = "Water-Swap:///" + encodeURI(altPath.replace(/\\/g, "/"));
									addToCache(cacheKey, redirectURL);
									return callback({ redirectURL });
								}
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
				this.urls.length && session.webRequest.onBeforeRequest({ urls: this.urls }, (details, callback) => {
					let urlObj = new URL(details.url);
					let { hostname, pathname } = urlObj;
					const cacheKey = `${hostname}|${pathname}`;
					const cachedRedirect = redirectCache.get(cacheKey);
					if (cachedRedirect) return callback({ redirectURL: cachedRedirect });
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
							const redirectURL = "Water-Swap:///" + encodeURI(localPath.replace(/\\/g, "/"));
							addToCache(cacheKey, redirectURL);
							return callback({ redirectURL });
						}
						// Handle '/sounds/' by mapping to local '/sound/' folder (advanced mode)
						if (/^\/sounds\//.test(pathname)) {
							let mappedRel = relPath.replace(/^sounds\//, "sound/");
							let mappedLocal = path.join(this.swapDir, hostname, mappedRel);
							const hitMapped = fs.existsSync(mappedLocal);
							DEBUG_SWAP && console.log(`[Swapper:adv] map sounds->sound rel=${mappedRel} local=${mappedLocal} exists=${hitMapped}`);
							if (hitMapped) {
								const redirectURL = "Water-Swap:///" + encodeURI(mappedLocal.replace(/\\/g, "/"));
								addToCache(cacheKey, redirectURL);
								return callback({ redirectURL });
							}
							// Extension fallback on mapped local
							let parsedM = path.parse(mappedLocal);
							let extM = (parsedM.ext || "").toLowerCase();
							let altM = extM === ".ogg" ? ".mp3" : (extM === ".mp3" ? ".ogg" : "");
							if (altM) {
								let altMapped = path.join(parsedM.dir, parsedM.name + altM);
								const hitAltMapped = fs.existsSync(altMapped);
								DEBUG_SWAP && console.log(`[Swapper:adv] ALT mapped=${altMapped} exists=${hitAltMapped}`);
								if (hitAltMapped) {
									const redirectURL = "Water-Swap:///" + encodeURI(altMapped.replace(/\\/g, "/"));
									addToCache(cacheKey, redirectURL);
									return callback({ redirectURL });
								}
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
								if (hitAlt) {
									const redirectURL = "Water-Swap:///" + encodeURI(altPath.replace(/\\/g, "/"));
									addToCache(cacheKey, redirectURL);
									return callback({ redirectURL });
								}
							}
						}
						// Final fallback: check global (normal-mode) sound path if host-scoped file not present
						if (/\/sounds?\//.test(pathname)) {
							let normalRel = relPath.replace(/^sounds\//, "sound/");
							let normalLocal = path.join(this.swapDir, normalRel);
							const hitNormal = fs.existsSync(normalLocal);
							DEBUG_SWAP && console.log(`[Swapper:adv] normal fallback rel=${normalRel} local=${normalLocal} exists=${hitNormal}`);
							if (hitNormal) {
								const redirectURL = "Water-Swap:///" + encodeURI(normalLocal.replace(/\\/g, "/"));
								addToCache(cacheKey, redirectURL);
								return callback({ redirectURL });
							}
							let parsedN = path.parse(normalLocal);
							let extN = (parsedN.ext || "").toLowerCase();
							let altN = extN === ".ogg" ? ".mp3" : (extN === ".mp3" ? ".ogg" : "");
							if (altN) {
								let altNormal = path.join(parsedN.dir, parsedN.name + altN);
								const hitAltNormal = fs.existsSync(altNormal);
								DEBUG_SWAP && console.log(`[Swapper:adv] ALT normal=${altNormal} exists=${hitAltNormal}`);
								if (hitAltNormal) {
									const redirectURL = "Water-Swap:///" + encodeURI(altNormal.replace(/\\/g, "/"));
									addToCache(cacheKey, redirectURL);
									return callback({ redirectURL });
								}
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
