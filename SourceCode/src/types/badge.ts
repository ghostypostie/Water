/**
 * Type definitions for Custom Badges system
 */

export interface BadgeDefinition {
    /** Unique badge identifier */
    id: number;
    
    /** Badge name/filename */
    name: string;
    
    /** Badge image URL (generic fallback) */
    image_url: string;

    /** Badge image URL for Electron users (pink) */
    image_url_el?: string;

    /** Badge image URL for WebView users (green) */
    image_url_wv?: string;
    
    /** Priority (higher = more important, displayed first) */
    priority: number;
    
    /** Is this a premium badge? */
    is_premium: boolean;
    
    /** Is this badge enabled? */
    enabled: boolean;
}

export interface UserBadge {
    /** Discord user ID */
    discord_id: string;
    
    /** Display name in game */
    display_name: string;
    
    /** Actual username */
    username: string;
    
    /** Array of badge IDs assigned to this user */
    badge_ids: number[];
    
    /** If true, water badge (ID 5) is hidden on this user */
    hide_water_badge?: boolean;
    
    /** Custom death card URL (optional, premium only) */
    death_card_url?: string;
}

export interface ProcessedUser {
    /** Display name */
    name: string;
    
    /** Username */
    uname: string;
    
    /** Sorted badge URLs (highest priority first) */
    badges: string[];
    
    /** Custom death card URL */
    deathCard?: string;
    
    /** Has premium badge */
    isPremium: boolean;
}

export interface DeathCard {
    /** Death card name */
    name: string;
    
    /** Death card image URL */
    url: string;
}
