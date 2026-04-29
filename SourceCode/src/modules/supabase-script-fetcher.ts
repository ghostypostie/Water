import { Context, RunAt } from '../context';
import Module from '../module';
import config from '../config';

// This module is no longer needed - all premium scripts are loaded from GitHub via water.ts
// Keeping as placeholder for backward compatibility
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

    init() {
        console.log('[SupabaseScriptFetcher] Module deprecated - all scripts now load from GitHub');
    }
}
