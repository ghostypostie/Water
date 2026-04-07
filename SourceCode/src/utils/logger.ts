import config from '../config';

/**
 * Debug logger that respects the debugLogging setting
 */
export class Logger {
    private prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    private isDebugEnabled(): boolean {
        return config.get('modules.performance.debugLogging', false);
    }

    log(...args: any[]) {
        if (this.isDebugEnabled()) {
            console.log(`[${this.prefix}]`, ...args);
        }
    }

    warn(...args: any[]) {
        if (this.isDebugEnabled()) {
            console.warn(`[${this.prefix}]`, ...args);
        }
    }

    error(...args: any[]) {
        // Always show errors
        console.error(`[${this.prefix}]`, ...args);
    }

    info(...args: any[]) {
        if (this.isDebugEnabled()) {
            console.info(`[${this.prefix}]`, ...args);
        }
    }
}

export function createLogger(prefix: string): Logger {
    return new Logger(prefix);
}
