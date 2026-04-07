import { ipcRenderer } from 'electron';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class ModDownloader {
    private observer: MutationObserver | null = null;
    private lastScan: number = 0;
    private scanThrottle: number = 500;
    private injectedCards: Set<Element> = new Set();
    private lastNoButtonsLog: number = 0;

    init() {
        console.log('[Water] Mod downloader init called');

        (window as any).waterModDownloader = this;

        this.watchModsWindow();

        this.startObserver();

        console.log('[Water] Mod downloader initialized');
    }

    watchModsWindow() {
        if (typeof (window as any).showWindow === 'function') {
            const originalShowWindow = (window as any).showWindow;
            (window as any).showWindow = (...args: any[]) => {
                const result = originalShowWindow.apply(this, args);
                if (args[0] === 4) {
                    console.log('[Water] Mods window opened via showWindow(4)');
                    setTimeout(() => {
                        console.log('[Water] Triggering mod card scan after window open');
                        if ((window as any).waterModDownloader) {
                            (window as any).waterModDownloader.scanCards();
                        }
                    }, 300);
                }
                return result;
            };
        }

        if ((window as any).windows && (window as any).windows[4]) {
            const modsWindow = (window as any).windows[4];
            let wasShowing = false;

            setInterval(() => {
                const isShowing = modsWindow.showing || modsWindow.visible || modsWindow.isOpen;
                if (isShowing && !wasShowing) {
                    console.log('[Water] Mods window became visible');
                    setTimeout(() => {
                        if ((window as any).waterModDownloader) {
                            (window as any).waterModDownloader.scanCards();
                        }
                    }, 300);
                }
                wasShowing = isShowing;
            }, 500);
        }
    }

    scanCards() {
        const now = Date.now();
        if (now - this.lastScan < this.scanThrottle) {
            return;
        }
        this.lastScan = now;

        const loadButtons = document.querySelectorAll('div[onclick*="loadUserMod"], div[onclick*="loadMod"]');

        if (loadButtons.length === 0) {
            // Silently skip if no load buttons found
            return;
        }

        console.log(`[Water] Found ${loadButtons.length} load buttons`);

        let newInjections = 0;

        loadButtons.forEach((btn, index) => {
            let card: Element | null = btn.parentElement;

            let attempts = 0;
            while (card && attempts < 5) {
                const children = card.children;
                const width = (card as HTMLElement).offsetWidth;
                const height = (card as HTMLElement).offsetHeight;

                const isReasonableCardSize = width >= 150 && width <= 600 && height >= 150 && height <= 600;
                const hasMultipleChildren = children.length >= 3 && children.length <= 10;

                if (isReasonableCardSize && hasMultipleChildren) {
                    break;
                }

                card = card.parentElement;
                attempts++;
            }

            if (!card) {
                if (index < 3) {
                    console.log(`[Water] Could not find parent card for button ${index + 1}`);
                }
                return;
            }

            if ((card as HTMLElement).offsetWidth > 700 || (card as HTMLElement).offsetHeight > 700) {
                if (index < 3) {
                    console.log(`[Water] Card too large, skipping`);
                }
                return;
            }

            if (this.injectedCards.has(card)) {
                return;
            }

            if (this.injectDownloadButton(card, btn as HTMLElement)) {
                this.injectedCards.add(card);
                newInjections++;
            }
        });

        if (newInjections > 0) {
            console.log(`[Water] Successfully injected ${newInjections} download buttons`);
        }
    }

    injectDownloadButton(card: Element, loadBtn: HTMLElement): boolean {
        if (card.querySelector('.water-dl-btn')) {
            return false;
        }

        try {
            let modUrl: string | null = null;

            if (loadBtn) {
                const onclickStr = loadBtn.getAttribute('onclick') || '';

                const urlMatch = onclickStr.match(/loadUserMod\([^,]+,\s*["']([^"']+)["']/) ||
                    onclickStr.match(/loadMod\([^,]+,\s*["']([^"']+)["']/) ||
                    onclickStr.match(/(https?:\/\/[^\s"']+\.zip)/);

                if (urlMatch) {
                    modUrl = urlMatch[1];
                }
            }

            if (!modUrl) {
                return false;
            }

            let likesSpan = card.querySelector('span[style*="float:right"]') as HTMLElement | null;

            if (!likesSpan) {
                const spans = card.querySelectorAll('span');
                for (const span of spans) {
                    const text = span.textContent;
                    if (text && (text.includes('likes') || text.includes('like') || text.match(/\d+\s*$/))) {
                        likesSpan = span as HTMLElement;
                        break;
                    }
                }
            }

            if (!likesSpan) {
                const spans = Array.from(card.querySelectorAll('span'));
                if (spans.length > 0) {
                    likesSpan = spans.reverse().find(s => !s.classList.contains('material-icons')) as HTMLElement | undefined || null;
                }
            }

            if (!likesSpan) {
                return false;
            }

            const dlBtn = document.createElement('span');
            dlBtn.className = 'water-dl-btn material-icons';
            dlBtn.title = 'Download mod to Downloads folder';
            dlBtn.textContent = 'download';
            dlBtn.style.cssText = 'font-size:26px;color:#ffffff;cursor:pointer;vertical-align:middle;position:relative;top:-4px;margin-right:6px;user-select:none;transition:color 0.2s;';

            dlBtn.onclick = async (e) => {
                e.stopPropagation();
                if (dlBtn.dataset.downloading) return;

                dlBtn.dataset.downloading = '1';
                dlBtn.style.color = '#ff9800';

                try {
                    const fileName = 'mod.zip';
                    const destPath = join(homedir(), 'Downloads', fileName);

                    const resp = await fetch(modUrl!);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                    const buf = await resp.arrayBuffer();
                    writeFileSync(destPath, Buffer.from(buf));

                    dlBtn.style.color = '#4caf50';
                    dlBtn.title = 'Downloaded to Downloads folder';

                    try {
                        await ipcRenderer.invoke('shell-show-item', destPath);
                    } catch (_) { }
                } catch (err: any) {
                    dlBtn.style.color = '#f44336';
                    dlBtn.title = 'Download failed: ' + err.message;
                } finally {
                    delete dlBtn.dataset.downloading;
                }
            };

            likesSpan.insertBefore(dlBtn, likesSpan.firstChild);

            return true;
        } catch (e) {
            return false;
        }
    }

    startObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver(() => {
            this.scanCards();
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
        console.log('[Water] Mod downloader observer started');
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.injectedCards.clear();
    }
}

export const modDownloader = new ModDownloader();
