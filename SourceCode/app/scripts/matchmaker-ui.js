const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const config = new Store();
const matchmakerConstants = require('../constants/matchmaker');

function openMatchmakerUI() {
    const menuWindow = document.getElementById('menuWindow');
    if (!menuWindow) return;

    menuWindow.innerHTML = `
        <div class="button buttonG" style="width:calc(100% - 55px);padding:12px 16px;position:relative;left:50%;transform:translateX(-50%)" 
             onmouseenter="playTick()" onclick="showWindow(0),showWindow(1)">
            Back to settings
        </div>
        <div class="settingsHeader" style="position:unset">
            <div style="padding-top:10px;padding-right:10px;text-align:right;float:right"></div>
            <div id="allOn" class="settingsBtn">All on</div>
            <div id="allOff" class="settingsBtn">All off</div>
            <div id="togAll" class="settingsBtn">Toggle</div>
        </div>
        <div id="matchmakerSett" style="display:inline-block" class="setBodH"></div>
    `;

    const windowHolder = document.getElementById('windowHolder');
    windowHolder.style.display = 'block';
    windowHolder.classList = 'popupWin';
    menuWindow.style.width = '1000px';
    menuWindow.style.overflowY = 'auto';
    menuWindow.classList = 'dark';
}

window.openMatchmakerModes = () => {
    openMatchmakerUI();
    const matchmakerSett = document.getElementById('matchmakerSett');
    const gamemodes = matchmakerConstants.gamemodes;

    for (let mode in gamemodes) {
        const sett = document.createElement('div');
        sett.classList = 'settName';
        sett.innerHTML = `${mode} <label class="switch" style="margin-left:10px">
            <input type="checkbox">
            <span class="slider" style="width: 65px"><span class="grooves"></span></span>
        </label>`;

        let modes = config.get('betterMatchmaker.modes', []);
        sett.getElementsByTagName('input')[0].checked = modes.includes(gamemodes[mode]);
        sett.getElementsByTagName('input')[0].addEventListener('change', e => {
            modes = config.get('betterMatchmaker.modes', []);
            if (e.target.checked && !modes.includes(gamemodes[mode])) {
                modes.push(gamemodes[mode]);
            } else if (!e.target.checked && modes.includes(gamemodes[mode])) {
                modes.splice(modes.indexOf(gamemodes[mode]), 1);
            }
            config.set('betterMatchmaker.modes', modes);
        });
        matchmakerSett.appendChild(sett);
    }

    document.getElementById('allOn').addEventListener('click', () => {
        [...document.getElementById('matchmakerSett').getElementsByTagName('input')].forEach(input => input.checked = true);
        config.set('betterMatchmaker.modes', Object.values(gamemodes));
    });

    document.getElementById('allOff').addEventListener('click', () => {
        [...document.getElementById('matchmakerSett').getElementsByTagName('input')].forEach(input => input.checked = false);
        config.set('betterMatchmaker.modes', []);
    });

    document.getElementById('togAll').addEventListener('click', () => {
        [...document.getElementById('matchmakerSett').getElementsByTagName('input')].forEach(input => input.checked = !input.checked);
        let modes = config.get('betterMatchmaker.modes', []);
        let newModes = [];
        for (let mode in gamemodes) {
            if (!modes.includes(gamemodes[mode])) newModes.push(gamemodes[mode]);
        }
        config.set('betterMatchmaker.modes', newModes);
    });
};

window.openMatchmakerMaps = () => {
    openMatchmakerUI();
    const matchmakerSett = document.getElementById('matchmakerSett');
    const maps = matchmakerConstants.maps;

    for (let map of maps) {
        const sett = document.createElement('div');
        sett.classList = 'settName';
        sett.innerHTML = `${map} <label class="switch" style="margin-left:10px">
            <input type="checkbox">
            <span class="slider" style="width: 65px"><span class="grooves"></span></span>
        </label>`;

        sett.getElementsByTagName('input')[0].checked = config.get('betterMatchmaker.maps', []).includes(map);
        sett.getElementsByTagName('input')[0].addEventListener('change', e => {
            let maps1 = config.get('betterMatchmaker.maps', []);
            if (e.target.checked && !maps1.includes(map)) {
                maps1.push(map);
            } else if (!e.target.checked && maps1.includes(map)) {
                maps1.splice(maps1.indexOf(map), 1);
            }
            config.set('betterMatchmaker.maps', maps1);
        });
        matchmakerSett.appendChild(sett);
    }

    document.getElementById('allOn').addEventListener('click', () => {
        [...document.getElementById('matchmakerSett').getElementsByTagName('input')].forEach(input => input.checked = true);
        config.set('betterMatchmaker.maps', maps);
    });

    document.getElementById('allOff').addEventListener('click', () => {
        [...document.getElementById('matchmakerSett').getElementsByTagName('input')].forEach(input => input.checked = false);
        config.set('betterMatchmaker.maps', []);
    });

    document.getElementById('togAll').addEventListener('click', () => {
        [...document.getElementById('matchmakerSett').getElementsByTagName('input')].forEach(input => input.checked = !input.checked);
        let maps1 = config.get('betterMatchmaker.maps', []);
        let newMaps = [];
        for (let map of maps) {
            if (!maps1.includes(map)) newMaps.push(map);
        }
        config.set('betterMatchmaker.maps', newMaps);
    });
};

window.openMatchmakerRegions = () => {
    openMatchmakerUI();
    const matchmakerSett = document.getElementById('matchmakerSett');
    const regions = matchmakerConstants.regions;

    for (let region in regions) {
        const sett = document.createElement('div');
        sett.classList = 'settName';
        const displayName = regions[region] == 0
            ? `${region} (${Object.keys(regions).find(r => regions[r] == (window.localStorage.getItem('kro_setngss_defaultRegion') || 'de-fra'))})`
            : region;
        sett.innerHTML = `${displayName} <label class="switch" style="margin-left:10px">
            <input type="checkbox">
            <span class="slider" style="width: 65px"><span class="grooves"></span></span>
        </label>`;

        sett.getElementsByTagName('input')[0].checked = config.get('betterMatchmaker.regions', []).includes(regions[region]);
        sett.getElementsByTagName('input')[0].addEventListener('change', e => {
            let regions1 = config.get('betterMatchmaker.regions', []);
            if (e.target.checked && !regions1.includes(regions[region])) {
                regions1.push(regions[region]);
            } else if (!e.target.checked && regions1.includes(regions[region])) {
                regions1.splice(regions1.indexOf(regions[region]), 1);
            }
            config.set('betterMatchmaker.regions', regions1);
        });
        matchmakerSett.appendChild(sett);
    }

    document.getElementById('allOn').addEventListener('click', () => {
        [...document.getElementById('matchmakerSett').getElementsByTagName('input')].forEach(input => input.checked = true);
        config.set('betterMatchmaker.regions', Object.values(regions));
    });

    document.getElementById('allOff').addEventListener('click', () => {
        [...document.getElementById('matchmakerSett').getElementsByTagName('input')].forEach(input => input.checked = false);
        config.set('betterMatchmaker.regions', []);
    });

    document.getElementById('togAll').addEventListener('click', () => {
        [...document.getElementById('matchmakerSett').getElementsByTagName('input')].forEach(input => input.checked = !input.checked);
        let regions1 = config.get('betterMatchmaker.regions', []);
        let newRegions = [];
        for (let region in regions) {
            if (!regions1.includes(regions[region])) newRegions.push(regions[region]);
        }
        config.set('betterMatchmaker.regions', newRegions);
    });
};
