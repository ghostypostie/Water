import Module from '../module';
import ClientOption from '../options';
import Button from '../options/button';

export interface Category {
    name: string;
    options: ClientOption[];
}

export default abstract class UI {
    abstract categories: Category[];
    abstract buttons: Button[];
    width = 1200;
    name?: string;
    module: Module;

    constructor(module: Module) {
        this.module = module;
    }

    open() {
        let windowHolder = document.getElementById('windowHolder');
        let menuWindow = document.getElementById('menuWindow');

        if(!windowHolder || !menuWindow) return;

        windowHolder.className = 'popupWin';
        menuWindow.style.width = this.width + 'px';
        menuWindow.className = 'dark';
        menuWindow.innerHTML = '';

        if(this.name) {
            let header = document.createElement('div');
            header.id = 'referralHeader';
            header.textContent = this.name;
            menuWindow.append(header);
        }

        let holder = document.createElement('div');
        holder.id = 'settHolder';
        menuWindow.append(holder);

        if(!this.categories.length || !this.categories.some(cat => cat.options.length)) {
            let noOptions = document.createElement('div');
            noOptions.classList.add('setHed');
            noOptions.textContent = 'Empty menu.';
            holder.append(noOptions);
        }

        for(let category of this.categories) {
            let container = document.createElement('div');
            container.classList.add('setBodH');

            let header = document.createElement('div');
            header.classList.add('setHed');

            header.onclick = () => {
                let isOpen = container.style.display !== 'none';

                if(isOpen) {
                    header.children[0].textContent = 'keyboard_arrow_right';
                    container.style.display = 'none';
                } else {
                    header.children[0].textContent = 'keyboard_arrow_down';
                    container.style.display = '';
                }
            };

            header.textContent = category.name;
            header.insertAdjacentHTML('afterbegin', '<span class="material-icons plusOrMinus">keyboard_arrow_down</span>');
            if(category.options.length) {
                if(category.name) holder.append(header);
                holder.append(container);
            }

            for(let option of category.options) container.append(option.generate());
        }

        for(let button of this.buttons) menuWindow.append(button.generateBig());
        windowHolder.style.display = '';

        // Restore scroll position on the actual scrollable element
        const savedScroll = sessionStorage.getItem('settings-scroll-position');
        if (savedScroll) {
            // Try both holder and menuWindow as the scroll might be on either
            setTimeout(() => {
                if (holder.scrollHeight > holder.clientHeight) {
                    holder.scrollTop = parseInt(savedScroll);
                } else if (menuWindow.scrollHeight > menuWindow.clientHeight) {
                    menuWindow.scrollTop = parseInt(savedScroll);
                }
            }, 50);
        }

        // Save scroll position - attach to both elements
        const saveScroll = () => {
            const scrollPos = holder.scrollTop || menuWindow.scrollTop || 0;
            sessionStorage.setItem('settings-scroll-position', scrollPos.toString());
        };

        holder.addEventListener('scroll', saveScroll);
        menuWindow.addEventListener('scroll', saveScroll);
    }
}