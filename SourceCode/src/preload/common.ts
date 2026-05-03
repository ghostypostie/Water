import { Context, RunAt } from '../context';
import Preload from './preload';
import ModuleManager from '../module/manager';
import { ipcRenderer } from 'electron';
import { injectGMAPI } from './GM_loader';

export default class CommonPreload extends Preload {
    context: Context;
    private moduleManager: ModuleManager;

    constructor(context: Context) {
        super();
        window.exports = {};
        this.context = context;
        console.log(`[CommonPreload] Creating ModuleManager with context=${context} (${Context[context]})`);
        this.moduleManager = new ModuleManager(this.context);
        
        // Expose manager to window for module access
        (window as any).manager = this.moduleManager;
        console.log('[CommonPreload] Exposed manager to window.manager');
        
        // Inject enhanced GM API
        injectGMAPI();
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