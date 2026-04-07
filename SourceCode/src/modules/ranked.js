"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const module_1 = __importDefault(require("../module"));
const context_1 = require("../context");
const checkbox_1 = __importDefault(require("../options/checkbox"));
const dropdown_1 = __importDefault(require("../options/dropdown"));
const electron_1 = require("electron");
class Ranked extends module_1.default {
    name = 'Ranked';
    id = 'ranked';
    options = [
        new checkbox_1.default(this, {
            name: 'Auto-Focus on Match Found',
            description: 'Automatically brings the game window to focus when a ranked match is found',
            id: 'autoFocus',
            defaultValue: true,
            needsRestart: true,
        }),
        new dropdown_1.default(this, {
            name: 'Insta-Lock Class',
            description: 'Automatically select this class when a ranked match is found',
            id: 'instaLockClass',
            options: [
                { name: 'Disabled', value: '-1' },
                { name: 'Triggerman (Assault Rifle)', value: '0' },
                { name: 'Hunter (Sniper)', value: '1' },
                { name: 'Run N Gun (SMG)', value: '2' },
                { name: 'Spray N Pray (LMG)', value: '3' },
                { name: 'Detective (Revolver)', value: '5' },
                { name: 'Marksman (Semi)', value: '6' },
                { name: 'Agent (UZI)', value: '8' },
                { name: 'Commando (Famas)', value: '12' },
                { name: 'Trooper (Blaster)', value: '13' },
            ],
        }),
    ];
    contexts = [
        {
            context: context_1.Context.Common,
            runAt: context_1.RunAt.LoadStart,
        },
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadEnd,
        },
    ];
    matchFoundTriggered = false;
    isReady = false;
    main() {
        let { window: mainWindow } = require('../main');
        const focusGameWindow = () => {
            if (!mainWindow || mainWindow.isDestroyed())
                return;
            if (mainWindow.isMinimized())
                mainWindow.restore();
            if (!mainWindow.isVisible())
                mainWindow.show();
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            mainWindow.focus();
            mainWindow.moveTop();
            mainWindow.flashFrame(true);
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.flashFrame(false);
                    mainWindow.setAlwaysOnTop(false);
                }
            }, 2000);
        };
        electron_1.ipcMain.on('ranked-match-found', () => {
            console.log('[Water] Ranked match found');
            focusGameWindow();
            // Windows notification removed per user request
        });
    }
    renderer() {
        if (!this.config.get('autoFocus', true)) {
            console.log('[Water] Ranked auto-focus disabled');
            return;
        }
        try {
            let matchFoundTriggered = false;
            let isReady = false;
            setTimeout(() => {
                isReady = true;
                console.log('[Water] Ranked match detection now active');
            }, 5000);
            const handleMatchFound = () => {
                if (!isReady || matchFoundTriggered)
                    return;
                matchFoundTriggered = true;
                console.log('[Water] pop_3.mp3 detected - ranked match found');
                electron_1.ipcRenderer.send('ranked-match-found');
                const instaLockClass = this.config.get('instaLockClass', '-1');
                if (instaLockClass !== '-1' && instaLockClass !== -1) {
                    const classNum = parseInt(instaLockClass);
                    let attempts = 0;
                    const maxAttempts = 500;
                    const waitForClassSelection = () => {
                        if (attempts++ > maxAttempts) {
                            console.log('[Water] Class selection timeout');
                            return;
                        }
                        const uiBase = document.getElementById('uiBase');
                        if (uiBase && uiBase.classList.contains('onCompMenu')) {
                            if (window.selectClass &&
                                typeof window.selectClass === 'function') {
                                window.selectClass(classNum);
                                console.log(`[Water] Insta-locked class ${classNum}`);
                            }
                            else {
                                console.log('[Water] selectClass function not available');
                            }
                        }
                        else {
                            setTimeout(waitForClassSelection, 10);
                        }
                    };
                    waitForClassSelection();
                }
                setTimeout(() => {
                    matchFoundTriggered = false;
                    console.log('[Water] Ranked match trigger reset');
                }, 10000);
            };
            window.waterHandleMatchFound = handleMatchFound;
            const originalXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                if (typeof url === 'string' && url.indexOf('pop_3.mp3') !== -1) {
                    setTimeout(() => window.waterHandleMatchFound &&
                        window.waterHandleMatchFound(), 100);
                }
                return originalXHROpen.call(this, method, url, ...rest);
            };
            const originalFetch = window.fetch;
            window.fetch = function (...args) {
                const url = args[0];
                if (typeof url === 'string' && url.indexOf('pop_3.mp3') !== -1) {
                    setTimeout(() => window.waterHandleMatchFound &&
                        window.waterHandleMatchFound(), 100);
                }
                return originalFetch.apply(this, args);
            };
            const originalPlay = HTMLAudioElement.prototype.play;
            HTMLAudioElement.prototype.play = function () {
                const src = this.src || this.currentSrc || '';
                if (src && src.indexOf('pop_3.mp3') !== -1) {
                    handleMatchFound();
                }
                return originalPlay.apply(this, arguments);
            };
            console.log('[Water] Ranked match auto-focus enabled');
        }
        catch (e) {
            console.error('[Water] Failed to initialize ranked match auto-focus:', e);
        }
    }
}
exports.default = Ranked;
