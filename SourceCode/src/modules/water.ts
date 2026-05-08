import { Context, RunAt } from '../context';
import Module from '../module';
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { shell } from 'electron';
import { getSwapPath, getScriptsPath, copyBundledScripts } from '../utils/paths';
import { initializeUserscripts, su } from './userscript-loader';
import { modDownloader } from './mod-downloader';
import config from '../config';
import { errorManager } from './userscript-error-manager';
import { performanceMonitor } from './userscript-performance-monitor';
import { dependencyManager } from './userscript-dependency-manager';
import { hotReload } from './userscript-hot-reload';

// Node.js type declarations
declare const __dirname: string;
declare const require: (id: string) => any;

interface Theme {
    id: string;
    name: string;
    author: string;
    filename?: string;
    filePath?: string;
    thumbnail?: string;
}

interface UIToggle {
    id: string;
    name: string;
    css: string;
    js?: string; // Optional JavaScript to execute when toggle is enabled
    defaultOn: boolean;
    requiresRestart?: boolean;
    isModsButton?: boolean;
}

export default class Water extends Module {
    name = 'Water';
    id = 'water';
    options = [];
    
    constructor() {
        super();
    }
    
    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        }
    ];

    private builtinThemes: Theme[] = [];
    private userThemes: Theme[] = [];
    private localThemes: Theme[] = [];
    private swapperThemes: Theme[] = [];
    private activeThemeId: string = 'default';
    private userCSSPath: string = '';
    private localThemesPath: string = '';
    private swapperThemesPath: string = '';
    private retryCount: number = 0;
    private maxRetries: number = 10;
    private eventsRegistered = false;
    
    init() {
        // Set up global water object for module access
        if (!(window as any).water) {
            (window as any).water = {
                modules: []
            };
        }

        // Add this module to the global water object
        const waterGlobal = (window as any).water;
        if (!waterGlobal.modules.find((m: any) => m.id === this.id)) {
            waterGlobal.modules.push(this);
        }

        // Also add other loaded modules from manager if available
        if (this.manager && this.manager.loaded) {
            for (const module of this.manager.loaded) {
                if (!waterGlobal.modules.find((m: any) => m.id === module.id)) {
                    waterGlobal.modules.push(module);
                }
            }
        }

        try {
            const manifestPath = join(__dirname, '../../assets/community-css/manifest.json');
            if (existsSync(manifestPath)) {
                this.builtinThemes = JSON.parse(readFileSync(manifestPath, 'utf-8'));
                console.log('[Water] Loaded', this.builtinThemes.length, 'builtin themes');
            }
        } catch (e) {
            console.error('[Water] Failed to load manifest:', e);
        }

        const swapperCssPath = join(getSwapPath(), 'css');
        const userscriptsPath = getScriptsPath();
        
        // Ensure Swap and Scripts folder structure exists
        try {
            if (!existsSync(swapperCssPath)) {
                mkdirSync(swapperCssPath, { recursive: true });
                console.log('[Water] Created Swap/css folder:', swapperCssPath);
            }
            if (!existsSync(userscriptsPath)) {
                mkdirSync(userscriptsPath, { recursive: true });
                console.log('[Water] Created Scripts folder:', userscriptsPath);
            }
        } catch (e) {
            console.error('[Water] Failed to create Water folders:', e);
        }

        // Copy bundled scripts (like SkyColor) to user's Scripts folder
        copyBundledScripts(userscriptsPath);
        
        this.userCSSPath = swapperCssPath;
        this.localThemesPath = swapperCssPath;
        this.swapperThemesPath = swapperCssPath;

        // Load local themes once (all three paths point to the same folder)
        this.loadLocalThemes();

        const saved = localStorage.getItem('water-active-theme');
        if (saved) this.activeThemeId = saved;
        
        console.log('[Water] Userscripts path:', userscriptsPath);
        
        const userscriptsEnabled = config.get('modules.resourceswapper.enableUserscripts', true) as boolean;
        console.log('[Water] Config modules.resourceswapper.enableUserscripts =', userscriptsEnabled);
        if (userscriptsEnabled) {
            console.log('[Water] Initializing userscripts...');
            
            // Initialize userscripts asynchronously (don't block)
            initializeUserscripts(userscriptsPath, config).then(() => {
                console.log('[Water] Userscripts initialized, loaded:', su.userscripts.length, 'scripts');
                su.userscripts.forEach(s => console.log('[Water] Script loaded:', s.name, 'Settings:', Object.keys(s.settings).length));
            }).catch(e => {
                console.error('[Water] Error initializing userscripts:', e);
            });
            
            // Also load purchased scripts from GitHub
            console.log('[Water] Loading purchased scripts from GitHub...');
            this.loadPurchasedScripts().catch(e => {
                console.error('[Water] Error loading purchased scripts:', e);
            });

            // Listen for userscripts updates from cache loader (only once)
            if (!this.eventsRegistered) {
                this.eventsRegistered = true;
                window.addEventListener('userscriptsUpdated', () => {
                    console.log('[Water] Received userscriptsUpdated event, refreshing UI...');
                    this.renderScripts();
                });
                
                // Listen for purchased script reload requests
                window.addEventListener('reloadPurchasedScript', async (e: any) => {
                    const { scriptName } = e.detail;
                    console.log('[Water] Received reload request for purchased script:', scriptName);
                    
                    // Find script item in Supabase to get its details
                    try {
                        const storeModule = this.manager?.loaded.find((m: any) => m.id === 'store');
                        if (!storeModule) return;
                        
                        const supabase = (storeModule as any).supabase;
                        if (!supabase) return;
                        
                        // Get script details
                        const { data: scripts } = await supabase
                            .from('premium_items')
                            .select('id, name, author, description, github_path')
                            .eq('name', scriptName)
                            .eq('type', 'userscript')
                            .limit(1);
                        
                        if (scripts && scripts.length > 0) {
                            await this.loadPurchasedScript(scripts[0]);
                            this.renderScripts();
                            console.log('[Water] Successfully reloaded purchased script:', scriptName);
                        }
                    } catch (err) {
                        console.error('[Water] Failed to reload purchased script:', err);
                    }
                });
            }
        } else {
            console.log('[Water] Userscripts disabled, clearing any existing scripts');
            su.userscripts = []; // Clear any previously loaded scripts
        }
    }

    // Load purchased scripts from GitHub
    async loadPurchasedScripts() {
        try {
            console.log('[Water] Loading purchased scripts from GitHub...');

            // Check retry limit
            if (this.retryCount >= this.maxRetries) {
                console.error('[Water] Max retries reached for loading purchased scripts');
                return;
            }

            // Try to find Store module through the manager
            let storeModule = null;

            if (this.manager && this.manager.loaded) {
                storeModule = this.manager.loaded.find((m: any) => m.id === 'store');
            }

            // If not found through manager, try global water object
            if (!storeModule && (window as any).water && (window as any).water.modules) {
                storeModule = (window as any).water.modules.find((m: any) => m.id === 'store');
            }

            // If still not found, wait and retry
            if (!storeModule) {
                this.retryCount++;
                console.log(`[Water] Store module not found, retrying in 3 seconds... (${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => {
                    this.loadPurchasedScripts();
                }, 3000);
                return;
            }

            const supabase = (storeModule as any).supabase;
            if (!supabase) {
                this.retryCount++;
                console.log(`[Water] Supabase not initialized in store module, retrying in 3 seconds... (${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => {
                    this.loadPurchasedScripts();
                }, 3000);
                return;
            }

            // Reset retry count on successful connection
            this.retryCount = 0;

            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) {
                console.log('[Water] No client ID found, skipping purchased scripts');
                return;
            }

            // Get discord_id
            const { data: profileData } = await supabase
                .from('user_profiles')
                .select('discord_id')
                .eq('client_id', clientId)
                .limit(1);

            if (!profileData || profileData.length === 0 || !profileData[0].discord_id) {
                console.log('[Water] No Discord linked, skipping purchased scripts');
                return;
            }

            const discordId = profileData[0].discord_id;

            // Get purchased scripts
            const { data: purchases } = await supabase
                .from('user_purchases')
                .select('item_id')
                .eq('discord_id', discordId);

            if (!purchases || purchases.length === 0) {
                console.log('[Water] No purchased items found');
                return;
            }

            const itemIds = purchases.map((p: any) => p.item_id);

            // Get script details - all purchased scripts load from GitHub
            const { data: scripts } = await supabase
                .from('premium_items')
                .select('id, name, author, description, github_path')
                .in('id', itemIds)
                .eq('type', 'userscript');

            if (!scripts || scripts.length === 0) {
                console.log('[Water] No purchased scripts found');
                return;
            }

            // Filter to only scripts that have GitHub path
            const scriptsNeedingGitHub = scripts.filter((s: any) => s.github_path);

            if (scriptsNeedingGitHub.length === 0) {
                console.log('[Water] No scripts with GitHub path found');
                return;
            }

            console.log('[Water] Found', scriptsNeedingGitHub.length, 'scripts to load from GitHub');

            // Load each script (check if enabled first)
            for (const scriptItem of scriptsNeedingGitHub) {
                // Use separate namespace for purchased scripts: userscripts.purchased.{name}.enabled
                const isEnabled = config.get(`userscripts.purchased.${scriptItem.name}.enabled`, true) as boolean;
                if (isEnabled) {
                    console.log(`[Water] Loading enabled purchased script from GitHub: ${scriptItem.name}`);
                    await this.loadPurchasedScript(scriptItem);
                } else {
                    console.log(`[Water] Skipping disabled purchased script: ${scriptItem.name}`);

                    // Still add to userscripts array for UI display, but don't execute
                    const { su } = require('./userscript-loader');
                    su.userscripts.push({
                        hasRan: false,
                        strictMode: false,
                        name: scriptItem.name,
                        fullpath: `[PURCHASED] ${scriptItem.name}`,
                        meta: {
                            name: scriptItem.name,
                            author: scriptItem.author || 'Unknown',
                            desc: scriptItem.description || ''
                        },
                        unload: false,
                        settings: {},
                        runAt: 'document-end',
                        priority: 0,
                        content: '',
                        load: function() {}
                    });
                }
            }

            // Refresh the Water window scripts list if it's open
            setTimeout(() => {
                this.renderScripts();
            }, 500);

        } catch (e) {
            console.error('[Water] Failed to load purchased scripts:', e);
        }
    }

    async loadPurchasedScript(scriptItem: any) {
        try {
            const { fetchGitHubContent } = require('../utils/github');

            console.log('[Water] Loading purchased script from GitHub:', scriptItem.name);

            const result = await fetchGitHubContent(scriptItem.github_path);
            if (!result.success || !result.content) {
                console.error('[Water] Failed to fetch script content from GitHub:', scriptItem.name);
                return;
            }

            // Use the Userscript class exactly like local scripts
            const { Userscript, su } = require('./userscript-loader');

            // Create userscript with content from GitHub (same as local, just different source)
            const userscript = new Userscript({
                name: scriptItem.name,
                fullpath: `[PURCHASED] ${scriptItem.name}`,
                content: result.content
            });

            // Mark as premium for config namespace
            userscript.scriptType = 'premium';

            // Execute the script (this handles everything: IIFE detection, settings extraction, etc.)
            await userscript.load();

            // Add to array
            su.userscripts.push(userscript);
            console.log('[Water] Added purchased script to userscripts array:', scriptItem.name, 'Settings:', Object.keys(userscript.settings).length);

            // Refresh UI if settings page is open
            this.renderScripts();

        } catch (e) {
            console.error('[Water] Failed to load purchased script:', scriptItem.name, e);
        }
    }

    private parseConfigFromScript(content: string, scriptName: string): any {
        const settings: any = {};
        
        // Patterns to match: const CONFIG = {...}, const config = {...}, etc.
        const patterns = [
            /(?:const|let|var)\s+CONFIG\s*=\s*(\{[\s\S]*?\});?$/m,
            /(?:const|let|var)\s+config\s*=\s*(\{[\s\S]*?\});?$/m,
            /(?:const|let|var)\s+options\s*=\s*(\{[\s\S]*?\});?$/m,
        ];
        
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                try {
                    // Extract just the object part (group 1)
                    const configStr = match[1];
                    // Safely parse the config object
                    const configObj = new Function('return ' + configStr)();
                    
                    // Convert to settings format
                    for (const [key, value] of Object.entries(configObj)) {
                        // Skip nested objects and functions
                        if (typeof value === 'object' && value !== null && !Array.isArray(value)) continue;
                        if (typeof value === 'function') continue;
                        
                        const setting: any = {
                            title: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
                            value: value,
                            changed: (newVal: any) => {
                                console.log(`[Water] Setting ${key} changed to:`, newVal);
                                // Dispatch event to update the running script's config
                                const cleanName = scriptName.replace(/\s+/g, '');
                                const eventName = cleanName.charAt(0).toLowerCase() + cleanName.slice(1) + 'UpdateConfig';
                                window.dispatchEvent(new CustomEvent(eventName, {
                                    detail: { [key]: newVal }
                                }));
                            }
                        };
                        
                        // Determine type (must match renderSettingControl expectations)
                        if (typeof value === 'boolean') {
                            setting.type = 'bool';
                        } else if (typeof value === 'number') {
                            setting.type = 'num';
                            const keyLower = key.toLowerCase();
                            if (keyLower.includes('volume')) {
                                setting.min = 0;
                                setting.max = 1;
                                setting.step = 0.1;
                            } else if (keyLower === 'verticalposition') {
                                // Percentage from top (0-100)
                                setting.min = 0;
                                setting.max = 100;
                                setting.step = 1;
                            } else if (keyLower === 'streakresettime') {
                                // Streak reset: 0-20 seconds in ms
                                setting.min = 0;
                                setting.max = 20000;
                                setting.step = 1000;
                            } else if (keyLower === 'fadeoutdelay') {
                                // Fade out delay: 0-10 seconds in ms
                                setting.min = 0;
                                setting.max = 10000;
                                setting.step = 100;
                            } else if (keyLower.includes('time') || keyLower.includes('delay')) {
                                setting.min = 0;
                                setting.max = 60000;
                                setting.step = 100;
                            } else if (keyLower.includes('size') || keyLower.includes('font')) {
                                setting.min = 0;
                                setting.max = 500;
                                setting.step = 1;
                            } else {
                                setting.min = 0;
                                setting.max = 2000;
                                setting.step = 1;
                            }
                        } else if (typeof value === 'string' && value.match(/^#([0-9a-fA-F]{3}){2}$/)) {
                            setting.type = 'color';
                        } else {
                            setting.type = 'text';
                        }
                        
                        settings[key] = setting;
                    }
                    
                    if (Object.keys(settings).length > 0) {
                        console.log(`[Water] Parsed ${Object.keys(settings).length} settings from config in ${scriptName}`);
                        return settings;
                    }
                } catch (e) {
                    console.warn(`[Water] Failed to parse config from ${scriptName}:`, e);
                }
            }
        }
        
        return settings;
    }

    private loadSavedSettings(userscript: any, scriptName: string) {
        // Load saved settings from config (use purchased namespace)
        if (!userscript.settings || Object.keys(userscript.settings).length === 0) {
            return;
        }

        try {
            const configKey = `userscript.purchased.${scriptName.replace(/\.js$/, '')}`;
            const savedSettings = config.get(configKey, {});

            Object.keys(savedSettings).forEach(settingKey => {
                if (settingKey in userscript.settings
                    && typeof userscript.settings[settingKey].changed === 'function'
                    && typeof savedSettings[settingKey] === typeof userscript.settings[settingKey].value) {

                    const savedValue = savedSettings[settingKey];
                    const currentValue = userscript.settings[settingKey].value;

                    userscript.settings[settingKey].value = savedValue;

                    if (savedValue !== currentValue) {
                        userscript.settings[settingKey].changed(savedValue);
                    }
                }
            });
        } catch (e) {
            console.error(`[Water] Error loading saved settings for ${scriptName}:`, e);
        }
    }

    private configToSettings(config: any, scriptName: string): any {
        const settings: any = {};

        for (const [key, value] of Object.entries(config)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                continue;
            }

            let setting: any = {
                title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
                desc: `Configure ${key}`,
                value: value,
                changed: (newValue: any) => {
                    config[key] = newValue;
                    console.log(`[Water] ${scriptName} config.${key} = ${newValue}`);
                }
            };

            if (typeof value === 'boolean') {
                setting.type = 'bool';
            } else if (typeof value === 'number') {
                setting.type = 'num';
                const keyLower = key.toLowerCase();
                if (keyLower.includes('volume') || keyLower.includes('opacity') || keyLower.includes('alpha')) {
                    setting.min = 0; setting.max = 1; setting.step = 0.01;
                } else if (keyLower.includes('percent') || keyLower.includes('position')) {
                    setting.min = 0; setting.max = 100; setting.step = 1;
                } else if (keyLower.includes('time') || keyLower.includes('delay') || keyLower.includes('duration')) {
                    setting.min = 0; setting.max = 10000; setting.step = 100;
                } else if (keyLower.includes('size') || keyLower.includes('scale') || keyLower.includes('zoom')) {
                    setting.min = 0.1; setting.max = 5; setting.step = 0.1;
                } else {
                    setting.min = Math.min(0, (value as number) - 100);
                    setting.max = Math.max(100, (value as number) + 100);
                    setting.step = (value as number) < 10 ? 0.1 : 1;
                }
            } else if (typeof value === 'string') {
                setting.type = 'text';
            }

            settings[key] = setting;
        }

        return settings;
    }

    loadUserThemes() {
        try {
            if (!existsSync(this.userCSSPath)) {
                console.log('[Water] User CSS path does not exist:', this.userCSSPath);
                return;
            }

            const files = readdirSync(this.userCSSPath);
            console.log('[Water] Files in user CSS path:', files);
            
            this.userThemes = files
                .filter(f => f.endsWith('.css'))
                .map(filename => {
                    const filePath = join(this.userCSSPath, filename);
                    const id = `user-${filename.replace('.css', '')}`;
                    
                    let name = filename.replace('.css', '');
                    let author = 'Unknown';
                    
                    try {
                        const content = readFileSync(filePath, 'utf-8');
                        const nameMatch = content.match(/\/\*\s*@name\s+(.+?)\s*\*\//);
                        const authorMatch = content.match(/\/\*\s*@author\s+(.+?)\s*\*\//);
                        
                        if (nameMatch) name = nameMatch[1];
                        if (authorMatch) author = authorMatch[1];
                    } catch (e) {
                        console.error('[Water] Failed to parse CSS metadata:', e);
                    }

                    return { id, name, author, filename, filePath };
                });

            console.log('[Water] Loaded', this.userThemes.length, 'user themes:', this.userThemes.map(t => t.id));
        } catch (e) {
            console.error('[Water] Failed to load user themes:', e);
        }
    }

    loadLocalThemes() {
        try {
            if (!existsSync(this.localThemesPath)) {
                console.log('[Water] Local themes path does not exist:', this.localThemesPath);
                return;
            }

            const files = readdirSync(this.localThemesPath);
            console.log('[Water] Files in local themes path:', files);
            
            this.localThemes = files
                .filter(f => f.endsWith('.css') || f.endsWith('.txt'))
                .map(filename => {
                    const filePath = join(this.localThemesPath, filename);
                    const ext = filename.split('.').pop();
                    const id = `local-${filename.replace(/\.(css|txt)$/, '')}`;
                    
                    let name = filename.replace(/\.(css|txt)$/, '');
                    let author = 'Unknown';
                    
                    try {
                        const content = readFileSync(filePath, 'utf-8');
                        const nameMatch = content.match(/\/\*\s*@name\s+(.+?)\s*\*\//);
                        const authorMatch = content.match(/\/\*\s*@author\s+(.+?)\s*\*\//);
                        
                        if (nameMatch) name = nameMatch[1];
                        if (authorMatch) author = authorMatch[1];
                    } catch (e) {
                        console.error('[Water] Failed to parse local theme metadata:', e);
                    }

                    return { id, name, author, filename, filePath };
                });

            console.log('[Water] Loaded', this.localThemes.length, 'local themes:', this.localThemes.map(t => t.id));
        } catch (e) {
            console.error('[Water] Failed to load local themes:', e);
        }
    }

    loadSwapperThemes() {
        try {
            if (!existsSync(this.swapperThemesPath)) return;

            const files = readdirSync(this.swapperThemesPath);
            this.swapperThemes = files
                .filter(f => f.endsWith('.css') || f.endsWith('.txt'))
                .map(filename => {
                    const filePath = join(this.swapperThemesPath, filename);
                    const ext = filename.split('.').pop();
                    const id = `swapper-${filename.replace(/\.(css|txt)$/, '')}`;
                    
                    let name = filename.replace(/\.(css|txt)$/, '');
                    let author = 'Unknown';
                    
                    try {
                        const content = readFileSync(filePath, 'utf-8');
                        const nameMatch = content.match(/\/\*\s*@name\s+(.+?)\s*\*\//);
                        const authorMatch = content.match(/\/\*\s*@author\s+(.+?)\s*\*\//);
                        
                        if (nameMatch) name = nameMatch[1];
                        if (authorMatch) author = authorMatch[1];
                    } catch (e) {
                        console.error('[Water] Failed to parse swapper theme metadata:', e);
                    }

                    return { id, name, author, filename, filePath };
                });

            console.log('[Water] Loaded', this.swapperThemes.length, 'swapper themes');
        } catch (e) {
            console.error('[Water] Failed to load swapper themes:', e);
        }
    }

    private listenersAttached = false;

    renderer(ctx: Context) {
        this.injectWaterButtonCSS();
        this.injectWaterButton();
        this.injectCompWaterButton();
        this.applyUIToggles();
        
        if (this.activeThemeId && this.activeThemeId !== 'default') {
            this.applyTheme(this.activeThemeId);
        }

        // Load premium theme if one is active
        this.loadActivePremiumTheme();

        modDownloader.init();
        
        // Add keyboard shortcut for CSS reset (Ctrl + /) - only once
        if (!this.listenersAttached) {
            this.listenersAttached = true;
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === '/') {
                    e.preventDefault();
                    this.resetTheme();
                    console.log('[Water] CSS reset via Ctrl+/');
                }
            });
        }
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
                    return false;
                }

                if (document.getElementById('waterBtn')) {
                    return true;
                }

                const btn = document.createElement('div');
                btn.id = 'waterBtn';
                btn.className = 'menuItem';
                btn.setAttribute('onmouseenter', 'playTick()');
                btn.onclick = () => {
                    if (typeof (window as any).playSelect === 'function') (window as any).playSelect();
                    this.openWaterWindow();
                };

                btn.innerHTML = `
                    <span class="material-icons-outlined menBtnIcn" style="color:#ff69b4;font-size:70px!important">water_drop</span>
                    <div class="menuItemTitle" style="font-size:13px">Water</div>
                `;

                menuContainer.insertBefore(btn, menuContainer.firstChild);

                this.injectModsButton();
                return true;
            } catch (e) {
                console.error('[Water] Button inject error:', e);
                return false;
            }
        };

        if (doInject()) return;

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
                console.log('[Water] Starting to observe menu container');
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
                if (existingBtn) existingBtn.remove();
                return;
            }

            const menuContainer = document.getElementById('menuItemContainer');
            if (!menuContainer) return;

            if (document.getElementById('modsBtn')) return;

            const modsBtn = document.createElement('div');
            modsBtn.id = 'modsBtn';
            modsBtn.className = 'menuItem';
            modsBtn.setAttribute('onmouseenter', 'playTick()');
            modsBtn.onclick = () => {
                if (typeof (window as any).playSelect === 'function') (window as any).playSelect();
                if (typeof (window as any).showWindow === 'function') {
                    (window as any).showWindow(4);
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
            } else {
                menuContainer.appendChild(modsBtn);
            }

            console.log('[Water] Mods button injected successfully');
        } catch (e) {
            console.error('[Water] Mods button inject error:', e);
        }
    }

    injectCompWaterButton() {
        const doInject = () => {
            try {
                const compBtnLst = document.getElementById('compBtnLst');
                if (!compBtnLst) {
                    return false;
                }

                if (document.getElementById('compWaterBtn')) {
                    return true;
                }

                const btn = document.createElement('div');
                btn.id = 'compWaterBtn';
                btn.className = 'compMenBtnS';
                btn.setAttribute('onmouseenter', 'SOUND.play("tick_0",.1)');
                btn.style.backgroundColor = '#ff69b4';
                btn.onclick = () => {
                    if (typeof (window as any).playSelect === 'function') (window as any).playSelect();
                    this.openWaterWindow();
                };

                btn.innerHTML = `
                    <span class="material-icons" style="color:#fff;font-size:40px;vertical-align:middle;margin-bottom:12px">water_drop</span>
                `;

                compBtnLst.insertBefore(btn, compBtnLst.firstChild);

                console.log('[Water] Comp button injected successfully');
                return true;
            } catch (e) {
                console.error('[Water] Comp button inject error:', e);
                return false;
            }
        };

        if (doInject()) return;

        let attempts = 0;
        const retry = () => {
            attempts++;
            if (attempts > 30) {
                console.error('[Water] Failed to inject comp button after 30 attempts');
                return;
            }
            if (!doInject()) {
                setTimeout(retry, 500);
            }
        };
        setTimeout(retry, 500);

        const observer = new MutationObserver(() => {
            if (!document.getElementById('compWaterBtn')) {
                const compBtnLst = document.getElementById('compBtnLst');
                if (compBtnLst && compBtnLst.children.length > 0) {
                    doInject();
                }
            }
        });

        const watchForContainer = setInterval(() => {
            const compBtnLst = document.getElementById('compBtnLst');
            if (compBtnLst) {
                clearInterval(watchForContainer);
                observer.observe(compBtnLst, { childList: true });
            }
        }, 500);
    }

    openWaterWindow() {
        try {
            let overlay = document.getElementById('waterOverlay');

            if (overlay) {
                const isHidden = overlay.style.display === 'none';
                overlay.style.display = isHidden ? 'block' : 'none';
                document.getElementById('waterThemesWindow')!.style.display = isHidden ? 'block' : 'none';
                document.getElementById('waterCustomizationsWindow')!.style.display = isHidden ? 'block' : 'none';
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
                    document.getElementById('waterThemesWindow')!.style.display = 'none';
                    document.getElementById('waterCustomizationsWindow')!.style.display = 'none';
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
        } catch (e) {
            console.error('[Water] Water window error:', e);
        }
    }

    getWaterWindowCSS(): string {
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
            .water-script-card {
                transition: all 0.2s ease;
            }
            .water-script-card:hover {
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            #water-script-search:focus {
                border-color: rgba(255, 105, 180, 0.5) !important;
                box-shadow: 0 0 0 2px rgba(255, 105, 180, 0.1);
            }
            .water-setting-row {
                transition: all 0.15s ease;
            }
            .water-setting-row:last-child {
                margin-bottom: 0 !important;
            }
            .water-setting-row input[type="range"] {
                -webkit-appearance: none;
                appearance: none;
                height: 5px;
                border-radius: 3px;
                outline: none;
                cursor: pointer;
            }
            .water-setting-row input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #ff69b4;
                border: 2px solid rgba(255, 255, 255, 0.3);
                cursor: pointer;
                box-shadow: 0 0 6px rgba(255, 105, 180, 0.4);
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .water-setting-row input[type="range"]::-webkit-slider-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 0 10px rgba(255, 105, 180, 0.6);
            }
            .water-setting-row input[type="range"]:active::-webkit-slider-thumb {
                transform: scale(1.1);
                background: #ff85c8;
            }
            .water-setting-row select option {
                background: #1a1a2e;
                color: #fff;
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
                const uniqueThemes = this.localThemes;

                const searchHTML = `
                    <div style="margin-bottom: 12px;">
                        <input type="text" id="water-local-themes-search" placeholder="Search local themes..." oninput="window.waterFilterLocalThemes(this.value)"
                               style="width: 100%; box-sizing: border-box; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.9); font-size: 13px; outline: none; transition: border-color 0.2s; margin-top: 8px;"
                               onfocus="this.style.borderColor='rgba(255,105,180,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
                    </div>
                `;

                let itemsHTML = '';
                if (uniqueThemes.length > 0) {
                    itemsHTML = uniqueThemes.map(t => {
                        const isActive = t.id === this.activeThemeId;
                        const filePath = t.filePath || '';

                        return `
                            <div class="theme-item water-local-theme-item ${isActive ? 'active-theme' : ''}"
                                 data-theme-name="${t.name.toLowerCase()}"
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
                } else {
                    itemsHTML = '<div class="no-items-msg">No local themes found.</div>';
                }

                localList.innerHTML = searchHTML + '<div id="water-local-themes-items">' + itemsHTML + '</div>';

                (window as any).waterFilterLocalThemes = (query: string) => {
                    const items = document.querySelectorAll('.water-local-theme-item');
                    const q = query.toLowerCase().trim();
                    items.forEach((item: any) => {
                        const name = item.getAttribute('data-theme-name') || '';
                        item.style.display = (!q || name.includes(q)) ? '' : 'none';
                    });
                };
            }

            (window as any).applyTheme = (id: string) => {
                this.applyTheme(id);
                this.renderThemes();
                this.renderThemeVariables();
            };

            (window as any).resetTheme = () => {
                this.resetTheme();
            };

            (window as any).editCSSFile = (filePath: string) => {
                shell.openPath(filePath);
            };

            (window as any).openThemesFolder = () => {
                const themesPath = join(getSwapPath(), 'css');
                shell.openPath(themesPath).catch(err => {
                    console.error('[Water] Failed to open themes folder:', err);
                });
            };
        } catch (e) {
            console.error('[Water] Render themes error:', e);
        }
    }

    renderThemeVariables() {
        try {
            const section = document.getElementById('water-theme-variables-section');
            const container = document.getElementById('water-theme-variables');
            
            if (!section || !container) return;

            // Check if it's a Water community theme
            const isWaterTheme = this.builtinThemes.some(t => t.id === this.activeThemeId);
            
            // Check if it's a premium theme
            const premiumThemeId = localStorage.getItem('water-active-premium-theme');
            const hasPremiumTheme = !!premiumThemeId;
            
            if (!isWaterTheme && !hasPremiumTheme) {
                section.style.display = 'none';
                return;
            }

            section.style.display = 'block';
            container.innerHTML = '';

            let variables: Array<{ name: string; value: string }> = [];

            // Get variables from community theme
            if (isWaterTheme) {
                const styleEl = document.getElementById('water-community-css') as HTMLStyleElement;
                if (styleEl && styleEl.sheet) {
                    variables = this.parseCSSVariables(styleEl.sheet);
                }
            }

            // Get variables from premium theme
            if (hasPremiumTheme) {
                const premiumStyleEl = document.getElementById('water-premium-theme') as HTMLStyleElement;
                if (premiumStyleEl && premiumStyleEl.sheet) {
                    const premiumVars = this.parseCSSVariables(premiumStyleEl.sheet);
                    variables = [...variables, ...premiumVars];
                }
            }
            
            if (variables.length === 0) {
                container.innerHTML = '<div class="no-items-msg">No variables found in this theme.</div>';
                return;
            }

            const savedVars = config.get(`themeVars.${this.activeThemeId}`, {}) as Record<string, string>;

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

                const calculateWidth = (val: string) => {
                    const baseWidth = 80;
                    const charWidth = 8;
                    const maxWidth = 300;
                    const minWidth = 80;
                    const calculatedWidth = Math.min(maxWidth, Math.max(minWidth, baseWidth + (val.length * charWidth)));
                    return calculatedWidth;
                };

                const trimmedValue = value.trim();
                let input: HTMLInputElement;

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
                    if (hexColor) colorPicker.value = hexColor;

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
                        if (hexColor) colorPicker.value = hexColor;
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

        } catch (e) {
            console.error('[Water] Render theme variables error:', e);
        }
    }

    convertToHex(color: string): string | null {
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
        } catch (e) {
            return null;
        }
    }

    parseCSSVariables(sheet: CSSStyleSheet): Array<{ name: string; value: string }> {
        const variables: Array<{ name: string; value: string }> = [];

        try {
            // Try to parse from cssRules first
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
            
            // If no variables found from cssRules, try parsing from ownerNode textContent
            if (variables.length === 0 && sheet.ownerNode) {
                const styleEl = sheet.ownerNode as HTMLStyleElement;
                if (styleEl.textContent) {
                    const rootMatch = styleEl.textContent.match(/:root\s*\{([^}]+)\}/);
                    if (rootMatch) {
                        const rootContent = rootMatch[1];
                        const varMatches = rootContent.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g);
                        for (const match of varMatches) {
                            variables.push({ name: match[1].trim(), value: match[2].trim() });
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[Water] Error parsing CSS variables:', e);
            
            // Final fallback: try to parse from textContent directly
            try {
                if (sheet.ownerNode) {
                    const styleEl = sheet.ownerNode as HTMLStyleElement;
                    if (styleEl.textContent) {
                        const rootMatch = styleEl.textContent.match(/:root\s*\{([^}]+)\}/);
                        if (rootMatch) {
                            const rootContent = rootMatch[1];
                            const varMatches = rootContent.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g);
                            for (const match of varMatches) {
                                variables.push({ name: match[1].trim(), value: match[2].trim() });
                            }
                        }
                    }
                }
            } catch (fallbackError) {
                console.error('[Water] Fallback CSS parsing also failed:', fallbackError);
            }
        }

        return variables;
    }

    updateThemeVariable(name: string, value: string) {
        try {
            const savedVars = config.get(`themeVars.${this.activeThemeId}`, {}) as Record<string, string>;
            savedVars[name] = value;
            config.set(`themeVars.${this.activeThemeId}`, savedVars);

            this.applyThemeVariables();
        } catch (e) {
            console.error('[Water] Error updating theme variable:', e);
        }
    }

    applyThemeVariables() {
        try {
            const savedVars = config.get(`themeVars.${this.activeThemeId}`, {}) as Record<string, string>;
            
            let styleEl = document.getElementById('water-theme-vars') as HTMLStyleElement;
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
        } catch (e) {
            console.error('[Water] Error applying theme variables:', e);
        }
    }

    applyTheme(themeId: string) {
        try {
            console.log('[Water] Attempting to apply theme:', themeId);
            
            let theme = this.builtinThemes.find(t => t.id === themeId);
            let cssContent = '';

            if (theme && theme.filename) {
                console.log('[Water] Found builtin theme:', theme.name);
                const themePath = join(__dirname, '../../assets/community-css/themes', theme.filename);
                cssContent = readFileSync(themePath, 'utf-8');
            } else {
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
                    if (existsSync(theme.filePath)) {
                        cssContent = readFileSync(theme.filePath, 'utf-8');
                        console.log('[Water] Loaded CSS content, length:', cssContent.length);
                    } else {
                        console.error('[Water] Theme file does not exist:', theme.filePath);
                    }
                } else {
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
            } else {
                console.error('[Water] No CSS content loaded for theme:', themeId);
            }
        } catch (e) {
            console.error('[Water] Failed to apply theme:', e);
        }
    }

    async loadActivePremiumTheme() {
        try {
            const premiumThemeId = localStorage.getItem('water-active-premium-theme');
            if (!premiumThemeId) {
                console.log('[Water] No active premium theme');
                return;
            }

            console.log('[Water] Loading premium theme:', premiumThemeId);

            // Get Supabase client from store module
            const waterGlobal = (window as any).water;
            if (!waterGlobal || !waterGlobal.modules) {
                console.error('[Water] Water global not found');
                return;
            }

            const storeModule = waterGlobal.modules.find((m: any) => m.id === 'store');
            if (!storeModule) {
                console.error('[Water] Store module not found');
                return;
            }

            const supabase = storeModule.supabase;
            if (!supabase) {
                console.error('[Water] Supabase not initialized');
                return;
            }

            // Fetch theme from Supabase
            const { data: item, error } = await supabase
                .from('premium_items')
                .select('css_url')
                .eq('id', premiumThemeId)
                .single();

            if (error || !item || !item.css_url) {
                console.error('[Water] Failed to fetch premium theme:', error);
                return;
            }

            // Fetch CSS content from GitHub
            const response = await fetch(item.css_url);
            if (!response.ok) {
                console.error('[Water] Failed to fetch CSS from:', item.css_url);
                return;
            }

            const cssContent = await response.text();

            // Apply CSS
            let styleEl = document.getElementById('water-premium-theme');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'water-premium-theme';
                document.head.appendChild(styleEl);
            }
            styleEl.textContent = cssContent;

            console.log('[Water] Premium theme loaded successfully');

            // Apply theme variables after loading premium theme
            this.applyThemeVariables();
        } catch (e) {
            console.error('[Water] Failed to load premium theme:', e);
        }
    }

    resetTheme() {
        try {
            // Remove community CSS
            const el = document.getElementById('water-community-css');
            if (el) el.remove();
            
            // Remove theme variables
            const varsEl = document.getElementById('water-theme-vars');
            if (varsEl) varsEl.remove();
            
            // Remove premium theme CSS
            const premiumEl = document.getElementById('water-premium-theme');
            if (premiumEl) premiumEl.remove();
            
            // Clear active theme IDs
            this.activeThemeId = 'default';
            localStorage.setItem('water-active-theme', 'default');
            localStorage.removeItem('water-active-premium-theme');
            
            this.renderThemes();
            this.renderThemeVariables();
            console.log('[Water] All CSS reset to default');
        } catch (e) {
            console.error('[Water] Failed to reset CSS:', e);
        }
    }

    renderScripts() {
        try {
            const list = document.getElementById('water-scripts-list');
            if (!list) return;

            const userscriptsEnabled = config.get('modules.resourceswapper.enableUserscripts', true) as boolean;
            console.log('[Water] renderScripts called, userscriptsEnabled:', userscriptsEnabled, 'count:', su.userscripts.length);

            if (!userscriptsEnabled) {
                list.innerHTML = `
                    <div style="background: rgba(255, 100, 100, 0.15); border: 1px solid rgba(255, 100, 100, 0.3); border-radius: 6px; padding: 20px; margin: 20px 0; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <span class="material-icons" style="color: #ff6464; font-size: 28px;">warning</span>
                        <span style="color: #ff6464; font-weight: 600; font-size: 16px;">Userscripts Disabled!</span>
                    </div>
                `;
                return;
            }

            // Build the full scripts panel HTML
            let html = '';

            // --- Batch actions bar ---
            const enabledCount = su.userscripts.filter(s => {
                const isPurchased = s.fullpath.startsWith('[PURCHASED]');
                const ns = isPurchased ? 'purchased' : 'local';
                return config.get(`userscripts.${ns}.${s.name}.enabled`, true);
            }).length;
            const disabledCount = su.userscripts.length - enabledCount;

            html += `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); margin-top: 8px;">
                    <span style="color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 500;">
                        ${su.userscripts.length} loaded &middot; ${enabledCount} enabled &middot; ${disabledCount} disabled
                    </span>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="window.waterBatchEnable(true)" style="padding: 4px 10px; font-size: 11px; background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.3); border-radius: 4px; color: #4ade80; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(74,222,128,0.25)'" onmouseout="this.style.background='rgba(74,222,128,0.15)'">Enable All</button>
                        <button onclick="window.waterBatchEnable(false)" style="padding: 4px 10px; font-size: 11px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 4px; color: #ef4444; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.15)'">Disable All</button>
                        <button onclick="window.waterReloadAll()" style="padding: 4px 10px; font-size: 11px; background: rgba(250,204,21,0.15); border: 1px solid rgba(250,204,21,0.3); border-radius: 4px; color: #facc15; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(250,204,21,0.25)'" onmouseout="this.style.background='rgba(250,204,21,0.15)'">&#x21bb; Reload All</button>
                    </div>
                </div>
            `;

            // --- Search bar ---
            html += `
                <div style="margin-bottom: 12px;">
                    <input type="text" id="water-script-search" placeholder="Search scripts..." oninput="window.waterFilterScripts(this.value)"
                           style="width: 100%; box-sizing: border-box; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.9); font-size: 13px; outline: none; transition: border-color 0.2s;"
                           onfocus="this.style.borderColor='rgba(255,105,180,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
                </div>
            `;

            if (!su.userscripts || su.userscripts.length === 0) {
                html += '<div class="no-items-msg">No scripts found. Place .js files in Documents\\Water\\Scripts</div>';
                list.innerHTML = html;
                return;
            }

            // --- Script cards ---
            html += '<div id="water-scripts-cards">';
            html += su.userscripts.map(script => {
                const scriptId = script.name.replace(/[^a-zA-Z0-9]/g, '-').replace(/\.js$/, '');
                const isPurchased = script.fullpath.startsWith('[PURCHASED]');
                const namespace = isPurchased ? 'purchased' : 'local';
                const isEnabled = config.get(`userscripts.${namespace}.${script.name}.enabled`, true) as boolean;
                const dropdownId = `water-script-settings-${scriptId}`;

                // Metadata
                const scriptName = (script.meta && script.meta.name) || script.name;
                const scriptDesc = (script.meta && (script.meta.desc || script.meta.description)) || '';
                const scriptAuthor = (script.meta && script.meta.author) || '';

                // Type badge
                let badgeHTML = '';
                if (isPurchased || script.scriptType === 'premium') {
                    badgeHTML = '<span style="display:inline-block;padding:2px 6px;font-size:9px;font-weight:700;border-radius:3px;background:linear-gradient(135deg,#ff69b4,#ff1493);color:#fff;margin-left:8px;letter-spacing:0.5px;">STORE</span>';
                } else if (script.scriptType === 'bundled') {
                    badgeHTML = '<span style="display:inline-block;padding:2px 6px;font-size:9px;font-weight:700;border-radius:3px;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);margin-left:8px;letter-spacing:0.5px;">BUNDLED</span>';
                } else {
                    badgeHTML = '<span style="display:inline-block;padding:2px 6px;font-size:9px;font-weight:700;border-radius:3px;background:rgba(59,130,246,0.2);color:#60a5fa;margin-left:8px;letter-spacing:0.5px;">LOCAL</span>';
                }

                // Health indicator
                const healthHex = performanceMonitor.getHealthHex(script.name);
                const healthScore = performanceMonitor.getHealthScore(script.name);
                const execTime = performanceMonitor.getFormattedExecTime(script.name);
                const healthDot = `<span title="Health: ${healthScore}/100 | Exec: ${execTime}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${healthHex};margin-right:8px;flex-shrink:0;"></span>`;

                // Error badge
                const errorCount = errorManager.getErrorCount(script.name);
                const errorBadge = errorCount > 0
                    ? `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;font-size:10px;font-weight:700;border-radius:9px;background:#ef4444;color:#fff;margin-left:6px;">${errorCount}</span>`
                    : '';

                // Settings
                const hasSettings = script.settings && Object.keys(script.settings).length > 0;
                const showArrow = hasSettings && isEnabled; // Only show arrow when enabled AND has settings
                const configArrow = showArrow ? `
                    <span class="material-icons-outlined"
                          id="arrow-${scriptId}"
                          onclick="event.stopPropagation(); window.toggleScriptSettings('${scriptId}')"
                          style="font-size: 20px; cursor: pointer; color: rgba(255,255,255,0.4); transition: all 0.2s; margin-right: 10px;"
                          onmouseover="this.style.color='rgba(255,255,255,0.8)'"
                          onmouseout="this.style.color='rgba(255,255,255,0.4)'">
                        keyboard_arrow_right
                    </span>
                ` : '';

                // Settings dropdown
                let settingsHTML = '';
                if (hasSettings && isEnabled) { // Only show settings when enabled
                    const settingsContent = Object.keys(script.settings)
                        .map(key => this.renderSettingControl(key, script.settings[key], script.name))
                        .filter(h => h)
                        .join('');

                    if (settingsContent) {
                        // Performance info at bottom of settings
                        const perfInfo = `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 16px; font-size: 11px; color: rgba(255,255,255,0.35);">
                                <span>Exec: ${execTime}</span>
                                <span>Health: ${healthScore}/100</span>
                                <span>Errors: ${errorCount}</span>
                            </div>
                        `;
                        settingsHTML = `
                            <div id="${dropdownId}" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08);">
                                ${settingsContent}
                                ${perfInfo}
                            </div>
                        `;
                    }
                }

                // Action buttons (reload only — edit removed; users edit via local folder)
                const reloadBtn = `<span class="material-icons-outlined" onclick="event.stopPropagation(); window.waterReloadScript('${script.name}')" title="Reload script" style="font-size:18px;cursor:pointer;color:rgba(255,255,255,0.35);transition:all 0.2s;margin-left:8px;" onmouseover="this.style.color='#facc15'" onmouseout="this.style.color='rgba(255,255,255,0.35)'">refresh</span>`;

                return `
                    <div class="water-script-card" data-script-name="${scriptName.toLowerCase()}" data-script-desc="${(scriptDesc || '').toLowerCase()}" data-script-author="${(scriptAuthor || '').toLowerCase()}"
                         style="display:block; margin-bottom:10px; padding:14px 16px; background:rgba(255,255,255,0.04); border-radius:8px; border:1px solid rgba(255,255,255,0.06); transition: all 0.2s;"
                         onmouseover="this.style.background='rgba(255,255,255,0.07)';this.style.borderColor='rgba(255,255,255,0.1)'"
                         onmouseout="this.style.background='rgba(255,255,255,0.04)';this.style.borderColor='rgba(255,255,255,0.06)'">
                        <div style="display:flex;align-items:center;justify-content:space-between;">
                            <div style="display:flex;align-items:center;flex:1;cursor:${showArrow ? 'pointer' : 'default'};"
                                 ${showArrow ? `onclick="window.toggleScriptSettings('${scriptId}')"` : ''}>
                                ${configArrow}
                                ${healthDot}
                                <div style="display:flex;flex-direction:column;min-width:0;">
                                    <div style="display:flex;align-items:center;flex-wrap:wrap;">
                                        <span style="font-size:15px;font-weight:500;color:rgba(255,255,255,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${scriptName}</span>
                                        ${badgeHTML}${errorBadge}
                                    </div>
                                </div>
                            </div>
                            <div style="display:flex;align-items:center;flex-shrink:0;margin-left:12px;">
                                ${reloadBtn}
                                <label class="switch" style="margin:0 0 0 12px;" onclick="event.stopPropagation();">
                                    <input type="checkbox" id="water-script-${scriptId}"
                                           ${isEnabled ? 'checked' : ''}
                                           onchange="window.toggleWaterScript('${script.name}', this.checked)">
                                    <span class="slider"><span class="grooves"></span></span>
                                </label>
                            </div>
                        </div>
                        ${settingsHTML}
                    </div>
                `;
            }).join('');
            html += '</div>';

            list.innerHTML = html;

            // --- Wire up global handlers ---
            (window as any).toggleWaterScript = (scriptName: string, enabled: boolean) => {
                const script = su.userscripts.find(s => s.name === scriptName);
                const isPurchased = script && script.fullpath.startsWith('[PURCHASED]');
                const namespace = isPurchased ? 'purchased' : 'local';
                config.set(`userscripts.${namespace}.${scriptName}.enabled`, enabled);
                console.log(`[Water] ${namespace} script ${scriptName}: ${enabled ? 'ENABLED' : 'DISABLED'}`);

                // Update counter
                this.renderScripts();
            };

            (window as any).toggleScriptSettings = (scriptId: string) => {
                const dropdown = document.getElementById(`water-script-settings-${scriptId}`);
                const arrow = document.getElementById(`arrow-${scriptId}`);
                if (dropdown && arrow) {
                    const isHidden = dropdown.style.display === 'none';
                    dropdown.style.display = isHidden ? 'block' : 'none';
                    arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                }
            };

            (window as any).updateScriptSetting = (scriptName: string, settingKey: string, value: any) => {
                console.log(`[Water] 🔧 updateScriptSetting called: script="${scriptName}", key="${settingKey}", value=`, value);
                
                const script = su.userscripts.find(s => s.name === scriptName);
                if (!script) {
                    console.error(`[Water] ❌ Script not found: ${scriptName}`);
                    return;
                }
                if (!script.settings) {
                    console.error(`[Water] ❌ Script has no settings: ${scriptName}`);
                    return;
                }
                if (!script.settings[settingKey]) {
                    console.error(`[Water] ❌ Setting key not found: ${settingKey} in ${scriptName}`);
                    return;
                }

                if (typeof value === 'string') value = value.trim();
                script.settings[settingKey].value = value;
                console.log(`[Water] ✓ Updated in-memory value for ${scriptName}.${settingKey} =`, value);

                if (typeof script.settings[settingKey].changed === 'function') {
                    try { 
                        console.log(`[Water] 📞 Calling changed() callback for ${scriptName}.${settingKey}`);
                        script.settings[settingKey].changed(value); 
                    } catch (e) { 
                        console.error('[Water] Setting callback error:', e); 
                    }
                }

                // Save to config
                try {
                    const isPurchased = script.fullpath.startsWith('[PURCHASED]');
                    const namespace = isPurchased ? 'purchased' : script.scriptType;
                    const configKey = `userscript.${namespace}.${scriptName.replace(/\.js$/, '')}`;
                    
                    console.log(`[Water] 💾 Saving to config:`);
                    console.log(`  - isPurchased: ${isPurchased}`);
                    console.log(`  - namespace: ${namespace}`);
                    console.log(`  - scriptType: ${script.scriptType}`);
                    console.log(`  - fullpath: ${script.fullpath}`);
                    console.log(`  - configKey: ${configKey}`);
                    
                    const savedSettings = config.get(configKey, {}) as any;
                    console.log(`  - existing settings:`, savedSettings);
                    
                    savedSettings[settingKey] = value;
                    console.log(`  - updated settings:`, savedSettings);
                    
                    config.set(configKey, savedSettings);
                    console.log(`[Water] ✅ Saved to config successfully`);
                    
                    // Verify save
                    const verified = config.get(configKey);
                    console.log(`[Water] 🔍 Verification read:`, verified);
                } catch (e) { 
                    console.error('[Water] ❌ Save setting error:', e); 
                }

                // Smart restart detection
                const setting = script.settings[settingKey];
                let needsRestart = false;
                if (setting.requiresRestart === true) needsRestart = true;
                else if (setting.requiresRestart === false) needsRestart = false;
                else if (script.runAt === 'document-start' || script.hasRan) needsRestart = true;

                if (needsRestart) this.showRestartNotification();
            };

            (window as any).recordKeybind = (scriptName: string, settingKey: string, button: HTMLButtonElement) => {
                button.textContent = 'Press any key...';
                button.style.background = 'rgba(255, 255, 0, 0.2)';
                const handleKeyPress = (e: KeyboardEvent) => {
                    e.preventDefault(); e.stopPropagation();
                    const keybind = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, key: e.key };
                    const modifiers = [keybind.ctrl ? 'Ctrl' : '', keybind.alt ? 'Alt' : '', keybind.shift ? 'Shift' : ''].filter(m => m).join(' + ');
                    button.textContent = modifiers ? `${modifiers} + ${keybind.key.toUpperCase()}` : keybind.key.toUpperCase();
                    button.style.background = '';
                    (window as any).updateScriptSetting(scriptName, settingKey, keybind);
                    document.removeEventListener('keydown', handleKeyPress, true);
                };
                document.addEventListener('keydown', handleKeyPress, true);
            };

            (window as any).openScriptsFolder = () => {
                const scriptsPath = getScriptsPath();
                shell.openPath(scriptsPath).catch(err => console.error('[Water] Open scripts folder error:', err));
            };

            // --- v2 handlers ---
            (window as any).waterFilterScripts = (query: string) => {
                const cards = document.querySelectorAll('.water-script-card');
                const q = query.toLowerCase().trim();
                cards.forEach((card: any) => {
                    const name = card.getAttribute('data-script-name') || '';
                    const desc = card.getAttribute('data-script-desc') || '';
                    const author = card.getAttribute('data-script-author') || '';
                    card.style.display = (!q || name.includes(q) || desc.includes(q) || author.includes(q)) ? 'block' : 'none';
                });
            };

            (window as any).waterBatchEnable = (enabled: boolean) => {
                su.userscripts.forEach(script => {
                    const isPurchased = script.fullpath.startsWith('[PURCHASED]');
                    const ns = isPurchased ? 'purchased' : 'local';
                    config.set(`userscripts.${ns}.${script.name}.enabled`, enabled);
                });
                console.log(`[Water] Batch ${enabled ? 'enabled' : 'disabled'} all scripts`);
                this.renderScripts();
                this.showRestartNotification();
            };

            (window as any).waterReloadAll = async () => {
                await hotReload.reloadAll();
                this.renderScripts();
            };

            (window as any).waterReloadScript = async (name: string) => {
                await hotReload.reloadSingleScript(name);
                this.renderScripts();
            };

        } catch (e) {
            console.error('[Water] Render scripts error:', e);
            const list = document.getElementById('water-scripts-list');
            if (list) list.innerHTML = `<div class="no-items-msg" style="color: #ff5555">Error: ${e}</div>`;
        }
    }

    renderSettingControl(settingKey: string, setting: any, scriptName: string): string {
        const settingId = `water-script-setting-${scriptName.replace(/[^a-zA-Z0-9]/g, '-')}-${settingKey}`;

        if (!setting || typeof setting !== 'object') return '';
        if (!setting.title || !setting.type || setting.value === undefined) return '';
        if (typeof setting.changed !== 'function') return '';

        let controlHTML = '';
        const tip = setting.desc || '';
        const escapedTip = tip.replace(/'/g, '&#39;').replace(/"/g, '&quot;');

        // Common styles
        const inputBg = 'rgba(0,0,0,0.35)';
        const inputBorder = 'rgba(255,255,255,0.12)';
        const inputBorderFocus = 'rgba(255,105,180,0.5)';
        const inputRadius = '5px';
        const inputColor = 'rgba(255,255,255,0.9)';
        const labelColor = 'rgba(255,255,255,0.85)';
        const descColor = 'rgba(255,255,255,0.4)';

        switch (setting.type) {
            case 'bool': {
                if (typeof setting.value !== 'boolean') return '';
                controlHTML = `
                    <label class="switch" style="margin: 0; flex-shrink: 0;">
                        <input type="checkbox" id="${settingId}"
                               ${setting.value ? 'checked' : ''}
                               onchange="window.updateScriptSetting('${scriptName}', '${settingKey}', this.checked)">
                        <span class="slider"><span class="grooves"></span></span>
                    </label>
                `;
                break;
            }

            case 'num': {
                if (typeof setting.value !== 'number') return '';
                const min = setting.min !== undefined ? setting.min : 0;
                const max = setting.max !== undefined ? setting.max : 100;
                const step = setting.step !== undefined ? setting.step : 1;

                // Determine display precision from step
                const precision = step < 1 ? (step < 0.01 ? 3 : 2) : (step >= 10 ? 0 : 1);

                // Slider track fill gradient
                const pct = ((setting.value - min) / (max - min)) * 100;

                controlHTML = `
                    <div style="display:flex;align-items:center;gap:6px;width:170px;">
                        <input type="range" id="${settingId}"
                               min="${min}" max="${max}" step="${step}"
                               value="${setting.value}"
                               style="flex:1;min-width:0;height:5px;border-radius:3px;outline:none;cursor:pointer;accent-color:#ff69b4;
                                      background:linear-gradient(to right, #ff69b4 0%, #ff69b4 ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%);"
                               oninput="
                                   document.getElementById('${settingId}-num').value = parseFloat(this.value).toFixed(${precision});
                                   var pct = ((this.value - ${min}) / (${max} - ${min})) * 100;
                                   this.style.background = 'linear-gradient(to right, #ff69b4 0%, #ff69b4 ' + pct + '%, rgba(255,255,255,0.1) ' + pct + '%, rgba(255,255,255,0.1) 100%)';
                                   window.updateScriptSetting('${scriptName}', '${settingKey}', parseFloat(this.value));
                               ">
                        <input type="number" id="${settingId}-num"
                               min="${min}" max="${max}" step="${step}"
                               value="${setting.value}"
                               style="width:48px;padding:3px 4px;background:${inputBg};border:1px solid ${inputBorder};border-radius:${inputRadius};color:${inputColor};font-size:11px;text-align:center;outline:none;transition:border-color 0.2s;flex-shrink:0;"
                               onfocus="this.style.borderColor='${inputBorderFocus}'"
                               onblur="this.style.borderColor='${inputBorder}'"
                               oninput="
                                   document.getElementById('${settingId}').value = this.value;
                                   var pct = ((this.value - ${min}) / (${max} - ${min})) * 100;
                                   document.getElementById('${settingId}').style.background = 'linear-gradient(to right, #ff69b4 0%, #ff69b4 ' + pct + '%, rgba(255,255,255,0.1) ' + pct + '%, rgba(255,255,255,0.1) 100%)';
                                   window.updateScriptSetting('${scriptName}', '${settingKey}', parseFloat(this.value));
                               "
                               onchange="let v=parseFloat(this.value); if(v<${min})v=${min}; if(v>${max})v=${max}; this.value=v; document.getElementById('${settingId}').value=v; window.updateScriptSetting('${scriptName}', '${settingKey}', v)">
                    </div>
                `;
                break;
            }

            case 'sel': {
                if (!Array.isArray(setting.opts) || setting.opts.length < 2) return '';
                if (!setting.opts.includes(setting.value)) return '';

                controlHTML = `
                    <div style="position:relative;display:inline-block;min-width:110px;max-width:170px;">
                        <select id="${settingId}"
                                style="width:100%;padding:4px 24px 4px 8px;background:${inputBg};border:1px solid ${inputBorder};border-radius:${inputRadius};color:${inputColor};font-size:12px;cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;transition:border-color 0.2s;background-image:url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22rgba(255,255,255,0.5)%22 stroke-width=%222%22%3E%3Cpath d=%22M6 9l6 6 6-6%22/%3E%3C/svg%3E');background-repeat:no-repeat;background-position:right 6px center;"
                                onfocus="this.style.borderColor='${inputBorderFocus}'"
                                onblur="this.style.borderColor='${inputBorder}'"
                                onchange="window.updateScriptSetting('${scriptName}', '${settingKey}', this.value)">
                            ${setting.opts.map((opt: string) => `<option value="${opt}" ${opt === setting.value ? 'selected' : ''} style="background:#1a1a2e;color:#fff;">${opt}</option>`).join('')}
                        </select>
                    </div>
                `;
                break;
            }

            case 'color': {
                if (typeof setting.value !== 'string') return '';
                // Accept both 3 and 6 char hex
                if (!setting.value.match(/^#([0-9a-fA-F]{3}){1,2}$/)) return '';

                controlHTML = `
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div style="position:relative;width:26px;height:26px;border-radius:${inputRadius};overflow:hidden;border:2px solid ${inputBorder};cursor:pointer;transition:border-color 0.2s;flex-shrink:0;"
                             onmouseover="this.style.borderColor='${inputBorderFocus}'"
                             onmouseout="this.style.borderColor='${inputBorder}'">
                            <input type="color" id="${settingId}"
                                   value="${setting.value}"
                                   style="position:absolute;top:-4px;left:-4px;width:34px;height:34px;border:none;cursor:pointer;background:transparent;"
                                   oninput="document.getElementById('${settingId}-hex').value=this.value; window.updateScriptSetting('${scriptName}', '${settingKey}', this.value)">
                        </div>
                        <input type="text" id="${settingId}-hex"
                               value="${setting.value}"
                               maxlength="7"
                               style="width:64px;padding:3px 6px;background:${inputBg};border:1px solid ${inputBorder};border-radius:${inputRadius};color:${inputColor};font-size:11px;font-family:'Consolas',monospace;text-align:center;outline:none;transition:border-color 0.2s;"
                               onfocus="this.style.borderColor='${inputBorderFocus}'"
                               onblur="this.style.borderColor='${inputBorder}'"
                               onchange="if(this.value.match(/^#[0-9a-fA-F]{6}$/)){document.getElementById('${settingId}').value=this.value; window.updateScriptSetting('${scriptName}', '${settingKey}', this.value);}">
                    </div>
                `;
                break;
            }

            case 'keybind': {
                if (typeof setting.value !== 'object' || Array.isArray(setting.value)) return '';
                if (typeof setting.value.alt !== 'boolean' || typeof setting.value.ctrl !== 'boolean' ||
                    typeof setting.value.shift !== 'boolean' || typeof setting.value.key !== 'string') return '';
                const kb = setting.value;
                const modifiers = [
                    kb.ctrl ? 'Ctrl' : '',
                    kb.alt ? 'Alt' : '',
                    kb.shift ? 'Shift' : ''
                ].filter((m: string) => m).join(' + ');
                const displayKey = modifiers ? `${modifiers} + ${kb.key.toUpperCase()}` : kb.key.toUpperCase();

                controlHTML = `
                    <button id="${settingId}"
                            style="min-width:96px;padding:4px 10px;background:${inputBg};border:1px solid ${inputBorder};border-radius:${inputRadius};color:${inputColor};font-size:12px;cursor:pointer;outline:none;transition:all 0.2s;letter-spacing:0.3px;"
                            onmouseover="this.style.borderColor='${inputBorderFocus}';this.style.background='rgba(255,105,180,0.08)'"
                            onmouseout="this.style.borderColor='${inputBorder}';this.style.background='${inputBg}'"
                            onclick="window.recordKeybind('${scriptName}', '${settingKey}', this)">
                        ⌨ ${displayKey}
                    </button>
                `;
                break;
            }

            case 'text': {
                if (typeof setting.value !== 'string') return '';
                const escapedValue = setting.value.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                controlHTML = `
                    <input type="text" id="${settingId}"
                           value="${escapedValue}"
                           style="width:160px;padding:4px 8px;background:${inputBg};border:1px solid ${inputBorder};border-radius:${inputRadius};color:${inputColor};font-size:12px;outline:none;transition:border-color 0.2s;"
                           onfocus="this.style.borderColor='${inputBorderFocus}'"
                           onblur="this.style.borderColor='${inputBorder}'"
                           onchange="window.updateScriptSetting('${scriptName}', '${settingKey}', this.value)">
                `;
                break;
            }

            default:
                return '';
        }

        // Build the setting row with label, description, live value, and control
        const liveValueSpan = '';

        const descHTML = tip
            ? `<span style="display:block;font-size:10px;color:${descColor};margin-top:1px;line-height:1.3;">${escapedTip}</span>`
            : '';

        return `
            <div class="water-setting-row" style="margin:4px 0;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 10px;border-radius:5px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);transition:all 0.15s;"
                 onmouseover="this.style.background='rgba(255,255,255,0.05)';this.style.borderColor='rgba(255,255,255,0.08)'"
                 onmouseout="this.style.background='rgba(255,255,255,0.02)';this.style.borderColor='rgba(255,255,255,0.04)'">
                <div style="display:flex;flex-direction:column;min-width:0;flex:1;">
                    <span style="color:${labelColor};font-size:12px;font-weight:500;display:flex;align-items:center;">
                        ${setting.title}${liveValueSpan}
                    </span>
                    ${descHTML}
                </div>
                <div style="flex-shrink:0;">${controlHTML}</div>
            </div>
        `;
    }

    renderUIToggles() {
        try {
            const list = document.getElementById('water-ui-list');
            if (!list) return;

            const toggles = this.getUIToggles();

            const searchHTML = `
                <div style="margin-bottom: 12px;">
                    <input type="text" id="water-ui-search" placeholder="Search UI toggles..." oninput="window.waterFilterUIToggles(this.value)"
                           style="width: 100%; box-sizing: border-box; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.9); font-size: 13px; outline: none; transition: border-color 0.2s; margin-top: 8px;"
                           onfocus="this.style.borderColor='rgba(255,105,180,0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
                </div>
            `;

            const togglesHTML = toggles.map(toggle => {
                const savedState = localStorage.getItem(`water-ui-${toggle.id}`);
                const isOn = savedState === null ? toggle.defaultOn : savedState === 'true';

                return `
                    <div class="settNameSmall script-item water-ui-toggle-item" data-toggle-name="${toggle.name.toLowerCase()}">
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

            list.innerHTML = searchHTML + '<div id="water-ui-toggles-list">' + togglesHTML + '</div>';

            (window as any).waterFilterUIToggles = (query: string) => {
                const items = document.querySelectorAll('.water-ui-toggle-item');
                const q = query.toLowerCase().trim();
                items.forEach((item: any) => {
                    const name = item.getAttribute('data-toggle-name') || '';
                    item.style.display = (!q || name.includes(q)) ? '' : 'none';
                });
            };

            (window as any).toggleWaterUI = (toggleId: string, enabled: boolean) => {
                const toggle = this.getUIToggles().find(t => t.id === toggleId);
                if (!toggle) return;

                if (toggle.isModsButton) {
                    localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                    this.injectModsButton();
                    return;
                }

                if (toggleId === 'hideWaterLoader') {
                    localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                    config.set('hideWaterLoader', enabled);
                    console.log(`[Water] hideWaterLoader saved:`, enabled);
                    return;
                }

                localStorage.setItem(`water-ui-${toggleId}`, enabled.toString());
                console.log(`[Water] UI Toggle ${toggleId}: ${enabled ? 'ON' : 'OFF'}`);
                this.applyUIToggles();
            };
        } catch (e) {
            console.error('[Water] Render UI toggles error:', e);
        }
    }

    getUIToggles(): UIToggle[] {
        return [
            { id: 'hideWaterLoader', name: 'Hide Water Loader', css: '', defaultOn: false, requiresRestart: true },
            { 
                id: 'hideKPDPhone', 
                name: 'Hide KPD Phone', 
                css: '#policePop, #policePopC {display: none !important;}', 
                defaultOn: true 
            },
            { id: 'hideAds', name: 'Hide ADs', css: '#mainLogo, #topRightAdHolder, #aHolder, #endAContainer, #bubbleContainer, #homeStoreAd, #newUserGuide, #doubleRaidDropsAd, #battlepassAd, #updateAd, #mainLogoFace, #seasonLabel, #doubleXPHolder, .webpush-container, #krDiscountAd, #surveyAd {display: none !important;}', defaultOn: false },
            { id: 'hideTermsInfo', name: 'Hide Terms Info', css: '#termsInfo {display: none;}', defaultOn: false },
            { id: 'hideSignupAlerts', name: 'Hide Signup Alerts', css: '#signupRewardsButton, .signup-rewards-container, .guest-earned-collect, #notificationCenter {display: none !important;}', defaultOn: true },
            { id: 'showModsButton', name: 'Bring Back Mods Button', css: '', defaultOn: true, isModsButton: true },
            { id: 'hideMoreKrunker', name: 'Hide More Krunker', css: '.menuItem:nth-child(8) {display: none !important;}', defaultOn: true },
            { id: 'hideChallenges', name: 'Hide Challenges', css: '.menuItem:nth-child(3) {display: none;}', defaultOn: false },
            { id: 'hideSocial', name: 'Hide Social & Trading Button', css: '.menuItem:nth-child(5) {display: none;}', defaultOn: false },
            { id: 'hideCommunity', name: 'Hide Community Button', css: '.menuItem:nth-child(6) {display: none;}', defaultOn: true },
            { id: 'hideGames', name: 'Hide Games Button', css: '.menuItem:nth-child(7) {display: none;}', defaultOn: false },
            { id: 'hideStream', name: 'Hide Old & New Stream Container', css: '#streamContainer, #streamContainerNew {display: none !important;}', defaultOn: false },
            { id: 'hideQuickMatch', name: 'Hide Quick Match Button', css: '#menuBtnQuickMatch {display: none !important;}', defaultOn: true },
            { id: 'hideLeaderboardButton', name: 'Hide Leaderboard Button', css: '.icon-button.svelte-wmukcv {display: none !important;}', defaultOn: true },
            { id: 'hideTurfWars', name: 'Hide Turf Wars', css: '.main-menu-button-container.svelte-f3amho[style="top: 92px; left: 520px; --border-color:#00B1FF;"] {display: none !important;}', defaultOn: true },
            { id: 'hideNewMarket', name: 'Hide New Market', css: '.main-menu-button-container.svelte-f3amho[style="top: 282px; left: 520px; --border-color:#e39e1d;"] {display: none !important;}', defaultOn: true },
            { id: 'hideRaffles', name: 'Hide Raffles', css: '.main-menu-button-container.svelte-f3amho[style="top: 472px; left: 520px; --border-color:#DC2626;"] {display: none !important;}', defaultOn: true },
            { id: 'hideDoubleXP', name: 'Hide Double XP', css: '#doubleXPButton {display: none !important;}', defaultOn: true },
            { id: 'hideStore', name: 'Hide Store', css: '#menuBtnWaterStore {display: none !important;}', defaultOn: false },
            { id: 'hideExit', name: 'Hide Client Exit', css: '#clientExit {display: none !important;}', defaultOn: true },
        ];
    }

    // Debug Console removed - keeping only notification system
    // renderDebugConsole() method removed to simplify UI
    
    applyUIToggles() {
        try {
            const toggles = this.getUIToggles();
            const styleId = 'water-ui-toggles';

            const existingStyle = document.getElementById(styleId);
            if (existingStyle) existingStyle.remove();

            let css = '';
            toggles.forEach(toggle => {
                const savedState = localStorage.getItem(`water-ui-${toggle.id}`);
                const isOn = savedState === null ? toggle.defaultOn : savedState === 'true';
                
                // Apply CSS if toggle is enabled
                if (isOn && toggle.css) {
                    css += toggle.css + '\n';
                }
                
                // Execute JavaScript if toggle is enabled and has JS
                if (isOn && toggle.js) {
                    try {
                        // Execute the JavaScript code
                        eval(toggle.js);
                        console.log(`[Water] Executed JS for toggle: ${toggle.id}`);
                    } catch (jsError) {
                        console.error(`[Water] JS execution error for ${toggle.id}:`, jsError);
                    }
                } else if (!isOn && toggle.js) {
                    // Clean up when toggle is disabled
                    // Clear interval if it exists
                    if (toggle.id === 'hideKPDPhone' && (window as any).waterKPDInterval) {
                        clearInterval((window as any).waterKPDInterval);
                        (window as any).waterKPDInterval = null;
                        // Remove the style element
                        const kpdStyle = document.getElementById('water-kpd-phone-style');
                        if (kpdStyle) kpdStyle.remove();
                        console.log(`[Water] Cleaned up JS for toggle: ${toggle.id}`);
                    }
                }
            });

            if (css) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = css;
                document.head.appendChild(style);
            }
        } catch (e) {
            console.error('[Water] Apply UI toggles error:', e);
        }
    }

    private initToastSystem() {
        // Only initialize once
        if (document.getElementById('water-toast-container')) {
            return;
        }

        // Create SVG symbols (only close icon needed)
        const svgSymbols = `
            <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
                <symbol viewBox="0 0 384 512" id="water-close-icon">
                    <path fill="currentColor" d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
                </symbol>
            </svg>
        `;

        // Create toast container
        const container = document.createElement('div');
        container.id = 'water-toast-container';
        container.innerHTML = svgSymbols;

        // Add styles
        const style = document.createElement('style');
        style.id = 'water-toast-styles';
        style.textContent = `
            @keyframes waterToastSlideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes waterToastSlideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
            
            @keyframes waterToastDuration {
                from { width: 0%; }
                to { width: 100%; }
            }
            
            #water-toast-container {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999999;
                display: block;
                width: auto;
                max-width: calc(100vw - 40px);
                pointer-events: none;
            }
            
            @media (max-width: 500px) {
                #water-toast-container {
                    max-width: calc(100vw - 20px);
                }
            }
            
            .water-toast {
                display: flex;
                align-items: center;
                width: 100%;
                max-width: 450px;
                margin: 0 auto;
                padding: 18px 20px;
                border-radius: 10px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                overflow: visible;
                animation: waterToastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: all;
                background: radial-gradient(circle at top left, #dc2626, #000000);
                position: relative;
                border: 1px solid rgba(220, 38, 38, 0.3);
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            
            .water-toast.closing {
                animation: waterToastSlideOut 0.3s ease-in;
            }
            
            .water-toast-content {
                flex: 1;
                min-width: 0;
                padding-right: 12px;
            }
            
            .water-toast-content span {
                font-size: 15px;
                font-weight: 600;
                color: #ffffff;
                display: block;
                margin-bottom: 4px;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                word-wrap: break-word;
            }
            
            .water-toast-content p {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.9);
                margin: 0;
                line-height: 1.4;
                word-wrap: break-word;
            }
            
            .water-toast-close {
                flex-shrink: 0;
                width: 28px;
                height: 28px;
                padding: 4px;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .water-toast-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: scale(1.05);
            }
            
            .water-toast-close svg {
                display: block;
                width: 100%;
                height: 100%;
                color: rgba(255, 255, 255, 0.95);
            }
            
            .water-toast-duration {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                width: 100%;
                background-color: rgba(0, 0, 0, 0.2);
            }
            
            .water-toast-duration::after {
                display: block;
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 0%;
                height: inherit;
                background-color: rgba(220, 38, 38, 0.6);
                animation: waterToastDuration 10s linear;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(container);
        
        console.log('[Water] Toast notification system initialized');
    }

    private showToast(title: string, message: string, duration: number = 10000) {
        // Ensure toast system is initialized
        this.initToastSystem();

        const container = document.getElementById('water-toast-container');
        if (!container) {
            console.error('[Water] Toast container not found');
            return;
        }

        // Check if a toast already exists - if so, don't show another one
        const existingToast = container.querySelector('.water-toast');
        if (existingToast) {
            console.log('[Water] Toast already visible, skipping duplicate');
            return;
        }

        // Create toast element (no icon, just content and close button)
        const toast = document.createElement('div');
        toast.className = 'water-toast';
        toast.innerHTML = `
            <div class="water-toast-content">
                <span>${title}</span>
                <p>${message}</p>
            </div>
            <button class="water-toast-close">
                <svg><use xlink:href="#water-close-icon"></use></svg>
            </button>
            <div class="water-toast-duration"></div>
        `;

        // Add close button handler
        const closeBtn = toast.querySelector('.water-toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeToast(toast);
            });
        }

        // Add to container
        container.appendChild(toast);

        // Auto-close after duration
        setTimeout(() => {
            this.closeToast(toast);
        }, duration);

        console.log(`[Water] Toast shown: ${title}`);
    }

    private closeToast(toast: HTMLElement) {
        if (!toast || !toast.parentElement) return;
        
        toast.classList.add('closing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    private showRestartNotification() {
        // Use the toast system for restart notifications
        this.showToast(
            'Changes Detected',
            'Restart Water to apply changes',
            10000
        );
    }
}
