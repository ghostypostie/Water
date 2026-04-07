import Module from '../module';
import { Context, RunAt } from '../context';
import Checkbox from '../options/checkbox';
import Dropdown from '../options/dropdown';
import { ipcMain, ipcRenderer } from 'electron';

export default class Ranked extends Module {
    name = 'Ranked';
    id = 'ranked';

    options = [
        new Checkbox(this, {
            name: 'Auto-Focus on Match Found',
            description: 'Automatically brings the game window to focus when a ranked match is found',
            id: 'autoFocus',
            defaultValue: true,
            needsRestart: true,
        }),
        new Dropdown(this, {
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
            context: Context.Common,
            runAt: RunAt.LoadStart,
        },
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        },
    ];

    private matchFoundTriggered = false;
    private isReady = false;

    main() {
        let { window: mainWindow } = require('../main');

        const focusGameWindow = () => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
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

        ipcMain.on('ranked-match-found', () => {
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
                if (!isReady || matchFoundTriggered) return;
                matchFoundTriggered = true;
                console.log('[Water] pop_3.mp3 detected - ranked match found');

                ipcRenderer.send('ranked-match-found');

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
                            if (
                                (window as any).selectClass &&
                                typeof (window as any).selectClass === 'function'
                            ) {
                                (window as any).selectClass(classNum);
                                console.log(`[Water] Insta-locked class ${classNum}`);
                            } else {
                                console.log('[Water] selectClass function not available');
                            }
                        } else {
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

            (window as any).waterHandleMatchFound = handleMatchFound;

            const originalXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
                if (typeof url === 'string' && url.indexOf('pop_3.mp3') !== -1) {
                    setTimeout(
                        () =>
                            (window as any).waterHandleMatchFound &&
                            (window as any).waterHandleMatchFound(),
                        100
                    );
                }
                return originalXHROpen.call(this, method, url, ...rest);
            };

            const originalFetch = window.fetch;
            window.fetch = function (...args: any[]) {
                const url = args[0];
                if (typeof url === 'string' && url.indexOf('pop_3.mp3') !== -1) {
                    setTimeout(
                        () =>
                            (window as any).waterHandleMatchFound &&
                            (window as any).waterHandleMatchFound(),
                        100
                    );
                }
                return originalFetch.apply(this, args);
            };

            const originalPlay = HTMLAudioElement.prototype.play;
            HTMLAudioElement.prototype.play = function () {
                const src = this.src || this.currentSrc || '';
                if (src && src.indexOf('pop_3.mp3') !== -1) {
                    handleMatchFound();
                }
                return originalPlay.apply(this, arguments as any);
            };

            console.log('[Water] Ranked match auto-focus enabled');
        } catch (e) {
            console.error('[Water] Failed to initialize ranked match auto-focus:', e);
        }
    }
}
