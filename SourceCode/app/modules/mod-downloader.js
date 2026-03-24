const { ipcRenderer } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');

class ModDownloader {
    constructor() {
        this.observer = null;
    }

    init() {
        this.scanCards();
        this.startObserver();
        console.log('[Water] Mod downloader initialized');
    }

    scanCards() {
        document.querySelectorAll('.mapListItem').forEach(card => {
            // Find the likes span (float:right, contains "likes" text)
            const likesSpan = card.querySelector('span[style*="float:right"]');
            if (!likesSpan) return;
            
            // Already injected?
            if (likesSpan.querySelector('.water-dl-btn')) return;

            // Extract mod URL from the Load button onclick
            const loadBtn = card.querySelector('.mapActionB[onclick*="loadUserMod"]');
            if (!loadBtn) return;
            
            const onclickStr = loadBtn.getAttribute('onclick') || '';
            const urlMatch = onclickStr.match(/loadUserMod\([^,]+,\s*"([^"]+)"/);
            if (!urlMatch) return;
            
            const modUrl = urlMatch[1];

            // Build download button (icon only, white)
            const dlBtn = document.createElement('span');
            dlBtn.className = 'water-dl-btn material-icons';
            dlBtn.title = 'Download mod';
            dlBtn.textContent = 'download';
            dlBtn.style.fontSize = '26px';
            dlBtn.style.color = '#ffffff';
            dlBtn.style.cursor = 'pointer';
            dlBtn.style.verticalAlign = 'middle';
            dlBtn.style.position = 'relative';
            dlBtn.style.top = '-4px';
            dlBtn.style.marginRight = '6px';
            dlBtn.style.userSelect = 'none';
            dlBtn.style.transition = 'color 0.2s';

            dlBtn.onclick = async (e) => {
                e.stopPropagation();
                if (dlBtn.dataset.downloading) return;
                
                dlBtn.dataset.downloading = '1';
                dlBtn.style.color = '#ff9800'; // orange = downloading

                try {
                    const fileName = modUrl.split('/').pop() || 'mod.zip';
                    const destPath = path.join(os.homedir(), 'Downloads', fileName);

                    const resp = await fetch(modUrl);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    
                    const buf = await resp.arrayBuffer();
                    fs.writeFileSync(destPath, Buffer.from(buf));

                    dlBtn.style.color = '#4caf50'; // green = done
                    dlBtn.title = `Saved to Downloads/${fileName}`;
                    console.log('[Water] Mod downloaded to', destPath);

                    // Show in folder via IPC
                    try { 
                        ipcRenderer.invoke('shell-show-item', destPath); 
                    } catch (_) {}
                } catch (err) {
                    dlBtn.style.color = '#f44336'; // red = error
                    dlBtn.title = 'Download failed: ' + err.message;
                    console.error('[Water] Mod download error:', err);
                } finally {
                    delete dlBtn.dataset.downloading;
                }
            };

            // Insert as first child of the likes span (left of the number)
            likesSpan.insertBefore(dlBtn, likesSpan.firstChild);
        });
    }

    startObserver() {
        // Observe DOM for mod cards being added (Krunker loads them dynamically)
        if (this.observer) {
            this.observer.disconnect();
        }
        
        this.observer = new MutationObserver(() => this.scanCards());
        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

module.exports = ModDownloader;
