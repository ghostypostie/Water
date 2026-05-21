import Module from '../module';

export enum MatchStage {
    QUEUE = 'queue',
    CHECK_IN = 'check_in',
    DRAFT = 'draft',
    IN_GAME = 'in_game',
    REPORT = 'report',
    RATING_CHANGES = 'rating_changes'
}

export interface PersistentMatchState {
    matchId: string;
    stage: MatchStage;
    guildId: string;
    queueName: string;
    lastUpdated: number;
    expiresAt: number;
}

export interface ScoreReport {
    matchId: string;
    reporter_discord_id: string;
    winning_team: 'alpha' | 'beta';
}

export const STAGE_NAMES: Record<number, string> = {
    0: 'Queue',
    1: 'Check-in',
    2: 'Draft Phase',
    3: 'Match In Progress',
    4: 'Match Complete',
    5: 'Rating Changes'
};

export const STAGE_MAP: Record<number, MatchStage> = {
    0: MatchStage.QUEUE,
    1: MatchStage.CHECK_IN,
    2: MatchStage.DRAFT,
    3: MatchStage.IN_GAME,
    4: MatchStage.REPORT,
    5: MatchStage.RATING_CHANGES,
};

export function stageFromState(stateNumber: number): MatchStage {
    return STAGE_MAP[stateNumber] || MatchStage.QUEUE;
}

export interface RawLobby {
    gameID: string;
    region: string;
    gamemode: string;
    gamemodeIndex: number;
    map: string;
    playerCount: number;
    playerLimit: number;
    remainingTime: number;
    isCustom: boolean;
    isOfficialCustom: boolean;
    passesFilter: boolean;
    rejectReason?: string;
}
