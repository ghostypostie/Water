"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const context_1 = require("../context");
const GM_loader_1 = require("./GM_loader");
const preload_1 = __importDefault(require("./preload"));
class EditorPreload extends preload_1.default {
    context = context_1.Context.Editor;
    onLoadStart() {
        let editorPlus = new XMLHttpRequest();
        editorPlus.open('GET', 'https://fonts.googleapis.com/css2?family=Material+Icons&display=swap', false);
        editorPlus.send();
        if (editorPlus.status === 200) {
            let content = editorPlus.responseText;
            let info = (0, GM_loader_1.parseHeader)(content);
            let toGrant = {
                unsafeWindow: window,
                GM_getValue: GM_loader_1.GM_getValue,
                GM_setValue: GM_loader_1.GM_setValue,
            };
            try {
                new Function('window', ...Object.keys(toGrant), content)(window, ...Object.values(toGrant));
            }
            catch (e) {
                console.error(e);
            }
        }
    }
}
exports.default = EditorPreload;
