import Module from '../module/index';
import ClientOption from './index';
import { showRestartToast } from '../utils/toast';

export default class TextInput extends ClientOption {
    label: string;
    type?: string;

    constructor(module: Module, opts: {
        name: string,
        id: string,
        description: string,
        needsRefresh?: boolean,
        needsRestart?: boolean,
        onChange?(value: any): void,

        label: string
        type?: string
    }) {
        super(module, opts);
        this.label = opts.label;
        this.type = opts.type;
    }
    
    generate(): HTMLElement {
        let container = super.generate();

        let input = document.createElement('input');
        input.classList.add('inputGrey2');
        input.placeholder = this.label;
        input.value = this.module.config.get(this.id, this.defaultValue || '') as string;
        input.type = this.type || 'text';
        
        // Apply additional styles for password fields
        if (this.type === 'password') {
            input.style.fontFamily = 'monospace';
            input.style.letterSpacing = '2px';
        }
        
        input.onchange = () => {
            let value = (
                this.type === 'number' ?
                parseFloat(input.value) :
                input.value
            ) || input.value;

            this.module.config.set(this.id, value);
            if(this.onChange) this.onChange(value);
            showRestartToast();
        };

        container.append(input);
        return container;
    }
}