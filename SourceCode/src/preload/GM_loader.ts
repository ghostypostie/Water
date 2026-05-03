/**
 * Water Client - Enhanced GM API
 * Full Greasemonkey/Tampermonkey compatibility
 */

// ============================================================================
// Storage API
// ============================================================================

export function GM_getValue(key: string, defaultValue?: any): any {
    const stored = window.localStorage.getItem('GM_' + key);
    if (stored === null) return defaultValue;
    
    try {
        return JSON.parse(stored);
    } catch {
        return stored;
    }
}

export function GM_setValue(key: string, value: any): void {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Storage quota check (512KB per script namespace)
    const prefix = 'GM_';
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
            const v = localStorage.getItem(k);
            if (v) totalSize += k.length * 2 + v.length * 2;
        }
    }
    const newSize = (prefix + key).length * 2 + serialized.length * 2;
    const QUOTA = 512 * 1024; // 512KB
    if (totalSize + newSize > QUOTA) {
        console.warn(`[GM] Storage quota exceeded for key '${key}'. Current: ${(totalSize/1024).toFixed(1)}KB, Limit: ${QUOTA/1024}KB`);
        return;
    }
    
    window.localStorage.setItem('GM_' + key, serialized);
}

export function GM_deleteValue(key: string): void {
    window.localStorage.removeItem('GM_' + key);
}

export function GM_listValues(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('GM_')) {
            keys.push(key.substring(3));
        }
    }
    return keys;
}

// ============================================================================
// DOM API
// ============================================================================

export function GM_addStyle(css: string): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-gm-style', 'true');
    document.head.appendChild(style);
    return style;
}

export function GM_addElement(
    tagName: string,
    attributes?: Record<string, string>
): HTMLElement;
export function GM_addElement(
    parentNode: HTMLElement,
    tagName: string,
    attributes?: Record<string, string>
): HTMLElement;
export function GM_addElement(...args: any[]): HTMLElement {
    let parentNode: HTMLElement;
    let tagName: string;
    let attributes: Record<string, string> = {};

    if (typeof args[0] === 'string') {
        parentNode = document.head;
        tagName = args[0];
        attributes = args[1] || {};
    } else {
        parentNode = args[0];
        tagName = args[1];
        attributes = args[2] || {};
    }

    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    parentNode.appendChild(element);
    return element;
}

// ============================================================================
// Clipboard API
// ============================================================================

export function GM_setClipboard(text: string, info?: string | { type?: string; mimetype?: string }): void {
    navigator.clipboard.writeText(text).catch(err => {
        console.error('[GM] Failed to set clipboard:', err);
    });
}

// ============================================================================
// Notification API
// ============================================================================

export function GM_notification(
    text: string,
    title?: string,
    image?: string,
    onclick?: () => void
): void;
export function GM_notification(options: {
    text: string;
    title?: string;
    image?: string;
    onclick?: () => void;
    ondone?: () => void;
    timeout?: number;
}): void;
export function GM_notification(...args: any[]): void {
    let options: any;

    if (typeof args[0] === 'string') {
        options = {
            text: args[0],
            title: args[1],
            image: args[2],
            onclick: args[3]
        };
    } else {
        options = args[0];
    }

    // Use Water's toast system
    const { showToast } = require('../utils/toast');
    showToast({
        title: options.title || 'Notification',
        message: options.text,
        type: 'info',
        duration: options.timeout || 5000,
        onClick: options.onclick
    });

    if (options.ondone) {
        setTimeout(options.ondone, options.timeout || 5000);
    }
}

// ============================================================================
// Tab/Window API
// ============================================================================

export function GM_openInTab(url: string, options?: boolean | { active?: boolean; insert?: boolean; setParent?: boolean }): void {
    const { shell } = require('electron');
    shell.openExternal(url);
}

// ============================================================================
// Resource API
// ============================================================================

export function GM_getResourceText(name: string): string | null {
    return localStorage.getItem(`GM_resource_${name}`);
}

export function GM_getResourceURL(name: string): string | null {
    const data = localStorage.getItem(`GM_resource_${name}`);
    if (!data) return null;
    
    const blob = new Blob([data], { type: 'text/plain' });
    return URL.createObjectURL(blob);
}

// ============================================================================
// XHR API
// ============================================================================

export function GM_xmlhttpRequest(details: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    data?: string;
    binary?: boolean;
    timeout?: number;
    onload?: (response: any) => void;
    onerror?: (error: any) => void;
    onprogress?: (progress: any) => void;
    onreadystatechange?: (response: any) => void;
    ontimeout?: () => void;
}): { abort: () => void } {
    const controller = new AbortController();
    
    const fetchOptions: RequestInit = {
        method: details.method,
        headers: details.headers,
        body: details.data,
        signal: controller.signal
    };

    const timeoutId = details.timeout 
        ? setTimeout(() => {
            controller.abort();
            details.ontimeout?.();
        }, details.timeout)
        : null;

    fetch(details.url, fetchOptions)
        .then(async response => {
            if (timeoutId) clearTimeout(timeoutId);
            
            const text = await response.text();
            const responseObj = {
                status: response.status,
                statusText: response.statusText,
                responseText: text,
                responseHeaders: Object.fromEntries(response.headers.entries()),
                finalUrl: response.url,
                readyState: 4
            };
            
            details.onload?.(responseObj);
            details.onreadystatechange?.(responseObj);
        })
        .catch(error => {
            if (timeoutId) clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                details.ontimeout?.();
            } else {
                details.onerror?.(error);
            }
        });

    return {
        abort: () => controller.abort()
    };
}

// ============================================================================
// Info API (v2 — per-script metadata)
// ============================================================================

/**
 * Create a per-script GM_info object.
 * If called without args, returns generic info (backwards compatible).
 */
export function GM_info(scriptMeta?: {
    name?: string;
    version?: string;
    description?: string;
    author?: string;
    namespace?: string;
}): any {
    const meta = scriptMeta || {};
    return {
        script: {
            name: meta.name || 'Current Script',
            version: meta.version || '1.0.0',
            description: meta.description || '',
            author: meta.author || '',
            namespace: meta.namespace || 'water-client'
        },
        scriptHandler: 'Water Client',
        version: require('../../package.json').version,
        platform: {
            os: process.platform,
            arch: process.arch,
            browserName: 'Chromium',
            browserVersion: process.versions.chrome
        },
        scriptMetaStr: '',
        scriptWillUpdate: false,
        scriptUpdateURL: null,
        downloadMode: 'browser'
    };
}

// ============================================================================
// Logging API (v2)
// ============================================================================

/**
 * GM_log — routes through console with script name prefix.
 */
export function GM_log(message: string, scriptName?: string): void {
    const prefix = scriptName ? `[GM][${scriptName}]` : '[GM]';
    console.log(prefix, message);
}

// ============================================================================
// Menu Command API (v2)
// ============================================================================

const _menuCommands: Map<string, { caption: string; callback: () => void; scriptName: string }> = new Map();

/**
 * GM_registerMenuCommand — register a command that appears in the script's settings panel.
 */
export function GM_registerMenuCommand(
    caption: string,
    callback: () => void,
    _accessKey?: string
): string {
    const id = `gm_menu_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    _menuCommands.set(id, { caption, callback, scriptName: '' });
    return id;
}

/**
 * GM_unregisterMenuCommand — remove a registered menu command.
 */
export function GM_unregisterMenuCommand(id: string): void {
    _menuCommands.delete(id);
}

/**
 * Get all registered menu commands (for UI rendering).
 */
export function getRegisteredMenuCommands(): Array<{ id: string; caption: string; callback: () => void; scriptName: string }> {
    return Array.from(_menuCommands.entries()).map(([id, cmd]) => ({ id, ...cmd }));
}

// ============================================================================
// Metadata Parser
// ============================================================================

export function parseHeader(script: string) {
    let obj: any = {};

    let lines = script.split('\n');

    if (!lines[0].includes(' ==UserScript==')) return obj;

    let endLine = lines.findIndex((line) => line.includes(' ==/UserScript=='));
    if (endLine === -1) return obj;

    let header = lines.slice(1, endLine);

    for (let i = 0; i < header.length; i++) {
        let line = header[i].replace(/^\/\/\s?/, '').trim();
        let match = [...line.matchAll(/^@(\S+)\s+([\S\s]+)$/g)];
        if (!match?.[0]) continue;

        let [_, key, value] = match[0];

        if (obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) obj[key].push(value);
            else obj[key] = [obj[key], value];
        } else obj[key] = value;
    }

    return obj;
}

// ============================================================================
// GM4 Async API (Promise-based)
// ============================================================================

export const GM = {
    getValue: (key: string, defaultValue?: any) => Promise.resolve(GM_getValue(key, defaultValue)),
    setValue: (key: string, value: any) => Promise.resolve(GM_setValue(key, value)),
    deleteValue: (key: string) => Promise.resolve(GM_deleteValue(key)),
    listValues: () => Promise.resolve(GM_listValues()),
    getResourceText: (name: string) => Promise.resolve(GM_getResourceText(name)),
    getResourceUrl: (name: string) => Promise.resolve(GM_getResourceURL(name)),
    addStyle: (css: string) => Promise.resolve(GM_addStyle(css)),
    setClipboard: (text: string, info?: any) => Promise.resolve(GM_setClipboard(text, info)),
    notification: (options: any) => Promise.resolve(GM_notification(options)),
    openInTab: (url: string, options?: any) => Promise.resolve(GM_openInTab(url, options)),
    xmlHttpRequest: (details: any) => Promise.resolve(GM_xmlhttpRequest(details)),
    info: GM_info()
};

// ============================================================================
// Global Injection
// ============================================================================

export function injectGMAPI() {
    // GM3 API (synchronous)
    (window as any).GM_getValue = GM_getValue;
    (window as any).GM_setValue = GM_setValue;
    (window as any).GM_deleteValue = GM_deleteValue;
    (window as any).GM_listValues = GM_listValues;
    (window as any).GM_addStyle = GM_addStyle;
    (window as any).GM_addElement = GM_addElement;
    (window as any).GM_getResourceText = GM_getResourceText;
    (window as any).GM_getResourceURL = GM_getResourceURL;
    (window as any).GM_setClipboard = GM_setClipboard;
    (window as any).GM_notification = GM_notification;
    (window as any).GM_openInTab = GM_openInTab;
    (window as any).GM_xmlhttpRequest = GM_xmlhttpRequest;
    (window as any).GM_info = GM_info;
    (window as any).GM_log = GM_log;
    (window as any).GM_registerMenuCommand = GM_registerMenuCommand;
    (window as any).GM_unregisterMenuCommand = GM_unregisterMenuCommand;
    
    // GM4 API (async)
    (window as any).GM = GM;
    
    console.log('[Water] GM API injected (GM3 + GM4 + v2 extensions)');
}
