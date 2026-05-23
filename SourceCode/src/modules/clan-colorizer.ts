import Module from '../module';
import { Context, RunAt } from '../context';
import { ClanData } from '../types/clan';

export default class ClanColorizer extends Module {
    name = 'Custom Clan Tags';
    id = 'clancolorizer';
    
    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        },
        {
            context: Context.Editor,
            runAt: RunAt.LoadEnd,
        },
        {
            context: Context.Viewer,
            runAt: RunAt.LoadEnd,
        },
    ];

    options = [];

    private observer: MutationObserver | null = null;
    private isInitialized = false;
    private clanCache = new Map<string, ClanData>(); // clan name -> clan data

    private normalizeTag(tag: string): string {
        return String(tag || '')
            .replace(/^\[|\]$/g, '')
            .trim()
            .toUpperCase();
    }

    private updateClanCache(clans: ClanData[]): void {
        this.clanCache.clear();
        
        clans.forEach(clan => {
            const normalizedName = clan.name.toUpperCase();
            this.clanCache.set(normalizedName, clan);
        });

        console.log('[ClanColorizer] Cache updated with', this.clanCache.size, 'clans');
    }

    private injectClanStyle(el: Element): void {
        // ROBUST CHECK: Skip if already processed
        if (el.hasAttribute('data-clan-processed')) return;
        if ((el as any).__clanColorized === true) return;
        if (el.classList.contains('clan-processed')) return;
        
        try {
            const txt = (el.textContent || '').trim();
            
            console.log('[ClanColorizer] Checking element text:', txt);
            
            if (!txt) return;
            
            // ONLY match [TAG] format with brackets
            const bracketMatch = txt.match(/^\[([^\]]+)\]$/);
            if (!bracketMatch) {
                console.log('[ClanColorizer] No bracket match for:', txt);
                return;
            }
            
            const clanTag = bracketMatch[1];
            const normalizedTag = this.normalizeTag(clanTag);
            
            console.log('[ClanColorizer] Found clan tag:', clanTag, '-> normalized:', normalizedTag);
            
            // Check cache for clan
            const clan = this.clanCache.get(normalizedTag);
            
            console.log('[ClanColorizer] Cache lookup for', normalizedTag, ':', clan ? 'FOUND' : 'NOT FOUND');
            
            // ALWAYS mark as processed first
            (el as any).__clanColorized = true;
            el.setAttribute('data-clan-processed', 'true');
            el.classList.add('clan-processed');
            
            if (!clan) return;
            if (!clan.style && !clan.addonHTML) return;

            console.log('[ClanColorizer] ✓ Applying style to', normalizedTag);

            // Apply styles
            const htmlEl = el as HTMLElement;
            if (clan.style) {
                for (const key in clan.style) {
                    const value = clan.style[key];
                    
                    // Special handling for gradient text
                    if (key === 'background' && value.includes('gradient')) {
                        htmlEl.style.setProperty('background', value, 'important');
                        htmlEl.style.setProperty('background-clip', 'text', 'important');
                        htmlEl.style.setProperty('-webkit-background-clip', 'text', 'important');
                        htmlEl.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
                        htmlEl.style.setProperty('color', 'transparent', 'important');
                    } else {
                        htmlEl.style.setProperty(key, value, 'important');
                    }
                }
            }
            
            // Inject additional HTML if provided (only once)
            if (clan.addonHTML && !htmlEl.innerHTML.includes(clan.addonHTML)) {
                htmlEl.insertAdjacentHTML('afterend', clan.addonHTML);
            }
        } catch (err) {
            console.log('[ClanColorizer] injectClanStyle error:', err);
        }
    }

    private injectAll(): void {
        try {
            // Find ALL spans in the document
            const allSpans = document.querySelectorAll('span');
            const elementsToProcess: Element[] = [];
            
            // Filter spans that match clan tag pattern [XXX]
            allSpans.forEach((span) => {
                // Skip if already processed
                if (span.hasAttribute('data-clan-processed')) return;
                if ((span as any).__clanColorized === true) return;
                if (span.classList.contains('clan-processed')) return;
                
                const txt = (span.textContent || '').trim();
                if (txt.match(/^\[([^\]]+)\]$/)) {
                    elementsToProcess.push(span);
                }
            });
            
            console.log('[ClanColorizer] injectAll found', elementsToProcess.length, 'clan tag elements to check');
            
            elementsToProcess.forEach((el) => {
                this.injectClanStyle(el);
            });
        } catch (err) {
            console.log('[ClanColorizer] injectAll error:', err);
        }
    }

    private attachObserver(): boolean {
        if (this.observer) this.observer.disconnect();

        this.observer = new MutationObserver((mutations) => {
            console.log('[ClanColorizer] Observer fired with', mutations.length, 'mutations');
            const elementsToProcess: Element[] = [];
            
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;
                
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    const el = node as Element;
                    
                    // Skip if already processed
                    if (el.hasAttribute('data-clan-processed')) continue;
                    if ((el as any).__clanColorized === true) continue;
                    if (el.classList.contains('clan-processed')) continue;
                    
                    // Check if it's a span element (clan tags are always in spans)
                    if (el.tagName === 'SPAN') {
                        const txt = (el.textContent || '').trim();
                        // Only process if it looks like a clan tag [XXX]
                        if (txt.match(/^\[([^\]]+)\]$/)) {
                            elementsToProcess.push(el);
                        }
                    }
                    
                    // Also check children for spans with clan tags
                    if (el.querySelectorAll) {
                        el.querySelectorAll('span').forEach((span) => {
                            if (span.hasAttribute('data-clan-processed')) return;
                            if ((span as any).__clanColorized === true) return;
                            if (span.classList.contains('clan-processed')) return;
                            
                            const txt = (span.textContent || '').trim();
                            if (txt.match(/^\[([^\]]+)\]$/)) {
                                elementsToProcess.push(span);
                            }
                        });
                    }
                }
            }
            
            // Batch process all elements
            if (elementsToProcess.length > 0) {
                console.log('[ClanColorizer] Observer found', elementsToProcess.length, 'clan tag elements');
                elementsToProcess.forEach((el) => this.injectClanStyle(el));
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
        
        return true;
    }

    private initSync(): void {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        // Fetch clan data directly from Supabase
        this.fetchClansFromSupabase();
        
        console.log('[ClanColorizer] Custom clan tags initialized');

        // Initial application
        this.injectAll();

        try {
            this.attachObserver();
            window.addEventListener('unload', this.cleanup.bind(this));
            console.log('[ClanColorizer] Observer active');
        } catch (err) {
            console.log('[ClanColorizer] init error:', err);
        }
    }

    private async fetchClansFromSupabase(): Promise<void> {
        try {
            console.log('[ClanColorizer] 🔄 Starting Supabase fetch...');
            
            const { getSupabaseClient } = await import('../utils/supabase');
            const supabase = getSupabaseClient();
            
            if (!supabase) {
                console.error('[ClanColorizer] ❌ Failed to initialize Supabase client');
                return;
            }

            console.log('[ClanColorizer] ✓ Supabase client initialized');
            console.log('[ClanColorizer] 🔄 Fetching clan data from database...');
            
            const { data, error } = await supabase
                .from('clan_tags')
                .select('name, style, addon_html, enabled')
                .eq('enabled', true)
                .order('name', { ascending: true });

            if (error) {
                console.error('[ClanColorizer] ❌ Supabase fetch error:', error);
                return;
            }

            console.log('[ClanColorizer] ✓ Fetch completed, data:', data);

            if (data && data.length > 0) {
                const clans = data.map((row: any) => ({
                    name: row.name,
                    style: row.style || {},
                    addonHTML: row.addon_html || null,
                    enabled: row.enabled
                }));
                
                console.log('[ClanColorizer] ✅ Loaded', clans.length, 'clans:', clans.map(c => c.name));
                console.log('[ClanColorizer] Clan details:', clans);
                
                // Update cache
                this.updateClanCache(clans);
                
                // Apply colors immediately
                console.log('[ClanColorizer] Applying colors to all elements...');
                this.injectAll();
                
                // Refresh every 60 seconds
                setInterval(() => this.fetchClansFromSupabase(), 60000);
            } else {
                console.warn('[ClanColorizer] ⚠️ No clans found in database (data is empty or null)');
            }
        } catch (err) {
            console.error('[ClanColorizer] ❌ Fetch error:', err);
            // Continue anyway - don't block the app
        }
    }

    private cleanup(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.clanCache.clear();
        this.isInitialized = false;
        console.log('[ClanColorizer] Cleaned up');
    }

    renderer(): void {
        this.initSync();
        
        window.addEventListener('beforeunload', this.cleanup.bind(this));
        window.addEventListener('unload', this.cleanup.bind(this));
    }
}
