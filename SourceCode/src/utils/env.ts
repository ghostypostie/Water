import * as path from 'path';

export interface EnvCredentials {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    GITHUB_TOKEN: string;
    GITHUB_REPO: string;
    WATER_SERVER_URL: string;
    WATER_BOT_API: string;
}

const isMain = typeof process !== 'undefined' && process.versions && !!process.versions.electron && (process as any).type !== 'renderer';

let cachedEnv: EnvCredentials | null = null;

function loadEnvFromProcess(): EnvCredentials {
    let credentials = {
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
        GITHUB_REPO: process.env.GITHUB_REPO || '',
        WATER_SERVER_URL: process.env.WATER_SERVER_URL || '',
        WATER_BOT_API: process.env.WATER_BOT_API || '',
    };

    // Production Fallback: Check for bundled secrets.json
    if (!credentials.SUPABASE_URL && !credentials.GITHUB_TOKEN) {
        try {
            // Use require for JSON to benefit from automatic ASAR path handling
            // We use a dynamic require to avoid bundling issues if the file is missing in dev
            const secrets = require('./secrets.json');
            if (secrets) {
                credentials = {
                    SUPABASE_URL: secrets.SUPABASE_URL || credentials.SUPABASE_URL,
                    SUPABASE_ANON_KEY: secrets.SUPABASE_ANON_KEY || credentials.SUPABASE_ANON_KEY,
                    GITHUB_TOKEN: secrets.GITHUB_TOKEN || credentials.GITHUB_TOKEN,
                    GITHUB_REPO: secrets.GITHUB_REPO || credentials.GITHUB_REPO,
                    WATER_SERVER_URL: secrets.WATER_SERVER_URL || credentials.WATER_SERVER_URL,
                    WATER_BOT_API: secrets.WATER_BOT_API || credentials.WATER_BOT_API,
                };
                console.log('[Env] Loaded credentials from bundled secrets.json');
            }
        } catch (e) {
            // secrets.json doesn't exist or isn't valid JSON, which is expected in dev
        }
    }

    return credentials;
}

export function getEnv(): EnvCredentials {
    if (cachedEnv) return cachedEnv;

    if (isMain) {
        console.log('[Env] Loading credentials in Main process...');
        
        // In Main process, read from process.env
        // Check if we already have some keys (maybe loaded via index.ts import 'dotenv/config')
        if (!process.env.SUPABASE_URL && !process.env.GITHUB_TOKEN) {
            console.log('[Env] Keys not found in process.env, attempting to load via dotenv...');
            try {
                const dotenv = require('dotenv');
                const fs = require('fs');
                // Try to find .env in several locations
                const possiblePaths = [
                    path.join(process.cwd(), '.env'),
                    path.join(__dirname, '..', '.env'),
                    path.join(__dirname, '..', '..', '.env'),
                    path.join(__dirname, '..', '..', '..', '.env')
                ];
                
                let loaded = false;
                for (const p of possiblePaths) {
                    if (fs.existsSync(p)) {
                        const result = dotenv.config({ path: p });
                        if (!result.error) {
                            console.log(`[Env] Successfully loaded .env from: ${p}`);
                            loaded = true;
                            break;
                        } else {
                            console.error(`[Env] Error loading .env from ${p}:`, result.error);
                        }
                    }
                }
                
                if (!loaded) {
                    console.warn('[Env] Could not find or load .env file in any of the expected locations.');
                }
            } catch (e) {
                console.error('[Env] Exception while loading dotenv:', e);
            }
        } else {
            console.log('[Env] Credentials already present in process.env');
        }

        cachedEnv = loadEnvFromProcess();
        console.log('[Env] Main process credentials loaded:', {
            hasSupabase: !!cachedEnv.SUPABASE_URL,
            hasGithub: !!cachedEnv.GITHUB_TOKEN,
            hasWaterServer: !!cachedEnv.WATER_SERVER_URL
        });
        return cachedEnv;
    } else {
        // In Renderer process, always ask the Main process for the keys
        console.log('[Env] Requesting credentials in Renderer process...');
        try {
            const electron = require('electron');
            const ipcRenderer = electron.ipcRenderer;
            
            if (ipcRenderer) {
                const syncEnv = ipcRenderer.sendSync('get-env-sync');
                if (syncEnv && typeof syncEnv === 'object') {
                    console.log('[Env] Successfully received credentials via sync IPC');
                    cachedEnv = syncEnv;
                    return cachedEnv!;
                } else {
                    console.error('[Env] Received invalid credentials via IPC:', syncEnv);
                }
            } else {
                console.error('[Env] ipcRenderer not available');
            }
        } catch (e) {
            console.error('[Env] Failed to get env via sync IPC:', e);
        }

        // Final fallback to process.env
        console.log('[Env] Falling back to process.env in Renderer');
        cachedEnv = loadEnvFromProcess();
        return cachedEnv;
    }
}

// Helper to initialize IPC listener in main process
export function initEnvIpc() {
    if (isMain) {
        console.log('[Env] Initializing IPC listener in Main process...');
        try {
            const electron = require('electron');
            const ipcMain = electron.ipcMain;
            
            if (ipcMain) {
                ipcMain.removeAllListeners('get-env-sync');
                ipcMain.on('get-env-sync', (event) => {
                    console.log('[Env] Handling get-env-sync request');
                    event.returnValue = getEnv();
                });
                console.log('[Env] IPC listener for get-env-sync registered');
            } else {
                console.error('[Env] ipcMain not available');
            }
        } catch (e) {
            console.error('[Env] Failed to initialize IPC listener:', e);
        }
    }
}
