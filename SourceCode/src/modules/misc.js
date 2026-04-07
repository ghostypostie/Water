"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const checkbox_1 = __importDefault(require("../options/checkbox"));
const main_1 = require("../main");
const textinput_1 = __importDefault(require("../options/textinput"));
const slider_1 = __importDefault(require("../options/slider"));
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('Misc');
class Misc extends module_1.default {
    name = 'Miscellaneous';
    id = 'misc';
    options = [
        new checkbox_1.default(this, {
            name: 'Show client watermark',
            description: '',
            id: 'watermark',
            onChange(value) {
                document.body.style.setProperty('--watermark-display', value ? '' : 'none');
            },
            defaultValue: true,
        }),
        new textinput_1.default(this, {
            name: 'Custom Loading Screen',
            description: 'Accepts Direct Image/GIF URLs',
            label: 'https://example.com/image.gif',
            id: 'customLoadingScreen',
            needsRestart: true,
        }),
        new checkbox_1.default(this, {
            name: 'Placebo FPS',
            description: 'Multiply the FPS counter to show a bigger number',
            id: 'placeboFps.enabled',
            onChange: () => this.placeboFps(),
            defaultValue: false,
        }),
        new slider_1.default(this, {
            name: 'Placebo FPS multiplier',
            description: 'How much to multiply the FPS counter',
            id: 'placeboFps.multiplier',
            onChange: () => this.placeboFps(),
            defaultValue: 1,
            min: 1,
            max: 10,
            step: 0.1,
        }),
        new checkbox_1.default(this, {
            name: 'Lock window size',
            description: '',
            id: 'lockWindowSize',
            onChange() {
                electron_1.ipcRenderer.send('updateWindowSizeLock');
            }
        }),
        new textinput_1.default(this, {
            name: 'Window size',
            description: '',
            label: '1920x1080',
            id: 'windowSize',
            onChange() {
                electron_1.ipcRenderer.send('updateWindowSizeLock');
            }
        })
    ];
    contexts = [
        {
            context: context_1.Context.Common,
            runAt: context_1.RunAt.LoadStart,
        },
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadEnd,
        }
    ];
    updateWindowSizeLock() {
        let shouldLock = this.config.get('lockWindowSize', false);
        let [w, h] = this.config.get('windowSize', '0x0').split('x');
        logger.log('updating window lock', w, h);
        main_1.window.setResizable(true);
        if (shouldLock && !isNaN(w) && !isNaN(h)) {
            main_1.window.setSize(parseInt(w), parseInt(h));
            main_1.window.setResizable(false);
        }
    }
    placeboFpsObserver;
    placeboFpsApplied = false;
    placeboFps() {
        let enabled = this.config.get('placeboFps.enabled', false);
        let multiplier = this.config.get('placeboFps.multiplier', 1);
        if (this.placeboFpsObserver)
            this.placeboFpsObserver.disconnect();
        this.placeboFpsObserver = null;
        this.placeboFpsApplied = false;
        if (!enabled)
            return;
        let ingameFPS = document.getElementById('ingameFPS');
        let menuHolder = document.getElementById('menuHolder');
        let menuFPS = document.getElementById('menuFPS');
        if (!ingameFPS)
            return;
        this.placeboFpsObserver = new MutationObserver(() => {
            if (this.placeboFpsApplied) {
                this.placeboFpsApplied = false;
                return;
            }
            let fps = parseFloat(ingameFPS.textContent);
            fps = Math.round(fps * multiplier + Math.random() * multiplier);
            this.placeboFpsApplied = true;
            ingameFPS.textContent = fps + '';
            if (menuHolder.style.display != 'none')
                menuFPS.textContent = fps + '';
        });
        this.placeboFpsObserver.observe(ingameFPS, { childList: true });
    }
    renderer() {
        this.placeboFps();
    }
    main() {
        this.updateWindowSizeLock();
        electron_1.ipcMain.on('updateWindowSizeLock', () => this.updateWindowSizeLock());
    }
}
exports.default = Misc;
