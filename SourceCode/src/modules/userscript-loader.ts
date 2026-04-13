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
    type: 'bool' | 'num' | 'sel' | 'color' | 'keybind' | 'text';
    changed: (newValue: any) => void;
    min?: number;
    max?: number;
    step?: number;
    opts?: string[];
}

interface UserscriptExport {
    unload?: () => void;
    settings?: { [key: string]: UserscriptSetting };
}

interface SharedUserscriptData {
    userscriptsPath: string;
    userscripts: Userscript[];
    config: any; // electron-store config
}

/** Shared userscript data */
export const su: SharedUserscriptData = {
    userscriptsPath: '',
    userscripts: [],
    config: null
};

/** Simple error alert for userscripts */
const errAlert = (err: Error, name: string) => {
    alert(`Userscript '${name}' had an error:\n\n${err.toString()}\n\nPlease fix the error, disable the userscript in the 'tracker.json' file or delete it.\nFeel free to check console for stack trace`);
};

/** Stripped console that works even when Krunker disables it */
export const strippedConsole = {
    log: (...args: any[]) => console.log(...args),
    warn: (...args: any[]) => console.warn(...args),
    error: (...args: any[]) => console.error(...args)
};

/** CSS toggle helper for userscripts */
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
 * Detects type based on value and creates appropriate setting
 */
const configToSettings = (config: any, scriptName: string): { [key: string]: UserscriptSetting } => {
    const settings: { [key: string]: UserscriptSetting } = {};
    
    for (const [key, value] of Object.entries(config)) {
        const setting: Partial<UserscriptSetting> = {
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
            // Set reasonable defaults based on value
            if (value >= 0 && value <= 1) {
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
                setting.step = 100;
            }
        } else if (typeof value === 'string') {
            // Check if it's a color (hex format)
            if (value.match(/^#([0-9a-fA-F]{3}){1,2}$/)) {
                setting.type = 'color';
            } else {
                // Use 'text' type for string inputs
                (setting as any).type = 'text';
                strippedConsole.log(`[Water] Adding text setting '${key}' with value: ${value}`);
            }
        } else {
            continue;
        }
        
        settings[key] = setting as UserscriptSetting;
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

/** Userscript class */
class Userscript {
    hasRan: boolean = false;
    strictMode: boolean = false;
    name: string;
    fullpath: string;
    meta: UserscriptMeta | false = false;
    unload: (() => void) | false = false;
    settings: { [key: string]: UserscriptSetting } = {};
    runAt: 'document-start' | 'document-end' = 'document-end';
    priority: number = 0;
    content: string;

    constructor(props: { name: string; fullpath: string }) {
        this.name = props.name;
        this.fullpath = props.fullpath;

        this.content = readFileSync(this.fullpath, { encoding: 'utf-8' });
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
            }) as UserscriptExport | undefined;

            strippedConsole.log(`[Water] '${this.name}' executed, exported:`, typeof exported, exported);

            // Userscript can return an object with unload and settings properties
            if (typeof exported !== 'undefined') {
                if ('unload' in exported) this.unload = exported.unload || false;
                if ('settings' in exported) {
                    this.settings = exported.settings || {};
                    strippedConsole.log(`[Water] '${this.name}' has ${Object.keys(this.settings).length} settings from return value`);
                }
            }
            
            // Try to detect and extract config object from script content (case-insensitive)
            if (!this.settings || Object.keys(this.settings).length === 0) {
                try {
                    // Match both 'config' and 'CONFIG' (case-insensitive)
                    const configMatch = this.content.match(/const\s+(config|CONFIG)\s*=\s*\{([^}]+)\}/is);
                    if (configMatch) {
                        const configStr = '{' + configMatch[2] + '}';
                        strippedConsole.log(`[Water] Found CONFIG in ${this.name}, parsing:`, configStr);
                        const configObj = new Function('return ' + configStr)();
                        
                        this.settings = configToSettings(configObj, this.name);
                        strippedConsole.log(`[Water] Auto-detected ${Object.keys(this.settings).length} config settings from ${this.name}`);
                    } else {
                        strippedConsole.log(`[Water] No CONFIG object found in ${this.name}`);
                    }
                } catch (e) {
                    strippedConsole.warn(`[Water] Failed to auto-detect config from ${this.name}:`, e);
                }
            }

            // Apply custom settings if they exist
            if (this.settings && Object.keys(this.settings).length > 0 && su.config) {
                try {
                    const configKey = `userscript.${this.name.replace(/\.js$/, '')}`;
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

/**
 * Load premium scripts from database (no local files)
 */
async function loadPremiumScriptsFromDatabase(config: any): Promise<Userscript[]> {
    const premiumScripts: Userscript[] = [];
    
    try {
        // Check if Discord is linked
        const isLinked = localStorage.getItem('water_store_linked') === 'true';
        if (!isLinked) {
            strippedConsole.log('[Water] Discord not linked - skipping premium scripts');
            return premiumScripts;
        }
        
        // Get client ID and Discord ID
        const clientId = localStorage.getItem('water_client_id');
        if (!clientId) return premiumScripts;
        
        const { getSupabaseClient } = require('../utils/supabase');
        const supabase = getSupabaseClient();
        if (!supabase) return premiumScripts;
        
        const { data: profileData } = await supabase.from('user_profiles').select('discord_id').eq('client_id', clientId).limit(1);
        if (!profileData || profileData.length === 0) return premiumScripts;
        
        const discordId = profileData[0].discord_id;
        
        // Get purchased scripts
        const { data: purchases } = await supabase.from('user_purchases').select('item_id').eq('discord_id', discordId);
        if (!purchases || purchases.length === 0) return premiumScripts;
        
        const itemIds = purchases.map((p: any) => p.item_id);
        
        // Get script details
        const { data: items } = await supabase.from('premium_items').select('id, name, github_path').eq('type', 'userscript').in('id', itemIds);
        if (!items || items.length === 0) return premiumScripts;
        
        // Fetch and create userscript objects
        const { fetchGitHubContent } = require('../utils/github');
        
        for (const item of items) {
            try {
                const result = await fetchGitHubContent(item.github_path);
                if (result.success && result.content) {
                    // Create userscript object manually without reading from file
                    const script = Object.create(Userscript.prototype);
                    script.hasRan = false;
                    script.strictMode = false;
                    script.name = item.name + '.js';
                    script.fullpath = `premium:${item.id}`;
                    script.meta = false;
                    script.unload = false;
                    script.settings = {};
                    script.runAt = 'document-end';
                    script.priority = 0;
                    script.content = '// Licensed to Discord ID: ' + discordId + '\n' + result.content;
                    
                    // Bind the load method from prototype
                    script.load = Userscript.prototype.load.bind(script);
                    
                    // Check for strict mode
                    if (script.content.startsWith('"use strict"')) {
                        script.strictMode = true;
                    }
                    
                    // Parse metadata if present
                    if (script.content.includes('// ==UserScript==') && script.content.includes('// ==/UserScript==')) {
                        let chunk = script.content.split('\n');
                        const startLine = chunk.findIndex(line => line.includes('// ==UserScript=='));
                        const endLine = chunk.findIndex(line => line.includes('// ==/UserScript=='));

                        if (startLine !== -1 && endLine !== -1) {
                            const metaChunk = chunk.slice(startLine, endLine + 1).join('\n');
                            script.meta = parseMetadata(metaChunk);

                            // Parse @run-at
                            if (script.meta && 'run-at' in script.meta && script.meta['run-at'] === 'document-start') {
                                script.runAt = 'document-start';
                            }

                            // Parse @priority
                            if (script.meta && 'priority' in script.meta && typeof script.meta['priority'] === "string") {
                                try {
                                    script.priority = parseInt(script.meta['priority']);
                                } catch (e) {
                                    script.priority = 0;
                                }
                            }
                        }
                    }
                    
                    premiumScripts.push(script);
                    strippedConsole.log(`[Water] Loaded premium script: ${item.name}`);
                }
            } catch (err) {
                strippedConsole.error(`[Water] Failed to load premium script ${item.name}:`, err);
            }
        }
        
        strippedConsole.log(`[Water] Loaded ${premiumScripts.length} premium scripts from database`);
    } catch (err) {
        strippedConsole.error('[Water] Failed to load premium scripts from database:', err);
    }
    
    return premiumScripts;
}

/**
 * Initialize userscripts
 */
export async function initializeUserscripts(userscriptsPath: string, config: any) {
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

        // Load premium scripts from database (async)
        const premiumScripts = await loadPremiumScriptsFromDatabase(config);
        su.userscripts.push(...premiumScripts);

        // Sort userscripts by priority (descending)
        su.userscripts = su.userscripts.sort((a, b) => b.priority - a.priority);
    } catch (err) {
        strippedConsole.error('[Water] Failed to read userscripts directory:', err);
        su.userscripts = [];
        return;
    }

    // Execute userscripts based on their run-at timing
    su.userscripts.forEach(u => {
        strippedConsole.log(`[Water] Processing script: ${u.name}, runAt: ${u.runAt}`);
        
        // Check if script is enabled
        const isEnabled = config.get(`userscripts.${u.name}.enabled`, true);
        
        strippedConsole.log(`[Water] Script ${u.name} enabled:`, isEnabled);
        
        if (isEnabled) {
            if (u.runAt === 'document-start') {
                strippedConsole.log(`[Water] Running ${u.name} at document-start`);
                u.load();
                u.hasRan = true;
            } else {
                strippedConsole.log(`[Water] Scheduling ${u.name} for document-end`);
                const callback = () => {
                    strippedConsole.log(`[Water] DOMContentLoaded fired, running ${u.name}`);
                    u.load();
                    u.hasRan = true;
                };
                try { document.removeEventListener('DOMContentLoaded', callback); } catch (e) { }
                document.addEventListener('DOMContentLoaded', callback, { once: true });
            }
        } else {
            strippedConsole.log(`[Water] Skipping disabled script: ${u.name}`);
        }
    });
}
