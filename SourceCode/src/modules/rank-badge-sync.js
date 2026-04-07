"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const module_1 = __importDefault(require("../module"));
const context_1 = require("../context");
class RankBadgeSync extends module_1.default {
    name = 'Rank Badge Sync';
    id = 'rankbadgesync';
    contexts = [
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadEnd,
        },
    ];
    options = [];
    rankCache = new Map();
    rowObserver = null;
    centerObserver = null;
    isInitialized = false;
    getPlayerName(nameEl) {
        if (!nameEl)
            return '';
        let name = '';
        nameEl.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                name += node.textContent;
            }
        });
        return name.trim().toLowerCase();
    }
    updateRankCache() {
        try {
            const center = document.getElementById('centerLeaderDisplay');
            if (!center)
                return;
            center.querySelectorAll('.newLeaderItem').forEach((item) => {
                const nameEl = item.querySelector('.newLeaderNameM, .newLeaderNameF, .newLeaderName');
                if (!nameEl)
                    return;
                const name = this.getPlayerName(nameEl);
                if (!name)
                    return;
                const rankImg = item.querySelector('.newLeaderRanked img');
                const src = rankImg ? rankImg.src : null;
                this.rankCache.set(name, src);
            });
        }
        catch (err) {
            console.log('[RankBadgeSync] updateRankCache error:', err);
        }
    }
    injectBadgeIntoItem(item) {
        try {
            const nameEl = item.querySelector('.leaderNameM, .leaderNameF, .leaderName');
            if (!nameEl)
                return;
            const name = this.getPlayerName(nameEl);
            if (!name)
                return;
            if (!this.rankCache.has(name))
                return;
            const rankSrc = this.rankCache.get(name);
            if (!rankSrc)
                return;
            const existing = item.querySelector('.waterLeaderRanked img');
            if (existing) {
                if (existing.src !== rankSrc)
                    existing.src = rankSrc;
                return;
            }
            const badge = document.createElement('div');
            badge.className = 'waterLeaderRanked';
            badge.style.cssText =
                'display:inline-flex;align-items:center;margin-right:3px;vertical-align:middle;flex-shrink:0;';
            const img = document.createElement('img');
            img.src = rankSrc;
            img.alt = 'Rank';
            img.className = 'newLeaderRankedIcon';
            img.style.cssText = 'width:24px;height:24px;';
            badge.appendChild(img);
            item.insertBefore(badge, nameEl);
        }
        catch (err) {
            console.log('[RankBadgeSync] injectBadgeIntoItem error:', err);
        }
    }
    injectAll() {
        try {
            const holder = document.getElementById('leaderboardHolder');
            if (!holder)
                return;
            holder.querySelectorAll('.leaderItem').forEach((item) => {
                this.injectBadgeIntoItem(item);
            });
        }
        catch (err) {
            console.log('[RankBadgeSync] injectAll error:', err);
        }
    }
    attachRowObserver() {
        const holder = document.getElementById('leaderboardHolder');
        if (!holder)
            return false;
        if (this.rowObserver)
            this.rowObserver.disconnect();
        this.rowObserver = new MutationObserver((mutations) => {
            const itemsToProcess = [];
            for (const mutation of mutations) {
                if (mutation.type !== 'childList')
                    continue;
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1)
                        continue;
                    const el = node;
                    if (el.classList && el.classList.contains('leaderItem')) {
                        itemsToProcess.push(el);
                    }
                    else if (el.querySelectorAll) {
                        el.querySelectorAll('.leaderItem').forEach((item) => {
                            itemsToProcess.push(item);
                        });
                    }
                }
            }
            itemsToProcess.forEach((item) => this.injectBadgeIntoItem(item));
        });
        this.rowObserver.observe(holder, { childList: true, subtree: true });
        return true;
    }
    attachCenterObserver() {
        const center = document.getElementById('centerLeaderDisplay');
        if (!center)
            return false;
        if (this.centerObserver)
            this.centerObserver.disconnect();
        let updateTimeout = null;
        this.centerObserver = new MutationObserver(() => {
            if (updateTimeout)
                clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                this.updateRankCache();
                this.injectAll();
            }, 100);
        });
        this.centerObserver.observe(center, {
            childList: true,
            subtree: true,
        });
        return true;
    }
    initSync() {
        if (this.isInitialized)
            return;
        this.isInitialized = true;
        this.updateRankCache();
        this.injectAll();
        try {
            if (!this.attachRowObserver()) {
                const wait = setInterval(() => {
                    if (this.attachRowObserver())
                        clearInterval(wait);
                }, 200);
            }
            if (!this.attachCenterObserver()) {
                const wait = setInterval(() => {
                    if (this.attachCenterObserver())
                        clearInterval(wait);
                }, 200);
            }
            console.log('[RankBadgeSync] Initialized');
        }
        catch (err) {
            console.log('[RankBadgeSync] init error:', err);
        }
    }
    cleanup() {
        if (this.rowObserver) {
            this.rowObserver.disconnect();
            this.rowObserver = null;
        }
        if (this.centerObserver) {
            this.centerObserver.disconnect();
            this.centerObserver = null;
        }
        this.rankCache.clear();
        this.isInitialized = false;
        console.log('[RankBadgeSync] Cleaned up');
    }
    renderer() {
        this.initSync();
        window.addEventListener('beforeunload', this.cleanup.bind(this));
        window.addEventListener('unload', this.cleanup.bind(this));
    }
}
exports.default = RankBadgeSync;
