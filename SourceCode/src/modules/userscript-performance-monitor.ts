/**
 * Water Client - Userscript Performance Monitor
 * Tracks execution time, memory usage, and performance metrics for all scripts
 */

export interface ScriptPerformanceMetrics {
    script: string;
    scriptType: 'local' | 'premium' | 'bundled';
    loadTime: number; // Time to load dependencies
    executionTime: number; // Time to execute script
    memoryUsage?: number; // Memory delta in bytes
    lastRun: Date;
    runCount: number;
    averageExecutionTime: number;
    maxExecutionTime: number;
    minExecutionTime: number;
    errors: number;
}

class UserscriptPerformanceMonitor {
    private metrics: Map<string, ScriptPerformanceMetrics> = new Map();
    private slowScriptThreshold = 100; // ms
    private memoryWarningThreshold = 10 * 1024 * 1024; // 10MB

    /**
     * Start measuring script performance
     */
    startMeasure(script: string, scriptType: 'local' | 'premium' | 'bundled'): () => void {
        const startTime = performance.now();
        const startMemory = (performance as any).memory?.usedJSHeapSize;

        return () => {
            const endTime = performance.now();
            const endMemory = (performance as any).memory?.usedJSHeapSize;
            const executionTime = endTime - startTime;
            const memoryUsage = endMemory && startMemory ? endMemory - startMemory : undefined;

            this.recordMetrics(script, scriptType, executionTime, memoryUsage);
        };
    }

    /**
     * Record performance metrics for a script
     */
    private recordMetrics(
        script: string,
        scriptType: 'local' | 'premium' | 'bundled',
        executionTime: number,
        memoryUsage?: number
    ) {
        const existing = this.metrics.get(script);

        if (existing) {
            // Update existing metrics
            const newRunCount = existing.runCount + 1;
            const newAverage = (existing.averageExecutionTime * existing.runCount + executionTime) / newRunCount;

            this.metrics.set(script, {
                ...existing,
                executionTime,
                memoryUsage,
                lastRun: new Date(),
                runCount: newRunCount,
                averageExecutionTime: newAverage,
                maxExecutionTime: Math.max(existing.maxExecutionTime, executionTime),
                minExecutionTime: Math.min(existing.minExecutionTime, executionTime)
            });
        } else {
            // Create new metrics entry
            this.metrics.set(script, {
                script,
                scriptType,
                loadTime: 0,
                executionTime,
                memoryUsage,
                lastRun: new Date(),
                runCount: 1,
                averageExecutionTime: executionTime,
                maxExecutionTime: executionTime,
                minExecutionTime: executionTime,
                errors: 0
            });
        }

        // Check for performance issues
        this.checkPerformanceIssues(script, executionTime, memoryUsage);
    }

    /**
     * Record dependency load time
     */
    recordLoadTime(script: string, loadTime: number) {
        const existing = this.metrics.get(script);
        if (existing) {
            existing.loadTime = loadTime;
        }
    }

    /**
     * Increment error count for a script
     */
    recordError(script: string) {
        const existing = this.metrics.get(script);
        if (existing) {
            existing.errors++;
        }
    }

    /**
     * Check for performance issues and warn
     */
    private checkPerformanceIssues(script: string, executionTime: number, memoryUsage?: number) {
        // Warn about slow scripts
        if (executionTime > this.slowScriptThreshold) {
            console.warn(
                `[Water] Performance Warning: ${script} took ${executionTime.toFixed(2)}ms to execute (threshold: ${this.slowScriptThreshold}ms)`
            );
        }

        // Warn about high memory usage
        if (memoryUsage && memoryUsage > this.memoryWarningThreshold) {
            console.warn(
                `[Water] Memory Warning: ${script} used ${(memoryUsage / 1024 / 1024).toFixed(2)}MB (threshold: ${this.memoryWarningThreshold / 1024 / 1024}MB)`
            );
        }
    }

    /**
     * Get all performance metrics
     */
    getMetrics(): ScriptPerformanceMetrics[] {
        return Array.from(this.metrics.values());
    }

    /**
     * Get metrics for a specific script
     */
    getScriptMetrics(script: string): ScriptPerformanceMetrics | undefined {
        return this.metrics.get(script);
    }

    /**
     * Get slow scripts (above threshold)
     */
    getSlowScripts(threshold?: number): ScriptPerformanceMetrics[] {
        const limit = threshold || this.slowScriptThreshold;
        return this.getMetrics().filter(m => m.averageExecutionTime > limit);
    }

    /**
     * Get scripts with high memory usage
     */
    getMemoryHeavyScripts(threshold?: number): ScriptPerformanceMetrics[] {
        const limit = threshold || this.memoryWarningThreshold;
        return this.getMetrics().filter(m => m.memoryUsage && m.memoryUsage > limit);
    }

    /**
     * Get scripts with errors
     */
    getScriptsWithErrors(): ScriptPerformanceMetrics[] {
        return this.getMetrics().filter(m => m.errors > 0);
    }

    /**
     * Get metrics sorted by execution time
     */
    getMetricsByExecutionTime(): ScriptPerformanceMetrics[] {
        return this.getMetrics().sort((a, b) => b.averageExecutionTime - a.averageExecutionTime);
    }

    /**
     * Get metrics sorted by memory usage
     */
    getMetricsByMemoryUsage(): ScriptPerformanceMetrics[] {
        return this.getMetrics()
            .filter(m => m.memoryUsage !== undefined)
            .sort((a, b) => (b.memoryUsage || 0) - (a.memoryUsage || 0));
    }

    /**
     * Get total execution time for all scripts
     */
    getTotalExecutionTime(): number {
        return this.getMetrics().reduce((sum, m) => sum + m.executionTime, 0);
    }

    /**
     * Get total memory usage for all scripts
     */
    getTotalMemoryUsage(): number {
        return this.getMetrics().reduce((sum, m) => sum + (m.memoryUsage || 0), 0);
    }

    /**
     * Get performance summary
     */
    getSummary() {
        const metrics = this.getMetrics();
        const totalScripts = metrics.length;
        const slowScripts = this.getSlowScripts().length;
        const scriptsWithErrors = this.getScriptsWithErrors().length;
        const totalExecutionTime = this.getTotalExecutionTime();
        const totalMemoryUsage = this.getTotalMemoryUsage();
        const averageExecutionTime = totalScripts > 0 ? totalExecutionTime / totalScripts : 0;

        return {
            totalScripts,
            slowScripts,
            scriptsWithErrors,
            totalExecutionTime,
            totalMemoryUsage,
            averageExecutionTime,
            slowScriptThreshold: this.slowScriptThreshold,
            memoryWarningThreshold: this.memoryWarningThreshold
        };
    }

    /**
     * Clear all metrics
     */
    clearMetrics() {
        this.metrics.clear();
        console.log('[Water] Performance metrics cleared');
    }

    /**
     * Clear metrics for a specific script
     */
    clearScriptMetrics(script: string) {
        this.metrics.delete(script);
        console.log(`[Water] Performance metrics cleared for: ${script}`);
    }

    /**
     * Set slow script threshold
     */
    setSlowScriptThreshold(threshold: number) {
        this.slowScriptThreshold = threshold;
        console.log(`[Water] Slow script threshold set to: ${threshold}ms`);
    }

    /**
     * Set memory warning threshold
     */
    setMemoryWarningThreshold(threshold: number) {
        this.memoryWarningThreshold = threshold;
        console.log(`[Water] Memory warning threshold set to: ${(threshold / 1024 / 1024).toFixed(2)}MB`);
    }

    /**
     * Export metrics as JSON
     */
    exportMetrics(): string {
        const data = {
            timestamp: new Date().toISOString(),
            summary: this.getSummary(),
            metrics: this.getMetrics()
        };
        return JSON.stringify(data, null, 2);
    }

    /**
     * Log performance report to console
     * Log performance report to console
     */
    logReport() {
        const summary = this.getSummary();
        const metrics = this.getMetricsByExecutionTime();

        console.group('[Water] Performance Report');
        console.log('Total Scripts:', summary.totalScripts);
        console.log('Slow Scripts:', summary.slowScripts);
        console.log('Scripts with Errors:', summary.scriptsWithErrors);
        console.log('Total Execution Time:', summary.totalExecutionTime.toFixed(2) + 'ms');
        console.log('Average Execution Time:', summary.averageExecutionTime.toFixed(2) + 'ms');
        console.log('Total Memory Usage:', (summary.totalMemoryUsage / 1024 / 1024).toFixed(2) + 'MB');

        if (metrics.length > 0) {
            console.group('Top 10 Scripts by Execution Time:');
            metrics.slice(0, 10).forEach((m, i) => {
                console.log(
                    `${i + 1}. ${m.script}: ${m.averageExecutionTime.toFixed(2)}ms avg (${m.runCount} runs)`
                );
            });
            console.groupEnd();
        }

        const slowScripts = this.getSlowScripts();
        if (slowScripts.length > 0) {
            console.group('Slow Scripts (>' + summary.slowScriptThreshold + 'ms):');
            slowScripts.forEach(m => {
                console.warn(`${m.script}: ${m.averageExecutionTime.toFixed(2)}ms avg`);
            });
            console.groupEnd();
        }

        console.groupEnd();
    }

    // ============================================================================
    // Health Score System (v2)
    // ============================================================================

    private freezeThreshold = 500; // ms — warn if script blocks main thread this long

    /**
     * Calculate a health score (0-100) for a script.
     * 100 = perfectly healthy, 0 = critically unhealthy.
     *
     * Factors:
     *   - Execution time: 0-100ms = full marks, >1000ms = 0
     *   - Errors: 0 = full marks, >5 = 0
     *   - Memory: <1MB = full marks, >10MB = 0
     */
    getHealthScore(script: string): number {
        const m = this.metrics.get(script);
        if (!m) return 100; // No data = assume healthy

        // Execution time score (40% weight)
        let timeScore = 100;
        if (m.averageExecutionTime > 1000) timeScore = 0;
        else if (m.averageExecutionTime > 500) timeScore = 20;
        else if (m.averageExecutionTime > 200) timeScore = 50;
        else if (m.averageExecutionTime > 100) timeScore = 70;
        else timeScore = 100;

        // Error score (40% weight)
        let errorScore = 100;
        if (m.errors >= 5) errorScore = 0;
        else if (m.errors >= 3) errorScore = 30;
        else if (m.errors >= 1) errorScore = 60;

        // Memory score (20% weight)
        let memScore = 100;
        if (m.memoryUsage) {
            const mb = m.memoryUsage / (1024 * 1024);
            if (mb > 10) memScore = 0;
            else if (mb > 5) memScore = 30;
            else if (mb > 1) memScore = 70;
        }

        return Math.round(timeScore * 0.4 + errorScore * 0.4 + memScore * 0.2);
    }

    /**
     * Get health color indicator: green / yellow / red
     */
    getHealthColor(script: string): 'green' | 'yellow' | 'red' {
        const score = this.getHealthScore(script);
        if (score >= 70) return 'green';
        if (score >= 40) return 'yellow';
        return 'red';
    }

    /**
     * Get health hex color for UI rendering
     */
    getHealthHex(script: string): string {
        const color = this.getHealthColor(script);
        switch (color) {
            case 'green': return '#4ade80';
            case 'yellow': return '#facc15';
            case 'red': return '#ef4444';
        }
    }

    /**
     * Check if a script appears to be frozen (blocked main thread too long)
     */
    isScriptFrozen(script: string): boolean {
        const m = this.metrics.get(script);
        if (!m) return false;
        return m.maxExecutionTime > this.freezeThreshold;
    }

    /**
     * Get formatted execution time string for UI display
     */
    getFormattedExecTime(script: string): string {
        const m = this.metrics.get(script);
        if (!m) return 'N/A';
        return `${m.averageExecutionTime.toFixed(1)}ms`;
    }
}

export const performanceMonitor = new UserscriptPerformanceMonitor();

// Expose to window for debugging (only in renderer process)
if (typeof window !== 'undefined') {
    (window as any).waterPerformance = {
        getMetrics: () => performanceMonitor.getMetrics(),
        getSummary: () => performanceMonitor.getSummary(),
        getSlowScripts: () => performanceMonitor.getSlowScripts(),
        logReport: () => performanceMonitor.logReport(),
        exportMetrics: () => performanceMonitor.exportMetrics(),
        clearMetrics: () => performanceMonitor.clearMetrics()
    };
}
