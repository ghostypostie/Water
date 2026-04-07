"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const button_1 = __importDefault(require("../options/button"));
const index_1 = __importDefault(require("./index"));
const config_1 = __importDefault(require("../config"));
class TwitchUI extends index_1.default {
    name = 'Twitch Chat Settings';
    categories = [
        {
            name: 'Display Options',
            options: []
        },
        {
            name: 'Notifications',
            options: []
        }
    ];
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
    displayOptions = [
        { id: 'twitch.showBadges', name: 'Show User Badges' },
        { id: 'twitch.useUserColors', name: 'Use Username Colors' },
        { id: 'twitch.showEmotes', name: 'Show Emotes' }
    ];
    notificationOptions = [
        { id: 'twitch.notifyRaids', name: 'Raid Notifications' },
        { id: 'twitch.notifyHosts', name: 'Host Notifications' },
        { id: 'twitch.notifySubs', name: 'Subscriber Alerts' },
        { id: 'twitch.notifyRedeems', name: 'Channel Point Redemptions' }
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
        // Add section headers and grids
        this.addSection(holder, 'Display Options', this.displayOptions);
        this.addSection(holder, 'Notifications', this.notificationOptions);
        for (let button of this.buttons)
            menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }
    addSection(holder, title, options) {
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'setHed';
        sectionHeader.textContent = title;
        sectionHeader.style.marginTop = '10px';
        holder.appendChild(sectionHeader);
        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-grid';
        const renderGrid = () => {
            gridContainer.innerHTML = options.map(option => {
                const isEnabled = config_1.default.get(option.id, true);
                return `
                    <div class="quickplay-item ${isEnabled ? 'selected' : ''}" data-option="${option.id}">
                        ${option.name}
                    </div>
                `;
            }).join('');
            gridContainer.querySelectorAll('.quickplay-item').forEach(el => {
                el.addEventListener('click', () => {
                    const optionId = el.getAttribute('data-option');
                    if (!optionId)
                        return;
                    const currentValue = config_1.default.get(optionId, true);
                    config_1.default.set(optionId, !currentValue);
                    renderGrid();
                });
            });
        };
        holder.appendChild(gridContainer);
        renderGrid();
    }
}
exports.default = TwitchUI;
