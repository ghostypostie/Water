"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const https_1 = require("https");
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const manager_1 = __importDefault(require("../module/manager"));
const electron_1 = require("electron");
class MatchmakerFix extends module_1.default {
    enabled = false;
    id = 'mmfix';
    name = 'Matchmaker Fix';
    options = [];
    contexts = [
        {
            context: context_1.Context.Startup,
            runAt: context_1.RunAt.LoadEnd,
        },
    ];
    main() {
        if (!this.enabled)
            return;
        electron_1.protocol.registerBufferProtocol('mmfix', (r, callback) => {
            let url = new URL(r.url);
            url.pathname = '/mm' + url.pathname;
            url.hostname = 'fra.browserfps.com';
            let req = (0, https_1.request)(url.href.replace('mmfix://', 'https://'), {
                method: r.method,
                headers: {
                    ...r.headers,
                    referer: 'https://krunker.io/',
                },
            }, (res) => {
                let data = Buffer.alloc(0);
                res.on('data', (chunk) => (data = Buffer.concat([data, chunk])));
                res.on('end', () => {
                    if (res.statusCode !== 200)
                        return callback({
                            data: Buffer.alloc(0),
                            statusCode: 500,
                        });
                    callback({
                        data,
                        statusCode: 200,
                    });
                });
                res.on('error', () => callback({ statusCode: 500 }));
            });
            if (r.uploadData) {
                for (let i = 0; i < r.uploadData.length; i++)
                    req.write(r.uploadData[i]);
            }
            req.end();
            req.on('error', () => callback({ statusCode: 500 }));
        });
        manager_1.default.registerBeforeRequestCallback((details, callback) => {
            if (!details.url)
                return callback({ cancel: false });
            let url = new URL(details.url);
            if (url.hostname === 'matchmaker.krunker.io') {
                return callback({
                    redirectURL: 'mmfix://' + url.hostname + url.pathname + url.search,
                });
            }
            return callback({ cancel: false });
        });
    }
}
exports.default = MatchmakerFix;
