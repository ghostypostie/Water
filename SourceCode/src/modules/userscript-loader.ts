/**
 * Water Client userscript loader
 * Executes userscripts in renderer context with proper timing and context
 */

import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { resolve as pathResolve } from 'path';

interface UserscriptMeta {
    [key: string]: string | string[];
    name?: string;
    author?: string;
    version?: string;
    desc?: string;
    'run-at'?: string;
    priority?: string;
}

interface UserscriptSetting {
    title: string;
    desc: string;
    value: any;
    type?: string;
    min?: number;
    max?: number;
    step?: number;
    changed?: (newValue: any) => void;
}

interface UserscriptSettings {
    [key: string]: UserscriptSetting;
}

class Userscript {
    hasRan: boolean = false;
    strictMode: boolean = false;
    name: string;
    fullpath: string;
    meta: UserscriptMeta | false = false;
    unload: any = false;
    settings: UserscriptSettings = {};
    runAt: string = 'document-end';
    priority: number = 0;
    content: string;

    constructor(props: { name: string; fullpath: string; content?: string }) {
        this.name = props.name;
        this.fullpath = props.fullpath;

        // If content is provided (premium scripts), use it; otherwise read from disk
        if (props.content) {
            this.content = props.content;
        } else {
            this.content = readFileSync(this.fullpath, { encoding: 'utf-8' });
        }
        if (this.content.startsWith('"use strict"')) this.strictMode = true;

        // Parse metadata if present
        if (this.content.includes('// ==UserScript==') && this.content.includes('// ==/UserScript==')) {
            let chunk = this.content.split('\n');
            const startLine = chunk.findIndex(line => line.includes('// ==UserScript=='));
            const endLine = chunk.findIndex(line => line.includes('// ==/UserScript=='));

            if (startLine !== -1 && endLine !== -1) {
                const metaChunk = chunk.slice(startLine, endLine + 1).join('\n');
                this.meta = parseMetadata(metaChunk);

                // If metadata defines a prop twice, take the last value
                for (const metaKey of Object.keys(this.meta)) {
                    const meta = this.meta[metaKey];
                    if (Array.isArray(meta)) this.meta[metaKey] = meta[meta.length - 1];
                }

                // Parse @run-at
                if ('run-at' in this.meta && this.meta['run-at'] === 'document-start') {
                    this.runAt = 'document-start';
                }

                // Parse @priority
                this.priority = 0;
                if ('priority' in this.meta && typeof this.meta['priority'] === "string") {
                    try {
                        this.priority = parseInt(this.meta['priority']);
                    } catch (e) {
                        strippedConsole.log("Error while parsing userscript priority: ", e);
                        this.priority = 0;
                    }
                }
            }
        }
    }

    /** Runs the userscript */
    load() {
        try {
            strippedConsole.log(`[Water] Attempting to execute '${this.name}'...`);
            
            // Execute script with proper context binding
            const exported = new Function(this.content).apply({
                unload: false,
                settings: {},
                _console: strippedConsole,
                _css: userscriptToggleCSS
            });

            strippedConsole.log(`[Water] '${this.name}' executed, exported:`, typeof exported, exported);

            // Userscript can return an object with unload and settings properties
            if (typeof exported !== 'undefined') {
                if ('unload' in exported) this.unload = exported.unload;
                if ('settings' in exported) {
                    this.settings = exported.settings;
                    strippedConsole.log(`[Water] '${this.name}' has ${Object.keys(this.settings).length} settings from return value`);
                }
            }
            
            // Try to detect and extract config object from script content
            // This supports IIFE-wrapped scripts that don't explicitly return settings
            if (!this.settings || Object.keys(this.settings).length === 0) {
                try {
                    // Improved regex to match multi-line config objects
                    // Matches: const config = { ... } with proper brace counting
                    let configMatch = this.content.match(/const\s+config\s*=\s*\{/);
                    if (configMatch) {
                        const startIdx = configMatch.index! + configMatch[0].length - 1;
                        let braceCount = 0;
                        let endIdx = startIdx;
                        
                        // Find matching closing brace
                        for (let i = startIdx; i < this.content.length; i++) {
                            if (this.content[i] === '{') braceCount++;
                            else if (this.content[i] === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    endIdx = i + 1;
                                    break;
                                }
                            }
                        }
                        
                        if (endIdx > startIdx) {
                            const configStr = this.content.substring(startIdx, endIdx);
                            const configObj = new Function('return ' + configStr)();
                            
                            this.settings = configToSettings(configObj, this.name);
                            strippedConsole.log(`[Water] Auto-detected ${Object.keys(this.settings).length} config settings from ${this.name}`);
                        }
                    }
                } catch (e) {
                    strippedConsole.warn(`[Water] Failed to auto-detect config from ${this.name}:`, e);
                }
            }

            // Apply custom settings if they exist (use appropriate namespace)
            if (this.settings && Object.keys(this.settings).length > 0 && su.config) {
                try {
                    const isPurchased = this.fullpath.startsWith('[PURCHASED]');
                    const namespace = isPurchased ? 'purchased' : 'local';
                    const configKey = `userscript.${namespace}.${this.name.replace(/\.js$/, '')}`;
                    const savedSettings = su.config.get(configKey, {});
                    
                    Object.keys(savedSettings).forEach(settingKey => {
                        if (settingKey in this.settings
                            && typeof this.settings[settingKey].changed === 'function'
                            && savedSettings[settingKey] !== this.settings[settingKey].value
                            && typeof savedSettings[settingKey] === typeof this.settings[settingKey].value) {
                            this.settings[settingKey].changed(savedSettings[settingKey]);
                        }
                    });
                } catch (err) {
                    strippedConsole.error(`[Water] Failed to load settings for ${this.name}:`, err);
                }
            }

            strippedConsole.log(`%c[Water]${this.strictMode ? '%c[strict]' : '%c[non-strict]'} %cran %c'${this.name.toString()}' `,
                'color: lightblue; font-weight: bold;', this.strictMode ? 'color: #62dd4f' : 'color: orange',
                'color: white;', 'color: lightgreen;');
        } catch (error) {
            errAlert(error as Error, this.name);
            strippedConsole.error(error);
        }
    }
}

interface SharedUserscriptData {
    userscriptsPath: string;
    userscripts: Userscript[];
    config: any;
}

export const su: SharedUserscriptData = {
    userscriptsPath: '',
    userscripts: [],
    config: null
};

const errAlert = (err: Error, name: string) => {
    alert(`Userscript '${name}' had an error:\n\n${err.toString()}\n\nPlease fix the error, disable the userscript or delete it.\nCheck console for stack trace`);
};

export const strippedConsole = {
    log: (...args: any[]) => console.log(...args),
    warn: (...args: any[]) => console.warn(...args),
    error: (...args: any[]) => console.error(...args)
};

export const userscriptToggleCSS = (css: string, identifier: string, value: boolean | 'toggle') => {
    const styleId = `userscript-css-${identifier}`;
    
    if (value === false || value === 'toggle' && document.getElementById(styleId)) {
        const existing = document.getElementById(styleId);
        if (existing) existing.remove();
        return;
    }
    
    if (value === true || value === 'toggle') {
        let style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }
        style.textContent = css;
    }
};

/**
 * Convert a config object to settings format
 */
const configToSettings = (config: any, scriptName: string): UserscriptSettings => {
    const settings: UserscriptSettings = {};
    
    for (const [key, value] of Object.entries(config)) {
        const setting: UserscriptSetting = {
            title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
            desc: `Configure ${key}`,
            value: value,
            changed: (newValue: any) => {
                config[key] = newValue;
                strippedConsole.log(`[Water] ${scriptName} config.${key} = ${newValue}`);
            }
        };
        
        // Detect type based on value
        if (typeof value === 'boolean') {
            setting.type = 'bool';
        } else if (typeof value === 'number') {
            setting.type = 'num';
            
            // Smart range detection based on value and key name
            const keyLower = key.toLowerCase();
            
            // DEBUG: Always log number keys
            strippedConsole.log(`[DEBUG] Number key: "${key}" -> lower: "${keyLower}", value: ${value}`);
            
            if (keyLower.includes('volume') || keyLower.includes('opacity') || keyLower.includes('alpha')) {
                setting.min = 0;
                setting.max = 1;
                setting.step = 0.01;
            } else if (keyLower === 'verticalposition' || keyLower.includes('percent')) {
                // Percentage values (0-100)
                setting.min = 0;
                setting.max = 100;
                setting.step = 1;
                strippedConsole.log(`[DEBUG] ${key} matched as percentage: min=0, max=100`);
            } else if (keyLower.includes('position')) {
                setting.min = 0;
                setting.max = 100;
                setting.step = 1;
            } else if (keyLower === 'streakresettime') {
                // Streak reset time: 0-20 seconds (in ms)
                setting.min = 0;
                setting.max = 20000;
                setting.step = 1000;
                strippedConsole.log(`[DEBUG] ${key} matched as streakResetTime: min=0, max=20000`);
            } else if (keyLower === 'fadeoutdelay') {
                // Fade out delay: 0-10 seconds (in ms)
                setting.min = 0;
                setting.max = 10000;
                setting.step = 100;
                strippedConsole.log(`[DEBUG] ${key} matched as fadeOutDelay: min=0, max=10000`);
            } else if (keyLower.includes('time') || keyLower.includes('delay') || keyLower.includes('duration')) {
                setting.min = 0;
                setting.max = Math.max(value * 3, 30000);
                setting.step = value >= 1000 ? 100 : 10;
                strippedConsole.log(`[DEBUG] ${key} matched as time/delay: min=0, max=${setting.max}`);
            } else if (keyLower.includes('size') || keyLower.includes('width') || keyLower.includes('height')) {
                setting.min = 0;
                setting.max = Math.max(value * 3, 500);
                setting.step = 1;
            } else if (value >= 0 && value <= 1) {
                setting.min = 0;
                setting.max = 1;
                setting.step = 0.01;
            } else if (value < 100) {
                setting.min = 0;
                setting.max = 500;
                setting.step = 1;
            } else {
                setting.min = 0;
                setting.max = value * 2;
                setting.step = Math.max(1, Math.floor(value / 100));
            }
        } else if (typeof value === 'string') {
            if (value.match(/^#([0-9a-fA-F]{3}){1,2}$/)) {
                setting.type = 'color';
            } else {
                continue;
            }
        } else {
            continue;
        }
        
        settings[key] = setting;
    }
    
    return settings;
};

/**
 * Parse userscript metadata from comment block
 */
const parseMetadata = (meta: string): UserscriptMeta => meta.split(/[\r\n]/u)
    .filter(line => /\S+/u.test(line)
        && line.indexOf('==UserScript==') === -1
        && line.indexOf('==/UserScript==') === -1)
    .reduce((obj: UserscriptMeta, line) => {
        const arr = line.trim().replace(/^\/\//u, '')
            .trim()
            .split(/\s+/u);
        const key = arr[0].slice(1);
        const value = arr.slice(1).join(' ');

        if (!(key in obj)) obj[key] = value;
        else if (Array.isArray(obj[key])) (obj[key] as string[]).push(value);
        else obj[key] = [obj[key] as string, value];

        return obj;
    }, {});

/**
 * Initialize userscripts
 */
export function initializeUserscripts(userscriptsPath: string, config: any) {
    su.userscriptsPath = userscriptsPath;
    su.config = config;

    // Ensure directories exist
    try {
        if (!existsSync(su.userscriptsPath)) {
            mkdirSync(su.userscriptsPath, { recursive: true });
            strippedConsole.log(`[Water] Created userscripts directory: ${su.userscriptsPath}`);
        }
    } catch (err) {
        strippedConsole.error('[Water] Failed to create userscript directories:', err);
        su.userscripts = [];
        return;
    }

    // Read all .js files from userscripts directory
    try {
        su.userscripts = readdirSync(su.userscriptsPath, { withFileTypes: true })
            .filter(entry => entry.name.endsWith('.js'))
            .map(entry => new Userscript({
                name: entry.name,
                fullpath: pathResolve(su.userscriptsPath, entry.name).toString()
            }));

        // Sort userscripts by priority (descending)
        su.userscripts = su.userscripts.sort((a, b) => b.priority - a.priority);
    } catch (err) {
        strippedConsole.error('[Water] Failed to read userscripts directory:', err);
        su.userscripts = [];
    }

    // Function to load premium scripts from cache
    const loadPremiumScriptsFromCache = () => {
        try {
            const premiumCache = (window as any).__PREMIUM_SCRIPTS_CACHE__;
            if (!premiumCache || !Array.isArray(premiumCache) || premiumCache.length === 0) {
                return;
            }

            // Check if already loaded to avoid duplicates
            const loadedNames = new Set(su.userscripts.map(u => u.name));
            const newScripts = premiumCache.filter(s => !loadedNames.has(s.name));

            if (newScripts.length === 0) {
                return;
            }

            strippedConsole.log(`[Water] Loading ${newScripts.length} premium scripts from memory cache`);

            for (const scriptData of newScripts) {
                try {
                    // Skip scripts without content
                    if (!scriptData.file_content) {
                        strippedConsole.warn(`[Water] Skipping premium script ${scriptData.name}: no file_content`);
                        continue;
                    }

                    // Create Userscript instance with content from memory
                    // Constructor parses metadata including settings from the content
                    const premiumScript = new Userscript({
                        name: scriptData.name,
                        fullpath: `[PURCHASED] ${scriptData.name}`,
                        content: scriptData.file_content
                    });

                    // Enhance metadata from Supabase (preserve parsed settings)
                    if (premiumScript.meta) {
                        premiumScript.meta.name = scriptData.name;
                        premiumScript.meta.author = scriptData.author || premiumScript.meta.author || 'Unknown';
                        premiumScript.meta.desc = scriptData.description || premiumScript.meta.desc || '';
                        premiumScript.meta['run-at'] = premiumScript.runAt;
                    }

                    su.userscripts.push(premiumScript);
                    strippedConsole.log(`[Water] Loaded premium script: ${scriptData.name} (runAt: ${premiumScript.runAt})`);
                } catch (e) {
                    strippedConsole.error(`[Water] Failed to load premium script ${scriptData.name}:`, e);
                }
            }

            // Re-sort after adding premium scripts
            su.userscripts = su.userscripts.sort((a, b) => b.priority - a.priority);
        } catch (err) {
            strippedConsole.error('[Water] Failed to load premium scripts from cache:', err);
        }
    };

    // Load immediately if cache already exists
    strippedConsole.log('[Water] Checking for premium scripts cache...');
    loadPremiumScriptsFromCache();

    // Function to execute a single userscript
    const executeScript = (u: Userscript) => {
        strippedConsole.log(`[Water] Processing script: ${u.name}, runAt: ${u.runAt}`);

        // Determine namespace based on script type
        const isPurchased = u.fullpath.startsWith('[PURCHASED]');
        const namespace = isPurchased ? 'purchased' : 'local';

        // Check if script is enabled (use appropriate namespace)
        const isEnabled = config.get(`userscripts.${namespace}.${u.name}.enabled`, true);

        strippedConsole.log(`[Water] Script ${u.name} enabled:`, isEnabled);

        if (isEnabled) {
            if (u.runAt === 'document-start') {
                strippedConsole.log(`[Water] Running ${u.name} at document-start`);
                u.load();
                u.hasRan = true;
            } else {
                strippedConsole.log(`[Water] Scheduling ${u.name} for document-end`);

                // Check if DOM is already loaded
                if (document.readyState === 'loading') {
                    // DOM is still loading, wait for DOMContentLoaded
                    const callback = () => {
                        strippedConsole.log(`[Water] DOMContentLoaded fired, running ${u.name}`);
                        u.load();
                        u.hasRan = true;
                    };
                    try { document.removeEventListener('DOMContentLoaded', callback); } catch (e) { }
                    document.addEventListener('DOMContentLoaded', callback, { once: true });
                } else {
                    // DOM already loaded, run immediately
                    strippedConsole.log(`[Water] DOM already loaded, running ${u.name} immediately`);
                    u.load();
                    u.hasRan = true;
                }
            }
        } else {
            strippedConsole.log(`[Water] Skipping disabled script: ${u.name}`);
        }
    };

    // Execute initially loaded scripts
    su.userscripts.forEach(executeScript);

    // Also listen for event when cache is populated (handles race condition)
    window.addEventListener('premiumScriptsReady', () => {
        strippedConsole.log('[Water] Received premiumScriptsReady event, loading from cache...');
        const beforeCount = su.userscripts.length;
        loadPremiumScriptsFromCache();
        const afterCount = su.userscripts.length;

        // Execute any newly added scripts
        if (afterCount > beforeCount) {
            strippedConsole.log(`[Water] ${afterCount - beforeCount} new scripts added, executing...`);
            for (let i = beforeCount; i < afterCount; i++) {
                executeScript(su.userscripts[i]);
            }
            // Dispatch event to refresh UI
            window.dispatchEvent(new CustomEvent('userscriptsUpdated'));
        }
    });
    
    // RACE CONDITION FIX: Check if event already fired before we set up listener
    if ((window as any).__PREMIUM_SCRIPTS_EVENT_FIRED__) {
        strippedConsole.log('[Water] premiumScriptsReady already fired (late listener), loading now...');
        const beforeCount = su.userscripts.length;
        loadPremiumScriptsFromCache();
        const afterCount = su.userscripts.length;
        if (afterCount > beforeCount) {
            strippedConsole.log(`[Water] ${afterCount - beforeCount} scripts loaded from late check`);
            for (let i = beforeCount; i < afterCount; i++) {
                executeScript(su.userscripts[i]);
            }
            window.dispatchEvent(new CustomEvent('userscriptsUpdated'));
        }
    }
    
    // RELIABILITY FIX: Periodic check for SkyColor (in case both initial attempts failed)
    let skyColorCheckAttempts = 0;
    const maxSkyColorChecks = 5;
    const checkInterval = setInterval(() => {
        skyColorCheckAttempts++;
        
        // Check if SkyColor is in cache but not loaded
        const cache = (window as any).__PREMIUM_SCRIPTS_CACHE__;
        const hasSkyColorInCache = cache && cache.some((s: any) => s.id === 'sky-color' || s.name?.toLowerCase().includes('sky'));
        const hasSkyColorLoaded = su.userscripts.some(u => u.name.toLowerCase().includes('sky') || u.fullpath.includes('sky-color'));
        
        if (hasSkyColorInCache && !hasSkyColorLoaded) {
            strippedConsole.log('[Water] SkyColor found in cache but not loaded, loading now...');
            const beforeCount = su.userscripts.length;
            loadPremiumScriptsFromCache();
            const afterCount = su.userscripts.length;
            if (afterCount > beforeCount) {
                for (let i = beforeCount; i < afterCount; i++) {
                    executeScript(su.userscripts[i]);
                }
                window.dispatchEvent(new CustomEvent('userscriptsUpdated'));
                clearInterval(checkInterval);
            }
        }
        
        // Stop checking after max attempts
        if (skyColorCheckAttempts >= maxSkyColorChecks) {
            clearInterval(checkInterval);
        }
    }, 1000); // Check every second for up to 5 seconds
}
