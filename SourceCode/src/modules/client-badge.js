"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const checkbox_1 = __importDefault(require("../options/checkbox"));
const supabase_1 = require("../utils/supabase");
class ClientBadge extends module_1.default {
    name = 'Client Badge';
    id = 'clientBadge';
    contexts = [
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadEnd,
        }
    ];
    options = [
        new checkbox_1.default(this, {
            name: 'Show Client Badges',
            id: 'enabled',
            description: 'Show badges next to Water Client users in the scoreboard',
            defaultValue: true,
        }),
        new checkbox_1.default(this, {
            name: 'Broadcast Presence',
            id: 'sendIdentifier',
            description: 'Let other Water users know you\'re in the game (uses real-time presence)',
            defaultValue: true,
        }),
        new checkbox_1.default(this, {
            name: 'Show Own Badge',
            id: 'showOwnBadge',
            description: 'Show the Water badge on your own username',
            defaultValue: false,
        }),
    ];
    detectedPlayers = new Set();
    scoreboardObserver = null;
    ownUsername = null;
    supabase;
    channel = null;
    currentGameId = null;
    constructor() {
        super();
        this.supabase = (0, supabase_1.getSupabaseClient)();
    }
    renderer() {
        setTimeout(() => {
            this.captureOwnUsername();
            this.startScoreboardMonitoring();
            this.detectGameIdAndJoin();
        }, 3000);
        // Check for game ID changes (switching lobbies)
        setInterval(() => {
            this.detectGameIdAndJoin();
        }, 5000);
    }
    captureOwnUsername() {
        try {
            const usernameElement = document.querySelector('.menuUsername');
            if (usernameElement) {
                this.ownUsername = usernameElement.textContent?.trim() || null;
            }
        }
        catch (e) {
            console.error('[ClientBadge] Failed to capture own username:', e);
        }
    }
    detectGameIdAndJoin() {
        if (!this.config.get('sendIdentifier', true))
            return;
        try {
            // Get game ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const gameId = urlParams.get('game');
            if (gameId && gameId !== this.currentGameId) {
                // New game, leave old channel and join new one
                if (this.channel) {
                    this.leaveChannel();
                }
                this.currentGameId = gameId;
                this.joinGameChannel(gameId);
            }
            else if (!gameId && this.channel) {
                // Left game, clean up
                this.leaveChannel();
                this.currentGameId = null;
                this.detectedPlayers.clear();
                this.updateScoreboard();
            }
        }
        catch (e) {
            console.error('[ClientBadge] Failed to detect game ID:', e);
        }
    }
    async joinGameChannel(gameId) {
        if (!this.ownUsername) {
            this.captureOwnUsername();
        }
        console.log('[ClientBadge] Joining game channel:', gameId, 'as', this.ownUsername);
        try {
            this.channel = this.supabase.channel(`game:${gameId}`, {
                config: {
                    presence: {
                        key: this.ownUsername || 'Unknown',
                    },
                },
            });
            this.channel
                .on('presence', { event: 'sync' }, () => {
                const state = this.channel.presenceState();
                this.detectedPlayers.clear();
                console.log('[ClientBadge] Presence sync, state:', state);
                // Add all present users
                Object.keys(state).forEach(username => {
                    if (username !== this.ownUsername) {
                        this.detectedPlayers.add(username);
                        console.log('[ClientBadge] Detected Water user:', username);
                    }
                });
                console.log('[ClientBadge] Total detected players:', this.detectedPlayers.size);
                this.updateScoreboard();
            })
                .on('presence', { event: 'join' }, ({ key }) => {
                console.log('[ClientBadge] User joined:', key);
                if (key !== this.ownUsername) {
                    this.detectedPlayers.add(key);
                    this.updateScoreboard();
                }
            })
                .on('presence', { event: 'leave' }, ({ key }) => {
                console.log('[ClientBadge] User left:', key);
                this.detectedPlayers.delete(key);
                this.updateScoreboard();
            })
                .subscribe(async (status) => {
                console.log('[ClientBadge] Channel status:', status);
                if (status === 'SUBSCRIBED') {
                    await this.channel.track({
                        username: this.ownUsername,
                        online_at: new Date().toISOString(),
                    });
                    console.log('[ClientBadge] Presence tracked');
                }
            });
        }
        catch (e) {
            console.error('[ClientBadge] Failed to join game channel:', e);
        }
    }
    leaveChannel() {
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }
    }
    startScoreboardMonitoring() {
        const leaderboard = document.getElementById('leaderboard');
        if (!leaderboard) {
            setTimeout(() => this.startScoreboardMonitoring(), 1000);
            return;
        }
        this.scoreboardObserver = new MutationObserver(() => {
            this.updateScoreboard();
        });
        this.scoreboardObserver.observe(leaderboard, {
            childList: true,
            subtree: true,
        });
    }
    updateScoreboard() {
        if (!this.config.get('enabled', true))
            return;
        try {
            const showOwnBadge = this.config.get('showOwnBadge', false);
            const playerEntries = document.querySelectorAll('.leaderNameM, .leaderNameF, .leaderName');
            console.log('[ClientBadge] Updating scoreboard, found', playerEntries.length, 'player entries');
            console.log('[ClientBadge] Detected players:', Array.from(this.detectedPlayers));
            playerEntries.forEach((entry) => {
                const username = entry.textContent?.trim();
                if (!username)
                    return;
                const isDetected = this.detectedPlayers.has(username);
                const isOwnName = this.ownUsername && username === this.ownUsername;
                console.log('[ClientBadge] Checking player:', username, 'detected:', isDetected, 'isOwn:', isOwnName);
                if (isDetected || (showOwnBadge && isOwnName)) {
                    if (!entry.querySelector('.client-badge')) {
                        console.log('[ClientBadge] Adding badge to:', username);
                        this.addBadge(entry);
                    }
                }
                else {
                    // Remove badge if player left
                    const existingBadge = entry.querySelector('.client-badge');
                    if (existingBadge) {
                        existingBadge.remove();
                    }
                }
            });
        }
        catch (e) {
            console.error('[ClientBadge] Error updating scoreboard:', e);
        }
    }
    addBadge(element) {
        try {
            const badge = document.createElement('img');
            badge.className = 'client-badge';
            badge.src = 'client-resource://assets/img/logo.png';
            badge.style.cssText = `
                width: 16px;
                height: 16px;
                margin-right: 4px;
                vertical-align: middle;
                display: inline-block;
                border-radius: 3px;
                background: linear-gradient(135deg, #fe8bbb 0%, #ff6ba8 100%);
                padding: 2px;
                box-shadow: 0 0 8px rgba(254, 139, 187, 0.4);
            `;
            badge.title = 'Water Client User';
            element.insertBefore(badge, element.firstChild);
        }
        catch (e) {
            console.error('[ClientBadge] Error adding badge:', e);
        }
    }
    cleanup() {
        this.leaveChannel();
        if (this.scoreboardObserver) {
            this.scoreboardObserver.disconnect();
        }
        this.detectedPlayers.clear();
    }
}
exports.default = ClientBadge;
