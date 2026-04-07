"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = void 0;
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const ui_1 = __importDefault(require("../ui"));
const altmanager_1 = __importDefault(require("../ui/altmanager"));
const button_1 = __importDefault(require("../options/button"));
const textinput_1 = __importDefault(require("../options/textinput"));
const util_1 = require("../util");
const keybind_1 = __importStar(require("../options/keybind"));
let encryptionKey = 'a5de16da0bb09720a7a917736c3be0beddc4418816c5f469a31419f1f6d5e592';
let encrypt = (data) => {
    let out = '';
    for (let i = 0; i < data.length; i++) {
        out += String.fromCharCode(data.charCodeAt(i) ^
            encryptionKey.charCodeAt(i % encryptionKey.length));
    }
    return out;
};
exports.encrypt = encrypt;
class AddAltUI extends ui_1.default {
    categories = [
        {
            name: '',
            options: [
                new textinput_1.default(this.module, {
                    id: 'editui.username',
                    description: '',
                    label: 'Username',
                    name: 'Username',
                }),
                new textinput_1.default(this.module, {
                    id: 'editui.password',
                    description: '',
                    label: 'Password',
                    name: 'Password',
                    type: 'password',
                }),
                new keybind_1.default(this.module, {
                    id: 'editui.keybind',
                    description: '',
                    name: 'Keybind',
                }),
            ],
        },
    ];
    buttons = [
        new button_1.default(this.module, {
            label: 'Add',
            color: 'purple',
            name: '',
            id: '',
            description: '',
            onChange: () => {
                let username = this.module.config.get('editui.username', '').toLowerCase();
                let password = this.module.config.get('editui.password', '');
                let keybind = this.module.config.get('editui.keybind', []);
                if (!username || !password)
                    return this.module.ui.open();
                let alts = [];
                try {
                    let parsed = JSON.parse(window.localStorage.getItem('taxAltManager'));
                    if (Array.isArray(parsed))
                        alts = parsed;
                }
                catch { }
                let altIndex = alts.findIndex((a) => a.username === username);
                if (altIndex !== -1) {
                    alts[altIndex].password = (0, exports.encrypt)(password);
                    alts[altIndex].keybind = keybind;
                }
                else {
                    alts.push({
                        username,
                        password: (0, exports.encrypt)(password),
                        keybind,
                    });
                }
                window.localStorage.setItem('taxAltManager', JSON.stringify(alts));
                this.module.config.delete('editui.username');
                this.module.config.delete('editui.password');
                this.module.config.delete('editui.keybind');
                this.module.ui.open();
            },
        }),
        new button_1.default(this.module, {
            label: 'Cancel',
            color: 'red',
            name: '',
            id: '',
            description: '',
            onChange: () => {
                this.module.config.delete('editui.username');
                this.module.config.delete('editui.password');
                this.module.config.delete('editui.keybind');
                this.module.ui.open();
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
class AltManager extends module_1.default {
    id = 'altmanager';
    name = 'Alt Manager';
    options = [];
    contexts = [
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadEnd,
        },
    ];
    button = document.createElement('div');
    ui = new altmanager_1.default(this);
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
        let mount = (bar) => {
            bar.lastElementChild.style.display = 'none';
            bar.append(this.button);
        };
        (0, util_1.waitFor)(() => document.getElementById('signedOutHeaderBar')).then((bar) => {
            mount(bar);
            new MutationObserver(() => {
                bar = document.getElementById('signedOutHeaderBar');
                if (bar)
                    mount(bar);
            }).observe(document.getElementById('playerHeaderEl'), { childList: true });
        });
        this.button.onclick = () => this.ui.open();
        document.addEventListener('keydown', this.keyListener.bind(this));
        document.addEventListener('mousedown', this.keyListener.bind(this));
    }
    keyListener(event) {
        let key = keybind_1.default.eventToKey(event);
        let alts = [];
        try {
            let parsed = JSON.parse(window.localStorage.getItem('taxAltManager'));
            if (Array.isArray(parsed))
                alts = parsed;
        }
        catch { }
        for (let i = 0; i < alts.length; i++) {
            let alt = alts[i];
            let bind = keybind_1.default.parseKey(alt.keybind);
            if (bind &&
                bind.type === key.type) {
                let matched = false;
                if (bind.type === keybind_1.KeyType.KEYBOARD) {
                    matched = bind.key === key.key &&
                        bind.ctrl == key.ctrl &&
                        bind.shift == key.shift &&
                        bind.alt == key.alt;
                }
                else {
                    matched = bind.button === key.button;
                }
                if (matched)
                    return this.loginAlt(alt.username);
            }
            ;
        }
    }
    loginAlt(username) {
        let alts = [];
        try {
            let parsed = JSON.parse(window.localStorage.getItem('taxAltManager'));
            if (Array.isArray(parsed))
                alts = parsed;
        }
        catch { }
        let alt = alts.find((a) => a.username === username);
        if (!alt)
            return;
        document.exitPointerLock();
        window.showWindow(5);
        setTimeout(async () => {
            let toggleBtn = document.querySelector('label[for=accEmail] + button');
            if (toggleBtn)
                await new Promise((resolve) => {
                    toggleBtn.click();
                    setTimeout(resolve);
                });
            let usernameInput = document.getElementById('accName');
            let passwordInput = document.getElementById('accPass');
            let loginBtn = passwordInput?.nextElementSibling;
            if (!usernameInput || !passwordInput || !loginBtn)
                return;
            usernameInput.value = alt.username;
            passwordInput.value = (0, exports.encrypt)(alt.password);
            usernameInput.dispatchEvent(new Event('input'));
            passwordInput.dispatchEvent(new Event('input'));
            await new Promise((resolve) => setTimeout(resolve));
            loginBtn.click();
        });
    }
    editAlt(username) {
        let alts = [];
        try {
            let parsed = JSON.parse(window.localStorage.getItem('taxAltManager'));
            if (Array.isArray(parsed))
                alts = parsed;
        }
        catch { }
        let alt = alts.find((a) => a.username === username) || {
            username: '',
            password: '',
        };
        this.config.set('editui.username', alt.username);
        this.config.set('editui.password', (0, exports.encrypt)(alt.password));
        if (alt.keybind)
            this.config.set('editui.keybind', alt.keybind);
        this.addAltUI.open();
    }
}
exports.default = AltManager;
