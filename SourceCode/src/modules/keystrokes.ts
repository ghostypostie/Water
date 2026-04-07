import { readFileSync } from 'fs';
import { Context, RunAt } from '../context';
import Module from '../module';
import { join } from 'path';
import { waitFor } from '../util';
import Checkbox from '../options/checkbox';
import Slider from '../options/slider';

export default class Keystrokes extends Module {
    name = 'Keystrokes';
    id = 'keystrokes';
    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        }
    ];

    options = [
        new Checkbox(this, {
            name: 'Enabled',
            id: 'enabled',
            description: 'Show keystrokes'
        }),
        new Slider(this, {
            name: 'X Position',
            id: 'x',
            description: 'How far to the left or right the keystrokes should be',
        }),
        new Slider(this, {
            name: 'Y Position',
            id: 'y',
            description: 'How far up or down the keystrokes should be',
        }),
        new Slider(this, {
            name: 'Scale',
            id: 'scale',
            description: 'The size of the keystrokes',

            min: 0.1,
            max: 3,
            step: 0.1,
        }),
    ];

    container?: HTMLDivElement;
    stylesheet = document.createElement('style');
    
    keys: {
        q?: HTMLDivElement,
        w?: HTMLDivElement,
        a?: HTMLDivElement,
        s?: HTMLDivElement,
        d?: HTMLDivElement,
        e?: HTMLDivElement,
        lmb?: HTMLDivElement,
        rmb?: HTMLDivElement,
        space?: HTMLDivElement,
    } = {};

    private rafPending = false;
    private lastVisibilityState = false;

    applyConfig() {
        let rule = this.stylesheet.sheet.cssRules[0] as CSSStyleRule;

        rule.style.setProperty('display', this.config.get('enabled', false) ? '' : 'none');
        rule.style.setProperty('--water-key-scale', this.config.get('scale', 1));
        rule.style.setProperty('--water-key-offset-x', (this.config.get('x', 0) / 100) + '');
        rule.style.setProperty('--water-key-offset-y', (this.config.get('y', 0) / 100) + '');
        
        this.updateVisibility();
    }

    updateVisibility() {
        if (!this.container) return;
        
        const uiBase = document.getElementById('uiBase');
        if (!uiBase) return;

        const isEnabled = this.config.get('enabled', false);
        const isInGame = uiBase.classList.contains('onGame');

        const shouldShow = isEnabled && isInGame;
        
        // Only update DOM if state changed
        if (this.lastVisibilityState !== shouldShow) {
            this.lastVisibilityState = shouldShow;
            const keystrokesEl = this.container.querySelector('.keystrokes') as HTMLElement;
            if (keystrokesEl) {
                keystrokesEl.style.display = shouldShow ? '' : 'none';
            }
        }
    }

    renderer() {
        let rawHTML = readFileSync(
            join(__dirname, '../../assets/html/keystrokes.html'),
            'utf8'
        );

        this.container = document.createElement('div');
        this.container.innerHTML = rawHTML;

        this.stylesheet.textContent = 'style + .keystrokes {}';
        this.container.prepend(this.stylesheet);

        document.getElementById('inGameUI').appendChild(this.container);
        this.config.onAnyChange(this.applyConfig.bind(this));
        this.applyConfig();

        const uiBase = document.getElementById('uiBase');
        if (uiBase) {
            const observer = new MutationObserver(() => {
                // Use RAF to batch updates and prevent lag
                if (this.rafPending) return;
                this.rafPending = true;
                requestAnimationFrame(() => {
                    this.updateVisibility();
                    this.rafPending = false;
                });
            });
            
            observer.observe(uiBase, {
                attributes: true,
                attributeFilter: ['class']
            });
        }

        let keyNames = ['q', 'w', 'a', 's', 'd', 'e', 'lmb', 'rmb', 'space'];

        for (let i = 0; i < keyNames.length; i++) {
            let element = document.getElementById(
                'water_key' + keyNames[i].toUpperCase()
            );

            this.keys[keyNames[i]] = element;
        }

        document.addEventListener('keydown', event => {
            let keyName = event.key.toLowerCase();
            if (keyName === ' ') keyName = 'space';

            let key = this.keys[keyName];
            if (key) key.classList.add('active');
        });

        document.addEventListener('keyup', event => {
            let keyName = event.key.toLowerCase();
            if (keyName === ' ') keyName = 'space';

            let key = this.keys[keyName];
            if (key) key.classList.remove('active');
        });

        let fadeBg = document.getElementById('instructionsFadeBG');

        waitFor(() => fadeBg.style.opacity == '0').then(() => {
            let canvases = document.body.getElementsByTagName('canvas');

            for (let i = canvases.length-1; i >= 0; i--) {
                let canvas = canvases[i];

                if (!canvas.id && !canvas.className) {
                    
                    canvas.addEventListener('mousedown', event => {
                        if (event.button > 2 || event.button == 1) return;

                        let key = this.keys[event.button ? 'rmb' : 'lmb'];
                        if (key) key.classList.add('active');
                    });

                    canvas.addEventListener('mouseup', event => {
                        if (event.button > 2 || event.button == 1) return;

                        let key = this.keys[event.button ? 'rmb' : 'lmb'];
                        if (key) key.classList.remove('active');
                    });

                    break;
                }
            }
        });
    }
}
