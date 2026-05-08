import { app, protocol } from 'electron';
import { Context, RunAt } from '../context';
import Module from '../module';
import Manager from '../module/manager';
import { join } from 'path';
import { existsSync, statSync, mkdirSync } from 'fs';
import Checkbox from '../options/checkbox';
import { getSwapPath } from '../utils/paths';

export default class ResourceSwapper extends Module {
    id = 'resourceswapper';
    name = 'Resource Swapper';
    path: string;
    // PERFORMANCE: Cache file existence checks to avoid repeated file system calls
    private fileCache = new Map<string, { exists: boolean; timestamp: number }>();
    private readonly CACHE_TTL = 30000; // 30 seconds

    contexts = [
        {
            context: Context.Startup,
            runAt: RunAt.LoadEnd,
        },
    ];

    options = [
        new Checkbox(this, {
            name: 'Enabled',
            description:
                'Swaps game resources with ones from the resource swapper folder.',
            id: 'enabled',
            defaultValue: true,
        }),
        new Checkbox(this, {
            name: 'Enable Userscripts',
            description: 'Allow custom JavaScript scripts to run',
            id: 'enableUserscripts',
            needsRestart: true,
            defaultValue: true,
        }),
    ];

    main() {
        this.path = getSwapPath();
        console.log('[ResourceSwapper] Using Swap path:', this.path);

        protocol.registerFileProtocol('client-swapper', (request, callback) => {
            let url = new URL(request.url);
            callback({ path: join(this.path, url.pathname) });
        });

        Manager.registerBeforeRequestCallback((details, callback) => {
            if (!this.config.get('enabled', true))
                return callback({ cancel: false });
            if (!existsSync(this.path))
                mkdirSync(this.path, { recursive: true });
            if (!details.url) return callback({ cancel: false });

            let url = new URL(details.url);

            if (
                (
                    !url.hostname.endsWith('krunker.io') &&
                    !url.hostname.endsWith('browserfps.com')
                )
            )
                return callback({ cancel: false });

            // PERFORMANCE: Check cache first before file system
            const cacheKey = url.pathname;
            const now = Date.now();
            const cached = this.fileCache.get(cacheKey);
            
            if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
                // Use cached result
                return callback(cached.exists ? {
                    redirectURL: 'client-swapper://' + url.pathname,
                } : { cancel: false });
            }

            // Check file system and cache result
            const fullPath = join(this.path, url.pathname);
            const exists = existsSync(fullPath) && statSync(fullPath).isFile();
            
            // Cache the result
            this.fileCache.set(cacheKey, { exists, timestamp: now });

            return callback(exists ? {
                redirectURL: 'client-swapper://' + url.pathname,
            } : { cancel: false });
        });
    }
}
