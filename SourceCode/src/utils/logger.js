"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
exports.createLogger = createLogger;
const config_1 = __importDefault(require("../config"));
/**
 * Debug logger that respects the debugLogging setting
 */
class Logger {
    prefix;
    constructor(prefix) {
        this.prefix = prefix;
    }
    isDebugEnabled() {
        return config_1.default.get('modules.performance.debugLogging', false);
    }
    log(...args) {
        if (this.isDebugEnabled()) {
            console.log(`[${this.prefix}]`, ...args);
        }
    }
    warn(...args) {
        if (this.isDebugEnabled()) {
            console.warn(`[${this.prefix}]`, ...args);
        }
    }
    error(...args) {
        // Always show errors
        console.error(`[${this.prefix}]`, ...args);
    }
    info(...args) {
        if (this.isDebugEnabled()) {
            console.info(`[${this.prefix}]`, ...args);
        }
    }
}
exports.Logger = Logger;
function createLogger(prefix) {
    return new Logger(prefix);
}
