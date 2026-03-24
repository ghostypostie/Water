"use strict";

require("v8-compile-cache");

let Events = require("events");
let AccountManager = require("../modules/account-manager");
let UtilManager = require("../modules/util-manager");
let ClanColorizer = require("../modules/clan-colorizer");
let RankBadgeSync = require("../modules/rank-badge-sync");
let settingsWindow = null;

// Initialize Community CSS (self-initializing module)
const communityCSSAddon = require("../modules/communityCSS");

const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const config = new Store();

// ==========================================
// EARLY ANIMATION KILL (before any CSS loads)
// ==========================================
try {
    const Store = require('electron-store');
    const _earlyConfig = new Store();
    if (_earlyConfig.get('removeAnimations', false)) {
        const _noAnim = document.createElement('style');
        _noAnim.id = 'water-no-animations';
        _noAnim.textContent = `*, *::before, *::after {
  animation: none !important;
  animation-name: none !important;
  animation-duration: 0.001ms !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  animation-play-state: paused !important;
  animation-fill-mode: none !important;
  transition: none !important;
  transition-duration: 0.001ms !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}`;
        (document.head || document.documentElement).appendChild(_noAnim);
        console.log('[WaterClient] Early animation kill injected');
    }
} catch (_e) {}

// ==========================================
// EARLY CSS INJECTION
// ==========================================
console.log('[WaterClient] Early injection starting...');

try {
    const injectCSS = () => {
        const { remote } = require('electron');
        const preloadedCSS = remote && remote.getGlobal('waterPreloadedCSS');

        if (preloadedCSS && preloadedCSS['main_custom.css']) {
            const style = document.createElement('style');
            style.id = 'water-early-css';
            style.textContent = preloadedCSS['main_custom.css'];
            (document.head || document.documentElement).appendChild(style);
            console.log('[WaterClient] Early CSS injected from preload cache');
        } else {
            const cssPath = path.join(__dirname, '../assets/css/main_custom.css');
            if (fs.existsSync(cssPath)) {
                const style = document.createElement('style');
                style.id = 'water-early-css';
                style.textContent = fs.readFileSync(cssPath, 'utf8');
                (document.head || document.documentElement).appendChild(style);
                console.log('[WaterClient] Early CSS injected from disk');
            }
        }
    };

    if (document.head || document.documentElement) {
        injectCSS();
    } else {
        document.addEventListener('DOMContentLoaded', injectCSS, { once: true });
    }
} catch (e) {
    console.error('[WaterClient] Failed to inject early CSS:', e);
}

// Ad blocking CSS
if (config.get('adBlock', false)) {
    try {
        const injectAdblockCSS = () => {
            const { remote } = require('electron');
            const preloadedCSS = remote && remote.getGlobal('waterPreloadedCSS');

            if (preloadedCSS && preloadedCSS['adblock.css']) {
                const style = document.createElement('style');
                style.id = 'water-adblock-css';
                style.textContent = preloadedCSS['adblock.css'];
                (document.head || document.documentElement).appendChild(style);
                console.log('[WaterClient] Ad blocking CSS injected from preload cache');
            } else {
                const cssPath = path.join(__dirname, '../styles/adblock.css');
                if (fs.existsSync(cssPath)) {
                    const style = document.createElement('style');
                    style.id = 'water-adblock-css';
                    style.textContent = fs.readFileSync(cssPath, 'utf8');
                    (document.head || document.documentElement).appendChild(style);
                    console.log('[WaterClient] Ad blocking CSS injected from disk');
                }
            }
        };

        if (document.head || document.documentElement) {
            injectAdblockCSS();
        } else {
            document.addEventListener('DOMContentLoaded', injectAdblockCSS, { once: true });
        }
    } catch (e) {
        console.error('[WaterClient] Failed to inject ad blocking CSS early:', e);
    }
}

// Apply body classes
const applyBodyClasses = () => {
    if (document.body) {
        if (config.get('adBlock', false)) document.body.classList.add('adBlock');
        console.log('[WaterClient] Body classes applied');
    } else {
        setTimeout(applyBodyClasses, 10);
    }
};
applyBodyClasses();

// ==========================================
// TWITCH CHAT INTEGRATION
// ==========================================
try {
    const twitchPath = path.join(__dirname, '../modules/twitch-chat.js');
    fs.promises.readFile(twitchPath, 'utf8').then((twitchChatScript) => {
        const inject = () => {
            try {
                const script = document.createElement('script');
                script.textContent = twitchChatScript;
                document.head.appendChild(script);
                console.log('[WaterClient] Twitch Chat Integration injected');
            } catch (e) {
                console.error('[WaterClient] Failed to inject Twitch Chat:', e);
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', inject, { once: true });
        } else {
            inject();
        }
    }).catch(e => console.error('[WaterClient] Failed to load Twitch Chat script:', e));
} catch (e) {
    console.error('[WaterClient] Twitch Chat error:', e);
}

// ==========================================
// MATCHMAKER UI
// ==========================================
try {
    require('../scripts/matchmaker-ui.js');
    console.log('[WaterClient] Matchmaker UI loaded');
} catch (e) {
    console.error('[WaterClient] Failed to load Matchmaker UI:', e);
}

// ==========================================
// USERSCRIPTS
// ==========================================
try {
    const { initializeUserscripts } = require('../modules/userscript-manager/userscript-loader');
    const { ipcRenderer } = require('electron');

    ipcRenderer.invoke('get-app-info').then(info => {
        if (config.get('enableUserscripts', true)) {
            const userscriptsPath = String(config.get('userscriptsPath', '') || path.join(info.documentsDir, 'Water', 'Scripts'));
            const userscriptPrefsPath = path.join(info.documentsDir, 'Water', 'ScriptPrefs');
            if (!fs.existsSync(userscriptPrefsPath)) fs.mkdirSync(userscriptPrefsPath, { recursive: true });
            initializeUserscripts(userscriptsPath, userscriptPrefsPath, config);
            console.log('[Water] Userscripts initialized');
        }
    }).catch(e => console.error('[Water] Failed to initialize userscripts:', e));
} catch (e) {
    console.error('[Water] Failed to load userscript loader:', e);
}

// ==========================================
// MEMORY MANAGEMENT
// Only run GC between matches (menu state), never during gameplay.
// ==========================================
try {
    let lastGameState = null;

    setInterval(() => {
        try {
            const uiBase = document.getElementById('uiBase');
            if (!uiBase) return;
            const inGame = !uiBase.classList.contains('onMenu') && !uiBase.classList.contains('onCompMenu');

            // Transitioned from in-game to menu = match ended
            if (lastGameState === 'game' && !inGame) {
                // Defer GC by 2s so death/end-screen animations finish first
                setTimeout(() => {
                    if (global.gc) {
                        try { global.gc(); console.log('[WaterClient] Post-match GC completed'); } catch (_) {}
                    }
                }, 2000);
            }

            lastGameState = inGame ? 'game' : 'menu';
        } catch (e) {
            console.error('[WaterClient] State check error:', e);
        }
    }, 5000);

    console.log('[WaterClient] Memory management initialized');
} catch (e) {
    console.error('[WaterClient] Failed to initialize memory management:', e);
}

// ==========================================
// UTIL MANAGER EXTENSIONS
// ==========================================
Object.assign(window[UtilManager.instance._utilKey], {
    searchMatches: entry => {
        try {
            const query = String((settingsWindow && settingsWindow.settingSearch) || "").toLowerCase();
            const name = String(entry && entry.name || "").toLowerCase();
            const cat = String(entry && entry.cat || "").toLowerCase();
            return name.includes(query) || cat.includes(query);
        } catch (_) { return false; }
    },
    genCSettingsHTML: options => {
        switch (options.type) {
            case "checkbox": return `<label class='switch'><input type='checkbox' onclick='window["${UtilManager.instance._utilKey}"].setCSetting("${options.id}", this.checked)'${options.val ? " checked" : ""}><span class='slider'></span></label>`;
            case "slider": return `<input type='number' class='sliderVal' id='c_slid_input_${options.id}' min='${options.min}' max='${options.max}' value='${options.val}' onkeypress='window["${UtilManager.instance._utilKey}"].delaySetCSetting("${options.id}", this)' style='border-width:0px'/><div class='slidecontainer'><input type='range' id='c_slid_${options.id}' min='${options.min}' max='${options.max}' step='${options.step}' value='${options.val}' class='sliderM' oninput='window["${UtilManager.instance._utilKey}"].setCSetting("${options.id}", this.value)'></div>`;
            case "select": return `<select onchange='window["${UtilManager.instance._utilKey}"].setCSetting("${options.id}", this.value)' class='inputGrey2'>${Object.entries(options.options).map(entry => `<option value='${entry[0]}'${entry[0] === options.val ? " selected" : ""}>${entry[1]}</option>`).join("")}</select>`;
            default: return `<input type='${options.type}' name='${options.id}' id='c_slid_${options.id}' ${options.type === "color" ? 'style="float:right;margin-top:5px;"' : `class='inputGrey2' ${options.placeholder ? `placeholder='${options.placeholder}'` : ""}`} value='${(options.val || "").replace(/'/g, "")}' oninput='window["${UtilManager.instance._utilKey}"].setCSetting("${options.id}", this.value)'/>`;
        }
    }
});

// Workaround to avoid getting client popup
/** @type {object} */
(window).OffCliV = true;

let accountManager = new AccountManager();

document.addEventListener("DOMContentLoaded", () => {
    let windowsObserver = new MutationObserver(() => {
        windowsObserver.disconnect();
        UtilManager.instance.clientUtils.events.emit("game-load");
    });
    windowsObserver.observe(document.getElementById("instructions"), { childList: true });
    accountManager.injectStyles();
});

UtilManager.instance.clientUtils.events.on("game-load", () => {
    /** @type {object} */
    (window).closeClient = close;
    settingsWindow = /** @type {object} */ (window).windows[0];

    // Initialize clan tag colorizer
    ClanColorizer.init();

    // Initialize rank badge sync
    RankBadgeSync.init();

    // Initialize Community CSS addon
    try {
        const CommunityCSSAddon = communityCSSAddon;
        const cssAddon = new CommunityCSSAddon();

        cssAddon.init().catch(e => console.error('[Water] Community CSS init error:', e));

        // Start mod downloader — injects DL buttons into Krunker's mods window
        try { cssAddon.initModDownloader(); } catch (_) {}

        const tryInject = () => {
            const waterInjected = cssAddon.injectSidebarItem();
            const modsInjected = cssAddon.injectModsSidebarItem();
            if (!waterInjected || !modsInjected) {
                setTimeout(tryInject, 50);
            } else {
                console.log('[Water] Community CSS injected successfully');
                window.communityCSSAddon = cssAddon;
                cssAddon.applyUIToggles();
            }
        };
        tryInject();
    } catch (e) {
        console.error('[Water] Community CSS setup error:', e);
    }

    // Register Water tab
    try {
        const ensureTab = (arr, name) => {
            if (!Array.isArray(arr)) return;
            if (!arr.some(t => t && t.name === name)) arr.push({ name });
        };
        ensureTab(settingsWindow.tabs && settingsWindow.tabs.basic, "Water");
        ensureTab(settingsWindow.tabs && settingsWindow.tabs.advanced, "Water");
        const stripClient = (arr) => Array.isArray(arr) ? arr.filter(t => (t && String(t.name).toLowerCase() !== 'client')) : arr;
        if (settingsWindow && settingsWindow.tabs) {
            settingsWindow.tabs.basic = stripClient(settingsWindow.tabs.basic);
            settingsWindow.tabs.advanced = stripClient(settingsWindow.tabs.advanced);
            try {
                const stype = String(settingsWindow.settingType || 'basic');
                const list = (settingsWindow.tabs && settingsWindow.tabs[stype]) || [];
                if (settingsWindow.tabIndex >= list.length) settingsWindow.tabIndex = 0;
                const cur = list[settingsWindow.tabIndex];
                if (cur && String(cur.name).toLowerCase() === 'client') settingsWindow.tabIndex = 0;
            } catch (_) {}
        }
    } catch (_) {}

    // Patch getSettings
    const origGetSettings = settingsWindow.getSettings;
    settingsWindow.getSettings = (...args) => {
        try {
            const stype = String(settingsWindow && settingsWindow.settingType || 'basic');
            const tabList = (settingsWindow && settingsWindow.tabs && settingsWindow.tabs[stype]) || [];
            const curTab = tabList[settingsWindow && settingsWindow.tabIndex || 0] || null;
            const isWaterTab = curTab && curTab.name === "Water" && !settingsWindow.settingSearch;

            if (isWaterTab) return settingsWindow.getCSettings();

            let base = origGetSettings.call(settingsWindow, ...args);
            base = (typeof base === 'string') ? base : String(base || '');
            try { base = base.replace(/No settings found/gi, ""); } catch (_) {}
            if (settingsWindow && settingsWindow.settingSearch) {
                base += String(settingsWindow.getCSettings() || '');
            }
            return base;
        } catch (e) {
            console.error('[Water] getSettings patch error:', e);
            try { return origGetSettings.call(settingsWindow, ...args); } catch (_) { return ''; }
        }
    };

    settingsWindow.getCSettings = () => {
        const settingsObj = (UtilManager.instance && UtilManager.instance.clientUtils && UtilManager.instance.clientUtils.settings) || {};
        const all = Object.values(settingsObj).filter(entry => {
            if (entry.hide) return false;
            if (settingsWindow && settingsWindow.settingSearch) return UtilManager.instance.clientUtils.searchMatches(entry);
            return true;
        });
        const groups = new Map();
        for (const e of all) {
            if (!groups.has(e.cat)) groups.set(e.cat, []);
            groups.get(e.cat).push(e);
        }
        const order = ["Quick Play", "Performance", "Interface", "Discord", "Chromium", "Maintenance"];
        const cats = [...order, ...[...groups.keys()].filter(c => !order.includes(c))];
        let html = "";
        for (const cat of cats) {
            let items = groups.get(cat);
            if (!items || !items.length) continue;
            if (cat === "Performance") {
                const orderPerf = { acceleratedCanvas: 0, disableFrameRateLimit: 1, angleBackend: 2 };
                items = items.slice().sort((a, b) => (orderPerf[a.id] ?? 99) - (orderPerf[b.id] ?? 99));
            }
            html += `<div class='setHed' id='setHed_${btoa(cat)}' onclick='window.windows[0].collapseFolder(this)'><span class='material-icons plusOrMinus'>keyboard_arrow_down</span> ${cat}</div><div id='setBod_${btoa(cat)}'>`;
            for (const entry of items) {
                const tip = entry.needsRestart ? 'Requires Restart' : (entry.info ? String(entry.info) : '');
                const star = entry.needsRestart || entry.info ? " <span style='color: #eb5656'" + (tip ? ` title='${tip.replace(/'/g, "&apos;")}'` : '') + ">*</span>" : "";
                html += `<div class='settName'${tip ? ` title='${tip.replace(/'/g, "&apos;")}'` : ''}>${entry.name}${star} ${entry.html()}</div>`;
            }
            html += "</div>";
        }
        return html;
    };
});

// ==========================================
// F11 FULLSCREEN TOGGLE
// Renderer sends IPC to main — works through pointer lock and all window states
// ==========================================
try {
    const { ipcRenderer } = require('electron');
    // Use window capture + also hook before DOMContentLoaded so it's first in the chain
    const _f11Handler = (e) => {
        if (e.key !== 'F11' && e.keyCode !== 122) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        ipcRenderer.send('f11-toggle');
        console.log('[WaterClient] F11 sent to main');
    };
    window.addEventListener('keydown', _f11Handler, true);
    document.addEventListener('keydown', _f11Handler, true);
} catch (e) {
    console.error('[WaterClient] F11 handler error:', e);
}

// ==========================================
// RAW MOUSE INPUT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    try {
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            const origRequestPointerLock = canvas.requestPointerLock ||
                canvas.mozRequestPointerLock ||
                canvas.webkitRequestPointerLock;
            if (origRequestPointerLock) {
                canvas.requestPointerLock = function() {
                    return origRequestPointerLock.call(this, { unadjustedMovement: true });
                };
                if (canvas.mozRequestPointerLock) canvas.mozRequestPointerLock = canvas.requestPointerLock;
                if (canvas.webkitRequestPointerLock) canvas.webkitRequestPointerLock = canvas.requestPointerLock;
                console.log('[WaterClient] Raw mouse input enabled');
            }
        }
    } catch (e) {
        console.error('[WaterClient] Failed to apply mouse input optimization:', e);
    }
});

// ==========================================
// GAME READY SIGNAL
// Send to main process once the game DOM is loaded so splash can close
// ==========================================
try {
    const { ipcRenderer } = require('electron');
    let readySent = false;
    const sendReady = () => {
        if (readySent) return;
        readySent = true;
        ipcRenderer.send('game-ready');
        console.log('[WaterClient] Game ready signal sent');
    };

    // Primary: watch for #instructions to get children (Krunker game-load signal)
    const waitForInstructions = () => {
        const el = document.getElementById('instructions');
        if (el) {
            const obs = new MutationObserver(() => { obs.disconnect(); sendReady(); });
            obs.observe(el, { childList: true });
        } else {
            setTimeout(waitForInstructions, 100);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForInstructions, { once: true });
    } else {
        waitForInstructions();
    }

    // Fallback: send after 12s regardless
    setTimeout(sendReady, 12000);
} catch (e) {
    console.error('[WaterClient] Failed to send game-ready signal:', e);
}

// ==========================================
// DISCORD RPC - QUEUE DETECTION
// ==========================================
if (config.get('discordRPC', true)) {
    try {
        const { ipcRenderer } = require('electron');
        let queueCheckInterval = null;
        let lastQueueState = false;
        let queueStartTime = null;

        const checkQueueStatus = () => {
            try {
                const statusText = document.querySelector('.status-text');
                if (!statusText) return;
                const text = statusText.textContent || '';
                const isInQueue = text.includes('Looking for match');

                if (isInQueue !== lastQueueState) {
                    lastQueueState = isInQueue;
                    if (isInQueue) {
                        queueStartTime = Date.now();
                        ipcRenderer.invoke('rpc-activity', {
                            details: 'Looking for match...',
                            state: 'Ranked Queue',
                            startTimestamp: queueStartTime,
                            largeImageKey: 'water_logo',
                            largeImageText: 'Water Client'
                        }).catch(() => {});
                    } else {
                        queueStartTime = null;
                        ipcRenderer.invoke('rpc-activity', {
                            details: 'In Menu',
                            state: 'Krunker.io',
                            largeImageKey: 'water_logo',
                            largeImageText: 'Water Client'
                        }).catch(() => {});
                    }
                }
            } catch (e) {
                console.error('[WaterClient] Queue check error:', e);
            }
        };

        const startQueueMonitoring = () => {
            if (queueCheckInterval) return;
            queueCheckInterval = setInterval(checkQueueStatus, 2000);
            console.log('[WaterClient] Queue monitoring started');
        };

        const stopQueueMonitoring = () => {
            if (queueCheckInterval) { clearInterval(queueCheckInterval); queueCheckInterval = null; }
        };

        setInterval(() => {
            try {
                const uiBase = document.getElementById('uiBase');
                if (!uiBase) return;
                const inGame = !uiBase.classList.contains('onMenu') && !uiBase.classList.contains('onCompMenu');
                if (inGame && queueCheckInterval) stopQueueMonitoring();
                else if (!inGame && !queueCheckInterval) startQueueMonitoring();
            } catch (e) {}
        }, 5000);

        setTimeout(startQueueMonitoring, 10000);
        console.log('[WaterClient] Discord RPC queue detection initialized');
    } catch (e) {
        console.error('[WaterClient] Failed to initialize RPC queue detection:', e);
    }
}

// ==========================================
// RANKED MATCH AUTO-FOCUS
// ==========================================
if (config.get('autoFocusRanked', true)) {
    try {
        const { ipcRenderer } = require('electron');
        let matchFoundTriggered = false;
        let isReady = false;

        setTimeout(() => {
            isReady = true;
            console.log('[WaterClient] Ranked match detection now active');
        }, 5000);

        const handleMatchFound = () => {
            if (!isReady || matchFoundTriggered) return;
            matchFoundTriggered = true;
            console.log('[WaterClient] pop_3.mp3 detected - ranked match found');

            ipcRenderer.send('ranked-match-found');

            const instaLockClass = config.get('instaLockClass', '-1');
            if (instaLockClass !== '-1' && instaLockClass !== -1) {
                const classNum = parseInt(instaLockClass);
                let attempts = 0;
                const trySelectClass = () => {
                    if (window.selectClass && typeof window.selectClass === 'function') {
                        window.selectClass(classNum);
                        console.log(`[WaterClient] Insta-locked class ${classNum}`);
                        return;
                    }
                    if (++attempts < 20) setTimeout(trySelectClass, 500);
                };
                trySelectClass();
            }

            setTimeout(() => {
                matchFoundTriggered = false;
                console.log('[WaterClient] Ranked match trigger reset');
            }, 10000);
        };

        window.waterHandleMatchFound = handleMatchFound;

        // XHR interception
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            if (typeof url === 'string' && url.includes('pop_3.mp3')) {
                setTimeout(() => window.waterHandleMatchFound && window.waterHandleMatchFound(), 100);
            }
            return originalXHROpen.call(this, method, url, ...rest);
        };

        // Fetch interception
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            if (typeof url === 'string' && url.includes('pop_3.mp3')) {
                setTimeout(() => window.waterHandleMatchFound && window.waterHandleMatchFound(), 100);
            }
            return originalFetch.apply(this, args);
        };

        // HTMLAudioElement.play interception
        const originalPlay = HTMLAudioElement.prototype.play;
        HTMLAudioElement.prototype.play = function() {
            if ((this.src || this.currentSrc || '').includes('pop_3.mp3')) {
                handleMatchFound();
            }
            return originalPlay.apply(this, arguments);
        };

        console.log('[WaterClient] Ranked match auto-focus enabled');
    } catch (e) {
        console.error('[WaterClient] Failed to initialize ranked match auto-focus:', e);
    }
}
