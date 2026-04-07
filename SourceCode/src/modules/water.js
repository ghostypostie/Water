"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const fs_1 = require("fs");
const path_1 = require("path");
const electron_1 = require("electron");
const paths_1 = require("../utils/paths");
const { initializeUserscripts, su } = require('./userscript-loader.js');
const mod_downloader_1 = require("./mod-downloader");
const config_1 = __importDefault(require("../config"));
class Water extends module_1.default {
    name = 'Water';
    id = 'water';
    options = [];
    contexts = [
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadEnd,
        }
    ];
    builtinThemes = [];
    userThemes = [];
    localThemes = [];
    swapperThemes = [];
    activeThemeId = 'default';
    userCSSPath = '';
    localThemesPath = '';
    swapperThemesPath = '';
    init() {
        try {
            const manifestPath = (0, path_1.join)(__dirname, '../../assets/community-css/manifest.json');
            if ((0, fs_1.existsSync)(manifestPath)) {
                this.builtinThemes = JSON.parse((0, fs_1.readFileSync)(manifestPath, 'utf-8'));
                console.log('[Water] Loaded', this.builtinThemes.length, 'builtin themes');
            }
        }
        catch (e) {
            console.error('[Water] Failed to load manifest:', e);
        }
        const swapperCssPath = (0, path_1.join)((0, paths_1.getSwapPath)(), 'css');
        const userscriptsPath = (0, paths_1.getScriptsPath)();
        // Ensure Swap and Scripts folder structure exists
        try {
            if (!(0, fs_1.existsSync)(swapperCssPath)) {
                (0, fs_1.mkdirSync)(swapperCssPath, { recursive: true });
                console.log('[Water] Created Swap/css folder:', swapperCssPath);
            }
            if (!(0, fs_1.existsSync)(userscriptsPath)) {
                (0, fs_1.mkdirSync)(userscriptsPath, { recursive: true });
                console.log('[Water] Created Scripts folder:', userscriptsPath);
            }
        }
        catch (e) {
            console.error('[Water] Failed to create Water folders:', e);
        }
        this.userCSSPath = swapperCssPath;
        this.localThemesPath = swapperCssPath;
        this.swapperThemesPath = swapperCssPath;
        this.loadUserThemes();
        this.loadLocalThemes();
        this.loadSwapperThemes();
        const saved = localStorage.getItem('water-active-theme');
        if (saved)
            this.activeThemeId = saved;
        console.log('[Water] Userscripts path:', userscriptsPath);
        const userscriptsEnabled = config_1.default.get('resourceswapper.enableUserscripts', true);
        if (userscriptsEnabled) {
            console.log('[Water] Initializing userscripts...');
            initializeUserscripts(userscriptsPath, config_1.default);
            console.log('[Water] Userscripts initialized, loaded:', su.userscripts.length, 'scripts');
            su.userscripts.forEach(s => console.log('[Water] Script loaded:', s.name, 'Settings:', Object.keys(s.settings).length));
        }
        else {
            console.log('[Water] Userscripts disabled');
        }
    }
    loadUserThemes() {
        try {
            if (!(0, fs_1.existsSync)(this.userCSSPath)) {
                console.log('[Water] User CSS path does not exist:', this.userCSSPath);
                return;
            }
            const files = (0, fs_1.readdirSync)(this.userCSSPath);
            console.log('[Water] Files in user CSS path:', files);
            this.userThemes = files
                .filter(f => f.endsWith('.css'))
                .map(filename => {
                const filePath = (0, path_1.join)(this.userCSSPath, filename);
                const id = `user-${filename.replace('.css', '')}`;
                let name = filename.replace('.css', '');
                let author = 'Unknown';
                try {
                    const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
                    const nameMatch = content.match(/\/\*\s*@name\s+(.+?)\s*\*\//);
                    const authorMatch = content.match(/\/\*\s*@author\s+(.+?)\s*\*\//);
                    if (nameMatch)
                        name = nameMatch[1];
                    if (authorMatch)
                        author = authorMatch[1];
                }
                catch (e) {
                    console.error('[Water] Failed to parse CSS metadata:', e);
                }
                return { id, name, author, filename, filePath };
            });
            console.log('[Water] Loaded', this.userThemes.length, 'user themes:', this.userThemes.map(t => t.id));
        }
        catch (e) {
            console.error('[Water] Failed to load user themes:', e);
        }
    }
    loadLocalThemes() {
        try {
            if (!(0, fs_1.existsSync)(this.localThemesPath)) {
                console.log('[Water] Local themes path does not exist:', this.localThemesPath);
                return;
            }
            const files = (0, fs_1.readdirSync)(this.localThemesPath);
            console.log('[Water] Files in local themes path:', files);
            this.localThemes = files
                .filter(f => f.endsWith('.css') || f.endsWith('.txt'))
                .map(filename => {
                const filePath = (0, path_1.join)(this.localThemesPath, filename);
                const ext = filename.split('.').pop();
                const id = `local-${filename.replace(/\.(css|txt)$/, '')}`;
                let name = filename.replace(/\.(css|txt)$/, '');
                let author = 'Unknown';
                try {
                    const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
                    const nameMatch = content.match(/\/\*\s*@name\s+(.+?)\s*\*\//);
                    const authorMatch = content.match(/\/\*\s*@author\s+(.+?)\s*\*\//);
                    if (nameMatch)
                        name = nameMatch[1];
                    if (authorMatch)
                        author = authorMatch[1];
                }
                catch (e) {
                    console.error('[Water] Failed to parse local theme metadata:', e);
                }
                return { id, name, author, filename, filePath };
            });
            console.log('[Water] Loaded', this.localThemes.length, 'local themes:', this.localThemes.map(t => t.id));
        }
        catch (e) {
            console.error('[Water] Failed to load local themes:', e);
        }
    }
    loadSwapperThemes() {
        try {
            if (!(0, fs_1.existsSync)(this.swapperThemesPath))
                return;
            const files = (0, fs_1.readdirSync)(this.swapperThemesPath);
            this.swapperThemes = files
                .filter(f => f.endsWith('.css') || f.endsWith('.txt'))
                .map(filename => {
                const filePath = (0, path_1.join)(this.swapperThemesPath, filename);
                const ext = filename.split('.').pop();
                const id = `swapper-${filename.replace(/\.(css|txt)$/, '')}`;
                let name = filename.replace(/\.(css|txt)$/, '');
                let author = 'Unknown';
                try {
                    const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
                    const nameMatch = content.match(/\/\*\s*@name\s+(.+?)\s*\*\//);
                    const authorMatch = content.match(/\/\*\s*@author\s+(.+?)\s*\*\//);
                    if (nameMatch)
                        name = nameMatch[1];
                    if (authorMatch)
                        author = authorMatch[1];
                }
                catch (e) {
                    console.error('[Water] Failed to parse swapper theme metadata:', e);
                }
                return { id, name, author, filename, filePath };
            });
            console.log('[Water] Loaded', this.swapperThemes.length, 'swapper themes');
        }
        catch (e) {
            console.error('[Water] Failed to load swapper themes:', e);
        }
    }
    renderer() {
        this.injectWaterButtonCSS();
        this.injectWaterButton();
        this.applyUIToggles();
        if (this.activeThemeId && this.activeThemeId !== 'default') {
            this.applyTheme(this.activeThemeId);
        }
        mod_downloader_1.modDownloader.init();
        // Add keyboard shortcut for CSS reset (Ctrl + /)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                this.resetTheme();
                console.log('[Water] CSS reset via Ctrl+/');
            }
        });
    }
    injectWaterButtonCSS() {
        // Water button now uses default Krunker menu item styling
        // No custom CSS needed
    }
    injectWaterButton() {
        const doInject = () => {
            try {
                const menuContainer = document.getElementById('menuItemContainer');
                if (!menuContainer) {
                    console.log('[Water] menuItemContainer not found, retrying...');
                    return false;
                }
                if (document.getElementById('waterBtn')) {
                    console.log('[Water] Button already exists');
                    return true;
                }
                const btn = document.createElement('div');
                btn.id = 'waterBtn';
                btn.className = 'menuItem';
                btn.setAttribute('onmouseenter', 'playTick()');
                btn.onclick = () => {
                    if (typeof window.playSelect === 'function')
                        window.playSelect();
                    this.openWaterWindow();
                };
                btn.innerHTML = `
                    <span class="material-icons-outlined menBtnIcn" style="color:#ff69b4;font-size:70px!important">water_drop</span>
                    <div class="menuItemTitle" style="font-size:13px">Water</div>
                `;
                menuContainer.insertBefore(btn, menuContainer.firstChild);
                console.log('[Water] Button injected at position 0 of', menuContainer.children.length, 'items');
                this.injectModsButton();
                return true;
            }
            catch (e) {
                console.error('[Water] Button inject error:', e);
                return false;
            }
        };
        if (doInject())
            return;
        let attempts = 0;
        const retry = () => {
            attempts++;
            if (attempts > 30) {
                console.error('[Water] Failed to inject button after 30 attempts');
                return;
            }
            if (!doInject()) {
                setTimeout(retry, 500);
            }
        };
        setTimeout(retry, 500);
        const observer = new MutationObserver(() => {
            if (!document.getElementById('waterBtn')) {
                const menuContainer = document.getElementById('menuItemContainer');
                if (menuContainer && menuContainer.children.length > 0) {
                    doInject();
                }
            }
        });
        const watchForContainer = setInterval(() => {
            const menuContainer = document.getElementById('menuItemContainer');
            if (menuContainer) {
                clearInterval(watchForContainer);
                observer.observe(menuContainer, { childList: true });
            }
        }, 500);
    }
    injectModsButton() {
        try {
            const savedState = localStorage.getItem('water-ui-showModsButton');
            const shouldShow = savedState !== null ? savedState === 'true' : true;
            if (!shouldShow) {
                const existingBtn = document.getElementById('modsBtn');
                if (existingBtn)
                    existingBtn.remove();
                return;
            }
            const menuContainer = document.getElementById('menuItemContainer');
            if (!menuContainer)
                return;
            if (document.getElementById('modsBtn'))
                return;
            const modsBtn = document.createElement('div');
            modsBtn.id = 'modsBtn';
            modsBtn.className = 'menuItem';
            modsBtn.setAttribute('onmouseenter', 'playTick()');
            modsBtn.onclick = () => {
                if (typeof window.playSelect === 'function')
                    window.playSelect();
                if (typeof window.showWindow === 'function') {
                    window.showWindow(4);
                }
            };
            modsBtn.innerHTML = `
                <span class="material-icons-outlined menBtnIcn" style="color:#4CAF50; font-size: 76px;">color_lens</span>
                <div class="menuItemTitle">Mods</div>
            `;
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
            }
            else {
                menuContainer.appendChild(modsBtn);
            }
            console.log('[Water] Mods button injected successfully');
        }
        catch (e) {
            console.error('[Water] Mods button inject error:', e);
        }
    }
    openWaterWindow() {
        try {
            let overlay = document.getElementById('waterOverlay');
            if (overlay) {
                const isHidden = overlay.style.display === 'none';
                overlay.style.display = isHidden ? 'block' : 'none';
                document.getElementById('waterThemesWindow').style.display = isHidden ? 'block' : 'none';
                document.getElementById('waterCustomizationsWindow').style.display = isHidden ? 'block' : 'none';
                return;
            }
            if (!document.querySelector('link[href*="Material+Icons+Outlined"]')) {
                const fontLink = document.createElement('link');
                fontLink.rel = 'stylesheet';
                fontLink.href = 'https://fonts.googleapis.com/css2?family=Material+Icons&display=swap';
                document.head.appendChild(fontLink);
            }
            if (!document.getElementById('water-styles')) {
                const style = document.createElement('style');
                style.id = 'water-styles';
                style.textContent = this.getWaterWindowCSS();
                document.head.appendChild(style);
            }
            overlay = document.createElement('div');
            overlay.id = 'waterOverlay';
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                    document.getElementById('waterThemesWindow').style.display = 'none';
                    document.getElementById('waterCustomizationsWindow').style.display = 'none';
                }
            };
            document.body.appendChild(overlay);
            const themesWindow = document.createElement('div');
            themesWindow.id = 'waterThemesWindow';
            themesWindow.className = 'waterWindow waterWindow-left';
            themesWindow.innerHTML = `
                <div class="waterWindowContent">
                    <div class="setHedS">
                        Water Themes
                        <span class="material-icons-outlined header-reset-btn"
                              onclick="window.resetTheme()"
                              title="Reset to Default">
                            refresh
                        </span>
                    </div>
                    <div class="setBodH">
                        <div id="water-themes-list"></div>
                    </div>
                    <div class="setHedS">
                        Local Themes
                        <span class="material-icons-outlined header-folder-btn"
                              onclick="window.openThemesFolder()"
                              title="Open Themes Folder">
                            folder_open
                        </span>
                    </div>
                    <div class="setBodH">
                        <div id="water-local-themes-list"></div>
                    </div>
                    <div id="water-theme-variables-section" style="display: none;">
                        <div class="setHedS">Theme Variables</div>
                        <div class="setBodH">
                            <div id="water-theme-variables"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(themesWindow);
            const customizationsWindow = document.createElement('div');
            customizationsWindow.id = 'waterCustomizationsWindow';
            customizationsWindow.className = 'waterWindow waterWindow-right';
            customizationsWindow.innerHTML = `
                <div class="waterWindowContent">
                    <div class="setHedS">
                        Scripts
                        <span class="material-icons-outlined header-folder-btn"
                              onclick="window.openScriptsFolder()"
                              title="Open Scripts Folder">
                            folder_open
                        </span>
                    </div>
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
            requestAnimationFrame(() => { requestAnimationFrame(positionWindows); });
            this.renderThemes();
            this.renderThemeVariables();
            this.renderScripts();
            this.renderUIToggles();
        }
        catch (e) {
            console.error('[Water] Water window error:', e);
        }
    }
    getWaterWindowCSS() {
        return `
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
                max-height: calc(86vh - 5px);
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
            #water-themes-list {
                margin-top: 15px;
            }
            #waterThemesWindow .setBodH {
                padding-bottom: 10px;
            }
            .no-items-msg {
                color: rgba(255, 255, 255, 0.5);
                font-size: 16px;
                text-align: center;
                padding: 20px;
            }
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
            .header-reset-btn {
                position: absolute;
                top: 15px;
                right: 35px;
                color: rgba(255, 255, 255, 0.8);
                cursor: pointer;
                font-size: 30px;
                transition: transform 0.3s ease, color 0.3s ease;
            }
            .header-reset-btn:hover {
                color: #ff69b4;
                transform: rotate(180deg);
            }
            .header-folder-btn {
                position: absolute;
                top: 15px;
                right: 35px;
                color: rgba(255, 255, 255, 0.8);
                cursor: pointer;
                font-size: 30px;
                transition: color 0.3s ease, transform 0.2s ease;
            }
            .header-folder-btn:hover {
                color: #ff69b4;
                transform: scale(1.1);
            }
            .waterWindow .setHedS {
                position: relative;
            }
            #water-theme-variables-section {
                margin-top: 10px;
            }
            #water-theme-variables .settName {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            #water-theme-variables .detailedSettingName {
                flex: 1;
            }
            #water-theme-variables .name {
                color: rgba(255, 255, 255, 0.85);
                font-size: 14px;
                font-weight: 500;
                font-family: 'gamefont';
            }
            #water-theme-variables .inputGrey2 {
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                padding: 6px 10px;
                color: rgba(255, 255, 255, 0.9);
                font-size: 13px;
                font-family: 'gamefont';
                transition: all 0.2s;
            }
            #water-theme-variables .inputGrey2:focus {
                outline: none;
                border-color: rgba(255, 105, 180, 0.5);
                background: rgba(0, 0, 0, 0.4);
            }
            #water-theme-variables input[type="color"] {
                background: transparent;
                cursor: pointer;
                padding: 0;
            }
            #water-theme-variables input[type="color"]::-webkit-color-swatch-wrapper {
                padding: 0;
            }
            #water-theme-variables input[type="color"]::-webkit-color-swatch {
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 4px;
            }
        `;
    }
    renderThemes() {
        try {
            const list = document.getElementById('water-themes-list');
            const localList = document.getElementById('water-local-themes-list');
            if (list) {
                let html = '';
                if (this.builtinThemes.length > 0) {
                    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 0px; margin-top: 0px;">';
                    html += this.builtinThemes.map(t => {
                        const isActive = t.id === this.activeThemeId;
                        const thumbnailPath = t.thumbnail ?
                            `client-resource://assets/community-css/thumbnails/${t.thumbnail}`
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
                if (html === '') {
                    html = '<div class="no-items-msg">No client themes available.</div>';
                }
                list.innerHTML = html;
            }
            if (localList) {
                let html = '';
                // Combine all local theme arrays (they all point to the same path)
                const allLocalThemes = [
                    ...this.userThemes,
                    ...this.localThemes,
                    ...this.swapperThemes
                ];
                // Remove duplicates based on filename
                const uniqueThemes = allLocalThemes.filter((theme, index, self) => index === self.findIndex(t => t.filename === theme.filename));
                if (uniqueThemes.length > 0) {
                    html += uniqueThemes.map(t => {
                        const isActive = t.id === this.activeThemeId;
                        const filePath = t.filePath || '';
                        return `
                            <div class="theme-item ${isActive ? 'active-theme' : ''}"
                                 onclick="window.applyTheme('${t.id}')"
                                 style="${isActive ? 'border: 1px solid rgba(255, 105, 180, 0.4);' : ''}">
                                <div class="script-name">${t.name}</div>
                                <span class="material-icons-outlined css-edit-btn"
                                      onclick="event.stopPropagation(); window.editCSSFile('${filePath.replace(/\\/g, "\\\\")}')"
                                      title="Edit CSS">
                                    edit
                                </span>
                            </div>
                        `;
                    }).join('');
                }
                if (html === '') {
                    html = '<div class="no-items-msg">No local themes found.</div>';
                }
                localList.innerHTML = html;
            }
            window.applyTheme = (id) => {
                this.applyTheme(id);
                this.renderThemes();
                this.renderThemeVariables();
            };
            window.resetTheme = () => {
                this.resetTheme();
            };
            window.editCSSFile = (filePath) => {
                electron_1.shell.openPath(filePath);
            };
            window.openThemesFolder = () => {
                const themesPath = (0, path_1.join)((0, paths_1.getSwapPath)(), 'css');
                electron_1.shell.openPath(themesPath).catch(err => {
                    console.error('[Water] Failed to open themes folder:', err);
                });
            };
        }
        catch (e) {
            console.error('[Water] Render themes error:', e);
        }
    }
    renderThemeVariables() {
        try {
            const section = document.getElementById('water-theme-variables-section');
            const container = document.getElementById('water-theme-variables');
            if (!section || !container)
                return;
            const isWaterTheme = this.builtinThemes.some(t => t.id === this.activeThemeId);
            if (!isWaterTheme) {
                section.style.display = 'none';
                return;
            }
            section.style.display = 'block';
            container.innerHTML = '';
            const styleEl = document.getElementById('water-community-css');
            if (!styleEl || !styleEl.sheet) {
                container.innerHTML = '<div class="no-items-msg">No variables found in this theme.</div>';
                return;
            }
            const variables = this.parseCSSVariables(styleEl.sheet);
            if (variables.length === 0) {
                container.innerHTML = '<div class="no-items-msg">No variables found in this theme.</div>';
                return;
            }
            const savedVars = this.config.get(`themeVars.${this.activeThemeId}`, {});
            variables.forEach(({ name, value }) => {
                const savedValue = savedVars[name] || value;
                const varItem = document.createElement('div');
                varItem.className = 'settName';
                varItem.style.marginBottom = '10px';
                const nameContainer = document.createElement('span');
                nameContainer.className = 'detailedSettingName';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'name';
                nameSpan.textContent = name.replace('--', '');
                nameContainer.appendChild(nameSpan);
                const calculateWidth = (val) => {
                    const baseWidth = 80;
                    const charWidth = 8;
                    const maxWidth = 300;
                    const minWidth = 80;
                    const calculatedWidth = Math.min(maxWidth, Math.max(minWidth, baseWidth + (val.length * charWidth)));
                    return calculatedWidth;
                };
                const trimmedValue = value.trim();
                let input;
                if (trimmedValue.startsWith('#') ||
                    trimmedValue.startsWith('rgb') ||
                    trimmedValue.startsWith('hsl') ||
                    name.toLowerCase().includes('color') ||
                    name.toLowerCase().includes('bg')) {
                    const colorWrapper = document.createElement('div');
                    colorWrapper.style.display = 'flex';
                    colorWrapper.style.gap = '8px';
                    colorWrapper.style.alignItems = 'center';
                    input = document.createElement('input');
                    input.className = 'inputGrey2';
                    input.type = 'text';
                    input.value = savedValue;
                    input.placeholder = value;
                    input.style.width = calculateWidth(savedValue) + 'px';
                    const colorPicker = document.createElement('input');
                    colorPicker.type = 'color';
                    colorPicker.style.width = '50px';
                    colorPicker.style.height = '30px';
                    colorPicker.style.cursor = 'pointer';
                    colorPicker.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                    colorPicker.style.borderRadius = '4px';
                    const hexColor = this.convertToHex(savedValue);
                    if (hexColor)
                        colorPicker.value = hexColor;
                    colorPicker.oninput = () => {
                        input.value = colorPicker.value;
                        input.style.width = calculateWidth(colorPicker.value) + 'px';
                        this.updateThemeVariable(name, colorPicker.value);
                    };
                    input.oninput = () => {
                        input.style.width = calculateWidth(input.value) + 'px';
                    };
                    input.onchange = () => {
                        const hexColor = this.convertToHex(input.value);
                        if (hexColor)
                            colorPicker.value = hexColor;
                        this.updateThemeVariable(name, input.value);
                    };
                    colorWrapper.appendChild(input);
                    colorWrapper.appendChild(colorPicker);
                    varItem.appendChild(nameContainer);
                    varItem.appendChild(colorWrapper);
                }
                else if (/^-?\d+(\.\d+)?(px|em|rem|%|vh|vw|s|ms)$/.test(trimmedValue)) {
                    input = document.createElement('input');
                    input.className = 'inputGrey2';
                    input.type = 'text';
                    input.value = savedValue;
                    input.placeholder = value;
                    input.style.width = calculateWidth(savedValue) + 'px';
                    input.oninput = () => {
                        input.style.width = calculateWidth(input.value) + 'px';
                    };
                    input.onchange = () => {
                        this.updateThemeVariable(name, input.value);
                    };
                    varItem.appendChild(nameContainer);
                    varItem.appendChild(input);
                }
                else {
                    input = document.createElement('input');
                    input.className = 'inputGrey2';
                    input.type = 'text';
                    input.value = savedValue;
                    input.placeholder = value;
                    input.style.width = calculateWidth(savedValue) + 'px';
                    input.oninput = () => {
                        input.style.width = calculateWidth(input.value) + 'px';
                    };
                    input.onchange = () => {
                        this.updateThemeVariable(name, input.value);
                    };
                    varItem.appendChild(nameContainer);
                    varItem.appendChild(input);
                }
                container.appendChild(varItem);
            });
        }
        catch (e) {
            console.error('[Water] Render theme variables error:', e);
        }
    }
    convertToHex(color) {
        try {
            const trimmed = color.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
                return trimmed;
            }
            const rgbMatch = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
                const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
                const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
            const temp = document.createElement('div');
            temp.style.color = trimmed;
            document.body.appendChild(temp);
            const computed = window.getComputedStyle(temp).color;
            document.body.removeChild(temp);
            const computedMatch = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (computedMatch) {
                const r = parseInt(computedMatch[1]).toString(16).padStart(2, '0');
                const g = parseInt(computedMatch[2]).toString(16).padStart(2, '0');
                const b = parseInt(computedMatch[3]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
            return null;
        }
        catch (e) {
            return null;
        }
    }
    parseCSSVariables(sheet) {
        const variables = [];
        try {
            for (let i = 0; i < sheet.cssRules.length; i++) {
                const rule = sheet.cssRules[i];
                if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
                    for (let j = 0; j < rule.style.length; j++) {
                        const prop = rule.style[j];
                        if (prop.startsWith('--')) {
                            const value = rule.style.getPropertyValue(prop).trim();
                            variables.push({ name: prop, value });
                        }
                    }
                }
            }
        }
        catch (e) {
            console.error('[Water] Error parsing CSS variables:', e);
        }
        return variables;
    }
    updateThemeVariable(name, value) {
        try {
            const savedVars = this.config.get(`themeVars.${this.activeThemeId}`, {});
            savedVars[name] = value;
            this.config.set(`themeVars.${this.activeThemeId}`, savedVars);
            this.applyThemeVariables();
        }
        catch (e) {
            console.error('[Water] Error updating theme variable:', e);
        }
    }
    applyThemeVariables() {
        try {
            const savedVars = this.config.get(`themeVars.${this.activeThemeId}`, {});
            let styleEl = document.getElementById('water-theme-vars');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'water-theme-vars';
                document.head.appendChild(styleEl);
            }
            let css = ':root {\n';
            for (const [name, value] of Object.entries(savedVars)) {
                if (value) {
                    css += `  ${name}: ${value};\n`;
                }
            }
            css += '}';
            styleEl.textContent = css;
        }
        catch (e) {
            console.error('[Water] Error applying theme variables:', e);
        }
    }
    applyTheme(themeId) {
        try {
            console.log('[Water] Attempting to apply theme:', themeId);
            let theme = this.builtinThemes.find(t => t.id === themeId);
            let cssContent = '';
            if (theme && theme.filename) {
                console.log('[Water] Found builtin theme:', theme.name);
                const themePath = (0, path_1.join)(__dirname, '../../assets/community-css/themes', theme.filename);
                cssContent = (0, fs_1.readFileSync)(themePath, 'utf-8');
            }
            else {
                // For local themes, try all arrays since they point to the same folder
                // Strip the prefix and search by filename instead
                const themeFilename = themeId.replace(/^(user|local|swapper)-/, '');
                console.log('[Water] Searching for local theme with filename:', themeFilename);
                theme = this.swapperThemes.find(t => t.id === themeId || t.filename === themeFilename + '.css' || t.filename === themeFilename + '.txt');
                if (!theme) {
                    theme = this.localThemes.find(t => t.id === themeId || t.filename === themeFilename + '.css' || t.filename === themeFilename + '.txt');
                }
                if (!theme) {
                    theme = this.userThemes.find(t => t.id === themeId || t.filename === themeFilename + '.css' || t.filename === themeFilename + '.txt');
                }
                if (theme && theme.filePath) {
                    console.log('[Water] Found local theme:', theme.name, 'at', theme.filePath);
                    if ((0, fs_1.existsSync)(theme.filePath)) {
                        cssContent = (0, fs_1.readFileSync)(theme.filePath, 'utf-8');
                        console.log('[Water] Loaded CSS content, length:', cssContent.length);
                    }
                    else {
                        console.error('[Water] Theme file does not exist:', theme.filePath);
                    }
                }
                else {
                    console.error('[Water] Theme not found:', themeId);
                }
            }
            if (cssContent) {
                let styleEl = document.getElementById('water-community-css');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'water-community-css';
                    document.head.appendChild(styleEl);
                }
                styleEl.textContent = cssContent;
                this.activeThemeId = themeId;
                localStorage.setItem('water-active-theme', themeId);
                this.applyThemeVariables();
                console.log('[Water] Theme applied successfully:', themeId);
            }
            else {
                console.error('[Water] No CSS content loaded for theme:', themeId);
            }
        }
        catch (e) {
            console.error('[Water] Failed to apply theme:', e);
        }
    }
    resetTheme() {
        try {
            const el = document.getElementById('water-community-css');
            if (el)
                el.remove();
            const varsEl = document.getElementById('water-theme-vars');
            if (varsEl)
                varsEl.remove();
            this.activeThemeId = 'default';
            localStorage.setItem('water-active-theme', 'default');
            this.renderThemes();
            this.renderThemeVariables();
            console.log('[Water] CSS reset to default');
        }
        catch (e) {
            console.error('[Water] Failed to reset CSS:', e);
        }
    }
    renderScripts() {
        try {
            const list = document.getElementById('water-scripts-list');
            if (!list)
                return;
            const userscriptsEnabled = config_1.default.get('resourceswapper.enableUserscripts', true);
            if (!userscriptsEnabled) {
                list.innerHTML = `
                    <div style="background: rgba(255, 100, 100, 0.15); border: 1px solid rgba(255, 100, 100, 0.3); border-radius: 6px; padding: 15px; margin-bottom: 20px; margin-top: 15px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <span class="material-icons" style="color: #ff6464; font-size: 24px;">warning</span>
                            <span style="color: #ff6464; font-weight: 600; font-size: 15px;">Userscripts Disabled</span>
                        </div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 13px; line-height: 1.5;">
                            Enable them from Settings > Client > Miscellaneous > Enable Userscripts
                        </div>
                    </div>
                `;
                return;
            }
            if (!su.userscripts || su.userscripts.length === 0) {
                list.innerHTML = '<div class="no-items-msg">No scripts found. Place .js files in Documents\\Water\\Scripts</div>';
                return;
            }
            list.innerHTML = su.userscripts.map(script => {
                const scriptId = script.name.replace('.js', '');
                const isEnabled = config_1.default.get(`userscripts.${script.name}.enabled`, true);
                const dropdownId = `water-script-settings-${scriptId}`;
                const scriptName = (script.meta && script.meta.name) || script.name;
                const scriptAuthor = (script.meta && script.meta.author) ? ` by ${script.meta.author}` : '';
                const scriptVersion = (script.meta && script.meta.version) ? ` v${script.meta.version}` : '';
                const scriptDesc = (script.meta && script.meta.desc) || '';
                const hasSettings = script.settings && Object.keys(script.settings).length > 0;
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
                        .map(key => this.renderSettingControl(key, script.settings[key], script.name))
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
            window.toggleWaterScript = (scriptName, enabled) => {
                config_1.default.set(`userscripts.${scriptName}.enabled`, enabled);
                console.log(`[Water] Script ${scriptName}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
                console.log('[Water] Restart client to apply script changes');
            };
            window.toggleScriptSettings = (scriptId) => {
                const dropdown = document.getElementById(`water-script-settings-${scriptId}`);
                const arrow = document.getElementById(`arrow-${scriptId}`);
                if (dropdown && arrow) {
                    const isHidden = dropdown.style.display === 'none';
                    dropdown.style.display = isHidden ? 'block' : 'none';
                    arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                }
            };
            window.updateScriptSetting = (scriptName, settingKey, value) => {
                const script = su.userscripts.find(s => s.name === scriptName);
                if (!script || !script.settings || !script.settings[settingKey]) {
                    console.error('[Water] Setting not found:', scriptName, settingKey);
                    return;
                }
                script.settings[settingKey].value = value;
                if (typeof script.settings[settingKey].changed === 'function') {
                    try {
                        script.settings[settingKey].changed(value);
                        console.log(`[Water] Setting updated: ${scriptName} > ${settingKey} = ${value}`);
                    }
                    catch (e) {
                        console.error('[Water] Error calling setting changed callback:', e);
                    }
                }
                // Save to config instead of JSON file
                try {
                    const configKey = `userscript.${scriptName.replace(/\.js$/, '')}`;
                    const savedSettings = config_1.default.get(configKey, {});
                    savedSettings[settingKey] = value;
                    config_1.default.set(configKey, savedSettings);
                }
                catch (e) {
                    console.error('[Water] Failed to save setting to config:', e);
                }
            };
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
                    const modifiers = [
                        keybind.ctrl ? 'Ctrl' : '',
                        keybind.alt ? 'Alt' : '',
                        keybind.shift ? 'Shift' : ''
                    ].filter(m => m).join(' + ');
                    const displayKey = modifiers ? `${modifiers} + ${keybind.key.toUpperCase()}` : keybind.key.toUpperCase();
                    button.textContent = displayKey;
                    button.style.background = '';
                    window.updateScriptSetting(scriptName, settingKey, keybind);
                    document.removeEventListener('keydown', handleKeyPress, true);
                };
                document.addEventListener('keydown', handleKeyPress, true);
            };
            window.openScriptsFolder = () => {
                const scriptsPath = (0, paths_1.getScriptsPath)();
                electron_1.shell.openPath(scriptsPath).catch(err => {
                    console.error('[Water] Failed to open scripts folder:', err);
                });
            };
        }
        catch (e) {
            console.error('[Water] Render scripts error:', e);
            const list = document.getElementById('water-scripts-list');
            if (list)
                list.innerHTML = `<div class="no-items-msg" style="color: #ff5555">Error: ${e}</div>`;
        }
    }
    renderSettingControl(settingKey, setting, scriptName) {
        const settingId = `water-script-setting-${scriptName}-${settingKey}`;
        if (!setting || typeof setting !== 'object')
            return '';
        if (!setting.title || !setting.type || setting.value === undefined)
            return '';
        if (typeof setting.changed !== 'function')
            return '';
        let controlHTML = '';
        const tip = setting.desc || '';
        switch (setting.type) {
            case 'bool':
                if (typeof setting.value !== 'boolean')
                    return '';
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
                if (typeof setting.value !== 'number')
                    return '';
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
                if (!Array.isArray(setting.opts) || setting.opts.length < 2)
                    return '';
                if (!setting.opts.includes(setting.value))
                    return '';
                controlHTML = `
                    <select id="${settingId}"
                            class="inputGrey2"
                            style="min-width: 150px; padding: 8px 12px;"
                            onchange="window.updateScriptSetting('${scriptName}', '${settingKey}', this.value)">
                        ${setting.opts.map((opt) => `<option value="${opt}" ${opt === setting.value ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                `;
                break;
            case 'color':
                if (typeof setting.value !== 'string' || !setting.value.match(/^#([0-9a-fA-F]{3}){2}$/))
                    return '';
                controlHTML = `
                    <input type="color" id="${settingId}"
                           value="${setting.value}"
                           style="width: 50px; height: 32px; border: 2px solid rgba(255,255,255,0.2); border-radius: 4px; background: transparent; cursor: pointer;"
                           onchange="window.updateScriptSetting('${scriptName}', '${settingKey}', this.value)">
                `;
                break;
            case 'keybind':
                if (typeof setting.value !== 'object' || Array.isArray(setting.value))
                    return '';
                if (typeof setting.value.alt !== 'boolean' || typeof setting.value.ctrl !== 'boolean' ||
                    typeof setting.value.shift !== 'boolean' || typeof setting.value.key !== 'string')
                    return '';
                const kb = setting.value;
                const modifiers = [
                    kb.ctrl ? 'Ctrl' : '',
                    kb.alt ? 'Alt' : '',
                    kb.shift ? 'Shift' : ''
                ].filter((m) => m).join(' + ');
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
    }
    renderUIToggles() {
        try {
            const list = document.getElementById('water-ui-list');
            if (!list)
                return;
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
                if (!toggle)
                    return;
                if (toggle.isModsButton) {
                    localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                    this.injectModsButton();
                    return;
                }
                if (toggleId === 'hideWaterLoader') {
                    localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                    config_1.default.set('hideWaterLoader', enabled);
                    console.log(`[Water] hideWaterLoader saved:`, enabled);
                    return;
                }
                localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                console.log(`[Water] UI Toggle ${toggleId}: ${enabled ? 'ON' : 'OFF'}`);
                this.applyUIToggles();
            };
        }
        catch (e) {
            console.error('[Water] Render UI toggles error:', e);
        }
    }
    getUIToggles() {
        return [
            { id: 'hideWaterLoader', name: 'Hide Water Loader', css: '', defaultOn: false, requiresRestart: true },
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
            { id: 'hideRaffles', name: 'Hide Raffles', css: '.main-menu-button-container.svelte-f3amho[style="top: 472px; left: 520px; --border-color:#DC2626;"] {display: none !important;}', defaultOn: true },
            { id: 'hideDoubleXP', name: 'Hide Double XP', css: '#doubleXPButton {display: none !important;}', defaultOn: true }
        ];
    }
    applyUIToggles() {
        try {
            const toggles = this.getUIToggles();
            const styleId = 'water-ui-toggles';
            const existingStyle = document.getElementById(styleId);
            if (existingStyle)
                existingStyle.remove();
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
        }
        catch (e) {
            console.error('[Water] Apply UI toggles error:', e);
        }
    }
}
exports.default = Water;
