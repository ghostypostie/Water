"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const manager_1 = __importDefault(require("../module/manager"));
const path_1 = require("path");
const fs_1 = require("fs");
const checkbox_1 = __importDefault(require("../options/checkbox"));
const paths_1 = require("../utils/paths");
class ResourceSwapper extends module_1.default {
    id = 'resourceswapper';
    name = 'Resource Swapper';
    path;
    contexts = [
        {
            context: context_1.Context.Startup,
            runAt: context_1.RunAt.LoadEnd,
        },
    ];
    options = [
        new checkbox_1.default(this, {
            name: 'Enabled',
            description: 'Swaps game resources with ones from the resource swapper folder.',
            id: 'enabled',
        }),
        new checkbox_1.default(this, {
            name: 'Enable Userscripts',
            description: 'Allow custom JavaScript scripts to run',
            id: 'enableUserscripts',
            needsRestart: true,
            defaultValue: true,
        }),
    ];
    main() {
        this.path = (0, paths_1.getSwapPath)();
        console.log('[ResourceSwapper] Using Swap path:', this.path);
        electron_1.protocol.registerFileProtocol('client-swapper', (request, callback) => {
            let url = new URL(request.url);
            callback({ path: (0, path_1.join)(this.path, url.pathname) });
        });
        manager_1.default.registerBeforeRequestCallback((details, callback) => {
            if (!this.config.get('enabled', false))
                return callback({ cancel: false });
            if (!(0, fs_1.existsSync)(this.path))
                (0, fs_1.mkdirSync)(this.path, { recursive: true });
            if (!details.url)
                return callback({ cancel: false });
            let url = new URL(details.url);
            if ((!url.hostname.endsWith('krunker.io') &&
                !url.hostname.endsWith('browserfps.com')) ||
                !(0, fs_1.existsSync)((0, path_1.join)(this.path, url.pathname)) ||
                !(0, fs_1.statSync)((0, path_1.join)(this.path, url.pathname)).isFile())
                return callback({ cancel: false });
            return callback({
                redirectURL: 'client-swapper://' + url.pathname,
            });
        });
    }
}
exports.default = ResourceSwapper;
