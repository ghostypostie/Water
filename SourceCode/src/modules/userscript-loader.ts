/**
 * Water Client userscript loader
 * Executes userscripts in renderer context with proper timing and context
 * Supports: Local scripts, Premium scripts
 * 
 * Upgrade v2: Smart config detection, document-idle, file validation,
 *             orphan cleanup, storage quotas, enhanced GM_info
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve as pathResolve } from 'path';
import { errorManager } from './userscript-error-manager';
import { hotReload } from './userscript-hot-reload';
import { dependencyManager } from './userscript-dependency-manager';
import { performanceMonitor } from './userscript-performance-monitor';
import { tsCompiler } from './userscript-typescript-compiler';
import { humanizeKey, inferSettingType, validateScriptFile, cleanOrphanSettings, getScriptNamespace } from './userscript-utils';

interface UserscriptMeta {
    [key: string]: string | string[];
    name?: string;
    author?: string;
    version?: string;
    desc?: string;
    description?: string;
    'run-at'?: string;
    priority?: string;
    grant?: string | string[];
}

interface UserscriptSetting {
    title: string;
    desc: string;
    value: any;
    type?: string;
    min?: number;
    max?: number;
    step?: number;
    opts?: string[];
    changed?: (newValue: any) => void;
    requiresRestart?: boolean;
}

interface UserscriptSettings {
    [key: string]: UserscriptSetting;
}

export class Userscript {
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
    scriptType: 'local' | 'premium' = 'local';
    dependencies: string[] = [];
    dependenciesLoaded: boolean = false;

    constructor(props: { name: string; fullpath: string; content?: string }) {
        this.name = props.name;
        this.fullpath = props.fullpath;

        // If content is provided (premium scripts), use it; otherwise read from disk
        if (props.content) {
            this.content = props.content;
        } else {
            this.content = readFileSync(this.fullpath, { encoding: 'utf-8' });
        }

        // Compile TypeScript if needed
        if (tsCompiler.isTypeScriptFile(this.name)) {
            try {
                const sourceTimestamp = props.content ? Date.now() : statSync(this.fullpath).mtimeMs;
                const result = tsCompiler.compileWithCache(this.content, this.name, sourceTimestamp);
                
                if (result.success && result.code) {
                    this.content = result.code;
                    strippedConsole.log(`[Water] Compiled TypeScript: ${this.name}`);
                    
                    // Log warnings if any
                    if (result.diagnostics && result.diagnostics.length > 0) {
                        strippedConsole.warn(`[Water] TypeScript warnings for ${this.name}:`, result.diagnostics);
                    }
                } else {
                    throw new Error(`TypeScript compilation failed:\n${result.diagnostics?.join('\n')}`);
                }
            } catch (e: any) {
                strippedConsole.error(`[Water] Failed to compile TypeScript ${this.name}:`, e);
                throw e;
            }
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

                // Parse @run-at (support document-start, document-end, document-idle)
                if ('run-at' in this.meta) {
                    const runAtValue = (this.meta['run-at'] as string).trim().toLowerCase();
                    if (runAtValue === 'document-start') {
                        this.runAt = 'document-start';
                    } else if (runAtValue === 'document-idle') {
                        this.runAt = 'document-idle';
                    } else {
                        this.runAt = 'document-end';
                    }
                }

                // Parse @description alias → desc
                if (!this.meta['desc'] && this.meta['description']) {
                    this.meta['desc'] = this.meta['description'];
                }

                // Parse @priority (fix: add radix 10 to parseInt)
                this.priority = 0;
                if ('priority' in this.meta && typeof this.meta['priority'] === "string") {
                    try {
                        this.priority = parseInt(this.meta['priority'], 10);
                    } catch (e) {
                        strippedConsole.log("Error while parsing userscript priority: ", e);
                        this.priority = 0;
                    }
                }

                // Parse @require dependencies
                if ('require' in this.meta) {
                    const requires = this.meta['require'];
                    this.dependencies = Array.isArray(requires) ? requires : [requires];
                    strippedConsole.log(`[Water] ${this.name} has ${this.dependencies.length} dependencies`);
                }
            }
        }
    }

    /** Runs the userscript */
    async load() {
        const endMeasure = performanceMonitor.startMeasure(this.name, this.scriptType);
        
        try {
            strippedConsole.log(`[Water] Attempting to execute '${this.name}'...`);

            // Load dependencies first if not already loaded
            let dependencyCode = '';
            if (this.dependencies.length > 0 && !this.dependenciesLoaded) {
                try {
                    const depStartTime = performance.now();
                    strippedConsole.log(`[Water] Loading ${this.dependencies.length} dependencies for ${this.name}...`);
                    const deps = await dependencyManager.loadDependencies(this.dependencies, this.name);
                    dependencyCode = deps.join('\n\n');
                    this.dependenciesLoaded = true;
                    const depLoadTime = performance.now() - depStartTime;
                    performanceMonitor.recordLoadTime(this.name, depLoadTime);
                    strippedConsole.log(`[Water] Loaded ${deps.length} dependencies for ${this.name} in ${depLoadTime.toFixed(2)}ms`);
                } catch (e: any) {
                    throw new Error(`Dependency loading failed: ${e.message}`);
                }
            }

            // Combine dependency code with script code
            let fullCode = dependencyCode ? dependencyCode + '\n\n' + this.content : this.content;
            
            // INJECT SAVED SETTINGS + EXPOSE LIVE CONFIG REF
            // Strategy: scan the script for `const|let|var IDENT = { ... }` declarations and pick
            // the one whose keys best identify the script's config object. Inject:
            //   1) overrides to apply any saved settings BEFORE the script's logic runs, AND
            //   2) `window.__<Script>CONFIG = IDENT` so the post-execution auto-detect step holds
            //      a live reference (setting.changed() then mutates the real object, not a copy).
            // Handles arbitrary naming (CONFIG, config, Config, settings, OPTIONS, opts, …) and
            // `let`/`var`/`const` — the previous regex only matched `const CONFIG|config`.
            try {
                const isPurchased = this.fullpath.startsWith('[PURCHASED]');
                const namespace = isPurchased ? 'purchased' : this.scriptType;
                const configKey = `userscript.${namespace}.${this.name.replace(/\.js$/, '')}`;
                const savedSettings = su.config.get(configKey, {});
                const savedKeys = new Set(Object.keys(savedSettings || {}));
                const hasSaved = savedKeys.size > 0;

                const cleanName = this.name.replace(/\s+/g, '').replace(/\.js$/i, '');
                const exposedVarName = `__${cleanName}CONFIG`;

                // Common config-object identifiers — used as a fallback ranking signal when
                // there are no saved settings to compare keys against.
                const configNameHints = new Set([
                    'CONFIG', 'config', 'Config',
                    'SETTINGS', 'settings', 'Settings',
                    'OPTIONS', 'options', 'Options', 'opts',
                    'CFG', 'cfg',
                ]);

                // Find every `const|let|var IDENT = {` declaration
                const declRegex = /(^|\n)([ \t]*)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
                let bestMatch: { varName: string; injectAt: number; score: number } | null = null;
                let m: RegExpExecArray | null;

                while ((m = declRegex.exec(fullCode)) !== null) {
                    const varName = m[3];
                    const objStart = m.index + m[0].length - 1; // position of opening `{`

                    // Brace-count to find matching `}`
                    let braces = 0;
                    let objEnd = -1;
                    for (let i = objStart; i < fullCode.length; i++) {
                        const ch = fullCode[i];
                        if (ch === '{') braces++;
                        else if (ch === '}') {
                            braces--;
                            if (braces === 0) { objEnd = i + 1; break; }
                        }
                    }
                    if (objEnd === -1) continue;

                    // Try to parse the object so we can score it against savedSettings keys
                    const objSrc = fullCode.slice(objStart, objEnd);
                    let parsed: any = null;
                    try {
                        parsed = new Function('return (' + objSrc + ')')();
                    } catch {
                        continue;
                    }
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;

                    // Score: prefer overlap with savedSettings keys; fall back to known
                    // config identifiers; ignore tiny single-key objects that are probably options.
                    let score = 0;
                    if (hasSaved) {
                        for (const k of Object.keys(parsed)) if (savedKeys.has(k)) score += 10;
                        if (score === 0) continue; // no overlap → not our config
                    } else {
                        // First-run heuristic: needs to look like a config object
                        const keyCount = Object.keys(parsed).length;
                        if (keyCount < 2) continue;
                        if (configNameHints.has(varName)) score += 5;
                        score += Math.min(keyCount, 10); // bigger objects ≈ more likely to be config
                        if (score < 5) continue;
                    }

                    // Walk to end of declaration line so we inject AFTER it
                    let injectAt = objEnd;
                    while (injectAt < fullCode.length && fullCode[injectAt] !== '\n') injectAt++;
                    if (injectAt < fullCode.length) injectAt++; // step past the newline

                    if (!bestMatch || score > bestMatch.score) {
                        bestMatch = { varName, injectAt, score };
                    }
                }

                if (bestMatch) {
                    const { varName, injectAt } = bestMatch;
                    const overridesJSON = hasSaved ? JSON.stringify(savedSettings) : '{}';
                    const overrideCode =
`// Water: expose ${varName} live + apply saved settings
try {
    window['${exposedVarName}'] = ${varName};
    var __WATER_SAVED__ = ${overridesJSON};
    Object.keys(__WATER_SAVED__).forEach(function(key) {
        if (key in ${varName} && typeof __WATER_SAVED__[key] === typeof ${varName}[key]) {
            ${varName}[key] = __WATER_SAVED__[key];
        }
    });
} catch (e) {
    console.error('[Water] Failed to wire ${varName}:', e);
}
`;
                    fullCode = fullCode.slice(0, injectAt) + overrideCode + fullCode.slice(injectAt);
                    strippedConsole.log(`[Water] ✓ Wired '${varName}' for ${this.name} (score ${bestMatch.score}${hasSaved ? `, ${savedKeys.size} saved` : ''})`);
                } else if (hasSaved) {
                    strippedConsole.warn(`[Water] Could not find a config object matching saved keys for ${this.name} — saved values will be applied via setting.changed() after execution`);
                }
            } catch (e) {
                strippedConsole.error(`[Water] Failed to inject saved settings for ${this.name}:`, e);
                // Continue with original code if injection fails
                fullCode = dependencyCode ? dependencyCode + '\n\n' + this.content : this.content;
            }
            
            // Execute script with proper context binding
            // Provide config access for scripts that need electron-store functionality
            const mockRequire = (moduleName: string) => {
                if (moduleName === 'electron-store') {
                    // Return a wrapper around Water's config
                    return class MockStore {
                        get(key: string, defaultValue?: any) {
                            return su.config ? su.config.get(key, defaultValue) : defaultValue;
                        }
                        set(key: string, value: any) {
                            if (su.config) su.config.set(key, value);
                        }
                        delete(key: string) {
                            if (su.config) su.config.delete(key);
                        }
                        has(key: string) {
                            return su.config ? su.config.has(key) : false;
                        }
                    };
                }
                throw new Error(`Module '${moduleName}' is not available in userscript context. Only 'electron-store' is supported.`);
            };
            
            const context = {
                unload: false,
                settings: {},
                _console: strippedConsole,
                _css: userscriptToggleCSS
            };
            
            // Execute script - try as IIFE first, then as regular script
            let exported;
            try {
                // Execute the code
                exported = new Function('require', fullCode).call(context, mockRequire);
                strippedConsole.log(`[Water] '${this.name}' executed successfully, exported:`, typeof exported);
            } catch (e: any) {
                strippedConsole.error(`[Water] Script execution failed for ${this.name}:`, e);
                throw new Error(`Script execution failed: ${e.message}`);
            }

            strippedConsole.log(`[Water] '${this.name}' executed, exported:`, typeof exported, exported);

            // Userscript can return an object with unload and settings properties
            if (typeof exported !== 'undefined' && exported !== null) {
                if ('unload' in exported) this.unload = exported.unload;
                if ('settings' in exported) {
                    this.settings = exported.settings;
                    strippedConsole.log(`[Water] '${this.name}' has ${Object.keys(this.settings).length} settings from return value`);
                }
                
                // Check if script returned CONFIG object
                if ('CONFIG' in exported && typeof exported.CONFIG === 'object') {
                    strippedConsole.log(`[Water] '${this.name}' returned CONFIG object:`, exported.CONFIG);
                    // Store reference to the actual CONFIG object
                    const cleanName = this.name.replace(/\s+/g, '').replace(/\.js$/i, '');
                    const configVarName = `__${cleanName}CONFIG`;
                    (window as any)[configVarName] = exported.CONFIG;
                    strippedConsole.log(`[Water] Stored CONFIG at window.${configVarName}`);
                }
            }
            
            // Try to detect and extract config object from script content
            // This supports IIFE-wrapped scripts that don't explicitly return settings
            if (!this.settings || Object.keys(this.settings).length === 0) {
                try {
                    let configObj = null;
                    
                    // First, try to get CONFIG from window (if script exposed it)
                    // Wait a tick for the script's window assignment to complete
                    await new Promise(resolve => setTimeout(resolve, 0));
                    
                    const cleanName = this.name.replace(/\s+/g, '').replace(/\.js$/i, '');
                    const configVarName = `__${cleanName}CONFIG`;
                    configObj = (window as any)[configVarName];
                    
                    if (configObj) {
                        strippedConsole.log(`[Water] '${this.name}' found exposed CONFIG at window.${configVarName}`, configObj);
                        this.settings = configToSettings(configObj, this.name);
                        strippedConsole.log(`[Water] Auto-detected ${Object.keys(this.settings).length} config settings from ${this.name}`);
                    } else {
                        // Fallback: Parse from script content
                        // Improved regex to match multi-line config objects
                        // Matches: const config = { ... } or const CONFIG = { ... } (case-insensitive)
                        let configMatch = this.content.match(/const\s+(config|CONFIG)\s*=\s*\{/i);
                        strippedConsole.log(`[Water] '${this.name}' config detection: match found:`, !!configMatch);
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
                                // Don't log config string to avoid exposing script content
                                configObj = new Function('return ' + configStr)();
                                strippedConsole.log(`[Water] '${this.name}' parsed config object:`, configObj);
                                
                                this.settings = configToSettings(configObj, this.name);
                                strippedConsole.log(`[Water] Auto-detected ${Object.keys(this.settings).length} config settings from ${this.name}`);
                            }
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
                    const namespace = isPurchased ? 'purchased' : this.scriptType;
                    const configKey = `userscript.${namespace}.${this.name.replace(/\.js$/, '')}`;
                    
                    strippedConsole.log(`[Water] 🔍 LOADING settings for ${this.name}:`);
                    strippedConsole.log(`  - fullpath: ${this.fullpath}`);
                    strippedConsole.log(`  - isPurchased: ${isPurchased}`);
                    strippedConsole.log(`  - namespace: ${namespace}`);
                    strippedConsole.log(`  - scriptType: ${this.scriptType}`);
                    strippedConsole.log(`  - configKey: ${configKey}`);
                    strippedConsole.log(`  - ALL config keys:`, Object.keys(su.config.store || {}));
                    
                    const savedSettings = su.config.get(configKey, {});
                    
                    strippedConsole.log(`[Water] Loading saved settings for ${this.name} from ${configKey}:`, savedSettings);
                    strippedConsole.log(`[Water] Current settings values:`, Object.keys(this.settings).map(k => `${k}=${this.settings[k].value}`).join(', '));
                    
                    Object.keys(savedSettings).forEach(settingKey => {
                        if (settingKey in this.settings
                            && typeof savedSettings[settingKey] === typeof this.settings[settingKey].value) {

                            const savedValue = savedSettings[settingKey];
                            const currentValue = this.settings[settingKey].value;

                            strippedConsole.log(`[Water] Processing saved setting: ${settingKey}, saved=${savedValue}, current=${currentValue}`);

                            // Update the value property
                            this.settings[settingKey].value = savedValue;

                            // ALWAYS call changed() — even when injection already wrote the value into
                            // the live config — so scripts that listen for change events / window
                            // update functions get notified at startup. Without this, scripts that
                            // build UI from an init-time event miss the saved value entirely.
                            if (typeof this.settings[settingKey].changed === 'function') {
                                try {
                                    this.settings[settingKey].changed(savedValue);
                                } catch (cbErr) {
                                    strippedConsole.error(`[Water] changed() callback failed for ${this.name}.${settingKey}:`, cbErr);
                                }
                            }
                        } else {
                            strippedConsole.warn(`[Water] Skipping setting ${settingKey}: not in settings or type mismatch`);
                        }
                    });
                    
                    strippedConsole.log(`[Water] After loading, settings values:`, Object.keys(this.settings).map(k => `${k}=${this.settings[k].value}`).join(', '));
                    
                    // Dispatch event to notify script that settings have been loaded
                    const cleanName = this.name.replace(/\s+/g, '').replace(/\.js$/i, '');
                    const eventName = cleanName.charAt(0).toLowerCase() + cleanName.slice(1) + 'SettingsLoaded';
                    strippedConsole.log(`[Water] Dispatching settings loaded event: ${eventName}`);
                    window.dispatchEvent(new CustomEvent(eventName));
                } catch (err) {
                    strippedConsole.error(`[Water] Failed to load settings for ${this.name}:`, err);
                }
            }

            strippedConsole.log(`%c[Water]${this.strictMode ? '%c[strict]' : '%c[non-strict]'} %cran %c'${this.name.toString()}' `,
                'color: lightblue; font-weight: bold;', this.strictMode ? 'color: #62dd4f' : 'color: orange',
                'color: white;', 'color: lightgreen;');
        } catch (error) {
            // Record error in performance monitor
            performanceMonitor.recordError(this.name);
            
            // Use error manager
            errorManager.logError(this.name, this.scriptType, error as Error);
            strippedConsole.error(`[Water] Error in ${this.name}:`, error);
            
            // Don't throw - allow other scripts to continue
            return;
        } finally {
            // Always record performance metrics
            endMeasure();
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
 * Uses shared utilities for smart type inference and key humanization
 */
const configToSettings = (config: any, scriptName: string): UserscriptSettings => {
    const settings: UserscriptSettings = {};
    
    // Get reference to the actual CONFIG object if exposed
    const cleanName = scriptName.replace(/\s+/g, '').replace(/\.js$/i, '');
    const configVarName = `__${cleanName}CONFIG`;
    const exposedConfig = (window as any)[configVarName];
    
    // Use exposed CONFIG if available, otherwise use the passed config
    const actualConfig = exposedConfig || config;
    
    if (exposedConfig) {
        strippedConsole.log(`[Water] Using exposed CONFIG for ${scriptName}`);
    }
    
    for (const [key, value] of Object.entries(config)) {
        // Use centralized smart type inference
        const inferred = inferSettingType(key, value);
        
        // Skip nested objects, functions, unknowns
        if (inferred.type === 'skip') continue;
        
        const setting: UserscriptSetting = {
            title: humanizeKey(key),
            desc: '',
            value: value,
            type: inferred.type,
            changed: (newValue: any) => {
                // Update the actual CONFIG object (exposed or passed)
                actualConfig[key] = newValue;
                
                strippedConsole.log(`[Water] ${scriptName} config.${key} = ${newValue}`);
                
                // Dispatch event to notify the script of config change
                const eventName = cleanName.charAt(0).toLowerCase() + cleanName.slice(1) + 'Update';
                window.dispatchEvent(new CustomEvent(eventName, {
                    detail: { [key]: newValue }
                }));
                
                // Also try calling a global update function if it exists
                const updateFnName = `update${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}Config`;
                if (typeof (window as any)[updateFnName] === 'function') {
                    (window as any)[updateFnName](key, newValue);
                }
            }
        };
        
        // Apply inferred numeric ranges
        if (inferred.min !== undefined) setting.min = inferred.min;
        if (inferred.max !== undefined) setting.max = inferred.max;
        if (inferred.step !== undefined) setting.step = inferred.step;
        if (inferred.opts) setting.opts = inferred.opts;
        
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

    // Read all .js and .ts files from userscripts directory (excluding .d.ts)
    try {
        const entries = readdirSync(su.userscriptsPath, { withFileTypes: true })
            .filter(entry => (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) && !entry.name.endsWith('.d.ts'));

        su.userscripts = [];
        for (const entry of entries) {
            const fullpath = pathResolve(su.userscriptsPath, entry.name).toString();

            // Validate file before loading (size, encoding, etc.)
            const validation = validateScriptFile(fullpath);
            if (!validation.valid) {
                strippedConsole.warn(`[Water] Skipping invalid script '${entry.name}': ${validation.reason}`);
                continue;
            }

            try {
                const script = new Userscript({ name: entry.name, fullpath });
                script.scriptType = 'local';
                su.userscripts.push(script);
            } catch (e: any) {
                strippedConsole.error(`[Water] Failed to construct script '${entry.name}':`, e.message);
            }
        }

        // Sort userscripts by priority (descending)
        su.userscripts = su.userscripts.sort((a, b) => b.priority - a.priority);
        
        strippedConsole.log(`[Water] Loaded ${su.userscripts.length} userscripts (${su.userscripts.filter(s => s.name.endsWith('.ts')).length} TypeScript)`);

        // Clean up orphan settings for scripts that no longer exist
        const existingNames = new Set(su.userscripts.map(s => s.name));
        cleanOrphanSettings(config, existingNames);
    } catch (err) {
        strippedConsole.error('[Water] Failed to read userscripts directory:', err);
        su.userscripts = [];
    }

    // Function to execute a single userscript
    const executeScript = async (u: Userscript) => {
        strippedConsole.log(`[Water] Processing script: ${u.name}, runAt: ${u.runAt}`);

        // Determine namespace based on script type
        const isPurchased = u.fullpath.startsWith('[PURCHASED]');
        const namespace = isPurchased ? 'purchased' : u.scriptType;

        // Check if script is enabled (use appropriate namespace)
        const isEnabled = config.get(`userscripts.${namespace}.${u.name}.enabled`, true);

        strippedConsole.log(`[Water] Script ${u.name} enabled:`, isEnabled);

        if (isEnabled) {
            if (u.runAt === 'document-start') {
                strippedConsole.log(`[Water] Running ${u.name} at document-start`);
                await u.load();
                u.hasRan = true;
            } else if (u.runAt === 'document-idle') {
                // document-idle: DOMContentLoaded + 2s delay for Krunker full init
                strippedConsole.log(`[Water] Scheduling ${u.name} for document-idle (DOMContentLoaded + 2s)`);
                const idleCallback = async () => {
                    setTimeout(async () => {
                        strippedConsole.log(`[Water] Idle timer fired, running ${u.name}`);
                        await u.load();
                        u.hasRan = true;
                    }, 2000);
                };
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', idleCallback as any, { once: true });
                } else {
                    idleCallback();
                }
            } else {
                // document-end (default)
                strippedConsole.log(`[Water] Scheduling ${u.name} for document-end`);

                if (document.readyState === 'loading') {
                    const callback = async () => {
                        strippedConsole.log(`[Water] DOMContentLoaded fired, running ${u.name}`);
                        await u.load();
                        u.hasRan = true;
                    };
                    document.addEventListener('DOMContentLoaded', callback as any, { once: true });
                } else {
                    strippedConsole.log(`[Water] DOM already loaded, running ${u.name} immediately`);
                    await u.load();
                    u.hasRan = true;
                }
            }
        } else {
            strippedConsole.log(`[Water] Skipping disabled script: ${u.name}`);
        }
    };

    // Execute initially loaded scripts (in sequence to handle dependencies)
    for (const script of su.userscripts) {
        await executeScript(script);
    }

    // Start hot reload if enabled
    const hotReloadEnabled = config.get('modules.resourceswapper.hotReloadUserscripts', true);
    if (hotReloadEnabled) {
        strippedConsole.log('[Water] Starting hot reload for local scripts...');
        hotReload.start(userscriptsPath, 'local');
    }
}
