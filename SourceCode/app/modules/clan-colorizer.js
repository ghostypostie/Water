"use strict";

const tagConfig = require("../exports/clan-tags");

const SELECTORS = [
	".leaderNameM span", ".leaderNameF span", ".leaderName span",
	".newLeaderNameM span", ".newLeaderNameF span", ".newLeaderName span",
	".pListName span", ".endTableN span",
	".playerName span", ".scoreNameItem span",
	".killCardName span", ".spectatorName span",
	"[class*='Name'] span", "[class*='name'] span"
].join(", ");

function normalizeTag(tag) {
	return String(tag || "").replace(/^\[|\]$/g, "").trim().toUpperCase();
}

const TAG_COLORS = Object.create(null);
for (const [rawTag, color] of Object.entries(tagConfig || {})) {
	const key = normalizeTag(rawTag);
	if (key) TAG_COLORS[key] = color;
}

function colorForText(text) {
	const key = normalizeTag(text);
	return key && TAG_COLORS[key] ? TAG_COLORS[key] : null;
}

// Apply color to a single span element
function colorElement(el) {
	const txt = (el.textContent || "").trim();
	if (!txt) return;
	const color = colorForText(txt);
	if (!color) return;
	// Always force-apply - Krunker may have reset the style
	el.style.setProperty("color", color, "important");
	el.dataset.clanColorized = color;
}

function applyColors(root = document) {
	try {
		root.querySelectorAll(SELECTORS).forEach(colorElement);
	} catch (err) {
		console.log("[ClanColorizer] applyColors error:", err);
	}
}

let observer = null;
let isInitialized = false;

function init() {
	if (isInitialized) return;
	isInitialized = true;
	console.log("[ClanColorizer] Initializing with tags:", Object.keys(TAG_COLORS));

	applyColors();

	try {
		observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.addedNodes) {
						if (node.nodeType !== 1) continue;
						const el = /** @type {Element} */ (node);
						// If the added node itself matches or contains matches, color immediately
						if (el.matches && el.matches(SELECTORS)) {
							colorElement(el);
						} else if (el.querySelector) {
							el.querySelectorAll(SELECTORS).forEach(colorElement);
						}
					}
				} else if (mutation.type === 'characterData') {
					// Text changed inside a span - re-color the parent span
					const parent = mutation.target.parentElement;
					if (parent && parent.matches && parent.matches(SELECTORS)) {
						colorElement(parent);
					}
				}
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true
		});

		window.addEventListener("unload", cleanup);
		console.log("[ClanColorizer] Initialized");
	} catch (err) {
		console.log("[ClanColorizer] init error:", err);
	}
}

function cleanup() {
	if (observer) { observer.disconnect(); observer = null; }
	isInitialized = false;
}

module.exports = { init, cleanup };
