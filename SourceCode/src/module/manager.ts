import Module from './index';
import { Context, RunAt } from '../context';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { session } from 'electron';
import { waitFor } from '../util';

type OnBeforeRequestFunction = (
    details: Electron.OnBeforeRequestListenerDetails,
    callback: (response: Electron.Response) => void
) => any;

export default class Manager {
    loaded: Module[] = [];
    private static beforeRequestCallbacks: OnBeforeRequestFunction[] = [];

    private directory = join(__dirname, '../modules/');
    private context: Context;
    private settingsInjected = false;

    private cached: Module[] = [];

    constructor(context: Context) {
        this.context = context;
    }

    listAll(dir = this.directory): Module[] {

        for (let file of readdirSync(dir)) {
            let path = dir + file;
            let stat = statSync(path);

            if (stat.isDirectory()) this.cached.push(...this.listAll(path + '/'));
            else {
                try {
                    let ModuleClass = require(path).default;
                    
                    // Skip if no default export or if it's not a constructor
                    if (!ModuleClass || typeof ModuleClass !== 'function') continue;

                    let index = this.cached.findIndex(x => x instanceof ModuleClass);
                    if (index >= 0) continue;
                    
                    let module = new ModuleClass();
                    if (module instanceof Module) this.cached.push(module);
                } catch (e) {
                    // Suppress common expected errors from modules trying to access browser APIs in main process
                    const errorMsg = e.toString();
                    const isExpectedError = 
                        errorMsg.includes('document is not defined') ||
                        errorMsg.includes('Headers is not defined') ||
                        errorMsg.includes('window is not defined') ||
                        errorMsg.includes('Cannot read property \'on\' of undefined') ||
                        errorMsg.includes('Cannot read property \'getPath\' of undefined');
                    
                    if (!isExpectedError) {
                        console.error(`[ModuleManager] Failed to load module from ${path}:`, e);
                    }
                }
            }
        }

        return this.cached;
    }

    async load(runAt: RunAt) {
        this.injectSettings();

        let modules = this.listAll();
        
        // Performance: Filter modules before iteration
        const relevantModules = modules.filter(module => 
            module.contexts.findIndex(
                (ctx) => ctx.context == this.context && ctx.runAt == runAt
            ) !== -1
        );
        
        // Process modules in chunks to prevent blocking
        for (let i = 0; i < relevantModules.length; i++) {
            const module = relevantModules[i];
            module.manager = this;

            try {
                module.init?.(this.context);
            } catch (initError) {
                console.error(
                    `Error while initializing module ${module.name}:`,
                    initError
                );
                continue;
            }

            try {
                if (
                    this.context == Context.Startup ||
                    this.context == Context.Common
                )
                    module.main?.();
                else {
                    module.renderer?.(this.context);
                }
            } catch (moduleError) {
                console.error(
                    `Error while running module ${module.name}:`,
                    moduleError
                );
                continue;
            }

            this.loaded.push(module);
            
            // Yield to event loop every 3 modules to prevent "Not Responding"
            // Use setTimeout instead of setImmediate for browser compatibility
            if (i % 3 === 0 && i > 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    private async injectSettings() {
        if (
            this.settingsInjected ||
            this.context == Context.Startup ||
            this.context == Context.Common
        )
            return;
        this.settingsInjected = true;

        let settings: any = await waitFor(
            () =>
                window.windows?.[0] &&
                window.windows[0].getSettings &&
                window.windows[0]
        );

        // Rename "Client" tab to "Water" immediately
        if (settings.tabs && settings.tabs[1]) {
            for (let tab of settings.tabs[1]) {
                if (tab.name === 'Client') {
                    tab.name = 'Water';
                    break;
                }
            }
        }

        let gen = settings.getSettings;
        settings.getSettings = (...args) => {
            // Rename tab every time settings are opened (in case it resets)
            if (settings.tabs && settings.tabs[1]) {
                for (let tab of settings.tabs[1]) {
                    if (tab.name === 'Client') {
                        tab.name = 'Water';
                        break;
                    }
                }
            }
            
            let result = gen.apply(settings, args);
            setTimeout(this.generateSettings.bind(this, settings));
            return result;
        };
    }

    private generateSettings(settings: any) {
        let removedNoSettingsFound = false;

        let { settingSearch: search } = settings;
        search = search?.toLowerCase() ?? '';

        let tabName =
            settings.tabs[settings.settingType][settings.tabIndex]?.name;
        let isClientTab = tabName == 'Water' || tabName == 'Client';

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
            let genModule =
                (isClientTab ||
                    (search &&
                        (moduleInSearch ||
                            module.options.some((option) =>
                                option.name.toLowerCase().includes(search)
                            )))) &&
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
                    } else {
                        header.children[0].textContent = 'keyboard_arrow_down';
                        container.style.display = '';
                    }
                };

                header.textContent = module.name;
                header.insertAdjacentHTML(
                    'afterbegin',
                    '<span class="material-icons plusOrMinus">keyboard_arrow_down</span>'
                );
                holder.append(header, container);

                for (let option of module.options) {
                    let genOption =
                        isClientTab ||
                        (search &&
                            (moduleInSearch ||
                                option.name.toLowerCase().includes(search)));
                    if (genOption) container.appendChild(option.generate());
                }
            }
        }
    }

    static registerBeforeRequestCallback(callback: OnBeforeRequestFunction) {
        if (!Manager.beforeRequestCallbacks.includes(callback))
            Manager.beforeRequestCallbacks.push(callback);
    }

    static unregisterBeforeRequestCallback(callback: OnBeforeRequestFunction) {
        let index = Manager.beforeRequestCallbacks.indexOf(callback);
        if (index !== -1) Manager.beforeRequestCallbacks.splice(index, 1);
    }

    static async onBeforeRequest(
        details: Electron.OnBeforeRequestListenerDetails,
        finalCallback: (response: Electron.Response) => void
    ) {
        for (let callback of Manager.beforeRequestCallbacks) {
            let response = await new Promise<Electron.Response>((resolve) =>
                callback(details, resolve)
            );

            if (response.cancel || response.redirectURL)
                return finalCallback(response);
        }

        finalCallback({ cancel: false });
    }

    initBeforeRequest() {
        session.defaultSession.webRequest.onBeforeRequest(
            Manager.onBeforeRequest
        );
    }
}
