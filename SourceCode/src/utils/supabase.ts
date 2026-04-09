import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseInstance: any = null;

export function getSupabaseClient() {
    if (!supabaseInstance) {
        const supabaseUrl = '';
        const supabaseKey = '';
        
        supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
    
    return supabaseInstance;
}
