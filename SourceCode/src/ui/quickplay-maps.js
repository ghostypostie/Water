"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
const button_1 = __importDefault(require("../options/button"));
const config_1 = __importDefault(require("../config"));
class QuickPlayMapsUI extends index_1.default {
    name = 'Select Maps';
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
        this.injectGrid(holder, 'maps');
        for (let button of this.buttons)
            menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }
    injectGrid(holder, type) {
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
        let selected = config_1.default.get('quickplay.selectedMaps', ['*']);
        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-grid';
        const renderGrid = () => {
            gridContainer.innerHTML = MATCHMAKER_MAPS.map(map => {
                const isSelected = selected.indexOf(map) >= 0;
                const name = map === '*' ? 'Any' : map;
                return `
                    <div class="quickplay-item ${isSelected ? 'selected' : ''}" data-id="${map}">
                        ${name}
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
                    config_1.default.set('quickplay.selectedMaps', selected);
                    renderGrid();
                });
            });
        };
        holder.appendChild(gridContainer);
        renderGrid();
    }
}
exports.default = QuickPlayMapsUI;
