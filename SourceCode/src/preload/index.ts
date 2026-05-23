import { Context, fromURL } from '../context';
import Preload from './preload';
import GamePreload from './game';
import CommonPreload from './common';
import EditorPreload from './editor';
import { ipcRenderer } from 'electron';

// Expose electron APIs to window
(window as any).electron = {
    focusWindow: async () => {
        try {
            return await ipcRenderer.invoke('focus-window');
        } catch (e) {
            console.error('[Electron] Failed to focus window:', e);
            return false;
        }
    },
};

let url = new URL(window.location.href);
let context = fromURL(url);
let preload: Preload;
let commonPreload = new CommonPreload(context);

commonPreload.onLoadStart?.();
switch (context) {
    case Context.Game:
        preload = new GamePreload();
        preload.onLoadStart?.();

        try {
            let loader = require('./loader');

            if (loader && loader.default) {
                (new loader.default()).onLoadStart?.();
            }
        } catch {}
        
        break;
    case Context.Editor:
        preload = new EditorPreload();
        preload.onLoadStart?.();
        break;
}

document.addEventListener('DOMContentLoaded', () => {
    commonPreload?.onLoadEnd?.();
    preload?.onLoadEnd?.();
});
