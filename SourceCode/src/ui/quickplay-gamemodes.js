"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
const button_1 = __importDefault(require("../options/button"));
const config_1 = __importDefault(require("../config"));
class QuickPlayGamemodesUI extends index_1.default {
    name = 'Select Gamemodes';
    categories = [{
            name: '',
            options: []
        }];
    buttons = [
        new button_1.default(this.module, {
            label: 'Back to settings',
            color: 'purple',
            name: '',
            description: '',
            id: '',
            onChange: () => {
                window.showWindow?.(1);
            },
        }),
    ];
    constructor(module) {
        super(module);
    }
    open() {
        let windowHolder = document.getElementById('windowHolder');
        let menuWindow = document.getElementById('menuWindow');
        if (!windowHolder || !menuWindow)
            return;
        windowHolder.className = 'popupWin';
        menuWindow.style.width = this.width + 'px';
        menuWindow.className = 'dark';
        menuWindow.innerHTML = '';
        if (this.name) {
            let header = document.createElement('div');
            header.id = 'referralHeader';
            header.textContent = this.name;
            menuWindow.append(header);
        }
        let holder = document.createElement('div');
        holder.id = 'settHolder';
        menuWindow.append(holder);
        // Inject custom grid
        this.injectGrid(holder, 'gamemodes');
        for (let button of this.buttons)
            menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }
    injectGrid(holder, type) {
        const MATCHMAKER_GAMEMODES = [
            { id: '*', name: 'Any' },
            { id: 'ffa', name: 'Free For All' },
            { id: 'tdm', name: 'Team Deathmatch' },
            { id: 'point', name: 'Hardpoint' },
            { id: 'ctf', name: 'Capture the Flag' },
            { id: 'parkour', name: 'Parkour' },
            { id: 'hide_and_seek', name: 'Hide & Seek' },
            { id: 'infected', name: 'Infected' },
            { id: 'race', name: 'Race' },
            { id: 'lms', name: 'Last Man Standing' },
            { id: 'simon', name: 'Simon Says' },
            { id: 'gun_game', name: 'Gun Game' },
            { id: 'prop', name: 'Prop Hunt' },
            { id: 'boss_hunt', name: 'Boss Hunt' },
            { id: 'classic_ffa', name: 'Classic FFA' },
            { id: 'deposit', name: 'Deposit' },
            { id: 'stalker', name: 'Stalker' },
            { id: 'koth', name: 'King of the Hill' },
            { id: 'one_in_the_chamber', name: 'One in the Chamber' },
            { id: 'trade', name: 'Trade' },
            { id: 'kill_confirmed', name: 'Kill Confirmed' },
            { id: 'defuse', name: 'Defuse' },
            { id: 'sharp_shooter', name: 'Sharp Shooter' },
            { id: 'traitor', name: 'Traitor' },
            { id: 'raid', name: 'Raid' },
            { id: 'blitz', name: 'Blitz' },
            { id: 'domination', name: 'Domination' },
            { id: 'squad_deathmatch', name: 'Squad Deathmatch' },
            { id: 'kranked_ffa', name: 'Kranked FFA' },
            { id: 'team_defender', name: 'Team Defender' },
            { id: 'deposit_ffa', name: 'Deposit FFA' },
            { id: 'chaos_snipers', name: 'Chaos Snipers' },
            { id: 'bighead_ffa', name: 'Bighead FFA' }
        ];
        let selected = config_1.default.get('quickplay.selectedGamemodes', ['*']);
        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-grid';
        const renderGrid = () => {
            gridContainer.innerHTML = MATCHMAKER_GAMEMODES.map(item => {
                const isSelected = selected.indexOf(item.id) >= 0;
                return `
                    <div class="quickplay-item ${isSelected ? 'selected' : ''}" data-id="${item.id}">
                        ${item.name}
                    </div>
                `;
            }).join('');
            gridContainer.querySelectorAll('.quickplay-item').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.getAttribute('data-id');
                    if (!id)
                        return;
                    if (id === '*') {
                        selected = selected.indexOf('*') >= 0 ? [] : ['*'];
                    }
                    else {
                        const anyIndex = selected.indexOf('*');
                        if (anyIndex >= 0)
                            selected.splice(anyIndex, 1);
                        const index = selected.indexOf(id);
                        if (index >= 0) {
                            selected.splice(index, 1);
                        }
                        else {
                            selected.push(id);
                        }
                        if (selected.length === 0)
                            selected = ['*'];
                    }
                    config_1.default.set('quickplay.selectedGamemodes', selected);
                    renderGrid();
                });
            });
        };
        holder.appendChild(gridContainer);
        renderGrid();
    }
}
exports.default = QuickPlayGamemodesUI;
