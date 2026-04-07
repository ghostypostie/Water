"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ClientOption {
    name;
    id;
    description;
    module;
    defaultValue;
    needsRefresh;
    needsRestart;
    constructor(module, opts) {
        this.module = module;
        this.name = opts.name;
        this.id = opts.id;
        this.description = opts.description;
        this.needsRefresh = opts.needsRefresh;
        this.needsRestart = opts.needsRestart;
        this.defaultValue = opts.defaultValue;
        this.onChange = opts.onChange;
    }
    generate() {
        let container = document.createElement('div');
        container.classList.add('settName');
        let nameContainer = document.createElement('span');
        nameContainer.classList.add('detailedSettingName');
        let name = document.createElement('span');
        name.classList.add('name');
        let description = document.createElement('span');
        description.classList.add('description');
        name.innerHTML = this.name;
        description.innerHTML = this.description;
        nameContainer.append(name, description);
        container.append(nameContainer);
        for (let i = 0; i < 2; i++) {
            let need = i == 0 ? this.needsRefresh : this.needsRestart;
            if (!need)
                continue;
            let star = document.createElement('span');
            let color = i == 0 ? 'aqua' : 'red';
            star.textContent = '*';
            star.style.color = color;
            name.insertAdjacentElement('beforeend', star);
        }
        return container;
    }
    ;
}
exports.default = ClientOption;
