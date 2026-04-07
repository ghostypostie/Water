"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const context_1 = require("../context");
const preload_1 = __importDefault(require("./preload"));
const fs_1 = require("fs");
require("../types/window");
const path_1 = require("path");
const util_1 = require("../util");
try {
    const Store = require('electron-store');
    const loaderConfig = new Store();
    const localStorageValue = localStorage.getItem('water-ui-hideWaterLoader');
    const electronStoreValue = loaderConfig.get('hideWaterLoader', false);
    const hideLoadingScreen = localStorageValue !== null
        ? localStorageValue === 'true'
        : electronStoreValue;
    const customLoadingScreen = loaderConfig.get('modules.misc.customLoadingScreen', '');
    console.log('[Water] localStorage hideWaterLoader:', localStorageValue);
    console.log('[Water] electron-store hideWaterLoader:', electronStoreValue);
    console.log('[Water] Final hideLoadingScreen:', hideLoadingScreen);
    console.log('[Water] customLoadingScreen:', customLoadingScreen || 'none');
    if (!hideLoadingScreen) {
        console.log('[Water] Injecting loading screen...');
        const injectLoader = () => {
            const loaderStyle = document.createElement('style');
            loaderStyle.id = 'water-loader-css';
            loaderStyle.textContent = `
                #waterLoadingOverlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #000000;
                    z-index: 999998;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    transition: opacity 0.5s ease;
                }
                #waterLoadingOverlay > * {
                    pointer-events: all;
                }
                .waterLoader {
                    width: 150px;
                    height: 150px;
                    background-color: #fe8bbb;
                    border-radius: 50%;
                    position: relative;
                    box-shadow: 0 0 30px 4px rgba(0, 0, 0, 0.5) inset,
                                0 5px 12px rgba(0, 0, 0, 0.15);
                    overflow: hidden;
                }
                .waterLoader:before,
                .waterLoader:after {
                    content: "";
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 45%;
                    top: -40%;
                    background-color: #fff;
                    animation: waterWave 3s linear infinite;
                }
                .waterLoader:before {
                    border-radius: 30%;
                    background: rgba(255, 255, 255, 0.4);
                    animation: waterWave 3s linear infinite;
                }
                @keyframes waterWave {
                    0% { transform: rotate(0); }
                    100% { transform: rotate(360deg); }
                }
                .waterCustomImage {
                    max-width: 300px;
                    max-height: 300px;
                    object-fit: contain;
                }
            `;
            (document.head || document.documentElement).appendChild(loaderStyle);
            const loaderOverlay = document.createElement('div');
            loaderOverlay.id = 'waterLoadingOverlay';
            if (customLoadingScreen && customLoadingScreen.trim()) {
                loaderOverlay.innerHTML = `<img src="${customLoadingScreen}" class="waterCustomImage" alt="Loading...">`;
            }
            else {
                loaderOverlay.innerHTML = `<span class="waterLoader"></span>`;
            }
            (document.body || document.documentElement).appendChild(loaderOverlay);
            window.waterLoadingOverlay = loaderOverlay;
            console.log('[Water] Loading screen injected');
            setupLoaderRemoval();
        };
        const setupLoaderRemoval = () => {
            const waitForInstructions = () => {
                const el = document.getElementById('instructions');
                if (el) {
                    const obs = new MutationObserver(() => {
                        obs.disconnect();
                        setTimeout(() => {
                            const overlay = window.waterLoadingOverlay;
                            if (overlay) {
                                console.log('[Water] Removing loading screen...');
                                overlay.style.opacity = '0';
                                setTimeout(() => {
                                    if (overlay && overlay.parentNode) {
                                        overlay.parentNode.removeChild(overlay);
                                        console.log('[Water] Loading screen removed');
                                    }
                                }, 500);
                            }
                        }, 500);
                    });
                    obs.observe(el, { childList: true });
                }
                else {
                    setTimeout(waitForInstructions, 100);
                }
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', waitForInstructions, { once: true });
            }
            else {
                waitForInstructions();
            }
            setTimeout(() => {
                const overlay = window.waterLoadingOverlay;
                if (overlay && overlay.parentNode) {
                    console.log('[Water] Loading screen timeout - removing');
                    overlay.style.opacity = '0';
                    setTimeout(() => {
                        if (overlay.parentNode)
                            overlay.parentNode.removeChild(overlay);
                    }, 500);
                }
            }, 12000);
        };
        if (document.documentElement) {
            injectLoader();
        }
        else {
            const observer = new MutationObserver(() => {
                if (document.documentElement) {
                    observer.disconnect();
                    injectLoader();
                }
            });
            observer.observe(document, { childList: true });
        }
    }
    else {
        console.log('[Water] Loading screen hidden by config');
    }
}
catch (e) {
    console.error('[Water] Failed to setup loading screen:', e);
}
class GamePreload extends preload_1.default {
    context = context_1.Context.Game;
    onLoadStart() {
        window.OffCliV = true;
        localStorage.removeItem('conUID_');
    }
    onLoadEnd() {
        window.clientExit.style.display = 'flex';
        window.closeClient = () => window.close();
        let style = document.createElement('style');
        style.textContent = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../assets/style/game.css'), 'utf8');
        document.head.append(style);
        injectWatermark();
        injectHSP();
    }
}
exports.default = GamePreload;
function injectWatermark() {
    let watermark = document.createElement('div');
    watermark.dataset.text = 'Water';
    watermark.id = 'clientWatermark';
    document
        .getElementById('matchInfo')
        .insertAdjacentElement('beforebegin', watermark);
    document.getElementById('timerHolder').style.cssText +=
        ';width:fit-content!important';
}
async function injectHSP() {
    await (0, util_1.waitFor)(() => window.windows?.[4] && window.windows[4].gen);
    const ogen = window.windows[4].gen;
    window.windows[4].gen = function () {
        setTimeout(() => {
            let statHolder = document.getElementById('statHolder');
            if (!statHolder)
                return;
            let stats = statHolder.children[2].children;
            let hits = -1;
            let headshots = -1;
            let accuracyInd = -1;
            for (let i = 0; i < stats.length; i++) {
                let stat = stats[i];
                let statName = stat.childNodes[0].textContent;
                if (statName == 'Hits') {
                    hits = Number(stat.childNodes[1].textContent.replaceAll(',', ''));
                }
                else if (statName == 'Headshots') {
                    headshots = Number(stat.childNodes[1].textContent.replaceAll(',', ''));
                }
                else if (statName == 'Accuracy') {
                    accuracyInd = i;
                }
            }
            if (hits == -1 || headshots == -1 || accuracyInd == -1)
                return;
            let hsp = stats[0].cloneNode(true);
            hsp.childNodes[0].textContent = 'HS%';
            hsp.childNodes[1].textContent = (headshots / hits * 100).toFixed(2) + '%';
            statHolder.children[2].insertBefore(hsp, stats[accuracyInd + 1]);
        });
        return ogen.apply(this, arguments);
    };
}
