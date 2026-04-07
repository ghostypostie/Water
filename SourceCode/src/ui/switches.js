"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const button_1 = __importDefault(require("../options/button"));
const index_1 = __importDefault(require("./index"));
const config_1 = __importDefault(require("../config"));
class SwitchesUI extends index_1.default {
    name = 'Chromium Switches';
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
        this.injectGrid(holder);
        for (let button of this.buttons)
            menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }
    injectGrid(holder) {
        const module = this.module;
        const switches = module.switchList;
        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-grid';
        const renderGrid = () => {
            gridContainer.innerHTML = switches.map(switchName => {
                const isEnabled = config_1.default.get('switches.' + switchName, true);
                const displayName = switchName.split('=')[0];
                return `
                    <div class="quickplay-item ${isEnabled ? 'selected' : ''}" data-switch="${switchName}">
                        ${displayName}
                    </div>
                `;
            }).join('');
            gridContainer.querySelectorAll('.quickplay-item').forEach(el => {
                el.addEventListener('click', () => {
                    const switchName = el.getAttribute('data-switch');
                    if (!switchName)
                        return;
                    const currentValue = config_1.default.get('switches.' + switchName, true);
                    config_1.default.set('switches.' + switchName, !currentValue);
                    renderGrid();
                });
            });
        };
        holder.appendChild(gridContainer);
        renderGrid();
    }
}
exports.default = SwitchesUI;
