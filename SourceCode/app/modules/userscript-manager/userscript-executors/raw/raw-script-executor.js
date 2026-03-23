"use strict";

let IScriptExecutor = require("../script-executor.interface");

/* eslint-disable no-new-func */

/**
 * Raw Script Executor for Tampermonkey/Greasemonkey scripts
 * and plain JavaScript console scripts
 * 
 * @class RawScriptExecutor
 */
class RawScriptExecutor extends IScriptExecutor {
    constructor(data, clientUtils, windowType, config, filename = null) {
        super();
        this.data = data;
        this.clientUtils = clientUtils;
        this.windowType = windowType;
        this.config = config;
        this.filename = filename;
        this.script = null;
        this.metadata = {};
        this.isLoaded = false;
        this.loadScript();
    }

    /**
     * Parse Tampermonkey metadata block
     */
    parseMetadata() {
        const scriptText = this.data.toString();
        const metadataMatch = scriptText.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);

        if (!metadataMatch) {
            return {
                name: "Unnamed Script",
                match: ["*://krunker.io/*"],
                "run-at": "document-end"
            };
        }

        const metadataText = metadataMatch[1];
        const metadata = metadataText.split(/[\r\n]/)
            .filter(line => /\S+/.test(line)
                && line.indexOf('==UserScript==') === -1
                && line.indexOf('==/UserScript==') === -1)
            .reduce((obj, line) => {
                const arr = line.trim().replace(/^\/\//, '').trim().split(/\s+/);
                const key = arr[0].slice(1);
                const value = arr.slice(1).join(' ');

                if (!(key in obj)) {
                    obj[key] = value;
                } else if (Array.isArray(obj[key])) {
                    obj[key].push(value);
                } else {
                    obj[key] = [obj[key], value];
                }

                return obj;
            }, {});

        for (const metaKey in metadata) {
            if (Array.isArray(metadata[metaKey])) {
                metadata[metaKey] = metadata[metaKey][metadata[metaKey].length - 1];
            }
        }

        metadata.name = metadata.name || "Unnamed Script";
        metadata.match = metadata.match || "*://krunker.io/*";
        metadata["run-at"] = metadata["run-at"] || "document-end";

        return metadata;
    }

    extractScriptCode() {
        let scriptText = this.data.toString();
        scriptText = scriptText.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
        return scriptText;
    }

    loadScript() {
        try {
            this.metadata = this.parseMetadata();
            const code = this.extractScriptCode();

            this.script = {
                code: code,
                metadata: this.metadata
            };
            
            console.log('[RawScript] Loaded script:', this.metadata.name, 'Run-at:', this.metadata["run-at"]);
        } catch (e) {
            console.error('[RawScriptExecutor] Failed to load script:', e);
            this.script = null;
        }
    }

    isValidScript() {
        return Boolean(this.script) && Boolean(this.script.code);
    }

    isLocationMatching() {
        return true;
    }

    isPlatformMatching() {
        return true;
    }

    shouldExecute() {
        if (!this.isValidScript()) return 1;
        return 0;
    }

    async preloadScript() {
            // Extract settings - wrapped in try-catch to never block script execution
            try {
                const code = this.script.code;
                const scriptId = this.filename ? this.filename.replace('.js', '') : (this.metadata.name || "Userscript").replace(/[^a-zA-Z0-9]/g, '_');
                const converted = {};

                console.log(`[RawScript] Processing: ${scriptId}`);
                console.log(`[RawScript] Filename in preload: ${this.filename}`);

                // Try Crankshaft format first (this.settings = {...})
                try {
                    let settingsMatch = code.match(/this\.settings\s*=\s*\{([\s\S]*?)\};?\s*return\s+this/) || code.match(/this\.settings\s*=\s*\{([\s\S]*?)\};/);

                    if (settingsMatch) {
                        console.log('[RawScript] Found Crankshaft-style this.settings');
                        let settingsCode = settingsMatch[1].replace(/,(\s*)\}/g, '$1}');
                        const settingsObj = new Function('return {' + settingsCode + '\n};')();

                        for (const [key, setting] of Object.entries(settingsObj)) {
                            if (setting && typeof setting === 'object' && setting.title && setting.type && ('value' in setting)) {
                                const savedValue = localStorage.getItem(`water-script-setting-${scriptId}-${key}`);
                                const currentValue = savedValue !== null ? JSON.parse(savedValue) : setting.value;

                                converted[key] = {
                                    name: setting.title || key,
                                    id: key,
                                    cat: scriptId,
                                    type: this.#mapSettingType(setting.type),
                                    val: currentValue,
                                    info: setting.desc || undefined,
                                    isUserscript: true,
                                    html() { return window.UtilManager?.instance?.clientUtils?.genCSettingsHTML?.(this) || ''; },
                                    set: (val) => {
                                        localStorage.setItem(`water-script-setting-${scriptId}-${key}`, JSON.stringify(val));
                                        window.dispatchEvent(new CustomEvent('water-setting-changed', { detail: { scriptId, settingKey: key, value: val } }));
                                    }
                                };

                                if (setting.type === 'num' || setting.type === 'slider') {
                                    converted[key].min = setting.min !== undefined ? setting.min : 0;
                                    converted[key].max = setting.max !== undefined ? setting.max : 100;
                                    converted[key].step = setting.step !== undefined ? setting.step : 1;
                                    converted[key].type = 'slider';
                                }
                                if (setting.type === 'color') converted[key].type = 'color';
                            }
                        }
                    }
                } catch (e) { console.warn('[RawScript] Crankshaft parse failed:', e); }

                // Try plain config object if no Crankshaft settings found
                if (Object.keys(converted).length === 0) {
                    try {
                        // Match config with or without comments, single or multi-line
                        let configMatch = code.match(/const\s+config\s*=\s*\{([\s\S]*?)\n\s*\};/);
                        
                        if (configMatch) {
                            // Remove inline comments before parsing
                            let configCode = configMatch[1]
                                .replace(/\/\/.*$/gm, '')  // Remove inline comments
                                .replace(/,(\s*)\}/g, '$1}');  // Remove trailing commas
                            
                            const configObj = new Function('return {' + configCode + '\n};')();

                            console.log(`[RawScript] Found config with ${Object.keys(configObj).length} keys`);

                            for (const [key, value] of Object.entries(configObj)) {
                                const savedValue = localStorage.getItem(`water-script-setting-${scriptId}-${key}`);
                                const currentValue = savedValue !== null ? JSON.parse(savedValue) : value;

                                let type = 'text', min, max, step, name, info;

                                // Generate better names and descriptions
                                name = this.#generateSettingName(key);
                                info = this.#generateSettingDescription(key, value);

                                if (typeof value === 'boolean') {
                                    type = 'checkbox';
                                } else if (typeof value === 'number') {
                                    type = 'slider';
                                    const ranges = this.#detectNumberRange(key, value);
                                    min = ranges.min;
                                    max = ranges.max;
                                    step = ranges.step;
                                } else if (typeof value === 'string' && value.match(/^#[0-9A-Fa-f]{6}$/)) {
                                    type = 'color';
                                }

                                converted[key] = {
                                    name: name,
                                    id: key,
                                    cat: scriptId,
                                    type: type,
                                    val: currentValue,
                                    info: info,
                                    isUserscript: true,
                                    html() { return window.UtilManager?.instance?.clientUtils?.genCSettingsHTML?.(this) || ''; },
                                    set: (val) => {
                                        localStorage.setItem(`water-script-setting-${scriptId}-${key}`, JSON.stringify(val));
                                        window.dispatchEvent(new CustomEvent('water-setting-changed', { detail: { scriptId, settingKey: key, value: val } }));
                                    }
                                };

                                if (type === 'slider') {
                                    converted[key].min = min;
                                    converted[key].max = max;
                                    converted[key].step = step;
                                }
                            }
                            console.log(`[RawScript] Extracted ${Object.keys(converted).length} settings`);
                        }
                    } catch (e) { console.warn('[RawScript] Config parse failed:', e); }
                }

                // Add to settings objects (Crankshaft-compatible approach)
                if (Object.keys(converted).length > 0) {
                    Object.assign(this.clientUtils.settings, converted);
                    
                    // Also expose to window context for Water UI to access
                    if (!window.waterUserscriptSettings) window.waterUserscriptSettings = {};
                    Object.assign(window.waterUserscriptSettings, converted);
                    
                    console.log(`[RawScript] Added ${Object.keys(converted).length} settings for ${scriptId}`);
                }
            } catch (e) {
                console.warn('[RawScript] Settings extraction failed (script will still run):', e);
            }

            return Promise.resolve();
        }

    #mapSettingType(type) {
        const typeMap = {
            'bool': 'checkbox',
            'checkbox': 'checkbox',
            'num': 'slider',
            'slider': 'slider',
            'text': 'text',
            'color': 'color',
            'select': 'select',
            'button': 'button'
        };
        return typeMap[type] || 'text';
    }

    #generateSettingName(key) {
        // Handle common patterns for better names
        const nameMap = {
            'skyColorR': 'Sky Color (Red)',
            'skyColorG': 'Sky Color (Green)',
            'skyColorB': 'Sky Color (Blue)',
            'soundVolume': 'Sound Volume',
            'iconSize': 'Icon Size',
            'fontSize': 'Font Size',
            'streakResetTime': 'Streak Reset Time',
            'fadeOutDelay': 'Fade Out Delay',
            'showKillCounter': 'Show Kill Counter',
            'counterFontSize': 'Counter Font Size',
            'multiIconMode': 'Multi Icon Mode',
            'enabled': 'Enabled'
        };

        if (nameMap[key]) return nameMap[key];

        // Convert camelCase to Title Case with better spacing
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/\s+/g, ' ')
            .trim();
    }

    #generateSettingDescription(key, value) {
        // Generate helpful descriptions based on key patterns
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('color') && keyLower.includes('r')) return 'Red component (0.0 to 1.0)';
        if (keyLower.includes('color') && keyLower.includes('g')) return 'Green component (0.0 to 1.0)';
        if (keyLower.includes('color') && keyLower.includes('b')) return 'Blue component (0.0 to 1.0)';
        if (keyLower.includes('volume')) return 'Audio volume level (0.0 = muted, 1.0 = max)';
        if (keyLower.includes('size') && !keyLower.includes('font')) return 'Size in pixels';
        if (keyLower.includes('fontsize') || keyLower.includes('font') && keyLower.includes('size')) return 'Font size in pixels';
        if (keyLower.includes('time') || keyLower.includes('delay')) return 'Time in milliseconds';
        if (keyLower.includes('enabled')) return 'Enable or disable this feature';
        if (keyLower.includes('show')) return 'Show or hide this element';
        if (keyLower.includes('mode')) return 'Toggle between different display modes';
        if (keyLower.includes('counter')) return 'Display counter information';
        
        return undefined; // No description
    }

    #detectNumberRange(key, value) {
        const keyLower = key.toLowerCase();
        
        // Color components (0.0 to 1.0)
        if (keyLower.includes('color') && (keyLower.includes('r') || keyLower.includes('g') || keyLower.includes('b'))) {
            return { min: 0, max: 1, step: 0.01 };
        }
        
        // Volume (0.0 to 1.0)
        if (keyLower.includes('volume')) {
            return { min: 0, max: 1, step: 0.01 };
        }
        
        // Sizes in pixels
        if (keyLower.includes('size') && !keyLower.includes('font')) {
            return { min: 0, max: 500, step: 1 };
        }
        
        // Font sizes
        if (keyLower.includes('fontsize') || (keyLower.includes('font') && keyLower.includes('size'))) {
            return { min: 8, max: 72, step: 1 };
        }
        
        // Time/delay in milliseconds
        if (keyLower.includes('time') || keyLower.includes('delay')) {
            return { min: 0, max: 30000, step: 100 };
        }
        
        // Opacity/alpha
        if (keyLower.includes('opacity') || keyLower.includes('alpha')) {
            return { min: 0, max: 1, step: 0.01 };
        }
        
        // Percentages
        if (keyLower.includes('percent') || keyLower.includes('pct')) {
            return { min: 0, max: 100, step: 1 };
        }
        
        // Default: use value to guess range
        if (value >= 0 && value <= 1) {
            return { min: 0, max: 1, step: 0.01 };
        } else if (value >= 0 && value <= 100) {
            return { min: 0, max: 100, step: 1 };
        } else if (value >= 0 && value <= 1000) {
            return { min: 0, max: 1000, step: 1 };
        } else {
            return { min: 0, max: 10000, step: 1 };
        }
    }

    async executeScript() {
        if (!this.script || this.isLoaded) {
            return Promise.resolve();
        }

        try {
            console.log('[RawScript] Executing: ' + this.metadata.name);

            let code = this.script.code;
            const runAt = this.metadata["run-at"] || 'document-end';
            const scriptId = this.filename ? this.filename.replace('.js', '') : (this.metadata.name || "Userscript").replace(/[^a-zA-Z0-9]/g, '_');

            console.log('[RawScript] Script ID for execution:', scriptId);
            console.log('[RawScript] Filename:', this.filename);

            // Check if script has Crankshaft-style this.settings
            const crankshaftMatch = code.match(/this\.settings\s*=\s*\{([\s\S]*?)\};/);
            
            if (crankshaftMatch) {
                console.log('[RawScript] Detected Crankshaft format, injecting setting values');
                
                // Build injection code that updates setting values from localStorage
                let injectionCode = `(function() {
    const scriptId = ${JSON.stringify(scriptId)};
    const originalSettings = this.settings;
    
    // Load saved values and update the settings
    for (const key in originalSettings) {
        const setting = originalSettings[key];
        if (setting && typeof setting === 'object' && 'value' in setting) {
            const savedValue = localStorage.getItem('water-script-setting-' + scriptId + '-' + key);
            if (savedValue !== null) {
                try {
                    const parsedValue = JSON.parse(savedValue);
                    console.log('[Water] Applying saved value for ' + scriptId + '.' + key + ':', parsedValue);
                    setting.value = parsedValue;
                    
                    // Call changed callback if it exists
                    if (typeof setting.changed === 'function') {
                        setting.changed.call(setting, parsedValue);
                    }
                } catch (e) {
                    console.warn('[Water] Failed to parse setting:', key, e);
                }
            }
        }
    }
    
    // Listen for setting changes from UI
    window.addEventListener('water-setting-changed', function(e) {
        if (e.detail && e.detail.scriptId === scriptId) {
            const setting = originalSettings[e.detail.settingKey];
            if (setting && typeof setting === 'object') {
                setting.value = e.detail.value;
                console.log('[Water] Setting updated ' + scriptId + '.' + e.detail.settingKey + ' =', e.detail.value);
                
                // Call changed callback
                if (typeof setting.changed === 'function') {
                    setting.changed.call(setting, e.detail.value);
                }
            }
        }
    });
}).call(this);`;
                
                // Find where to inject (after this.settings = {...};)
                const settingsEndIndex = crankshaftMatch.index + crankshaftMatch[0].length;
                code = code.slice(0, settingsEndIndex) + '\n' + injectionCode + '\n' + code.slice(settingsEndIndex);
                
                console.log('[RawScript] Injected Crankshaft settings handler');
            }
            
            // Check if script has a config object that needs to be overridden with localStorage values
            const configMatch = code.match(/const\s+config\s*=\s*\{([\s\S]*?)\n\s*\};/) || 
                               code.match(/const\s+config\s*=\s*\{([^}]+)\};/);
            
            console.log('[RawScript] Config match found:', !!configMatch, 'for', scriptId);
            
            if (configMatch && !crankshaftMatch) {  // Only process if not Crankshaft format
                // Replace the config declaration with one that reads from localStorage
                const configCode = configMatch[1];
                console.log('[RawScript] Config code extracted, length:', configCode.length);
                
                const configReplacement = `const config = (function() {
    const scriptId = ${JSON.stringify(scriptId)};
    const defaultConfig = {${configCode}
    };
    
    console.log('[Water] Script ' + scriptId + ' default config:', JSON.stringify(defaultConfig));
    
    // Override with localStorage values
    for (const key in defaultConfig) {
        const savedValue = localStorage.getItem('water-script-setting-' + scriptId + '-' + key);
        if (savedValue !== null) {
            try {
                const parsedValue = JSON.parse(savedValue);
                console.log('[Water] Overriding ' + scriptId + '.' + key + ' from', defaultConfig[key], 'to', parsedValue);
                defaultConfig[key] = parsedValue;
            } catch (e) {
                console.warn('[Water] Failed to parse setting:', key, e);
            }
        } else {
            console.log('[Water] No saved value for ' + scriptId + '.' + key + ', using default:', defaultConfig[key]);
        }
    }
    
    // Listen for setting changes
    window.addEventListener('water-setting-changed', function(e) {
        if (e.detail && e.detail.scriptId === scriptId) {
            defaultConfig[e.detail.settingKey] = e.detail.value;
            console.log('[Water] Setting updated ' + scriptId + '.' + e.detail.settingKey + ' =', e.detail.value);
        }
    });
    
    console.log('[Water] Final config for ' + scriptId + ':', JSON.stringify(defaultConfig));
    return defaultConfig;
})();`;
                
                code = code.replace(configMatch[0], configReplacement);
                console.log('[RawScript] Injected config override for', scriptId);
            } else if (!crankshaftMatch) {
                console.log('[RawScript] No config object found in script', scriptId);
                
                // For scripts without config (like obfuscated Crankshaft scripts),
                // inject settings as a global object that the script can access
                const settingsFromStorage = {};
                const settingsKeys = Object.keys(localStorage).filter(key => key.startsWith(`water-script-setting-${scriptId}-`));
                
                if (settingsKeys.length > 0) {
                    console.log('[RawScript] Found', settingsKeys.length, 'settings in localStorage for', scriptId);
                    
                    settingsKeys.forEach(key => {
                        const settingKey = key.replace(`water-script-setting-${scriptId}-`, '');
                        try {
                            settingsFromStorage[settingKey] = JSON.parse(localStorage.getItem(key));
                        } catch (e) {
                            console.warn('[RawScript] Failed to parse setting:', settingKey, e);
                        }
                    });
                    
                    // Inject settings before the script runs
                    const settingsInjection = `
(function() {
    const scriptId = '${scriptId}';
    const waterSettings = ${JSON.stringify(settingsFromStorage)};
    
    console.log('[Water] Injected settings for ${scriptId}:', waterSettings);
    
    // Make settings available globally for the script to access
    window.waterScriptSettings = window.waterScriptSettings || {};
    window.waterScriptSettings['${scriptId}'] = waterSettings;
    
    // Listen for setting changes
    window.addEventListener('water-setting-changed', function(e) {
        if (e.detail && e.detail.scriptId === scriptId) {
            waterSettings[e.detail.settingKey] = e.detail.value;
            window.waterScriptSettings['${scriptId}'][e.detail.settingKey] = e.detail.value;
            console.log('[Water] Setting updated ' + scriptId + '.' + e.detail.settingKey + ' =', e.detail.value);
        }
    });
})();
`;
                    
                    code = settingsInjection + code;
                    console.log('[RawScript] Injected global settings object for', scriptId);
                }
            }

            const injectScript = () => {
                try {
                    console.log('[RawScript] Injecting script:', this.metadata.name, 'at', document.readyState);
                    
                    let wrappedCode = code;
                    
                    // If page is already loaded and script uses window.addEventListener('load'),
                    // we need to trigger it immediately
                    if (document.readyState === 'complete' && code.includes("window.addEventListener('load'")) {
                        wrappedCode = `
                            (function() {
                                // Store original addEventListener
                                const originalAddEventListener = window.addEventListener;
                                let loadListenerAdded = false;
                                
                                // Override addEventListener temporarily to catch 'load' listeners
                                window.addEventListener = function(event, handler, options) {
                                    if (event === 'load' && !loadListenerAdded) {
                                        loadListenerAdded = true;
                                        // Page already loaded, execute handler immediately
                                        console.log('[Water] Page already loaded, executing load handler immediately');
                                        if (typeof handler === 'function') {
                                            setTimeout(handler, 0);
                                        }
                                        // Restore original
                                        window.addEventListener = originalAddEventListener;
                                        return;
                                    }
                                    return originalAddEventListener.call(this, event, handler, options);
                                };
                                
                                // Execute the script
                                ${wrappedCode}
                                
                                // Restore original addEventListener after script execution
                                setTimeout(() => {
                                    window.addEventListener = originalAddEventListener;
                                }, 100);
                            })();
                        `;
                    }
                    
                    // Inject script
                    const scriptElement = document.createElement('script');
                    scriptElement.textContent = wrappedCode;
                    scriptElement.type = 'text/javascript';
                    (document.head || document.documentElement).appendChild(scriptElement);
                    scriptElement.remove();
                    console.log('[RawScript] Successfully injected "' + this.metadata.name + '"');
                } catch (e) {
                    console.error('[RawScript] Injection error in "' + this.metadata.name + '":', e);
                }
            };

            if (runAt === 'document-start' || runAt === 'document.start') {
                injectScript();
            } else if (runAt === 'document-end') {
                // Inject immediately if DOM is already loaded, otherwise wait
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', injectScript, { once: true });
                } else {
                    // DOM already loaded, inject immediately
                    injectScript();
                }
            } else if (runAt === 'document-idle') {
                // Inject immediately if page is fully loaded, otherwise wait
                if (document.readyState === 'complete') {
                    injectScript();
                } else {
                    window.addEventListener('load', injectScript, { once: true });
                }
            } else {
                // Default: same as document-end
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', injectScript, { once: true });
                } else {
                    injectScript();
                }
            }

            this.isLoaded = true;
        } catch (e) {
            console.error('[RawScript] Failed to execute "' + this.metadata.name + '":', e);
        }

        return Promise.resolve();
    }

    async unloadScript() {
        this.isLoaded = false;
        return Promise.resolve();
    }
}

module.exports = RawScriptExecutor;
