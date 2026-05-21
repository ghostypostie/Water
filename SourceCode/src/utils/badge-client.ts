/**
 * Supabase client for fetching badge data
 * Uses existing Supabase infrastructure instead of WebSocket
 */

import { BadgeDefinition, UserBadge, ProcessedUser, DeathCard } from '../types/badge';
import { getSupabaseClient } from './supabase';
import { detectClientType, getBadgeUrlForClient, getWaterBadgeId } from '../modules/water-badge';

export class BadgeClient {
    private badges: BadgeDefinition[] = [];
    private users: UserBadge[] = [];
    private deathCards: DeathCard[] = [];
    public list: ProcessedUser[] = [];
    private supabase: any = null;
    public initSent: boolean = false;
    private refreshInterval: ReturnType<typeof setInterval> | null = null;
    private readonly REFRESH_INTERVAL = 60000; // Refresh every 60 seconds

    constructor() {
        // Only initialize in renderer process (browser environment)
        if (typeof window !== 'undefined') {
            this.init();
        } else {
            console.log('[BadgeClient] Skipping initialization in main process');
            this.initSent = true; // Mark as "initialized" to not block
        }
    }

    private async init(): Promise<void> {
        try {
            console.log('[BadgeClient] Initializing Supabase badge client...');
            this.supabase = getSupabaseClient();
            
            // Mark as initialized immediately to not block
            this.initSent = true;
            
            // Fetch all data in background (don't await)
            this.fetchBadges().catch(err => console.error('[BadgeClient] Fetch badges error:', err));
            this.fetchUsers().catch(err => console.error('[BadgeClient] Fetch users error:', err));
            this.fetchDeathCards().catch(err => console.error('[BadgeClient] Fetch death cards error:', err));
            
            // Set up periodic refresh
            this.startPeriodicRefresh();
            
            console.log('[BadgeClient] Initialized (loading data in background)');
        } catch (err) {
            console.error('[BadgeClient] Initialization error:', err);
            this.initSent = true;
        }
    }

    private async fetchBadges(): Promise<void> {
        try {
            if (!this.supabase) {
                console.error('[BadgeClient] ❌ Supabase not initialized!');
                return;
            }

            console.log('[BadgeClient] 🔄 Fetching badge definitions from Supabase...');
            
            const { data, error } = await this.supabase
                .from('badges')
                .select('id, name, image_url, image_url_el, image_url_wv, priority, is_premium, enabled')
                .eq('enabled', true)
                .order('priority', { ascending: false });

            if (error) {
                console.error('[BadgeClient] ❌ Supabase fetch badges error:', error);
                return;
            }

            if (data && data.length > 0) {
                this.badges = data;
                console.log('[BadgeClient] ✅ Loaded', this.badges.length, 'badge definitions:', data.map(b => b.name));
                this.updateList();
            } else {
                console.warn('[BadgeClient] ⚠️ No badges found in database');
                this.badges = [];
            }
        } catch (err) {
            console.error('[BadgeClient] ❌ Fetch badges error:', err);
        }
    }

    private async fetchUsers(): Promise<void> {
        try {
            if (!this.supabase) {
                console.error('[BadgeClient] ❌ Supabase not initialized!');
                return;
            }

            console.log('[BadgeClient] 🔄 Fetching user badges from Supabase...');
            
            const { data, error } = await this.supabase
                .from('user_badges')
                .select('discord_id, display_name, username, badge_ids, death_card_url, hide_water_badge');

            if (error) {
                console.error('[BadgeClient] ❌ Supabase fetch users error:', error);
                return;
            }

            if (data && data.length > 0) {
                this.users = data;
                console.log('[BadgeClient] ✅ Loaded', this.users.length, 'users with badges:', data.map(u => u.display_name || u.username));
                // Update list after fetching users
                this.updateList();
            } else {
                console.warn('[BadgeClient] ⚠️ No users found in database');
                this.users = [];
            }
        } catch (err) {
            console.error('[BadgeClient] ❌ Fetch users error:', err);
        }
    }

    private async fetchDeathCards(): Promise<void> {
        try {
            if (!this.supabase) {
                console.warn('[BadgeClient] Supabase not initialized');
                return;
            }

            console.log('[BadgeClient] Fetching death cards from Supabase...');
            
            const { data, error } = await this.supabase
                .from('death_cards')
                .select('name, url')
                .eq('enabled', true)
                .order('name', { ascending: true });

            if (error) {
                console.error('[BadgeClient] Supabase fetch death cards error:', error);
                return;
            }

            if (data && data.length > 0) {
                this.deathCards = data;
                console.log('[BadgeClient] Loaded', this.deathCards.length, 'death cards');
            } else {
                console.log('[BadgeClient] No death cards found in database');
                this.deathCards = [];
            }
        } catch (err) {
            console.error('[BadgeClient] Fetch death cards error:', err);
        }
    }

    private updateList(): void {
        this.list = [];
        
        if (!this.users || this.users.length === 0) {
            console.warn('[BadgeClient] ⚠️ No users to process');
            return;
        }

        // Find minimum premium priority
        const premiumBadges = this.badges.filter(b => b.is_premium);
        const minPremiumP = premiumBadges.length > 0 
            ? Math.min(...premiumBadges.map(b => b.priority))
            : Infinity;

        this.users.forEach(user => {
            if (!user.display_name) return; // Skip if no display name

            // Get user's badges
            const userBadgeIds = user.badge_ids || [];
            const userBadges = userBadgeIds
                .map(badgeId => this.badges.find(b => b.id === badgeId))
                .filter(badge => badge !== undefined) as BadgeDefinition[];

            // Sort by priority (highest first)
            userBadges.sort((a, b) => b.priority - a.priority);

            // Check if user is premium (has badge with priority >= minimum premium priority)
            const isPremium = userBadges.length > 0 && userBadges[0].priority >= minPremiumP;

            // Skip water badge for users opted out (Supabase-controlled)
            const filteredBadges = user.hide_water_badge
                ? userBadges.filter(b => b.id !== getWaterBadgeId())
                : userBadges;

            // Resolve badge URLs — replace water badge (ID 5) with client-appropriate URL
            const badgeUrls = filteredBadges.map(b => {
                if (b.id === getWaterBadgeId()) {
                    const clientType = detectClientType(user.discord_id);
                    if (clientType) {
                        const url = getBadgeUrlForClient(clientType, b);
                        if (url) return url;
                    }
                }
                return b.image_url;
            });

            this.list.push({
                name: user.display_name,
                uname: user.username,
                badges: badgeUrls,
                deathCard: user.death_card_url,
                isPremium: isPremium
            });
        });

        console.log('[BadgeClient] ✅ Processed', this.list.length, 'users:', this.list.map(u => `${u.name} (${u.badges.length} badges)`));
    }

    private startPeriodicRefresh(): void {
        // Refresh badge data periodically
        this.refreshInterval = setInterval(async () => {
            console.log('[BadgeClient] Periodic refresh...');
            await Promise.all([
                this.fetchBadges(),
                this.fetchUsers(),
                this.fetchDeathCards()
            ]);
            this.updateList();
        }, this.REFRESH_INTERVAL);
    }

    public getList(): ProcessedUser[] {
        return this.list;
    }

    public getBadges(): BadgeDefinition[] {
        return this.badges;
    }

    public getDeathCards(): DeathCard[] {
        return this.deathCards;
    }

    public async refresh(): Promise<void> {
        console.log('[BadgeClient] Manual refresh requested');
        await Promise.all([
            this.fetchBadges(),
            this.fetchUsers(),
            this.fetchDeathCards()
        ]);
        this.updateList();
    }

    public disconnect(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.initSent = false;
        console.log('[BadgeClient] Disconnected');
    }
}

// Singleton instance
let badgeClientInstance: BadgeClient | null = null;

export function getBadgeClient(): BadgeClient {
    if (!badgeClientInstance) {
        badgeClientInstance = new BadgeClient();
    }
    return badgeClientInstance;
}
