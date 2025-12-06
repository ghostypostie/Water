const Store = require('electron-store');
const https = require('https');
const config = new Store();

const DEFAULT_ADBLOCK_URL = 'https://blocklistproject.github.io/Lists/ads.txt';

let adblockURL;
let cachedAdblock = [];

async function adblock(details) {
    if (!details.url.startsWith('http:') && !details.url.startsWith('https:')) {
        return { cancel: false };
    }

    let currentURL = config.get('adblockURL', DEFAULT_ADBLOCK_URL);

    if (adblockURL !== currentURL) {
        cachedAdblock = await new Promise(resolve => {
            https.get(currentURL, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const blocklist = data.split('\n')
                        .filter(x => x && x.startsWith('0.0.0.0 '))
                        .map(x => x.split(' ')[1]);
                    resolve(blocklist);
                });
            }).on('error', () => resolve([])).end();
        });
        console.log('[Water] Adblock list updated:', cachedAdblock.length, 'entries');
        adblockURL = currentURL;
    }

    if (!cachedAdblock) {
        return { cancel: false };
    }

    try {
        const hostname = new URL(details.url).hostname;
        if (cachedAdblock.includes(hostname)) {
            console.log('[Water] Blocked ad:', hostname);
            return { cancel: true };
        }
    } catch (e) {
        // Invalid URL, allow it
    }

    return { cancel: false };
}

module.exports = adblock;
