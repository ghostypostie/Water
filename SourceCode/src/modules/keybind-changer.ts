import Module from '../module';
import { Context, RunAt } from '../context';
import { waitFor } from '../util';
import { createLogger } from '../utils/logger';

const logger = {
    log: (...args: any[]) => console.log('[KeybindChanger]', ...args)
};

interface WaterKeybind {
    id: string;
    name: string;
    default?: string;
    section: string;
}

interface KeyObj {
    type: number;
    shift: boolean;
    alt: boolean;
    ctrl: boolean;
    key: string;
    button: number;
}

const CLIENT_KEYBINDS: WaterKeybind[] = [
    { id: 'keybinds.newGame',    name: 'New Game',          default: 'F6',  section: 'Client Controls' },
    { id: 'keybinds.refresh',    name: 'Refresh Page',      default: 'F5',  section: 'Client Controls' },
    { id: 'keybinds.fullscreen', name: 'Toggle Fullscreen', default: 'F11', section: 'Client Controls' },
    { id: 'keybinds.devtools',   name: 'Developer Tools',   default: 'F12', section: 'Client Controls' },
];

const WATER_KEYBINDS: WaterKeybind[] = [
    { id: 'water.quickplay',  name: 'Quick Play',       default: 'F4',  section: 'Water Features' },
    { id: 'water.altmanager', name: 'Alt Manager',      section: 'Water Features' },
    { id: 'water.compmode',   name: 'Competitive Mode', section: 'Water Features' },
    { id: 'water.hideui',     name: 'Hide UI',          section: 'Water Features' },
    { id: 'water.screenshot', name: 'Screenshot',       section: 'Water Features' },
];

export default class KeybindChanger extends Module {
    name = 'Keybind Changer';
    id = 'keybind-changer';
    options = [];
    priority = 5;

    private isWindowOpen = false;
    private keybindWindow: HTMLElement | null = null;
    private settingsObserver: MutationObserver | null = null;

    contexts = [{ context: Context.Game, runAt: RunAt.LoadEnd }];

    renderer() {
        console.log('[KeybindChanger] renderer() called');
        this.watchForSettings();
        this.setupGlobalListeners();
    }

    private watchForSettings() {
        console.log('[KeybindChanger] watchForSettings() started');

        // Watch for when settings window opens or Keybinds section appears
        this.settingsObserver = new MutationObserver((mutations) => {
            // Look for Keybinds element (but not Client Keybinds)
            const settHolder = document.getElementById('settHolder');
            if (!settHolder) return;

            const allSetBodH = settHolder.querySelectorAll('.setBodH');
            let keybindsFound = false;

            for (const el of allSetBodH) {
                if (el.textContent?.includes('Keybinds') && !el.textContent?.includes('Client')) {
                    // Check if we already injected
                    const parent = el.parentElement;
                    if (parent && !parent.querySelector('[data-client-keybinds]')) {
                        console.log('[KeybindChanger] Keybinds element found, injecting...');
                        this.injectClientKeybindsSection();
                    }
                    keybindsFound = true;
                    break;
                }
            }
        });

        // Watch the document body for any changes
        this.settingsObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        console.log('[KeybindChanger] Observer started on document.body');

        // Also try immediate injection in case settings is already open
        this.injectClientKeybindsSection();
    }

    private async injectClientKeybindsSection() {
        logger.log('injectClientKeybindsSection() started');

        // Wait for Settings to be available
        await waitFor(() => document.getElementById('settHolder'));
        logger.log('settHolder found');

        // Find all setBodH elements that contain "Keybinds" text
        const allSetBodH = document.querySelectorAll('#settHolder .setBodH');
        let keybindsElement: Element | null = null;

        for (const el of allSetBodH) {
            if (el.textContent?.includes('Keybinds') && !el.textContent?.includes('Client')) {
                keybindsElement = el;
                break;
            }
        }

        logger.log('Keybinds element search result:', keybindsElement ? 'FOUND' : 'NOT FOUND');

        if (!keybindsElement) {
            logger.log('Keybinds element not found, will retry when settings opens...');
            return;
        }

        // Check if we already injected (look for our client keybinds element)
        const parent = keybindsElement.parentElement;
        if (parent && parent.querySelector('[data-client-keybinds]')) {
            logger.log('Client Keybinds already injected');
            return;
        }

        // Clone the Keybinds element and modify it
        const clientKeybindsEl = keybindsElement.cloneNode(true) as HTMLElement;
        clientKeybindsEl.setAttribute('data-client-keybinds', 'true');

        // Find and modify the settName div
        const settName = clientKeybindsEl.querySelector('.settName');
        if (settName) {
            // Update text to say "Client Keybinds"
            settName.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes('Keybinds')) {
                    node.textContent = 'Client Keybinds';
                }
            });

            // Find and modify the Edit button
            const editBtn = settName.querySelector('.settingsBtn');
            if (editBtn) {
                editBtn.setAttribute('onclick', '');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openKeybindWindow();
                });
            }
        }

        // Insert right after the original Keybinds element
        keybindsElement.insertAdjacentElement('afterend', clientKeybindsEl);
        logger.log('Client Keybinds section injected successfully!');

        // Expose methods to window
        (window as any).keybindChanger = {
            openKeybindWindow: () => this.openKeybindWindow(),
            closeKeybindWindow: () => this.closeKeybindWindow()
        };
    }

    private toggleSection(header: HTMLElement) {
        const icon = header.querySelector('.plusOrMinus');
        const body = header.nextElementSibling as HTMLElement;
        if (body) {
            const isOpen = body.style.display !== 'none';
            if (icon) icon.textContent = isOpen ? 'keyboard_arrow_right' : 'keyboard_arrow_down';
            body.style.display = isOpen ? 'none' : '';
        }
    }

    private openKeybindWindow() {
        if (this.isWindowOpen) return;

        // Create TWO separate windows side by side like Water window (no headers)
        const windowHtml = `
            <div id="clientKeybindsOverlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.75);
                z-index: 1000000;
                display: block;
            " onclick="window.keybindChanger?.closeKeybindWindow()">
                <!-- Left Window: Client Controls -->
                <div id="clientKeybindsWindowLeft" style="
                    position: fixed;
                    top: 50%;
                    right: calc(50% + 70px);
                    transform: translateY(-50%);
                    z-index: 1000001;
                    width: 750px;
                    max-width: 47%;
                    max-height: 85vh;
                    background-color: #353535;
                    border-radius: 6px;
                    padding: 0;
                    overflow: hidden;
                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                    display: block;
                " onclick="event.stopPropagation()">
                    <div style="
                        padding: 0 20px 20px 20px;
                        max-height: 85vh;
                        overflow-y: auto;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    ">
                        ${this.renderSection('Client Controls', CLIENT_KEYBINDS)}
                    </div>
                </div>
                <!-- Right Window: Water Features -->
                <div id="clientKeybindsWindowRight" style="
                    position: fixed;
                    top: 50%;
                    left: calc(50% + 70px);
                    transform: translateY(-50%);
                    z-index: 1000001;
                    width: 750px;
                    max-width: 47%;
                    max-height: 85vh;
                    background-color: #353535;
                    border-radius: 6px;
                    padding: 0;
                    overflow: hidden;
                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                    display: block;
                " onclick="event.stopPropagation()">
                    <div style="
                        padding: 0 20px 20px 20px;
                        max-height: 85vh;
                        overflow-y: auto;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    ">
                        ${this.renderSection('Water Features', WATER_KEYBINDS)}
                    </div>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = windowHtml;
        document.body.appendChild(container);

        this.keybindWindow = container;
        this.isWindowOpen = true;

        this.attachKeybindListeners();

        // Add close on Escape key
        const onEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.closeKeybindWindow();
                document.removeEventListener('keydown', onEscape);
            }
        };
        document.addEventListener('keydown', onEscape);

        logger.log('Client Keybinds windows opened');
    }

    private closeKeybindWindow() {
        if (this.keybindWindow) {
            this.keybindWindow.remove();
            this.keybindWindow = null;
        }
        this.isWindowOpen = false;
        logger.log('Client Keybinds window closed');
    }


    private renderSection(title: string, keybinds: WaterKeybind[]): string {
        const sectionId = title.toLowerCase().replace(/\s+/g, '_');

        let html = '';

        // Native Krunker setHed style (no custom styles)
        html += `<div class="setHed" id="setBindHed_water_${sectionId}" onclick="window.windows[6].collapseFolder(this)">`;
        html += `<span class="material-icons plusOrMinus">keyboard_arrow_down</span> ${title}`;
        html += `</div>`;

        html += `<div class="setBodH" id="setBindBod_water_${sectionId}">`;

        for (const kb of keybinds) {
            html += this.renderKeybindRow(kb);
        }

        html += `</div>`;

        return html;
    }

    private renderKeybindRow(kb: WaterKeybind): string {
        const currentKey = this.getKeybind(kb.id, kb.default);
        const keyDisplay = currentKey ? this.formatKeyName(currentKey) : 'UNBOUND';

        // Native Krunker settName style (like original Krunker keybinds)
        let html = '';
        html += `<div class="settName" data-water-kbid="${kb.id}">`;
        html += kb.name;

        html += `<div style="float:right">`;

        // Reset button (native Krunker style)
        html += `<span class="reset" title="Reset Bind" data-action="reset" data-kbid="${kb.id}">`;
        html += `<i class="material-icons" style="font-size:40px;color:var(--yellow);">refresh</i>`;
        html += `</span>`;

        // Unbind button (native Krunker style)
        html += `<span class="unbind" title="Unbind" data-action="unbind" data-kbid="${kb.id}">`;
        html += `<i class="material-icons" style="font-size:40px;color:var(--red);">delete_forever</i>`;
        html += `</span>`;

        // Key display button (native Krunker style)
        html += `<span class="settText floatRNoC keyIcon" data-kbid="${kb.id}" onmouseover="playTick()" data-action="change">${keyDisplay}</span>`;

        html += `</div>`;
        html += `</div>`;

        return html;
    }

    private attachKeybindListeners() {
        // Query both left and right windows
        const leftWindow = document.querySelector('#clientKeybindsWindowLeft');
        const rightWindow = document.querySelector('#clientKeybindsWindowRight');
        
        if (!leftWindow && !rightWindow) {
            console.error('[KeybindChanger] Could not find keybind windows');
            return;
        }

        const attachToWindow = (windowEl: Element) => {
            windowEl.querySelectorAll<HTMLElement>('[data-action="change"]').forEach((el) => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.startKeybindCapture(el);
                });
            });

            windowEl.querySelectorAll<HTMLElement>('[data-action="reset"]').forEach((el) => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const kbId = el.getAttribute('data-kbid');
                    if (kbId) this.resetKeybind(kbId);
                });
            });

            windowEl.querySelectorAll<HTMLElement>('[data-action="unbind"]').forEach((el) => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const kbId = el.getAttribute('data-kbid');
                    if (kbId) this.unbindKeybind(kbId);
                });
            });

            windowEl.querySelectorAll<HTMLElement>('.setHed').forEach((header) => {
                header.addEventListener('click', () => {
                    if (typeof window.windows[6].collapseFolder === 'function') {
                        window.windows[6].collapseFolder(header);
                    } else {
                        const icon = header.querySelector('.plusOrMinus');
                        const body = header.nextElementSibling;
                        if (icon && body) {
                            const isOpen = (body as HTMLElement).style.display !== 'none';
                            icon.textContent = isOpen ? 'keyboard_arrow_right' : 'keyboard_arrow_down';
                            (body as HTMLElement).style.display = isOpen ? 'none' : '';
                        }
                    }
                });
            });
        };

        // Attach listeners to both windows
        if (leftWindow) attachToWindow(leftWindow);
        if (rightWindow) attachToWindow(rightWindow);
    }

    private checkDuplicateKeybind(keyObj: KeyObj, currentKbId: string): string | null {
        const all = [...CLIENT_KEYBINDS, ...WATER_KEYBINDS];
        
        for (const kb of all) {
            if (kb.id === currentKbId) continue; // Skip the current keybind being changed
            
            const bound = this.getKeybind(kb.id, kb.default);
            if (!bound) continue;
            
            // Check if keybinds match
            if (bound.type === keyObj.type) {
                if (bound.type === 0) {
                    // Keyboard key
                    if (bound.key.toUpperCase() === keyObj.key.toUpperCase() &&
                        bound.shift === keyObj.shift &&
                        bound.alt === keyObj.alt &&
                        bound.ctrl === keyObj.ctrl) {
                        return kb.name; // Return the name of the conflicting keybind
                    }
                } else if (bound.type === 1) {
                    // Mouse button
                    if (bound.button === keyObj.button) {
                        return kb.name;
                    }
                }
            }
        }
        
        return null; // No duplicate found
    }

    private showAlert(message: string) {
        // Create a simple alert overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000000;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: all;
        `;
        
        const alertBox = document.createElement('div');
        alertBox.style.cssText = `
            background: #2a2a2a;
            padding: 30px 40px;
            border-radius: 8px;
            color: #fff;
            font-size: 16px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        
        alertBox.innerHTML = `
            <div style="margin-bottom: 20px;">${message}</div>
            <button id="alertOkBtn" style="
                background: #ff69b4;
                color: white;
                border: none;
                padding: 10px 30px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
            ">OK</button>
        `;
        
        overlay.appendChild(alertBox);
        document.body.appendChild(overlay);
        
        const okBtn = alertBox.querySelector('#alertOkBtn');
        const closeAlert = () => {
            overlay.remove();
        };
        
        okBtn?.addEventListener('click', closeAlert);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeAlert();
        });
    }

    private syncClientKeybindsToMainProcess() {
        // Notify main process that keybinds have changed
        // This makes changes apply instantly without restart
        try {
            const { ipcRenderer } = require('electron');
            console.log('[KeybindChanger] ========================================');
            console.log('[KeybindChanger] Sending keybinds-changed IPC to main process...');
            
            // Gather all CLIENT_KEYBINDS and send them directly to main process
            const keybindData: any = {};
            
            for (const kb of CLIENT_KEYBINDS) {
                const bound = this.getKeybind(kb.id, kb.default);
                if (bound && bound.type === 0) { // Only keyboard keys for main process
                    const key = kb.id.replace('keybinds.', ''); // Remove prefix (keybinds.fullscreen -> fullscreen)
                    keybindData[key] = {
                        key: bound.key,
                        shift: bound.shift,
                        alt: bound.alt,
                        ctrl: bound.ctrl
                    };
                    console.log(`[KeybindChanger] ${kb.name}: ${this.formatKeyName(bound)}`);
                }
            }
            
            console.log('[KeybindChanger] Sending keybind data:', keybindData);
            ipcRenderer.send('keybinds-changed', keybindData);
            console.log('[KeybindChanger] IPC message sent successfully');
            console.log('[KeybindChanger] ========================================');
        } catch (err) {
            console.error('[KeybindChanger] Failed to notify main process:', err);
        }
    }

    private startKeybindCapture(keyElement: HTMLElement) {
        const kbId = keyElement.getAttribute('data-kbid');
        if (!kbId) return;

        keyElement.textContent = 'Press any key...';

        let cleanupFn: (() => void) | null = null;

        const onKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
                const mods = this.getModifierString(e.shiftKey, e.altKey, e.ctrlKey);
                keyElement.textContent = mods ? `${mods} + ?` : '?';
                return;
            }

            const keyObj: KeyObj = {
                type: 0,
                shift: e.shiftKey,
                alt: e.altKey,
                ctrl: e.ctrlKey,
                key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
                button: 0
            };

            // Check for duplicate keybinds
            const duplicate = this.checkDuplicateKeybind(keyObj, kbId);
            if (duplicate) {
                this.showAlert(`This key is already assigned to "${duplicate}". Please choose a different key.`);
                const kb = this.getKeybind(kbId);
                keyElement.textContent = kb ? this.formatKeyName(kb) : 'UNBOUND';
                cleanup();
                return;
            }

            const serialized = this.serializeKey(keyObj);
            console.log('[KeybindChanger] Saving keybind:', kbId, 'Serialized:', serialized);
            this.config.set(kbId, serialized);
            
            // Verify it was saved
            const verified = this.config.get(kbId, null);
            console.log('[KeybindChanger] Verified saved value:', verified);
            
            this.syncClientKeybindsToMainProcess();

            keyElement.textContent = this.formatKeyName(keyObj);
            keyElement.onmouseover = () => (window as any).playTick?.();

            // Show success toast
            this.showKeybindChangeToast(kbId, keyObj);

            cleanup();
        };

        const onMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.button > 2 || e.button === 1) return;

            const keyObj: KeyObj = {
                type: 1,
                shift: false,
                alt: false,
                ctrl: false,
                key: '',
                button: e.button
            };

            // Check for duplicate keybinds
            const duplicate = this.checkDuplicateKeybind(keyObj, kbId);
            if (duplicate) {
                this.showAlert(`This mouse button is already assigned to "${duplicate}". Please choose a different button.`);
                const kb = this.getKeybind(kbId);
                keyElement.textContent = kb ? this.formatKeyName(kb) : 'UNBOUND';
                cleanup();
                return;
            }

            const serialized = this.serializeKey(keyObj);
            console.log('[KeybindChanger] Saving keybind (mouse):', kbId, 'Serialized:', serialized);
            this.config.set(kbId, serialized);
            
            // Verify it was saved
            const verified = this.config.get(kbId, null);
            console.log('[KeybindChanger] Verified saved value (mouse):', verified);
            
            this.syncClientKeybindsToMainProcess();

            keyElement.textContent = this.formatKeyName(keyObj);
            keyElement.onmouseover = () => (window as any).playTick?.();

            // Show success toast
            this.showKeybindChangeToast(kbId, keyObj);

            cleanup();
        };

        const cleanup = () => {
            document.removeEventListener('keydown', onKeyDown, true);
            document.removeEventListener('mousedown', onMouseDown, true);
            cleanupFn = null;
        };

        cleanupFn = cleanup;

        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('mousedown', onMouseDown, true);

        setTimeout(() => {
            if (cleanupFn) {
                cleanup();
                const kb = this.getKeybind(kbId);
                keyElement.textContent = kb ? this.formatKeyName(kb) : 'UNBOUND';
            }
        }, 5000);
    }

    private resetKeybind(kbId: string) {
        const kb = this.findKeybindDef(kbId);
        if (kb?.default) {
            const def = this.parseSimpleKey(kb.default);
            if (def) {
                this.config.set(kbId, this.serializeKey(def));
                this.syncClientKeybindsToMainProcess();
                this.showKeybindChangeToast(kbId, def, 'reset');
            }
        }
        this.updateKeyDisplay(kbId);
        logger.log('Reset keybind:', kbId);
    }

    private unbindKeybind(kbId: string) {
        this.config.delete(kbId);
        this.syncClientKeybindsToMainProcess();
        this.showKeybindChangeToast(kbId, null, 'unbound');
        this.updateKeyDisplay(kbId);
        logger.log('Unbound keybind:', kbId);
    }

    private updateKeyDisplay(kbId: string) {
        // Try both left and right windows
        let el = document.querySelector<HTMLElement>(`#clientKeybindsWindowLeft [data-kbid="${kbId}"][data-action="change"]`);
        if (!el) {
            el = document.querySelector<HTMLElement>(`#clientKeybindsWindowRight [data-kbid="${kbId}"][data-action="change"]`);
        }
        
        if (el) {
            const kb = this.getKeybind(kbId);
            el.textContent = kb ? this.formatKeyName(kb) : 'UNBOUND';
        }
    }

    private findKeybindDef(kbId: string): WaterKeybind | undefined {
        return [...CLIENT_KEYBINDS, ...WATER_KEYBINDS].find(k => k.id === kbId);
    }

    private getKeybind(kbId: string, defaultStr?: string): KeyObj | null {
        const stored = this.config.get(kbId, null);
        if (stored && Array.isArray(stored)) return this.parseKey(stored);
        if (defaultStr) return this.parseSimpleKey(defaultStr);
        return null;
    }

    private parseKey(key: number[]): KeyObj | null {
        if (!key || !key.length) return null;

        const parsed: KeyObj = {
            type: key[0] & 1,
            shift: false,
            alt: false,
            ctrl: false,
            key: '',
            button: 0
        };

        if (parsed.type === 0) {
            parsed.shift = !!(key[0] & 2);
            parsed.alt = !!(key[0] & 4);
            parsed.ctrl = !!(key[0] & 8);
            parsed.key = String.fromCharCode(...key.slice(1));
            parsed.button = 0;
        } else {
            parsed.button = (key[0] & 254) >> 1;
        }

        return parsed;
    }

    private serializeKey(key: KeyObj): number[] {
        let serialized = [key.type];

        if (key.type === 0) {
            serialized[0] |= (key.shift ? 1 : 0) << 1;
            serialized[0] |= (key.alt ? 1 : 0) << 2;
            serialized[0] |= (key.ctrl ? 1 : 0) << 3;
            serialized.push(...key.key.split('').map(c => c.charCodeAt(0)));
        } else {
            serialized[0] |= (key.button << 1) & 255;
        }

        return serialized;
    }

    private parseSimpleKey(str: string): KeyObj {
        const parts = str.toUpperCase().split('+').map(p => p.trim());
        let shift = false, ctrl = false, alt = false, main = '';

        for (const p of parts) {
            if (p === 'SHIFT') shift = true;
            else if (p === 'CTRL' || p === 'CONTROL') ctrl = true;
            else if (p === 'ALT') alt = true;
            else main = p;
        }

        if (!main) return { type: 0, shift: false, alt: false, ctrl: false, key: '', button: 0 };

        return {
            type: 0,
            shift,
            alt,
            ctrl,
            key: main.length === 1 ? main.toLowerCase() : main,
            button: 0
        };
    }

    private formatKeyName(key: KeyObj): string {
        if (!key) return 'UNBOUND';

        if (key.type === 1) {
            return 'M' + (key.button === 0 ? '1' : key.button === 2 ? '2' : '3');
        }

        let name = key.key.toUpperCase();
        if (['Shift', 'Control', 'Alt'].includes(key.key)) {
            const mods = this.getModifierString(key.shift, key.alt, key.ctrl);
            return mods ? `${mods} + ?` : '?';
        }

        const mods = this.getModifierString(key.shift, key.alt, key.ctrl);
        return mods ? `${mods} + ${name}` : name;
    }

    private getModifierString(shift: boolean, alt: boolean, ctrl: boolean): string {
        const parts: string[] = [];
        if (ctrl) parts.push('CTRL');
        if (shift) parts.push('SHIFT');
        if (alt) parts.push('ALT');
        return parts.join(' + ');
    }

    private setupGlobalListeners() {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

            console.log('[KeybindChanger] Key pressed:', e.key, 'Shift:', e.shiftKey, 'Alt:', e.altKey, 'Ctrl:', e.ctrlKey);

            const all = [...CLIENT_KEYBINDS, ...WATER_KEYBINDS];

            for (const kb of all) {
                const bound = this.getKeybind(kb.id, kb.default);
                if (!bound) continue;

                let matched = false;

                if (bound.type === 0) {
                    if (bound.key &&
                        bound.key.toUpperCase() === e.key.toUpperCase() &&
                        bound.shift === e.shiftKey &&
                        bound.alt === e.altKey &&
                        bound.ctrl === e.ctrlKey) {
                        matched = true;
                        console.log('[KeybindChanger] Matched keybind:', kb.id, kb.name);
                    }
                }

                if (matched) {
                    // DYNAMIC LOGIC: Check if this is Quick Play and if it's enabled
                    if (kb.id === 'water.quickplay') {
                        const quickPlayEnabled = this.config.get('quickplay.enabled', false);
                        if (!quickPlayEnabled) {
                            console.log('[KeybindChanger] Quick Play DISABLED - blocking Quick Play keybind');
                            e.preventDefault();
                            e.stopPropagation();
                            return; // Block ONLY the Quick Play keybind when Quick Play is disabled
                        }
                    }
                    
                    // Execute the keybind action
                    this.executeKeybind(kb.id, e);
                    break;
                }
            }
        }, true);

        document.addEventListener('mousedown', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

            const all = [...CLIENT_KEYBINDS, ...WATER_KEYBINDS];

            for (const kb of all) {
                const bound = this.getKeybind(kb.id, kb.default);
                if (!bound) continue;

                if (bound.type === 1 && bound.button === e.button) {
                    // Check Quick Play logic for mouse buttons too
                    if (kb.id === 'water.quickplay') {
                        const quickPlayEnabled = this.config.get('quickplay.enabled', false);
                        if (!quickPlayEnabled) {
                            console.log('[KeybindChanger] Quick Play DISABLED - blocking Quick Play keybind');
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                    }
                    
                    this.executeKeybind(kb.id, e);
                    break;
                }
            }
        }, true);
    }

    private executeKeybind(kbId: string, e: Event) {
        // CLIENT_KEYBINDS are handled by the main process via IPC
        // We need to prevent browser default behavior (like F11 fullscreen)
        // but let the event reach the main process
        if (kbId.startsWith('keybinds.')) {
            console.log('[KeybindChanger] CLIENT_KEYBIND triggered:', kbId);
            e.preventDefault(); // Prevent browser default (F11 fullscreen, F5 refresh, etc.)
            // Don't call stopPropagation() - let it reach main process
            return;
        }

        // WATER_KEYBINDS are handled here in the renderer
        console.log('[KeybindChanger] WATER_KEYBIND triggered:', kbId);
        e.preventDefault();
        e.stopPropagation();

        switch (kbId) {
            case 'water.quickplay':
                console.log('[KeybindChanger] Executing Quick Play');
                const quickPlayModule = (window as any).manager?.modules?.find((m: any) => m.id === 'quickplay');
                if (quickPlayModule?.findAndJoinGame) {
                    quickPlayModule.findAndJoinGame();
                    console.log('[KeybindChanger] Quick Play executed');
                } else {
                    console.log('[KeybindChanger] QuickPlay module not found');
                }
                break;
            case 'water.altmanager':
                console.log('[KeybindChanger] Toggling Alt Manager');
                const el = document.getElementById('altManager');
                if (el) {
                    el.style.display = el.style.display === 'block' ? 'none' : 'block';
                    console.log('[KeybindChanger] Alt Manager toggled:', el.style.display);
                } else {
                    console.log('[KeybindChanger] Alt Manager element not found');
                }
                break;
            case 'water.compmode':
                console.log('[KeybindChanger] Toggling Competitive Mode');
                const compBtn = document.getElementById('waterCompBtn') as HTMLElement;
                if (compBtn) {
                    compBtn.click();
                    console.log('[KeybindChanger] Competitive Mode toggled');
                } else {
                    console.log('[KeybindChanger] Competitive Mode button not found');
                }
                break;
            case 'water.hideui':
                console.log('[KeybindChanger] Toggling UI visibility');
                this.toggleUI();
                break;
            case 'water.screenshot':
                console.log('[KeybindChanger] Taking screenshot');
                this.takeScreenshot();
                break;
            default:
                console.log('[KeybindChanger] Unknown keybind:', kbId);
        }
    }

    private toggleUI() {
        const selectors = [
            '#menuWindow', '#endUI', '#spectButton', '#chatList',
            '#topRight', '#topLeftHolder', '#bottomLeftHolder',
            '#bottomRight', '#weapHolder', '#perkHolder'
        ];
        const first = document.querySelector(selectors[0]) as HTMLElement | null;
        const hide = first !== null && first.style.display !== 'none';

        selectors.forEach(s => {
            const el = document.querySelector(s) as HTMLElement | null;
            if (el) el.style.display = hide ? 'none' : '';
        });
    }

    private takeScreenshot() {
        const selectors = '#menuWindow,#endUI,#spectButton,#chatList,#topRight,#topLeftHolder,#bottomLeftHolder,#bottomRight,#weapHolder,#perkHolder';
        const els = document.querySelectorAll(selectors);

        els.forEach(el => {
            (el as HTMLElement).style.display = 'none';
        });
        setTimeout(() => {
            els.forEach(el => {
                (el as HTMLElement).style.display = '';
            });
        }, 200);
    }

    private showKeybindChangeToast(kbId: string, keyObj: KeyObj | null, action: 'change' | 'reset' | 'unbound' = 'change') {
        // Get keybind name
        const kb = this.findKeybindDef(kbId);
        if (!kb) return;

        // Get Water module to show toast
        const waterModule = (window as any).manager?.modules?.find((m: any) => m.id === 'water');
        if (!waterModule || typeof waterModule.showToast !== 'function') {
            console.log('[KeybindChanger] Water module not found or showToast not available');
            return;
        }

        let title = '';
        let message = '';

        if (action === 'unbound') {
            title = 'Keybind Removed';
            message = `${kb.name} is now unbound`;
        } else if (action === 'reset') {
            const keyName = keyObj ? this.formatKeyName(keyObj) : kb.default || 'default';
            title = 'Keybind Reset';
            message = `${kb.name} reset to ${keyName}`;
        } else {
            const keyName = keyObj ? this.formatKeyName(keyObj) : 'unknown';
            title = 'Keybind Updated';
            message = `${kb.name} → ${keyName} - Ready to use!`;
        }

        waterModule.showToast(title, message, 5000);
    }
}
