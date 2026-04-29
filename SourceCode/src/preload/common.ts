import Preload from './preload';
import ModuleManager from '../module/manager';
import { Context, RunAt } from '../context';
import { ipcRenderer } from 'electron';

export default class CommonPreload extends Preload {
    context: Context;
    private moduleManager: ModuleManager;

    constructor(context: Context) {
        super();
        window.exports = {};
        this.context = context;
        console.log(`[CommonPreload] Creating ModuleManager with context=${context} (${Context[context]})`);
        this.moduleManager = new ModuleManager(this.context);
    }

    onLoadStart() {
        this.moduleManager.load(RunAt.LoadStart);
        document.addEventListener('keydown', event => event.key === 'Escape' && document.exitPointerLock());
        delete window.exports;
    }

    onLoadEnd() {
        this.moduleManager.load(RunAt.LoadEnd);
    }
}