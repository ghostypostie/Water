"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const checkbox_1 = __importDefault(require("../options/checkbox"));
const manager_1 = __importDefault(require("../module/manager"));
const https_1 = require("https");
class AdBlock extends module_1.default {
    hostsURL = 'https://blocklistproject.github.io/Lists/ads.txt';
    hosts = [];
    id = 'adblock';
    name = 'Ad Block';
    options = [
        new checkbox_1.default(this, {
            name: 'Enabled',
            id: 'enabled',
            description: 'Blocks video and banner advertisements.',
        }),
    ];
    contexts = [
        {
            context: context_1.Context.Startup,
            runAt: context_1.RunAt.LoadStart,
        },
    ];
    main() {
        (0, https_1.request)(this.hostsURL, async (res) => {
            let data = Buffer.alloc(0);
            res.on('data', (chunk) => (data = Buffer.concat([data, chunk])));
            let fetched = await new Promise((resolve, reject) => {
                res.on('end', () => resolve(true));
                res.on('error', reject);
            }).catch(() => false);
            if (!fetched)
                return;
            let lines = data.toString().split('\n');
            for (let line of lines) {
                if (line.startsWith('#'))
                    continue;
                line = line.trim();
                let [ip, host] = line.split(' ');
                if (ip !== '0.0.0.0')
                    continue;
                this.hosts.push(host);
            }
        })
            .end()
            .on('error', () => { });
        manager_1.default.registerBeforeRequestCallback((details, callback) => {
            if (!details.url)
                return callback({ cancel: false });
            let url = new URL(details.url);
            if (url.hostname === 'coeus.frvr.com')
                return callback({ cancel: true });
            if (!this.config.get('enabled', false))
                return callback({ cancel: false });
            if (url.protocol !== 'http:' && url.protocol !== 'https:')
                return callback({ cancel: false });
            if (!this.hosts.includes(url.hostname))
                return callback({ cancel: false });
            return callback({ cancel: true });
        });
    }
}
exports.default = AdBlock;
