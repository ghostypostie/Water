import { createLogger } from '../utils/logger';
import type PickupSystem from './pickup';

const logger = createLogger('PickupOverlays');

export default class OverlayManager {
    private pickup: PickupSystem;
    private activeOverlay: HTMLElement | null = null;

    constructor(pickup: PickupSystem) {
        this.pickup = pickup;
    }

    showOverlay(id: string, html: string): HTMLElement {
        if (this.activeOverlay) {
            this.activeOverlay.remove();
        }
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
        this.activeOverlay = overlay;
        return overlay;
    }

    closeOverlay(id: string) {
        const overlay = document.getElementById(id);
        if (overlay) overlay.remove();
        this.activeOverlay = null;
    }

    closeCurrentOverlay() {
        if (this.activeOverlay) {
            this.activeOverlay.remove();
            this.activeOverlay = null;
        }
    }

    showCheckInOverlay(match: any) {
        const checkIn = match.check_in;
        const isReady = checkIn.is_user_ready;
        const readyCount = checkIn.ready_count;
        const totalPlayers = checkIn.total_players;
        const timeRemaining = checkIn.time_remaining;

        let overlay = document.getElementById('pug-overlay-checkin');

        if (overlay) {
            const readyCountEl = overlay.querySelector('#checkinReadyCount');
            const timeRemainingEl = overlay.querySelector('#checkinTimeRemaining');
            const statusEl = overlay.querySelector('#checkinStatus');
            const buttonEl = overlay.querySelector('#checkinButton');

            if (readyCountEl) {
                readyCountEl.textContent = `${readyCount}/${totalPlayers}`;
                (readyCountEl as HTMLElement).style.color = isReady ? '#00ff00' : '#fff';
            }

            if (timeRemainingEl) {
                timeRemainingEl.textContent = `Time Remaining: ${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`;
                (timeRemainingEl as HTMLElement).style.color = timeRemaining < 30 ? '#ff6464' : 'rgba(255,255,255,0.8)';
            }

            if (statusEl && buttonEl) {
                if (isReady) {
                    statusEl.innerHTML = `
                        <div style="padding:16px;background:rgba(0,255,0,0.15);border:2px solid rgba(0,255,0,0.4);border-radius:10px;margin-bottom:20px;">
                            <div style="font-size:16px;color:#00ff00;font-weight:600;">You are ready!</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">Waiting for other players...</div>
                        </div>
                    `;
                    if (checkIn.allow_discard) {
                        buttonEl.innerHTML = `
                            <button onclick="window.pickupSetReady(false)" style="background:rgba(255,0,0,0.2);border:2px solid rgba(255,0,0,0.4);color:#ff6464;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;" onmouseenter="this.style.background='rgba(255,0,0,0.3)'" onmouseleave="this.style.background='rgba(255,0,0,0.2)'">Not Ready</button>
                        `;
                    } else {
                        buttonEl.innerHTML = '';
                    }
                } else {
                    statusEl.innerHTML = '';
                    buttonEl.innerHTML = `
                        <button onclick="window.pickupSetReady(true)" style="background:linear-gradient(135deg,#00ff00,#00cc00);border:none;color:#fff;padding:16px 40px;border-radius:12px;cursor:pointer;font-size:18px;font-weight:700;box-shadow:0 6px 20px rgba(0,255,0,0.4);animation:pulse 2s infinite;" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">I'M READY!</button>
                    `;
                }
            }
            return;
        }

        overlay = this.showOverlay('pug-overlay-checkin', `
            <style>
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            </style>
            <div style="background:linear-gradient(135deg,rgba(20,20,30,0.95),rgba(30,20,40,0.95));border:3px solid #ff69b4;border-radius:20px;padding:40px;max-width:500px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(255,105,180,0.3);">
                <h2 style="color:#ff69b4;font-size:32px;margin:0 0 10px 0;font-weight:700;">${match.queue_name} Match Found!</h2>
                <div id="checkinReadyCount" style="font-size:48px;font-weight:700;color:${isReady ? '#00ff00' : '#fff'};margin:20px 0;">${readyCount}/${totalPlayers}</div>
                <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:20px;">Players Ready</div>
                <div id="checkinTimeRemaining" style="font-size:18px;color:${timeRemaining < 30 ? '#ff6464' : 'rgba(255,255,255,0.8)'};margin-bottom:30px;font-weight:600;">Time Remaining: ${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}</div>
                <div id="checkinStatus">
                    ${isReady ? `
                        <div style="padding:16px;background:rgba(0,255,0,0.15);border:2px solid rgba(0,255,0,0.4);border-radius:10px;margin-bottom:20px;">
                            <div style="font-size:16px;color:#00ff00;font-weight:600;">You are ready!</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">Waiting for other players...</div>
                        </div>
                    ` : ''}
                </div>
                <div id="checkinButton">
                    ${isReady ? (checkIn.allow_discard ? `
                        <button onclick="window.pickupSetReady(false)" style="background:rgba(255,0,0,0.2);border:2px solid rgba(255,0,0,0.4);color:#ff6464;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;" onmouseenter="this.style.background='rgba(255,0,0,0.3)'" onmouseleave="this.style.background='rgba(255,0,0,0.2)'">Not Ready</button>
                    ` : '') : `
                        <button onclick="window.pickupSetReady(true)" style="background:linear-gradient(135deg,#00ff00,#00cc00);border:none;color:#fff;padding:16px 40px;border-radius:12px;cursor:pointer;font-size:18px;font-weight:700;box-shadow:0 6px 20px rgba(0,255,0,0.4);animation:pulse 2s infinite;" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">I'M READY!</button>
                    `}
                </div>
            </div>
        `);

        (window as any).pickupSetReady = async (ready: boolean) => {
            await this.setMatchReady(ready);
        };

        const refreshInterval = setInterval(async () => {
            const discordId = localStorage.getItem('discord_id');
            if (!discordId || !this.pickup.selectedServer) {
                clearInterval(refreshInterval);
                return;
            }

            try {
                const response = await fetch(`${this.pickup.waterBotApi}/api/match/${this.pickup.selectedServer}?discord_id=${discordId}`, {
                    headers: {
                        'ngrok-skip-browser-warning': '69420',
                        'User-Agent': 'Water'
                    }
                });

                const result = await response.json();

                if (result.success && result.in_match && result.match && result.match.state === 1) {
                    this.showCheckInOverlay(result.match);
                } else {
                    clearInterval(refreshInterval);
                    const ov = document.getElementById('pug-overlay-checkin');
                    if (ov) ov.remove();
                    this.activeOverlay = null;

                    if (this.pickup.activeTab === 'Home') {
                        this.pickup.renderHomeTab();
                    }
                }
            } catch (e) {
                logger.log('Error refreshing check-in status:', e);
            }
        }, 2000);

        (overlay as any)._refreshInterval = refreshInterval;
    }

    private async setMatchReady(ready: boolean) {
        const discordId = localStorage.getItem('discord_id');
        if (!discordId || !this.pickup.selectedServer) return;

        const now = Date.now();
        const lastClick = (this.pickup as any)._lastReadyClick || 0;
        if (now - lastClick < 1000) return;
        (this.pickup as any)._lastReadyClick = now;

        try {
            const response = await fetch(`${this.pickup.waterBotApi}/api/match/ready`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420',
                    'User-Agent': 'Water'
                },
                body: JSON.stringify({
                    guild_id: this.pickup.selectedServer,
                    discord_id: discordId,
                    ready: ready
                })
            });

            const result = await response.json();

            if (result.success) {
                const matchResponse = await fetch(`${this.pickup.waterBotApi}/api/match/${this.pickup.selectedServer}?discord_id=${discordId}`, {
                    headers: {
                        'ngrok-skip-browser-warning': '69420',
                        'User-Agent': 'Water'
                    }
                });
                const matchResult = await matchResponse.json();
                if (matchResult.success && matchResult.in_match && matchResult.match) {
                    this.showCheckInOverlay(matchResult.match);
                }
            } else {
                this.pickup.showNotification(result.error || 'Failed to set ready status', 'error');
            }
        } catch (e) {
            logger.log('Error setting ready status:', e);
            this.pickup.showNotification('Failed to set ready status', 'error');
        }
    }

    showGameReadyOverlay(queueData: any) {
        if ((window as any).electron && (window as any).electron.focusWindow) {
            (window as any).electron.focusWindow();
        } else {
            window.focus();
        }

        document.getElementById('pug-overlay-ingame')?.remove();

        const isRehost = queueData.is_rehost || false;
        const gameLink = queueData.game_link;
        const hostName = queueData.host_username || 'Unknown';
        const queueName = queueData.queue_name || 'Queue';

        const overlay = document.createElement('div');
        overlay.id = 'pug-overlay-ingame';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            animation: fadeIn 0.3s ease-out;
        `;

        overlay.innerHTML = `
            <style>
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
                @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            </style>
            <div style="text-align:center;max-width:600px;padding:50px;background:linear-gradient(135deg,rgba(40,40,40,0.98),rgba(20,20,20,0.98));border:3px solid #ff69b4;border-radius:20px;box-shadow:0 0 50px rgba(255,20,147,0.5),0 0 100px rgba(255,20,147,0.3);animation:pulse 2s infinite;">
                <div style="margin-bottom:30px;">
                    <h1 style="color:#ff69b4;font-size:42px;margin:0 0 10px 0;text-shadow:0 0 20px rgba(255,105,180,0.8);">${isRehost ? 'GAME REHOSTED!' : 'GAME READY!'}</h1>
                    <p style="color:rgba(255,255,255,0.9);font-size:18px;margin:0;">${queueName} Hosted by ${hostName}</p>
                </div>
                <div style="position:relative;width:150px;height:150px;margin:30px auto;">
                    <svg width="150" height="150" style="transform:rotate(-90deg);">
                        <circle cx="75" cy="75" r="45" stroke="rgba(255,105,180,0.2)" stroke-width="10" fill="none" />
                        <circle id="countdownCircle" cx="75" cy="75" r="45" stroke="#ff69b4" stroke-width="10" fill="none" stroke-dasharray="283" stroke-dashoffset="0" style="transition:stroke-dashoffset 1s linear;filter:drop-shadow(0 0 10px rgba(255,105,180,0.8));" />
                    </svg>
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:48px;font-weight:bold;color:#ff69b4;text-shadow:0 0 20px rgba(255,105,180,0.8);" id="countdownNumber">10</div>
                </div>
                <p style="color:rgba(255,255,255,0.7);font-size:16px;margin-bottom:30px;">Auto-joining in <span id="countdownText" style="color:#ff69b4;font-weight:bold;">10</span> seconds...</p>
                <div style="display:flex;gap:15px;justify-content:center;">
                    <button id="joinNowBtn" style="flex:1;background:linear-gradient(135deg,#ff1493,#ff69b4);border:none;color:white;padding:18px 40px;border-radius:12px;cursor:pointer;font-size:18px;font-weight:bold;box-shadow:0 5px 20px rgba(255,20,147,0.4);transition:all 0.2s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 25px rgba(255,20,147,0.6)'" onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='0 5px 20px rgba(255,20,147,0.4)'">JOIN NOW</button>
                    <button id="cancelBtn" style="flex:1;background:rgba(100,100,100,0.3);border:2px solid rgba(255,255,255,0.3);color:rgba(255,255,255,0.9);padding:18px 40px;border-radius:12px;cursor:pointer;font-size:18px;font-weight:bold;transition:all 0.2s;" onmouseenter="this.style.background='rgba(100,100,100,0.5)'" onmouseleave="this.style.background='rgba(100,100,100,0.3)'">CANCEL</button>
                </div>
                <div style="margin-top:25px;padding:12px;background:rgba(0,0,0,0.5);border-radius:8px;font-size:11px;color:rgba(255,255,255,0.5);word-break:break-all;font-family:monospace;">${gameLink}</div>
            </div>
        `;

        document.body.appendChild(overlay);

        let countdown = 10;
        const countdownCircle = document.getElementById('countdownCircle');
        const countdownNumber = document.getElementById('countdownNumber');
        const countdownText = document.getElementById('countdownText');
        const joinNowBtn = document.getElementById('joinNowBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdownNumber) countdownNumber.textContent = countdown.toString();
            if (countdownText) countdownText.textContent = countdown.toString();
            if (countdownCircle) {
                const progress = (countdown / 10) * 283;
                countdownCircle.style.strokeDashoffset = (283 - progress).toString();
            }
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.joinGameFromOverlay(gameLink);
            }
        }, 1000);

        joinNowBtn?.addEventListener('click', () => {
            clearInterval(countdownInterval);
            this.joinGameFromOverlay(gameLink);
        });

        cancelBtn?.addEventListener('click', () => {
            clearInterval(countdownInterval);
            overlay.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => overlay.remove(), 300);
        });

        this.playGameReadySound();
    }

    private joinGameFromOverlay(gameLink: string) {
        const overlay = document.getElementById('pug-overlay-ingame');
        if (overlay) {
            overlay.innerHTML = `
                <div style="text-align:center;">
                    <h2 style="color:#ff69b4;font-size:32px;margin:0;">Joining Game...</h2>
                </div>
            `;
        }
        setTimeout(() => {
            window.open(gameLink, '_blank');
            overlay?.remove();
            this.pickup.showNotification('Joined game!', 'success');
        }, 500);
    }

    private playGameReadySound() {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3');
            audio.volume = 0.3;
            audio.play();
        } catch {}
    }

    showDraftOverlay(match: any) {
        const discordId = localStorage.getItem('discord_id');
        const isCaptain = match.teams?.some((t: any) => t.captain_discord_id === discordId);
        const myTeam = match.teams?.find((t: any) =>
            t.captain_discord_id === discordId || t.players?.some((p: any) => p.discord_id === discordId)
        );
        const otherTeam = match.teams?.find((t: any) => t !== myTeam);

        this.showOverlay('pug-overlay-draft', `
            <div style="text-align:center;max-width:700px;width:90%;padding:30px;background:linear-gradient(135deg,rgba(20,20,30,0.95),rgba(30,20,40,0.95));border:3px solid #ff69b4;border-radius:20px;box-shadow:0 20px 60px rgba(255,105,180,0.3);">
                <h2 style="color:#ff69b4;font-size:28px;margin:0 0 20px 0;">Draft In Progress</h2>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                    <div style="background:rgba(255,105,180,0.1);border:2px solid rgba(255,105,180,0.4);border-radius:12px;padding:20px;">
                        <h3 style="color:#ff69b4;margin:0 0 12px 0;">${myTeam?.name || 'Your Team'} ${isCaptain ? '(Captain)' : ''}</h3>
                        ${(myTeam?.players || []).map((p: any) => `
                            <div style="padding:8px 12px;margin-bottom:6px;background:rgba(0,0,0,0.3);border-radius:6px;font-size:13px;color:${p.discord_id === discordId ? '#ff69b4' : 'rgba(255,255,255,0.8)'};font-weight:${p.discord_id === discordId ? '600' : '400'};">
                                ${p.username || p.display_name || 'Player'} ${p.discord_id === discordId ? '(You)' : ''}
                            </div>
                        `).join('')}
                        <div style="padding:8px 12px;background:rgba(0,0,0,0.2);border-radius:6px;font-size:12px;color:rgba(255,255,255,0.5);text-align:center;font-style:italic;">[Waiting for picks...]</div>
                    </div>
                    <div style="background:rgba(138,43,226,0.1);border:2px solid rgba(138,43,226,0.4);border-radius:12px;padding:20px;">
                        <h3 style="color:#8a2be2;margin:0 0 12px 0;">${otherTeam?.name || 'Opponent Team'} ${otherTeam?.captain_discord_id === discordId ? '(Captain)' : ''}</h3>
                        ${(otherTeam?.players || []).map((p: any) => `
                            <div style="padding:8px 12px;margin-bottom:6px;background:rgba(0,0,0,0.3);border-radius:6px;font-size:13px;color:rgba(255,255,255,0.8);font-weight:400;">
                                ${p.username || p.display_name || 'Player'}
                            </div>
                        `).join('')}
                        <div style="padding:8px 12px;background:rgba(0,0,0,0.2);border-radius:6px;font-size:12px;color:rgba(255,255,255,0.5);text-align:center;font-style:italic;">[Waiting for picks...]</div>
                    </div>
                </div>
                <div style="margin-top:20px;padding:12px;background:rgba(255,105,180,0.08);border-radius:8px;">
                    <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0;">${isCaptain ? 'Pick players for your team when it is your turn.' : 'Waiting for captains to draft teams...'}</p>
                </div>
            </div>
        `);
    }

    showMatchInProgressOverlay(match: any) {
        const hasGameLink = match.game_link && typeof match.game_link === 'string' && match.game_link.trim() !== '';

        this.showOverlay('pug-overlay-ingame', `
            <div style="text-align:center;max-width:700px;width:90%;padding:30px;background:linear-gradient(135deg,rgba(20,20,30,0.95),rgba(30,20,40,0.95));border:3px solid #ff69b4;border-radius:20px;box-shadow:0 20px 60px rgba(255,105,180,0.3);">
                <h2 style="color:#ff69b4;font-size:28px;margin:0 0 8px 0;">${match.queue_name || ''} Match In Progress</h2>
                <p style="font-size:13px;color:rgba(255,255,255,0.5);margin:0 0 20px 0;">Match ID: #${match.match_id}</p>
                ${hasGameLink ? `
                    <button onclick="window.open('${match.game_link}', '_blank')" style="background:linear-gradient(135deg,#00ff00,#00cc00);border:none;color:#fff;padding:14px 32px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:700;box-shadow:0 4px 16px rgba(0,255,0,0.3);margin-bottom:16px;" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">Join Game</button>
                ` : '<p style="color:rgba(255,255,255,0.5);font-size:13px;">Waiting for game link...</p>'}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                    ${(match.teams || []).map((team: any, index: number) => {
                        const colors = [
                            { bg: 'rgba(255,105,180,0.1)', border: 'rgba(255,105,180,0.4)', text: '#ff69b4' },
                            { bg: 'rgba(138,43,226,0.1)', border: 'rgba(138,43,226,0.4)', text: '#8a2be2' }
                        ];
                        const color = colors[index % colors.length];
                        return `
                            <div style="background:${color.bg};border:2px solid ${color.border};border-radius:12px;padding:20px;">
                                <h3 style="color:${color.text};margin:0 0 12px 0;font-size:18px;">${team.name || 'Team ' + (index + 1)}</h3>
                                ${(team.players || []).map((p: any) => `
                                    <div style="padding:8px 12px;margin-bottom:4px;background:rgba(0,0,0,0.3);border-radius:6px;font-size:13px;color:rgba(255,255,255,0.9);">${p.username || p.display_name || 'Unknown'}</div>
                                `).join('')}
                            </div>
                        `;
                    }).join('')}
                </div>
                <p style="margin-top:16px;font-size:13px;color:rgba(255,255,255,0.5);">Good luck and have fun!</p>
            </div>
        `);
    }

    showReportOverlay(match: any) {
        const discordId = localStorage.getItem('discord_id');
        const isCaptain = match.teams?.some((t: any) => t.captain_discord_id === discordId);
        const hasGameLink = match.game_link && typeof match.game_link === 'string' && match.game_link.trim() !== '';

        this.showOverlay('pug-overlay-report', `
            <div style="text-align:center;max-width:600px;width:90%;padding:40px;background:linear-gradient(135deg,rgba(20,20,30,0.95),rgba(30,20,40,0.95));border:3px solid #ff69b4;border-radius:20px;box-shadow:0 20px 60px rgba(255,105,180,0.3);">
                <h2 style="color:#ff69b4;font-size:28px;margin:0 0 4px 0;">${match.queue_name || ''} Match</h2>
                <p style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:16px;">Match ID: #${match.match_id}</p>
                ${hasGameLink ? `
                    <button onclick="window.open('${match.game_link}', '_blank')" style="background:linear-gradient(135deg,#00ff00,#00cc00);border:none;color:#fff;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;box-shadow:0 4px 12px rgba(0,255,0,0.3);margin-bottom:16px;" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">Join Game</button>
                ` : ''}
                ${isCaptain ? `
                    <p style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:12px;">Report Match Result</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                        ${(match.teams || []).map((team: any, index: number) => {
                            const colors = [
                                { bg: 'rgba(255,105,180,0.1)', border: 'rgba(255,105,180,0.4)', text: '#ff69b4' },
                                { bg: 'rgba(138,43,226,0.1)', border: 'rgba(138,43,226,0.4)', text: '#8a2be2' }
                            ];
                            const color = colors[index % colors.length];
                            const isMyTeam = team.captain_discord_id === discordId;
                            return `
                                <div style="background:${color.bg};border:2px solid ${color.border};border-radius:12px;padding:16px;">
                                    <h3 style="color:${color.text};margin:0 0 10px 0;font-size:16px;">${team.name || 'Team ' + (index + 1)} ${isMyTeam ? '(You)' : ''}</h3>
                                    ${(team.players || []).map((p: any) => `
                                        <div style="padding:5px 8px;margin-bottom:3px;background:rgba(0,0,0,0.3);border-radius:5px;font-size:12px;color:rgba(255,255,255,0.8);">${p.username || p.display_name || 'Unknown'}</div>
                                    `).join('')}
                                    <div style="margin-top:10px;">
                                        <button onclick="window.pickupReportResult('${index === 0 ? 'alpha' : 'beta'}', 'win')" style="width:100%;background:rgba(0,255,0,0.2);border:2px solid rgba(0,255,0,0.4);color:#00ff00;padding:8px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;" onmouseenter="this.style.background='rgba(0,255,0,0.3)'" onmouseleave="this.style.background='rgba(0,255,0,0.2)'">WE WON!</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <p style="font-size:11px;color:rgba(255,255,255,0.5);">Both captains must confirm the result. If they disagree, a dispute is opened.</p>
                ` : `
                    <div style="padding:20px;background:rgba(255,105,180,0.08);border-radius:12px;margin-bottom:16px;">
                        <p style="font-size:16px;color:rgba(255,255,255,0.8);margin:0 0 6px 0;">Waiting for captains to report the result</p>
                        <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0;">Estimated rating change: +15 ELO (if win)</p>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        ${(match.teams || []).map((team: any, index: number) => {
                            const colors = [
                                { bg: 'rgba(255,105,180,0.1)', border: 'rgba(255,105,180,0.4)' },
                                { bg: 'rgba(138,43,226,0.1)', border: 'rgba(138,43,226,0.4)' }
                            ];
                            const color = colors[index % colors.length];
                            return `
                                <div style="background:${color.bg};border:2px solid ${color.border};border-radius:12px;padding:16px;">
                                    <h3 style="color:#fff;margin:0 0 10px 0;font-size:15px;">${team.name || 'Team ' + (index + 1)}</h3>
                                    ${(team.players || []).map((p: any) => `
                                        <div style="padding:5px 8px;margin-bottom:3px;background:rgba(0,0,0,0.3);border-radius:5px;font-size:12px;color:rgba(255,255,255,0.8);">${p.username || p.display_name || 'Unknown'}</div>
                                    `).join('')}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `);

        if (isCaptain) {
            (window as any).pickupReportResult = async (teamId: string, result: string) => {
                await this.reportMatchResult(match.match_id, teamId, result);
            };
        }
    }

    private async reportMatchResult(matchId: string, teamId: string, result: string) {
        const discordId = localStorage.getItem('discord_id');
        if (!discordId || !this.pickup.selectedServer) return;

        try {
            const response = await fetch(`${this.pickup.waterBotApi}/api/match/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420',
                    'User-Agent': 'Water'
                },
                body: JSON.stringify({
                    guild_id: this.pickup.selectedServer,
                    match_id: matchId,
                    discord_id: discordId,
                    winning_team: teamId
                })
            });

            const result = await response.json();
            if (result.success) {
                this.pickup.showNotification('Result reported!', 'success');
            } else {
                this.pickup.showNotification(result.error || 'Failed to report result', 'error');
            }
        } catch (e) {
            logger.log('Error reporting result:', e);
            this.pickup.showNotification('Failed to report result', 'error');
        }
    }

    showRatingChangesOverlay(match: any) {
        const eloChange = match.rating_change || match.elo_change || 0;
        const newElo = match.new_elo || match.new_rating || 0;
        const rank = match.rank || 'Unranked';

        this.showOverlay('pug-overlay-rating', `
            <div style="text-align:center;max-width:450px;padding:40px;background:linear-gradient(135deg,rgba(20,20,30,0.95),rgba(30,20,40,0.95));border:3px solid #ff69b4;border-radius:20px;box-shadow:0 20px 60px rgba(255,105,180,0.3);">
                <h2 style="color:#ff69b4;font-size:28px;margin:0 0 20px 0;">Rating Updated!</h2>
                <div style="padding:24px;background:rgba(255,105,180,0.1);border:2px solid rgba(255,105,180,0.3);border-radius:12px;margin-bottom:20px;">
                    <div style="font-size:36px;font-weight:700;color:${eloChange >= 0 ? '#00ff00' : '#ff6464'};margin-bottom:8px;">${eloChange >= 0 ? '+' : ''}${eloChange} ELO</div>
                    <div style="font-size:16px;color:rgba(255,255,255,0.8);margin-bottom:4px;">New: ${newElo} ELO</div>
                    <div style="font-size:14px;color:#ff69b4;font-weight:600;">Rank: ${rank}</div>
                </div>
                ${match.kd ? `<p style="font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 8px 0;">K/D this match: ${match.kd}</p>` : ''}
                ${match.score ? `<p style="font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 20px 0;">Score: ${match.score}</p>` : ''}
                <button onclick="document.getElementById('pug-overlay-rating')?.remove()" style="background:linear-gradient(135deg,#ff1493,#ff69b4);border:none;color:#fff;padding:12px 32px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:600;">CLOSE</button>
                <p style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:12px;">Your match history has been updated.</p>
            </div>
        `);
    }
}
