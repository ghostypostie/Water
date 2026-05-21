import { getSupabaseClient } from '../utils/supabase';

export const CLIENT_TYPE = 'el';
const WATER_BADGE_ID = 5;

const FALLBACK_BADGE_URL: string | null = 'https://i.postimg.cc/9M1Ns8q5/water.webp';

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function tryWriteFile(path: string, content: string): void {
    try {
        const fs = require('fs');
        fs.writeFileSync(path, content, 'utf8');
    } catch (e) {}
}

function tryReadFile(path: string): string | null {
    try {
        const fs = require('fs');
        if (fs.existsSync(path)) {
            return fs.readFileSync(path, 'utf8').trim();
        }
    } catch (e) {}
    return null;
}

let cachedClientId: string | null = null;
const hasLocalStorage = typeof localStorage !== 'undefined';

export function getClientId(): string {
    if (cachedClientId) return cachedClientId;

    const key = 'water_client_id';
    let id: string | null = null;
    if (hasLocalStorage) {
        id = localStorage.getItem(key);
        if (id) { cachedClientId = id; return id; }
    }

    try {
        const path = require('path');
        const os = require('os');
        const filePath = path.join(os.homedir(), 'Documents', 'Water', 'client.id');
        const fileId = tryReadFile(filePath);
        if (fileId) {
            if (hasLocalStorage) localStorage.setItem(key, fileId);
            cachedClientId = fileId;
            return fileId;
        }
    } catch (e) {}

    id = 'client_' + generateUUID();
    if (hasLocalStorage) localStorage.setItem(key, id);
    cachedClientId = id;

    try {
        const path = require('path');
        const os = require('os');
        const dir = path.join(os.homedir(), 'Documents', 'Water');
        const fs = require('fs');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        tryWriteFile(path.join(dir, 'client.id'), id);
    } catch (e) {}

    return id;
}

export function detectClientType(discordId: string | null | undefined): string | null {
    if (!discordId || typeof discordId !== 'string') return null;
    if (discordId.startsWith('el_')) return 'el';
    if (discordId.startsWith('wv_')) return 'wv';
    if (discordId.startsWith('auto_')) return 'wv';
    if (discordId.startsWith('anon_') || discordId.startsWith('client_')) return 'el';
    return null;
}

export function getBadgeUrlForClient(clientType: string, badgeDef?: any): string | null {
    if (badgeDef) {
        const key = `image_url_${clientType}`;
        if (badgeDef[key]) return badgeDef[key];
        if (badgeDef.image_url) return badgeDef.image_url;
    }
    return FALLBACK_BADGE_URL;
}

export function getWaterBadgeId(): number {
    return WATER_BADGE_ID;
}

class WaterBadgeRegistration {
    private initialized = false;
    private registeredName: string | null = null;

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        const clientId = getClientId();
        const displayName = await this.waitForPlayerName();
        const name = displayName || clientId;
        this.registeredName = name;

        // Only upsert identity — does NOT grant any badges
        await this.upsertIdentity(name, clientId);

        console.log('[WaterBadge] Registered identity:', name, 'clientId:', clientId,
            displayName ? '(display name)' : '(client_id only)');

        if (!displayName) {
            this.watchForNameChange(clientId);
        }
    }

    private waitForPlayerName(): Promise<string | null> {
        return new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
                attempts++;
                const nameEl = document.querySelector(
                    '#voteKickName, .voteKickName, ' +
                    '.menuClassPlayerName, #menuClassPlayerName, ' +
                    '.pListName, .leaderNameM, .leaderNameF, .leaderName, ' +
                    '.profileName, .playerName'
                );
                if (nameEl && nameEl.textContent && nameEl.textContent.trim()) {
                    const extracted = this.extractName(nameEl.textContent);
                    console.log('[WaterBadge] waitForPlayerName: found name on', nameEl.className || nameEl.id || nameEl.tagName, '=', extracted, '(attempt', attempts, ')');
                    resolve(extracted);
                    return;
                }
                const accName = document.querySelector('#accName');
                if (accName && (accName as HTMLInputElement).value) {
                    console.log('[WaterBadge] waitForPlayerName: found name on #accName =', (accName as HTMLInputElement).value, '(attempt', attempts, ')');
                    resolve((accName as HTMLInputElement).value.trim());
                    return;
                }
                if (attempts >= 20) {
                    console.log('[WaterBadge] waitForPlayerName: TIMEOUT after 20 attempts');
                    resolve(null);
                    return;
                }
                setTimeout(check, 500);
            };
            check();
        });
    }

    private watchForNameChange(clientId: string) {
        const check = () => {
            const nameEl = document.querySelector(
                '#voteKickName, .voteKickName, ' +
                '.menuClassPlayerName, #menuClassPlayerName, ' +
                '.pListName, .leaderNameM, .leaderNameF, .leaderName, ' +
                '.profileName, .playerName'
            );
            if (nameEl && nameEl.textContent && nameEl.textContent.trim()) {
                const name = this.extractName(nameEl.textContent);
                if (name && name !== this.registeredName) {
                    console.log('[WaterBadge] Name changed, re-registering:', this.registeredName, '→', name);
                    this.registeredName = name;
                    this.upsertIdentity(name, clientId);
                }
            }
            setTimeout(check, 5000);
        };
        setTimeout(check, 5000);
    }

    private extractName(text: string): string {
        let name = (text || '').trim();
        name = name.replace(/\s*\[.*?\]\s*$/g, '').trim();
        name = name.replace(/^Kick\s+/i, '');
        return name || '';
    }

    private async upsertIdentity(name: string, clientId: string) {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) return;

            const username = name.toLowerCase();
            const discordId = CLIENT_TYPE + '_' + username;
            const upsertPayload = {
                client_id: clientId,
                anon_id: clientId,
                discord_id: discordId,
                display_name: name,
                username,
            };

            // Upsert: match by client_id, insert if not found
            const { data: existing } = await supabase
                .from('user_badges')
                .select('id')
                .eq('client_id', clientId)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('user_badges')
                    .update({ username, display_name: name, discord_id: discordId })
                    .eq('client_id', clientId);
            } else {
                await supabase
                    .from('user_badges')
                    .insert(upsertPayload);
            }
        } catch (e) {}
    }

    getRegisteredName(): string | null {
        return this.registeredName;
    }
}

console.log('[WaterBadge] Module loaded, creating instance...');
const instance = new WaterBadgeRegistration();
instance.init().then(() => {
    console.log('[WaterBadge] ✅ init completed, registeredName:', instance.getRegisteredName());
}).catch((err) => {
    console.error('[WaterBadge] ❌ init error:', err);
});

export default instance;
