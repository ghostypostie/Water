"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const checkbox_1 = __importDefault(require("../options/checkbox"));
const button_1 = __importDefault(require("../options/button"));
const switches_1 = __importDefault(require("../ui/switches"));
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('Performance');
class SwitchesButton extends button_1.default {
    generate() {
        let container = super.generate();
        let question = document.createElement('sup');
        question.textContent = '[?]';
        question.classList.add('question');
        question.onclick = () => window.open('https://github.com/ghostypostie/Water/wiki/Chromium-Switches');
        container.children[0].children[0].insertAdjacentElement('beforeend', question);
        return container;
    }
}
class Performance extends module_1.default {
    name = 'Performance';
    id = 'performance';
    priority = 1; // Display at the top of settings
    switchList = [
        'renderer-process-limit=100',
        'max-active-webgl-contexts=100',
        'disable-dev-shm-usage',
        'enable-gpu-rasterization',
        'enable-oop-rasterization',
        'enable-webgl',
        'enable-javascript-harmony',
        'enable-future-v8-vm-features',
        'enable-quic',
        'enable-accelerated-2d-canvas',
        'enable-highres-timer',
        'disable-accelerated-video-decode=false',
        'disable-accelerated-video-encode=false',
        'disable-print-preview',
        'disable-metrics-repo',
        'disable-metrics',
        'disable-breakpad',
        'disable-logging',
        'disable-component-update',
        'disable-bundled-ppapi-flash',
        'disable-2d-canvas-clip-aa',
        'disable-hang-monitor',
        'autoplay-policy=no-user-gesture-required',
        'high-dpi-support=1',
        'ignore-gpu-blacklist',
        'disable-background-timer-throttling',
        'disable-renderer-backgrounding',
        'disable-software-rasterizer',
        'enable-zero-copy',
        'enable-native-gpu-memory-buffers',
        'disable-gpu-driver-bug-workarounds',
        'enable-webgl2-compute-context',
        'disable-features=CalculateNativeWinOcclusion',
        'disable-background-networking',
        'disable-sync',
        'disable-extensions',
        'disable-default-apps',
        'no-pings',
        'disable-domain-reliability',
        'disable-client-side-phishing-detection',
        'disable-component-extensions-with-background-pages',
    ];
    switchesUI = new switches_1.default(this);
    options = [
        new checkbox_1.default(this, {
            id: 'uncap',
            name: 'Uncap FPS',
            description: 'Disable frame rate limit / VSync',
            needsRestart: true,
        }),
        new checkbox_1.default(this, {
            id: 'inProcessGPU',
            name: 'In-process GPU',
            description: 'Support for OBS and Nvidia Shadowplay',
            needsRestart: true,
        }),
        new SwitchesButton(this, {
            name: 'Chromium Switches',
            description: 'Edit Chromium command-line switches',
            id: '',
            label: 'Edit',
            needsRestart: true,
            onChange: this.switchesUI.open.bind(this.switchesUI),
        }),
        new checkbox_1.default(this, {
            id: 'enableSplash',
            name: 'Enable Splash Screen',
            description: 'Show splash screen on client startup',
            needsRestart: true,
            defaultValue: true,
        }),
        new checkbox_1.default(this, {
            id: 'debugLogging',
            name: 'Debug Logging',
            description: 'Show debug logs in console (for troubleshooting)',
            needsRestart: false,
            defaultValue: false,
        }),
    ];
    contexts = [
        {
            context: context_1.Context.Startup,
            runAt: context_1.RunAt.LoadStart,
        },
    ];
    main() {
        let uncap = this.config.get('uncap', false);
        logger.log('Uncap FPS:', uncap);
        if (uncap) {
            logger.log('Uncapping FPS');
            this.uncapFPS();
        }
        this.switches();
    }
    uncapFPS() {
        electron_1.app.commandLine.appendSwitch('disable-frame-rate-limit');
        electron_1.app.commandLine.appendSwitch('disable-gpu-vsync');
    }
    switches() {
        let switches = this.config.get('switches', {});
        for (let s of this.switchList)
            if (switches[s] === undefined)
                switches[s] = true;
        logger.log('Loading switches...');
        for (let s of Object.keys(switches)) {
            logger.log('  ', s, switches[s]);
            if (typeof switches[s] === 'boolean' && !switches[s])
                continue;
            let [name, value] = s.split('=');
            electron_1.app.commandLine.appendSwitch(name, value || '');
        }
        electron_1.app.commandLine.appendSwitch('enable-features', 'ImplLatencyRecovery,MainLatencyRecovery,VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization');
        if (this.config.get('inProcessGPU', false))
            electron_1.app.commandLine.appendSwitch('in-process-gpu');
    }
}
exports.default = Performance;
