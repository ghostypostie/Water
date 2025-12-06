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
    constructor(data, clientUtils, windowType, config) {
        super();
        this.data = data;
        this.clientUtils = clientUtils;
        this.windowType = windowType;
        this.config = config;
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
        return Promise.resolve();
    }

    async executeScript() {
        if (!this.script || this.isLoaded) {
            return Promise.resolve();
        }

        try {
            console.log('[RawScript] Executing: ' + this.metadata.name);

            const code = this.script.code;
            const runAt = this.metadata["run-at"] || 'document-end';

            const injectScript = () => {
                try {
                    // Wrap code to fix window.load event timing
                    const wrappedCode = '(function(){var _origAddEvent=window.addEventListener;window.addEventListener=function(e,c,o){if(e==="load"&&document.readyState==="complete"){setTimeout(c,0);}else{_origAddEvent.call(window,e,c,o);}};' + code + ';window.addEventListener=_origAddEvent;})();';

                    const scriptElement = document.createElement('script');
                    scriptElement.textContent = wrappedCode;
                    scriptElement.type = 'text/javascript';

                    (document.head || document.documentElement).appendChild(scriptElement);
                    scriptElement.remove();

                    console.log('[RawScript] Injected "' + this.metadata.name + '" into page context');
                } catch (e) {
                    console.error('[RawScript] Injection error in "' + this.metadata.name + '":', e);
                }
            };

            if (runAt === 'document-start' || runAt === 'document.start') {
                injectScript();
            } else if (runAt === 'document-end') {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', injectScript, { once: true });
                } else {
                    injectScript();
                }
            } else if (runAt === 'document-idle') {
                if (document.readyState === 'complete') {
                    injectScript();
                } else {
                    window.addEventListener('load', injectScript, { once: true });
                }
            } else {
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
