"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
class Checkbox extends index_1.default {
    label;
    color;
    constructor(module, opts) {
        super(module, opts);
        this.label = opts.label;
        this.color = opts.color;
    }
    generate() {
        let container = super.generate();
        let button = document.createElement('div');
        button.classList.add('settingsBtn');
        button.style.width = 'auto';
        button.textContent = this.label;
        if (this.onChange)
            button.onclick = this.onChange.bind(this);
        container.append(button);
        return container;
    }
    generateBig() {
        let colors = {
            purple: 'buttonP',
            pink: 'buttonPI',
            cyan: 'buttonG',
            red: 'buttonR'
        };
        let button = document.createElement('div');
        button.className = 'button';
        button.textContent = this.label;
        button.style.width = 'calc(100% - 10px)';
        button.style.fontSize = '20px';
        button.style.padding = '10px 0';
        if (this.color)
            button.classList.add(colors[this.color]);
        if (this.onChange)
            button.onclick = this.onChange.bind(this);
        return button;
    }
}
exports.default = Checkbox;
