import Module from '../module';
import { Context, RunAt } from '../context';


export default class RankBadgeSync extends Module {
    name = 'Rank Badge Sync';
    id = 'rankbadgesync';

    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        },
    ];

    options = [];

    private rankCache = new Map<string, string | null>();
    private rowObserver: MutationObserver | null = null;
    private centerObserver: MutationObserver | null = null;
    private isInitialized = false;

    
    private getPlayerName(nameEl: Element | null): string {
        if (!nameEl) return '';
        let name = '';
        nameEl.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                name += node.textContent;
            }
        });
        return name.trim().toLowerCase();
    }

    
    private updateRankCache(): void {
        try {
            const center = document.getElementById('centerLeaderDisplay');
            if (!center) return;

            center.querySelectorAll('.newLeaderItem').forEach((item) => {
                const nameEl = item.querySelector(
                    '.newLeaderNameM, .newLeaderNameF, .newLeaderName'
                );
                if (!nameEl) return;

                const name = this.getPlayerName(nameEl);
                if (!name) return;

                const rankImg = item.querySelector('.newLeaderRanked img') as HTMLImageElement;
                const src = rankImg ? rankImg.src : null;
                this.rankCache.set(name, src);
            });
        } catch (err) {
            console.log('[RankBadgeSync] updateRankCache error:', err);
        }
    }

    
    private injectBadgeIntoItem(item: Element): void {
        try {
            const nameEl = item.querySelector('.leaderNameM, .leaderNameF, .leaderName');
            if (!nameEl) return;

            const name = this.getPlayerName(nameEl);
            if (!name) return;

            if (!this.rankCache.has(name)) return;
            const rankSrc = this.rankCache.get(name);
            if (!rankSrc) return;

            const existing = item.querySelector('.waterLeaderRanked img') as HTMLImageElement;
            if (existing) {
                if (existing.src !== rankSrc) existing.src = rankSrc;
                return;
            }

            const badge = document.createElement('div');
            badge.className = 'waterLeaderRanked';
            badge.style.cssText =
                'display:inline-flex;align-items:center;margin-right:3px;vertical-align:middle;flex-shrink:0;';

            const img = document.createElement('img');
            img.src = rankSrc;
            img.alt = 'Rank';
            img.className = 'newLeaderRankedIcon';
            img.style.cssText = 'width:24px;height:24px;';

            badge.appendChild(img);
            item.insertBefore(badge, nameEl);
        } catch (err) {
            console.log('[RankBadgeSync] injectBadgeIntoItem error:', err);
        }
    }

    
    private injectAll(): void {
        try {
            const holder = document.getElementById('leaderboardHolder');
            if (!holder) return;
            holder.querySelectorAll('.leaderItem').forEach((item) => {
                this.injectBadgeIntoItem(item);
            });
        } catch (err) {
            console.log('[RankBadgeSync] injectAll error:', err);
        }
    }

    
    private attachRowObserver(): boolean {
        const holder = document.getElementById('leaderboardHolder');
        if (!holder) return false;

        if (this.rowObserver) this.rowObserver.disconnect();

        this.rowObserver = new MutationObserver((mutations) => {
            const itemsToProcess: Element[] = [];
            
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    const el = node as Element;
                    if (el.classList && el.classList.contains('leaderItem')) {
                        itemsToProcess.push(el);
                    } else if (el.querySelectorAll) {
                        el.querySelectorAll('.leaderItem').forEach((item) => {
                            itemsToProcess.push(item);
                        });
                    }
                }
            }
            
            itemsToProcess.forEach((item) => this.injectBadgeIntoItem(item));
        });

        this.rowObserver.observe(holder, { childList: true, subtree: true });
        return true;
    }

    
    private attachCenterObserver(): boolean {
        const center = document.getElementById('centerLeaderDisplay');
        if (!center) return false;

        if (this.centerObserver) this.centerObserver.disconnect();

        let updateTimeout: NodeJS.Timeout | null = null;
        
        this.centerObserver = new MutationObserver(() => {
            if (updateTimeout) clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                this.updateRankCache();
                this.injectAll();
            }, 100);
        });

        this.centerObserver.observe(center, {
            childList: true,
            subtree: true,
        });
        return true;
    }

    
    private initSync(): void {
        if (this.isInitialized) return;
        this.isInitialized = true;

        this.updateRankCache();
        this.injectAll();

        try {
            if (!this.attachRowObserver()) {
                const wait = setInterval(() => {
                    if (this.attachRowObserver()) clearInterval(wait);
                }, 200);
            }

            if (!this.attachCenterObserver()) {
                const wait = setInterval(() => {
                    if (this.attachCenterObserver()) clearInterval(wait);
                }, 200);
            }

            console.log('[RankBadgeSync] Initialized');
        } catch (err) {
            console.log('[RankBadgeSync] init error:', err);
        }
    }

    
    private cleanup(): void {
        if (this.rowObserver) {
            this.rowObserver.disconnect();
            this.rowObserver = null;
        }
        if (this.centerObserver) {
            this.centerObserver.disconnect();
            this.centerObserver = null;
        }
        this.rankCache.clear();
        this.isInitialized = false;
        console.log('[RankBadgeSync] Cleaned up');
    }

    renderer(): void {
        this.initSync();

        window.addEventListener('beforeunload', this.cleanup.bind(this));
        window.addEventListener('unload', this.cleanup.bind(this));
    }
}
