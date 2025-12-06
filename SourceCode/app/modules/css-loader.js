const fs = require('fs');
const path = require('path');

class CSSLoader {
    constructor() {
        this.manifestPath = path.join(__dirname, '../assets/community-css/manifest.json');
        this.themesPath = path.join(__dirname, '../assets/community-css/themes');

        // User CSS directory
        try {
            const { app } = require('electron').remote || require('@electron/remote');
            this.userCSSPath = path.join(app.getPath('documents'), 'Water', 'Swap', 'css');
        } catch (e) {
            console.error('[CSSLoader] Failed to get user CSS path:', e);
            this.userCSSPath = null;
        }

        this.activeStyle = null;
        this.activeThemeId = localStorage.getItem('water-active-theme') || null;
    }

    async init() {
        if (!fs.existsSync(this.manifestPath)) {
            // Create default manifest if not exists
            fs.writeFileSync(this.manifestPath, JSON.stringify([], null, 2));
        }

        // Ensure user CSS directory exists
        if (this.userCSSPath) {
            try {
                if (!fs.existsSync(this.userCSSPath)) {
                    fs.mkdirSync(this.userCSSPath, { recursive: true });
                    console.log('[CSSLoader] Created user CSS directory:', this.userCSSPath);
                }
            } catch (e) {
                console.error('[CSSLoader] Failed to create user CSS directory:', e);
            }
        }

        // Auto-apply saved theme on startup
        if (this.activeThemeId && this.activeThemeId !== 'default') {
            await this.applyCSS(this.activeThemeId);
        }
    }

    getManifest() {
        try {
            const data = fs.readFileSync(this.manifestPath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error('[CSSLoader] Failed to load manifest:', e);
            return [];
        }
    }

    getUserCSSFiles() {
        if (!this.userCSSPath) return [];

        try {
            if (!fs.existsSync(this.userCSSPath)) {
                fs.mkdirSync(this.userCSSPath, { recursive: true });
                return [];
            }

            const files = fs.readdirSync(this.userCSSPath);
            return files
                .filter(f => f.endsWith('.css'))
                .map(filename => ({
                    id: `user-${filename}`,
                    name: filename.replace('.css', ''),
                    filename: filename,
                    filePath: path.join(this.userCSSPath, filename),
                    author: 'You',
                    isUserCSS: true
                }));
        } catch (e) {
            console.error('[CSSLoader] Failed to load user CSS files:', e);
            return [];
        }
    }

    async applyCSS(cssId) {
        try {
            // Handle "default" - clear all CSS
            if (cssId === 'default') {
                this.resetCSS();
                this.activeThemeId = 'default';
                localStorage.setItem('water-active-theme', 'default');
                console.log('[CSSLoader] Reset to default (no CSS)');
                return;
            }

            let cssContent = '';
            let cssPath = '';
            let themeName = cssId;

            // User CSS or built-in theme?
            if (cssId.startsWith('user-')) {
                const filename = cssId.replace('user-', '');
                cssPath = path.join(this.userCSSPath, filename);
                themeName = filename;
            } else {
                const manifest = this.getManifest();
                const theme = manifest.find(t => t.id === cssId);
                if (!theme) {
                    console.warn('[CSSLoader] Theme not found:', cssId);
                    return;
                }
                cssPath = path.join(this.themesPath, theme.filename);
                themeName = theme.name;
            }

            if (fs.existsSync(cssPath)) {
                cssContent = fs.readFileSync(cssPath, 'utf8');

                if (!this.activeStyle) {
                    this.activeStyle = document.createElement('style');
                    this.activeStyle.id = 'water-community-css';
                    // Wait for document.head to be available
                    if (document.head) {
                        document.head.appendChild(this.activeStyle);
                    } else {
                        // Defer until DOM is ready
                        const waitForHead = setInterval(() => {
                            if (document.head) {
                                clearInterval(waitForHead);
                                document.head.appendChild(this.activeStyle);
                            }
                        }, 10);
                    }
                }

                this.activeStyle.textContent = cssContent;
                this.activeThemeId = cssId;
                localStorage.setItem('water-active-theme', cssId);
                console.log(`[CSSLoader] Applied theme: ${themeName}`);
            } else {
                console.error('[CSSLoader] CSS file not found:', cssPath);
            }
        } catch (e) {
            console.error('[CSSLoader] Failed to apply CSS:', e);
        }
    }

    resetCSS() {
        if (this.activeStyle) {
            this.activeStyle.textContent = '';
        }
        this.activeThemeId = 'default';
    }
}

module.exports = CSSLoader;
