/**
 * Type definitions for the Badge system
 */

/** Badge definition received from server */
export interface BadgeDefinition {
    id: number;
    n: string;           // filename
    url: string;         // full image URL
    p: number;           // priority (higher = more prominent)
    pr?: boolean;        // premium flag
}

/** Processed user entry with resolved badge URLs */
export interface ProcessedBadgeUser {
    name: string;           // display_name (for in-game matching)
    uname: string;          // username (for social hub matching)
    badges: string[];       // Full image URLs, sorted by priority desc
    deathCard: string | null;
    isPremium: boolean;
}

/** Death card from server */
export interface DeathCard {
    name: string;
    url: string;
}
