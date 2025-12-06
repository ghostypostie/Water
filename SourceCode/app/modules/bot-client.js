"use strict";

const WebSocket = require("ws");
const axios = require("axios");
const crypto = require("crypto");

class BotClient {
    /**
     * @param {import("electron-store")} config
     */
    constructor(config) {
        this.config = config;
        this.ws = null;
        this.clientId = this.generateClientId();
        this.playerName = "Unknown";
        this.accessToken = null;
        this.botHost = "127.0.0.1";
        this.botPort = 8080;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.reconnectTimeout = null;
        this.heartbeatInterval = null;
    }

    generateClientId() {
        // Node 12 compatible UUID v4 generation
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    isEnabled() {
        return this.config.get("waterBotHelper", true);
    }

    start() {
        if (!this.isEnabled()) {
            console.log("[BotClient] Disabled via settings");
            return;
        }
        this.connect();
    }

    connect() {
        if (this.ws) return;

        try {
            console.log(`[BotClient] Connecting to ws://${this.botHost}:${this.botPort}`);
            this.ws = new WebSocket(`ws://${this.botHost}:${this.botPort}`);

            this.ws.on("open", () => {
                console.log("[BotClient] ✅ Connected to Water Bot");
                this.reconnectDelay = 1000;
                this.identify();
                this.startHeartbeat();
            });

            this.ws.on("message", (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.handleMessage(msg);
                } catch (e) {
                    console.error("[BotClient] Message parse error:", e);
                }
            });

            this.ws.on("close", () => {
                console.log("[BotClient] ❌ Disconnected from Water Bot");
                this.ws = null;
                this.stopHeartbeat();
                if (this.isEnabled()) {
                    this.scheduleReconnect();
                }
            });

            this.ws.on("error", (err) => {
                console.error("[BotClient] WebSocket error:", err.message);
            });

        } catch (e) {
            console.error("[BotClient] Connection error:", e);
            this.scheduleReconnect();
        }
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        console.log("[BotClient] Disconnected");
    }

    scheduleReconnect() {
        if (this.reconnectTimeout) return;

        console.log(`[BotClient] Reconnecting in ${this.reconnectDelay / 1000}s...`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, this.reconnectDelay);

        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }

    identify() {
        this.send({
            type: "identify",
            clientId: this.clientId,
            playerName: this.playerName
        });
    }

    startHeartbeat() {
        this.stopHeartbeat();
        // Respond to pings; client doesn't initiate pings in this design
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    handleMessage(msg) {
        switch (msg.type) {
            case "identified":
                console.log(`[BotClient] Identified as ${msg.clientId}`);
                break;

            case "ping":
                this.send({ type: "pong" });
                break;

            case "request":
                this.handleRequest(msg);
                break;

            default:
                console.warn("[BotClient] Unknown message type:", msg.type);
        }
    }

    async handleRequest(msg) {
        const { requestId, command, params } = msg;

        try {
            let data = null;

            switch (command) {
                case "profile":
                    data = await this.fetchProfile(params.target);
                    break;
                case "clan":
                    data = await this.fetchClan(params.target);
                    break;
                case "leaderboard":
                    data = await this.fetchLeaderboard(params);
                    break;
                default:
                    throw new Error(`Unknown command: ${command}`);
            }

            this.send({
                type: "response",
                requestId,
                data,
                status: "ok"
            });

        } catch (e) {
            console.error(`[BotClient] Request error (${command}):`, e.message);
            this.send({
                type: "response",
                requestId,
                error: e.message,
                status: "error"
            });
        }
    }

    async fetchProfile(username) {
        const response = await axios.get(`https://api.krunker.io/user?name=${encodeURIComponent(username)}`, {
            timeout: 5000
        });
        return response.data;
    }

    async fetchClan(clanName) {
        const response = await axios.get(`https://api.krunker.io/clan?name=${encodeURIComponent(clanName)}`, {
            timeout: 5000
        });
        return response.data;
    }

    async fetchLeaderboard(params) {
        const { type, offset = 0, region, season } = params;

        if (type === "ranked") {
            if (!this.accessToken) {
                return { error: "User must be logged in to view ranked leaderboard" };
            }

            // Fetch ranked leaderboard using access token
            try {
                const response = await axios.get(
                    `https://api.krunker.io/leaderboards/rankings/season/${season}/region/${region}?limit=50&offset=${offset}`,
                    {
                        headers: {
                            "Authorization": `Bearer ${this.accessToken}`
                        },
                        timeout: 5000
                    }
                );
                return response.data;
            } catch (e) {
                if (e.response?.status === 401) {
                    return { error: "User must be logged in to view ranked leaderboard" };
                }
                throw e;
            }
        } else {
            // Regular leaderboard
            const response = await axios.get(`https://api.krunker.io/leaderboard?type=${type}`, {
                timeout: 5000
            });
            return response.data;
        }
    }

    updatePlayerName(name) {
        this.playerName = name;
    }

    updateToken(token) {
        this.accessToken = token;
        console.log("[BotClient] 🔑 Access token updated");
    }

    // Called when setting is toggled
    onSettingChanged(enabled) {
        if (enabled) {
            console.log("[BotClient] Setting enabled, connecting...");
            this.start();
        } else {
            console.log("[BotClient] Setting disabled, disconnecting...");
            this.disconnect();
        }
    }
}

module.exports = BotClient;
