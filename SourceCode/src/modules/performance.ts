import { app } from 'electron';
import { Context, RunAt } from '../context';
import Module from '../module';
import Checkbox from '../options/checkbox';
import Dropdown from '../options/dropdown';
import Slider from '../options/slider';
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
    priority = 2; // Display at the top of settings

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
        'disable-features=CalculateNativeWinOcclusion,BackgroundTimerThrottling,HardwareMediaKeyHandling,MediaSessionService,BackgroundFetch,BackgroundSync',
        'disable-background-networking',
        'disable-sync',
        'disable-extensions',
        'disable-default-apps',
        'no-pings',
        'disable-domain-reliability',
        'disable-client-side-phishing-detection',
        'disable-component-extensions-with-background-pages',
    ];

    switchesUI = new SwitchesUI(this);

    options = [
        new Checkbox(this, {
            id: 'uncap',
            name: 'Uncap FPS',
            needsRestart: true,
        }),
        new Checkbox(this, {
            id: 'acceleratedCanvas',
            name: 'Accelerated Canvas',
            needsRestart: true,
            defaultValue: true,
        }),
        new Dropdown(this, {
            id: 'angleBackend',
            name: 'ANGLE Graphics Backend',
            needsRestart: true,
            options: [
                { name: 'Default', value: 'default' },
                { name: 'OpenGL (Windows, Linux, MacOS)', value: 'gl' },
                { name: 'D3D11 (Windows-Only)', value: 'd3d11' },
                { name: 'D3D9 (Windows-Only)', value: 'd3d9' },
                { name: 'D3D11on12 (Windows, Linux)', value: 'd3d11on12' },
                { name: 'Vulkan (Windows, Linux)', value: 'vulkan' },
                { name: 'Metal (MacOS-Only)', value: 'metal' },
            ],
            defaultValue: 'd3d11',
        }),
        new Checkbox(this, {
            id: 'enablePerformanceOptimizations',
            name: 'Performance Mode',
            needsRestart: true,
            defaultValue: true,
        }),
        new Checkbox(this, {
            id: 'inProcessGPU',
            name: 'In-Process GPU',
            needsRestart: true,
        }),
        new SwitchesButton(this, {
            name: 'Chromium Switches',
            id: '',
            label: 'Edit',
            needsRestart: true,

            onChange: this.switchesUI.open.bind(this.switchesUI),
        }),
        new Checkbox(this, {
            id: 'enablePlaceboFPS',
            name: 'Enable Placebo FPS',
            needsRestart: false,
            defaultValue: false,
        }),
        new Slider(this, {
            id: 'placeboFPSMultiplier',
            name: 'Placebo FPS Multiplier',
            needsRestart: false,
            defaultValue: 1,
            min: 1,
            max: 100,
            step: 0.1,
        }),
        new Checkbox(this, {
            id: 'enableSplash',
            name: 'Enable Splash Screen',
            needsRestart: true,
            defaultValue: true,
        }),
        new Checkbox(this, {
            id: 'removeAnimations',
            name: 'Remove Animations',
            needsRestart: false,
            defaultValue: false,
        }),
        new Checkbox(this, {
            id: 'debugLogging',
            name: 'Debug Logging',
            needsRestart: false,
            defaultValue: false,
        }),
    ];

    contexts = [
        {
            context: Context.Startup,
            runAt: RunAt.LoadStart,
        },
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        },
    ];

    main() {
        let enablePerformanceOptimizations = this.config.get('enablePerformanceOptimizations', true);
        let uncap = this.config.get('uncap', false);
        
        logger.log('Performance Mode:', enablePerformanceOptimizations);
        logger.log('Uncap FPS:', uncap);
        
        // Performance Mode adds extra switches not in the default switchList
        if (enablePerformanceOptimizations) {
            logger.log('Applying performance optimizations');
            this.applyPerformanceOptimizations();
        }
        
        // Uncap FPS is separate from Performance Mode
        if (uncap) {
            logger.log('Uncapping FPS');
            this.uncapFPS();
        }
        
        // Apply ANGLE backend
        this.applyAngleBackend();
        
        // Apply accelerated canvas setting
        this.applyAcceleratedCanvas();
        
        // Apply Chromium switches (this already includes many performance switches)
        this.switches();
    }
    
    renderer() {
        // Apply Placebo FPS in the game renderer
        this.applyPlaceboFPS();
    }
    
    applyPerformanceOptimizations() {
        // Only add switches that are NOT already in switchList
        // These are the additional performance switches from the documentation
        
        // Uncapped FPS (only if uncap is not already enabled)
        if (!this.config.get('uncap', false)) {
            app.commandLine.appendSwitch('disable-frame-rate-limit');
            app.commandLine.appendSwitch('disable-gpu-vsync');
        }
        app.commandLine.appendSwitch('max-gum-fps', '9999');
        
        // Lower Latency (only new ones not in switchList)
        app.commandLine.appendSwitch('disable-input-event-coalescing');
        app.commandLine.appendSwitch('enable-pointer-lock-options');
        
        // GPU Rasterization (only new ones not in switchList)
        app.commandLine.appendSwitch('num-raster-threads', '4');
        app.commandLine.appendSwitch('enable-gpu-memory-buffer-compositor-resources');
        
        // Additional performance switches (only new ones not in switchList)
        app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
        app.commandLine.appendSwitch('disable-partial-raster');
        app.commandLine.appendSwitch('disable-low-end-device-mode');
        app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096 --expose-gc --max-semi-space-size=64');
        
        logger.log('Performance optimizations applied');
    }
    
    applyAngleBackend() {
        const angleBackend = this.config.get('angleBackend', 'd3d11');
        if (angleBackend && angleBackend !== 'default') {
            app.commandLine.appendSwitch('use-angle', angleBackend);
            logger.log('ANGLE backend set to:', angleBackend);
        }
    }
    
    applyAcceleratedCanvas() {
        const acceleratedCanvas = this.config.get('acceleratedCanvas', true);
        if (!acceleratedCanvas) {
            app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
            logger.log('Accelerated 2D canvas disabled');
        }
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

        app.commandLine.appendSwitch('enable-features', 'ImplLatencyRecovery,MainLatencyRecovery,VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization');

        if (this.config.get('inProcessGPU', false))
            app.commandLine.appendSwitch('in-process-gpu');
    }
    
    applyPlaceboFPS() {
        const enablePlaceboFPS = this.config.get('enablePlaceboFPS', false);
        const multiplier = this.config.get('placeboFPSMultiplier', 1);
        
        if (!enablePlaceboFPS || multiplier === 1) {
            logger.log('Placebo FPS disabled');
            return;
        }
        
        logger.log('Applying Placebo FPS with multiplier:', multiplier);
        
        // Optimized hook application
        const applyHook = () => {
            const ingameFPS = document.getElementById('ingameFPS');
            const menuFPS = document.getElementById('menuFPS');
            
            if (!ingameFPS || !menuFPS) {
                console.warn('[Water] Placebo FPS: FPS elements not found in DOM');
                return;
            }
            
            // Pre-calculate jitter range for better performance
            const jitterRange = multiplier * 2;
            
            // Hook ingameFPS.textContent setter (zero overhead when not updating)
            Object.defineProperty(ingameFPS, 'textContent', {
                set: function(val: string) {
                    const realFPS = parseInt(val, 10);
                    if (isNaN(realFPS)) {
                        // Fallback: pass through non-numeric values
                        (this as HTMLElement).innerText = val;
                        menuFPS.innerText = val;
                        return;
                    }
                    
                    // Optimized calculation - single Math.random() call
                    const randomAdd = Math.floor(Math.random() * jitterRange) - multiplier;
                    const displayedFPS = Math.floor(realFPS * multiplier + randomAdd);
                    
                    // Convert to string once
                    const displayStr = String(displayedFPS);
                    
                    // Write fake value to both elements
                    (this as HTMLElement).innerText = displayStr;
                    menuFPS.innerText = displayStr;
                },
                configurable: true,
            });
            
            // Block menuFPS.textContent updates (zero overhead)
            Object.defineProperty(menuFPS, 'textContent', {
                set: function(_val: string) {
                    // No-op: prevent game from overwriting synced fake value
                },
                configurable: true,
            });
            
            console.log('[Water] Placebo FPS applied (optimized, zero FPS impact)');
        };
        
        // Efficient DOM ready check
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyHook, { once: true, passive: true });
        } else {
            applyHook();
        }
    }
}
