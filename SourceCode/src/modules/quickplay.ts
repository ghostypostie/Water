import { Context, RunAt } from '../context';
import Module from '../module';
import Checkbox from '../options/checkbox';
import Slider from '../options/slider';
import Button from '../options/button';
import Dropdown from '../options/dropdown';
import config from '../config';
import QuickPlayGamemodesUI from '../ui/quickplay-gamemodes';
import QuickPlayMapsUI from '../ui/quickplay-maps';
import QuickPlayRegionsUI from '../ui/quickplay-regions';

const { ipcRenderer } = require('electron');

interface RawLobby {
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

const GAMEMODE_NAMES = [
    'Free for All', 'Team Deathmatch', 'Hardpoint', 'Capture the Flag', 'Parkour',
    'Hide & Seek', 'Infected', 'Race', 'Last Man Standing', 'Simon Says',
    'Gun Game', 'Prop Hunt', 'Boss Hunt', 'Classic FFA', 'Deposit',
    'Stalker', 'King of the Hill', 'One in the Chamber', 'Trade',
    'Kill Confirmed', 'Defuse', 'Sharp Shooter', 'Traitor', 'Raid',
    'Blitz', 'Domination', 'Squad Deathmatch', 'Kranked FFA', 'Team Defender',
    'Deposit FFA', 'Chaos Snipers', 'Bighead FFA'
];

// Map gamemode IDs to their display names for filtering
const GAMEMODE_ID_TO_NAME: Record<string, string> = {
    'ffa': 'Free for All',
    'tdm': 'Team Deathmatch',
    'point': 'Hardpoint',
    'ctf': 'Capture the Flag',
    'parkour': 'Parkour',
    'hide_and_seek': 'Hide & Seek',
    'infected': 'Infected',
    'race': 'Race',
    'lms': 'Last Man Standing',
    'simon': 'Simon Says',
    'gun_game': 'Gun Game',
    'prop': 'Prop Hunt',
    'boss_hunt': 'Boss Hunt',
    'classic_ffa': 'Classic FFA',
    'deposit': 'Deposit',
    'stalker': 'Stalker',
    'koth': 'King of the Hill',
    'one_in_the_chamber': 'One in the Chamber',
    'trade': 'Trade',
    'kill_confirmed': 'Kill Confirmed',
    'defuse': 'Defuse',
    'sharp_shooter': 'Sharp Shooter',
    'traitor': 'Traitor',
    'raid': 'Raid',
    'blitz': 'Blitz',
    'domination': 'Domination',
    'squad_deathmatch': 'Squad Deathmatch',
    'kranked_ffa': 'Kranked FFA',
    'team_defender': 'Team Defender',
    'deposit_ffa': 'Deposit FFA',
    'chaos_snipers': 'Chaos Snipers',
    'bighead_ffa': 'Bighead FFA'
};

const REGION_FULL: Record<string, string> = {
    SV: 'Silicon Valley',
    TOK: 'Tokyo',
    FRA: 'Frankfurt',
    MBI: 'Mumbai',
    SYD: 'Sydney',
    SIN: 'Singapore',
    DAL: 'Dallas',
    BHN: 'Middle East',
    BRZ: 'Brazil',
    NY: 'New York'
};

const SORT_MODES = [
    { name: 'Lowest Ping', value: 'ping' },
    { name: 'Most Players', value: 'players' },
    { name: 'Most Time Left', value: 'time' }
];

let scanAborted = false;
let scanInProgress = false;

export default class QuickPlay extends Module {
    name = 'Quick Play';
    id = 'quickplay';
    priority = 5;

    private gamemodesUI: QuickPlayGamemodesUI;
    private mapsUI: QuickPlayMapsUI;
    private regionsUI: QuickPlayRegionsUI;

    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        }
    ];

    constructor() {
        super();
        this.gamemodesUI = new QuickPlayGamemodesUI(this);
        this.mapsUI = new QuickPlayMapsUI(this);
        this.regionsUI = new QuickPlayRegionsUI(this);
    }

    options = [
        new Checkbox(this, {
            id: 'quickplay.enabled',
            name: 'Enable Quick Play',
            description: 'Drop into the deepest lobby that fits your filters when the Quick Play key is pressed',
            defaultValue: false,
            needsRestart: true
        }),
        new Dropdown(this, {
            id: 'quickplay.sortMode',
            name: 'Sort Method',
            description: 'How to rank candidate lobbies before diving in',
            defaultValue: 'ping',
            options: SORT_MODES
        }),
        new Slider(this, {
            id: 'quickplay.minTime',
            name: 'Minimum Time (minutes)',
            description: 'Reject any lobby with less time remaining',
            defaultValue: 2,
            min: 0,
            max: 4,
            step: 1
        }),
        new Slider(this, {
            id: 'quickplay.minPlayers',
            name: 'Minimum Players',
            description: 'Skip ghost lobbies below this count',
            defaultValue: 0,
            min: 0,
            max: 10,
            step: 1
        }),
        new Slider(this, {
            id: 'quickplay.maxPlayers',
            name: 'Maximum Players',
            description: 'Avoid lobbies more crowded than this',
            defaultValue: 8,
            min: 1,
            max: 10,
            step: 1
        }),
        new Slider(this, {
            id: 'quickplay.poolSize',
            name: 'Pool Size',
            description: 'Pick randomly from the top N candidates for variance',
            defaultValue: 3,
            min: 1,
            max: 8,
            step: 1
        }),
        new Checkbox(this, {
            id: 'quickplay.allowCustoms',
            name: 'Allow Custom Games',
            description: 'Include user-hosted custom lobbies',
            defaultValue: false
        }),
        new Checkbox(this, {
            id: 'quickplay.allowOfficialCustoms',
            name: 'Allow Official Customs',
            description: 'Include official featured custom lobbies',
            defaultValue: false
        }),
        new Checkbox(this, {
            id: 'quickplay.fallbackBrowser',
            name: 'Fallback to Server Browser',
            description: 'Open the server browser if no lobby passes the filter',
            defaultValue: true
        }),
        new Button(this, {
            id: 'quickplay.gamemodes',
            name: 'Gamemodes',
            description: 'Choose which game modes are eligible',
            label: 'Configure',
            onChange: () => this.gamemodesUI.open()
        }),
        new Button(this, {
            id: 'quickplay.maps',
            name: 'Maps',
            description: 'Choose which maps are eligible',
            label: 'Configure',
            onChange: () => this.mapsUI.open()
        }),
        new Button(this, {
            id: 'quickplay.regions',
            name: 'Regions',
            description: 'Choose which regions are eligible',
            label: 'Configure',
            onChange: () => this.regionsUI.open()
        })
    ];

    private selectedGamemodes: string[] = ['*'];
    private selectedMaps: string[] = ['*'];
    private selectedRegions: string[] = ['*'];

    private pingCache: Record<string, number> = {};
    private pingCacheTime = 0;

    init() {
        const savedGamemodes = this.config.get('quickplay.selectedGamemodes', ['*']);
        const savedMaps = this.config.get('quickplay.selectedMaps', ['*']);
        const savedRegions = this.config.get('quickplay.selectedRegions', ['*']);

        if (Array.isArray(savedGamemodes)) this.selectedGamemodes = savedGamemodes;
        if (Array.isArray(savedMaps)) this.selectedMaps = savedMaps;
        if (Array.isArray(savedRegions)) this.selectedRegions = savedRegions;

        console.log('[Water] Quick Play (Tidal) ready');
    }

    renderer() {
        this.injectStyles();
        const enabled = this.config.get('quickplay.enabled', false) as boolean;
        console.log('[Water] Quick Play status:', enabled ? 'enabled' : 'disabled');
    }

    injectStyles() {
        if (!document.getElementById('quickplay-tidal-styles')) {
            const style = document.createElement('style');
            style.id = 'quickplay-tidal-styles';
            style.textContent = TIDAL_STYLES;
            document.head.appendChild(style);
        }

        // Backwards compatibility for other modules using the legacy .quickplay-grid classes
        if (!document.getElementById('quickplay-legacy-styles')) {
            const legacy = document.createElement('style');
            legacy.id = 'quickplay-legacy-styles';
            legacy.textContent = LEGACY_GRID_STYLES;
            document.head.appendChild(legacy);
        }
    }

    public getSelectedGamemodes() { return this.selectedGamemodes; }
    public getSelectedMaps() { return this.selectedMaps; }
    public getSelectedRegions() { return this.selectedRegions; }
    public refreshSelections() {
        this.selectedGamemodes = this.config.get('quickplay.selectedGamemodes', ['*']) as string[];
        this.selectedMaps = this.config.get('quickplay.selectedMaps', ['*']) as string[];
        this.selectedRegions = this.config.get('quickplay.selectedRegions', ['*']) as string[];
    }

    private matchesGamemode(gamemodeName: string, gamemodeIndex: number): boolean {
        // Check if any selected gamemode ID matches this lobby's gamemode
        for (const selectedId of this.selectedGamemodes) {
            const expectedName = GAMEMODE_ID_TO_NAME[selectedId];
            if (expectedName && expectedName === gamemodeName) {
                return true;
            }
            // Also check by index for unmapped modes
            if (selectedId === String(gamemodeIndex)) {
                return true;
            }
        }
        return false;
    }

    public async findAndJoinGame() {
        const enabled = this.config.get('quickplay.enabled', false) as boolean;
        if (!enabled) {
            console.log('[Water] Quick Play disabled — ignored');
            return;
        }

        if (scanInProgress) {
            console.log('[Water] Quick Play already in progress — ignored');
            return;
        }

        this.refreshSelections();
        scanAborted = false;
        scanInProgress = true;

        try {
            const overlay = this.openTidalOverlay();
            this.bindCancelKey(overlay);

            this.setOverlayState(overlay, 'sweeping', 'Scanning lobbies...');

            const [lobbies, pings] = await Promise.all([
                this.fetchAllGames(),
                this.refreshPings()
            ]);

            if (scanAborted) {
                this.closeOverlay(overlay);
                return;
            }

            this.setOverlayState(overlay, 'sweeping', `Analyzing ${lobbies.length} lobbies...`);

            await this.animateLobbyScan(overlay, lobbies);

            if (scanAborted) {
                this.closeOverlay(overlay);
                return;
            }

            const passing = lobbies.filter(l => l.passesFilter);
            this.updateCounters(overlay, lobbies.length, passing.length);

            if (passing.length === 0) {
                this.setOverlayState(overlay, 'empty', 'No matching depths found');
                await this.delay(1400);
                this.closeOverlay(overlay);

                const fallback = this.config.get('quickplay.fallbackBrowser', true) as boolean;
                if (fallback) {
                    (window as any).location.href = 'https://krunker.io/?play=Server-Browser';
                }
                return;
            }

            const sortMode = this.config.get('quickplay.sortMode', 'ping') as string;
            const sorted = this.sortGames(passing, pings, sortMode);
            const poolSize = Math.min(this.config.get('quickplay.poolSize', 3) as number, sorted.length);
            const pool = this.buildPool(sorted, pings, poolSize, sortMode);

            this.setOverlayState(overlay, 'locked', 'Locked on signal');
            const chosen = pool[Math.floor(Math.random() * pool.length)];
            this.renderLockedTarget(overlay, chosen, pings);

            await this.delay(900);

            if (scanAborted) {
                this.closeOverlay(overlay);
                return;
            }

            const verified = await this.verifyAndJoin(chosen, pool);
            if (!verified) {
                this.setOverlayState(overlay, 'empty', 'Signal lost — all candidates full');
                await this.delay(1200);
                this.closeOverlay(overlay);

                const fallback = this.config.get('quickplay.fallbackBrowser', true) as boolean;
                if (fallback) (window as any).location.href = 'https://krunker.io/?play=Server-Browser';
                return;
            }

            this.setOverlayState(overlay, 'diving', `Match found!`);
            
            // Show match found animation
            this.showMatchFound(overlay, verified);
            
            // Wait 3 seconds before switching lobby
            await this.delay(3000);
            
            // Switch lobby immediately (overlay will stay visible during transition)
            (window as any).location.href = `https://krunker.io/?game=${verified.gameID}`;
            
            // Keep overlay visible a bit longer during the switch
            await this.delay(500);
            
            this.closeOverlay(overlay);
        } catch (e) {
            console.error('[Water] Quick Play error:', e);
        } finally {
            scanInProgress = false;
        }
    }

    private async fetchAllGames(): Promise<RawLobby[]> {
        try {
            const response = await fetch('https://matchmaker.krunker.io/game-list?hostname=krunker.io');
            const data = await response.json();
            const raw = Array.isArray(data?.games) ? data.games : [];

            const minTime = (this.config.get('quickplay.minTime', 2) as number) * 60;
            const minPlayers = this.config.get('quickplay.minPlayers', 0) as number;
            const maxPlayers = this.config.get('quickplay.maxPlayers', 8) as number;
            const allowCustoms = this.config.get('quickplay.allowCustoms', false) as boolean;
            const allowOfficialCustoms = this.config.get('quickplay.allowOfficialCustoms', false) as boolean;
            const currentURL = window.location.href;

            const lobbies: RawLobby[] = raw.map((g: any) => this.parseLobby(g))
                .filter((l: RawLobby | null): l is RawLobby => l !== null);

            for (const lobby of lobbies) {
                let reason: string | null = null;

                if (lobby.playerCount === lobby.playerLimit) reason = 'full';
                else if (currentURL.includes(lobby.gameID)) reason = 'self';
                else if (lobby.playerCount < minPlayers) reason = 'low pop';
                else if (lobby.playerCount > maxPlayers) reason = 'too crowded';
                else if (lobby.remainingTime < minTime) reason = 'ending';
                else if (!allowCustoms && lobby.isCustom && !lobby.isOfficialCustom) reason = 'custom';
                else if (!allowOfficialCustoms && lobby.isOfficialCustom) reason = 'featured';
                else if (this.selectedGamemodes.indexOf('*') < 0 &&
                         !this.matchesGamemode(lobby.gamemode, lobby.gamemodeIndex)) reason = 'mode';
                else if (this.selectedMaps.indexOf('*') < 0 &&
                         this.selectedMaps.indexOf(lobby.map) < 0) reason = 'map';
                else if (this.selectedRegions.indexOf('*') < 0 &&
                         this.selectedRegions.indexOf(lobby.region) < 0) reason = 'region';

                lobby.passesFilter = reason === null;
                lobby.rejectReason = reason || undefined;
            }

            return lobbies;
        } catch (e) {
            console.error('[Water] fetchAllGames error:', e);
            return [];
        }
    }

    private parseLobby(raw: any): RawLobby | null {
        try {
            if (Array.isArray(raw)) {
                const gameID = raw[0];
                const playerCount = raw[2];
                const playerLimit = raw[3];
                const meta = raw[4] || {};
                const remainingTime = raw[5] || 0;
                const region = String(gameID || '').split(':')[0]?.toUpperCase() || '?';
                const gamemodeIndex = typeof meta.g === 'number' ? meta.g : 0;
                const gamemode = GAMEMODE_NAMES[gamemodeIndex] || String(gamemodeIndex);
                return {
                    gameID,
                    region,
                    gamemode,
                    gamemodeIndex,
                    map: meta.i || 'Unknown',
                    playerCount,
                    playerLimit,
                    remainingTime,
                    isCustom: !!meta.c,
                    isOfficialCustom: !!meta.oc,
                    passesFilter: false
                };
            }

            const gameID = raw.id || raw.gameID;
            const region = (raw.region || String(gameID || '').split(':')[0] || '?').toUpperCase();
            return {
                gameID,
                region,
                gamemode: raw.gamemode || 'Unknown',
                gamemodeIndex: 0,
                map: raw.map || 'Unknown',
                playerCount: raw.players ?? raw.playerCount ?? 0,
                playerLimit: raw.maxPlayers ?? raw.playerLimit ?? 0,
                remainingTime: Math.floor((raw.timeLeft || raw.remainingTime || 0) / 1000),
                isCustom: !!raw.custom,
                isOfficialCustom: !!raw.isOfficialCustom,
                passesFilter: false
            };
        } catch {
            return null;
        }
    }

    private sortGames(games: RawLobby[], pings: Record<string, number>, mode: string): RawLobby[] {
        const list = [...games];
        if (mode === 'players') {
            list.sort((a, b) => {
                if (a.playerCount !== b.playerCount) return b.playerCount - a.playerCount;
                return (pings[a.region] ?? 999) - (pings[b.region] ?? 999);
            });
        } else if (mode === 'time') {
            list.sort((a, b) => {
                if (a.remainingTime !== b.remainingTime) return b.remainingTime - a.remainingTime;
                return (pings[a.region] ?? 999) - (pings[b.region] ?? 999);
            });
        } else {
            list.sort((a, b) => {
                const pa = pings[a.region] ?? 999;
                const pb = pings[b.region] ?? 999;
                if (pa !== pb) return pa - pb;
                return b.playerCount - a.playerCount;
            });
        }
        return list;
    }

    private buildPool(sorted: RawLobby[], pings: Record<string, number>, max: number, mode: string): RawLobby[] {
        if (sorted.length === 0) return [];
        const head = sorted[0];
        const pool: RawLobby[] = [head];
        const headPing = pings[head.region] ?? 999;

        for (let i = 1; i < sorted.length && pool.length < max; i++) {
            const c = sorted[i];
            const cp = pings[c.region] ?? 999;
            if (mode === 'ping') {
                if (Math.abs(cp - headPing) <= 25 && Math.abs(c.playerCount - head.playerCount) <= 2) pool.push(c);
            } else if (mode === 'players') {
                if (Math.abs(c.playerCount - head.playerCount) <= 1) pool.push(c);
            } else {
                if (Math.abs(c.remainingTime - head.remainingTime) <= 60) pool.push(c);
            }
        }
        return pool;
    }

    private async verifyAndJoin(target: RawLobby, pool: RawLobby[]): Promise<RawLobby | null> {
        try {
            const fresh = await this.fetchAllGames();
            const lookup: Record<string, RawLobby> = {};
            for (const l of fresh) lookup[l.gameID] = l;

            const tryList = [target, ...pool.filter(p => p.gameID !== target.gameID)];
            for (const candidate of tryList) {
                const live = lookup[candidate.gameID];
                if (live && live.playerCount < live.playerLimit) return live;
            }
        } catch (e) {
            console.warn('[Water] Verify failed, joining target blindly:', e);
            return target;
        }
        return null;
    }

    private async refreshPings(): Promise<Record<string, number>> {
        const now = Date.now();
        if (Object.keys(this.pingCache).length && now - this.pingCacheTime < 60_000) {
            return this.pingCache;
        }
        try {
            const result = await ipcRenderer.invoke('quickplay-ping-regions');
            if (result && typeof result === 'object') {
                this.pingCache = result;
                this.pingCacheTime = now;
                return result;
            }
        } catch (e) {
            console.warn('[Water] Region ping IPC failed:', e);
        }
        return {};
    }

    private delay(ms: number) {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    private bindCancelKey(overlay: HTMLElement) {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                scanAborted = true;
                this.closeOverlay(overlay);
                document.removeEventListener('keydown', handler, true);
            }
        };
        document.addEventListener('keydown', handler, true);
        overlay.addEventListener('quickplay-close', () => {
            document.removeEventListener('keydown', handler, true);
        });
    }

    private openTidalOverlay(): HTMLElement {
        const existing = document.getElementById('qp-tidal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'qp-tidal-overlay';
        overlay.innerHTML = TIDAL_HTML;
        document.body.appendChild(overlay);

        const cancel = overlay.querySelector('.qp-cancel') as HTMLElement;
        if (cancel) cancel.onclick = () => {
            scanAborted = true;
            this.closeOverlay(overlay);
        };

        requestAnimationFrame(() => overlay.classList.add('qp-visible'));
        return overlay;
    }

    private closeOverlay(overlay: HTMLElement) {
        if (!overlay || !overlay.parentNode) return;
        overlay.dispatchEvent(new CustomEvent('quickplay-close'));
        overlay.classList.remove('qp-visible');
        setTimeout(() => overlay.remove(), 400);
    }

    private setOverlayState(overlay: HTMLElement, state: string, statusText: string) {
        overlay.dataset.state = state;
        const status = overlay.querySelector('.qp-status-text');
        // Don't show "Analyzing X lobbies" message
        if (status && !statusText.toLowerCase().includes('analyzing')) {
            status.textContent = statusText;
        }
        
        // Change header text when match is found
        const title = overlay.querySelector('.qp-head-title');
        if (title) {
            if (state === 'locked' || state === 'diving') {
                title.textContent = 'Fresh Water Available';
            } else {
                title.textContent = 'Watering your Plays!';
            }
        }
    }

    private updateCounters(overlay: HTMLElement, total: number, passing: number) {
        const t = overlay.querySelector('[data-counter="total"]');
        const p = overlay.querySelector('[data-counter="pass"]');
        const r = overlay.querySelector('[data-counter="reject"]');
        if (t) t.textContent = String(total);
        if (p) p.textContent = String(passing);
        if (r) r.textContent = String(total - passing);
    }

    private showJoiningScreen(lobby: RawLobby) {
        // Joining screen is now hidden, do nothing
    }

    private showMatchFound(overlay: HTMLElement, lobby: RawLobby) {
        const matchRegion = overlay.querySelector('.qp-match-region');
        const matchMode = overlay.querySelector('.qp-match-mode');
        const matchMap = overlay.querySelector('.qp-match-map');
        const matchPlayers = overlay.querySelector('.qp-match-players');

        if (matchRegion) matchRegion.textContent = REGION_FULL[lobby.region] || lobby.region;
        if (matchMode) matchMode.textContent = lobby.gamemode;
        if (matchMap) matchMap.textContent = lobby.map;
        if (matchPlayers) matchPlayers.textContent = `${lobby.playerCount}/${lobby.playerLimit}`;
    }

    private async countdownAndJoin(lobby: RawLobby) {
        const countdownEl = document.querySelector('.qp-match-countdown');
        if (!countdownEl) return;

        for (let i = 3; i > 0; i--) {
            countdownEl.textContent = String(i);
            await this.delay(1000);
        }
    }

    private renderRegionPings(overlay: HTMLElement, pings: Record<string, number>) {
        const list = overlay.querySelector('.qp-ping-list');
        if (!list) return;
        list.innerHTML = '';
        const codes = Object.keys(REGION_FULL);
        for (const code of codes) {
            const p = pings[code];
            const row = document.createElement('div');
            row.className = 'qp-ping-row';
            const tier = p == null || p < 0 ? 'unknown' : p < 50 ? 'good' : p < 120 ? 'ok' : 'bad';
            row.dataset.tier = tier;
            row.innerHTML = `
                <span class="qp-ping-code">${code}</span>
                <span class="qp-ping-bar"><i style="width:${p == null || p < 0 ? 0 : Math.min(100, p / 2)}%"></i></span>
                <span class="qp-ping-ms">${p == null || p < 0 ? '—' : p + 'ms'}</span>
            `;
            list.appendChild(row);
        }
    }

    private renderLockedTarget(overlay: HTMLElement, lobby: RawLobby, pings: Record<string, number>) {
        const lock = overlay.querySelector('.qp-locked');
        if (!lock) return;
        const ping = pings[lobby.region];
        const pingTxt = ping == null || ping < 0 ? '—' : ping + 'ms';
        lock.innerHTML = `
            <div class="qp-locked-row qp-locked-region">
                <span class="qp-locked-label">REGION</span>
                <span class="qp-locked-value">${REGION_FULL[lobby.region] || lobby.region}</span>
            </div>
            <div class="qp-locked-row">
                <span class="qp-locked-label">MODE</span>
                <span class="qp-locked-value">${lobby.gamemode}</span>
            </div>
            <div class="qp-locked-row">
                <span class="qp-locked-label">MAP</span>
                <span class="qp-locked-value">${lobby.map}</span>
            </div>
            <div class="qp-locked-row qp-locked-double">
                <span><span class="qp-locked-label">CREW</span><span class="qp-locked-value">${lobby.playerCount}/${lobby.playerLimit}</span></span>
                <span><span class="qp-locked-label">PING</span><span class="qp-locked-value">${pingTxt}</span></span>
                <span><span class="qp-locked-label">LEFT</span><span class="qp-locked-value">${this.formatTime(lobby.remainingTime)}</span></span>
            </div>
        `;
    }

    private formatTime(seconds: number): string {
        if (seconds <= 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    private async animateLobbyScan(overlay: HTMLElement, lobbies: RawLobby[]) {
        const feed = overlay.querySelector('.qp-feed') as HTMLElement;
        if (!feed) return;
        feed.innerHTML = '';

        if (lobbies.length === 0) {
            this.updateCounters(overlay, 0, 0);
            return;
        }

        const MAX_VISIBLE = 15;
        const MAX_DURATION = 1800;
        const MIN_TICK = 25;
        const BASE_TICK = 70;

        const total = lobbies.length;
        const maxEntries = Math.floor(MAX_DURATION / BASE_TICK);
        const step = total > maxEntries ? total / maxEntries : 1;
        const tickMs = total > maxEntries
            ? BASE_TICK
            : Math.max(MIN_TICK, Math.min(BASE_TICK, MAX_DURATION / total));

        let scanned = 0;
        let passing = 0;

        for (let f = 0; f < total; f += step) {
            if (scanAborted) return;
            const i = Math.min(Math.floor(f), total - 1);
            const lobby = lobbies[i];
            scanned++;
            if (lobby.passesFilter) passing++;

            const entry = this.createFeedEntry(lobby);
            feed.appendChild(entry);
            while (feed.children.length > MAX_VISIBLE) {
                feed.removeChild(feed.firstChild!);
            }

            this.updateCounters(overlay, scanned, passing);

            await this.delay(tickMs);
        }

        this.updateCounters(overlay, total, lobbies.filter(l => l.passesFilter).length);
        await this.delay(180);
    }

    private createFeedEntry(lobby: RawLobby): HTMLElement {
        const entry = document.createElement('div');
        entry.className = `qp-feed-entry ${lobby.passesFilter ? 'is-pass' : 'is-fail'}`;
        const time = this.formatTime(lobby.remainingTime);

        entry.innerHTML = `
            <span class="qp-feed-region">${lobby.region}</span>
            <span class="qp-feed-mode">${lobby.gamemode}</span>
            <span class="qp-feed-map">${lobby.map}</span>
            <span class="qp-feed-pop">${lobby.playerCount}/${lobby.playerLimit}</span>
            <span class="qp-feed-time">${time}</span>
        `;
        return entry;
    }
}

const LEGACY_GRID_STYLES = `
.quickplay-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    padding: 12px 0;
}
.quickplay-item {
    background: rgba(26, 2, 17, 0.6);
    border: 1px solid rgba(255, 20, 147, 0.3);
    color: rgba(240, 196, 230, 0.8);
    padding: 12px 14px;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    transition: none;
    text-align: center;
}
.quickplay-item:hover {
    background: rgba(44, 7, 32, 0.7);
    border-color: rgba(255, 20, 147, 0.5);
}
.quickplay-item.selected {
    background: rgba(255, 20, 147, 0.15);
    border-color: #FF1493;
    color: #FFE5FA;
}
`;

const TIDAL_HTML = `
<div class="qp-particles"></div>
<div class="qp-card">
    <header class="qp-head">
        <div class="qp-head-title">Watering your Plays!</div>
        <button class="qp-cancel" type="button">
            <span>✕</span>
        </button>
    </header>

    <div class="qp-body">
        <div class="qp-status-bar">
            <div class="qp-status-indicator"></div>
            <div class="qp-status-text">Initializing...</div>
        </div>
        
        <div class="qp-content">
            <div class="qp-feed-container">
                <div class="qp-feed-header">
                    <span>REGION</span>
                    <span>MODE</span>
                    <span>MAP</span>
                    <span>PLAYERS</span>
                    <span>TIME</span>
                </div>
                <div class="qp-feed"></div>
            </div>
            
            <div class="qp-match-found">
                <div class="qp-match-title">Match Found!</div>
                <div class="qp-match-details">
                    <div class="qp-match-info">
                        <span class="qp-match-label">REGION</span>
                        <span class="qp-match-value qp-match-region"></span>
                    </div>
                    <div class="qp-match-info">
                        <span class="qp-match-label">MODE</span>
                        <span class="qp-match-value qp-match-mode"></span>
                    </div>
                    <div class="qp-match-info">
                        <span class="qp-match-label">MAP</span>
                        <span class="qp-match-value qp-match-map"></span>
                    </div>
                    <div class="qp-match-info">
                        <span class="qp-match-label">PLAYERS</span>
                        <span class="qp-match-value qp-match-players"></span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`;

const TIDAL_STYLES = `
:root {
    --qp-pink: #FF69B4;
    --qp-pink-light: #FFB6D9;
    --qp-pink-dark: #FF1493;
    --qp-pink-darker: #C71585;
    --qp-bg-dark: #1a0a14;
    --qp-bg-card: #2a1a24;
    --qp-bg-light: #3d2a38;
    --qp-text: #ffffff;
    --qp-text-muted: #d4a5c4;
    --qp-success: #00ff88;
    --qp-error: #ff4757;
    --qp-mono: 'Inter', 'Segoe UI', system-ui, sans-serif;
}

#qp-tidal-overlay {
    position: fixed;
    inset: 0;
    z-index: 999990;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(26, 10, 30, 0.97) 0%, rgba(42, 26, 46, 0.95) 100%);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: var(--qp-text);
    font-family: var(--qp-mono);
    opacity: 0;
    transition: opacity 400ms cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: all;
    overflow: hidden;
}
#qp-tidal-overlay.qp-visible { opacity: 1; }

/* Animated particles background - optimized */
.qp-particles {
    position: absolute;
    inset: 0;
    background: 
        radial-gradient(circle at 20% 30%, rgba(255, 105, 180, 0.12), transparent 40%),
        radial-gradient(circle at 80% 70%, rgba(255, 20, 147, 0.12), transparent 40%),
        radial-gradient(circle at 50% 50%, rgba(255, 182, 217, 0.08), transparent 50%);
    will-change: transform;
    pointer-events: none;
}

.qp-card {
    position: relative;
    width: min(1300px, 95vw);
    height: min(750px, 90vh);
    background: linear-gradient(145deg, rgba(42, 26, 36, 0.96), rgba(26, 10, 20, 0.98));
    border-radius: 24px;
    border: 2px solid rgba(255, 105, 180, 0.35);
    box-shadow:
        0 0 60px rgba(255, 105, 180, 0.25),
        0 20px 80px rgba(0, 0, 0, 0.7),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transform: translateY(20px) scale(0.96);
    opacity: 0;
    transition: opacity 400ms ease, transform 400ms ease;
    overflow: hidden;
}
#qp-tidal-overlay.qp-visible .qp-card {
    transform: translateY(0) scale(1);
    opacity: 1;
}

/* Green theme when match found - EVERYTHING TURNS GREEN */
#qp-tidal-overlay[data-state="locked"],
#qp-tidal-overlay[data-state="diving"] {
    background: linear-gradient(135deg, rgba(10, 30, 20, 0.97) 0%, rgba(20, 46, 30, 0.95) 100%);
}

#qp-tidal-overlay[data-state="locked"] .qp-particles,
#qp-tidal-overlay[data-state="diving"] .qp-particles {
    background: 
        radial-gradient(circle at 20% 30%, rgba(0, 255, 136, 0.12), transparent 40%),
        radial-gradient(circle at 80% 70%, rgba(0, 204, 112, 0.12), transparent 40%),
        radial-gradient(circle at 50% 50%, rgba(0, 255, 136, 0.08), transparent 50%);
}

#qp-tidal-overlay[data-state="locked"] .qp-card,
#qp-tidal-overlay[data-state="diving"] .qp-card {
    background: linear-gradient(145deg, rgba(26, 42, 36, 0.96), rgba(10, 20, 14, 0.98));
    border-color: rgba(0, 255, 136, 0.35);
    box-shadow:
        0 0 60px rgba(0, 255, 136, 0.25),
        0 20px 80px rgba(0, 0, 0, 0.7),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

#qp-tidal-overlay[data-state="locked"] .qp-card::before,
#qp-tidal-overlay[data-state="diving"] .qp-card::before {
    background: linear-gradient(45deg, 
        #00ff88, 
        #00cc70, 
        #00ff88, 
        #00dd7a);
}

#qp-tidal-overlay[data-state="locked"] .qp-head,
#qp-tidal-overlay[data-state="diving"] .qp-head {
    background: linear-gradient(90deg, rgba(0, 255, 136, 0.1), transparent, rgba(0, 255, 136, 0.1));
    border-bottom-color: rgba(0, 255, 136, 0.2);
}

#qp-tidal-overlay[data-state="locked"] .qp-head-title,
#qp-tidal-overlay[data-state="diving"] .qp-head-title {
    background: linear-gradient(135deg, #00ff88, #00cc70);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

#qp-tidal-overlay[data-state="locked"] .qp-feed-container,
#qp-tidal-overlay[data-state="diving"] .qp-feed-container {
    border-color: rgba(0, 255, 136, 0.25);
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 4px 16px rgba(0, 255, 136, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

#qp-tidal-overlay[data-state="locked"] .qp-feed-header,
#qp-tidal-overlay[data-state="diving"] .qp-feed-header {
    background: rgba(0, 255, 136, 0.08);
    border-bottom-color: rgba(0, 255, 136, 0.2);
    color: #ffffff;
}

#qp-tidal-overlay[data-state="locked"] .qp-feed,
#qp-tidal-overlay[data-state="diving"] .qp-feed {
    scrollbar-color: rgba(0, 255, 136, 0.4) rgba(0, 255, 136, 0.1);
}

#qp-tidal-overlay[data-state="locked"] .qp-feed::-webkit-scrollbar-track,
#qp-tidal-overlay[data-state="diving"] .qp-feed::-webkit-scrollbar-track {
    background: rgba(0, 255, 136, 0.08);
}

#qp-tidal-overlay[data-state="locked"] .qp-feed::-webkit-scrollbar-thumb,
#qp-tidal-overlay[data-state="diving"] .qp-feed::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 136, 0.3);
}

#qp-tidal-overlay[data-state="locked"] .qp-feed::-webkit-scrollbar-thumb:hover,
#qp-tidal-overlay[data-state="diving"] .qp-feed::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 255, 136, 0.5);
}

#qp-tidal-overlay[data-state="locked"] .qp-feed-entry:hover,
#qp-tidal-overlay[data-state="diving"] .qp-feed-entry:hover {
    background: rgba(0, 255, 136, 0.03);
}

#qp-tidal-overlay[data-state="locked"] .qp-match-found,
#qp-tidal-overlay[data-state="diving"] .qp-match-found {
    border-color: rgba(0, 255, 136, 0.25);
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 4px 16px rgba(0, 255, 136, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

#qp-tidal-overlay[data-state="locked"] .qp-match-info,
#qp-tidal-overlay[data-state="diving"] .qp-match-info {
    --qp-match-info-bg: rgba(0, 255, 136, 0.12);
    --qp-match-info-border: rgba(0, 255, 136, 0.3);
}

#qp-tidal-overlay[data-state="locked"] .qp-match-label,
#qp-tidal-overlay[data-state="diving"] .qp-match-label {
    color: rgba(0, 255, 136, 0.7);
}

#qp-tidal-overlay[data-state="locked"] .qp-match-region,
#qp-tidal-overlay[data-state="diving"] .qp-match-region {
    color: #00ff88;
    text-shadow: 0 0 10px rgba(0, 255, 136, 0.4);
}

#qp-tidal-overlay[data-state="locked"] .qp-match-title,
#qp-tidal-overlay[data-state="diving"] .qp-match-title {
    background: linear-gradient(135deg, #00ff88, #00cc70);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

#qp-tidal-overlay[data-state="locked"] .qp-match-countdown,
#qp-tidal-overlay[data-state="diving"] .qp-match-countdown {
    color: #00ff88;
}

/* Red theme when error/empty */
#qp-tidal-overlay[data-state="empty"] .qp-card {
    border-color: rgba(255, 71, 87, 0.35);
    box-shadow:
        0 0 60px rgba(255, 71, 87, 0.25),
        0 20px 80px rgba(0, 0, 0, 0.7),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

#qp-tidal-overlay[data-state="empty"] .qp-card::before {
    background: linear-gradient(45deg, 
        #ff4757, 
        #ff1744, 
        #ff4757, 
        #ff2e4a);
}

#qp-tidal-overlay[data-state="empty"] .qp-head {
    background: linear-gradient(90deg, rgba(255, 71, 87, 0.1), transparent, rgba(255, 71, 87, 0.1));
    border-bottom-color: rgba(255, 71, 87, 0.2);
}

#qp-tidal-overlay[data-state="empty"] .qp-head-title {
    background: linear-gradient(135deg, #ff4757, #ff1744);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* Header */
.qp-head {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px 32px;
    background: linear-gradient(90deg, rgba(255, 105, 180, 0.1), transparent, rgba(255, 105, 180, 0.1));
    border-bottom: 1px solid rgba(255, 105, 180, 0.2);
    position: relative;
}

.qp-head-title {
    font-size: 36px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--qp-pink-light), var(--qp-pink));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: 0.02em;
    text-align: center;
}

/* Cancel button - hidden */
.qp-cancel {
    display: none;
}

/* Body */
.qp-body {
    height: 100%;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
}

/* Status Bar - Hidden */
.qp-status-bar {
    display: none;
}

/* Content Area - Reduced padding since container has its own margins */
.qp-content {
    flex: 1;
    width: 100%;
    padding: 24px 24px 24px;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: stretch;
    justify-content: center;
}

/* Feed Container - Box inside box design with proper padding */
.qp-feed-container {
    width: calc(100% - 48px);
    height: calc(100% - 120px);
    margin: 0px 24px 0px;
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 105, 180, 0.25);
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 4px 16px rgba(255, 105, 180, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: opacity 400ms ease, transform 400ms ease;
}

#qp-tidal-overlay[data-state="locked"] .qp-feed-container,
#qp-tidal-overlay[data-state="diving"] .qp-feed-container {
    opacity: 0;
    transform: scale(0.95);
    pointer-events: none;
}

.qp-feed-header {
    display: none;
}

.qp-feed {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    padding: 20px 0 24px;
    gap: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 105, 180, 0.4) rgba(255, 105, 180, 0.1);
}

.qp-feed::-webkit-scrollbar {
    width: 8px;
}

.qp-feed::-webkit-scrollbar-track {
    background: rgba(255, 105, 180, 0.08);
    border-radius: 4px;
}

.qp-feed::-webkit-scrollbar-thumb {
    background: rgba(255, 105, 180, 0.3);
    border-radius: 4px;
}

.qp-feed::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 105, 180, 0.5);
}

.qp-feed-entry {
    display: grid;
    grid-template-columns: 150px 250px 8fr 4fr 0px 10px;
    gap: 16px;
    align-items: center;
    padding: 14px 40px 14px 5px;
    font-size: 14px;
    border-radius: 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 200ms ease, border-color 200ms ease;
    min-height: 48px;
}

.qp-feed-entry:hover {
    background: rgba(255, 105, 180, 0.03);
    border-color: rgba(255, 105, 180, 0.15);
}

.qp-feed-entry.is-pass {
    background: transparent;
}

.qp-feed-entry.is-pass:hover {
    background: rgba(255, 105, 180, 0.03);
    border-color: rgba(255, 105, 180, 0.15);
}

.qp-feed-entry.is-fail {
    opacity: 0.3;
}

.qp-feed-region {
    color: #ddd;
    font-weight: 700;
    letter-spacing: 0.05em;
    font-size: 14px;
    white-space: nowrap;
    text-align: center;
}

.qp-feed-mode {
    color: #bbb;
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    text-align: left;
}

.qp-feed-map {
    color: #bbb;
    font-weight: 500;
    font-size: 14px;
    white-space: nowrap;
    text-align: center;
}

.qp-feed-pop {
    color: #999;
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    text-align: center;
}

.qp-feed-time {
    color: #999;
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    text-align: right;
}

.qp-feed-entry.is-pass .qp-feed-pop,
.qp-feed-entry.is-pass .qp-feed-time {
    color: #777;
    font-weight: 500;
}

/* Match Found - Same styling as feed container */
.qp-match-found {
    position: absolute;
    top: 20px;
    left: 45px;
    right: 45px;
    bottom: 140px;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 500ms ease, transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
    border-radius: 16px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 105, 180, 0.25);
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 4px 16px rgba(255, 105, 180, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

#qp-tidal-overlay[data-state="locked"] .qp-match-found,
#qp-tidal-overlay[data-state="diving"] .qp-match-found {
    display: flex;
    opacity: 1;
    transform: scale(1);
}

.qp-match-icon-wrapper {
    position: relative;
    animation: qpMatchIconAppear 600ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes qpMatchIconAppear {
    0% { transform: scale(0) rotate(-180deg); opacity: 0; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.qp-match-icon {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--qp-success), #00cc70);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 50px;
    color: white;
    box-shadow: 0 0 40px rgba(0, 255, 136, 0.5), 0 0 80px rgba(0, 255, 136, 0.3);
    position: relative;
}

.qp-match-icon::before {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    border: 2px solid var(--qp-success);
    opacity: 0.3;
    animation: qpMatchRing 2s ease-out infinite;
}

@keyframes qpMatchRing {
    0% { transform: scale(1); opacity: 0.3; }
    100% { transform: scale(1.4); opacity: 0; }
}

.qp-match-title {
    font-size: 34px;
    font-weight: 800;
    background: linear-gradient(135deg, var(--qp-pink-light), var(--qp-pink));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: qpMatchTitleSlide 500ms ease both;
}

@keyframes qpMatchTitleSlide {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
}

.qp-match-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    width: 100%;
    max-width: 480px;
    animation: qpMatchDetailsSlide 500ms ease 200ms both;
}

@keyframes qpMatchDetailsSlide {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
}

.qp-match-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 18px;
    background: var(--qp-match-info-bg, rgba(255, 105, 180, 0.08));
    border-radius: 8px;
    border: 1px solid var(--qp-match-info-border, rgba(255, 105, 180, 0.2));
    text-align: center;
    transition: background 300ms ease, border-color 300ms ease;
}

.qp-match-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--qp-text-muted);
    text-transform: uppercase;
}

.qp-match-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--qp-text);
}

.qp-match-region {
    color: var(--qp-success);
    text-shadow: 0 0 10px rgba(0, 255, 136, 0.4);
    font-size: 18px;
}

.qp-match-countdown-wrapper {
    font-size: 15px;
    color: var(--qp-text-muted);
    animation: qpMatchCountdownFade 500ms ease 400ms both;
}

@keyframes qpMatchCountdownFade {
    from { opacity: 0; }
    to { opacity: 1; }
}

.qp-match-countdown {
    display: inline-block;
    min-width: 20px;
    color: var(--qp-pink);
    font-weight: 800;
    font-size: 22px;
    text-align: center;
}

/* Feed frame */
.qp-feed-frame {
    flex: 1;
    border-radius: 16px;
    border: 1px solid rgba(255, 105, 180, 0.2);
    background: rgba(26, 10, 30, 0.6);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
}

.qp-feed-header {
    display: none !important;
}

.qp-feed {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 6px;
    scrollbar-width: thin;
    scrollbar-color: var(--qp-pink) transparent;
}

.qp-feed::-webkit-scrollbar {
    width: 6px;
}

.qp-feed::-webkit-scrollbar-track {
    background: transparent;
}

.qp-feed::-webkit-scrollbar-thumb {
    background: var(--qp-pink);
    border-radius: 3px;
}

/* Feed frame */
.qp-feed-frame {
    flex: 1;
    border-radius: 16px;
    border: 1px solid rgba(255, 105, 180, 0.2);
    background: transparent;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.qp-feed-header {
    display: none !important;
}

.qp-feed {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--qp-pink) transparent;
}

.qp-feed::-webkit-scrollbar {
    width: 6px;
}

.qp-feed::-webkit-scrollbar-track {
    background: transparent;
}

.qp-feed::-webkit-scrollbar-thumb {
    background: var(--qp-pink);
    border-radius: 3px;
}

@keyframes qpFeedSlide {
    from {
        opacity: 0;
        transform: translateX(-30px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.qp-feed-entry:hover {
    background: rgba(255, 105, 180, 0.08);
    border-color: rgba(255, 105, 180, 0.3);
}

.qp-feed-entry.is-pass {
    border-left: 3px solid var(--qp-success);
}

.qp-feed-entry.is-fail {
    opacity: 0.5;
    filter: grayscale(0.5);
    border-left: 3px solid rgba(255, 71, 87, 0.3);
}

.qp-feed-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 16px;
    font-weight: 700;
}

.qp-feed-tag-ok {
    color: var(--qp-success);
    background: rgba(0, 255, 136, 0.15);
    box-shadow: 0 0 12px rgba(0, 255, 136, 0.3);
}

.qp-feed-tag-no {
    color: var(--qp-error);
    background: rgba(255, 71, 87, 0.15);
}

.qp-feed-mode,
.qp-feed-map {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--qp-text);
    text-align: left;
}

.qp-feed-pop,
.qp-feed-time {
    text-align: right;
    color: var(--qp-text-muted);
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
}

.qp-feed-entry.is-pass .qp-feed-pop,
.qp-feed-entry.is-pass .qp-feed-time {
    color: var(--qp-text);
    font-weight: 600;
}

/* Locked target */
.qp-locked {
    display: none;
    border-radius: 16px;
    border: 2px solid var(--qp-success);
    background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(157, 78, 221, 0.08));
    padding: 24px 28px;
    animation: qpLockReveal 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 0 30px rgba(0, 255, 136, 0.3);
}

@keyframes qpLockReveal {
    from {
        transform: scale(0.9);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

#qp-tidal-overlay[data-state="locked"] .qp-locked,
#qp-tidal-overlay[data-state="diving"] .qp-locked {
    display: block;
}

.qp-locked-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(0, 255, 136, 0.2);
}

.qp-locked-row:last-child {
    border-bottom: none;
}

.qp-locked-double {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    border-bottom: none;
    padding-top: 12px;
}

.qp-locked-double > span {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.qp-locked-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--qp-text-muted);
    text-transform: uppercase;
}

.qp-locked-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--qp-text);
}

.qp-locked-region .qp-locked-value {
    color: var(--qp-success);
    text-shadow: 0 0 12px rgba(0, 255, 136, 0.6);
    font-size: 20px;
}

/* Joining Screen - hidden */
.qp-joining-screen {
    display: none !important;
}
`;

