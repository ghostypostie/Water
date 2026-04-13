import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseInstance: any = null;

export function getSupabaseClient() {
    if (!supabaseInstance) {
        // Hardcoded credentials (safe for client-side, these are public keys)
        let supabaseUrl = 'https://teknhplqqyclyahqgnfa.supabase.co';
        let supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRla25ocGxxcXljbHlhaHFnbmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMTAwMjAsImV4cCI6MjA4NDg4NjAyMH0.YbIWHIw84ndYVq6HGuRpt2h7KUinORMqyeCaVzE6UL0';
        
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
