"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyType = void 0;
const index_1 = __importDefault(require("./index"));
var KeyType;
(function (KeyType) {
    KeyType[KeyType["KEYBOARD"] = 0] = "KEYBOARD";
    KeyType[KeyType["MOUSE"] = 1] = "MOUSE";
})(KeyType || (exports.KeyType = KeyType = {}));
class Keybind extends index_1.default {
    static unshifted = {
        '!': '1',
        '@': '2',
        '#': '3',
        '$': '4',
        '%': '5',
        '^': '6',
        '&': '7',
        '*': '8',
        '(': '9',
        ')': '0',
        '_': '-',
        '+': '=',
        '{': '[',
        '}': ']',
        '|': '\\',
        '~': '`',
        ':': ';',
        '"': '\'',
        '?': '/',
        '<': ',',
        '>': '.'
    };
    generate() {
        let container = super.generate();
        let bindContainer = document.createElement('div');
        bindContainer.style.float = 'right';
        let bind = document.createElement('span');
        bind.className = 'settText floatRNoC keyIcon';
        let key = Keybind.parseKey(this.module.config.get(this.id, []));
        bind.textContent = key ? Keybind.keyName(key) : 'UNBOUND';
        let onkeydown = (event) => {
            key = Keybind.eventToKey(event);
            if (key.type === KeyType.KEYBOARD && ['Shift', 'Control', 'Alt', 'Meta'].includes(key.key)) {
                if (key.key !== 'Meta')
                    bind.textContent = Keybind.keyName(key);
                return;
            }
            bind.textContent = Keybind.keyName(key);
            let serialized = Keybind.serializeKey(key);
            this.module.config.set(this.id, serialized);
            this.onChange?.(serialized);
            document.removeEventListener('keydown', onkeydown);
            document.removeEventListener('mousedown', onkeydown);
        };
        bind.onclick = () => {
            document.addEventListener('keydown', onkeydown);
            document.addEventListener('mousedown', onkeydown);
            bind.textContent = 'Press any Key';
        };
        let unbind = document.createElement('span');
        unbind.className = 'unbind';
        unbind.title = 'Unbind';
        unbind.onclick = () => {
            bind.textContent = 'UNBOUND';
            this.module.config.delete(this.id);
            this.onChange?.(null);
            document.removeEventListener('keydown', onkeydown);
            document.removeEventListener('mousedown', onkeydown);
        };
        let icon = document.createElement('i');
        icon.className = 'material-icons';
        icon.setAttribute('style', 'font-size:40px;color:var(--red);');
        icon.textContent = 'delete_forever';
        unbind.append(icon);
        bindContainer.append(unbind, bind);
        container.append(bindContainer);
        return container;
    }
    static parseKey(key) {
        if (!key || !key.length)
            return null;
        let parsed = {
            type: key[0] & 1,
        };
        if (parsed.type === KeyType.KEYBOARD) {
            parsed.shift = !!(key[0] & 2);
            parsed.alt = !!(key[0] & 4);
            parsed.ctrl = !!(key[0] & 8);
            parsed.key = String.fromCharCode(...key.slice(1));
        }
        else {
            parsed.button = (key[0] & 254) >> 1;
        }
        return parsed;
    }
    static serializeKey(key) {
        let serialized = [key.type];
        if (key.type === KeyType.KEYBOARD) {
            serialized[0] |= (key.shift ? 1 : 0) << 1;
            serialized[0] |= (key.alt ? 1 : 0) << 2;
            serialized[0] |= (key.ctrl ? 1 : 0) << 3;
            serialized.push(...key.key.split('').map(c => c.charCodeAt(0)));
        }
        else {
            serialized[0] |= (key.button << 1) & 255;
        }
        return serialized;
    }
    static keyName(key) {
        if (key.type === KeyType.MOUSE)
            return 'M' + (key.button == 1 ? 3 : key.button == 2 ? 2 : key.button + 1);
        let name = key.key.toUpperCase();
        if (['Shift', 'Control', 'Alt'].includes(key.key))
            name = '?';
        return (key.ctrl ? 'CTRL + ' : '') + (key.shift ? 'SHIFT + ' : '') + (key.alt ? 'ALT + ' : '') + name;
    }
    static eventToKey(event) {
        let key;
        if (event instanceof KeyboardEvent) {
            key = {
                type: KeyType.KEYBOARD,
                shift: event.shiftKey,
                alt: event.altKey,
                ctrl: event.ctrlKey,
                key: event.key,
            };
            if (key.shift && key.key.length === 1)
                key.key = Keybind.unshifted[key.key] || key.key.toLowerCase();
        }
        else {
            key = {
                type: KeyType.MOUSE,
                button: event.button,
            };
        }
        return key;
    }
}
exports.default = Keybind;
