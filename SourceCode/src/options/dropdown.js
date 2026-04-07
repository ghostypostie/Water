"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
class Dropdown extends index_1.default {
    options;
    constructor(module, opts) {
        super(module, opts);
        this.options = opts.options;
    }
    generate() {
        let container = super.generate();
        let currValue = this.module.config.get(this.id, this.defaultValue || this.options[0].value);
        let select = document.createElement('select');
        select.classList.add('inputGrey2');
        for (let option of this.options) {
            let opt = document.createElement('option');
            opt.innerText = option.name;
            opt.value = option.value;
            if (option.value == currValue)
                opt.selected = true;
            select.appendChild(opt);
        }
        select.onchange = () => {
            let value = isNaN(parseFloat(select.value)) ? select.value : parseFloat(select.value);
            this.module.config.set(this.id, value);
            this.onChange?.(value);
        };
        container.appendChild(select);
        return container;
    }
}
exports.default = Dropdown;
