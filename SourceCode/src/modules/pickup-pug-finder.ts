import { createLogger } from '../utils/logger';
import { RawLobby } from './pickup-types';

const logger = createLogger('PugFinder');

export default class PugLobbyFinder {
    async findPugLobbies(): Promise<RawLobby[]> {
        try {
            const response = await fetch('https://matchmaker.krunker.io/game-list?hostname=krunker.io');
            const data = await response.json();
            const raw = Array.isArray(data?.games) ? data.games : [];

            return raw
                .map((g: any) => this.parseLobby(g))
                .filter((l: RawLobby | null) => l !== null)
                .filter((l: RawLobby) => {
                    const isPugLobby = l.isCustom && (
                        l.gameID.toLowerCase().includes('pug') ||
                        l.gameID.toLowerCase().includes('scrim') ||
                        l.gameID.toLowerCase().includes('5v5') ||
                        l.gameID.toLowerCase().includes('3v3') ||
                        l.gameID.toLowerCase().includes('2v2')
                    );
                    return isPugLobby && l.playerCount < l.playerLimit;
                });
        } catch (e) {
            logger.log('Error finding PUG lobbies:', e);
            return [];
        }
    }

    async joinBestPugLobby(): Promise<void> {
        const lobbies = await this.findPugLobbies();
        if (lobbies.length === 0) {
            this.showNotification('No PUG lobbies found', 'info');
            return;
        }
        const best = lobbies.sort((a, b) => b.playerCount - a.playerCount)[0];
        window.location.href = `https://krunker.io/?game=${best.gameID}`;
    }

    async createPugLobby(map: string, mode: string, password: string): Promise<string | null> {
        try {
            const response = await fetch('https://krunker.io/api/game/create', {
                method: 'POST',
                body: JSON.stringify({ map, mode, password, isCustom: true })
            });
            if (!response.ok) {
                logger.log('Failed to create PUG lobby:', response.status);
                return null;
            }
            const data = await response.json();
            return data.gameID || null;
        } catch (e) {
            logger.log('Error creating PUG lobby:', e);
            return null;
        }
    }

    private parseLobby(raw: any): RawLobby | null {
        if (!raw || !raw.i) return null;
        return {
            gameID: raw.i,
            region: raw.r || 'unknown',
            gamemode: raw.m || 'unknown',
            gamemodeIndex: raw.mi ?? -1,
            map: raw.m2 || 'unknown',
            playerCount: raw.pc ?? 0,
            playerLimit: raw.pl ?? 0,
            remainingTime: raw.t ?? 0,
            isCustom: raw.c ?? false,
            isOfficialCustom: raw.o ?? false,
            passesFilter: true
        };
    }

    private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? 'rgba(0,200,0,0.2)' : type === 'error' ? 'rgba(255,0,0,0.2)' : 'rgba(255,105,180,0.2)';
        const borderColor = type === 'success' ? 'rgba(0,200,0,0.5)' : type === 'error' ? 'rgba(255,0,0,0.5)' : 'rgba(255,105,180,0.5)';
        notification.style.cssText = `
            position: fixed; top: 60px; right: 20px; padding: 14px 18px;
            background: ${bgColor}; border: 1px solid ${borderColor};
            border-radius: 6px; color: #fff; font-size: 13px;
            font-weight: 500; z-index: 10000; opacity: 0;
            transition: opacity 0.2s;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.style.opacity = '1', 10);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 200);
        }, 3000);
    }
}
