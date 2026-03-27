const CSSLoader = require('./css-loader');
const ModDownloader = require('./mod-downloader');
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
                        width: 800px;
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
                        left: 0;
                    }
                    .waterWindow-right {
                        right: 0;
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
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }
                    .waterWindowContent::-webkit-scrollbar {
                        display: none;
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

            // Position windows relative to viewport center (robust across all resolutions/scales)
            const positionWindows = () => {
                const gap = 20;
                const tw = themesWindow.offsetWidth || 800;
                const cw = customizationsWindow.offsetWidth || 800;
                const totalW = tw + cw + gap;
                const startX = Math.max(10, (window.innerWidth - totalW) / 2);
                themesWindow.style.left = startX + 'px';
                themesWindow.style.right = '';
                customizationsWindow.style.left = (startX + tw + gap) + 'px';
                customizationsWindow.style.right = '';
            };
            // Run after layout
            requestAnimationFrame(() => { requestAnimationFrame(positionWindows); });

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

            // Check if userscripts are globally disabled
            const Store = require('electron-store');
            const config = new Store();
            const userscriptsEnabled = config.get('enableUserscripts', true);

            // If userscripts are disabled, manually read scripts folder and show them in disabled state
            if (!userscriptsEnabled) {
                const fs = require('fs');
                const path = require('path');
                const { ipcRenderer } = require('electron');
                
                // Get scripts path
                ipcRenderer.invoke('get-app-info').then(info => {
                    const userscriptsPath = String(config.get('userscriptsPath', '') || path.join(info.documentsDir, 'Water', 'Scripts'));
                    
                    let scriptsListHTML = '';
                    let scriptFiles = [];
                    
                    // Try to read scripts directory
                    try {
                        if (fs.existsSync(userscriptsPath)) {
                            scriptFiles = fs.readdirSync(userscriptsPath)
                                .filter(file => file.endsWith('.js'));
                        }
                    } catch (e) {
                        console.error('[Water] Failed to read scripts directory:', e);
                    }
                    
                    // Show scripts if they exist
                    if (scriptFiles.length > 0) {
                        scriptsListHTML = scriptFiles.map(scriptFile => {
                            const scriptId = scriptFile.replace('.js', '');
                            
                            // Try to read script metadata
                            let scriptName = scriptFile;
                            let scriptAuthor = '';
                            let scriptVersion = '';
                            let scriptDesc = '';
                            
                            try {
                                const scriptPath = path.join(userscriptsPath, scriptFile);
                                const content = fs.readFileSync(scriptPath, 'utf-8');
                                
                                // Parse metadata if present
                                if (content.includes('// ==UserScript==') && content.includes('// ==/UserScript==')) {
                                    const metaMatch = content.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
                                    if (metaMatch) {
                                        const metaBlock = metaMatch[1];
                                        
                                        const nameMatch = metaBlock.match(/\/\/ @name\s+(.+)/);
                                        if (nameMatch) scriptName = nameMatch[1].trim();
                                        
                                        const authorMatch = metaBlock.match(/\/\/ @author\s+(.+)/);
                                        if (authorMatch) scriptAuthor = ` by ${authorMatch[1].trim()}`;
                                        
                                        const versionMatch = metaBlock.match(/\/\/ @version\s+(.+)/);
                                        if (versionMatch) scriptVersion = ` v${versionMatch[1].trim()}`;
                                        
                                        const descMatch = metaBlock.match(/\/\/ @desc\s+(.+)/);
                                        if (descMatch) scriptDesc = descMatch[1].trim();
                                    }
                                }
                            } catch (e) {
                                console.error('[Water] Failed to read script metadata:', e);
                            }
                            
                            return `
                                <div class="settNameSmall script-item" style="display: block; margin-bottom: 15px; padding: 15px; background: rgba(255, 255, 255, 0.03); border-radius: 6px; opacity: 0.5;">
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <div style="display: flex; align-items: center; flex: 1;">
                                            <div style="display: flex; flex-direction: column;">
                                                <span class="script-name">${scriptName}${scriptAuthor}${scriptVersion}</span>
                                                ${scriptDesc ? `<span style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">${scriptDesc}</span>` : ''}
                                            </div>
                                        </div>
                                        <label class="switch" style="margin: 0; opacity: 0.3; pointer-events: none;">
                                            <input type="checkbox" disabled>
                                            <span class="slider"><span class="grooves"></span></span>
                                        </label>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    } else {
                        scriptsListHTML = '<div class="no-items-msg" style="margin-top: 15px;">No scripts found. Place .js files in Documents\\Water\\Scripts</div>';
                    }
                    
                    list.innerHTML = `
                        <div style="background: rgba(255, 100, 100, 0.15); border: 1px solid rgba(255, 100, 100, 0.3); border-radius: 6px; padding: 15px; margin-bottom: 20px; margin-top: 15px;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <span class="material-icons" style="color: #ff6464; font-size: 24px;">warning</span>
                                <span style="color: #ff6464; font-weight: 600; font-size: 15px;">Userscripts Disabled</span>
                            </div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 13px; line-height: 1.5;">
                                Enable them from Settings > Water > Maintenance > Enable Userscripts
                            </div>
                        </div>
                        <div style="pointer-events: none;">
                            ${scriptsListHTML}
                        </div>
                    `;
                }).catch(e => {
                    console.error('[Water] Failed to get app info:', e);
                    list.innerHTML = `<div class="no-items-msg" style="color: #ff5555">Error loading scripts: ${e.message}</div>`;
                });
                
                return;
            }

            // Get userscripts from the loader (when enabled)
            const { su } = require('./userscript-manager/userscript-loader');

            // Check if userscripts are loaded
            if (!su.userscripts || su.userscripts.length === 0) {
                list.innerHTML = '<div class="no-items-msg">No scripts found. Place .js files in Documents\\Water\\Scripts</div>';
                return;
            }

            // Helper to validate and render setting controls
            const renderSettingControl = (settingKey, setting, scriptName) => {
                const settingId = `water-script-setting-${scriptName}-${settingKey}`;
                
                // Validate setting structure
                if (!setting || typeof setting !== 'object') return '';
                if (!setting.title || !setting.type || setting.value === undefined) return '';
                if (typeof setting.changed !== 'function') return '';
                
                let controlHTML = '';
                const tip = setting.desc || '';
                
                switch (setting.type) {
                    case 'bool':
                        if (typeof setting.value !== 'boolean') return '';
                        controlHTML = `
                            <label class="switch" style="margin: 0;">
                                <input type="checkbox" id="${settingId}" 
                                       ${setting.value ? 'checked' : ''} 
                                       onchange="window.updateScriptSetting('${scriptName}', '${settingKey}', this.checked)">
                                <span class="slider"><span class="grooves"></span></span>
                            </label>
                        `;
                        break;
                        
                    case 'num':
                        if (typeof setting.value !== 'number') return '';
                        const min = setting.min !== undefined ? setting.min : 0;
                        const max = setting.max !== undefined ? setting.max : 100;
                        const step = setting.step !== undefined ? setting.step : 1;
                        controlHTML = `
                            <div style="display: flex; align-items: center; gap: 12px; min-width: 250px;">
                                <input type="range" id="${settingId}" 
                                       min="${min}" max="${max}" step="${step}" 
                                       value="${setting.value}" 
                                       class="sliderVal" style="flex: 1;" 
                                       oninput="document.getElementById('${settingId}-value').textContent=this.value; window.updateScriptSetting('${scriptName}', '${settingKey}', parseFloat(this.value))">
                                <span id="${settingId}-value" style="min-width: 45px; text-align: right; color: rgba(255,255,255,0.9); font-weight: 500; font-size: 14px;">
                                    ${setting.value}
                                </span>
                            </div>
                        `;
                        break;
                        
                    case 'sel':
                        if (!Array.isArray(setting.opts) || setting.opts.length < 2) return '';
                        if (!setting.opts.includes(setting.value)) return '';
                        controlHTML = `
                            <select id="${settingId}" 
                                    class="inputGrey2" 
                                    style="min-width: 150px; padding: 8px 12px;"
                                    onchange="window.updateScriptSetting('${scriptName}', '${settingKey}', this.value)">
                                ${setting.opts.map(opt => `<option value="${opt}" ${opt === setting.value ? 'selected' : ''}>${opt}</option>`).join('')}
                            </select>
                        `;
                        break;
                        
                    case 'color':
                        if (typeof setting.value !== 'string' || !setting.value.match(/^#([0-9a-fA-F]{3}){2}$/)) return '';
                        controlHTML = `
                            <input type="color" id="${settingId}" 
                                   value="${setting.value}" 
                                   style="width: 50px; height: 32px; border: 2px solid rgba(255,255,255,0.2); border-radius: 4px; background: transparent; cursor: pointer;" 
                                   onchange="window.updateScriptSetting('${scriptName}', '${settingKey}', this.value)">
                        `;
                        break;
                        
                    case 'keybind':
                        if (typeof setting.value !== 'object' || Array.isArray(setting.value)) return '';
                        if (typeof setting.value.alt !== 'boolean' || typeof setting.value.ctrl !== 'boolean' || 
                            typeof setting.value.shift !== 'boolean' || typeof setting.value.key !== 'string') return '';
                        const kb = setting.value;
                        const modifiers = [
                            kb.ctrl ? 'Ctrl' : '',
                            kb.alt ? 'Alt' : '',
                            kb.shift ? 'Shift' : ''
                        ].filter(m => m).join(' + ');
                        const displayKey = modifiers ? `${modifiers} + ${kb.key.toUpperCase()}` : kb.key.toUpperCase();
                        controlHTML = `
                            <button id="${settingId}" 
                                    class="inputGrey2" 
                                    style="min-width: 120px; padding: 8px 12px; cursor: pointer;"
                                    onclick="window.recordKeybind('${scriptName}', '${settingKey}', this)">
                                ${displayKey}
                            </button>
                        `;
                        break;
                        
                    default:
                        return '';
                }
                
                return `
                    <div class='settName' style='margin: 8px 0; display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);'${tip ? ` title='${tip.replace(/'/g, "&apos;")}'` : ''}>
                        <span style="color: rgba(255,255,255,0.85); font-size: 14px;">${setting.title}</span>
                        <span>${controlHTML}</span>
                    </div>
                `;
            };

            list.innerHTML = su.userscripts.map(script => {
                const scriptId = script.name.replace('.js', '');
                
                // Get enabled state from electron-store
                const Store = require('electron-store');
                const config = new Store();
                const isEnabled = config.get(`userscripts.${script.name}.enabled`, true);
                
                const dropdownId = `water-script-settings-${scriptId}`;
                
                // Get script metadata
                const scriptName = (script.meta && script.meta.name) || script.name;
                const scriptAuthor = (script.meta && script.meta.author) ? ` by ${script.meta.author}` : '';
                const scriptVersion = (script.meta && script.meta.version) ? ` v${script.meta.version}` : '';
                const scriptDesc = (script.meta && script.meta.desc) || '';
                
                // Check if script has settings
                const hasSettings = script.settings && Object.keys(script.settings).length > 0;
                
                // Config arrow button (only show if script has settings)
                const configArrow = hasSettings ? `
                    <span class="material-icons-outlined" 
                          id="arrow-${scriptId}" 
                          style="font-size: 24px; cursor: pointer; color: rgba(255,255,255,0.6); transition: all 0.2s; margin-right: 12px;"
                          onmouseover="this.style.color='rgba(255,255,255,0.9)'"
                          onmouseout="this.style.color='rgba(255,255,255,0.6)'">
                        keyboard_arrow_right
                    </span>
                ` : '';
                
                let settingsHTML = '';
                if (hasSettings) {
                    const settingsContent = Object.keys(script.settings)
                        .map(key => renderSettingControl(key, script.settings[key], script.name))
                        .filter(html => html)
                        .join('');
                    
                    if (settingsContent) {
                        settingsHTML = `
                            <div id="${dropdownId}" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);">
                                ${settingsContent}
                            </div>
                        `;
                    }
                }
                
                return `
                    <div class="settNameSmall script-item" style="display: block; margin-bottom: 15px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; flex: 1; cursor: ${hasSettings ? 'pointer' : 'default'};" 
                                 ${hasSettings ? `onclick="window.toggleScriptSettings('${scriptId}')"` : ''}>
                                ${configArrow}
                                <div style="display: flex; flex-direction: column;">
                                    <span class="script-name">${scriptName}${scriptAuthor}${scriptVersion}</span>
                                    ${scriptDesc ? `<span style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">${scriptDesc}</span>` : ''}
                                </div>
                            </div>
                            <label class="switch" style="margin: 0;" onclick="event.stopPropagation();">
                                <input type="checkbox" id="water-script-${scriptId}" 
                                       ${isEnabled ? 'checked' : ''} 
                                       onchange="window.toggleWaterScript('${script.name}', this.checked)">
                                <span class="slider"><span class="grooves"></span></span>
                            </label>
                        </div>
                        ${settingsHTML}
                    </div>
                `;
            }).join('');
            
            // Define toggle function
            window.toggleWaterScript = (scriptName, enabled) => {
                const Store = require('electron-store');
                const config = new Store();
                
                // Save to electron-store
                config.set(`userscripts.${scriptName}.enabled`, enabled);
                console.log(`[Water] Script ${scriptName}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
                console.log('[Water] Restart client to apply script changes');
            };
            
            // Define settings dropdown toggle function
            window.toggleScriptSettings = (scriptId) => {
                const dropdown = document.getElementById(`water-script-settings-${scriptId}`);
                const arrow = document.getElementById(`arrow-${scriptId}`);
                if (dropdown && arrow) {
                    const isHidden = dropdown.style.display === 'none';
                    dropdown.style.display = isHidden ? 'block' : 'none';
                    arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                }
            };
            
            // Define setting update function
            window.updateScriptSetting = (scriptName, settingKey, value) => {
                const fs = require('fs');
                const path = require('path');
                const { su } = require('./userscript-manager/userscript-loader');
                
                // Find the script
                const script = su.userscripts.find(s => s.name === scriptName);
                if (!script || !script.settings || !script.settings[settingKey]) {
                    console.error('[Water] Setting not found:', scriptName, settingKey);
                    return;
                }
                
                // Update the setting value
                script.settings[settingKey].value = value;
                
                // Call the changed callback
                if (typeof script.settings[settingKey].changed === 'function') {
                    try {
                        script.settings[settingKey].changed(value);
                        console.log(`[Water] Setting updated: ${scriptName} > ${settingKey} = ${value}`);
                    } catch (e) {
                        console.error('[Water] Error calling setting changed callback:', e);
                    }
                }
                
                // Save to preferences file
                try {
                    const settingsPath = script.settingsPath;
                    let savedSettings = {};
                    
                    // Read existing settings if file exists
                    if (fs.existsSync(settingsPath)) {
                        try {
                            savedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
                        } catch (e) {
                            console.warn('[Water] Failed to read existing settings, creating new file');
                        }
                    }
                    
                    // Update the setting
                    savedSettings[settingKey] = value;
                    
                    // Write back to file
                    fs.writeFileSync(settingsPath, JSON.stringify(savedSettings, null, 2), { encoding: 'utf-8' });
                } catch (e) {
                    console.error('[Water] Failed to save setting to file:', e);
                }
            };
            
            // Define keybind recording function
            window.recordKeybind = (scriptName, settingKey, button) => {
                button.textContent = 'Press any key...';
                button.style.background = 'rgba(255, 255, 0, 0.2)';
                
                const handleKeyPress = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const keybind = {
                        ctrl: e.ctrlKey,
                        alt: e.altKey,
                        shift: e.shiftKey,
                        key: e.key
                    };
                    
                    // Update display
                    const modifiers = [
                        keybind.ctrl ? 'Ctrl' : '',
                        keybind.alt ? 'Alt' : '',
                        keybind.shift ? 'Shift' : ''
                    ].filter(m => m).join(' + ');
                    const displayKey = modifiers ? `${modifiers} + ${keybind.key.toUpperCase()}` : keybind.key.toUpperCase();
                    button.textContent = displayKey;
                    button.style.background = '';
                    
                    // Update setting
                    window.updateScriptSetting(scriptName, settingKey, keybind);
                    
                    // Remove listener
                    document.removeEventListener('keydown', handleKeyPress, true);
                };
                
                document.addEventListener('keydown', handleKeyPress, true);
            };
        } catch (e) {
            console.error('[CommunityCSSAddon] Render scripts error:', e);
            const list = document.getElementById('water-scripts-list');
            if (list) list.innerHTML = `<div class="no-items-msg" style="color: #ff5555">Error: ${e.message}</div>`;
        }
    }

    getUIToggles() {
        return [
            { id: 'hideLoadingScreen', name: 'Hide Water Loader', css: '', defaultOn: false, requiresRestart: true },
            { id: 'hideAds', name: 'Hide ADs', css: '#mainLogo, #topRightAdHolder, #aHolder, #endAContainer, #bubbleContainer, #homeStoreAd, #newUserGuide, #doubleRaidDropsAd, #battlepassAd, #updateAd, #mainLogoFace, #seasonLabel, #doubleXPHolder, .webpush-container, #krDiscountAd, #surveyAd {display: none !important;}', defaultOn: false },
            { id: 'hideTermsInfo', name: 'Hide Terms Info', css: '#termsInfo {display: none;}', defaultOn: false },
            { id: 'hideSignupAlerts', name: 'Hide Signup Alerts', css: '#signupRewardsButton, .signup-rewards-container, .guest-earned-collect, #notificationCenter {display: none !important;}', defaultOn: true },
            { id: 'showModsButton', name: 'Bring Back Mods Button', css: '', defaultOn: true, isModsButton: true },
            { id: 'hideMoreKrunker', name: 'Hide More Krunker', css: '.menuItem:nth-child(8) {display: none !important;}', defaultOn: true },
            { id: 'hideSocial', name: 'Hide Social & Trading Button', css: '.menuItem:nth-child(5) {display: none;}', defaultOn: false },
            { id: 'hideCommunity', name: 'Hide Community Button', css: '.menuItem:nth-child(6) {display: none;}', defaultOn: false },
            { id: 'hideGames', name: 'Hide Games Button', css: '.menuItem:nth-child(7) {display: none;}', defaultOn: false },
            { id: 'hideStream', name: 'Hide Old & New Stream Container', css: '#streamContainer, #streamContainerNew {display: none !important;}', defaultOn: false },
            { id: 'hideQuickMatch', name: 'Hide Quick Match Button', css: '#menuBtnQuickMatch {display: none !important;}', defaultOn: true },
            { id: 'hideLeaderboardButton', name: 'Hide Leaderboard Button', css: '.icon-button.svelte-wmukcv {display: none !important;}', defaultOn: true },
            { id: 'hideTurfWars', name: 'Hide Turf Wars', css: '.main-menu-button-container.svelte-f3amho[style="top: 92px; left: 520px; --border-color:#00B1FF;"] {display: none !important;}', defaultOn: true },
            { id: 'hideNewMarket', name: 'Hide New Market', css: '.main-menu-button-container.svelte-f3amho[style="top: 282px; left: 520px; --border-color:#e39e1d;"] {display: none !important;}', defaultOn: true },
            { id: 'hideDoubleXP', name: 'Hide Double XP', css: '#doubleXPButton {display: none !important;}', defaultOn: true }
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
                        <span class="script-name">${toggle.name}${toggle.requiresRestart ? ' <span style="color: #ff6464;">*</span>' : ''}</span>
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

                // Handle loading screen toggle specially - save to electron-store
                if (toggleId === 'hideLoadingScreen') {
                    const Store = require('electron-store');
                    const config = new Store();
                    config.set('hideLoadingScreen', enabled);
                    localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                    console.log(`[Water] hideLoadingScreen saved to electron-store:`, enabled);
                    console.log(`[Water] Loading screen will be ${enabled ? 'hidden' : 'shown'} on next launch`);
                    
                    // Verify it was saved
                    setTimeout(() => {
                        const saved = config.get('hideLoadingScreen');
                        console.log(`[Water] Verified hideLoadingScreen in store:`, saved);
                    }, 100);
                    
                    // Show restart notice
                    const checkbox = document.getElementById(`water-ui-${toggleId}`);
                    if (checkbox && checkbox.parentElement && checkbox.parentElement.parentElement) {
                        const item = checkbox.parentElement.parentElement;
                        let notice = item.querySelector('.restart-notice');
                        if (!notice) {
                            notice = document.createElement('div');
                            notice.className = 'restart-notice';
                            notice.style.cssText = 'font-size: 11px; color: #ff9800; margin-top: 5px;';
                            notice.textContent = 'Restart required to apply';
                            item.appendChild(notice);
                        }
                    }
                    return;
                }

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

    initModDownloader() {
        const downloader = new ModDownloader();
        downloader.init();
    }
}

module.exports = CommunityCSSAddon;
