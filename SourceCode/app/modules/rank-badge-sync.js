"use strict";

// Rank Badge Sync
// Copies .newLeaderRanked img badges from #centerLeaderDisplay into #leaderboardHolder rows.
// Badges are NEVER removed once injected - only src is updated if rank changes.
// MutationObserver on both containers ensures immediate re-injection on any DOM rebuild.

const rankCache = new Map(); // normalized name -> img src (null = unranked)

// Extract plain text name from a name element (ignores child spans like clan tags)
function getPlayerName(nameEl) {
	if (!nameEl) return "";
	let name = "";
	nameEl.childNodes.forEach(node => {
		if (node.nodeType === Node.TEXT_NODE) name += node.textContent;
	});
	return name.trim().toLowerCase();
}

// Rebuild the entire rank cache from center leaderboard
function updateRankCache() {
	try {
		const center = document.getElementById("centerLeaderDisplay");
		if (!center) return;
		center.querySelectorAll(".newLeaderItem").forEach(item => {
			const nameEl = item.querySelector(".newLeaderNameM, .newLeaderNameF, .newLeaderName");
			if (!nameEl) return;
			const name = getPlayerName(nameEl);
			if (!name) return;
			const rankImg = item.querySelector(".newLeaderRanked img");
			// Store src or null (unranked). Only update if we have new info.
			const src = rankImg ? rankImg.src : null;
			rankCache.set(name, src);
		});
	} catch (err) {
		console.log("[RankBadgeSync] updateRankCache error:", err);
	}
}

// Inject or update badge in a single .leaderItem - NEVER removes existing badge
function injectBadgeIntoItem(item) {
	try {
		// Both local player (.leaderNameM), friends (.leaderNameF), and others (.leaderName)
		const nameEl = item.querySelector(".leaderNameM, .leaderNameF, .leaderName");
		if (!nameEl) return;
		const name = getPlayerName(nameEl);
		if (!name) return;

		if (!rankCache.has(name)) return; // not seen in center leaderboard yet
		const rankSrc = rankCache.get(name);
		if (!rankSrc) return; // player is unranked

		const existing = item.querySelector(".waterLeaderRanked img");
		if (existing) {
			// Already has badge - just update src if changed
			if (existing.src !== rankSrc) existing.src = rankSrc;
			return;
		}

		// Insert new badge before the name element
		const badge = document.createElement("div");
		badge.className = "waterLeaderRanked";
		badge.style.cssText = "display:inline-flex;align-items:center;margin-right:3px;vertical-align:middle;flex-shrink:0;";
		const img = document.createElement("img");
		img.src = rankSrc;
		img.alt = "Rank";
		img.className = "newLeaderRankedIcon";
		img.style.cssText = "width:24px;height:24px;";
		badge.appendChild(img);
		item.insertBefore(badge, nameEl);
	} catch (err) {
		console.log("[RankBadgeSync] injectBadgeIntoItem error:", err);
	}
}

// Inject badges into ALL current rows in old leaderboard
function injectAll() {
	try {
		const holder = document.getElementById("leaderboardHolder");
		if (!holder) return;
		holder.querySelectorAll(".leaderItem").forEach(injectBadgeIntoItem);
	} catch (err) {
		console.log("[RankBadgeSync] injectAll error:", err);
	}
}

let rowObserver = null;
let centerObserver = null;
let isInitialized = false;

function init() {
	if (isInitialized) return;
	isInitialized = true;

	// Initial sync
	updateRankCache();
	injectAll();

	try {
		// Watch #leaderboardHolder - re-inject immediately when rows are added/replaced
		const attachRowObserver = () => {
			const holder = document.getElementById("leaderboardHolder");
			if (!holder) return false;

			if (rowObserver) rowObserver.disconnect();
			rowObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (mutation.type !== 'childList') continue;
					for (const node of mutation.addedNodes) {
						if (node.nodeType !== 1) continue;
						const el = /** @type {Element} */ (node);
						if (el.classList && el.classList.contains('leaderItem')) {
							injectBadgeIntoItem(el);
						} else if (el.querySelectorAll) {
							el.querySelectorAll('.leaderItem').forEach(injectBadgeIntoItem);
						}
					}
				}
			});
			rowObserver.observe(holder, { childList: true, subtree: true });
			return true;
		};

		if (!attachRowObserver()) {
			const wait = setInterval(() => { if (attachRowObserver()) clearInterval(wait); }, 200);
		}

		// Watch #centerLeaderDisplay - update cache + re-inject when Krunker updates rank data
		const attachCenterObserver = () => {
			const center = document.getElementById("centerLeaderDisplay");
			if (!center) return false;

			if (centerObserver) centerObserver.disconnect();
			centerObserver = new MutationObserver(() => {
				updateRankCache();
				injectAll();
			});
			centerObserver.observe(center, { childList: true, subtree: true, characterData: true });
			return true;
		};

		if (!attachCenterObserver()) {
			const wait = setInterval(() => { if (attachCenterObserver()) clearInterval(wait); }, 200);
		}

		console.log("[RankBadgeSync] Initialized");
	} catch (err) {
		console.log("[RankBadgeSync] init error:", err);
	}
}

function cleanup() {
	if (rowObserver) { rowObserver.disconnect(); rowObserver = null; }
	if (centerObserver) { centerObserver.disconnect(); centerObserver = null; }
	rankCache.clear();
	isInitialized = false;
}

module.exports = { init, cleanup };
