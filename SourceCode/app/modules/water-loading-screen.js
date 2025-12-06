const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

class WaterLoadingScreen {
    constructor() {
        this.container = null;
        this.isHidden = false;
    }

    async init() {
        // Check if loading screen is disabled via UI toggle
        try {
            const hideLoadingSetting = localStorage.getItem('water-ui-hideLoadingScreen');
            if (hideLoadingSetting === 'true') {
                console.log('[WaterClient] Loading screen disabled via UI toggle');
                return; // Don't show loading screen
            }
        } catch (e) {
            console.warn('[Water] Failed to check loading screen setting:', e);
        }

        // Wait for DOM to be ready
        if (!document.body) {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Create loading screen container
        this.container = document.createElement('div');
        this.container.id = 'water-loading-overlay';

        // New HTML Structure - Pink Water Theme
        this.container.innerHTML = `
            <div class="bubbles">
                <div class="bubble"></div>
                <div class="bubble"></div>
                <div class="bubble"></div>
            </div>
            
            <div class="water-loader">
                <div class="wave"></div>
                <div class="wave"></div>
                <div class="water-drop">💧</div>
            </div>
        `;

        // Inject CSS (Inline)
        try {
            const cssPath = path.join(__dirname, '../styles/loading.css');
            const cssContent = fs.readFileSync(cssPath, 'utf8');
            const style = document.createElement('style');
            style.textContent = cssContent;
            document.head.appendChild(style);
        } catch (e) {
            console.error('[Water] Failed to inject loading CSS:', e);
        }

        // Add container to DOM
        document.body.appendChild(this.container);

        // Cleanup & Visibility
        // Remove anti-flash blocker
        const blocker = document.getElementById('water-flash-blocker');
        if (blocker) {
            blocker.remove();
            console.log('[WaterClient] Anti-flash blocker removed');
        }

        // Ensure visibility
        this.container.style.visibility = 'visible';

        // Signal game ready
        ipcRenderer.send('game-ready');
        console.log('[WaterClient] Game ready signal sent');
    }

    hide() {
        if (this.container && !this.isHidden) {
            this.isHidden = true;
            this.container.classList.add('hidden');

            // Remove from DOM after fade out
            setTimeout(() => {
                if (this.container && this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                }
            }, 500);
        }
    }
}

module.exports = WaterLoadingScreen;
