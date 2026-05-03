/**
 * Water Client - TypeScript Compiler for Userscripts
 * Compiles .ts userscripts to JavaScript on-the-fly
 */

import * as ts from 'typescript';
import { strippedConsole } from './userscript-loader';

interface CompilationResult {
    success: boolean;
    code?: string;
    diagnostics?: string[];
    sourceMap?: string;
}

class UserscriptTypeScriptCompiler {
    private compilerOptions: ts.CompilerOptions;
    private compilationCache: Map<string, { code: string; timestamp: number }> = new Map();

    constructor() {
        // Configure TypeScript compiler options
        this.compilerOptions = {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.CommonJS, // Changed from None to CommonJS to support resolveJsonModule
            lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
            removeComments: false,
            sourceMap: false,
            inlineSourceMap: false,
            inlineSources: false,
            declaration: false,
            noEmit: false,
            noEmitOnError: false,
            strict: false,
            esModuleInterop: true,
            skipLibCheck: true,
            allowJs: true,
            checkJs: false,
            resolveJsonModule: false, // Disabled to avoid module conflicts
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            allowSyntheticDefaultImports: true,
            forceConsistentCasingInFileNames: true,
            noImplicitAny: false,
            strictNullChecks: false,
            strictFunctionTypes: false,
            strictBindCallApply: false,
            strictPropertyInitialization: false,
            noImplicitThis: false,
            alwaysStrict: false
        };
    }

    /**
     * Compile TypeScript code to JavaScript
     */
    compile(source: string, filename: string): CompilationResult {
        try {
            strippedConsole.log(`[Water] Compiling TypeScript: ${filename}`);

            // Transpile the TypeScript code
            const result = ts.transpileModule(source, {
                compilerOptions: this.compilerOptions,
                fileName: filename,
                reportDiagnostics: true
            });

            // Check for diagnostics (errors/warnings)
            const diagnostics: string[] = [];
            if (result.diagnostics && result.diagnostics.length > 0) {
                for (const diagnostic of result.diagnostics) {
                    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    
                    if (diagnostic.file && diagnostic.start !== undefined) {
                        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                        diagnostics.push(`${filename}:${line + 1}:${character + 1} - ${message}`);
                    } else {
                        diagnostics.push(`${filename} - ${message}`);
                    }
                }
            }

            // Check if there are errors (not just warnings)
            const hasErrors = result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error);

            if (hasErrors) {
                strippedConsole.error(`[Water] TypeScript compilation failed for ${filename}:`, diagnostics);
                return {
                    success: false,
                    diagnostics
                };
            }

            // Log warnings if any
            if (diagnostics.length > 0) {
                strippedConsole.warn(`[Water] TypeScript compilation warnings for ${filename}:`, diagnostics);
            }

            strippedConsole.log(`[Water] Successfully compiled ${filename} (${result.outputText.length} bytes)`);

            return {
                success: true,
                code: result.outputText,
                diagnostics: diagnostics.length > 0 ? diagnostics : undefined
            };

        } catch (error: any) {
            strippedConsole.error(`[Water] TypeScript compilation error for ${filename}:`, error);
            return {
                success: false,
                diagnostics: [error.message || 'Unknown compilation error']
            };
        }
    }

    /**
     * Compile with caching
     */
    compileWithCache(source: string, filename: string, sourceTimestamp: number): CompilationResult {
        // Check cache
        const cached = this.compilationCache.get(filename);
        if (cached && cached.timestamp === sourceTimestamp) {
            strippedConsole.log(`[Water] Using cached compilation for ${filename}`);
            return {
                success: true,
                code: cached.code
            };
        }

        // Compile
        const result = this.compile(source, filename);

        // Cache successful compilation
        if (result.success && result.code) {
            this.compilationCache.set(filename, {
                code: result.code,
                timestamp: sourceTimestamp
            });
        }

        return result;
    }

    /**
     * Check if a file is TypeScript
     */
    isTypeScriptFile(filename: string): boolean {
        return filename.endsWith('.ts') && !filename.endsWith('.d.ts');
    }

    /**
     * Clear compilation cache
     */
    clearCache() {
        this.compilationCache.clear();
        strippedConsole.log('[Water] TypeScript compilation cache cleared');
    }

    /**
     * Clear cache for specific file
     */
    clearFileCache(filename: string) {
        this.compilationCache.delete(filename);
        strippedConsole.log(`[Water] TypeScript compilation cache cleared for: ${filename}`);
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            entries: this.compilationCache.size,
            files: Array.from(this.compilationCache.keys())
        };
    }

    /**
     * Validate TypeScript syntax without compiling
     */
    validateSyntax(source: string, filename: string): { valid: boolean; errors: string[] } {
        try {
            const sourceFile = ts.createSourceFile(
                filename,
                source,
                ts.ScriptTarget.ES2020,
                true
            );

            const errors: string[] = [];

            // Check for syntax errors
            function visit(node: ts.Node) {
                if (node.kind === ts.SyntaxKind.Unknown) {
                    errors.push(`Syntax error at position ${node.pos}`);
                }
                ts.forEachChild(node, visit);
            }

            visit(sourceFile);

            return {
                valid: errors.length === 0,
                errors
            };

        } catch (error: any) {
            return {
                valid: false,
                errors: [error.message || 'Syntax validation failed']
            };
        }
    }

    /**
     * Get TypeScript version
     */
    getVersion(): string {
        return ts.version;
    }

    /**
     * Create type definitions for Water APIs
     * NOTE: This method is kept for potential future use but is not currently called
     */
    getWaterTypeDefinitions(): string {
        return `
// Water Client Type Definitions for Userscripts

declare global {
    // GM API (Greasemonkey/Tampermonkey)
    function GM_getValue(key: string, defaultValue?: any): any;
    function GM_setValue(key: string, value: any): void;
    function GM_deleteValue(key: string): void;
    function GM_listValues(): string[];
    function GM_addStyle(css: string): HTMLStyleElement;
    function GM_addElement(tagName: string, attributes?: Record<string, string>): HTMLElement;
    function GM_addElement(parentNode: HTMLElement, tagName: string, attributes?: Record<string, string>): HTMLElement;
    function GM_setClipboard(text: string, info?: string | { type?: string; mimetype?: string }): void;
    function GM_notification(text: string, title?: string, image?: string, onclick?: () => void): void;
    function GM_notification(options: {
        text: string;
        title?: string;
        image?: string;
        onclick?: () => void;
        ondone?: () => void;
        timeout?: number;
    }): void;
    function GM_openInTab(url: string, options?: boolean | { active?: boolean; insert?: boolean; setParent?: boolean }): void;
    function GM_getResourceText(name: string): string | null;
    function GM_getResourceURL(name: string): string | null;
    function GM_xmlhttpRequest(details: {
        method: string;
        url: string;
        headers?: Record<string, string>;
        data?: string;
        binary?: boolean;
        timeout?: number;
        onload?: (response: any) => void;
        onerror?: (error: any) => void;
        onprogress?: (progress: any) => void;
        onreadystatechange?: (response: any) => void;
        ontimeout?: () => void;
    }): { abort: () => void };
    function GM_info(): any;

    // GM4 Async API
    const GM: {
        getValue(key: string, defaultValue?: any): Promise<any>;
        setValue(key: string, value: any): Promise<void>;
        deleteValue(key: string): Promise<void>;
        listValues(): Promise<string[]>;
        getResourceText(name: string): Promise<string | null>;
        getResourceUrl(name: string): Promise<string | null>;
        addStyle(css: string): Promise<HTMLStyleElement>;
        setClipboard(text: string, info?: any): Promise<void>;
        notification(options: any): Promise<void>;
        openInTab(url: string, options?: any): Promise<void>;
        xmlHttpRequest(details: any): Promise<any>;
        info: any;
    };

    // Water Client APIs
    interface UserscriptContext {
        unload?: () => void;
        settings?: Record<string, UserscriptSetting>;
        _console: Console;
        _css: (css: string, identifier: string, value: boolean | 'toggle') => void;
    }

    interface UserscriptSetting {
        title: string;
        desc?: string;
        value: any;
        type?: 'bool' | 'num' | 'color' | 'text';
        min?: number;
        max?: number;
        step?: number;
        changed?: (newValue: any) => void;
        requiresRestart?: boolean;
    }

    // Console (stripped version)
    const _console: Console;
    
    // CSS helper
    const _css: (css: string, identifier: string, value: boolean | 'toggle') => void;
}

export {};
`;
    }
}

export const tsCompiler = new UserscriptTypeScriptCompiler();

// Expose to window for debugging
(window as any).waterTypeScript = {
    compile: (source: string, filename: string) => tsCompiler.compile(source, filename),
    validateSyntax: (source: string, filename: string) => tsCompiler.validateSyntax(source, filename),
    clearCache: () => tsCompiler.clearCache(),
    getCacheStats: () => tsCompiler.getCacheStats(),
    getVersion: () => tsCompiler.getVersion(),
    getTypeDefinitions: () => tsCompiler.getWaterTypeDefinitions()
};
