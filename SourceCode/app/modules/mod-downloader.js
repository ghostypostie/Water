const { ipcRenderer } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');

class ModDownloader {
    constructor() {
        this.observer = null;
        this.lastScan = 0;
        this.scanThrottle = 500; // Scan every 500ms max
        this.injectedCards = new Set();
        this.windowObserver = null;
        this.lastNoButtonsLog = 0; // Track last time we logged "no buttons"
    }

    init() {
        console.log('[Water] Mod downloader init called');
        
        // Store instance globally so watchModsWindow can access it
        window.waterModDownloader = this;
        
        // Watch for mods window to open
        this.watchModsWindow();
        
        // Start scanning
        this.startObserver();
        
        console.log('[Water] Mod downloader initialized');
    }

    watchModsWindow() {
        // Hook into showWindow to detect when mods window opens
        if (typeof window.showWindow === 'function') {
            const originalShowWindow = window.showWindow;
            window.showWindow = function(...args) {
                const result = originalShowWindow.apply(this, args);
                // Window 4 is the mods window
                if (args[0] === 4) {
                    console.log('[Water] Mods window opened via showWindow(4)');
                    // Wait for window to be fully rendered
                    setTimeout(() => {
                        console.log('[Water] Triggering mod card scan after window open');
                        // Force a scan
                        if (window.waterModDownloader) {
                            window.waterModDownloader.scanCards();
                        }
                    }, 300);
                }
                return result;
            };
        }

        // Also watch for window.windows[4].showing property changes
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
        // Throttle scanning
        const now = Date.now();
        if (now - this.lastScan < this.scanThrottle) {
            return;
        }
        this.lastScan = now;

        // Find all load buttons first, then get their parent containers
        const loadButtons = document.querySelectorAll('div[onclick*="loadUserMod"], div[onclick*="loadMod"]');
        
        if (loadButtons.length === 0) {
            // Only log once every 5 seconds to reduce spam
            if (!this.lastNoButtonsLog || now - this.lastNoButtonsLog > 5000) {
                console.log('[Water] No load buttons found in DOM');
                this.lastNoButtonsLog = now;
            }
            return;
        }

        console.log(`[Water] Found ${loadButtons.length} load buttons`);

        let newInjections = 0;
        let processed = 0;
        let skipped = 0;
        
        loadButtons.forEach((btn, index) => {
            // Get the parent card container - look for the immediate card, not the whole container
            let card = btn.parentElement;
            
            // Walk up the DOM tree to find the actual card container
            // Individual mod cards should be reasonably sized (not the entire window)
            let attempts = 0;
            while (card && attempts < 5) {
                const children = card.children;
                const width = card.offsetWidth;
                const height = card.offsetHeight;
                
                // Individual mod cards are typically 200-400px wide and 200-500px tall
                // Avoid selecting the entire mods container (which is 1400+ pixels)
                const isReasonableCardSize = width >= 150 && width <= 600 && height >= 150 && height <= 600;
                const hasMultipleChildren = children.length >= 3 && children.length <= 10;
                
                if (isReasonableCardSize && hasMultipleChildren) {
                    break; // Found the individual card
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
            
            // Skip if card is too large (entire container)
            if (card.offsetWidth > 700 || card.offsetHeight > 700) {
                if (index < 3) {
                    console.log(`[Water] Card too large (${card.offsetWidth}x${card.offsetHeight}), skipping`);
                }
                return;
            }
            
            // Skip if already processed
            if (this.injectedCards.has(card)) {
                skipped++;
                return;
            }
            
            processed++;
            
            if (index < 3) {
                console.log(`[Water] Processing card ${index + 1}: ${card.offsetWidth}x${card.offsetHeight}, children: ${card.children.length}`);
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
        // Already injected?
        if (card.querySelector('.water-dl-btn')) {
            return false;
        }

        try {
            // Extract mod URL from the load button
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

            // Find the likes span - try multiple methods
            let likesSpan = card.querySelector('span[style*="float:right"]');
            
            if (!likesSpan) {
                // Try finding by text content
                const spans = card.querySelectorAll('span');
                for (const span of spans) {
                    const text = span.textContent;
                    if (text.includes('likes') || text.includes('like') || text.match(/\d+\s*$/)) {
                        likesSpan = span;
                        break;
                    }
                }
            }
            
            if (!likesSpan) {
                // Try finding the bottom-right span (usually where likes are)
                const spans = Array.from(card.querySelectorAll('span'));
                if (spans.length > 0) {
                    // Get the last span that's not a material icon
                    likesSpan = spans.reverse().find(s => !s.classList.contains('material-icons'));
                }
            }
            
            if (!likesSpan) {
                return false;
            }

            // Build small download icon
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
                    const destPath = path.join(os.homedir(), 'Downloads', fileName);

                    const resp = await fetch(modUrl);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    
                    const buf = await resp.arrayBuffer();
                    fs.writeFileSync(destPath, Buffer.from(buf));

                    dlBtn.style.color = '#4caf50';
                    dlBtn.title = 'Downloaded to Downloads folder';

                    try { 
                        ipcRenderer.invoke('shell-show-item', destPath); 
                    } catch (_) {}
                } catch (err) {
                    dlBtn.style.color = '#f44336';
                    dlBtn.title = 'Download failed: ' + err.message;
                } finally {
                    delete dlBtn.dataset.downloading;
                }
            };

            // Insert before likes span content
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

module.exports = ModDownloader;
