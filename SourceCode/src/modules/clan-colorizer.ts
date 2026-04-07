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
        
        const color = this.colorForText(txt);
        if (!color) return;
        
        // Check if it's a gradient
        if (color.startsWith('linear-gradient')) {
            el.style.setProperty('background', color, 'important');
            el.style.setProperty('background-clip', 'text', 'important');
            el.style.setProperty('-webkit-background-clip', 'text', 'important');
            el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
            el.style.setProperty('color', 'transparent', 'important');
        } else {
            el.style.setProperty('color', color, 'important');
        }
        
        (el as any).dataset.clanColorized = color;
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
                const nodesToProcess: Element[] = [];
                
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType !== 1) continue;
                            const el = node as Element;
                            
                            if (el.matches && el.matches(this.SELECTORS)) {
                                nodesToProcess.push(el);
                            } else if (el.querySelector) {
                                el.querySelectorAll(this.SELECTORS).forEach((span) => {
                                    nodesToProcess.push(span);
                                });
                            }
                        }
                    } else if (mutation.type === 'characterData') {
                        const parent = mutation.target.parentElement;
                        if (parent && parent.matches && parent.matches(this.SELECTORS)) {
                            nodesToProcess.push(parent);
                        }
                    }
                }
                
                nodesToProcess.forEach((el) => this.colorElement(el as HTMLElement));
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
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
        this.isInitialized = false;
        console.log('[ClanColorizer] Cleaned up');
    }

    renderer(): void {
        this.initObserver();
        
        window.addEventListener('beforeunload', this.cleanup.bind(this));
        window.addEventListener('unload', this.cleanup.bind(this));
    }
}
