"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const checkbox_1 = __importDefault(require("../options/checkbox"));
const slider_1 = __importDefault(require("../options/slider"));
const button_1 = __importDefault(require("../options/button"));
const config_1 = __importDefault(require("../config"));
const quickplay_gamemodes_1 = __importDefault(require("../ui/quickplay-gamemodes"));
const quickplay_maps_1 = __importDefault(require("../ui/quickplay-maps"));
const quickplay_regions_1 = __importDefault(require("../ui/quickplay-regions"));
const MATCHMAKER_GAMEMODES = [
    { id: '*', name: 'Any' },
    { id: 'ffa', name: 'FFA' },
    { id: 'tdm', name: 'Team Deathmatch' },
    { id: 'ctf', name: 'Capture the Flag' },
    { id: 'point', name: 'Hardpoint' },
    { id: 'koth', name: 'King of the Hill' },
    { id: 'infected', name: 'Infected' },
    { id: 'race', name: 'Race' },
    { id: 'lms', name: 'Last Man Standing' },
    { id: 'simon', name: 'Simon Says' },
    { id: 'gun_game', name: 'Gun Game' },
    { id: 'prop', name: 'Prop Hunt' },
    { id: 'boss_hunt', name: 'Boss Hunt' },
    { id: 'classic_ffa', name: 'Classic FFA' },
    { id: 'deathmatch', name: 'Deathmatch' },
    { id: 'defuse', name: 'Defuse' },
    { id: 'sharp_shooter', name: 'Sharp Shooter' },
    { id: 'traitor', name: 'Traitor' },
    { id: 'raid', name: 'Raid' },
    { id: 'stalker', name: 'Stalker' },
    { id: 'kr', name: 'Krunker Royale' },
    { id: 'blitz_ffa', name: 'Blitz FFA' }
];
const MATCHMAKER_REGIONS = [
    { id: '*', name: 'Any' },
    { id: 'fra', name: 'Frankfurt' },
    { id: 'sv', name: 'Silicon Valley' },
    { id: 'syd', name: 'Sydney' },
    { id: 'jpn', name: 'Tokyo' },
    { id: 'sin', name: 'Singapore' },
    { id: 'ny', name: 'New York' },
    { id: 'mbi', name: 'Mumbai' },
    { id: 'dal', name: 'Dallas' },
    { id: 'brz', name: 'Brazil' },
    { id: 'bhn', name: 'Middle East' }
];
const MATCHMAKER_MAPS = [
    '*',
    'Burg',
    'Littletown',
    'Sandstorm',
    'Subzero',
    'Undergrowth',
    'Shipment',
    'Freight',
    'Lostworld',
    'Citadel',
    'Oasis',
    'Kanji',
    'Industry',
    'Lumber',
    'Evacuation',
    'Site',
    'SkyTemple',
    'Lagoon',
    'Bureau',
    'Tortuga',
    'Tropicano',
    'Krunk_Plaza',
    'Arena',
    'Habitat',
    'Atomic',
    'Old_Burg',
    'Throwback',
    'Stockade',
    'Facility',
    'Clockwork',
    'Laboratory',
    'Shipyard',
    'Soul Sanctum',
    'Bazaar',
    'Erupt',
    'HQ',
    'Khepri',
    'Lush',
    'Viva',
    'Slide Moonlight',
    'Eterno Simulator',
    'Stalk Factory',
    'Eterno_jump'
];
class QuickPlay extends module_1.default {
    name = 'Quick Play';
    id = 'quickplay';
    gamemodesUI;
    mapsUI;
    regionsUI;
    contexts = [
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadEnd,
        }
    ];
    constructor() {
        super();
        this.gamemodesUI = new quickplay_gamemodes_1.default(this);
        this.mapsUI = new quickplay_maps_1.default(this);
        this.regionsUI = new quickplay_regions_1.default(this);
    }
    options = [
        new checkbox_1.default(this, {
            id: 'quickplay.enabled',
            name: 'Enable Quick Play',
            description: 'Automatically find and join best game based on filters when pressing F4',
            defaultValue: false,
            needsRestart: true
        }),
        new slider_1.default(this, {
            id: 'quickplay.minTime',
            name: 'Minimum Time (minutes)',
            description: 'Minimum time remaining in game',
            defaultValue: 2,
            min: 0,
            max: 4,
            step: 1
        }),
        new slider_1.default(this, {
            id: 'quickplay.minPlayers',
            name: 'Minimum Players',
            description: 'Minimum number of players in game',
            defaultValue: 0,
            min: 0,
            max: 10,
            step: 1
        }),
        new slider_1.default(this, {
            id: 'quickplay.maxPlayers',
            name: 'Maximum Players',
            description: 'Maximum number of players in game',
            defaultValue: 8,
            min: 1,
            max: 10,
            step: 1
        }),
        new checkbox_1.default(this, {
            id: 'quickplay.allowCustoms',
            name: 'Allow Custom Games',
            description: 'Allow joining custom games',
            defaultValue: false
        }),
        new checkbox_1.default(this, {
            id: 'quickplay.allowOfficialCustoms',
            name: 'Allow Official Customs',
            description: 'Allow joining official custom games',
            defaultValue: false
        }),
        new button_1.default(this, {
            id: 'quickplay.gamemodes',
            name: 'Gamemodes',
            description: 'Select which game modes to join',
            label: 'Edit',
            onChange: () => {
                this.gamemodesUI.open();
            }
        }),
        new button_1.default(this, {
            id: 'quickplay.maps',
            name: 'Maps',
            description: 'Select which maps to join',
            label: 'Edit',
            onChange: () => {
                this.mapsUI.open();
            }
        }),
        new button_1.default(this, {
            id: 'quickplay.regions',
            name: 'Regions',
            description: 'Select which regions to join',
            label: 'Edit',
            onChange: () => {
                this.regionsUI.open();
            }
        })
    ];
    selectedGamemodes = ['*'];
    selectedMaps = ['*'];
    selectedRegions = ['*'];
    init() {
        const savedGamemodes = config_1.default.get('quickplay.selectedGamemodes', ['*']);
        const savedMaps = config_1.default.get('quickplay.selectedMaps', ['*']);
        const savedRegions = config_1.default.get('quickplay.selectedRegions', ['*']);
        if (Array.isArray(savedGamemodes))
            this.selectedGamemodes = savedGamemodes;
        if (Array.isArray(savedMaps))
            this.selectedMaps = savedMaps;
        if (Array.isArray(savedRegions))
            this.selectedRegions = savedRegions;
        console.log('[Water] Quick Play initialized');
    }
    renderer() {
        // Always inject styles so grid items look good
        this.injectStyles();
        const enabled = config_1.default.get('quickplay.enabled', false);
        if (!enabled) {
            console.log('[Water] Quick Play disabled');
            return;
        }
        this.setupF6Keybind();
        console.log('[Water] Quick Play enabled');
    }
    injectStyles() {
        if (document.getElementById('quickplay-styles'))
            return;
        const style = document.createElement('style');
        style.id = 'quickplay-styles';
        style.textContent = `
            .quickplay-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                gap: 12px;
                padding: 20px;
            }
            .quickplay-item {
                background: rgba(255, 255, 255, 0.05);
                padding: 16px;
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.15s ease-out, border-color 0.15s ease-out, box-shadow 0.15s ease-out;
                border: 2px solid rgba(255, 255, 255, 0.08);
                text-align: center;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.85);
                font-weight: 500;
                will-change: transform;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .quickplay-item:hover {
                border-color: rgba(255, 105, 180, 0.4);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 105, 180, 0.2);
            }
            .quickplay-item.selected {
                border-color: rgba(255, 105, 180, 0.9);
                background: rgba(255, 105, 180, 0.15);
                color: #fff;
                box-shadow: 0 0 20px rgba(255, 105, 180, 0.3);
            }
        `;
        document.head.appendChild(style);
    }
    setupF6Keybind() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F4') {
                e.preventDefault();
                this.findAndJoinGame();
            }
        });
    }
    async findAndJoinGame() {
        try {
            console.log('[Water] Quick Play: Searching for game...');
            const minTime = config_1.default.get('quickplay.minTime', 2);
            const minPlayers = config_1.default.get('quickplay.minPlayers', 0);
            const maxPlayers = config_1.default.get('quickplay.maxPlayers', 8);
            const allowCustoms = config_1.default.get('quickplay.allowCustoms', false);
            const allowOfficialCustoms = config_1.default.get('quickplay.allowOfficialCustoms', false);
            const response = await fetch('https://matchmaker.krunker.io/game-list?hostname=krunker.io');
            const data = await response.json();
            if (!data.games || !Array.isArray(data.games)) {
                console.error('[Water] Quick Play: Invalid game list response');
                return;
            }
            const filtered = data.games.filter((game) => {
                if (game.players < minPlayers || game.players > maxPlayers)
                    return false;
                const timeRemaining = (game.timeLeft || 0) / 60000;
                if (timeRemaining < minTime)
                    return false;
                if (!allowCustoms && game.custom && !game.isOfficialCustom)
                    return false;
                if (!allowOfficialCustoms && game.isOfficialCustom)
                    return false;
                if (this.selectedGamemodes.indexOf('*') < 0) {
                    if (this.selectedGamemodes.indexOf(game.gamemode) < 0)
                        return false;
                }
                if (this.selectedMaps.indexOf('*') < 0) {
                    if (this.selectedMaps.indexOf(game.map) < 0)
                        return false;
                }
                if (this.selectedRegions.indexOf('*') < 0) {
                    if (this.selectedRegions.indexOf(game.region) < 0)
                        return false;
                }
                return true;
            });
            if (filtered.length === 0) {
                console.log('[Water] Quick Play: No games found matching filters');
                return;
            }
            filtered.sort((a, b) => b.players - a.players);
            const bestGame = filtered[0];
            console.log('[Water] Quick Play: Found game:', bestGame.id, bestGame.gamemode, bestGame.map, bestGame.players + '/' + bestGame.maxPlayers);
            window.location.href = `https://krunker.io/?game=${bestGame.id}`;
        }
        catch (e) {
            console.error('[Water] Quick Play error:', e);
        }
    }
}
exports.default = QuickPlay;
