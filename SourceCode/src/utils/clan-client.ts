/**
 * Supabase client for fetching clan tag data
 * Uses existing Supabase infrastructure instead of WebSocket
 */

import { ClanData } from '../types/clan';
import { getSupabaseClient } from './supabase';

export class ClanClient {
    private clans: ClanData[] = [];
    private supabase: any = null;
    public initSent: boolean = false;
    private refreshInterval: ReturnType<typeof setInterval> | null = null;
    private readonly REFRESH_INTERVAL = 60000; // Refresh every 60 seconds

    constructor() {
        // Only initialize in renderer process (browser environment)
        if (typeof window !== 'undefined') {
            this.init();
        } else {
            console.log('[ClanClient] Skipping initialization in main process');
            this.initSent = true; // Mark as "initialized" to not block
        }
    }

    private async init(): Promise<void> {
        try {
            console.log('[ClanClient] Initializing Supabase clan client...');
            this.supabase = getSupabaseClient();
            
            // Mark as initialized immediately to not block
            this.initSent = true;
            
            // Load default clans immediately
            this.clans = this.getDefaultClans();
            
            // Fetch from Supabase in background (don't await)
            this.fetchClans().catch(err => console.error('[ClanClient] Fetch error:', err));
            
            // Set up periodic refresh
            this.startPeriodicRefresh();
            
            console.log('[ClanClient] Initialized with', this.clans.length, 'clans (loading from database in background)');
        } catch (err) {
            console.error('[ClanClient] Initialization error:', err);
            // Fall back to default clans
            this.clans = this.getDefaultClans();
            this.initSent = true;
        }
    }

    private async fetchClans(): Promise<void> {
        try {
            if (!this.supabase) {
                console.warn('[ClanClient] Supabase not initialized');
                return;
            }

            console.log('[ClanClient] Fetching clan data from Supabase...');
            
            // Fetch from clan_tags table
            const { data, error } = await this.supabase
                .from('clan_tags')
                .select('name, style, addon_html')
                .eq('enabled', true)
                .order('name', { ascending: true });

            if (error) {
                console.error('[ClanClient] Supabase fetch error:', error);
                return;
            }

            if (data && data.length > 0) {
                // Transform database format to ClanData format
                this.clans = data.map((row: any) => ({
                    name: row.name,
                    style: typeof row.style === 'string' ? JSON.parse(row.style) : row.style,
                    addonHTML: row.addon_html || undefined
                }));
                
                console.log('[ClanClient] Loaded', this.clans.length, 'clans from Supabase');
            } else {
                console.log('[ClanClient] No clans found in database, using defaults');
                this.clans = this.getDefaultClans();
            }
        } catch (err) {
            console.error('[ClanClient] Fetch error:', err);
            // Keep existing clans on error
        }
    }

    private startPeriodicRefresh(): void {
        // Refresh clan data periodically
        this.refreshInterval = setInterval(() => {
            console.log('[ClanClient] Periodic refresh...');
            this.fetchClans();
        }, this.REFRESH_INTERVAL);
    }

    private getDefaultClans(): ClanData[] {
        // Default clans (H1ND, PSVM, VAMP, WH) with enhanced styling
        return [
            {
                name: 'H1ND',
                style: {
                    color: '#FF9933',
                    fontWeight: 'bold',
                    textShadow: '0 0 8px #FF9933'
                }
            },
            {
                name: 'PSVM',
                style: {
                    color: '#AA00FF',
                    fontWeight: 'bold',
                    textShadow: '0 0 8px #AA00FF'
                }
            },
            {
                name: 'VAMP',
                style: {
                    background: 'linear-gradient(90deg, hsla(0, 79%, 32%, 1) 0%, hsla(0, 0%, 0%, 1) 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 'bold'
                }
            },
            {
                name: 'WH',
                style: {
                    background: 'linear-gradient(135deg, rgba(186, 229, 255, 1) 0%, rgba(0, 0, 0, 1) 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 'bold'
                }
            }
        ];
    }

    public getClans(): ClanData[] {
        // Always return at least the default clans
        return this.clans.length > 0 ? this.clans : this.getDefaultClans();
    }

    public async refresh(): Promise<void> {
        console.log('[ClanClient] Manual refresh requested');
        await this.fetchClans();
    }

    public disconnect(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.initSent = false;
        console.log('[ClanClient] Disconnected');
    }
}

// Singleton instance
let clanClientInstance: ClanClient | null = null;

export function getClanClient(): ClanClient {
    if (!clanClientInstance) {
        clanClientInstance = new ClanClient();
    }
    return clanClientInstance;
}
