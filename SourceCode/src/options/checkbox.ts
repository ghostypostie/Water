import ClientOption from './index';
import { showRestartToast } from '../utils/toast';

export default class Checkbox extends ClientOption {
    generate(): HTMLElement {
        let container = super.generate();
    
        let slider = document.createElement('label');
        slider.classList.add('switch');
        slider.style.marginLeft = '10px';

        let input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = this.module.config.get(this.id, this.defaultValue || false);
        input.onchange = () => {
            this.module.config.set(this.id, input.checked);
            this.onChange?.(input.checked);
            showRestartToast();
        };
        
        let span = document.createElement('span');
        span.classList.add('slider');

        let grooves = document.createElement('span');
        grooves.classList.add('grooves');
        span.append(grooves);

        slider.append(input, span);
        container.append(slider);

        return container;
    }
}