"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
const button_1 = __importDefault(require("../options/button"));
class AltManagerUI extends index_1.default {
    name = 'Alt Manager';
    categories = [];
    buttons = [
        new button_1.default(this.module, {
            id: '',
            label: 'Add Account',
            name: '',
            description: '',
            color: 'cyan',
            onChange: () => this.module.editAlt()
        })
    ];
    open() {
        super.open();
        let settHolder = document.getElementById('settHolder');
        if (!settHolder)
            return;
        let alts = [];
        try {
            let parsed = JSON.parse(window.localStorage.getItem('taxAltManager'));
            if (Array.isArray(parsed))
                alts = parsed;
        }
        catch { }
        if (!alts.length) {
            settHolder.children[0].textContent = 'No accounts added.';
            return;
        }
        else
            settHolder.children[0].remove();
        for (let alt of alts) {
            let container = document.createElement('div');
            container.className = 'setBodH';
            let element = document.createElement('div');
            element.className = 'settName';
            element.textContent = alt.username;
            element.onclick = () => this.module.loginAlt(alt.username);
            let login = document.createElement('div');
            login.textContent = 'Login';
            login.style.backgroundColor = '#00aa00';
            let edit = document.createElement('div');
            edit.textContent = 'Edit';
            edit.style.backgroundColor = '#aa5500';
            edit.onclick = (event) => {
                event.stopPropagation();
                this.module.editAlt(alt.username);
            };
            let remove = document.createElement('div');
            remove.textContent = 'Remove';
            remove.style.backgroundColor = '#aa0000';
            remove.onclick = (event) => {
                event.stopPropagation();
                let index = alts.findIndex(a => a.username === alt.username);
                if (index > -1)
                    alts.splice(index, 1);
                window.localStorage.setItem('taxAltManager', JSON.stringify(alts));
                container.remove();
                if (settHolder.children.length === 0) {
                    let header = document.createElement('div');
                    header.className = 'setHed';
                    header.textContent = 'No accounts added.';
                    settHolder.append(header);
                }
            };
            for (let i = 0; i < 3; i++) {
                let button = [remove, edit, login][i];
                button.className = 'settingsBtn';
                button.style.width = 'auto';
                element.append(button);
            }
            container.append(element);
            settHolder.append(container);
        }
    }
}
exports.default = AltManagerUI;
