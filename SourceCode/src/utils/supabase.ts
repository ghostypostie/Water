import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseInstance: any = null;

export function getSupabaseClient() {
    if (!supabaseInstance) {
        const supabaseUrl = 'https://teknhplqqyclyahqgnfa.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRla25ocGxxcXljbHlhaHFnbmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMTAwMjAsImV4cCI6MjA4NDg4NjAyMH0.YbIWHIw84ndYVq6HGuRpt2h7KUinORMqyeCaVzE6UL0';
        
        supabaseInstance = createClient(supabaseUrl, supabaseKey);
    }
    
    return supabaseInstance;
}
