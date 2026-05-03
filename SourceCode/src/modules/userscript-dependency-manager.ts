/**
 * Water Client - Userscript Dependency Manager
 * Handles @require directives for loading external libraries
 * Supports: CDN URLs, GitHub raw URLs, local files
 */

import { strippedConsole } from './userscript-loader';
import { errorManager } from './userscript-error-manager';

interface DependencyCache {
    url: string;
    content: string;
    timestamp: Date;
    size: number;
}

class UserscriptDependencyManager {
    private cache: Map<string, DependencyCache> = new Map();
    private loading: Map<string, Promise<string>> = new Map();
    private maxCacheSize = 50; // Maximum number of cached dependencies
    private maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    /**
     * Load a dependency from URL or cache
     */
    async loadDependency(url: string, scriptName: string): Promise<string> {
        // Check cache first
        const cached = this.cache.get(url);
        if (cached && !this.isCacheExpired(cached)) {
            strippedConsole.log(`[Water] Using cached dependency: ${url}`);
            return cached.content;
        }

        // Check if already loading
        if (this.loading.has(url)) {
            strippedConsole.log(`[Water] Waiting for dependency already loading: ${url}`);
            return this.loading.get(url)!;
        }

        // Start loading
        const promise = this.fetchDependency(url, scriptName);
        this.loading.set(url, promise);

        try {
            const content = await promise;
            
            // Cache the result
            this.addToCache(url, content);
            
            this.loading.delete(url);
            return content;
        } catch (e) {
            this.loading.delete(url);
            throw e;
        }
    }

    /**
     * Fetch dependency from URL
     */
    private async fetchDependency(url: string, scriptName: string): Promise<string> {
        strippedConsole.log(`[Water] Fetching dependency for ${scriptName}: ${url}`);

        try {
            // Validate URL
            if (!this.isValidURL(url)) {
                throw new Error(`Invalid dependency URL: ${url}`);
            }

            // Fetch with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Water-Client/1.1.3'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.text();

            // Validate content
            if (!content || content.trim().length === 0) {
                throw new Error('Dependency content is empty');
            }

            strippedConsole.log(`[Water] Successfully fetched dependency: ${url} (${content.length} bytes)`);
            return content;

        } catch (e: any) {
            const errorMsg = e.name === 'AbortError' 
                ? 'Dependency fetch timeout (30s)'
                : e.message;
            
            strippedConsole.error(`[Water] Failed to fetch dependency ${url}:`, errorMsg);
            throw new Error(`Failed to load dependency: ${errorMsg}`);
        }
    }

    /**
     * Add dependency to cache
     */
    private addToCache(url: string, content: string) {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = Array.from(this.cache.entries())
                .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())[0][0];
            this.cache.delete(oldestKey);
            strippedConsole.log(`[Water] Removed oldest cached dependency: ${oldestKey}`);
        }

        this.cache.set(url, {
            url,
            content,
            timestamp: new Date(),
            size: content.length
        });

        strippedConsole.log(`[Water] Cached dependency: ${url} (${content.length} bytes)`);
    }

    /**
     * Check if cached dependency is expired
     */
    private isCacheExpired(cached: DependencyCache): boolean {
        const age = Date.now() - cached.timestamp.getTime();
        return age > this.maxCacheAge;
    }

    /**
     * Validate URL
     */
    private isValidURL(url: string): boolean {
        try {
            const parsed = new URL(url);
            
            // Only allow HTTPS (security)
            if (parsed.protocol !== 'https:') {
                strippedConsole.warn(`[Water] Dependency URL must use HTTPS: ${url}`);
                return false;
            }

            // Whitelist common CDNs and repositories
            const allowedDomains = [
                'cdn.jsdelivr.net',
                'cdnjs.cloudflare.com',
                'unpkg.com',
                'code.jquery.com',
                'ajax.googleapis.com',
                'raw.githubusercontent.com',
                'gist.githubusercontent.com',
                'esm.sh',
                'cdn.skypack.dev'
            ];

            const isAllowed = allowedDomains.some(domain => 
                parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
            );

            if (!isAllowed) {
                strippedConsole.warn(`[Water] Dependency URL from untrusted domain: ${url}`);
                // Still allow but warn
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Load multiple dependencies in parallel
     */
    async loadDependencies(urls: string[], scriptName: string): Promise<string[]> {
        if (urls.length === 0) {
            return [];
        }

        strippedConsole.log(`[Water] Loading ${urls.length} dependencies for ${scriptName}...`);

        const results = await Promise.allSettled(
            urls.map(url => this.loadDependency(url, scriptName))
        );

        const contents: string[] = [];
        const errors: string[] = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                contents.push(result.value);
            } else {
                errors.push(`${urls[index]}: ${result.reason.message}`);
            }
        });

        if (errors.length > 0) {
            const errorMsg = `Failed to load ${errors.length} dependencies:\n${errors.join('\n')}`;
            throw new Error(errorMsg);
        }

        strippedConsole.log(`[Water] Successfully loaded ${contents.length} dependencies for ${scriptName}`);
        return contents;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        strippedConsole.log('[Water] Dependency cache cleared');
    }

    /**
     * Clear expired cache entries
     */
    clearExpiredCache() {
        let cleared = 0;
        for (const [url, cached] of this.cache.entries()) {
            if (this.isCacheExpired(cached)) {
                this.cache.delete(url);
                cleared++;
            }
        }
        if (cleared > 0) {
            strippedConsole.log(`[Water] Cleared ${cleared} expired cache entries`);
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const totalSize = Array.from(this.cache.values())
            .reduce((sum, cached) => sum + cached.size, 0);

        return {
            entries: this.cache.size,
            totalSize,
            maxSize: this.maxCacheSize,
            maxAge: this.maxCacheAge
        };
    }

    /**
     * Get cached dependency URLs
     */
    getCachedURLs(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Check if dependency is cached
     */
    isCached(url: string): boolean {
        const cached = this.cache.get(url);
        return cached !== undefined && !this.isCacheExpired(cached);
    }
}

export const dependencyManager = new UserscriptDependencyManager();

// Clear expired cache every hour
setInterval(() => {
    dependencyManager.clearExpiredCache();
}, 60 * 60 * 1000);
