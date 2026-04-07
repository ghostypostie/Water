"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
const context_1 = require("../context");
const fs_1 = require("fs");
const path_1 = require("path");
const electron_1 = require("electron");
const util_1 = require("../util");
class Manager {
    loaded = [];
    static beforeRequestCallbacks = [];
    directory = (0, path_1.join)(__dirname, '../modules/');
    context;
    settingsInjected = false;
    cached = [];
    constructor(context) {
        this.context = context;
    }
    listAll(dir = this.directory) {
        for (let file of (0, fs_1.readdirSync)(dir)) {
            let path = dir + file;
            let stat = (0, fs_1.statSync)(path);
            if (stat.isDirectory())
                this.cached.push(...this.listAll(path + '/'));
            else {
                try {
                    let ModuleClass = require(path).default;
                    let index = this.cached.findIndex(x => x instanceof ModuleClass);
                    if (index >= 0)
                        continue;
                    let module = new ModuleClass();
                    if (module instanceof index_1.default)
                        this.cached.push(module);
                }
                catch { }
            }
        }
        return this.cached;
    }
    load(runAt) {
        this.injectSettings();
        let modules = this.listAll();
        for (let module of modules) {
            if (module.contexts.findIndex((ctx) => ctx.context == this.context && ctx.runAt == runAt) == -1)
                continue;
            module.manager = this;
            try {
                module.init?.(this.context);
            }
            catch (initError) {
                console.error(`Error while initializing module ${module.name}:`, initError);
                return;
            }
            try {
                if (this.context == context_1.Context.Startup ||
                    this.context == context_1.Context.Common)
                    module.main?.();
                else {
                    module.renderer?.(this.context);
                }
            }
            catch (moduleError) {
                console.error(`Error while running module ${module.name}:`, moduleError);
                return;
            }
            this.loaded.push(module);
        }
    }
    async injectSettings() {
        if (this.settingsInjected ||
            this.context == context_1.Context.Startup ||
            this.context == context_1.Context.Common)
            return;
        this.settingsInjected = true;
        let settings = await (0, util_1.waitFor)(() => window.windows?.[0] &&
            window.windows[0].getSettings &&
            window.windows[0]);
        let gen = settings.getSettings;
        settings.getSettings = (...args) => {
            let result = gen.apply(settings, args);
            setTimeout(this.generateSettings.bind(this, settings));
            return result;
        };
    }
    generateSettings(settings) {
        let removedNoSettingsFound = false;
        let { settingSearch: search } = settings;
        search = search?.toLowerCase() ?? '';
        let tabName = settings.tabs[settings.settingType][settings.tabIndex]?.name;
        let isClientTab = tabName == 'Client';
        let holder = document.getElementById('settHolder');
        if (isClientTab) {
            if (!removedNoSettingsFound) {
                holder.children[0].remove();
                removedNoSettingsFound = true;
            }
            let container = document.createElement('div');
            container.classList.add('setBodH');
            for (let i = 0; i < 2; i++) {
                let need = i == 0 ? 'refresh' : 'restart';
                let color = i == 0 ? 'aqua' : 'red';
                let setting = document.createElement('div');
                setting.classList.add('settName');
                let nameCont = document.createElement('span');
                nameCont.classList.add('detailedSettingName');
                let name = document.createElement('span');
                name.classList.add('name');
                name.textContent = ' Requires ' + need;
                let star = document.createElement('span');
                star.textContent = '*';
                star.style.color = color;
                name.insertAdjacentElement('afterbegin', star);
                nameCont.appendChild(name);
                setting.appendChild(nameCont);
                container.appendChild(setting);
            }
            // Add Discord Store Commands info
            let discordInfo = document.createElement('div');
            discordInfo.classList.add('settName');
            discordInfo.style.marginTop = '10px';
            discordInfo.style.marginBottom = '10px';
            let nameCont = document.createElement('span');
            nameCont.classList.add('detailedSettingName');
            let name = document.createElement('span');
            name.classList.add('name');
            name.innerHTML = `
                Store: 
                <span title="Link your Discord account to Water Client" style="cursor: help;">!link {code}</span> | 
                <span title="Submit KR payment proof to receive Pani" style="cursor: help;">!deposit {kr} {image evidence}</span> | 
                <span title="Check your Pani balance" style="cursor: help;">!balance</span>
            `;
            nameCont.appendChild(name);
            discordInfo.appendChild(nameCont);
            container.appendChild(discordInfo);
            holder.appendChild(container);
        }
        // Sort modules by priority (lower number = higher priority)
        const sortedModules = this.listAll().sort((a, b) => {
            const priorityA = a.priority ?? 100;
            const priorityB = b.priority ?? 100;
            return priorityA - priorityB;
        });
        for (let module of sortedModules) {
            let moduleInSearch = module.name.toLowerCase().includes(search);
            let genModule = (isClientTab ||
                (search &&
                    (moduleInSearch ||
                        module.options.some((option) => option.name.toLowerCase().includes(search))))) &&
                module.options.length;
            if (genModule) {
                if (!removedNoSettingsFound && holder.children.length == 1) {
                    holder.children[0].remove();
                    removedNoSettingsFound = true;
                }
                let container = document.createElement('div');
                container.classList.add('setBodH');
                let header = document.createElement('div');
                header.classList.add('setHed');
                header.onclick = () => {
                    let isOpen = container.style.display !== 'none';
                    if (isOpen) {
                        header.children[0].textContent = 'keyboard_arrow_right';
                        container.style.display = 'none';
                    }
                    else {
                        header.children[0].textContent = 'keyboard_arrow_down';
                        container.style.display = '';
                    }
                };
                header.textContent = module.name;
                header.insertAdjacentHTML('afterbegin', '<span class="material-icons plusOrMinus">keyboard_arrow_down</span>');
                holder.append(header, container);
                for (let option of module.options) {
                    let genOption = isClientTab ||
                        (search &&
                            (moduleInSearch ||
                                option.name.toLowerCase().includes(search)));
                    if (genOption)
                        container.appendChild(option.generate());
                }
            }
        }
    }
    static registerBeforeRequestCallback(callback) {
        if (!Manager.beforeRequestCallbacks.includes(callback))
            Manager.beforeRequestCallbacks.push(callback);
    }
    static unregisterBeforeRequestCallback(callback) {
        let index = Manager.beforeRequestCallbacks.indexOf(callback);
        if (index !== -1)
            Manager.beforeRequestCallbacks.splice(index, 1);
    }
    static async onBeforeRequest(details, finalCallback) {
        for (let callback of Manager.beforeRequestCallbacks) {
            let response = await new Promise((resolve) => callback(details, resolve));
            if (response.cancel || response.redirectURL)
                return finalCallback(response);
        }
        finalCallback({ cancel: false });
    }
    initBeforeRequest() {
        electron_1.session.defaultSession.webRequest.onBeforeRequest(Manager.onBeforeRequest);
    }
}
exports.default = Manager;
