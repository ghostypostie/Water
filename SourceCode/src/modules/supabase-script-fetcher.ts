import { Context, RunAt } from '../context';
import Module from '../module';
import { getSupabaseClient } from '../utils/supabase';
import config from '../config';

interface PremiumScriptCache {
    id: string;
    name: string;
    author: string;
    description: string;
    file_content: string;
    github_path: string;
}

export default class SupabaseScriptFetcher extends Module {
    name = 'Supabase Script Fetcher';
    id = 'supabase-script-fetcher';
    options: any[] = [];
    
    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadStart,
        }
    ];

    private supabase: any = null;

    init() {
        console.log('[SupabaseScriptFetcher] Module initializing...');
        
        // Check if userscripts are enabled
        const userscriptsEnabled = config.get('modules.resourceswapper.enableUserscripts', true) as boolean;
        console.log('[SupabaseScriptFetcher] Config modules.resourceswapper.enableUserscripts =', userscriptsEnabled);
        if (!userscriptsEnabled) {
            console.log('[SupabaseScriptFetcher] Userscripts disabled, skipping fetch');
            return;
        }
        
        try {
            this.supabase = getSupabaseClient();
            console.log('[SupabaseScriptFetcher] Supabase client initialized');
            this.fetchPurchasedScripts();
        } catch (e) {
            console.error('[SupabaseScriptFetcher] Failed to initialize:', e);
            // Proceed silently - client should still open
        }
    }

    private async fetchPurchasedScripts() {
        try {
            if (!this.supabase) {
                console.log('[SupabaseScriptFetcher] Supabase not available');
                return;
            }

            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) {
                console.log('[SupabaseScriptFetcher] No client ID found');
                return;
            }

            // Get discord_id from user_profiles
            const { data: profileData, error: profileError } = await this.supabase
                .from('user_profiles')
                .select('discord_id')
                .eq('client_id', clientId)
                .limit(1);

            if (profileError) {
                console.error('[SupabaseScriptFetcher] Profile fetch error:', profileError);
                return;
            }

            if (!profileData || profileData.length === 0 || !profileData[0].discord_id) {
                console.log('[SupabaseScriptFetcher] No Discord linked');
                return;
            }

            const discordId = profileData[0].discord_id;

            // Get purchased script IDs
            const { data: purchases, error: purchaseError } = await this.supabase
                .from('user_purchases')
                .select('item_id')
                .eq('discord_id', discordId);

            if (purchaseError) {
                console.error('[SupabaseScriptFetcher] Purchase fetch error:', purchaseError);
                return;
            }

            if (!purchases || purchases.length === 0) {
                console.log('[SupabaseScriptFetcher] No purchases found');
                return;
            }

            const itemIds = purchases.map((p: any) => p.item_id);
            console.log('[SupabaseScriptFetcher] User purchased items:', itemIds);

            // SKYCOLOR ONLY: Only fetch sky-color by ID for early loading
            // All other scripts load normally from GitHub via water.ts
            const SKYCOLOR_ID = 'sky-color'; // The specific ID for SkyColor script

            // Check if user purchased SkyColor
            if (!itemIds.includes(SKYCOLOR_ID)) {
                console.log('[SupabaseScriptFetcher] SkyColor not purchased, skipping early fetch');
                return;
            }
            console.log('[SupabaseScriptFetcher] SkyColor is purchased, fetching...');

            // Get SkyColor script details only
            const { data: skyColorScript, error: scriptError } = await this.supabase
                .from('premium_items')
                .select('id, name, author, description, file_content')
                .eq('id', SKYCOLOR_ID)
                .eq('type', 'userscript')
                .single();

            if (scriptError) {
                console.error('[SupabaseScriptFetcher] SkyColor fetch error:', scriptError);
                return;
            }

            if (!skyColorScript || !skyColorScript.file_content) {
                console.log('[SupabaseScriptFetcher] SkyColor not found or has no file_content');
                return;
            }

            // Store SkyColor in global memory cache (no disk writes)
            (window as any).__PREMIUM_SCRIPTS_CACHE__ = [{
                id: skyColorScript.id,
                name: skyColorScript.name,
                author: skyColorScript.author || 'Unknown',
                description: skyColorScript.description || '',
                file_content: skyColorScript.file_content
            }];

            console.log('[SupabaseScriptFetcher] Cached SkyColor in memory for early loading');
            console.log('[SupabaseScriptFetcher] Cache contents:', {
                name: skyColorScript.name,
                contentLength: skyColorScript.file_content?.length,
                id: skyColorScript.id
            });

            // Mark that event was fired for late listeners
            (window as any).__PREMIUM_SCRIPTS_EVENT_FIRED__ = true;
            
            // Dispatch event so userscript-loader knows cache is ready
            window.dispatchEvent(new CustomEvent('premiumScriptsReady', {
                detail: { scripts: (window as any).__PREMIUM_SCRIPTS_CACHE__ }
            }));

        } catch (e) {
            console.error('[SupabaseScriptFetcher] Error fetching purchased scripts:', e);
            // Mark that we attempted but failed, so late listeners know to retry
            (window as any).__PREMIUM_SCRIPTS_FETCH_ERROR__ = true;
        }
    }
}
