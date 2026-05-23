import Module from "../module";
import { Context, RunAt } from "../context";
import { createLogger } from "../utils/logger";
import {
  MatchStage,
  PersistentMatchState,
  stageFromState,
} from "./pickup-types";
import OverlayManager from "./pickup-overlays";
import TabRenderer from "./pickup-tabs";
import PugLobbyFinder from "./pickup-pug-finder";
import { getEnv } from "../utils/env";

const logger = createLogger("Pickup");

export default class PickupSystem extends Module {
  name = "Pickup System";
  id = "pickup";
  options = [];

  contexts = [{ context: Context.Game, runAt: RunAt.LoadEnd }];

  activeTab: string = "Home";
  selectedServer: string = "";
  isLoadingTab: boolean = false;
  currentRenderController: AbortController | null = null;
  isApiOnline = false;

  supabase: any = null;
  realtimeChannel: any = null;
  pollingInterval: any = null;
  serverData: Map<string, any> = new Map();
  queuePreferences: Map<string, string[]> = new Map();

  currentLeaderboardPage: number = 1;
  currentGameHistoryPage: number = 1;

  overlays: OverlayManager;
  tabs: TabRenderer;
  pugFinder: PugLobbyFinder;

  get waterBotApi(): string {
    return getEnv().WATER_BOT_API || this.config.get(
      "waterBotAPI",
      "",
    ) as string;
  }

  constructor() {
    super();
    this.overlays = new OverlayManager(this);
    this.tabs = new TabRenderer(this);
    this.pugFinder = new PugLobbyFinder();
  }

  private getUsernameFromGame(): string | null {
    // Try to get username from various game UI elements
    try {
      // Try to get from profile/settings area
      const profileName = document.querySelector('.profileName') as HTMLElement;
      if (profileName && profileName.textContent) {
        return profileName.textContent.trim();
      }
      
      // Try to get from leaderboard (your own name)
      const leaderNames = document.querySelectorAll('.leaderNameM, .leaderNameF, .leaderName');
      for (const nameEl of leaderNames) {
        const el = nameEl as HTMLElement;
        if (el && el.textContent && el.style.color === 'rgb(255, 255, 255)') {
          return el.textContent.trim();
        }
      }
      
      // Try to get from social tab
      const socialName = document.querySelector('.socialName') as HTMLElement;
      if (socialName && socialName.textContent) {
        return socialName.textContent.trim();
      }
      
      // Try to get from any element with your username
      const allNameElements = document.querySelectorAll('[class*="Name"]');
      for (const el of allNameElements) {
        const element = el as HTMLElement;
        if (element && element.textContent && element.textContent.trim().length > 0 && element.textContent.trim().length < 20) {
          const text = element.textContent.trim();
          // Skip common UI text
          if (!text.includes('Player') && !text.includes('Name') && !text.includes('User') && 
              !text.includes('Settings') && !text.includes('Profile') && text.length > 2) {
            return text;
          }
        }
      }
    } catch (e) {
      console.log('[Pickup] Error getting username from game:', e);
    }
    return null;
  }

  getUsername(): string {
    // Try localStorage first
    let username = localStorage.getItem('water_username');
    if (username && username !== 'Unknown') {
      return username;
    }
    
    // Try to get from game UI
    const gameUsername = this.getUsernameFromGame();
    if (gameUsername) {
      // Cache it for future use
      localStorage.setItem('water_username', gameUsername);
      return gameUsername;
    }
    
    // Try other localStorage keys
    const altUsername = localStorage.getItem('username') || localStorage.getItem('player_name') || localStorage.getItem('user_name');
    if (altUsername) {
      localStorage.setItem('water_username', altUsername);
      return altUsername;
    }
    
    // Final fallback
    return 'Water User';
  }

  init() {
    if (this.manager && this.manager.loaded) {
      const storeModule = this.manager.loaded.find(
        (m: any) => m.id === "store",
      );
      if (storeModule) {
        this.supabase = (storeModule as any).supabase;
      }
    }

    this.loadQueuePreferences();

    const savedServer = localStorage.getItem("pickup_selected_server");
    if (savedServer) {
      this.selectedServer = savedServer;
    }

    this.injectPickupStyles();
    this.checkApiHealth();

    const savedState = this.loadMatchState();
    if (savedState && savedState.expiresAt > Date.now()) {
      if (Date.now() - savedState.lastUpdated > 300_000) {
        this.refreshMatchState(savedState);
      } else {
        this.resumeFromStage(savedState);
      }
    }
  }

  private async checkApiHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.waterBotApi}/health`, {
        signal: controller.signal,
        headers: {
          'ngrok-skip-browser-warning': '69420',
          'User-Agent': 'Water'
        }
      });
      clearTimeout(timeoutId);
      this.isApiOnline = res.ok;
      logger.log("API health check:", this.isApiOnline ? "online" : "offline");
    } catch (err) {
      this.isApiOnline = false;
      logger.log("API health check: offline (error:", err, ")");
    }
  }

  injectPickupStyles() {
    if (document.getElementById("pickup-styles")) return;

    const styleSheet = document.createElement("style");
    styleSheet.id = "pickup-styles";
    styleSheet.textContent = `
            .pickup-scrollbar::-webkit-scrollbar { width: 6px; }
            .pickup-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
            .pickup-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,105,180,0.4); border-radius: 3px; }
            .pickup-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,105,180,0.6); }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            #pickupTabHeader > div { transition: background 0.15s, color 0.15s, border-bottom 0.15s; }
            #pickupContent > div { animation: fadeIn 0.15s ease-out; }
        `;
    document.head.appendChild(styleSheet);
  }

  renderer() {
    logger.log("Pickup System initialized");
  }

  loadQueuePreferences() {
    try {
      const saved = localStorage.getItem("pickup_queue_preferences");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.queuePreferences = new Map(Object.entries(parsed));
      }
    } catch (e) {
      logger.log("Error loading queue preferences:", e);
    }
  }

  saveQueuePreferences() {
    try {
      const obj = Object.fromEntries(this.queuePreferences);
      localStorage.setItem("pickup_queue_preferences", JSON.stringify(obj));
    } catch (e) {
      logger.log("Error saving queue preferences:", e);
    }
  }

  getQueuePreferences(guildId: string): string[] {
    return this.queuePreferences.get(guildId) || [];
  }

  setQueuePreferences(guildId: string, queueNames: string[]) {
    this.queuePreferences.set(guildId, queueNames);
    this.saveQueuePreferences();
  }

  async openPickupWindow() {
    logger.log("Opening pickup window");

    // Gateway: Discord must be linked to use PUGs
    const linkedId = localStorage.getItem("discord_id");
    if (!linkedId) {
      const store = this.manager?.loaded?.find((m: any) => m.id === "store");
      if (store && typeof (store as any).checkLinkStatus === "function") {
        await (store as any).checkLinkStatus();
      }
      if (!localStorage.getItem("discord_id")) {
        if (store && typeof (store as any).handleLinkButtonClick === "function") {
          (store as any).handleLinkButtonClick();
        }
        return;
      }
    }

    const windowHolder = document.getElementById("windowHolder");
    const menuWindow = document.getElementById("menuWindow");
    if (!windowHolder || !menuWindow) return;

    windowHolder.className = "popupWin";
    menuWindow.style.width = "1200px";
    menuWindow.className = "dark";
    menuWindow.innerHTML = "";

    this.injectPickupStyles();

    // Add click-outside handler to close window
    const closeWindowHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Close if clicking on windowHolder background (not on menuWindow)
      if (target.id === "windowHolder") {
        windowHolder.style.display = "none";
        windowHolder.removeEventListener("click", closeWindowHandler);
        this.cleanupRealtimeSubscription();
        logger.log("Pickup window closed by clicking outside");
      }
    };
    
    // Add the click handler
    windowHolder.addEventListener("click", closeWindowHandler);

    const serverBar = document.createElement("div");
    serverBar.id = "pickupServerBar";
    serverBar.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:rgba(20,20,30,0.9);border-bottom:2px solid rgba(255,105,180,0.3);";
    serverBar.innerHTML = `
            <div style="display:flex;align-items:center;gap:16px;">
                <span style="color:#ff69b4;font-weight:600;font-size:13px;letter-spacing:0.5px;">SERVER</span>
                <select id="pickupServerSelect" style="background:rgba(0,0,0,0.5);border:2px solid rgba(255,105,180,0.4);border-radius:6px;color:#fff;padding:9px 14px;font-size:13px;cursor:pointer;outline:none;min-width:240px;">
                    <option value="">Loading servers...</option>
                </select>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:6px;height:6px;border-radius:50%;background:#ff6464;" id="pickupStatusIndicator"></div>
                <span style="color:rgba(255,255,255,0.6);font-size:12px;" id="pickupServerStatus">Not connected</span>
            </div>
        `;
    menuWindow.appendChild(serverBar);

    setTimeout(async () => {
      await this.loadServersIntoDropdown();
    }, 0);

    setTimeout(() => {
      const serverSelect = document.getElementById(
        "pickupServerSelect",
      ) as HTMLSelectElement;
      if (serverSelect) {
        serverSelect.addEventListener("change", () => {
          this.selectedServer = serverSelect.value;
          if (this.selectedServer) {
            localStorage.setItem("pickup_selected_server", this.selectedServer);
          } else {
            localStorage.removeItem("pickup_selected_server");
          }
          this.switchTab(this.activeTab);
        });
      }
    }, 0);

    const header = document.createElement("div");
    header.id = "pickupTabHeader";
    header.style.cssText =
      "display:flex;background:rgba(25,20,30,0.8);border-bottom:2px solid rgba(255,105,180,0.3);";

    const tabs = [
      "Home",
      "Leaderboard",
      "Rating Changes",
      "Rank",
      "Game History",
      "Settings",
    ];

    tabs.forEach((tabName) => {
      const tab = document.createElement("div");
      tab.textContent = tabName;
      const isActive = tabName === this.activeTab;
      tab.style.cssText = `padding:12px 18px;cursor:pointer;border-right:1px solid rgba(255,255,255,0.06);font-size:13px;font-weight:${isActive ? "600" : "500"};flex:1;text-align:center;color:${isActive ? "#ff69b4" : "rgba(255,255,255,0.7)"};background:${isActive ? "rgba(255,105,180,0.15)" : "transparent"};border-bottom:${isActive ? "2px solid #ff69b4" : "2px solid transparent"};`;

      tab.onmouseenter = () => {
        if (tabName !== this.activeTab) {
          tab.style.background = "rgba(255,105,180,0.08)";
          tab.style.color = "#fff";
        }
      };
      tab.onmouseleave = () => {
        if (tabName !== this.activeTab) {
          tab.style.background = "transparent";
          tab.style.color = "rgba(255,255,255,0.7)";
        }
      };
      tab.onclick = () => {
        this.activeTab = tabName;
        this.updateTabHeader(tabName);
        this.switchTab(tabName);
      };
      header.appendChild(tab);
    });

    menuWindow.appendChild(header);

    const content = document.createElement("div");
    content.id = "pickupContent";
    content.style.cssText =
      "padding:20px;height:580px;overflow:hidden;background:rgba(15,15,20,0.7);display:flex;flex-direction:column;";
    menuWindow.appendChild(content);

    this.renderHomeTab();
    windowHolder.style.display = "";
  }

  async loadServersIntoDropdown() {
    const serverSelect = document.getElementById(
      "pickupServerSelect",
    ) as HTMLSelectElement;
    const statusText = document.getElementById("pickupServerStatus");
    const statusIndicator = document.getElementById("pickupStatusIndicator");

    if (!serverSelect) return;

    try {
      if (statusText) statusText.textContent = "Loading...";

      const discordId = localStorage.getItem("discord_id");
      let url = `${this.waterBotApi}/api/servers`;
      if (discordId) url += `?discord_id=${discordId}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "69420",
          "User-Agent": "Water",
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();

      if (!result.success || !result.servers || result.servers.length === 0) {
        serverSelect.innerHTML =
          '<option value="">No servers available</option>';
        if (statusText) statusText.textContent = "No servers found";
        if (statusIndicator) statusIndicator.style.background = "#ffa500";
        return;
      }

      serverSelect.innerHTML = '<option value="">Select a server...</option>';
      result.servers.forEach((server: any) => {
        const option = document.createElement("option");
        option.value = server.guild_id;
        option.textContent = `${server.guild_name}${server.is_centralized ? " (Global)" : ""}`;
        option.dataset.centralized = server.is_centralized;
        serverSelect.appendChild(option);
        this.serverData.set(server.guild_id, server);
        if (
          !this.queuePreferences.has(server.guild_id) &&
          server.available_queues
        ) {
          const allQueueNames = server.available_queues.map((q: any) => q.name);
          this.setQueuePreferences(server.guild_id, allQueueNames);
        }
      });

      if (statusText)
        statusText.textContent = `${result.servers.length} server${result.servers.length !== 1 ? "s" : ""} available`;
      if (statusIndicator) statusIndicator.style.background = "#00ff00";

      if (this.selectedServer) {
        const serverExists = result.servers.some(
          (s: any) => s.guild_id === this.selectedServer,
        );
        if (
          serverExists &&
          serverSelect.querySelector(`option[value="${this.selectedServer}"]`)
        ) {
          serverSelect.value = this.selectedServer;
        } else {
          this.selectedServer = "";
          localStorage.removeItem("pickup_selected_server");
        }
      }
    } catch (e) {
      logger.log("Exception loading servers:", e);
      serverSelect.innerHTML =
        '<option value="">Error loading servers</option>';
      if (statusText) {
        statusText.textContent = "Connection failed";
        statusText.style.color = "#ff6464";
      }
      if (statusIndicator) statusIndicator.style.background = "#ff6464";
      this.showNotification(
        "Cannot connect to Water Bot. Make sure it is running!",
        "error",
      );
    }
  }

  updateTabHeader(activeTab: string) {
    const header = document.getElementById("pickupTabHeader");
    if (!header) return;
    const tabs = [
      "Home",
      "Leaderboard",
      "Rating Changes",
      "Rank",
      "Game History",
      "Settings",
    ];
    header.querySelectorAll("div").forEach((t, i) => {
      const el = t as HTMLElement;
      const isActive = tabs[i] === activeTab;
      el.style.background = isActive ? "rgba(255,105,180,0.15)" : "transparent";
      el.style.color = isActive ? "#ff69b4" : "rgba(255,255,255,0.7)";
      el.style.fontWeight = isActive ? "600" : "500";
      el.style.borderBottom = isActive
        ? "2px solid #ff69b4"
        : "2px solid transparent";
    });
  }

  switchTab(tabName: string) {
    this.activeTab = tabName;
    this.updateTabHeader(tabName);

    if (this.currentRenderController) {
      this.currentRenderController.abort();
      this.currentRenderController = null;
    }

    // Clean up subscriptions when leaving Home tab
    if (tabName !== "Home") {
      this.cleanupRealtimeSubscription();
    }

    const content = document.getElementById("pickupContent");
    if (!content) return;
    content.innerHTML = "";

    switch (tabName) {
      case "Home":
        this.renderHomeTab();
        break;
      case "Leaderboard":
        this.tabs.renderLeaderboardTab();
        break;
      case "Rating Changes":
        this.tabs.renderRatingChangesTab();
        break;
      case "Rank":
        this.tabs.renderRankTab();
        break;
      case "Game History":
        this.tabs.renderGameHistoryTab();
        break;
      case "Settings":
        this.tabs.renderSettingsTab();
        break;
      default:
        if (!this.selectedServer) {
          content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">${tabName}</h3><p style="font-size:13px;margin:0;">Select a server to view ${tabName.toLowerCase()}</p></div>`;
        } else {
          content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">${tabName}</h3><p style="font-size:14px;margin:0 0 24px 0;color:rgba(255,255,255,0.5);">Coming Soon</p></div>`;
        }
    }
  }

  renderHomeTab() {
    this.tabs.renderHomeTab();
    // Setup realtime subscription or polling for queue updates
    this.setupRealtimeSubscription();
  }
  renderMatchInProgress(match: any) {
    this.tabs.renderMatchInProgress(match);
  }

  async joinQueue() {
    const discordId = localStorage.getItem("discord_id");
    const clientId = localStorage.getItem("water_client_id");
    const username = this.getUsername();

    if (!discordId && !clientId) {
      this.showNotification("Please link your Discord account first", "error");
      return;
    }

    const queuePreferences = this.getQueuePreferences(this.selectedServer);
    if (queuePreferences.length === 0) {
      this.showNotification(
        "Please select at least one queue in Settings",
        "error",
      );
      return;
    }

    try {
      const response = await fetch(`${this.waterBotApi}/api/queue/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
          "User-Agent": "Water",
        },
        body: JSON.stringify({
          guild_id: this.selectedServer,
          discord_id: discordId,
          client_id: clientId,
          username,
          queue_preferences: queuePreferences,
        }),
      });

      const result = await response.json();
      if (result.success) {
        this.showNotification(
          `Joined ${result.queues?.length || queuePreferences.length} queue(s)!`,
          "success",
        );
        this.renderHomeTab();
      } else {
        this.showNotification(result.error || "Failed to join queue", "error");
      }
    } catch (e) {
      logger.log("Error joining queue:", e);
      this.showNotification("Failed to join queue", "error");
    }
  }

  async leaveQueue(queueName?: string) {
    const discordId = localStorage.getItem("discord_id");
    const clientId = localStorage.getItem("water_client_id");
    if (!discordId && !clientId) return;

    try {
      const body: any = {
        guild_id: this.selectedServer,
        discord_id: discordId,
        client_id: clientId,
      };
      if (queueName) body.queue_name = queueName;

      const response = await fetch(`${this.waterBotApi}/api/queue/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
          "User-Agent": "Water",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (result.success) {
        this.showNotification("Left queue", "success");
        this.renderHomeTab();
      } else {
        this.showNotification(result.error || "Failed to leave queue", "error");
      }
    } catch (e) {
      logger.log("Error leaving queue:", e);
      this.showNotification("Failed to leave queue", "error");
    }
  }

  setupRealtimeSubscription() {
    if (this.activeTab !== "Home" || !this.selectedServer) return;

    if (this.realtimeChannel) {
      if (this.supabase) this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }

    const serverSelect = document.getElementById(
      "pickupServerSelect",
    ) as HTMLSelectElement;
    const selectedOption = serverSelect?.selectedOptions[0];
    const isCentralized = selectedOption?.dataset.centralized === "true";

    if (!isCentralized) {
      this.startPolling();
      return;
    }

    if (!this.supabase) return;

    this.realtimeChannel = this.supabase
      .channel(`queue-updates-${this.selectedServer}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pickup_queues",
          filter: `guild_id=eq.${this.selectedServer}`,
        },
        (payload: any) => {
          if (
            payload.new &&
            payload.new.game_link &&
            payload.new.game_link !== payload.old?.game_link
          ) {
            this.overlays.showGameReadyOverlay(payload.new);
          }
          if (this.activeTab === "Home" && !this.isLoadingTab) {
            this.renderHomeTab();
          }
        },
      )
      .subscribe();
  }

  cleanupRealtimeSubscription() {
    if (this.realtimeChannel) {
      if (this.supabase) this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      if (this.activeTab === "Home") this.renderHomeTab();
    }, 2000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async checkMatchStatus() {
    const discordId = localStorage.getItem("discord_id");
    if (!discordId || !this.selectedServer) return;

    try {
      const response = await fetch(
        `${this.waterBotApi}/api/match/${this.selectedServer}?discord_id=${discordId}`,
        {
          headers: {
            "ngrok-skip-browser-warning": "69420",
            "User-Agent": "Water",
          },
        },
      );
      const result = await response.json();
      if (result.success && result.in_match && result.match) {
        if (result.match.state === 1 && result.match.check_in) {
          this.overlays.showCheckInOverlay(result.match);
        }
      }
    } catch (e) {
      logger.log("Error checking match status:", e);
    }
  }

  // --- Stage Router & Persistence ---

  routeToStage(stage: MatchStage, match: any) {
    this.persistMatchState(stage, match);
    this.saveMatchData(match.match_id, match);

    switch (stage) {
      case MatchStage.CHECK_IN:
        this.overlays.showCheckInOverlay(match);
        break;
      case MatchStage.DRAFT:
        this.overlays.showDraftOverlay(match);
        break;
      case MatchStage.IN_GAME:
        this.overlays.showMatchInProgressOverlay(match);
        break;
      case MatchStage.REPORT:
        this.overlays.showReportOverlay(match);
        break;
      case MatchStage.RATING_CHANGES:
        this.overlays.showRatingChangesOverlay(match);
        break;
      default:
        this.renderHomeTab();
    }
  }

  private persistMatchState(stage: MatchStage, matchData: any) {
    const state: PersistentMatchState = {
      matchId: matchData.match_id,
      stage,
      guildId: this.selectedServer,
      queueName: matchData.queue_name || "",
      lastUpdated: Date.now(),
      expiresAt: Date.now() + 3_600_000,
    };
    localStorage.setItem("pug_match_state", JSON.stringify(state));
    localStorage.setItem(
      `pug_match_${state.matchId}`,
      JSON.stringify(matchData),
    );
  }

  private saveMatchData(matchId: string, matchData: any) {
    localStorage.setItem(`pug_match_${matchId}`, JSON.stringify(matchData));
  }

  private clearMatchState() {
    const state = this.loadMatchState();
    if (state) {
      localStorage.removeItem(`pug_match_${state.matchId}`);
    }
    localStorage.removeItem("pug_match_state");
  }

  private loadMatchState(): PersistentMatchState | null {
    try {
      const raw = localStorage.getItem("pug_match_state");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private async resumeFromStage(state: PersistentMatchState) {
    logger.log(
      "Resuming PUG from stage:",
      state.stage,
      "match:",
      state.matchId,
    );

    const matchData = localStorage.getItem(`pug_match_${state.matchId}`);
    if (!matchData) return;

    const match = JSON.parse(matchData);
    this.routeToStage(state.stage, match);
  }

  private async refreshMatchState(state: PersistentMatchState) {
    try {
      const discordId = localStorage.getItem("discord_id");
      const res = await fetch(
        `${this.waterBotApi}/api/match/${state.guildId}?discord_id=${discordId}`,
      );
      const data = await res.json();

      if (data.success && data.in_match) {
        this.saveMatchData(state.matchId, data.match);
        this.persistMatchState(stageFromState(data.match.state), data.match);
        this.routeToStage(stageFromState(data.match.state), data.match);
      } else {
        this.clearMatchState();
      }
    } catch {
      logger.log("Cannot refresh match state, using cached");
      const matchData = localStorage.getItem(`pug_match_${state.matchId}`);
      if (matchData) {
        this.routeToStage(state.stage, JSON.parse(matchData));
      }
    }
  }

  showNotification(
    message: string,
    type: "success" | "error" | "info" = "info",
  ) {
    const notification = document.createElement("div");
    const bgColor =
      type === "success"
        ? "rgba(0,200,0,0.2)"
        : type === "error"
          ? "rgba(255,0,0,0.2)"
          : "rgba(255,105,180,0.2)";
    const borderColor =
      type === "success"
        ? "rgba(0,200,0,0.5)"
        : type === "error"
          ? "rgba(255,0,0,0.5)"
          : "rgba(255,105,180,0.5)";

    notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 14px 18px;
            background: ${bgColor}; border: 1px solid ${borderColor};
            border-radius: 6px; color: #fff; font-size: 13px;
            font-weight: 500; z-index: 10000; opacity: 0;
            transition: opacity 0.2s;
        `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => (notification.style.opacity = "1"), 10);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => notification.remove(), 200);
    }, 3000);
  }
}
