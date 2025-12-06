"use strict";

// Clan Colorizer: applies configured colors to clan tags in the Krunker UI

const tagConfig = require("../exports/clan-tags");

// Selectors covering leaderboard and player list name tag spans
const SELECTORS = 
	".leaderNameM span, .leaderName span, .newLeaderNameM span, .newLeaderName span, .pListName span, .endTableN span";

function normalizeTag(tag) {
	return String(tag || "")
		.replace(/^\[|\]$/g, "") // strip surrounding brackets if present
		.trim()
		.toUpperCase();
}

// Build a normalized tag->color map (case-insensitive keys)
const TAG_COLORS = Object.create(null);
for (const [rawTag, color] of Object.entries(tagConfig || {})) {
	const key = normalizeTag(rawTag);
	if (key) TAG_COLORS[key] = color;
}

function colorForText(text) {
	const key = normalizeTag(text);
	return key && TAG_COLORS[key] ? TAG_COLORS[key] : null;
}

function applyColors(root = document) {
	try {
		const nodes = root.querySelectorAll(SELECTORS);
		nodes.forEach(el => {
			const txt = (el.textContent || "").trim();
			if (!txt) return;
			const color = colorForText(txt);
			if (color) el.style.setProperty("color", color, "important");
		});
	}
	catch (err) {
		console.log("[ClanColorizer] applyColors error:", err);
	}
}

let observer = null;
let scheduled = false;
function scheduleApply() {
	if (scheduled) return;
	scheduled = true;
	requestAnimationFrame(() => {
		scheduled = false;
		applyColors();
	});
}

function init() {
	// Run once immediately
	applyColors();

	// Observe DOM changes since leaderboard / player list updates frequently
	try {
		if (observer) observer.disconnect();
		observer = new MutationObserver(scheduleApply);
		observer.observe(document.body, { childList: true, subtree: true, characterData: true });
		window.addEventListener("unload", () => {
			try { observer && observer.disconnect(); } catch (_) { /* noop */ }
		});
	}
	catch (err) {
		console.log("[ClanColorizer] init error:", err);
	}
}

module.exports = { init };
