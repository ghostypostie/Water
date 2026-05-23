import Module from '../module';
import { Context, RunAt } from '../context';
import { BadgeDefinition, ProcessedBadgeUser, DeathCard } from '../types/badge';
import Checkbox from '../options/checkbox';
import msgpack from 'msgpack-lite';
import { getEnv } from '../utils/env';

const DEFAULT_SERVER_URL = getEnv().WATER_SERVER_URL || 'ws://localhost:3000/ws';
const RECONNECT_DELAY = 5000;

export default class Badges extends Module {
    name = 'Custom Badges';
    id = 'badges';

    contexts = [
        { context: Context.Game, runAt: RunAt.LoadEnd },
        { context: Context.Social, runAt: RunAt.LoadEnd },
    ];

    options = [
        new Checkbox(this, {
            name: 'Custom Badges',
            id: 'enabled',
            defaultValue: true,
            needsRestart: true,
        }),
    ];

    private static BADGE_CSS_ID = 'water-badge-styles';

    private injectStyles(): void {
        if (document.getElementById(Badges.BADGE_CSS_ID)) return;
        const style = document.createElement('style');
        style.id = Badges.BADGE_CSS_ID;
        style.textContent = `
            .water-badge { height: 25px; margin-right: 2px; margin-left: 2px; margin-top: 3px; vertical-align: middle; }
            .water-badge-social { height: 26px; margin-right: 5px; vertical-align: middle; }
            .water-death-card-bg { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 0; }
        `;
        document.head.appendChild(style);
    }

    // WebSocket state
    private ws: WebSocket | null = null;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private wsReady = false;

    // Badge data
    private badgeDefinitions: BadgeDefinition[] = [];
    private deathCards: DeathCard[] = [];
    private users: any[][] = [];
    private processedUsers: ProcessedBadgeUser[] = [];

    // Observers
    private rowObserver: MutationObserver | null = null;
    private centerObserver: MutationObserver | null = null;
    private deathObserver: MutationObserver | null = null;
    private socialObserver: MutationObserver | null = null;
    private socialListObserver: MutationObserver | null = null;

    private isGameInitialized = false;
    private isSocialInitialized = false;

    // =========================================================================
    // WebSocket client
    // =========================================================================

    private connect(): void {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
        }
        try {
            const serverUrl = this.config.get('serverUrl', DEFAULT_SERVER_URL) as string;
            const ws = new WebSocket(serverUrl);
            ws.binaryType = 'arraybuffer';

            ws.onopen = () => {
                this.wsReady = true;
            };

            ws.onmessage = (event: any) => {
                this.handleMessage(event.data);
            };

            ws.onclose = () => {
                this.wsReady = false;
                this.scheduleReconnect();
            };

            ws.onerror = () => {};

            this.ws = ws;
        } catch (err) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(), RECONNECT_DELAY);
    }

    private handleMessage(data: any): void {
        try {
            let buffer: Buffer;

            if (data instanceof ArrayBuffer) {
                buffer = Buffer.from(data);
            } else if (Buffer.isBuffer(data)) {
                buffer = data;
            } else {
                return;
            }

            const packet = msgpack.decode(buffer);
            const key = packet[0];
            const args = packet.slice(1);

            switch (key) {
                case 'init':
                    this.badgeDefinitions = args[1] || [];
                    this.deathCards = (args[2] || []).map((card: any) => ({
                        name: card.n,
                        url: card.u
                    }));
                    break;

                case 'au':
                    this.users = args;
                    this.updateList();
                    break;

                case 'u':
                    const discordId = args[0];
                    const existing = this.users.find(u => u[0] === discordId);
                    if (existing) {
                        for (let i = 0; i < args.length; i++) {
                            existing[i] = args[i];
                        }
                    } else {
                        this.users.push(args);
                    }
                    this.updateList();
                    break;

                case 'c':
                    break;
            }
        } catch (err) {
            console.error('[Badges] Message handling error:', err);
        }
    }

    // =========================================================================
    // Process users
    // =========================================================================

    private updateList(): void {
        this.processedUsers = [];

        // Calculate minPremiumP (lowest priority badge that has premium flag)
        const sortedBadges = [...this.badgeDefinitions].sort((a, b) => a.p - b.p);
        const minPremiumBadge = sortedBadges.find(b => b.pr);
        const minPremiumP = minPremiumBadge ? minPremiumBadge.p : 0;

        for (const user of this.users) {
            const displayName = user[1];
            if (!displayName) continue;

            const badgeIds: number[] = user[2] || [];
            const resolvedBadges: BadgeDefinition[] = [];

            for (const badgeId of badgeIds) {
                const badge = this.badgeDefinitions.find(b => b.id === badgeId);
                if (badge) resolvedBadges.push(badge);
            }

            // Sort by priority descending, map to URLs
            const badgeUrls = resolvedBadges
                .sort((a, b) => b.p - a.p)
                .map(b => b.url);

            // Determine premium status
            const isPremium = resolvedBadges.length > 0
                ? [...resolvedBadges].sort((a, b) => b.p - a.p)[0].p >= minPremiumP
                : false;

            this.processedUsers.push({
                name: displayName,
                uname: user[3] || '',
                badges: badgeUrls,
                deathCard: user[4] || null,
                isPremium
            });
        }
    }

    // =========================================================================
    // Entry point
    // =========================================================================

    renderer(ctx: Context): void {
        const enabled = this.config.get('enabled', true);
        if (!enabled) return;

        this.injectStyles();
        this.connect();

        if (ctx === Context.Game) {
            this.initGame();
        } else if (ctx === Context.Social) {
            this.initSocial();
        }
    }

    // =========================================================================
    // Game context — leaderboard + death screen
    // =========================================================================

    private initGame(): void {
        if (this.isGameInitialized) return;
        this.isGameInitialized = true;

        // Wait for badge data then inject
        const tryInject = () => {
            if (this.processedUsers.length > 0) {
                this.injectAllLeaderboard();
                this.tryAttachGameObservers();
            } else {
                setTimeout(tryInject, 1000);
            }
        };
        tryInject();

        window.addEventListener('beforeunload', this.cleanupGame.bind(this));
        window.addEventListener('unload', this.cleanupGame.bind(this));
    }

    private getPlayerName(nameEl: Element): string {
        let name = '';
        nameEl.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                name += node.textContent;
            }
        });
        return name.trim();
    }

    private injectLeaderboardBadge(item: Element, nameEl: Element): void {
        // Triple skip markers
        if (item.hasAttribute('data-badge-processed')) return;
        if ((item as any).__badgeApplied === true) return;
        if (item.classList.contains('badge-processed')) return;

        try {
            const playerName = this.getPlayerName(nameEl);
            if (!playerName) return;

            // Match by display name
            const player = this.processedUsers.find(x => x.name === playerName);

            // Mark as processed even if no badges
            (item as any).__badgeApplied = true;
            item.setAttribute('data-badge-processed', 'true');
            item.classList.add('badge-processed');

            if (!player || player.badges.length === 0) return;

            // Inject badge images before the player name element
            for (const badgeUrl of player.badges) {
                const html = `<img class="water-badge" src="${badgeUrl}">`;
                if (!item.innerHTML.includes(badgeUrl)) {
                    nameEl.insertAdjacentHTML('beforebegin', html);
                }
            }
        } catch (err) {
            console.error('[Badges] injectLeaderboardBadge error:', err);
        }
    }

    private injectAllLeaderboard(): void {
        try {
            const center = document.getElementById('centerLeaderDisplay');
            if (center) {
                const tbodies = center.getElementsByTagName('tbody');
                for (const tbody of tbodies) {
                    const children = [...tbody.children].slice(2);
                    for (const child of children) {
                        const nameEl = child.children[0]?.children[0]?.lastChild as Element;
                        if (nameEl) {
                            this.injectLeaderboardBadge(child, nameEl);
                        }
                    }
                }
            }

            const holder = document.getElementById('leaderboardHolder');
            if (holder) {
                holder.querySelectorAll('.leaderItem').forEach((item) => {
                    const nameEl = item.querySelector('.leaderNameM, .leaderNameF, .leaderName');
                    if (nameEl) {
                        this.injectLeaderboardBadge(item, nameEl);
                    }
                });
            }
        } catch (err) {
            console.error('[Badges] injectAllLeaderboard error:', err);
        }
    }

    private tryAttachGameObservers(): void {
        // Leaderboard row observer (old format)
        const holder = document.getElementById('leaderboardHolder');
        if (holder && !this.rowObserver) {
            this.rowObserver = new MutationObserver((mutations) => {
                const itemsToProcess: Element[] = [];
                for (const mutation of mutations) {
                    if (mutation.type !== 'childList') continue;
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        const el = node as Element;
                        if (el.hasAttribute('data-badge-processed')) continue;
                        if ((el as any).__badgeApplied === true) continue;
                        if (el.classList.contains('badge-processed')) continue;

                        if (el.classList?.contains('leaderItem')) {
                            itemsToProcess.push(el);
                        } else if (el.querySelectorAll) {
                            el.querySelectorAll('.leaderItem').forEach((item) => {
                                if (item.hasAttribute('data-badge-processed')) return;
                                if ((item as any).__badgeApplied === true) return;
                                if (item.classList.contains('badge-processed')) return;
                                itemsToProcess.push(item);
                            });
                        }
                    }
                }
                if (itemsToProcess.length > 0) {
                    itemsToProcess.forEach((item) => {
                        const nameEl = item.querySelector('.leaderNameM, .leaderNameF, .leaderName');
                        if (nameEl) this.injectLeaderboardBadge(item, nameEl);
                    });
                }
            });
            this.rowObserver.observe(holder, { childList: true, subtree: true });
        }

        // Center leaderboard observer (new format) with debounce
        const center = document.getElementById('centerLeaderDisplay');
        if (center && !this.centerObserver) {
            let updateTimeout: NodeJS.Timeout | null = null;
            this.centerObserver = new MutationObserver(() => {
                if (updateTimeout) clearTimeout(updateTimeout);
                updateTimeout = setTimeout(() => this.injectAllLeaderboard(), 100);
            });
            this.centerObserver.observe(center, { childList: true, subtree: true });
        }

        // Death screen observer
        this.attachDeathObserver();
    }

    private attachDeathObserver(): void {
        const deathUIHolder = document.getElementById('deathUIHolder');
        if (!deathUIHolder || this.deathObserver) return;

        this.deathObserver = new MutationObserver(() => {
            if (!deathUIHolder.style.display || deathUIHolder.style.display === 'none') return;

            const playerCards = [...deathUIHolder.getElementsByClassName('death-row-bottom')];
            for (let i = 0; i < playerCards.length; i++) {
                const playerCard = playerCards[i] as HTMLElement;
                const nameTextEl = playerCard.querySelector('.death-row-user-text');
                if (!nameTextEl) continue;
                const playerName = nameTextEl.textContent?.trim();
                if (!playerName) continue;

                // First card (killer) by display name, others by username
                const player = this.processedUsers.find(x =>
                    i === 0 ? x.name === playerName : x.uname === playerName
                );
                if (!player || !player.deathCard) continue;

                let playerBG = playerCard.querySelector('.death-row-bottom-bg') as HTMLImageElement;
                if (!playerBG) {
                    playerBG = document.createElement('img');
                    playerBG.className = 'water-death-card-bg';
                    playerCard.insertAdjacentElement('afterbegin', playerBG);
                }
                playerBG.src = player.deathCard;
            }
        });

        this.deathObserver.observe(deathUIHolder, {
            attributes: true,
            attributeFilter: ['style'],
        });
    }

    // =========================================================================
    // Social context — hub leaderboard
    // =========================================================================

    private initSocial(): void {
        if (this.isSocialInitialized) return;
        this.isSocialInitialized = true;

        const tryInject = () => {
            if (this.processedUsers.length > 0) {
                this.injectSocialBadges();
                this.attachSocialListObserver();
            } else {
                setTimeout(tryInject, 1000);
            }
        };

        this.waitForElement('loadMessage').then(() => {
            const loadMsg = document.getElementById('loadMessage')!;
            this.socialObserver = new MutationObserver((mutations) => {
                if ((mutations[0].target as HTMLElement).style.display !== 'none') return;
                tryInject();
            });
            this.socialObserver.observe(loadMsg, {
                attributeFilter: ['style'],
                attributes: true,
                attributeOldValue: true,
            });
        });

        window.addEventListener('beforeunload', this.cleanupSocial.bind(this));
        window.addEventListener('unload', this.cleanupSocial.bind(this));
    }

    private attachSocialListObserver(): void {
        const list = document.getElementById('leaderList');
        if (!list || this.socialListObserver) return;

        this.socialListObserver = new MutationObserver(() => {
            this.injectSocialBadges();
        });
        this.socialListObserver.observe(list, { childList: true, subtree: true });
    }

    private injectSocialBadges(): void {
        try {
            const list = document.getElementById('leaderList');
            if (!list || !list.children[0]) return;
            const items = [...list.children[0].children];

            for (let i = 0; i < items.length; i++) {
                const item = items[i] as HTMLElement;
                const name = item.querySelector('a.lName') as HTMLElement;
                if (!name) continue;

                const player = this.processedUsers.find(p => p.uname === name.innerText);
                if (!player || player.badges.length === 0) continue;

                if (item.hasAttribute('data-badge-processed')) continue;

                const badgeImgs = player.badges.map(badge =>
                    `<img class="water-badge-social" src="${badge}">`
                );
                name.insertAdjacentHTML('beforebegin', badgeImgs.join(''));
                item.setAttribute('data-badge-processed', 'true');
            }
        } catch (err) {
            console.error('[Badges] injectSocialBadges error:', err);
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private waitForElement(id: string): Promise<HTMLElement> {
        return new Promise((resolve) => {
            const check = setInterval(() => {
                const el = document.getElementById(id);
                if (el) { clearInterval(check); resolve(el); }
            }, 10);
        });
    }

    private waitForChild(el: HTMLElement): Promise<void> {
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (el.children[0]) { clearInterval(check); resolve(); }
            }, 10);
        });
    }

    // =========================================================================
    // Cleanup
    // =========================================================================

    private cleanupGame(): void {
        if (this.rowObserver) { this.rowObserver.disconnect(); this.rowObserver = null; }
        if (this.centerObserver) { this.centerObserver.disconnect(); this.centerObserver = null; }
        if (this.deathObserver) { this.deathObserver.disconnect(); this.deathObserver = null; }
        this.isGameInitialized = false;
    }

    private cleanupSocial(): void {
        if (this.socialObserver) { this.socialObserver.disconnect(); this.socialObserver = null; }
        if (this.socialListObserver) { this.socialListObserver.disconnect(); this.socialListObserver = null; }
        this.isSocialInitialized = false;
    }
}
