import UI from './index';
import Button from '../options/button';
import QuickPlay from '../modules/quickplay';
import config from '../config';

const { ipcRenderer } = require('electron');

interface RegionDef {
    id: string;
    code: string;
    name: string;
}

const REGIONS: RegionDef[] = [
    { id: '*',   code: 'ALL', name: 'Any region' },
    { id: 'NY',  code: 'NY',  name: 'New York' },
    { id: 'DAL', code: 'DAL', name: 'Dallas' },
    { id: 'SV',  code: 'SV',  name: 'Silicon Valley' },
    { id: 'BRZ', code: 'BRZ', name: 'Brazil' },
    { id: 'FRA', code: 'FRA', name: 'Frankfurt' },
    { id: 'BHN', code: 'BHN', name: 'Middle East' },
    { id: 'MBI', code: 'MBI', name: 'Mumbai' },
    { id: 'SIN', code: 'SIN', name: 'Singapore' },
    { id: 'TOK', code: 'TOK', name: 'Tokyo' },
    { id: 'SYD', code: 'SYD', name: 'Sydney' }
];

export default class QuickPlayRegionsUI extends UI {
    name = 'Quick Play Regions';
    width = 1100;
    categories = [{ name: '', options: [] }];
    buttons = [
        new Button(this.module, {
            label: 'Back to settings',
            color: 'purple',
            name: '',
            description: '',
            id: '',
            onChange: () => { window.showWindow?.(1); }
        })
    ];

    constructor(module: QuickPlay) { super(module); }

    open() {
        const windowHolder = document.getElementById('windowHolder');
        const menuWindow = document.getElementById('menuWindow');
        if (!windowHolder || !menuWindow) return;

        this.injectSimplePinkStyles();

        windowHolder.className = 'popupWin';
        menuWindow.style.width = this.width + 'px';
        menuWindow.className = 'dark';
        menuWindow.innerHTML = '';

        if (this.name) {
            const header = document.createElement('div');
            header.id = 'referralHeader';
            header.textContent = this.name;
            menuWindow.append(header);
        }

        const holder = document.createElement('div');
        holder.id = 'settHolder';
        menuWindow.append(holder);

        this.injectGrid(holder);

        for (const button of this.buttons) menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }

    injectSimplePinkStyles() {
        if (document.getElementById('quickplay-simple-pink')) return;
        
        const style = document.createElement('style');
        style.id = 'quickplay-simple-pink';
        style.textContent = `
            .quickplay-simple-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 8px;
                padding: 12px 0;
            }
            
            .quickplay-simple-item {
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
            
            .quickplay-simple-item:hover {
                background: rgba(44, 7, 32, 0.7);
                border-color: rgba(255, 20, 147, 0.5);
            }
            
            .quickplay-simple-item.is-selected {
                background: rgba(255, 20, 147, 0.15);
                border-color: #FF1493;
                color: #FFE5FA;
            }
        `;
        document.head.appendChild(style);
    }

    private injectGrid(holder: HTMLElement) {
        let selected = config.get('quickplay.selectedRegions', ['*']) as string[];
        let pings: Record<string, number> = {};

        // Action buttons
        const actionBar = document.createElement('div');
        actionBar.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';
        
        const pingBtn = document.createElement('button');
        pingBtn.textContent = 'Ping All Regions';
        pingBtn.style.cssText = `
            padding: 8px 16px;
            background: rgba(100, 150, 255, 0.15);
            border: 1px solid rgba(100, 150, 255, 0.4);
            color: #fff;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            transition: none;
        `;
        pingBtn.addEventListener('click', async () => {
            pingBtn.textContent = 'Pinging...';
            pingBtn.disabled = true;
            try {
                const result = await ipcRenderer.invoke('quickplay-ping-regions');
                if (result && typeof result === 'object') {
                    pings = result;
                }
            } catch (e) {
                console.warn('[Water] Ping refresh failed:', e);
            }
            pingBtn.textContent = 'Ping All Regions';
            pingBtn.disabled = false;
            renderGrid();
        });
        
        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.style.cssText = `
            padding: 8px 16px;
            background: rgba(0, 200, 100, 0.15);
            border: 1px solid rgba(0, 200, 100, 0.4);
            color: #fff;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            transition: none;
        `;
        selectAllBtn.addEventListener('click', () => {
            selected = REGIONS.filter(r => r.id !== '*').map(r => r.id);
            config.set('quickplay.selectedRegions', selected);
            renderGrid();
        });
        
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText = `
            padding: 8px 16px;
            background: rgba(200, 0, 0, 0.15);
            border: 1px solid rgba(200, 0, 0, 0.4);
            color: #fff;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            transition: none;
        `;
        clearBtn.addEventListener('click', () => {
            selected = ['*'];
            config.set('quickplay.selectedRegions', selected);
            renderGrid();
        });
        
        const anyBtn = document.createElement('button');
        anyBtn.textContent = 'Any';
        anyBtn.style.cssText = `
            padding: 8px 16px;
            background: rgba(100, 150, 255, 0.15);
            border: 1px solid rgba(100, 150, 255, 0.4);
            color: #fff;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            transition: none;
        `;
        anyBtn.addEventListener('click', () => {
            selected = ['*'];
            config.set('quickplay.selectedRegions', selected);
            renderGrid();
        });
        
        actionBar.appendChild(pingBtn);
        actionBar.appendChild(selectAllBtn);
        actionBar.appendChild(clearBtn);
        actionBar.appendChild(anyBtn);
        holder.appendChild(actionBar);

        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-simple-grid';
        holder.appendChild(gridContainer);

        const renderGrid = () => {
            gridContainer.innerHTML = REGIONS.map(r => {
                const isSelected = selected.indexOf(r.id) >= 0;
                return `
                    <div class="quickplay-simple-item ${isSelected ? 'is-selected' : ''}" data-id="${r.id}">
                        ${r.name}
                    </div>
                `;
            }).join('');

            gridContainer.querySelectorAll('.quickplay-simple-item').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.getAttribute('data-id');
                    if (!id) return;
                    
                    if (id === '*') {
                        selected = selected.indexOf('*') >= 0 ? [] : ['*'];
                    } else {
                        const anyIdx = selected.indexOf('*');
                        if (anyIdx >= 0) selected.splice(anyIdx, 1);
                        const idx = selected.indexOf(id);
                        if (idx >= 0) selected.splice(idx, 1);
                        else selected.push(id);
                        if (selected.length === 0) selected = ['*'];
                    }
                    
                    config.set('quickplay.selectedRegions', selected);
                    renderGrid();
                });
            });
        };

        renderGrid();

        // Auto-trigger ping on open
        ipcRenderer.invoke('quickplay-ping-regions').then((result: any) => {
            if (result && typeof result === 'object') {
                pings = result;
                renderGrid();
            }
        }).catch(() => {});
    }
}
