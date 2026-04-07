"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const module_1 = __importDefault(require("../module"));
const context_1 = require("../context");
class ClanColorizer extends module_1.default {
    name = 'Clan Colorizer';
    id = 'clancolorizer';
    contexts = [
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadEnd,
        },
    ];
    options = [];
    observer = null;
    isInitialized = false;
    SELECTORS = [
        '.leaderNameM span',
        '.leaderNameF span',
        '.leaderName span',
        '.newLeaderNameM span',
        '.newLeaderNameF span',
        '.newLeaderName span',
        '.pListName span',
        '.endTableN span',
    ].join(', ');
    TAG_COLORS = {
        H1ND: '#FF9933',
        psvm: '#AA00FF',
        VAMP: 'linear-gradient(90deg, hsla(0, 79%, 32%, 1) 0%, hsla(0, 0%, 0%, 1) 100%)',
    };
    normalizeTag(tag) {
        return String(tag || '')
            .replace(/^\[|\]$/g, '')
            .trim()
            .toUpperCase();
    }
    colorForText(text) {
        const key = this.normalizeTag(text);
        return key && this.TAG_COLORS[key] ? this.TAG_COLORS[key] : null;
    }
    colorElement(el) {
        const txt = (el.textContent || '').trim();
        if (!txt)
            return;
        const color = this.colorForText(txt);
        if (!color)
            return;
        // Check if it's a gradient
        if (color.startsWith('linear-gradient')) {
            el.style.setProperty('background', color, 'important');
            el.style.setProperty('background-clip', 'text', 'important');
            el.style.setProperty('-webkit-background-clip', 'text', 'important');
            el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
            el.style.setProperty('color', 'transparent', 'important');
        }
        else {
            el.style.setProperty('color', color, 'important');
        }
        el.dataset.clanColorized = color;
    }
    applyColors(root = document) {
        try {
            root.querySelectorAll(this.SELECTORS).forEach((el) => {
                this.colorElement(el);
            });
        }
        catch (err) {
            console.log('[ClanColorizer] applyColors error:', err);
        }
    }
    initObserver() {
        if (this.isInitialized)
            return;
        this.isInitialized = true;
        console.log('[ClanColorizer] Initializing with tags:', Object.keys(this.TAG_COLORS));
        this.applyColors();
        try {
            this.observer = new MutationObserver((mutations) => {
                const nodesToProcess = [];
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType !== 1)
                                continue;
                            const el = node;
                            if (el.matches && el.matches(this.SELECTORS)) {
                                nodesToProcess.push(el);
                            }
                            else if (el.querySelector) {
                                el.querySelectorAll(this.SELECTORS).forEach((span) => {
                                    nodesToProcess.push(span);
                                });
                            }
                        }
                    }
                    else if (mutation.type === 'characterData') {
                        const parent = mutation.target.parentElement;
                        if (parent && parent.matches && parent.matches(this.SELECTORS)) {
                            nodesToProcess.push(parent);
                        }
                    }
                }
                nodesToProcess.forEach((el) => this.colorElement(el));
            });
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
            });
            window.addEventListener('unload', this.cleanup.bind(this));
            console.log('[ClanColorizer] Initialized');
        }
        catch (err) {
            console.log('[ClanColorizer] init error:', err);
        }
    }
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.isInitialized = false;
        console.log('[ClanColorizer] Cleaned up');
    }
    renderer() {
        this.initObserver();
        window.addEventListener('beforeunload', this.cleanup.bind(this));
        window.addEventListener('unload', this.cleanup.bind(this));
    }
}
exports.default = ClanColorizer;
