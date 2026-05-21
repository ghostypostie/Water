/**
 * Water Client - Userscript Hot Reload System
 * Watches for file changes and reloads scripts without restart
 * Supports: Local scripts, Premium scripts (cache)
 */

import { watch, FSWatcher } from 'chokidar';
import { showToast } from '../utils/toast';
import { su, Userscript } from './userscript-loader';
import { errorManager } from './userscript-error-manager';

class UserscriptHotReload {
    private watcher: FSWatcher | null = null;
    private watchedPaths: Set<string> = new Set();
    private reloadCallbacks: Map<string, () => void> = new Map();

    /**
     * Start watching a directory for script changes
     */
    start(path: string, scriptType: 'local' | 'premium' = 'local') {
        if (this.watchedPaths.has(path)) {
            console.log(`[Water] Already watching: ${path}`);
            return;
        }

        console.log(`[Water] Starting hot reload for ${scriptType} scripts: ${path}`);

        const watcher = watch(path, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            }
        });

        watcher
            .on('add', (filePath: string) => this.handleFileChange(filePath, 'added', scriptType))
            .on('change', (filePath: string) => this.handleFileChange(filePath, 'changed', scriptType))
            .on('unlink', (filePath: string) => this.handleFileChange(filePath, 'removed', scriptType))
            .on('error', (error: Error) => {
                console.error('[Water] Hot reload watcher error:', error);
            });

        if (!this.watcher) {
            this.watcher = watcher;
        }

        this.watchedPaths.add(path);
        console.log(`[Water] Hot reload enabled for: ${path}`);
    }

    /**
     * Stop watching a specific path
     */
    stop(path?: string) {
        if (path) {
            this.watchedPaths.delete(path);
            console.log(`[Water] Stopped watching: ${path}`);
        } else if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            this.watchedPaths.clear();
            console.log('[Water] Hot reload stopped');
        }
    }

    /**
     * Handle file system changes
     */
    private handleFileChange(
        filePath: string,
        event: 'added' | 'changed' | 'removed',
        scriptType: 'local' | 'premium'
    ) {
        // Only handle .js and .ts files
        if (!filePath.endsWith('.js') && !filePath.endsWith('.ts')) {
            return;
        }

        const scriptName = require('path').basename(filePath);
        console.log(`[Water] ${scriptType} script ${event}: ${scriptName}`);

        // Clear TypeScript compilation cache on change
        if (filePath.endsWith('.ts')) {
            const { tsCompiler } = require('./userscript-typescript-compiler');
            tsCompiler.clearFileCache(scriptName);
        }

        switch (event) {
            case 'added':
            case 'changed':
                this.reloadScript(scriptName, filePath, scriptType);
                break;
            case 'removed':
                this.unloadScript(scriptName, scriptType);
                break;
        }

        // Notify UI to refresh
        window.dispatchEvent(new CustomEvent('userscriptsUpdated', {
            detail: { scriptName, event, scriptType }
        }));
    }

    /**
     * Reload a script (unload old, load new)
     */
    private async reloadScript(
        scriptName: string,
        filePath: string,
        scriptType: 'local' | 'premium'
    ) {
        try {
            // Find existing script
            const existingIndex = su.userscripts.findIndex(s => s.name === scriptName);

            // Unload if exists
            if (existingIndex !== -1) {
                const existing = su.userscripts[existingIndex];
                this.unloadScriptInstance(existing);
                su.userscripts.splice(existingIndex, 1);
            }

            // Check if script is enabled
            const namespace = scriptType === 'premium' ? 'purchased' : 'local';
            const isEnabled = su.config.get(`userscripts.${namespace}.${scriptName}.enabled`, true);

            if (!isEnabled) {
                console.log(`[Water] Skipping reload of disabled script: ${scriptName}`);
                return;
            }

            // Load new version
            const newScript = new (require('./userscript-loader').Userscript)({
                name: scriptName,
                fullpath: filePath
            });
            newScript.scriptType = scriptType;

            // Execute the script (async)
            await newScript.load();

            // Insert in priority order
            const insertIndex = su.userscripts.findIndex(s => s.priority < newScript.priority);
            if (insertIndex === -1) {
                su.userscripts.push(newScript);
            } else {
                su.userscripts.splice(insertIndex, 0, newScript);
            }

            // Clear any previous errors
            errorManager.clearErrorsForScript(scriptName);

            // Show success notification
            showToast({
                title: 'Script Reloaded',
                message: `${scriptName} has been updated`,
                type: 'success',
                duration: 3000
            });

            console.log(`[Water] Successfully reloaded: ${scriptName}`);

        } catch (e) {
            console.error(`[Water] Failed to reload ${scriptName}:`, e);
            errorManager.logError(scriptName, scriptType, e as Error);
        }
    }

    /**
     * Unload a script (call cleanup, remove from array)
     */
    private unloadScript(scriptName: string, scriptType: 'local' | 'premium') {
        const index = su.userscripts.findIndex(s => s.name === scriptName);
        if (index !== -1) {
            const script = su.userscripts[index];
            this.unloadScriptInstance(script);
            su.userscripts.splice(index, 1);

            showToast({
                title: 'Script Removed',
                message: `${scriptName} has been deleted`,
                type: 'info',
                duration: 3000
            });

            console.log(`[Water] Unloaded and removed: ${scriptName}`);
        }
    }

    /**
     * Call unload function if it exists
     */
    private unloadScriptInstance(script: Userscript) {
        if (typeof script.unload === 'function') {
            try {
                script.unload();
                console.log(`[Water] Called unload() for: ${script.name}`);
            } catch (e) {
                console.error(`[Water] Error calling unload() for ${script.name}:`, e);
            }
        }

        // Remove any CSS injected by this script
        const styleElements = document.querySelectorAll(`style[id^="userscript-css-"]`);
        styleElements.forEach(el => {
            if (el.id.includes(script.name.replace(/\.js$/, ''))) {
                el.remove();
            }
        });
    }

    /**
     * Register a callback for when a specific script reloads
     */
    onReload(scriptName: string, callback: () => void) {
        this.reloadCallbacks.set(scriptName, callback);
    }

    /**
     * Manually reload a purchased script from GitHub
     */
    async reloadPurchasedScript(scriptName: string) {
        try {
            console.log(`[Water] Manually reloading purchased script: ${scriptName}`);
            
            // Find existing script
            const existingIndex = su.userscripts.findIndex(s => s.name === scriptName && s.fullpath.startsWith('[PURCHASED]'));
            
            if (existingIndex === -1) {
                console.warn(`[Water] Purchased script not found: ${scriptName}`);
                return false;
            }
            
            const existing = su.userscripts[existingIndex];
            
            // Unload existing instance
            this.unloadScriptInstance(existing);
            
            // Remove from array
            su.userscripts.splice(existingIndex, 1);
            
            // Trigger reload from water module
            // The water module will re-fetch from GitHub and re-execute
            window.dispatchEvent(new CustomEvent('reloadPurchasedScript', {
                detail: { scriptName }
            }));
            
            console.log(`[Water] Triggered reload for purchased script: ${scriptName}`);
            return true;
            
        } catch (e) {
            console.error(`[Water] Failed to reload purchased script ${scriptName}:`, e);
            return false;
        }
    }

    /**
     * Check if hot reload is active
     */
    isActive(): boolean {
        return this.watcher !== null && this.watchedPaths.size > 0;
    }

    /**
     * Get list of watched paths
     */
    getWatchedPaths(): string[] {
        return Array.from(this.watchedPaths);
    }

    // ============================================================================
    // Public Reload API (v2)
    // ============================================================================

    /**
     * Reload a single script by name (for UI reload button).
     * Finds the script, unloads it, re-reads from disk, and re-executes.
     */
    async reloadSingleScript(scriptName: string): Promise<boolean> {
        try {
            console.log(`[Water] Manual reload requested for: ${scriptName}`);

            const existing = su.userscripts.find(s => s.name === scriptName);
            if (!existing) {
                console.warn(`[Water] Script not found for reload: ${scriptName}`);
                return false;
            }

            // For purchased scripts, delegate to the purchased reload flow
            if (existing.fullpath.startsWith('[PURCHASED]')) {
                return this.reloadPurchasedScript(scriptName);
            }

            // Local: unload + re-read from disk + re-execute
            const filePath = existing.fullpath;
            const scriptType = existing.scriptType;

            // Check if settings will be preserved
            const hadSettings = existing.settings && Object.keys(existing.settings).length > 0;

            // Perform the reload
            await this.reloadScript(scriptName, filePath, scriptType);

            // Notify with settings preservation info
            const settingsMsg = hadSettings ? ' (settings preserved)' : '';
            showToast({
                title: 'Script Reloaded',
                message: `${scriptName} reloaded successfully${settingsMsg}`,
                type: 'success',
                duration: 3000
            });

            return true;
        } catch (e) {
            console.error(`[Water] Manual reload failed for ${scriptName}:`, e);
            errorManager.logError(scriptName, 'local', e as Error);
            return false;
        }
    }

    /**
     * Reload ALL scripts: unload everything, re-scan directory, re-execute.
     * Used for the "Reload All" batch action button.
     */
    async reloadAll(): Promise<{ reloaded: number; failed: number }> {
        console.log('[Water] Batch reload all scripts requested');
        let reloaded = 0;
        let failed = 0;

        // Unload all existing scripts
        for (const script of [...su.userscripts]) {
            this.unloadScriptInstance(script);
        }
        su.userscripts = [];

        // Re-initialize from disk
        const { readdirSync } = require('fs');
        const { resolve: pathResolve } = require('path');
        const { validateScriptFile } = require('./userscript-utils');

        try {
            const entries = readdirSync(su.userscriptsPath, { withFileTypes: true })
                .filter((entry: any) => (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) && !entry.name.endsWith('.d.ts'));

            for (const entry of entries) {
                const fullpath = pathResolve(su.userscriptsPath, entry.name).toString();

                const validation = validateScriptFile(fullpath);
                if (!validation.valid) {
                    console.warn(`[Water] Skipping invalid script: ${entry.name} (${validation.reason})`);
                    failed++;
                    continue;
                }

                // Check if enabled
                const isEnabled = su.config.get(`userscripts.local.${entry.name}.enabled`, true);
                if (!isEnabled) {
                    console.log(`[Water] Skipping disabled script: ${entry.name}`);
                    continue;
                }

                try {
                    const { Userscript } = require('./userscript-loader');
                    const script = new Userscript({ name: entry.name, fullpath });
                    script.scriptType = 'local';
                    await script.load();
                    script.hasRan = true;
                    su.userscripts.push(script);
                    reloaded++;
                } catch (e: any) {
                    console.error(`[Water] Failed to reload ${entry.name}:`, e.message);
                    errorManager.logError(entry.name, 'local', e);
                    failed++;
                }
            }

            // Sort by priority
            su.userscripts.sort((a: any, b: any) => b.priority - a.priority);

        } catch (e) {
            console.error('[Water] Batch reload failed:', e);
        }

        showToast({
            title: 'Batch Reload Complete',
            message: `${reloaded} scripts reloaded${failed > 0 ? `, ${failed} failed` : ''}`,
            type: failed > 0 ? 'error' : 'success',
            duration: 4000
        });

        // Notify UI to refresh
        window.dispatchEvent(new CustomEvent('userscriptsUpdated', {
            detail: { event: 'batchReload', reloaded, failed }
        }));

        console.log(`[Water] Batch reload: ${reloaded} reloaded, ${failed} failed`);
        return { reloaded, failed };
    }
}

export const hotReload = new UserscriptHotReload();

