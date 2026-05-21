import { Context } from '../context';
import Preload from './preload';
import { readFileSync } from 'fs';
import '../types/window';
import { join } from 'path';
import { branch, commit } from '../../buildinfo.json';
import { waitFor } from '../util';

// Only run loading screen on game window (not social, editor, etc.)
const isGameWindow = window.location.hostname === 'krunker.io' && window.location.pathname === '/';

try {
    const Store = require('electron-store');
    const loaderConfig = new Store();
    
    const localStorageValue = localStorage.getItem('water-ui-hideWaterLoader');
    const electronStoreValue = loaderConfig.get('hideWaterLoader', false);
    
    const hideLoadingScreen = localStorageValue !== null
        ? localStorageValue === 'true'
        : electronStoreValue;
    
    const customLoadingScreen = loaderConfig.get('modules.misc.customLoadingScreen', '') as string;

    console.log('[Water] localStorage hideWaterLoader:', localStorageValue);
    console.log('[Water] electron-store hideWaterLoader:', electronStoreValue);
    console.log('[Water] Final hideLoadingScreen:', hideLoadingScreen);
    console.log('[Water] customLoadingScreen:', customLoadingScreen || 'none');
    console.log('[Water] isGameWindow:', isGameWindow);

    if (!hideLoadingScreen && isGameWindow) {
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
            } else {
                loaderOverlay.innerHTML = `<span class="waterLoader"></span>`;
            }

            (document.body || document.documentElement).appendChild(loaderOverlay);
            (window as any).waterLoadingOverlay = loaderOverlay;

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
                            const overlay = (window as any).waterLoadingOverlay;
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
                } else {
                    setTimeout(waitForInstructions, 100);
                }
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', waitForInstructions, { once: true });
            } else {
                waitForInstructions();
            }

            setTimeout(() => {
                const overlay = (window as any).waterLoadingOverlay;
                if (overlay && overlay.parentNode) {
                    console.log('[Water] Loading screen timeout - removing');
                    overlay.style.opacity = '0';
                    setTimeout(() => {
                        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    }, 500);
                }
            }, 12000);
        };

        if (document.documentElement) {
            injectLoader();
        } else {
            const observer = new MutationObserver(() => {
                if (document.documentElement) {
                    observer.disconnect();
                    injectLoader();
                }
            });
            observer.observe(document, { childList: true });
        }
    } else if (!isGameWindow) {
        console.log('[Water] Skipping loading screen - not on game window (pathname:', window.location.pathname + ')');
    } else {
        console.log('[Water] Loading screen hidden by config');
    }
} catch (e) {
    console.error('[Water] Failed to setup loading screen:', e);
}

export default class GamePreload extends Preload {
    context = Context.Game;

    onLoadStart() {
        window.OffCliV = true;
        localStorage.removeItem('conUID_');
        
        // Apply remove animations if enabled
        this.applyRemoveAnimations();
    }

    onLoadEnd() {
        window.clientExit.style.display = 'flex';
        window.closeClient = () => window.close();

        // Inject game.css with mutation observer to ensure it always overrides
        const style = document.createElement('style');
        style.id = 'water-game-css';
        style.textContent = readFileSync(
            join(__dirname, '../../assets/style/game.css'),
            'utf8'
        );
        document.head.append(style);

        // Observe new style/link elements and keep our CSS last
        const observer = new MutationObserver(() => {
            if (document.head.lastChild !== style) {
                document.head.appendChild(style);
            }
        });
        observer.observe(document.head, { childList: true, subtree: true });

        injectWatermark();
        injectHSP();
        
        // Apply runtime performance optimizations
        this.applyRuntimeOptimizations();
    }
    
    applyRemoveAnimations() {
        try {
            const Store = require('electron-store');
            const config = new Store();
            const removeAnimations = config.get('modules.performance.removeAnimations', false);
            
            if (removeAnimations) {
                console.log('[Water] Removing animations...');
                const style = document.createElement('style');
                style.id = 'water-no-animations';
                style.textContent = `
                    * :not(#waterLoadingOverlay):not(#waterLoadingOverlay *) {
                        animation: none !important;
                        transition: none !important;
                    }
                `;
                (document.head || document.documentElement).appendChild(style);
                console.log('[Water] Animations removed');
            }
        } catch (e) {
            console.error('[Water] Failed to apply remove animations:', e);
        }
    }
    
    applyRuntimeOptimizations() {
        try {
            const Store = require('electron-store');
            const config = new Store();
            const enablePerformanceOptimizations = config.get('modules.performance.enablePerformanceOptimizations', true);
            
            if (!enablePerformanceOptimizations) {
                console.log('[Water] Performance optimizations disabled');
                return;
            }
            
            console.log('[Water] Applying runtime performance optimizations...');
            
            // Keep-Alive / Anti-Throttling
            this.setupKeepAlive();
            
            // Post-Match Garbage Collection
            this.setupPostMatchGC();
            
            // Raw Mouse Input
            this.setupRawMouseInput();
            
            console.log('[Water] Runtime optimizations applied');
        } catch (e) {
            console.error('[Water] Failed to apply runtime optimizations:', e);
        }
    }
    
    setupKeepAlive() {
        // Override document.hidden and visibilityState (zero overhead)
        Object.defineProperty(document, 'hidden', {
            get: () => false,
            configurable: true
        });
        
        Object.defineProperty(document, 'visibilityState', {
            get: () => 'visible',
            configurable: true
        });
        
        // Create hidden 1x1 canvas (minimal memory footprint)
        const keepAliveCanvas = document.createElement('canvas');
        keepAliveCanvas.width = 1;
        keepAliveCanvas.height = 1;
        keepAliveCanvas.style.cssText = 'position:fixed;top:-10px;left:-10px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-9999';
        document.body.appendChild(keepAliveCanvas);
        
        const ctx = keepAliveCanvas.getContext('2d', { 
            alpha: false,  // Disable alpha channel for better performance
            desynchronized: true  // Allow desynchronized rendering
        });
        
        // Optimized keep-alive loop - only renders when needed
        let lastRender = 0;
        const keepAlive = (timestamp: number) => {
            // Throttle to max 30 FPS (sufficient to prevent throttling)
            if (timestamp - lastRender >= 33) {
                if (ctx) {
                    ctx.fillRect(0, 0, 1, 1);  // Single operation, no clear needed
                }
                lastRender = timestamp;
            }
            requestAnimationFrame(keepAlive);
        };
        requestAnimationFrame(keepAlive);
        
        // Low-frequency empty interval (sufficient to prevent timer suspension)
        setInterval(() => {}, 100);  // Reduced from 16ms to 100ms
        
        console.log('[Water] Keep-alive system enabled (optimized)');
    }
    
    setupPostMatchGC() {
        // Lightweight state tracking without continuous observation
        let lastGameState = 'unknown';
        
        const checkGameState = () => {
            const uiBase = document.getElementById('uiBase');
            if (!uiBase) return;
            
            const onMenu = uiBase.classList.contains('onMenu');
            const onCompMenu = uiBase.classList.contains('onCompMenu');
            
            const currentState = (!onMenu && !onCompMenu) ? 'ingame' : 'menu';
            
            // Only trigger GC on state transition from ingame to menu
            if (lastGameState === 'ingame' && currentState === 'menu') {
                console.log('[Water] Match ended, scheduling GC...');
                setTimeout(() => {
                    if (typeof (global as any) !== 'undefined' && typeof (global as any).gc === 'function') {
                        (global as any).gc();
                        console.log('[Water] Post-match GC executed');
                    }
                }, 2000);
            }
            
            lastGameState = currentState;
        };
        
        // Use efficient MutationObserver with throttling
        const waitForUIBase = () => {
            const uiBase = document.getElementById('uiBase');
            if (uiBase) {
                let throttleTimeout: NodeJS.Timeout | null = null;
                
                const observer = new MutationObserver(() => {
                    // Throttle checks to max once per 500ms to reduce overhead
                    if (!throttleTimeout) {
                        throttleTimeout = setTimeout(() => {
                            checkGameState();
                            throttleTimeout = null;
                        }, 500);
                    }
                });
                
                observer.observe(uiBase, { 
                    attributes: true, 
                    attributeFilter: ['class']  // Only watch class changes
                });
                
                console.log('[Water] Post-match GC monitoring enabled (optimized)');
            } else {
                // Exponential backoff for polling
                setTimeout(waitForUIBase, 200);
            }
        };
        
        waitForUIBase();
    }
    
    setupRawMouseInput() {
        // Use passive event listener for better performance
        const applyRawMouse = () => {
            const gameCanvas = document.getElementById('gameCanvas');
            if (!gameCanvas) {
                console.warn('[Water] gameCanvas not found, raw mouse input not applied');
                return;
            }
            
            const originalRequestPointerLock = (gameCanvas as any).requestPointerLock;
            if (originalRequestPointerLock) {
                (gameCanvas as any).requestPointerLock = function() {
                    return originalRequestPointerLock.call(this, { unadjustedMovement: true });
                };
                console.log('[Water] Raw mouse input enabled');
            }
        };
        
        // Apply immediately if DOM is ready, otherwise wait efficiently
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyRawMouse, { once: true, passive: true });
        } else {
            applyRawMouse();
        }
    }
}

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
    await waitFor(() => window.windows?.[4] && window.windows[4].gen);

    const ogen = window.windows[4].gen;
    window.windows[4].gen = function () {
        setTimeout(() => {
            let statHolder = document.getElementById('statHolder');
            if (!statHolder) return;

            let stats = statHolder.children[2].children;

            let hits = -1;
            let headshots = -1;
            let accuracyInd = -1;

            for (let i = 0; i < stats.length; i++) {
                let stat = stats[i];
                let statName = stat.childNodes[0].textContent;

                if (statName == 'Hits') {
                    hits = Number(stat.childNodes[1].textContent.replaceAll(',', ''));
                } else if (statName == 'Headshots') {
                    headshots = Number(stat.childNodes[1].textContent.replaceAll(',', ''));
                } else if (statName == 'Accuracy') {
                    accuracyInd = i;
                }
            }

            if (hits == -1 || headshots == -1 || accuracyInd == -1) return;

            let hsp = stats[0].cloneNode(true);
            hsp.childNodes[0].textContent = 'HS%';
            hsp.childNodes[1].textContent = (headshots / hits * 100).toFixed(2) + '%';

            statHolder.children[2].insertBefore(hsp, stats[accuracyInd + 1]);
        });
        return ogen.apply(this, arguments);
    };
}
