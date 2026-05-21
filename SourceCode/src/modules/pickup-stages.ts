/**
 * PUG Stage Persistence & Router
 *
 * Adds two things that didn't exist:
 *  1. localStorage persistence → close/reopen Water, resume at the same stage
 *  2. Stage router → dispatches to the correct overlay from pickup-overlays.ts
 *
 * No overlay code here — that's all in pickup-overlays.ts.
 */

import { createLogger } from '../utils/logger';
import {
    MatchStage,
    PersistentMatchState,
    stageFromState,
} from './pickup-types';
import OverlayManager from './pickup-overlays';
import type PickupSystem from './pickup';

const logger = createLogger('PugStages');

const STORAGE_KEY = 'pug_stage';
const MATCH_CACHE_KEY = 'pug_match_cache';
const TTL = 3_600_000; // 1 hour

// ─── PERSISTENCE ───────────────────────────────────────────────────

export function saveStage(stage: MatchStage, match: any) {
    try {
        const state: PersistentMatchState = {
            matchId: match?.match_id || '',
            stage,
            guildId: match?.guild_id || '',
            queueName: match?.queue_name || '',
            lastUpdated: Date.now(),
            expiresAt: Date.now() + TTL,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        if (match) {
            localStorage.setItem(MATCH_CACHE_KEY, JSON.stringify(match));
        }
        logger.log('Stage saved:', stage);
    } catch {}
}

export function loadStage(): {
    stage: MatchStage | null;
    match: any;
} {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { stage: null, match: null };

        const state: PersistentMatchState = JSON.parse(raw);
        if (state.expiresAt < Date.now()) {
            clearStage();
            return { stage: null, match: null };
        }

        const matchRaw = localStorage.getItem(MATCH_CACHE_KEY);
        return {
            stage: state.stage,
            match: matchRaw ? JSON.parse(matchRaw) : null,
        };
    } catch {
        return { stage: null, match: null };
    }
}

export function clearStage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(MATCH_CACHE_KEY);
    } catch {}
}

// ─── STAGE ROUTER ──────────────────────────────────────────────────

/**
 * Route to the correct overlay for the current match stage.
 * Uses the existing OverlayManager methods from pickup-overlays.ts.
 *
 * Persists the stage to localStorage so the user can close Water
 * and resume at the same stage later.
 */
export function routeToStage(
    stage: MatchStage,
    match: any,
    overlays: OverlayManager
): boolean {
    saveStage(stage, match);

    switch (stage) {
        case MatchStage.DRAFT:
            logger.log('→ DRAFT overlay');
            overlays.showDraftOverlay(match);
            return true;

        case MatchStage.IN_GAME:
            logger.log('→ IN_GAME overlay');
            overlays.showMatchInProgressOverlay(match);
            return true;

        case MatchStage.REPORT:
            logger.log('→ REPORT overlay');
            overlays.showReportOverlay(match);
            return true;

        case MatchStage.RATING_CHANGES:
            logger.log('→ RATING_CHANGES overlay');
            overlays.showRatingChangesOverlay(match);
            return true;

        case MatchStage.CHECK_IN:
            logger.log('→ CHECK_IN — handled by pickup.ts polling');
            return false; // pickup.ts handles this via its existing polling

        default:
            logger.log('Stage', stage, '— no overlay needed');
            return false;
    }
}

/**
 * Try to resume from a saved stage on startup.
 * Returns true if a stage was restored, false if nothing saved.
 */
export function tryResumeStage(
    overlays: OverlayManager
): boolean {
    const { stage, match } = loadStage();
    if (!stage || !match) return false;

    // Don't resume stale state (>5 min since last update)
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        const state: PersistentMatchState = JSON.parse(raw);
        if (Date.now() - state.lastUpdated > 300_000) {
            logger.log('Saved stage is stale (>5 min), clearing');
            clearStage();
            return false;
        }
    }

    logger.log('Resuming stage:', stage, 'match:', match.match_id);
    return routeToStage(stage, match, overlays);
}
