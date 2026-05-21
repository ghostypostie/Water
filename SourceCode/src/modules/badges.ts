import Module from '../module';
import { Context, RunAt } from '../context';
import { getBadgeClient } from '../utils/badge-client';
import { BadgeDefinition, ProcessedUser } from '../types/badge';

console.log('[Badges] ✅ Module file loaded, class defined');

export default class Badges extends Module {
    name = 'Custom Badges';
    id = 'badges';

    contexts = [
        { context: Context.Game, runAt: RunAt.LoadEnd },
        { context: Context.Editor, runAt: RunAt.LoadEnd },
        { context: Context.Viewer, runAt: RunAt.LoadEnd },
    ];

    options = [];

    private observer: MutationObserver | null = null;
    private isInitialized = false;
    private badgeClient = getBadgeClient();
    private refreshInterval: ReturnType<typeof setInterval> | null = null;

    private readonly SELECTORS = [
        '.leaderNameM', '.leaderNameF', '.leaderName',
        '.newLeaderNameM', '.newLeaderNameF', '.newLeaderName',
        '.pListName', '.endTableN', '.scoreItem', '.profileName',
        '.socialItem', '.socialName', '.friendName', '.memberName', '.playerName',
        '.menuClassPlayerName', '#menuClassPlayerName',
        '#voteKickName', '.voteKickName',
    ].join(', ');

    private getPlayerName(el: Element): string {
        let name = (el.textContent || '').trim();
        if (el.id === 'voteKickName' || el.classList.contains('voteKickName')) {
            name = name.replace(/^Kick\s+/i, '');
        }
        return name.toLowerCase();
    }

    private getUserBadges(name: string): string[] {
        const list = this.badgeClient.getList();
        const user = list.find(u => u.name.toLowerCase() === name || u.uname?.toLowerCase() === name);
        return user?.badges || [];
    }

    private injectBadgeIntoElement(el: Element): boolean {
        try {
            const name = this.getPlayerName(el);
            if (!name) return false;

            // Ignore guest names
            if (name.startsWith('guest_')) return false;

            // Get user's badges from BadgeClient
            const badgeUrls = this.getUserBadges(name);
            if (badgeUrls.length === 0) return false;

            // Check if badges already injected
            const existingBadges = el.querySelectorAll('.custom-badge');
            if (existingBadges.length > 0) {
                // Update existing badges if count changed
                if (existingBadges.length !== badgeUrls.length) {
                    existingBadges.forEach(b => b.remove());
                } else {
                    return false;
                }
            }

            // Inject all badges (highest priority first - already sorted by BadgeClient)
            for (const url of badgeUrls) {
                const img = document.createElement('img');
                img.className = 'custom-badge';
                img.src = url;
                img.alt = 'Badge';
                img.style.cssText = `
                    height: 26px !important; width: 26px !important;
                    max-width: 26px !important; max-height: 26px !important;
                    object-fit: contain !important; margin-right: 4px !important;
                    margin-top: -13px !important; vertical-align: middle !important;
                    display: inline-block !important; image-rendering: auto !important;
                    -webkit-user-drag: none !important; pointer-events: none !important;
                `;
                el.insertBefore(img, el.firstChild);
            }

            console.log('[Badges] ✅ Injected', badgeUrls.length, 'badge(s) on', (el as HTMLElement).className || el.id || el.tagName, 'for', name);
            return true;
        } catch (err) {
            console.log('[Badges] injectBadgeIntoElement error:', err);
            return false;
        }
    }

    private injectAll(): void {
        try {
            let elements = Array.from(document.querySelectorAll(this.SELECTORS));
            let injected = 0;
            elements.forEach((el) => { if (this.injectBadgeIntoElement(el)) injected++; });
            if (injected > 0) {
                console.log('[Badges] injectAll:', elements.length, 'found,', injected, 'injected');
            }
        } catch (err) {
            console.log('[Badges] injectAll error:', err);
        }
    }

    private attachObserver(): void {
        if (this.observer) this.observer.disconnect();
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    const el = node as Element;
                    if (el.matches && el.matches(this.SELECTORS)) this.injectBadgeIntoElement(el);
                    else if (el.querySelectorAll) el.querySelectorAll(this.SELECTORS).forEach((child) => this.injectBadgeIntoElement(child));
                }
            }
        });
        this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    private initSync(): void {
        if (this.isInitialized) return;
        this.isInitialized = true;
        console.log('[Badges] init, badgeClient list size:', this.badgeClient.getList().length);

        // Inject immediately with whatever data is available
        this.injectAll();
        this.attachObserver();

        // Periodic re-inject for dynamic content
        this.refreshInterval = setInterval(() => this.injectAll(), 500);

        // Also inject on Tab key (common for switching UI panels)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' || e.keyCode === 9) setTimeout(() => this.injectAll(), 50);
        });
    }

    private cleanup(): void {
        if (this.observer) { this.observer.disconnect(); this.observer = null; }
        if (this.refreshInterval) { clearInterval(this.refreshInterval); this.refreshInterval = null; }
        this.isInitialized = false;
    }

    renderer(): void {
        this.initSync();
        window.addEventListener('beforeunload', () => this.cleanup());
        window.addEventListener('unload', () => this.cleanup());
    }
}
