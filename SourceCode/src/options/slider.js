"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
class Slider extends index_1.default {
    min = 0;
    max = 100;
    step = 1;
    constructor(module, opts) {
        super(module, opts);
        if (opts.min)
            this.min = opts.min;
        if (opts.max)
            this.max = opts.max;
        if (opts.step)
            this.step = opts.step;
    }
    generate() {
        let container = super.generate();
        let input = document.createElement('input');
        input.type = 'number';
        input.className = 'sliderVal';
        input.min = this.min + '';
        input.max = this.max + '';
        input.style.marginRight = '0px';
        input.style.borderWidth = '0px';
        let slideCont = document.createElement('div');
        slideCont.className = 'slidecontainer';
        slideCont.style.marginTop = '-8px';
        let slideInput = document.createElement('input');
        slideInput.type = 'range';
        slideInput.className = 'sliderM';
        slideInput.min = this.min + '';
        slideInput.max = this.max + '';
        slideInput.step = this.step + '';
        slideCont.append(slideInput);
        container.append(input, slideCont);
        let currentValue = this.module.config.get(this.id, this.defaultValue ?? ((this.max + this.min) / 2));
        input.value = slideInput.value = currentValue;
        slideInput.oninput = input.oninput = ({ target }) => {
            let parsed = parseFloat(target.value);
            if (isNaN(parsed) || parsed < this.min || parsed > this.max)
                return;
            input.value = parsed + '';
            slideInput.value = parsed + '';
            this.module.config.set(this.id, parsed);
            this.onChange?.(parsed);
        };
        return container;
    }
}
exports.default = Slider;
