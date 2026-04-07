"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
const button_1 = __importDefault(require("../options/button"));
const config_1 = __importDefault(require("../config"));
class QuickPlayRegionsUI extends index_1.default {
    name = 'Select Regions';
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
        this.injectGrid(holder, 'regions');
        for (let button of this.buttons)
            menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }
    injectGrid(holder, type) {
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
        let selected = config_1.default.get('quickplay.selectedRegions', ['*']);
        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-grid';
        const renderGrid = () => {
            gridContainer.innerHTML = MATCHMAKER_REGIONS.map(region => {
                const isSelected = selected.indexOf(region.id) >= 0;
                return `
                    <div class="quickplay-item ${isSelected ? 'selected' : ''}" data-id="${region.id}">
                        ${region.name}
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
                    config_1.default.set('quickplay.selectedRegions', selected);
                    renderGrid();
                });
            });
        };
        holder.appendChild(gridContainer);
        renderGrid();
    }
}
exports.default = QuickPlayRegionsUI;
