"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
class BetterConsole extends module_1.default {
    name = 'Better Console';
    id = 'betterconsole';
    options = [];
    contexts = [
        {
            context: context_1.Context.Startup,
            runAt: context_1.RunAt.LoadStart,
        },
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadStart,
        },
    ];
    main() {
        const originalLog = console.log;
        let timeString = () => {
            let date = new Date();
            let hours = date.getHours().toString().padStart(2, '0');
            let minutes = date.getMinutes().toString().padStart(2, '0');
            let seconds = date.getSeconds().toString().padStart(2, '0');
            let milliseconds = date
                .getMilliseconds()
                .toString()
                .padStart(3, '0');
            return `${hours}:${minutes}:${seconds}.${milliseconds}`;
        };
        electron_1.ipcMain.on('log', (event, type, ...args) => {
            originalLog('\x1b[33m' +
                timeString() +
                ' \x1b[36mRENDERER \x1b[0m>\x1b[' +
                (type == 'error' ? '31' : '0') +
                'm', ...args, '\x1b[0m');
        });
        console = new Proxy(console, {
            get: (target, prop) => {
                if (!['log', 'info', 'error'].includes(prop))
                    return Reflect.get(target, prop);
                return (...args) => {
                    originalLog('\x1b[33m' +
                        timeString() +
                        ' \x1b[35mMAIN     \x1b[0m>\x1b[' +
                        (prop == 'error' ? '31' : '0') +
                        'm', ...args, '\x1b[0m');
                };
            },
        });
    }
    renderer() {
        window.console = new Proxy(window.console, {
            set: (target, prop, value) => {
                if (!['log', 'info', 'error'].includes(prop))
                    return true;
                return Reflect.set(target, prop, value);
            },
            get: (target, prop) => {
                if (!['log', 'info', 'error'].includes(prop))
                    return Reflect.get(target, prop);
                return (...args) => {
                    try {
                        electron_1.ipcRenderer.send('log', prop, ...args);
                    }
                    catch { }
                    Reflect.get(target, prop)(...args);
                    return Reflect.get(target, prop);
                };
            },
        });
    }
}
exports.default = BetterConsole;
