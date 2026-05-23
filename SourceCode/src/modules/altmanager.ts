import { Context, RunAt } from '../context';
import Module from '../module';
import UI from '../ui';
import AltManagerUI from '../ui/altmanager';
import Button from '../options/button';
import TextInput from '../options/textinput';
import { waitFor } from '../util';
import Keybind, { KeyType } from '../options/keybind';
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';
import { hostname, userInfo } from 'os';

// AES-256-GCM encryption with machine-derived key
// Key is derived from hostname + username — not stored in source code
const machineId = hostname() + userInfo().username;
const salt = 'water-client-alt-manager-v1';
const encryptionKey = scryptSync(machineId, salt, 32);

function encryptPassword(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `v2:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptPassword(stored: string): string {
    // New AES-256-GCM format
    if (stored.startsWith('v2:')) {
        const parts = stored.split(':');
        const ivHex = parts[1];
        const authTagHex = parts[2];
        const ciphertext = parts[3];
        const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    // Legacy XOR fallback for migrating existing passwords
    const legacyKey = 'a5de16da0bb09720a7a917736c3be0beddc4418816c5f469a31419f1f6d5e592';
    let out = '';
    for (let i = 0; i < stored.length; i++) {
        out += String.fromCharCode(stored.charCodeAt(i) ^ legacyKey.charCodeAt(i % legacyKey.length));
    }
    return out;
}

class AddAltUI extends UI {
    categories = [
        {
            name: '',
            options: [
                new TextInput(this.module, {
                    id: 'editui.username',
                    label: 'Username',
                    name: 'Username',
                }),
                new TextInput(this.module, {
                    id: 'editui.password',
                    label: 'Password',
                    name: 'Password',
                    type: 'password',
                }),
                new Keybind(this.module, {
                    id: 'editui.keybind',
                    name: 'Keybind',
                }),
            ],
        },
    ];

    buttons = [
        new Button(this.module, {
            label: 'Add',
            color: 'purple',

            name: '',
            id: '',
            onChange: () => {
                let username = this.module.config.get('editui.username', '').toLowerCase();
                let password = this.module.config.get('editui.password', '');
                let keybind = this.module.config.get('editui.keybind', []);

                if (!username || !password)
                    return (this.module as AltManager).ui.open();

                let alts = [];

                try {
                    let parsed = JSON.parse(
                        window.localStorage.getItem('taxAltManager')
                    );
                    if (Array.isArray(parsed)) alts = parsed;
                } catch {}

                let altIndex = alts.findIndex((a) => a.username === username);

                if (altIndex !== -1) {
                    alts[altIndex].password = encryptPassword(password);
                    alts[altIndex].keybind = keybind;
                } else {
                    alts.push({
                        username,
                        password: encryptPassword(password),
                        keybind,
                    });
                }

                window.localStorage.setItem('taxAltManager', JSON.stringify(alts));

                this.module.config.delete('editui.username');
                this.module.config.delete('editui.password');
                this.module.config.delete('editui.keybind');

                (this.module as AltManager).ui.open();
            },
        }),
        new Button(this.module, {
            label: 'Cancel',
            color: 'red',

            name: '',
            id: '',
            onChange: () => {
                this.module.config.delete('editui.username');
                this.module.config.delete('editui.password');
                this.module.config.delete('editui.keybind');
                
                (this.module as AltManager).ui.open();
            },
        }),
    ];

    open() {
        this.buttons[0].label = this.module.config.get('editui.username', '')
            ? 'Save'
            : 'Add';
        super.open();
    }
}

export default class AltManager extends Module {
    id = 'altmanager';
    name = 'Alt Manager';
    options = [];

    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        },
    ];

    button = document.createElement('div');
    ui = new AltManagerUI(this);
    addAltUI = new AddAltUI(this);

    renderer() {
        this.button.className = 'button buttonPI lgn';
        this.button.textContent = 'Alt Manager';

        let firstStyle = {
            width: '300px',
            marginRight: '0',
            marginLeft: '10px',
            paddingBottom: '13px',
            paddingTop: '5px',
        };

        for (let style in firstStyle)
            this.button.style[style] = firstStyle[style];

        let mount = (bar: HTMLDivElement) => {
            (bar.lastElementChild as HTMLElement).style.display = 'none';
            bar.append(this.button);
        };

        waitFor(() => document.getElementById('signedOutHeaderBar')).then((bar: HTMLDivElement) => {
            mount(bar);

            new MutationObserver(() => {
                bar = document.getElementById('signedOutHeaderBar') as HTMLDivElement;
                if (bar) mount(bar);
            }).observe(document.getElementById('playerHeaderEl'), { childList: true });
        });

        this.button.onclick = () => this.ui.open();

        document.addEventListener('keydown', this.keyListener.bind(this));
        document.addEventListener('mousedown', this.keyListener.bind(this));
    }

    keyListener(event: KeyboardEvent | MouseEvent) {
        let key = Keybind.eventToKey(event);
        let alts = [];

        try {
            let parsed = JSON.parse(
                window.localStorage.getItem('taxAltManager')
            );
            if (Array.isArray(parsed)) alts = parsed;
        } catch {}

        for (let i = 0; i < alts.length; i++) {
            let alt = alts[i];
            let bind = Keybind.parseKey(alt.keybind);

            if (
                bind &&
                bind.type === key.type
            ) {
                let matched = false;

                if (bind.type === KeyType.KEYBOARD) {
                    matched = bind.key === key.key &&
                        bind.ctrl == key.ctrl &&
                        bind.shift == key.shift &&
                        bind.alt == key.alt;
                } else {
                    matched = bind.button === key.button;
                }
                
                if (matched) return this.loginAlt(alt.username);
            };
        }
    }

    loginAlt(username: string) {
        let alts = [];

        try {
            let parsed = JSON.parse(
                window.localStorage.getItem('taxAltManager')
            );
            if (Array.isArray(parsed)) alts = parsed;
        } catch {}

        let alt = alts.find((a) => a.username === username);
        if (!alt) return;

        document.exitPointerLock();
        window.showWindow(5);

        setTimeout(async () => {
            let toggleBtn = document.querySelector('label[for=accEmail] + button') as HTMLButtonElement;

            if (toggleBtn) await new Promise((resolve) => {
                toggleBtn.click();
                setTimeout(resolve);
            });

            let usernameInput = document.getElementById('accName');
            let passwordInput = document.getElementById('accPass');
            let loginBtn = passwordInput?.nextElementSibling as HTMLButtonElement;
            
            if (!usernameInput || !passwordInput || !loginBtn) return;

            (usernameInput as HTMLInputElement).value = alt.username;

            // Decrypt password (handles both AES and legacy XOR formats)
            const decryptedPassword = decryptPassword(alt.password);
            (passwordInput as HTMLInputElement).value = decryptedPassword;

            // Auto-migrate legacy XOR passwords to AES
            if (!alt.password.startsWith('v2:')) {
                const alts = JSON.parse(localStorage.getItem('taxAltManager') || '[]');
                const idx = alts.findIndex((a: any) => a.username === alt.username);
                if (idx !== -1) {
                    alts[idx].password = encryptPassword(decryptedPassword);
                    localStorage.setItem('taxAltManager', JSON.stringify(alts));
                }
            }

            usernameInput.dispatchEvent(new Event('input'));
            passwordInput.dispatchEvent(new Event('input'));

            await new Promise((resolve) => setTimeout(resolve));
            loginBtn.click();
        });
    }

    editAlt(username?: string) {
        let alts = [];

        try {
            let parsed = JSON.parse(
                window.localStorage.getItem('taxAltManager')
            );
            if (Array.isArray(parsed)) alts = parsed;
        } catch {}

        let alt = alts.find((a) => a.username === username) || {
            username: '',
            password: '',
        };

        this.config.set('editui.username', alt.username);
        this.config.set('editui.password', decryptPassword(alt.password));
        if (alt.keybind) this.config.set('editui.keybind', alt.keybind);
        this.addAltUI.open();
    }
}
