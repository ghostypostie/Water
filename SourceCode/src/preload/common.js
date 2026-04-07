"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const preload_1 = __importDefault(require("./preload"));
const manager_1 = __importDefault(require("../module/manager"));
const context_1 = require("../context");
class CommonPreload extends preload_1.default {
    context;
    moduleManager;
    constructor(context) {
        super();
        window.exports = {};
        this.context = context;
        this.moduleManager = new manager_1.default(this.context);
    }
    onLoadStart() {
        this.moduleManager.load(context_1.RunAt.LoadStart);
        document.addEventListener('keydown', event => event.key === 'Escape' && document.exitPointerLock());
        delete window.exports;
    }
    onLoadEnd() {
        this.moduleManager.load(context_1.RunAt.LoadEnd);
    }
}
exports.default = CommonPreload;
