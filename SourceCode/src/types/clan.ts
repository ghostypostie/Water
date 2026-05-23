/**
 * Type definitions for Custom Clan Tags system
 */

export interface ClanData {
    /** Clan tag name (case-insensitive matching) */
    name: string;
    
    /** CSS styles to apply to the clan tag */
    style: Record<string, string>;
    
    /** Optional HTML to inject after the clan tag (e.g., icons, badges) */
    addonHTML?: string;
}

