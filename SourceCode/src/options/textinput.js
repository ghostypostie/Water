"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
class TextInput extends index_1.default {
    label;
    type;
    constructor(module, opts) {
        super(module, opts);
        this.label = opts.label;
        this.type = opts.type;
    }
    generate() {
        let container = super.generate();
        let input = document.createElement('input');
        input.classList.add('inputGrey2');
        input.placeholder = this.label;
        input.value = this.module.config.get(this.id, this.defaultValue || '');
        input.type = this.type || 'text';
        input.onchange = () => {
            let value = (this.type === 'number' ?
                parseFloat(input.value) :
                input.value) || input.value;
            this.module.config.set(this.id, value);
            if (this.onChange)
                this.onChange(value);
        };
        container.append(input);
        return container;
    }
}
exports.default = TextInput;
