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

        // Inject simple pink styles
        this.injectSimplePinkStyles();

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

    injectSimplePinkStyles() {
        if (document.getElementById('switches-pink-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'switches-pink-styles';
        style.textContent = `
            .switches-simple-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 8px;
                padding: 12px 0;
            }
            
            .switches-simple-item {
                background: rgba(26, 2, 17, 0.6);
                border: 1px solid rgba(255, 20, 147, 0.3);
                color: rgba(240, 196, 230, 0.8);
                padding: 12px 16px;
                font-size: 13px;
                cursor: pointer;
                border-radius: 4px;
                transition: none;
            }
            
            .switches-simple-item:hover {
                background: rgba(44, 7, 32, 0.7);
                border-color: rgba(255, 20, 147, 0.5);
            }
            
            .switches-simple-item.is-selected {
                background: rgba(255, 20, 147, 0.15);
                border-color: #FF1493;
                color: #FFE5FA;
            }
        `;
        document.head.appendChild(style);
    }

    injectGrid(holder: HTMLElement) {
        const module = this.module as Performance;
        const switches = module.switchList;

        const gridContainer = document.createElement('div');
        gridContainer.className = 'switches-simple-grid';
        
        const renderGrid = () => {
            gridContainer.innerHTML = switches.map(switchName => {
                const isEnabled = config.get('switches.' + switchName, true) as boolean;
                const displayName = switchName.split('=')[0];
                return `
                    <div class="switches-simple-item ${isEnabled ? 'is-selected' : ''}" data-switch="${switchName}">
                        ${displayName}
                    </div>
                `;
            }).join('');

            gridContainer.querySelectorAll('.switches-simple-item').forEach(el => {
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
