import { Context, RunAt } from '../context';
import Module from '../module';
import Checkbox from '../options/checkbox';
import { fetchGitHubContent } from '../utils/github';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';

interface PremiumScriptMeta {
    id: string;
    name: string;
    github_path: string;
    enabled: boolean;
}

export default class PremiumScripts extends Module {
    name = 'Premium Scripts';
    id = 'premium-scripts';
    
    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        }
    ];

    options: any[] = [];
    private scriptsPath: string;
    private loadedScripts: Map<string, any> = new Map();

    constructor() {
        super();
        this.scriptsPath = join(app.getPath('userData'), 'premium-scripts');
        
        // Ensure directory exists
        if (!existsSync(this.scriptsPath)) {
            mkdirSync(this.scriptsPath, { recursive: true });
        }

        // Load purchased scripts and create toggles
        this.loadPurchasedScripts();
    }

    private loadPurchasedScripts() {
        try {
            const metaPath = join(this.scriptsPath, 'scripts.json');
            if (!existsSync(metaPath)) {
                writeFileSync(metaPath, JSON.stringify([], null, 2));
                return;
            }

            const scripts: PremiumScriptMeta[] = JSON.parse(readFileSync(metaPath, 'utf-8'));
            
            // Create a checkbox for each purchased script
            for (const script of scripts) {
                this.options.push(
                    new Checkbox(this, {
                        name: script.name,
                        id: script.id,
                        description: `Toggle ${script.name}`,
                        onChange: (enabled: boolean) => {
                            if (enabled) {
                                this.enableScript(script);
                            } else {
                                this.disableScript(script.id);
                            }
                        }
                    })
                );
            }
        } catch (e) {
            console.error('[Premium Scripts] Failed to load purchased scripts:', e);
        }
    }

    async downloadAndInstall(itemId: string, itemName: string, githubPath: string): Promise<boolean> {
        try {
            console.log(`[Premium Scripts] Downloading ${itemName}...`);
            
            // Fetch script from GitHub
            const result = await fetchGitHubContent(githubPath);
            if (!result.success || !result.content) {
                console.error('[Premium Scripts] Download failed:', result.error);
                return false;
            }

            // Watermark with Discord ID
            const discordId = localStorage.getItem('water_discord_id') || 'unknown';
            const watermarked = `// Licensed to Discord ID: ${discordId}\n${result.content}`;

            // Save script locally
            const scriptPath = join(this.scriptsPath, `${itemId}.js`);
            writeFileSync(scriptPath, watermarked, 'utf-8');

            // Update metadata
            const metaPath = join(this.scriptsPath, 'scripts.json');
            let scripts: PremiumScriptMeta[] = [];
            
            if (existsSync(metaPath)) {
                scripts = JSON.parse(readFileSync(metaPath, 'utf-8'));
            }

            // Add if not already present
            if (!scripts.find(s => s.id === itemId)) {
                scripts.push({
                    id: itemId,
                    name: itemName,
                    github_path: githubPath,
                    enabled: false
                });
                writeFileSync(metaPath, JSON.stringify(scripts, null, 2));
            }

            console.log(`[Premium Scripts] ${itemName} installed successfully`);
            return true;
        } catch (e) {
            console.error('[Premium Scripts] Installation failed:', e);
            return false;
        }
    }

    private enableScript(script: PremiumScriptMeta) {
        try {
            const scriptPath = join(this.scriptsPath, `${script.id}.js`);
            if (!existsSync(scriptPath)) {
                console.error(`[Premium Scripts] Script file not found: ${scriptPath}`);
                return;
            }

            const scriptContent = readFileSync(scriptPath, 'utf-8');
            
            // Execute script in renderer context
            const scriptFunc = new Function(scriptContent);
            const exported = scriptFunc.call({});

            this.loadedScripts.set(script.id, exported);
            console.log(`[Premium Scripts] ${script.name} enabled`);
        } catch (e) {
            console.error(`[Premium Scripts] Failed to enable ${script.name}:`, e);
        }
    }

    private disableScript(scriptId: string) {
        const exported = this.loadedScripts.get(scriptId);
        if (exported && typeof exported.unload === 'function') {
            try {
                exported.unload();
            } catch (e) {
                console.error(`[Premium Scripts] Error unloading ${scriptId}:`, e);
            }
        }
        this.loadedScripts.delete(scriptId);
        console.log(`[Premium Scripts] ${scriptId} disabled`);
    }

    renderer() {
        // Auto-enable scripts that were enabled before
        const metaPath = join(this.scriptsPath, 'scripts.json');
        if (existsSync(metaPath)) {
            const scripts: PremiumScriptMeta[] = JSON.parse(readFileSync(metaPath, 'utf-8'));
            for (const script of scripts) {
                if (this.config.get(script.id, false)) {
                    this.enableScript(script);
                }
            }
        }
    }
}
