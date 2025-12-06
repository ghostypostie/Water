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

            // Inject Mods button if enabled
            this.injectModsButton();

            return true;
        } catch (e) {
            console.error('[CommunityCSSAddon] Inject error:', e);
            return false;
        }
    }

    injectModsButton() {
        try {
            // Check if Mods button should be shown
            const savedState = localStorage.getItem('water-ui-showModsButton');
            const shouldShow = savedState !== null ? savedState === 'true' : true; // Default ON

            if (!shouldShow) {
                // Remove button if it exists and shouldn't be shown
                const existingBtn = document.getElementById('modsBtn');
                if (existingBtn) existingBtn.remove();
                return;
            }

            const menuContainer = document.getElementById('menuItemContainer');
            if (!menuContainer) return;

            // Don't inject if already exists
            if (document.getElementById('modsBtn')) return;

            const modsBtn = document.createElement('div');
            modsBtn.id = 'modsBtn';
            modsBtn.className = 'menuItem';
            modsBtn.setAttribute('onmouseenter', 'playTick()');
            modsBtn.onclick = () => {
                if (typeof window.playSelect === 'function') window.playSelect();
                if (typeof window.showWindow === 'function') {
                    window.showWindow(4);
                }
            };

            modsBtn.innerHTML = `
                <span class="material-icons-outlined menBtnIcn" style="color:#4CAF50; font-size: 76px;">color_lens</span>
                <div class="menuItemTitle">Mods</div>
            `;

            // Find Settings button and insert before it
            const menuItems = menuContainer.children;
            let settingsBtn = null;
            for (let i = 0; i < menuItems.length; i++) {
                const titleEl = menuItems[i].querySelector('.menuItemTitle');
                if (titleEl && titleEl.textContent.trim().toLowerCase() === 'settings') {
                    settingsBtn = menuItems[i];
                    break;
                }
            }

            if (settingsBtn) {
                menuContainer.insertBefore(modsBtn, settingsBtn);
            } else {
                menuContainer.appendChild(modsBtn);
            }

            console.log('[CommunityCSSAddon] Mods button injected successfully');
        } catch (e) {
            console.error('[CommunityCSSAddon] Mods button inject error:', e);
        }
    }

    injectModsSidebarItem() {
        try {
            this.injectModsButton();
            return true;
        } catch (_) {
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

            if (!document.querySelector('link[href*="Material+Icons+Outlined"]')) {
                const fontLink = document.createElement('link');
                fontLink.rel = 'stylesheet';
                fontLink.href = 'https://fonts.googleapis.com/css2?family=Material+Icons+Outlined';
                document.head.appendChild(fontLink);
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
                        position: relative;
                    }
                    .waterWindowContent {
                        padding: 10px 20px 20px 20px;
                        max-height: calc(85vh - 60px);
                        overflow-y: auto;
                    }
                    .theme-card {
                        background: rgba(30, 30, 35, 0.95);
                        border-radius: 8px;
                        overflow: hidden;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        border: 2px solid rgba(255, 255, 255, 0.05);
                        position: relative;
                    }
                    .theme-card:hover {
                        transform: translateY(-4px);
                        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
                        border-color: rgba(255, 105, 180, 0.5);
                    }
                    .theme-card.active-theme {
                        border-color: rgba(0, 255, 0, 1);
                        box-shadow: 0 0 15px rgba(0, 255, 0, 0.4);
                    }
                    .theme-thumbnail {
                        width: 100%;
                        height: 110px;
                        background: linear-gradient(135deg, rgba(138, 43, 226, 0.2), rgba(255, 105, 180, 0.2));
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .theme-thumbnail img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    .theme-thumbnail-icon {
                        font-size: 40px;
                        color: rgba(255, 255, 255, 0.3);
                    }
                    .theme-info {
                        padding: 10px 12px;
                    }
                    .theme-name {
                        font-size: 14px;
                        font-weight: 600;
                        color: rgba(255, 255, 255, 0.9);
                        margin-bottom: 3px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .theme-author {
                        font-size: 11px;
                        color: rgba(255, 255, 255, 0.5);
                    }
                    .theme-item, .script-item {
                        background: rgba(255, 255, 255, 0.05);
                        padding: 12px 15px;
                        padding-right: 50px;
                        margin: 8px 0;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s;
                        border: 1px solid transparent;
                        position: relative;
                    }
                    .theme-item:hover {
                        background: rgba(255, 255, 255, 0.1);
                        border-color: rgba(255, 255, 255, 0.2);
                    }
                    .theme-item.active-theme {
                        border-color: rgba(255, 105, 180, 0.6);
                    }
                    .script-item {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        cursor: default;
                        padding-right: 15px;
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
                    
                    /* Material Icons */
                    .material-icons-outlined {
                        font-family: 'Material Icons Outlined';
                        font-weight: normal;
                        font-style: normal;
                        font-size: 20px;
                        display: inline-block;
                        line-height: 1;
                        text-transform: none;
                        letter-spacing: normal;
                        word-wrap: normal;
                        white-space: nowrap;
                        direction: ltr;
                        user-select: none;
                    }
                    
                    /* Edit button for Custom CSS */
                    .css-edit-btn {
                        position: absolute;
                        right: 15px;
                        top: 50%;
                        transform: translateY(-50%);
                        color: rgba(255, 255, 255, 0.6);
                        cursor: pointer;
                        transition: all 0.2s;
                        z-index: 10;
                    }
                    .css-edit-btn:hover {
                        color: #ff69b4;
                        transform: translateY(-50%) scale(1.2);
                    }
                    
                    /* Reset button in header */
                    .header-reset-btn {
                        position: absolute;
                        right: 15px;
                        top: 50%;
                        transform: translateY(-50%);
                        color: rgba(255, 255, 255, 0.8);
                        cursor: pointer;
                        font-size: 24px;
                        transition: all 0.3s;
                    }
                    .header-reset-btn:hover {
                        color: #ff69b4;
                        transform: translateY(-50%) scale(1.15) rotate(180deg);
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

            // Create Themes window with Reset button
            const themesWindow = document.createElement('div');
            themesWindow.id = 'waterThemesWindow';
            themesWindow.className = 'waterWindow waterWindow-left';
            themesWindow.innerHTML = `
                <div class="waterWindowHeader">
                    Themes
                    <span class="material-icons-outlined header-reset-btn" 
                          onclick="window.resetTheme()" 
                          title="Reset to Default">
                        refresh
                    </span>
                </div>
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

            const builtinThemes = this.cssLoader.getManifest();
            const userThemes = this.cssLoader.getUserCSSFiles();
            const activeId = this.cssLoader.activeThemeId || 'default';

            let html = '';

            // Built-in themes as CARDS
            if (builtinThemes && builtinThemes.length > 0) {
                html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 0px; margin-top: 15px;">';
                html += builtinThemes.map(t => {
                    const isActive = t.id === activeId;
                    const thumbnailPath = t.thumbnail ?
                        `Water-Swap:///${path.join(__dirname, '../assets/community-css', t.thumbnail).replace(/\\/g, '/')}`
                        : null;

                    return `
                        <div class="theme-card ${isActive ? 'active-theme' : ''}" onclick="window.applyTheme('${t.id}')">
                            <div class="theme-thumbnail">
                                ${thumbnailPath ? `<img src="${thumbnailPath}" alt="${t.name}">` : '<div class="theme-thumbnail-icon">🎨</div>'}
                            </div>
                            <div class="theme-info">
                                <div class="theme-name" title="${t.name}">${t.name}</div>
                                <div class="theme-author">By ${t.author}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                html += '</div>';
            }

            // User CSS files as LIST ITEMS with Edit buttons
            if (userThemes && userThemes.length > 0) {
                if (builtinThemes && builtinThemes.length > 0) {
                    html += '<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);"></div>';
                    html += '<div style="color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 10px;">Custom CSS</div>';
                }

                html += userThemes.map(t => {
                    const isActive = t.id === activeId;
                    const filePath = t.filePath || path.join(this.cssLoader.userCSSPath, t.filename);

                    return `
                        <div class="theme-item ${isActive ? 'active-theme' : ''}" 
                             onclick="window.applyTheme('${t.id}')" 
                             style="${isActive ? 'border: 1px solid rgba(255, 105, 180, 0.4);' : ''}">
                            <div class="script-name">${t.name}</div>
                            <div style="font-size: 14px; color: rgba(255, 255, 255, 0.5); margin-top: 4px;">By ${t.author}</div>
                            <span class="material-icons-outlined css-edit-btn" 
                                  onclick="event.stopPropagation(); window.editCSSFile('${filePath.replace(/\\/g, "\\\\")}')" 
                                  title="Edit CSS">
                                edit
                            </span>
                        </div>
                    `;
                }).join('');
            }

            if ((!builtinThemes || builtinThemes.length === 0) && (!userThemes || userThemes.length === 0)) {
                html = '<div class="no-items-msg">No themes available.</div>';
            }

            list.innerHTML = html;

            // Global theme functions
            window.applyTheme = (id) => {
                this.cssLoader.applyCSS(id);
                this.renderThemes();
            };

            window.resetTheme = () => {
                try {
                    this.cssLoader.resetCSS();
                    const el = document.getElementById('water-community-css');
                    if (el) el.remove();
                    this.cssLoader.activeStyle = null;
                    this.cssLoader.activeThemeId = 'default';
                    localStorage.setItem('water-active-theme', 'default');
                    this.renderThemes();
                    console.log('[Water] CSS reset to default');
                } catch (e) {
                    console.error('[Water] Failed to reset CSS:', e);
                }
            };

            window.editCSSFile = (filePath) => {
                const { shell } = require('electron');
                shell.openPath(filePath).then(result => {
                    if (result) {
                        console.error('[Water] Failed to open CSS file:', result);
                    } else {
                        console.log('[Water] Opened CSS file for editing:', filePath);
                    }
                });
            };
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
            { id: 'hideLoadingScreen', name: 'Hide Loading Screen', css: '', defaultOn: false, isClientSetting: true },
            { id: 'showModsButton', name: 'Bring Back Mods Button', css: '', defaultOn: true, isModsButton: true },
            { id: 'hideMoreKrunker', name: 'Hide More Krunker', css: '.menuItem:nth-child(8) {display: none !important;}', defaultOn: true },
            { id: 'hideSocial', name: 'Hide Social & Trading Button', css: '.menuItem:nth-child(5) {display: none;}', defaultOn: false },
            { id: 'hideCommunity', name: 'Hide Community Button', css: '.menuItem:nth-child(6) {display: none;}', defaultOn: false },
            { id: 'hideGames', name: 'Hide Games Button', css: '.menuItem:nth-child(7) {display: none;}', defaultOn: false },
            { id: 'hideStream', name: 'Hide Old & New Stream Container', css: '#streamContainer, #streamContainerNew {display: none !important;}', defaultOn: false },
            { id: 'hideQuickMatch', name: 'Hide Quick Match Button', css: '#menuBtnQuickMatch {display: none !important;}', defaultOn: true }
        ];
    }

    renderUIToggles() {
        try {
            const list = document.getElementById('water-ui-list');
            if (!list) return;

            const toggles = this.getUIToggles();

            list.innerHTML = toggles.map(toggle => {
                const savedState = localStorage.getItem(`water-ui-${toggle.id}`);
                const isOn = savedState === null ? toggle.defaultOn : savedState === 'true';

                return `
                    <div class="settNameSmall script-item">
                        <span class="script-name">${toggle.name}</span>
                        <label class="switch" style="margin-left: 10px;">
                            <input type="checkbox" id="water-ui-${toggle.id}" 
                                   ${isOn ? 'checked' : ''} 
                                   onchange="window.toggleWaterUI('${toggle.id}', this.checked)">
                            <span class="slider"><span class="grooves"></span></span>
                        </label>
                    </div>
                `;
            }).join('');

            window.toggleWaterUI = (toggleId, enabled) => {
                const toggle = this.getUIToggles().find(t => t.id === toggleId);
                if (!toggle) return;

                // Handle Mods button toggle specially
                if (toggle.isModsButton) {
                    localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                    console.log(`[Water] UI toggle ${toggle.name}: ${enabled ? 'ON' : 'OFF'}`);
                    // Re-inject or remove the Mods button
                    this.injectModsButton();
                    return;
                }

                localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                console.log(`[Water] UI Toggle ${toggleId}: ${enabled ? 'ON' : 'OFF'}`);
                this.applyUIToggles();
            };
        } catch (e) {
            console.error('[CommunityCSSAddon] Render UI toggles error:', e);
            const list = document.getElementById('water-ui-list');
            if (list) list.innerHTML = `<div class="no-items-msg" style="color: #ff5555">Error: ${e.message}</div>`;
        }
    }

    applyUIToggles() {
        try {
            const toggles = this.getUIToggles();
            const styleId = 'water-ui-toggles';

            // Remove existing style
            const existingStyle = document.getElementById(styleId);
            if (existingStyle) existingStyle.remove();

            // Build CSS from enabled toggles
            let css = '';
            toggles.forEach(toggle => {
                const savedState = localStorage.getItem(`water-ui-${toggle.id}`);
                const isOn = savedState === null ? toggle.defaultOn : savedState === 'true';
                if (isOn && toggle.css) {
                    css += toggle.css + '\n';
                }
            });

            if (css) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = css;
                document.head.appendChild(style);
            }
        } catch (e) {
            console.error('[CommunityCSSAddon] Apply UI toggles error:', e);
        }
    }
}

module.exports = CommunityCSSAddon;
