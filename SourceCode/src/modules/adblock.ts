import { Context, RunAt } from '../context';
import Module from '../module';
import Checkbox from '../options/checkbox';
import Manager from '../module/manager';
import { request } from 'https';

export default class AdBlock extends Module {
    hostsURL = 'https://blocklistproject.github.io/Lists/ads.txt';
    hosts: string[] = [];
    
    // URL pattern blocklist
    urlBlocklist: string[] = [
        "*://*.pollfish.com/*",
        "*://*.paypalobjects.com/*",
        "*://c.amazon-adsystem.com/*",
        "*://config.aps.amazon-adsystem.com/*",
        "*://securepubads.g.doubleclick.net/*",
        "*://cookiepro.com/*",
        "*://*.cookiepro.com/*",
        "*://cdn.ravenjs.com/*",
        "*://*.poll.fish/*",
        "*://*.paypal.com/*",
        "*://*.twitter.com/*",
        "*://*.youtube.com/*",
        "*://*.doubleclick.net/*",
        "*://unpkg.com/web3*",
        "*://storage.googleapis.com/pollfish_production/*",
        "*://*.googletagmanager.com/*",
        "*://apis.google.com/js/platform.js",
        "*://imasdk.googleapis.com/*",
        "*://*.googlesyndication.com/*",
        "*://www.google-analytics.com/*",
        "*://krunker.io/manifest.json*",
        "*://krunker.io/css/google-play.css*",
        "*://krunker.io/img/btc_icn.png*",
        "*://krunker.io/img/app_1.png*",
        "*://krunker.io/img/app_0.png.png*",
        "*://krunker.io/libs/chart.bundle*",
        "*://krunker.io/img/muzflash.png*",
        "*://krunker.io/service-worker.js*",
        "*://krunker.io/libs/fflate*",
        "*://krunker.io/libs/purejscarousel*",
        "*://assets.krunker.io/sound/ambient_*",
        "*://assets.krunker.io/models/clouds_0.obj*",
        "*://assets.krunker.io/models/police_0.obj*",
        "*://assets.krunker.io/models/vehicle_0.obj*",
        "*://krunker.io/img/client.png*",
        "*://krunker.io/libs/nipplejs.min.js*",
        "*://user-assets.krunker.io/60585/*",
        "*://fran-cdn.frvr.com/prebid*",
        "*://cdn.frvr.com/fran/prebid*",
        "*://krunker.io/libs/anzu.js*",
        "*://user-assets.krunker.io/40295/model.obj*",
        "*://user-assets.krunker.io/61822/model.obj*",
        "*://user-assets.krunker.io/61818/model.obj*",
        "*://user-assets.krunker.io/61814/model.obj*",
        "*://user-assets.krunker.io/61824/model.obj*",
        "*://user-assets.krunker.io/61815/model.obj*",
        "*://user-assets.krunker.io/61820/model.obj*",
        "*://user-assets.krunker.io/61821/model.obj*",
        "*://user-assets.krunker.io/61806/model.obj*",
        "*://user-assets.krunker.io/61823/model.obj*",
        "*://assets.krunker.io/img/death_2_1.png*",
    ];

    // Turf War stand blocklist
    turfWarBlocklist: string[] = [
        'user-assets.krunker.io/64295/model.png',
        'user-assets.krunker.io/64295/model.obj',
        'user-assets.krunker.io/64301/model.png',
        'user-assets.krunker.io/64301/model.obj',
        'user-assets.krunker.io/64303/model.png',
        'user-assets.krunker.io/64303/model.obj',
        'user-assets.krunker.io/clans/',
    ];

    id = 'adblock';
    name = 'Ad Block';
    priority = 4;
    options = [
        new Checkbox(this, {
            name: 'Enabled',
            id: 'enabled',
            description: 'Blocks video and banner advertisements.',
        }),
        new Checkbox(this, {
            name: 'Remove Turf War Stands',
            id: 'removeTurfWar',
            description: 'Blocks Turf War stand models and clan assets from loading',
            defaultValue: false,
        }),
    ];

    contexts = [
        {
            context: Context.Startup,
            runAt: RunAt.LoadStart,
        },
    ];

    main() {
        request(this.hostsURL, async (res) => {
            let data = Buffer.alloc(0);
            res.on('data', (chunk) => (data = Buffer.concat([data, chunk])));
            let fetched = await new Promise((resolve, reject) => {
                res.on('end', () => resolve(true));
                res.on('error', reject);
            }).catch(() => false);

            if (!fetched) return;
            let lines = data.toString().split('\n');

            for (let line of lines) {
                if (line.startsWith('#')) continue;
                line = line.trim();
                let [ip, host] = line.split(' ');
                if (ip !== '0.0.0.0') continue;
                this.hosts.push(host);
            }
        })
            .end()
            .on('error', () => {});

        Manager.registerBeforeRequestCallback((details, callback) => {
            if (!details.url) return callback({ cancel: false });

            let url = new URL(details.url);

            if (url.hostname === 'coeus.frvr.com')
                return callback({ cancel: true });

            // Check Turf War blocklist (independent of main adblock)
            if (this.config.get('removeTurfWar', false)) {
                if (this.matchesTurfWarBlocklist(details.url)) {
                    return callback({ cancel: true });
                }
            }

            if (!this.config.get('enabled', false))
                return callback({ cancel: false });

            if (url.protocol !== 'http:' && url.protocol !== 'https:')
                return callback({ cancel: false });
            
            // Check URL pattern blocklist first
            if (this.matchesBlocklist(details.url)) {
                return callback({ cancel: true });
            }
            
            // Then check hostname blocklist
            if (!this.hosts.includes(url.hostname))
                return callback({ cancel: false });

            return callback({ cancel: true });
        });
    }

    /**
     * Check if a URL matches any pattern in the blocklist
     * Supports wildcards: * matches any characters
     */
    matchesBlocklist(url: string): boolean {
        for (const pattern of this.urlBlocklist) {
            if (this.matchPattern(pattern, url)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a URL matches any pattern in the Turf War blocklist
     */
    matchesTurfWarBlocklist(url: string): boolean {
        for (const pattern of this.turfWarBlocklist) {
            // Check if URL contains the pattern
            if (url.includes(pattern)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Match a URL against a pattern with wildcards
     * Pattern format: *://domain.com/path/*
     */
    matchPattern(pattern: string, url: string): boolean {
        // Convert pattern to regex
        // Escape special regex characters except *
        let regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
            .replace(/\*/g, '.*'); // Convert * to .*
        
        // Add anchors
        regexPattern = '^' + regexPattern + '$';
        
        const regex = new RegExp(regexPattern);
        return regex.test(url);
    }
}