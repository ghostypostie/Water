import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseInstance: any = null;

export function getSupabaseClient() {
    if (!supabaseInstance) {
        // Hardcoded credentials (safe for client-side, these are public keys)
        let supabaseUrl = '';
        let supabaseKey = '';
        
        // Try to override from process.env if available (for development)
        if (process.env.SUPABASE_URL) {
            supabaseUrl = process.env.SUPABASE_URL;
        }
        if (process.env.SUPABASE_ANON_KEY) {
            supabaseKey = process.env.SUPABASE_ANON_KEY;
        }
        
        console.log('[Supabase] Initializing client with URL:', supabaseUrl);
        supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
    
    return supabaseInstance;
}
