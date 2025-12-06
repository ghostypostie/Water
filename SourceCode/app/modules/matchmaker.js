let { request } = require('https');
const Store = require('electron-store');
const config = new Store();

module.exports = function (window) {
    if (!config.get('betterMatchmaker.enable', false)) {
        console.log('[Water] Better Matchmaker disabled, loading normal Krunker');
        return window.loadURL('https://krunker.io');
    }

    console.log('[Water] Better Matchmaker enabled, searching for games...');

    let req = request('https://matchmaker.krunker.io/game-list?hostname=krunker.io', res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async _ => {
            try {
                let games = JSON.parse(data);

                // Get default region from user's localStorage
                let defaultRegion = await window.webContents.executeJavaScript('localStorage.getItem("kro_setngss_defaultRegion")') || 'de-fra';

                let regions = config.get('betterMatchmaker.regions', []);

                // If "Default" (0) is selected, replace it with the user's actual default region
                if (regions.includes(0)) {
                    regions = regions.filter(r => r !== 0);
                    if (!regions.includes(defaultRegion)) {
                        regions.push(defaultRegion);
                    }
                }

                if (!games.games) {
                    console.log('[Water] No games data received from matchmaker');
                    return window.loadURL('https://krunker.io');
                }

                // Filter games
                games = games.games;

                // Filter by region
                if (regions.length > 0) {
                    games = games.filter(game => regions.includes(game[1]));
                }

                // Filter by player count
                const minPlayers = config.get('betterMatchmaker.minPlayers', 0);
                const maxPlayers = config.get('betterMatchmaker.maxPlayers', 8);
                games = games.filter(game => game[2] >= minPlayers && game[2] <= maxPlayers);

                // Filter custom games
                const allowCustoms = config.get('betterMatchmaker.allowCustoms', false);
                games = games.filter(game => game[4].c === (allowCustoms ? 1 : 0));

                // Filter official custom games
                const allowOfficialCustoms = config.get('betterMatchmaker.allowOfficialCustoms', false);
                if (allowOfficialCustoms) {
                    // Allow any game that has official custom flag
                    games = games.filter(game => game[4].oc === 1);
                } else {
                    // Exclude official customs (allow undefined or 0)
                    games = games.filter(game => game[4].oc !== 1);
                }

                // Filter by map
                const maps = config.get('betterMatchmaker.maps', []);
                if (maps.length > 0) {
                    games = games.filter(game => maps.includes(game[4].i));
                }

                // Filter by mode
                const modes = config.get('betterMatchmaker.modes', []);
                if (modes.length > 0) {
                    games = games.filter(game => modes.includes(game[4].g));
                }

                // Filter by time remaining
                const minTime = config.get('betterMatchmaker.minTime', 2); // minutes
                games = games.filter(game => game[5] >= (minTime * 60));

                // Sort by players (desc) and time left (desc)
                games = games.sort((a, b) => (b[2] - a[2]) || (b[5] - a[5]));

                console.log('[Water] Found', games.length, 'matching games');
                if (games[0]) {
                    console.log('[Water] Joining best game:', games[0]);
                }

                if (!games[0]) {
                    console.log('[Water] No matching games found, loading homepage');
                    return window.loadURL('https://krunker.io');
                }

                window.loadURL('https://krunker.io/?game=' + games[0][0]);
            } catch (e) {
                console.error('[Water] Matchmaker error:', e);
                window.loadURL('https://krunker.io');
            }
        });
        res.on('error', err => {
            console.error('[Water] Matchmaker request error:', err);
            window.loadURL('https://krunker.io');
        });
    });
    req.on('error', _ => {
        console.error('[Water] Matchmaker connection error');
        window.loadURL('https://krunker.io');
    });
    req.end();
}
