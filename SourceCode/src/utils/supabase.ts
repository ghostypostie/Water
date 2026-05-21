import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseInstance: any = null;

export function getSupabaseClient() {
    // Check if we're in a browser environment (renderer process)
    if (typeof window === 'undefined') {
        console.error('[Supabase] Cannot initialize in main process - Supabase requires browser APIs');
        return null;
    }
    
    if (!supabaseInstance) {
        // Hardcoded credentials (safe for client-side, these are public keys)
        let supabaseUrl = '';
        let supabaseKey = '';
        
        console.log('[Supabase] Initializing client with URL:', supabaseUrl);
        supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
    
    return supabaseInstance;
}
