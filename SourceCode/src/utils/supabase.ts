import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';

let supabaseInstance: any = null;

export function getSupabaseClient() {
    // In this app, we allow Supabase in both processes if needed, 
    // but the original code had a window check. Let's keep it if that was intentional for some reason,
    // though getEnv() works in both.
    
    if (!supabaseInstance) {
        const env = getEnv();
        const supabaseUrl = env.SUPABASE_URL;
        const supabaseKey = env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set');
            return null;
        }

        supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
    
    return supabaseInstance;
}
