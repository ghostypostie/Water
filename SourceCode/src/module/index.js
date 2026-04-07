"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../config"));
class Module {
    manager;
    config = {
        get: (key, def) => config_1.default.get(`modules.${this.id}.${key}`, def),
        set: (key, value) => config_1.default.set(`modules.${this.id}.${key}`, value),
        onChange: (key, callback) => config_1.default.onDidChange(`modules.${this.id}.${key}`, callback),
        onAnyChange: (callback) => config_1.default.onDidChange(`modules.${this.id}`, callback),
        delete: (key) => config_1.default.delete(`modules.${this.id}.${key}`)
    };
    // Priority for settings display order (lower number = higher priority, default = 100)
    priority = 100;
}
exports.default = Module;
