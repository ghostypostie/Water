import TwitchChat from '../modules/twitch';
import Checkbox from '../options/checkbox';
import Button from '../options/button';
import UI from './index';
import config from '../config';

export default class TwitchUI extends UI {
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
        new Button(this.module, {
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

    private displayOptions = [
        { id: 'twitch.showBadges', name: 'Show User Badges' },
        { id: 'twitch.useUserColors', name: 'Use Username Colors' },
        { id: 'twitch.showEmotes', name: 'Show Emotes' }
    ];

    private notificationOptions = [
        { id: 'twitch.notifyRaids', name: 'Raid Notifications' },
        { id: 'twitch.notifyHosts', name: 'Host Notifications' },
        { id: 'twitch.notifySubs', name: 'Subscriber Alerts' },
        { id: 'twitch.notifyRedeems', name: 'Channel Point Redemptions' }
    ];

    constructor(module: TwitchChat) {
        super(module);
    }

    open() {
        let windowHolder = document.getElementById('windowHolder');
        let menuWindow = document.getElementById('menuWindow');

        if(!windowHolder || !menuWindow) return;

        windowHolder.className = 'popupWin';
        menuWindow.style.width = this.width + 'px';
        menuWindow.className = 'dark';
        menuWindow.innerHTML = '';

        if(this.name) {
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

        for(let button of this.buttons) menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }

    addSection(holder: HTMLElement, title: string, options: Array<{id: string, name: string}>) {
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'setHed';
        sectionHeader.textContent = title;
        sectionHeader.style.marginTop = '10px';
        holder.appendChild(sectionHeader);

        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-grid';
        
        const renderGrid = () => {
            gridContainer.innerHTML = options.map(option => {
                const isEnabled = config.get(option.id, true) as boolean;
                return `
                    <div class="quickplay-item ${isEnabled ? 'selected' : ''}" data-option="${option.id}">
                        ${option.name}
                    </div>
                `;
            }).join('');

            gridContainer.querySelectorAll('.quickplay-item').forEach(el => {
                el.addEventListener('click', () => {
                    const optionId = el.getAttribute('data-option');
                    if (!optionId) return;

                    const currentValue = config.get(optionId, true) as boolean;
                    config.set(optionId, !currentValue);
                    renderGrid();
                });
            });
        };

        holder.appendChild(gridContainer);
        renderGrid();
    }
}
