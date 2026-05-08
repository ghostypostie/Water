import Module from '../module';
import { Context, RunAt } from '../context';
import config from '../config';

interface ClanTags {
    [tag: string]: string;
}

export default class ClanColorizer extends Module {
    name = 'Clan Colorizer';
    id = 'clancolorizer';
    
    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        },
    ];

    options = [];

    private observer: MutationObserver | null = null;
    private isInitialized = false;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingNodes: Set<Element> = new Set();

    private readonly SELECTORS = [
        '.leaderNameM span',
        '.leaderNameF span',
        '.leaderName span',
        '.newLeaderNameM span',
        '.newLeaderNameF span',
        '.newLeaderName span',
        '.pListName span',
        '.endTableN span',
    ].join(', ');

    private TAG_COLORS: ClanTags = {
        H1ND: '#FF9933',
        psvm: '#AA00FF',
        VAMP: 'linear-gradient(90deg, hsla(0, 79%, 32%, 1) 0%, hsla(0, 0%, 0%, 1) 100%)',
        WH: 'linear-gradient(135deg, rgba(186, 229, 255, 1) 0%, rgba(0, 0, 0, 1) 100%)',
    };

    private normalizeTag(tag: string): string {
        return String(tag || '')
            .replace(/^\[|\]$/g, '')
            .trim()
            .toUpperCase();
    }

    private colorForText(text: string): string | null {
        const key = this.normalizeTag(text);
        return key && this.TAG_COLORS[key] ? this.TAG_COLORS[key] : null;
    }

    private colorElement(el: HTMLElement): void {
        const txt = (el.textContent || '').trim();
        if (!txt) return;
        
        // PERFORMANCE: Skip if already colorized with the same content
        const existingColorized = (el as any).dataset.clanColorized;
        const existingText = (el as any).dataset.clanText;
        if (existingColorized && existingText === txt) {
            return; // Already processed, skip to prevent flickering
        }
        
        const color = this.colorForText(txt);
        if (!color) return;
        
        // PERFORMANCE: Use cssText for batch style updates (faster than individual setProperty calls)
        if (color.startsWith('linear-gradient')) {
            el.style.cssText += `
                background: ${color} !important;
                background-clip: text !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                color: transparent !important;
            `;
        } else {
            el.style.cssText += `color: ${color} !important;`;
        }
        
        // Mark as colorized with both color and text to prevent re-processing
        (el as any).dataset.clanColorized = color;
        (el as any).dataset.clanText = txt;
    }

    private applyColors(root: Document | Element = document): void {
        try {
            root.querySelectorAll(this.SELECTORS).forEach((el) => {
                this.colorElement(el as HTMLElement);
            });
        } catch (err) {
            console.log('[ClanColorizer] applyColors error:', err);
        }
    }

    private initObserver(): void {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        console.log('[ClanColorizer] Initializing with tags:', Object.keys(this.TAG_COLORS));

        this.applyColors();

        try {
            this.observer = new MutationObserver((mutations) => {
                // Collect nodes to process, avoiding duplicates with Set
                for (const mutation of mutations) {
                    // PERFORMANCE: Only process childList mutations (new elements added)
                    if (mutation.type !== 'childList') continue;
                    
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        const el = node as Element;
                        
                        // PERFORMANCE: Skip if already colorized (check dataset first)
                        if ((el as any).dataset?.clanColorized) continue;
                        
                        if (el.matches && el.matches(this.SELECTORS)) {
                            // PERFORMANCE: Double-check before adding to pending
                            if (!(el as any).dataset?.clanColorized) {
                                this.pendingNodes.add(el);
                            }
                        } else if (el.querySelector) {
                            el.querySelectorAll(this.SELECTORS).forEach((span) => {
                                // PERFORMANCE: Skip already colorized elements
                                if (!(span as any).dataset?.clanColorized) {
                                    this.pendingNodes.add(span);
                                }
                            });
                        }
                    }
                }
                
                // Only process if we have pending nodes
                if (this.pendingNodes.size === 0) return;
                
                // PERFORMANCE: Debounce batch-process all collected nodes after 50ms
                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.pendingNodes.forEach((el) => this.colorElement(el as HTMLElement));
                    this.pendingNodes.clear();
                    this.debounceTimer = null;
                }, 50);
            });

            // PERFORMANCE: Only observe childList, NOT attributes or characterData
            // This prevents re-triggering when we set styles or data attributes
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                // REMOVED: attributes, characterData, attributeOldValue
            });

            window.addEventListener('unload', this.cleanup.bind(this));
            console.log('[ClanColorizer] Initialized');
        } catch (err) {
            console.log('[ClanColorizer] init error:', err);
        }
    }

    private cleanup(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingNodes.clear();
        this.isInitialized = false;
        console.log('[ClanColorizer] Cleaned up');
    }

    renderer(): void {
        this.initObserver();
        
        window.addEventListener('beforeunload', this.cleanup.bind(this));
        window.addEventListener('unload', this.cleanup.bind(this));
    }
}
