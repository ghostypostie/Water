import Performance from '../modules/performance';
import Checkbox from '../options/checkbox';
import Button from '../options/button';
import UI from './index';
import config from '../config';

export default class SwitchesUI extends UI {
    name = 'Chromium Switches';
    categories = [{
        name: '',
        options: []
    }];

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

    constructor(module: Performance) {
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

        // Inject custom grid
        this.injectGrid(holder);

        for(let button of this.buttons) menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }

    injectGrid(holder: HTMLElement) {
        const module = this.module as Performance;
        const switches = module.switchList;

        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-grid';
        
        const renderGrid = () => {
            gridContainer.innerHTML = switches.map(switchName => {
                const isEnabled = config.get('switches.' + switchName, true) as boolean;
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
                    if (!switchName) return;

                    const currentValue = config.get('switches.' + switchName, true) as boolean;
                    config.set('switches.' + switchName, !currentValue);
                    renderGrid();
                });
            });
        };

        holder.appendChild(gridContainer);
        renderGrid();
    }
}
