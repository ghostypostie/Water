import { app } from 'electron';
import { Context, RunAt } from '../context';
import Module from '../module';
import Checkbox from '../options/checkbox';
import Button from '../options/button';
import SwitchesUI from '../ui/switches';
import { createLogger } from '../utils/logger';

const logger = createLogger('Performance');

class SwitchesButton extends Button {
    generate(): HTMLElement {
        let container = super.generate();
        let question = document.createElement('sup');
        question.textContent = '[?]';
        question.classList.add('question');
        question.onclick = () =>
            window.open(
                'https://github.com/ghostypostie/Water/wiki/Chromium-Switches'
            );

        container.children[0].children[0].insertAdjacentElement(
            'beforeend',
            question
        );
        return container;
    }
}

export default class Performance extends Module {
    name = 'Performance';
    id = 'performance';
    priority = 1; // Display at the top of settings

    switchList = [
        // Core performance switches (tested and safe)
        'disable-breakpad',
        'disable-metrics',
        'disable-metrics-repo',
        'disable-logging',
        'disable-hang-monitor',
        'disable-background-timer-throttling',
        'disable-renderer-backgrounding',
        'disable-background-networking',
        'disable-sync',
        'disable-default-apps',
        'disable-extensions',
        'no-pings',
        'disable-domain-reliability',
        'disable-component-update',
        'disable-print-preview',
        'autoplay-policy=no-user-gesture-required',
        // GPU optimizations (safe)
        'ignore-gpu-blacklist',
        'enable-gpu-rasterization',
        'enable-zero-copy',
        'enable-accelerated-2d-canvas',
        'enable-accelerated-video-decode',
        'num-raster-threads=4',
        // WebGL optimizations (safe)
        'enable-webgl',
        'enable-webgl2-compute-context',
        'max-active-webgl-contexts=100',
        // Memory optimizations (safe)
        'renderer-process-limit=100',
        'disable-dev-shm-usage',
        // Network optimizations (safe)
        'enable-quic',
        'enable-highres-timer',
    ];

    switchesUI = new SwitchesUI(this);

    options = [
        new Checkbox(this, {
            id: 'uncap',
            name: 'Uncap FPS',
            description: 'Disable frame rate limit / VSync',
            needsRestart: true,
        }),
        new Checkbox(this, {
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
        new Checkbox(this, {
            id: 'enableSplash',
            name: 'Enable Splash Screen',
            description: 'Show splash screen on client startup',
            needsRestart: true,
            defaultValue: true,
        }),
        new Checkbox(this, {
            id: 'debugLogging',
            name: 'Debug Logging',
            description: 'Show debug logs in console (for troubleshooting)',
            needsRestart: false,
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
        let uncap = this.config.get('uncap', false);
        logger.log('Uncap FPS:', uncap);

        if (uncap) {
            logger.log('Uncapping FPS');
            this.uncapFPS();
        }

        this.switches();
    }

    uncapFPS() {
        app.commandLine.appendSwitch('disable-frame-rate-limit');
        app.commandLine.appendSwitch('disable-gpu-vsync');
    }

    switches() {
        let switches = this.config.get('switches', {});

        for (let s of this.switchList)
            if (switches[s] === undefined) switches[s] = true;

        logger.log('Loading switches...');
        for (let s of Object.keys(switches)) {
            logger.log('  ', s, switches[s]);
            if (typeof switches[s] === 'boolean' && !switches[s]) continue;

            let [name, value] = s.split('=');
            app.commandLine.appendSwitch(name, value || '');
        }

        // Minimal safe feature flags
        const enableFeatures = [
            'VaapiVideoDecoder',
            'CanvasOopRasterization',
        ];
        
        const disableFeatures = [
            'UseChromeOSDirectVideoDecoder',
        ];

        app.commandLine.appendSwitch('enable-features', enableFeatures.join(','));
        app.commandLine.appendSwitch('disable-features', disableFeatures.join(','));

        if (this.config.get('inProcessGPU', false))
            app.commandLine.appendSwitch('in-process-gpu');
        
        // Force hardware acceleration
        app.commandLine.appendSwitch('ignore-gpu-blocklist');
        app.commandLine.appendSwitch('enable-gpu-rasterization');
        app.commandLine.appendSwitch('enable-zero-copy');
    }
}
