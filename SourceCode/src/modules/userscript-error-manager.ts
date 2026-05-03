/**
 * Water Client - Userscript Error Manager (v2)
 * Handles errors from all script types (local, premium, bundled)
 * 
 * Upgrade v2: Auto-disable on crash loops, error classification,
 *             error count badges, stack trace cleanup
 */

import { join } from 'path';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { showToast } from '../utils/toast';
import { getScriptsPath } from '../utils/paths';

// Error classification categories
export type ErrorCategory = 'syntax' | 'runtime' | 'dependency' | 'timeout' | 'unknown';

export interface ScriptError {
    script: string;
    scriptType: 'local' | 'premium' | 'bundled';
    error: Error;
    timestamp: Date;
    stack?: string;
    category: ErrorCategory;
}

class UserscriptErrorManager {
    private errors: ScriptError[] = [];
    private maxErrors = 100;
    private logPath: string;
    private disabledScripts: Set<string> = new Set();

    // Auto-disable tracking: script -> timestamps of recent errors
    private recentErrorTimestamps: Map<string, number[]> = new Map();
    private autoDisableThreshold = 3; // errors within window
    private autoDisableWindow = 5 * 60 * 1000; // 5 minutes in ms

    constructor() {
        // Use the scripts path parent directory for logs
        const scriptsPath = getScriptsPath();
        const waterPath = join(scriptsPath, '..');
        this.logPath = join(waterPath, 'userscript-errors.log');
        this.ensureLogDirectory();
    }

    private ensureLogDirectory() {
        const scriptsPath = getScriptsPath();
        const waterPath = join(scriptsPath, '..');
        if (!existsSync(waterPath)) {
            mkdirSync(waterPath, { recursive: true });
        }
    }

    /**
     * Classify an error into a category
     */
    private classifyError(error: Error): ErrorCategory {
        const msg = error.message?.toLowerCase() || '';
        const stack = error.stack?.toLowerCase() || '';

        // Syntax errors
        if (error instanceof SyntaxError ||
            msg.includes('unexpected token') ||
            msg.includes('unexpected identifier') ||
            msg.includes('unexpected end of input') ||
            msg.includes('invalid or unexpected')) {
            return 'syntax';
        }

        // Dependency errors
        if (msg.includes('module not found') ||
            msg.includes('cannot find module') ||
            msg.includes('dependency loading failed') ||
            msg.includes('failed to fetch') ||
            msg.includes('require is not defined')) {
            return 'dependency';
        }

        // Timeout errors
        if (msg.includes('timeout') ||
            msg.includes('timed out') ||
            msg.includes('script timeout') ||
            msg.includes('aborted')) {
            return 'timeout';
        }

        // Runtime errors (TypeError, ReferenceError, RangeError, etc.)
        if (error instanceof TypeError ||
            error instanceof ReferenceError ||
            error instanceof RangeError ||
            msg.includes('is not a function') ||
            msg.includes('is not defined') ||
            msg.includes('cannot read propert') ||
            msg.includes('null is not an object')) {
            return 'runtime';
        }

        return 'unknown';
    }

    /**
     * Clean up a stack trace to show meaningful line numbers
     */
    private cleanStackTrace(stack: string | undefined, scriptName: string): string | undefined {
        if (!stack) return undefined;

        return stack
            .split('\n')
            .filter(line => {
                // Keep lines that reference the script or are the error message
                const trimmed = line.trim();
                return !trimmed.startsWith('at new Function') &&
                       !trimmed.startsWith('at Object.') &&
                       !trimmed.includes('node_modules') &&
                       !trimmed.includes('electron/js2c');
            })
            .slice(0, 8) // Limit to 8 lines
            .join('\n');
    }

    logError(script: string, scriptType: 'local' | 'premium' | 'bundled', error: Error) {
        const category = this.classifyError(error);
        const cleanedStack = this.cleanStackTrace(error.stack, script);

        const scriptError: ScriptError = {
            script,
            scriptType,
            error,
            timestamp: new Date(),
            stack: cleanedStack,
            category
        };

        this.errors.push(scriptError);

        // Keep only recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Log to console with category
        console.error(`[Water] [${category.toUpperCase()}] Error in ${scriptType} script '${script}':`, error);

        // Log to file
        this.logToFile(scriptError);

        // Show user notification
        this.showErrorNotification(scriptError);

        // Check auto-disable threshold
        this.trackAndAutoDisable(script, scriptType);
    }

    /**
     * Track error frequency and auto-disable scripts that crash too often
     */
    private trackAndAutoDisable(script: string, scriptType: 'local' | 'premium' | 'bundled') {
        const now = Date.now();
        const timestamps = this.recentErrorTimestamps.get(script) || [];

        // Add current timestamp
        timestamps.push(now);

        // Remove timestamps outside the window
        const filtered = timestamps.filter(t => now - t < this.autoDisableWindow);
        this.recentErrorTimestamps.set(script, filtered);

        // Check threshold
        if (filtered.length >= this.autoDisableThreshold && !this.disabledScripts.has(script)) {
            this.disableScript(script);

            showToast({
                title: 'Script Auto-Disabled',
                message: `${script} crashed ${this.autoDisableThreshold} times in ${this.autoDisableWindow / 60000} min and has been disabled. Re-enable in Settings.`,
                type: 'error',
                duration: 10000
            });

            console.warn(`[Water] Auto-disabled script '${script}' after ${filtered.length} errors in ${this.autoDisableWindow / 60000} minutes`);

            // Persist the disable state via config if available
            try {
                const namespace = scriptType === 'premium' ? 'purchased' : scriptType;
                // Dispatch event so water.ts can update config
                window.dispatchEvent(new CustomEvent('userscript-auto-disabled', {
                    detail: { script, namespace }
                }));
            } catch (e) {
                // Ignore
            }
        }
    }

    private showErrorNotification(scriptError: ScriptError) {
        const typeLabel = {
            local: 'Local',
            premium: 'Premium',
            bundled: 'Bundled'
        }[scriptError.scriptType];

        const categoryLabel = {
            syntax: '🔴 Syntax',
            runtime: '🟠 Runtime',
            dependency: '🟡 Dependency',
            timeout: '⏰ Timeout',
            unknown: '❓ Unknown'
        }[scriptError.category];

        showToast({
            title: `${typeLabel} Script Error (${categoryLabel})`,
            message: `${scriptError.script}: ${scriptError.error.message}`,
            type: 'error',
            duration: 8000
        });

        // Store for UI display
        window.dispatchEvent(new CustomEvent('userscript-error', {
            detail: scriptError
        }));
    }

    private logToFile(scriptError: ScriptError) {
        try {
            const logEntry = [
                `[${scriptError.timestamp.toISOString()}]`,
                `[${scriptError.scriptType.toUpperCase()}]`,
                `[${scriptError.category.toUpperCase()}]`,
                `${scriptError.script}:`,
                scriptError.error.message,
                scriptError.stack || '',
                '\n'
            ].join(' ');

            appendFileSync(this.logPath, logEntry);
        } catch (e) {
            console.error('[Water] Failed to write error log:', e);
        }
    }

    // ============================================================================
    // Query API
    // ============================================================================

    getErrors(): ScriptError[] {
        return [...this.errors];
    }

    getErrorsByScript(script: string): ScriptError[] {
        return this.errors.filter(e => e.script === script);
    }

    getErrorsByType(scriptType: 'local' | 'premium' | 'bundled'): ScriptError[] {
        return this.errors.filter(e => e.scriptType === scriptType);
    }

    getErrorsByCategory(category: ErrorCategory): ScriptError[] {
        return this.errors.filter(e => e.category === category);
    }

    /**
     * Get error count for a specific script (for UI badge)
     */
    getErrorCount(script: string): number {
        return this.errors.filter(e => e.script === script).length;
    }

    /**
     * Get total error count across all scripts
     */
    getTotalErrorCount(): number {
        return this.errors.length;
    }

    /**
     * Get scripts sorted by error count (most errors first)
     */
    getScriptsByErrorCount(): Array<{ script: string; count: number }> {
        const counts = new Map<string, number>();
        for (const e of this.errors) {
            counts.set(e.script, (counts.get(e.script) || 0) + 1);
        }
        return Array.from(counts.entries())
            .map(([script, count]) => ({ script, count }))
            .sort((a, b) => b.count - a.count);
    }

    clearErrors() {
        this.errors = [];
    }

    clearErrorsForScript(script: string) {
        this.errors = this.errors.filter(e => e.script !== script);
        this.recentErrorTimestamps.delete(script);
    }

    disableScript(script: string) {
        this.disabledScripts.add(script);
        console.log(`[Water] Script disabled due to errors: ${script}`);
    }

    enableScript(script: string) {
        this.disabledScripts.delete(script);
        this.recentErrorTimestamps.delete(script);
        console.log(`[Water] Script re-enabled: ${script}`);
    }

    isScriptDisabled(script: string): boolean {
        return this.disabledScripts.has(script);
    }

    getLogPath(): string {
        return this.logPath;
    }
}

export const errorManager = new UserscriptErrorManager();
