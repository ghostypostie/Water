const CSSLoader = require('./css-loader');
const path = require('path');
const fs = require('fs');

class CommunityCSSAddon {
    constructor() {
        this.cssLoader = new CSSLoader();
        this.initialized = false;
    }

    async init() {
        try {
            await this.cssLoader.init();
            console.log('[CommunityCSSAddon] CSS Loader initialized');
            // Apply saved UI toggles on startup
            this.applyUIToggles();
        } catch (e) {
            console.error('[CommunityCSSAddon] CSS Loader init error:', e);
        }
    }

    injectSidebarItem() {
        try {
            const menuContainer = document.getElementById('menuItemContainer');
            if (!menuContainer) {
                console.log('[CommunityCSSAddon] menuItemContainer not found yet');
                return false;
            }

            if (document.getElementById('communityCSSBtn')) {
                return true;
            }

            const btn = document.createElement('div');
            btn.id = 'communityCSSBtn';
            btn.className = 'menuItem';
            btn.setAttribute('onmouseenter', 'playTick()');
            btn.onclick = () => {
                if (typeof window.playSelect === 'function') window.playSelect();
                this.openWaterWindow();
            };

            btn.innerHTML = `
                <span class="material-icons-outlined menBtnIcn" style="color:#ff69b4">water_drop</span>
                <div class="menuItemTitle">Water</div>
            `;

            const firstItem = menuContainer.firstChild;
            if (firstItem) {
                menuContainer.insertBefore(btn, firstItem);
            } else {
                menuContainer.appendChild(btn);
            }

            console.log('[CommunityCSSAddon] Button injected successfully');
            return true;
        } catch (e) {
            console.error('[CommunityCSSAddon] Inject error:', e);
            return false;
        }
    }

    openWaterWindow() {
        try {
            let overlay = document.getElementById('waterOverlay');

            if (overlay) {
                // Toggle
                const isHidden = overlay.style.display === 'none';
                overlay.style.display = isHidden ? 'block' : 'none';
                document.getElementById('waterThemesWindow').style.display = isHidden ? 'block' : 'none';
                document.getElementById('waterCustomizationsWindow').style.display = isHidden ? 'block' : 'none';
                return;
            }

            // First time - inject CSS
            if (!document.getElementById('water-styles')) {
                const style = document.createElement('style');
                style.id = 'water-styles';
                style.textContent = `
                    #waterOverlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.75);
                        z-index: 1000000;
                        display: block;
                    }
                    .waterWindow {
                        position: fixed;
                        top: 50%;
                        transform: translateY(-50%);
                        z-index: 1000001;
                        width: 650px;
                        max-width: 45%;
                        max-height: 85vh;
                        background-color: #353535;
                        border-radius: 6px;
                        padding: 0;
                        overflow: hidden;
                        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                        display: block;
                    }
                    .waterWindow-left {
                        left: calc(50% - 680px);
                    }
                    .waterWindow-right {
                        right: calc(50% - 680px);
                    }
                    .waterWindowHeader {
                        background-color: rgba(0, 0, 0, 0.2);
                        padding: 15px 20px;
                        font-size: 20px;
                        color: #fff;
                        font-weight: bold;
                    }
                    .waterWindowContent {
                        padding: 10px 20px 20px 20px;
                        max-height: calc(85vh - 60px);
                        overflow-y: auto;
                    }
                    .theme-item, .script-item {
                        background: rgba(255, 255, 255, 0.05);
                        padding: 12px 15px;
                        margin: 8px 0;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s;
                        border: 1px solid transparent;
                    }
                    .theme-item:hover {
                        background: rgba(255, 255, 255, 0.1);
                        border-color: rgba(255, 255, 255, 0.2);
                    }
                    .script-item {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        cursor: default;
                    }
                    .script-item:hover {
                        background: rgba(255, 255, 255, 0.08);
                    }
                    .script-name {
                        font-size: 18px;
                        color: rgba(255, 255, 255, 0.8);
                    }
                    .setHedS {
                        margin-top: 5px;
                    }
                    .setBodH {
                        margin-bottom: 30px;
                    }
                    .no-items-msg {
                        color: rgba(255, 255, 255, 0.5);
                        font-size: 16px;
                        text-align: center;
                        padding: 20px;
                    }
                `;
                document.head.appendChild(style);
            }

            // Create overlay
            overlay = document.createElement('div');
            overlay.id = 'waterOverlay';
            overlay.onclick = (e) => {
                // Only close if clicking the overlay itself, not the windows
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                    document.getElementById('waterThemesWindow').style.display = 'none';
                    document.getElementById('waterCustomizationsWindow').style.display = 'none';
                }
            };
            document.body.appendChild(overlay);

            // Create Themes window
            const themesWindow = document.createElement('div');
            themesWindow.id = 'waterThemesWindow';
            themesWindow.className = 'waterWindow waterWindow-left';
            themesWindow.innerHTML = `
                <div class="waterWindowHeader">Themes</div>
                <div class="waterWindowContent">
                    <div class="setHedS">Available Themes</div>
                    <div class="setBodH">
                        <div id="water-themes-list"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(themesWindow);

            // Create Customizations window
            const customizationsWindow = document.createElement('div');
            customizationsWindow.id = 'waterCustomizationsWindow';
            customizationsWindow.className = 'waterWindow waterWindow-right';
            customizationsWindow.innerHTML = `
                <div class="waterWindowHeader">Customizations</div>
                <div class="waterWindowContent">
                    <div class="setHedS">Scripts</div>
                    <div class="setBodH">
                        <div id="water-scripts-list"></div>
                    </div>
                    <div class="setHedS">UI</div>
                    <div class="setBodH">
                        <div id="water-ui-list"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(customizationsWindow);

            this.renderThemes();
            this.renderScripts();
            this.renderUIToggles();
        } catch (e) {
            console.error('[CommunityCSSAddon] Water window error:', e);
        }
    }

    renderThemes() {
        try {
            const list = document.getElementById('water-themes-list');
            if (!list) return;

            const themes = this.cssLoader.getManifest();
            if (themes.length === 0) {
                list.innerHTML = '<div class="no-items-msg">No themes available.</div>';
                return;
            }

            list.innerHTML = themes.map(t => `
                <div class="theme-item" onclick="window.applyTheme('${t.id}')">
                    <div class="script-name">${t.name}</div>
                    <div style="font-size: 14px; color: rgba(255, 255, 255, 0.5); margin-top: 4px;">By ${t.author}</div>
                </div>
            `).join('');

            window.applyTheme = (id) => this.cssLoader.applyCSS(id);
        } catch (e) {
            console.error('[CommunityCSSAddon] Render themes error:', e);
            const list = document.getElementById('water-themes-list');
            if (list) list.innerHTML = `<div class="no-items-msg" style="color: #ff5555">Error: ${e.message}</div>`;
        }
    }

    renderScripts() {
        try {
            const list = document.getElementById('water-scripts-list');
            if (!list) return;

            const fs = require('fs');
            const path = require('path');
            const { app } = require('electron').remote || require('@electron/remote');

            const scriptsPath = path.join(app.getPath('documents'), 'Water', 'Scripts');

            // Ensure directory exists
            if (!fs.existsSync(scriptsPath)) {
                list.innerHTML = '<div class="no-items-msg">No scripts directory found. Create: Documents\\Water\\Scripts</div>';
                return;
            }

            // Read all .js files
            const files = fs.readdirSync(scriptsPath)
                .filter(f => f.endsWith('.js'))
                .sort();

            if (files.length === 0) {
                list.innerHTML = '<div class="no-items-msg">No scripts found. Place .js files in Documents\\Water\\Scripts</div>';
                return;
            }

            list.innerHTML = files.map(filename => {
                const scriptId = filename.replace('.js', '');
                const savedState = localStorage.getItem(`water-script-${scriptId}`);
                // Default to enabled if no setting exists
                const isEnabled = savedState === null ? true : savedState === 'true';

                return `
                    <div class="settNameSmall script-item">
                        <span class="script-name">${filename}</span>
                        <label class="switch" style="margin-left: 10px;">
                            <input type="checkbox" id="water-script-${scriptId}" 
                                   ${isEnabled ? 'checked' : ''} 
                                   onchange="window.toggleWaterScript('${scriptId}', this.checked)">
                            <span class="slider"><span class="grooves"></span></span>
                        </label>
                    </div>
                `;
            }).join('');

            // Define toggle function
            window.toggleWaterScript = (scriptId, enabled) => {
                localStorage.setItem(`water-script-${scriptId}`, enabled.toString());
                console.log(`[Water] Script ${scriptId}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
                console.log('[Water] Restart client to apply script changes');
            };
        } catch (e) {
            console.error('[CommunityCSSAddon] Render scripts error:', e);
            const list = document.getElementById('water-scripts-list');
            if (list) list.innerHTML = `<div class="no-items-msg" style="color: #ff5555">Error: ${e.message}</div>`;
        }
    }

    getUIToggles() {
        return [
            { id: 'hideAds', name: 'Hide ADs', css: '#mainLogo, #topRightAdHolder, #aHolder, #endAContainer, #bubbleContainer, #homeStoreAd, #newUserGuide, #doubleRaidDropsAd, #battlepassAd, #updateAd, #mainLogoFace, #seasonLabel, #doubleXPHolder, .webpush-container, #krDiscountAd, #surveyAd {display: none !important;}', defaultOn: false },
            { id: 'hideTermsInfo', name: 'Hide Terms Info', css: '#termsInfo {display: none;}', defaultOn: false },
            { id: 'hideSignupAlerts', name: 'Hide Signup Alerts', css: '#signupRewardsButton, .signup-rewards-container, .guest-earned-collect, #notificationCenter {display: none !important;}', defaultOn: true },
            { id: 'hideLoadingSpinner', name: 'Hide Loading Spinner', css: '', defaultOn: true, isClientSetting: true },
            { id: 'hideSocial', name: 'Hide Social & Trading Button', css: '.menuItem:nth-child(5) {display: none;}', defaultOn: false },
            { id: 'hideCommunity', name: 'Hide Community Button', css: '.menuItem:nth-child(6) {display: none;}', defaultOn: false },
            { id: 'hideGames', name: 'Hide Games Button', css: '.menuItem:nth-child(7) {display: none;}', defaultOn: false },
            { id: 'hideStream', name: 'Hide Old & New Stream Container', css: '#streamContainer, #streamContainerNew {display: none !important;}', defaultOn: false },
            { id: 'hideQuickMatch', name: 'Hide Quick Match Button', css: '#menuBtnQuickMatch {display: none !important;}', defaultOn: true }
        ];
    }

    applyUIToggles() {
        try {
            const uiToggles = this.getUIToggles();
            uiToggles.forEach(toggle => {
                const savedState = localStorage.getItem(`water-ui-${toggle.id}`);
                const shouldApply = savedState !== null ? savedState === 'true' : toggle.defaultOn;

                if (shouldApply) {
                    // Handle CSS-based toggles
                    const styleId = `water-ui-style-${toggle.id}`;
                    let styleElement = document.getElementById(styleId);
                    if (!styleElement) {
                        styleElement = document.createElement('style');
                        styleElement.id = styleId;
                        styleElement.textContent = toggle.css;
                        document.head.appendChild(styleElement);
                    }
                }
            });
            console.log('[CommunityCSSAddon] UI toggles applied on startup');
        } catch (e) {
            console.error('[CommunityCSSAddon] Apply UI toggles error:', e);
        }
    }

    renderUIToggles() {
        try {
            const list = document.getElementById('water-ui-list');
            if (!list) return;

            const uiToggles = this.getUIToggles();

            list.innerHTML = uiToggles.map(toggle => {
                let isChecked = toggle.defaultOn;
                try {
                    const savedState = localStorage.getItem(`water-ui-${toggle.id}`);
                    if (savedState !== null) isChecked = savedState === 'true';
                } catch (e) {
                    console.warn('[Water] localStorage access failed:', e);
                }

                return `
                    <div class="settNameSmall script-item">
                        <span class="script-name">${toggle.name}</span>
                        <label class="switch" style="margin-left: 10px;">
                            <input type="checkbox" id="water-ui-${toggle.id}" ${isChecked ? 'checked' : ''} onchange="window.toggleWaterUI('${toggle.id}', this.checked)">
                            <span class="slider"><span class="grooves"></span></span>
                        </label>
                    </div>
                `;
            }).join('');

            // Define the toggle function globally
            window.toggleWaterUI = (toggleId, enabled) => {
                const toggle = this.getUIToggles().find(t => t.id === toggleId);
                if (!toggle) return;

                // Handle CSS-based toggles
                const styleId = `water-ui-style-${toggleId}`;
                let styleElement = document.getElementById(styleId);

                if (enabled) {
                    if (!styleElement) {
                        styleElement = document.createElement('style');
                        styleElement.id = styleId;
                        styleElement.textContent = toggle.css;
                        document.head.appendChild(styleElement);
                    }
                } else {
                    if (styleElement) {
                        styleElement.remove();
                    }
                }

                localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                console.log(`[Water] UI toggle ${toggle.name}: ${enabled ? 'ON' : 'OFF'}`);
            };
        } catch (e) {
            console.error('[CommunityCSSAddon] Render UI toggles error:', e);
            const list = document.getElementById('water-ui-list');
            if (list) list.innerHTML = `<div class="no-items-msg" style="color: #ff5555">Error: ${e.message}</div>`;
        }
    }


}

const instance = new CommunityCSSAddon();

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            instance.init();
            if (!instance.injectSidebarItem()) {
                const util = require('./util-manager');
                if (util && util.instance && util.instance.clientUtils) {
                    util.instance.clientUtils.events.on('game-load', () => {
                        setTimeout(() => instance.injectSidebarItem(), 500);
                    });
                }
            }
        });
    } else {
        instance.init();
        setTimeout(() => instance.injectSidebarItem(), 500);
    }
}

module.exports = instance;
