"use strict";

require("v8-compile-cache");

let Events = require("events");
// RecordingSystem removed
let AccountManager = require("../modules/account-manager");
let UtilManager = require("../modules/util-manager");
let ClanColorizer = require("../modules/clan-colorizer");
let settingsWindow = null;

// Initialize Community CSS (self-initializing module)
const communityCSSAddon = require("../modules/communityCSS");

// Inject Water Loading Screen
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const config = new Store();

// Anti-Flash Blocker - Inject immediately to prevent native Krunker flash
(function () {
    const blocker = document.createElement('style');
    blocker.id = 'water-preload-blocker';
    blocker.textContent = `
        html, body { 
            background: #000 !important; 
            overflow: hidden !important;
        }
        #instructionsFadeBG { 
            display: none !important; 
        }
        * { 
            visibility: hidden !important; 
        }
    `;

    // Inject immediately
    if (document.documentElement) {
        document.documentElement.appendChild(blocker);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.documentElement.appendChild(blocker);
        });
    }

    console.log('[WaterClient] Anti-flash blocker injected');
})();

// Water Client Loading Screen - Pink Water Theme
if (config.get('hideLoadingSpinner', true)) {
    (function () {
        // HTML Structure - Pink Water Drop Theme
        const overlayHTML = `
            \u003cdiv id="loading-overlay"\u003e
                \u003cdiv class="bubbles"\u003e
                    \u003cdiv class="bubble"\u003e\u003c/div\u003e
                    \u003cdiv class="bubble"\u003e\u003c/div\u003e
                    \u003cdiv class="bubble"\u003e\u003c/div\u003e
                \u003c/div\u003e
                
                \u003cdiv class="water-loader"\u003e
                    \u003cdiv class="wave"\u003e\u003c/div\u003e
                    \u003cdiv class="wave"\u003e\u003c/div\u003e
                    \u003cspan class="material-symbols-outlined water-drop"\u003ewater_drop\u003c/span\u003e
                \u003c/div\u003e
            \u003c/div\u003e
        `;

        // CSS Styles - Pink Water Theme
        const overlayCSS = `
            #loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(180deg, #121212 0%, #1e1e1e 50%, #2a2a2a 100%);
                z-index: 99999999;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                transition: opacity 0.5s ease-out;
                pointer-events: all;
                visibility: visible !important;
            }

            body.loaded #loading-overlay {
                opacity: 0;
                pointer-events: none;
            }

            /* Water Loader Animation */
            .water-loader {
                position: relative;
                width: 150px;
                height: 150px;
                margin-bottom: 30px;
            }

            .wave {
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                border: 2px solid #ff6b9d;
                animation: wave-expand 2s ease-out infinite;
            }

            .wave:nth-child(2) {
                animation-delay: 0.5s;
            }

            @keyframes wave-expand {
                0% {
                    transform: scale(0.5);
                    opacity: 1;
                }
                100% {
                    transform: scale(1.5);
                    opacity: 0;
                }
            }

            .water-drop {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                animation: drop-bounce 1.5s ease-in-out infinite;
                font-size: 60px;
                color: #ff6b9d;
                font-variation-settings:
                    'FILL' 1,
                    'wght' 700,
                    'GRAD' 0,
                    'opsz' 48;
            }

            @keyframes drop-bounce {
                0%, 100% {
                    transform: translate(-50%, -50%) scale(1);
                }
                50% {
                    transform: translate(-50%, -50%) scale(0.9);
                }
            }

            /* Bubbles */
            .bubbles {
                position: absolute;
                width: 100%;
                height: 100%;
                top: 0;
                left: 0;
                overflow: hidden;
            }

            .bubble {
                position: absolute;
                background-color: #ff6b9d;
                border-radius: 50%;
                opacity: 0;
            }

            .bubble:nth-child(1) {
                width: 8px;
                height: 8px;
                left: 20%;
                animation: bubble-fall 3s linear infinite;
            }

            .bubble:nth-child(2) {
                width: 6px;
                height: 6px;
                left: 40%;
                animation: bubble-fall 2.8s linear infinite;
                animation-delay: 0.5s;
            }

            .bubble:nth-child(3) {
                width: 10px;
                height: 10px;
                left: 60%;
                animation: bubble-fall 3.2s linear infinite;
                animation-delay: 1s;
            }

            @keyframes bubble-fall {
                0% {
                    top: -20px;
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                90% {
                    opacity: 1;
                }
                100% {
                    top: 100%;
                    opacity: 0;
                }
            }
        `;

        // Initialize loading screen
        function init() {
            // Inject Material Icons font
            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=water_drop';
            document.head.appendChild(fontLink);

            // Inject CSS
            const styleEl = document.createElement('style');
            styleEl.id = 'water-loading-styles';
            styleEl.textContent = overlayCSS;
            document.head.appendChild(styleEl);

            // Inject HTML
            const div = document.createElement('div');
            div.innerHTML = overlayHTML;
            document.body.appendChild(div.firstElementChild);

            // Remove anti-flash blocker now that custom overlay is visible
            const blocker = document.getElementById('water-preload-blocker');
            if (blocker) {
                blocker.remove();
                console.log('[WaterClient] Anti-flash blocker removed');
            }

            // Make custom overlay visible
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.style.visibility = 'visible';
            }

            // Signal main process that overlay is injected
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('game-ready');
            console.log('[WaterClient] Game ready signal sent');

            // Hide loading screen function
            let hidden = false;
            const startTime = Date.now();
            const MIN_DISPLAY_TIME = 4000; // Minimum 4 seconds (increased from 1.5s)

            function hideLoadingScreen() {
                if (hidden) return;

                // Ensure minimum display time
                const elapsed = Date.now() - startTime;
                if (elapsed < MIN_DISPLAY_TIME) {
                    setTimeout(hideLoadingScreen, MIN_DISPLAY_TIME - elapsed);
                    return;
                }

                hidden = true;
                document.body.classList.add('loaded');

                // Remove elements after transition completes
                setTimeout(() => {
                    const overlay = document.getElementById('loading-overlay');
                    const styles = document.getElementById('water-loading-styles');
                    if (overlay) overlay.remove();
                    if (styles) styles.remove();
                }, 600);

                console.log('[WaterClient] Loading screen hidden after', elapsed + 'ms');
            }

            // Check if game is actually ready (not just elements existing)
            function isGameReady() {
                const menu = document.getElementById('menu');
                const instructions = document.getElementById('instructions');

                // Check if elements exist and are visible
                if (!menu && !instructions) return false;

                const targetElement = menu || instructions;
                const style = window.getComputedStyle(targetElement);

                // Element must be visible
                const isVisible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    targetElement.offsetWidth > 0 &&
                    targetElement.offsetHeight > 0;

                if (!isVisible) return false;

                // Additional check: Canvas should be rendered
                const canvas = document.querySelector('canvas');
                if (canvas && canvas.width > 0 && canvas.height > 0) {
                    return true;
                }

                // Or if menu has interactive elements ready
                const menuButtons = document.querySelectorAll('#menu .menuItem, #instructions');
                return menuButtons.length > 0;
            }

            // Method 1: Watch for game UI with MutationObserver
            const observer = new MutationObserver(() => {
                if (isGameReady()) {
                    hideLoadingScreen();
                    observer.disconnect();
                }
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });

            // Method 2: Periodic check (every 100ms)
            const checkInterval = setInterval(() => {
                if (isGameReady()) {
                    clearInterval(checkInterval);
                    hideLoadingScreen();
                }
            }, 100);

            // Method 3: Absolute maximum timeout (10 seconds)
            setTimeout(() => {
                clearInterval(checkInterval);
                observer.disconnect();
                hideLoadingScreen();
            }, 10000);

            console.log('[WaterClient] Loading screen overlay initialized');
        }

        // Wait for DOM to be ready
        if (document.head && document.body) {
            init();
        } else {
            document.addEventListener('DOMContentLoaded', init);
        }
    })();
}

// Inject Twitch Chat Integration script
try {
    const twitchChatScript = fs.readFileSync(path.join(__dirname, '../modules/twitch-chat.js'), 'utf8');
    // Inject script after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const script = document.createElement('script');
            script.textContent = twitchChatScript;
            document.head.appendChild(script);
            console.log('[WaterClient] Twitch Chat Integration script injected');
        });
    } else {
        const script = document.createElement('script');
        script.textContent = twitchChatScript;
        document.head.appendChild(script);
        console.log('[WaterClient] Twitch Chat Integration script injected');
    }
} catch (e) {
    console.error('[WaterClient] Failed to inject Twitch Chat Integration script:', e);
}

// Load Matchmaker UI functions
try {
    require('../scripts/matchmaker-ui.js');
    console.log('[WaterClient] Matchmaker UI functions loaded');
} catch (e) {
    console.error('[WaterClient] Failed to load Matchmaker UI:', e);
}

// Apply ad blocking body class if enabled
if (config.get('adBlock', false)) {
    // Inject ad blocking CSS
    try {
        const adblockCSS = fs.readFileSync(path.join(__dirname, '../styles/adblock.css'), 'utf8');
        const style = document.createElement('style');
        style.textContent = adblockCSS;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
                document.body.classList.add('adBlock');
                console.log('[WaterClient] Ad blocking CSS and class applied');
            });
        } else {
            document.head.appendChild(style);
            document.body.classList.add('adBlock');
            console.log('[WaterClient] Ad blocking CSS and class applied');
        }
    } catch (e) {
        console.error('[WaterClient] Failed to inject ad blocking CSS:', e);
    }
}

// @TODO: Find fix for incorrect `window` TS TypeDefs & refactor

Object.assign(window[UtilManager.instance._utilKey], {
    searchMatches: entry => {
        try {
            const query = String((settingsWindow && settingsWindow.settingSearch) || "").toLowerCase();
            const name = String(entry && entry.name || "").toLowerCase();
            const cat = String(entry && entry.cat || "").toLowerCase();
            return name.includes(query) || cat.includes(query);
        } catch (_) {
            return false;
        }
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

// Recording system initialization removed

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

    // Initialize Community CSS addon and inject buttons
    try {
        const CommunityCSSAddon = communityCSSAddon;
        const cssAddon = new CommunityCSSAddon();

        // Initialize CSS loader
        cssAddon.init().then(() => {
            // Inject Water and Mods buttons
            const tryInject = () => {
                const waterInjected = cssAddon.injectSidebarItem();
                const modsInjected = cssAddon.injectModsSidebarItem();

                if (!waterInjected || !modsInjected) {
                    setTimeout(tryInject, 100);
                } else {
                    console.log('[Water] Community CSS injected successfully');
                    // Apply UI toggles
                    cssAddon.applyUIToggles();
                }
            };
            tryInject();
        }).catch(e => console.error('[Water] Community CSS init error:', e));
    } catch (e) {
        console.error('[Water] Community CSS setup error:', e);
    }

    // Register Water tab indices BEFORE patching getSettings (idempotent)
    try {
        const ensureTab = (arr, name) => {
            if (!Array.isArray(arr)) return;
            if (!arr.some(t => t && t.name === name)) arr.push({ name });
        };
        ensureTab(settingsWindow.tabs && settingsWindow.tabs.basic, "Water");
        ensureTab(settingsWindow.tabs && settingsWindow.tabs.advanced, "Water");
        // Remove unwanted 'Client' tab if present
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
            } catch (_) { }
        }
    } catch (_) { }

    // Patch getSettings to fix custom tab bug + settings not displaying issue
    const origGetSettings = settingsWindow.getSettings;
    settingsWindow.getSettings = (...args) => {
        try {
            const stype = String(settingsWindow && settingsWindow.settingType || 'basic');
            const tabList = (settingsWindow && settingsWindow.tabs && settingsWindow.tabs[stype]) || [];
            const curTab = tabList[settingsWindow && settingsWindow.tabIndex || 0] || null;
            const isWaterTab = curTab && curTab.name === "Water" && !settingsWindow.settingSearch;
            if (isWaterTab) {
                return settingsWindow.getCSettings();
            }
            let base = origGetSettings.call(settingsWindow, ...args);
            base = (typeof base === 'string') ? base : String(base || '');
            try { base = base.replace(/No settings found/gi, ""); } catch (_) { }
            if (settingsWindow && settingsWindow.settingSearch) {
                base += String(settingsWindow.getCSettings() || '');
            }
            return base;
        } catch (e) {
            console.error('[Water] getSettings patch error:', e);
            try { return origGetSettings.call(settingsWindow, ...args); } catch (_) { return ''; }
        }
    };

    // clientTabIndex declared above
    settingsWindow.getCSettings = () => {
        // Filter entries
        const settingsObj = (UtilManager.instance && UtilManager.instance.clientUtils && UtilManager.instance.clientUtils.settings) || {};
        const all = Object.values(settingsObj).filter(entry => {
            if (entry.hide) return false;
            if (settingsWindow && settingsWindow.settingSearch) return UtilManager.instance.clientUtils.searchMatches(entry);
            return true;
        });
        // Group by category
        const groups = new Map();
        for (const e of all) {
            if (!groups.has(e.cat)) groups.set(e.cat, []);
            groups.get(e.cat).push(e);
        }
        // Desired order
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

// Monitor access token for Water Bot
UtilManager.instance.clientUtils.events.on("game-load", () => {
    const { ipcRenderer } = require("electron");

    try {
        const HEADSHOT_FILE = "headshot_0.mp3";
        const parseKeywords = (str) => String(str || "").split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        const getKeywords = () => parseKeywords(config && config.get ? config.get("killstreakMuteKeywords", "valorant,killstreak") : "valorant,killstreak");

        let killstreakActive = false;
        const origConsoleLog = console.log.bind(console);
        if (!console.__waterKillstreakMutePatch) {
            console.log = (...args) => {
                try {
                    const text = args.map(a => String(a)).join(" ").toLowerCase();
                    const kws = getKeywords();
                    const hit = kws.some(k => text.includes(k));
                    if (hit) {
                        const posWords = ["executing userscript", "executing:", "injected", "running", "overlay", "enabled", "loaded", "start", "started"]; 
                        const negWords = ["unloading userscript", "disabled", "stopped", "stop", "unloaded"]; 
                        if (posWords.some(w => text.includes(w))) killstreakActive = true;
                        if (negWords.some(w => text.includes(w))) killstreakActive = false;
                    }
                } catch (_) {}
                return origConsoleLog(...args);
            };
            console.__waterKillstreakMutePatch = true;
        }

        const isKillstreakScriptEnabled = () => {
            try {
                const kws = getKeywords();
                const keys = Object.keys(localStorage).filter(k => k.startsWith("water-script-") && localStorage.getItem(k) === "true");
                const byId = keys.some(k => kws.some(kw => k.toLowerCase().includes(kw)));
                return killstreakActive || byId;
            } catch (_) { return killstreakActive; }
        };

        const OriginalAudio = window.Audio;
        if (OriginalAudio && !window.Audio.__waterKillstreakCtorPatch) {
            const PatchedAudio = function(...args) {
                const a = new OriginalAudio(...args);
                const applyMute = () => {
                    try {
                        if (isKillstreakScriptEnabled()) {
                            const src = String(a.currentSrc || a.src || "").toLowerCase();
                            if (src.includes(HEADSHOT_FILE) || src.includes("headshot")) {
                                a.muted = true;
                                a.volume = 0;
                            }
                        }
                    } catch (_) {}
                };
                a.addEventListener('canplay', applyMute);
                a.addEventListener('play', applyMute);
                return a;
            };
            PatchedAudio.prototype = OriginalAudio.prototype;
            window.Audio = PatchedAudio;
            window.Audio.__waterKillstreakCtorPatch = true;
        }

        const origPlay = HTMLAudioElement.prototype.play;
        if (!HTMLAudioElement.prototype.__waterKillstreakPatch) {
            HTMLAudioElement.prototype.play = function(...args) {
                try {
                    if (isKillstreakScriptEnabled()) {
                        const src = String(this.currentSrc || this.src || "").toLowerCase();
                        if (src.includes(HEADSHOT_FILE) || src.includes("headshot")) {
                            try { this.pause(); } catch (_) {}
                            this.muted = true;
                            this.volume = 0;
                            return Promise.resolve();
                        }
                    }
                } catch (_) {}
                return origPlay.apply(this, args);
            };
            HTMLAudioElement.prototype.__waterKillstreakPatch = true;
        }

        try {
            const { session } = require('electron');
            const defaultSession = session && session.defaultSession;
            if (defaultSession && !window.__waterKillstreakReqHook) {
                defaultSession.webRequest.onBeforeRequest({ urls: ['*://assets.krunker.io/sound/headshot_0.mp3*'] }, (details, callback) => {
                    try {
                        if (isKillstreakScriptEnabled()) return callback({ cancel: true });
                    } catch (_) { }
                    callback({});
                });
                window.__waterKillstreakReqHook = true;
            }
        } catch (_) {}
    } catch (_) {}

    // Send player name if available
    try {
        // Try to get player name from window object (Krunker stores username there)
        const playerName = window.getSavedVal && window.getSavedVal("playerName");
        if (playerName) {
            ipcRenderer.send("bot-player-name-update", playerName);
        }
    } catch (e) {
        console.error("[WaterBot] Player name send error:", e);
    }

    // Send token immediately if available
    const sendToken = () => {
        try {
            // Try common localStorage keys for Krunker token
            const token = localStorage.getItem("krunker_token") ||
                localStorage.getItem("token") ||
                localStorage.getItem("access_token");
            if (token) {
                ipcRenderer.send("bot-token-update", token);
            }
        } catch (e) {
            console.error("[WaterBot] Token send error:", e);
        }
    };

    sendToken();

    // Monitor for token changes periodically
    setInterval(sendToken, 10000); // Every 10 seconds
});
