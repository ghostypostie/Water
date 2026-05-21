import Module from '../module/index';
import ClientOption from './index';
import { showRestartToast, showInstantToast } from '../utils/toast';

export default class Dropdown extends ClientOption {
    options: {
        name: string,
        value: any
    }[];

    constructor(module: Module, opts: {
        name: string,
        id: string,
        needsRefresh?: boolean,
        needsRestart?: boolean,
        defaultValue?: any,
        onChange?(value: any): void,

        options: {
            name: string,
            value: any
        }[]
    }) {
        super(module, opts);
        this.options = opts.options;
    }

    generate(): HTMLElement {
        let container = super.generate();
        let currValue = this.module.config.get(this.id, this.defaultValue || this.options[0].value);

        let select = document.createElement('select');
        select.classList.add('inputGrey2');

        for(let option of this.options) {
            let opt = document.createElement('option');
            opt.innerText = option.name;
            opt.value = option.value;
            if(option.value == currValue) opt.selected = true;

            select.appendChild(opt);
        }

        select.onchange = () => {
            let value = isNaN(parseFloat(select.value)) ? select.value : parseFloat(select.value);
            this.module.config.set(this.id, value);
            this.onChange?.(value);
            
            // Show appropriate toast based on whether restart is needed
            if (this.needsRestart) {
                showRestartToast();
            } else {
                showInstantToast();
            }
        }

        container.appendChild(select);
        return container;
    }
}