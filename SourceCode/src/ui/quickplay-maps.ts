import UI from './index';
import Button from '../options/button';
import QuickPlay from '../modules/quickplay';
import config from '../config';

interface MapDef {
    id: string;
    family: string;
}

const MAPS: MapDef[] = [
    { id: '*',                family: 'all' },
    { id: 'Burg',             family: 'classic' },
    { id: 'Littletown',       family: 'classic' },
    { id: 'Sandstorm',        family: 'classic' },
    { id: 'Subzero',          family: 'classic' },
    { id: 'Undergrowth',      family: 'classic' },
    { id: 'Shipment',         family: 'compact' },
    { id: 'Freight',          family: 'classic' },
    { id: 'Lostworld',        family: 'classic' },
    { id: 'Citadel',          family: 'classic' },
    { id: 'Oasis',            family: 'classic' },
    { id: 'Kanji',            family: 'classic' },
    { id: 'Industry',         family: 'classic' },
    { id: 'Lumber',           family: 'classic' },
    { id: 'Evacuation',       family: 'classic' },
    { id: 'Site',             family: 'classic' },
    { id: 'SkyTemple',        family: 'classic' },
    { id: 'Lagoon',           family: 'classic' },
    { id: 'Bureau',           family: 'classic' },
    { id: 'Tortuga',          family: 'classic' },
    { id: 'Tropicano',        family: 'classic' },
    { id: 'Krunk_Plaza',      family: 'classic' },
    { id: 'Arena',            family: 'compact' },
    { id: 'Habitat',          family: 'classic' },
    { id: 'Atomic',           family: 'classic' },
    { id: 'Old_Burg',         family: 'legacy' },
    { id: 'Throwback',        family: 'legacy' },
    { id: 'Stockade',         family: 'classic' },
    { id: 'Facility',         family: 'classic' },
    { id: 'Clockwork',        family: 'classic' },
    { id: 'Laboratory',       family: 'classic' },
    { id: 'Shipyard',         family: 'classic' },
    { id: 'Soul Sanctum',     family: 'classic' },
    { id: 'Bazaar',           family: 'classic' },
    { id: 'Erupt',            family: 'classic' },
    { id: 'HQ',               family: 'compact' },
    { id: 'Khepri',           family: 'classic' },
    { id: 'Lush',             family: 'classic' },
    { id: 'Viva',             family: 'classic' },
    { id: 'Slide Moonlight',  family: 'parkour' },
    { id: 'Eterno Simulator', family: 'parkour' },
    { id: 'Stalk Factory',    family: 'classic' },
    { id: 'Eterno_jump',      family: 'parkour' }
];

const MAP_FAMILIES: Record<string, string> = {
    all: 'All',
    classic: 'Classic',
    compact: 'Compact',
    parkour: 'Parkour',
    legacy: 'Legacy'
};

const formatName = (id: string): string => {
    if (id === '*') return 'Any';
    return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default class QuickPlayMapsUI extends UI {
    name = 'Quick Play Maps';
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
        let selected = config.get('quickplay.selectedMaps', ['*']) as string[];

        // Action buttons
        const actionBar = document.createElement('div');
        actionBar.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';
        
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
            selected = MAPS.filter(m => m.id !== '*').map(m => m.id);
            config.set('quickplay.selectedMaps', selected);
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
            config.set('quickplay.selectedMaps', selected);
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
            config.set('quickplay.selectedMaps', selected);
            renderGrid();
        });
        
        actionBar.appendChild(selectAllBtn);
        actionBar.appendChild(clearBtn);
        actionBar.appendChild(anyBtn);
        holder.appendChild(actionBar);

        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-simple-grid';
        holder.appendChild(gridContainer);

        const renderGrid = () => {
            gridContainer.innerHTML = MAPS.map(m => {
                const isSelected = selected.indexOf(m.id) >= 0;
                const name = formatName(m.id);
                return `
                    <div class="quickplay-simple-item ${isSelected ? 'is-selected' : ''}" data-id="${m.id}">
                        ${name}
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
                    
                    config.set('quickplay.selectedMaps', selected);
                    renderGrid();
                });
            });
        };

        renderGrid();
    }
}
