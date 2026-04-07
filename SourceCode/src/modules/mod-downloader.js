"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modDownloader = exports.ModDownloader = void 0;
const electron_1 = require("electron");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
class ModDownloader {
    observer = null;
    lastScan = 0;
    scanThrottle = 500;
    injectedCards = new Set();
    lastNoButtonsLog = 0;
    init() {
        console.log('[Water] Mod downloader init called');
        window.waterModDownloader = this;
        this.watchModsWindow();
        this.startObserver();
        console.log('[Water] Mod downloader initialized');
    }
    watchModsWindow() {
        if (typeof window.showWindow === 'function') {
            const originalShowWindow = window.showWindow;
            window.showWindow = (...args) => {
                const result = originalShowWindow.apply(this, args);
                if (args[0] === 4) {
                    console.log('[Water] Mods window opened via showWindow(4)');
                    setTimeout(() => {
                        console.log('[Water] Triggering mod card scan after window open');
                        if (window.waterModDownloader) {
                            window.waterModDownloader.scanCards();
                        }
                    }, 300);
                }
                return result;
            };
        }
        if (window.windows && window.windows[4]) {
            const modsWindow = window.windows[4];
            let wasShowing = false;
            setInterval(() => {
                const isShowing = modsWindow.showing || modsWindow.visible || modsWindow.isOpen;
                if (isShowing && !wasShowing) {
                    console.log('[Water] Mods window became visible');
                    setTimeout(() => {
                        if (window.waterModDownloader) {
                            window.waterModDownloader.scanCards();
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
            let card = btn.parentElement;
            let attempts = 0;
            while (card && attempts < 5) {
                const children = card.children;
                const width = card.offsetWidth;
                const height = card.offsetHeight;
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
            if (card.offsetWidth > 700 || card.offsetHeight > 700) {
                if (index < 3) {
                    console.log(`[Water] Card too large, skipping`);
                }
                return;
            }
            if (this.injectedCards.has(card)) {
                return;
            }
            if (this.injectDownloadButton(card, btn)) {
                this.injectedCards.add(card);
                newInjections++;
            }
        });
        if (newInjections > 0) {
            console.log(`[Water] Successfully injected ${newInjections} download buttons`);
        }
    }
    injectDownloadButton(card, loadBtn) {
        if (card.querySelector('.water-dl-btn')) {
            return false;
        }
        try {
            let modUrl = null;
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
            let likesSpan = card.querySelector('span[style*="float:right"]');
            if (!likesSpan) {
                const spans = card.querySelectorAll('span');
                for (const span of spans) {
                    const text = span.textContent;
                    if (text && (text.includes('likes') || text.includes('like') || text.match(/\d+\s*$/))) {
                        likesSpan = span;
                        break;
                    }
                }
            }
            if (!likesSpan) {
                const spans = Array.from(card.querySelectorAll('span'));
                if (spans.length > 0) {
                    likesSpan = spans.reverse().find(s => !s.classList.contains('material-icons')) || null;
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
                if (dlBtn.dataset.downloading)
                    return;
                dlBtn.dataset.downloading = '1';
                dlBtn.style.color = '#ff9800';
                try {
                    const fileName = 'mod.zip';
                    const destPath = (0, path_1.join)((0, os_1.homedir)(), 'Downloads', fileName);
                    const resp = await fetch(modUrl);
                    if (!resp.ok)
                        throw new Error(`HTTP ${resp.status}`);
                    const buf = await resp.arrayBuffer();
                    (0, fs_1.writeFileSync)(destPath, Buffer.from(buf));
                    dlBtn.style.color = '#4caf50';
                    dlBtn.title = 'Downloaded to Downloads folder';
                    try {
                        await electron_1.ipcRenderer.invoke('shell-show-item', destPath);
                    }
                    catch (_) { }
                }
                catch (err) {
                    dlBtn.style.color = '#f44336';
                    dlBtn.title = 'Download failed: ' + err.message;
                }
                finally {
                    delete dlBtn.dataset.downloading;
                }
            };
            likesSpan.insertBefore(dlBtn, likesSpan.firstChild);
            return true;
        }
        catch (e) {
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
exports.ModDownloader = ModDownloader;
exports.modDownloader = new ModDownloader();
