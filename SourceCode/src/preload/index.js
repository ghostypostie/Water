"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const context_1 = require("../context");
const game_1 = __importDefault(require("./game"));
const common_1 = __importDefault(require("./common"));
const editor_1 = __importDefault(require("./editor"));
let url = new URL(window.location.href);
let context = (0, context_1.fromURL)(url);
let preload;
let commonPreload = new common_1.default(context);
commonPreload.onLoadStart?.();
switch (context) {
    case context_1.Context.Game:
        preload = new game_1.default();
        preload.onLoadStart?.();
        try {
            let loader = require('./loader');
            if (loader && loader.default) {
                (new loader.default()).onLoadStart?.();
            }
        }
        catch { }
        break;
    case context_1.Context.Editor:
        preload = new editor_1.default();
        preload.onLoadStart?.();
        break;
}
document.addEventListener('DOMContentLoaded', () => {
    commonPreload?.onLoadEnd?.();
    preload?.onLoadEnd?.();
});
