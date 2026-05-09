import UI from './index';
import Button from '../options/button';
import QuickPlay from '../modules/quickplay';
import config from '../config';

interface GamemodeDef {
    id: string;
    name: string;
    family: string;
}

const GAMEMODES: GamemodeDef[] = [
    { id: '*',                 name: 'Any',                family: 'all' },
    { id: 'ffa',               name: 'Free For All',       family: 'core' },
    { id: 'tdm',               name: 'Team Deathmatch',    family: 'core' },
    { id: 'point',             name: 'Hardpoint',          family: 'core' },
    { id: 'ctf',               name: 'Capture the Flag',   family: 'core' },
    { id: 'parkour',           name: 'Parkour',            family: 'movement' },
    { id: 'hide_and_seek',     name: 'Hide & Seek',        family: 'casual' },
    { id: 'infected',          name: 'Infected',           family: 'casual' },
    { id: 'race',              name: 'Race',               family: 'movement' },
    { id: 'lms',               name: 'Last Man Standing',  family: 'core' },
    { id: 'simon',             name: 'Simon Says',         family: 'casual' },
    { id: 'gun_game',          name: 'Gun Game',           family: 'casual' },
    { id: 'prop',              name: 'Prop Hunt',          family: 'casual' },
    { id: 'boss_hunt',         name: 'Boss Hunt',          family: 'casual' },
    { id: 'classic_ffa',       name: 'Classic FFA',        family: 'core' },
    { id: 'deposit',           name: 'Deposit',            family: 'objective' },
    { id: 'stalker',           name: 'Stalker',            family: 'casual' },
    { id: 'koth',              name: 'King of the Hill',   family: 'objective' },
    { id: 'one_in_the_chamber',name: 'One in the Chamber', family: 'casual' },
    { id: 'trade',             name: 'Trade',              family: 'casual' },
    { id: 'kill_confirmed',    name: 'Kill Confirmed',     family: 'core' },
    { id: 'defuse',            name: 'Defuse',             family: 'objective' },
    { id: 'sharp_shooter',     name: 'Sharp Shooter',      family: 'core' },
    { id: 'traitor',           name: 'Traitor',            family: 'casual' },
    { id: 'raid',              name: 'Raid',               family: 'objective' },
    { id: 'blitz',             name: 'Blitz',              family: 'core' },
    { id: 'domination',        name: 'Domination',         family: 'objective' },
    { id: 'squad_deathmatch',  name: 'Squad Deathmatch',   family: 'core' },
    { id: 'kranked_ffa',       name: 'Kranked FFA',        family: 'core' },
    { id: 'team_defender',     name: 'Team Defender',      family: 'objective' },
    { id: 'deposit_ffa',       name: 'Deposit FFA',        family: 'core' },
    { id: 'chaos_snipers',     name: 'Chaos Snipers',      family: 'casual' },
    { id: 'bighead_ffa',       name: 'Bighead FFA',        family: 'casual' }
];

const FAMILY_LABELS: Record<string, string> = {
    all: 'All',
    core: 'Core',
    objective: 'Objective',
    casual: 'Casual',
    movement: 'Movement'
};

export default class QuickPlayGamemodesUI extends UI {
    name = 'Quick Play Gamemodes';
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
        let selected = (config.get('quickplay.selectedGamemodes', this.module.config.get('quickplay.selectedGamemodes', ['*']) as any) as string[]);

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
            selected = GAMEMODES.filter(g => g.id !== '*').map(g => g.id);
            config.set('quickplay.selectedGamemodes', selected);
            this.module.config.set('quickplay.selectedGamemodes', selected);
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
            config.set('quickplay.selectedGamemodes', selected);
            this.module.config.set('quickplay.selectedGamemodes', selected);
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
            config.set('quickplay.selectedGamemodes', selected);
            this.module.config.set('quickplay.selectedGamemodes', selected);
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
            gridContainer.innerHTML = GAMEMODES.map(g => {
                const isSelected = selected.indexOf(g.id) >= 0;
                return `
                    <div class="quickplay-simple-item ${isSelected ? 'is-selected' : ''}" data-id="${g.id}">
                        ${g.name}
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
                    
                    config.set('quickplay.selectedGamemodes', selected);
            this.module.config.set('quickplay.selectedGamemodes', selected);
                    renderGrid();
                });
            });
        };

        renderGrid();
    }
}
