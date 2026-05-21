import { createLogger } from '../utils/logger';
import type PickupSystem from './pickup';

const logger = createLogger('PickupTabs');

export default class TabRenderer {
    private pickup: PickupSystem;

    constructor(pickup: PickupSystem) {
        this.pickup = pickup;
    }

    private getUsernameFromGame(): string | null {
        // Try to get username from various game UI elements
        try {
            // Try to get from profile/settings area
            const profileName = document.querySelector('.profileName') as HTMLElement;
            if (profileName && profileName.textContent) {
                return profileName.textContent.trim();
            }
            
            // Try to get from leaderboard (your own name)
            const leaderNames = document.querySelectorAll('.leaderNameM, .leaderNameF, .leaderName');
            for (const nameEl of leaderNames) {
                const el = nameEl as HTMLElement;
                if (el && el.textContent && el.style.color === 'rgb(255, 255, 255)') {
                    return el.textContent.trim();
                }
            }
            
            // Try to get from social tab
            const socialName = document.querySelector('.socialName') as HTMLElement;
            if (socialName && socialName.textContent) {
                return socialName.textContent.trim();
            }
            
            // Try to get from any element with your username
            const allNameElements = document.querySelectorAll('[class*="Name"]');
            for (const el of allNameElements) {
                const element = el as HTMLElement;
                if (element && element.textContent && element.textContent.trim().length > 0 && element.textContent.trim().length < 20) {
                    const text = element.textContent.trim();
                    // Skip common UI text
                    if (!text.includes('Player') && !text.includes('Name') && !text.includes('User') && 
                        !text.includes('Settings') && !text.includes('Profile') && text.length > 2) {
                        return text;
                    }
                }
            }
        } catch (e) {
            console.log('[PickupTabs] Error getting username from game:', e);
        }
        return null;
    }
    
    private getUsername(): string {
        // Try localStorage first
        let username = localStorage.getItem('water_username');
        if (username && username !== 'Unknown') {
            return username;
        }
        
        // Try to get from game UI
        const gameUsername = this.getUsernameFromGame();
        if (gameUsername) {
            // Cache it for future use
            localStorage.setItem('water_username', gameUsername);
            return gameUsername;
        }
        
        // Try other localStorage keys
        const altUsername = localStorage.getItem('username') || localStorage.getItem('player_name') || localStorage.getItem('user_name');
        if (altUsername) {
            localStorage.setItem('water_username', altUsername);
            return altUsername;
        }
        
        // Final fallback
        return 'Water User';
    }

    renderUnavailable(tabName: string): string {
        return `
            <div style="text-align:center;padding:60px 40px;color:rgba(255,255,255,0.6);">
                <h3 style="color:#ff69b4;margin:0 0 12px 0;">${tabName}</h3>
                <p style="font-size:13px;">PUG API is not connected.</p>
                <p style="font-size:12px;color:rgba(255,255,255,0.4);">This feature will be available when the PUG bot is online.</p>
            </div>
        `;
    }

    async renderHomeTab() {
        this.pickup.isLoadingTab = true;
        this.pickup.currentRenderController = new AbortController();
        const signal = this.pickup.currentRenderController.signal;

        const content = document.getElementById('pickupContent');
        if (!content) {
            this.pickup.isLoadingTab = false;
            return;
        }

        if (!this.pickup.selectedServer) {
            content.innerHTML = `
                <div style="text-align: center; padding: 80px 40px; color: rgba(255,255,255,0.8);">
                    <h2 style="color: #ff69b4; margin: 0 0 16px 0; font-size: 26px; font-weight: 600;">Pickup Games System</h2>
                    <p style="font-size: 15px; color: rgba(255,255,255,0.6); margin-bottom: 40px;">Connect with your community and join competitive matches</p>
                    <div style="max-width:450px;margin:0 auto;padding:24px;background:rgba(255,105,180,0.08);border-radius:10px;border:2px solid rgba(255,105,180,0.25);">
                        <p style="font-size:14px;color:#ff69b4;margin:0 0 8px 0;font-weight:600;">Select a server to get started</p>
                        <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0;">Choose your server from the dropdown menu above</p>
                    </div>
                </div>
            `;
            this.pickup.isLoadingTab = false;
            return;
        }

        this.pickup.setupRealtimeSubscription();

        const discordId = localStorage.getItem('discord_id');

        let matchStatus: any = null;
        if (discordId) {
            try {
                const apiUrl = `${this.pickup.waterBotApi}/api/match/${this.pickup.selectedServer}?discord_id=${discordId}`;
                const matchResponse = await fetch(apiUrl, {
                    headers: {
                        'ngrok-skip-browser-warning': '69420',
                        'User-Agent': 'Water'
                    },
                    signal
                });

                if (matchResponse.status === 404 || matchResponse.status === 500) {
                    content.innerHTML = this.renderQueueOffline(matchResponse.status);
                    this.pickup.isLoadingTab = false;
                    return;
                }

                if (!signal.aborted) {
                    const matchResult = await matchResponse.json();
                    if (matchResult.success && matchResult.in_match) {
                        matchStatus = matchResult.match;
                    }
                }
            } catch (e: any) {
                if (e.name !== 'AbortError') {
                    logger.log('Error checking match status:', e);
                }
            }
        }

        if (matchStatus && matchStatus.state === 1 && matchStatus.check_in) {
            this.pickup.isLoadingTab = false;
            this.pickup.overlays.showCheckInOverlay(matchStatus);
            return;
        }

        if (matchStatus && matchStatus.state === 2) {
            this.pickup.isLoadingTab = false;
            this.pickup.renderMatchInProgress(matchStatus);
            return;
        }

        if (matchStatus && matchStatus.state === 3) {
            this.pickup.isLoadingTab = false;
            this.pickup.overlays.showReportOverlay(matchStatus);
            return;
        }

        await this.renderQueueView(signal);
        this.pickup.isLoadingTab = false;
    }

    private renderQueueOffline(status: number): string {
        const isApiOnline = this.pickup.isApiOnline;
        if (!isApiOnline || status === 404) {
            return `
                <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.6);">
                    <h2 style="color:#ff69b4;">PUG Queue Offline</h2>
                    <p>Leaderboard, Rank, and History are still available in the other tabs.</p>
                    <p style="font-size:12px;color:rgba(255,255,255,0.4);">PUG queue will be available when the bot comes back online.</p>
                </div>
            `;
        }
        return `
            <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.6);">
                <h2 style="color:#ff6464;">Server Error (${status})</h2>
                <p style="font-size:12px;color:rgba(255,255,255,0.4);">Please try again later.</p>
            </div>
        `;
    }

    private renderPlayerAvatar(p: any): string {
        const colors = ['#ff69b4','#8a2be2','#00bfff','#ffa500','#00ff88','#ff4466','#ffdd00','#ff66ff'];
        const h = (p.discord_id || p.client_id || '') + (p.username || '');
        let idx = 0; for (let i = 0; i < h.length; i++) idx = ((idx << 5) - idx) + h.charCodeAt(i);
        const c = colors[Math.abs(idx) % colors.length];
        const l = (p.username || '?')[0].toUpperCase();
        return `<div style="width:24px;height:24px;border-radius:4px;background:${c};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;">${l}</div>`;
    }

    private async renderQueueView(signal: AbortSignal) {
        const content = document.getElementById('pickupContent');
        if (!content) return;

        const serverInfo = this.pickup.serverData.get(this.pickup.selectedServer);
        const availableQueues = serverInfo?.available_queues || [];

        if (signal.aborted) return;

        let queueData: any = {};
        try {
            const response = await fetch(`${this.pickup.waterBotApi}/api/queue/${this.pickup.selectedServer}`, {
                headers: {
                    'ngrok-skip-browser-warning': '69420',
                    'User-Agent': 'Water'
                },
                signal
            });

            if (signal.aborted) return;

            const result = await response.json();
            if (result.success) {
                queueData = result;
            }
        } catch (e: any) {
            if (e.name === 'AbortError') return;
            content.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px;color:rgba(255,255,255,0.5);"><div style="width:48px;height:48px;border:2px solid rgba(255,105,180,0.3);border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;color:#ff69b4;font-size:24px;">&#9888;</div><div style="color:#ff69b4;font-size:18px;font-weight:600;margin-bottom:4px;">PUG Queue Offline</div><div style="font-size:12px;">Queue will be available when the bot comes back online</div></div>`;
            return;
        }

        if (signal.aborted) return;

        const discordId = localStorage.getItem('discord_id');
        const clientId = localStorage.getItem('water_client_id');
        const queuePreferences = this.pickup.getQueuePreferences(this.pickup.selectedServer);

        const isInAnyQueue = queueData.players?.some((p: any) =>
            p.discord_id === discordId || p.client_id === clientId
        );

        const allPlayers = queueData.players || [];
        const totalPlayers = allPlayers.length;
        const serverName = serverInfo?.guild_name || 'Server';
        const enabledQueuesCount = availableQueues.filter((q: any) => queuePreferences.includes(q.name)).length;

        const queueCards = availableQueues.map((queue: any) => {
            const isEnabled = queuePreferences.includes(queue.name);
            const queuePlayers = queueData.queues?.[queue.name]?.players || [];
            const queuePlayerCount = queuePlayers.length;
            const isInThisQueue = queuePlayers.some((p: any) => p.discord_id === discordId || p.client_id === clientId);
            const isFull = queuePlayerCount >= queue.size;
            const pct = Math.min((queuePlayerCount / queue.size) * 100, 100);
            const col = isFull ? '#00ff88' : '#ff69b4';
            const bdr = isEnabled ? (isFull ? 'rgba(0,255,136,0.35)' : 'rgba(255,105,180,0.3)') : 'rgba(255,255,255,0.08)';

            return `<div style="background:linear-gradient(135deg,#0e0c16,#14101e);border:1px solid ${bdr};border-radius:12px;padding:16px;display:flex;flex-direction:column;opacity:${isEnabled?'1':'0.4'};min-height:200px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:38px;height:38px;border-radius:10px;background:${col}18;border:1px solid ${col}44;display:flex;align-items:center;justify-content:center;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div><div style="font-size:16px;font-weight:700;color:${isEnabled?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.3)'};">${queue.name}</div></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:#00000033;border-radius:6px;border:1px solid rgba(255,255,255,0.05);"><span style="font-size:14px;font-weight:700;color:${col};">${queuePlayerCount}</span><span style="font-size:10px;color:rgba(255,255,255,0.25);">/${queue.size}</span></div>
                </div>
                <div style="height:3px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;margin-bottom:12px;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${col},${isFull?'#00cc6a':'#ff1493'});border-radius:2px;"></div></div>
                <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-height:0;">
                    ${queuePlayers.length>0?queuePlayers.map((p:any)=>{
                        const isMe = p.discord_id === discordId || p.client_id === clientId;
                        return `<div style="display:flex;align-items:center;gap:6px;padding:5px 7px;background:${isMe?'rgba(255,105,180,0.1)':'transparent'};border-radius:5px;border-left:2px solid ${isMe?'#ff69b4':'transparent'};">
                            ${this.renderPlayerAvatar(p)}
                            <span style="font-size:11px;font-weight:${isMe?'600':'400'};color:${isMe?'#ff69b4':'rgba(255,255,255,0.75)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${p.username||'Player'}${isMe?'<span style="font-size:9px;opacity:0.5;"> (you)</span>':''}</span>
                        </div>`;
                    }).join(''):`<div style="display:flex;align-items:center;justify-content:center;flex:1;color:rgba(255,255,255,0.1);font-size:11px;">${isEnabled?'Waiting for players...':'Queue disabled'}</div>`}
                </div>
                ${isFull&&isEnabled?`<div style="margin-top:10px;padding:5px 8px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);border-radius:6px;text-align:center;font-size:10px;color:#00ff88;font-weight:700;">QUEUE READY &middot; ${queuePlayerCount}/${queue.size}</div>`:isEnabled&&queuePlayerCount>0?`<div style="margin-top:10px;padding:5px 8px;background:rgba(255,105,180,0.06);border:1px solid rgba(255,105,180,0.18);border-radius:6px;text-align:center;font-size:10px;color:#ff69b4;font-weight:500;">${queuePlayerCount} player${queuePlayerCount!==1?'s':''} in queue</div>`:''}
                ${isEnabled&&isInThisQueue?`<div style="margin-top:8px;display:flex;gap:6px;"><button onclick="event.stopPropagation();window.pickupLeaveQueue('${queue.name}')" style="flex:1;background:rgba(255,50,50,0.1);border:1px solid rgba(255,50,50,0.25);color:#ff6464;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:10px;font-weight:600;">Leave</button></div>`:''}
            </div>`;
        }).join('');

        content.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;gap:12px;">
            <div style="background:linear-gradient(135deg,#0e0c16,#14101e);border:1px solid rgba(255,105,180,0.18);border-radius:12px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#ff69b4,#ff1493);display:flex;align-items:center;justify-content:center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div><div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.93);">${serverName}</div><div style="display:flex;gap:8px;font-size:10px;color:rgba(255,255,255,0.35);margin-top:1px;"><span>${availableQueues.length} queue${availableQueues.length!==1?'s':''}</span><span>&middot;</span><span>${enabledQueuesCount} enabled</span>${totalPlayers>0?`<span>&middot;</span><span style="color:#ff69b4;font-weight:600;">${totalPlayers} player${totalPlayers!==1?'s':''}</span>`:''}</div></div>
                </div>
                <button onclick="window.pickupRefreshStatus()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);padding:7px 14px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:600;">Refresh</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:1px;" class="pickup-scrollbar">
                ${queueCards||`<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;background:#0e0c16;border:1px dashed rgba(255,105,180,0.2);border-radius:12px;color:rgba(255,255,255,0.3);font-size:13px;padding:40px;">No queues available</div>`}
            </div>
            ${queueData.game_link?`
            <div style="background:#0a1812;border:1px solid rgba(0,255,136,0.3);border-radius:10px;padding:11px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:rgba(0,255,136,0.12);border:1px solid rgba(0,255,136,0.25);display:flex;align-items:center;justify-content:center;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                    <div><div style="font-size:13px;font-weight:700;color:#00ff88;">${queueData.is_rehost?'GAME REHOSTED':'GAME READY'}</div><div style="font-size:10px;color:rgba(255,255,255,0.4);">Host: ${queueData.host_username||'Unknown'}</div></div>
                </div>
                <div style="display:flex;gap:6px;">
                    <button onclick="window.joinGameLink('${queueData.game_link}')" style="background:rgba(0,255,136,0.15);border:1px solid rgba(0,255,136,0.4);color:#00ff88;padding:7px 16px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:700;">Join</button>
                    <button onclick="window.copyGameLink('${queueData.game_link}')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);padding:7px 12px;border-radius:7px;cursor:pointer;font-size:11px;">Copy</button>
                </div>
            </div>`:''}
            <div style="display:flex;gap:8px;flex-shrink:0;">
                ${isInAnyQueue?`
                <button onclick="window.pickupLeaveQueue()" style="flex:1;background:rgba(255,50,50,0.12);border:1px solid rgba(255,50,50,0.35);color:#ff6464;padding:10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;">Leave Queues</button>
                `:`<button onclick="window.pickupJoinQueue()" style="flex:1;background:linear-gradient(135deg,#ff1493,#ff69b4);border:none;color:#fff;padding:10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;">${enabledQueuesCount>0?`Join (${enabledQueuesCount})`:'Join Queue'}</button>`}
                <button onclick="window.pickupOpenSettings()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);padding:10px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;flex-shrink:0;">Settings</button>
            </div>
            <div style="text-align:center;font-size:9px;color:rgba(255,255,255,0.12);padding:2px 0;flex-shrink:0;">${isInAnyQueue?'In queue &middot; Real-time updates':'Configure queue preferences in Settings'}</div>
        </div>`;

        (window as any).pickupJoinQueue = () => this.pickup.joinQueue();
        (window as any).pickupLeaveQueue = (queueName?: string) => this.pickup.leaveQueue(queueName);
        (window as any).pickupRefreshStatus = () => this.pickup.renderHomeTab();
        (window as any).pickupOpenSettings = () => {
            this.pickup.activeTab = 'Settings';
            this.pickup.updateTabHeader('Settings');
            this.renderSettingsTab();
        };
        (window as any).copyGameLink = (link: string) => {
            navigator.clipboard.writeText(link).then(() => {
                this.pickup.showNotification('Link copied!', 'success');
            }).catch(() => {
                this.pickup.showNotification('Failed to copy', 'error');
            });
        };
        (window as any).joinGameLink = (link: string) => {
            window.open(link, '_blank');
            this.pickup.showNotification('Joining game...', 'success');
        };
    }

    renderMatchInProgress(match: any) {
        const content = document.getElementById('pickupContent');
        if (!content) return;

        const stateNames: Record<number, string> = {
            0: 'Initializing', 1: 'Check-in', 2: 'Draft Phase',
            3: 'Match In Progress', 4: 'Match Complete', 5: 'Rating Changes'
        };

        const matchState = match.state ?? 0;
        const stateName = stateNames[matchState] || `Unknown State (${matchState})`;
        const hasTeams = Array.isArray(match.teams) && match.teams.length > 0;
        const hasGameLink = match.game_link && typeof match.game_link === 'string' && match.game_link.trim() !== '';

        const lastShownLink = (this.pickup as any)._lastShownGameLink || '';
        if (hasGameLink && matchState === 3 && lastShownLink !== match.game_link) {
            (this.pickup as any)._lastShownGameLink = match.game_link;
            this.pickup.overlays.showGameReadyOverlay(match);
        }

        if (hasTeams && (matchState === 2 || matchState === 3)) {
            content.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;padding:20px;overflow-y:auto;color:rgba(255,255,255,0.9);">
                    <div style="text-align:center;margin-bottom:24px;">
                        <h2 style="color:#ff69b4;font-size:28px;margin:0 0 8px 0;font-weight:700;">${match.queue_name} Match</h2>
                        <div style="font-size:16px;color:rgba(255,255,255,0.7);margin-bottom:8px;">${stateName}</div>
                        <div style="font-size:13px;color:rgba(255,255,255,0.5);">Match ID: #${match.match_id}</div>
                    </div>
                    ${hasGameLink ? `
                        <div style="text-align:center;margin-bottom:24px;">
                            <button onclick="window.open('${match.game_link}', '_blank')" style="background:linear-gradient(135deg,#00ff00,#00cc00);border:none;color:#fff;padding:14px 32px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:700;box-shadow:0 4px 16px rgba(0,255,0,0.3);transition:transform 0.2s;" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">Join Game</button>
                            <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:8px;">Click to open game in browser</div>
                        </div>
                    ` : ''}
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;max-width:900px;margin:0 auto;width:100%;">
                        ${match.teams.map((team: any, index: number) => {
                            const teamColors = [
                                { bg: 'rgba(255,105,180,0.15)', border: 'rgba(255,105,180,0.4)', text: '#ff69b4' },
                                { bg: 'rgba(138,43,226,0.15)', border: 'rgba(138,43,226,0.4)', text: '#8a2be2' },
                                { bg: 'rgba(0,191,255,0.15)', border: 'rgba(0,191,255,0.4)', text: '#00bfff' },
                                { bg: 'rgba(255,165,0,0.15)', border: 'rgba(255,165,0,0.4)', text: '#ffa500' }
                            ];
                            const color = teamColors[index % teamColors.length];
                            const players = Array.isArray(team.players) ? team.players : [];
                            let teamName = team.name || (index === 0 ? 'Alpha Team' : index === 1 ? 'Beta Team' : `Team ${index + 1}`);

                            return `
                                <div style="background:${color.bg};border:2px solid ${color.border};border-radius:12px;padding:20px;">
                                    <h3 style="color:${color.text};font-size:20px;margin:0 0 16px 0;font-weight:700;text-align:center;">${teamName}</h3>
                                    <div style="display:flex;flex-direction:column;gap:8px;">
                                        ${players.length > 0 ? players.map((p: any) => `
                                            <div style="padding:10px 14px;background:rgba(0,0,0,0.3);border-radius:8px;font-size:14px;color:rgba(255,255,255,0.9);font-weight:500;">${p.username || p.display_name || 'Unknown Player'}</div>
                                        `).join('') : `
                                            <div style="padding:10px 14px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:13px;color:rgba(255,255,255,0.5);text-align:center;font-style:italic;">No players assigned yet</div>
                                        `}
                                    </div>
                                    <div style="margin-top:12px;text-align:center;font-size:12px;color:rgba(255,255,255,0.5);">${players.length} player${players.length !== 1 ? 's' : ''}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="text-align:center;margin-top:24px;font-size:13px;color:rgba(255,255,255,0.5);">
                        ${matchState === 2 ? 'Teams are being drafted...' : 'Good luck and have fun!'}
                    </div>
                </div>
            `;
        } else {
            const players = Array.isArray(match.players) ? match.players : [];
            content.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:rgba(255,255,255,0.9);padding:40px;">
                    <div style="background:linear-gradient(135deg,rgba(255,105,180,0.15),rgba(138,43,226,0.15));border:2px solid rgba(255,105,180,0.4);border-radius:16px;padding:40px;max-width:500px;">
                        <h2 style="color:#ff69b4;font-size:28px;margin:0 0 16px 0;font-weight:700;">${match.queue_name || 'Match'}</h2>
                        <div style="font-size:18px;color:rgba(255,255,255,0.8);margin-bottom:24px;padding:12px;background:rgba(0,0,0,0.3);border-radius:8px;">${stateName}</div>
                        <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:20px;">Match ID: #${match.match_id || 'Unknown'}</div>
                        ${hasGameLink ? `
                            <button onclick="window.open('${match.game_link}', '_blank')" style="background:linear-gradient(135deg,#00ff00,#00cc00);border:none;color:#fff;padding:14px 32px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:700;box-shadow:0 4px 16px rgba(0,255,0,0.3);margin-bottom:20px;" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">Join Game</button>
                        ` : ''}
                        ${players.length > 0 ? `
                            <div style="padding:16px;background:rgba(255,105,180,0.1);border-radius:8px;margin-bottom:20px;">
                                <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;">Players (${players.length})</div>
                                <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
                                    ${players.map((p: any) => `
                                        <div style="padding:6px 12px;background:rgba(255,255,255,0.1);border-radius:6px;font-size:12px;color:rgba(255,255,255,0.8);">${p.username || p.display_name || 'Unknown'}</div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <div style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">
                            ${matchState === 2 ? 'Teams are being drafted...' : matchState === 3 ? 'Match is in progress.' : 'Preparing match...'}
                        </div>
                    </div>
                </div>
            `;
        }
    }

    async renderLeaderboardTab() {
        const content = document.getElementById('pickupContent');
        if (!content) return;

        if (!this.pickup.selectedServer) {
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">Leaderboard</h3><p style="font-size:13px;margin:0;">Select a server to view leaderboard</p></div>`;
            return;
        }

        content.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;"><div style="font-size:18px;color:#ff69b4;margin-bottom:12px;">Loading Leaderboard...</div><div style="width:40px;height:40px;border:4px solid rgba(255,105,180,0.2);border-top-color:#ff69b4;border-radius:50%;animation:spin 1s linear infinite;"></div></div>`;

        try {
            const imageUrl = `${this.pickup.waterBotApi}/api/leaderboard/${this.pickup.selectedServer}?page=${this.pickup.currentLeaderboardPage}&t=${Date.now()}`;
            const response = await fetch(imageUrl, {
                headers: { 'ngrok-skip-browser-warning': '69420', 'User-Agent': 'Water' }
            });

            if (!response.ok) {
                const errorText = await response.text();
                content.innerHTML = this.renderUnavailable('Leaderboard');
                return;
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            content.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                        <div style="display:flex;gap:8px;">
                            ${this.pickup.currentLeaderboardPage > 1 ? `
                                <button onclick="window.pickupPrevPage()" style="background:rgba(255,105,180,0.15);border:2px solid rgba(255,105,180,0.4);color:#ff69b4;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;" onmouseenter="this.style.background='rgba(255,105,180,0.25)'" onmouseleave="this.style.background='rgba(255,105,180,0.15)'">&lt; Previous</button>
                            ` : ''}
                            <button onclick="window.pickupNextPage()" style="background:rgba(255,105,180,0.15);border:2px solid rgba(255,105,180,0.4);color:#ff69b4;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;" onmouseenter="this.style.background='rgba(255,105,180,0.25)'" onmouseleave="this.style.background='rgba(255,105,180,0.15)'">Next &gt;</button>
                        </div>
                        <div style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;">Page ${this.pickup.currentLeaderboardPage}</div>
                        <button onclick="window.pickupRefreshLeaderboard()" style="background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;" onmouseenter="this.style.background='rgba(255,255,255,0.15)'" onmouseleave="this.style.background='rgba(255,255,255,0.08)'">Refresh</button>
                    </div>
                    <div style="flex:1;background:rgba(0,0,0,0.35);border:2px solid rgba(255,105,180,0.3);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                        <img src="${blobUrl}" alt="Leaderboard" style="max-width:100%;max-height:100%;object-fit:contain;" />
                    </div>
                </div>
            `;

            (window as any).pickupPrevPage = () => {
                if (this.pickup.currentLeaderboardPage > 1) {
                    this.pickup.currentLeaderboardPage--;
                    this.renderLeaderboardTab();
                }
            };
            (window as any).pickupNextPage = () => {
                this.pickup.currentLeaderboardPage++;
                this.renderLeaderboardTab();
            };
            (window as any).pickupRefreshLeaderboard = () => this.renderLeaderboardTab();
        } catch (e) {
            logger.log('Error loading leaderboard:', e);
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff6464;margin:0 0 12px 0;font-size:20px;font-weight:600;">Error</h3><p style="font-size:13px;margin:0;">Failed to load leaderboard</p></div>`;
        }
    }

    async renderRatingChangesTab() {
        const content = document.getElementById('pickupContent');
        if (!content) return;

        if (!this.pickup.selectedServer) {
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">Rating Changes</h3><p style="font-size:13px;margin:0;">Select a server to view rating changes</p></div>`;
            return;
        }

        let discordId = localStorage.getItem('discord_id');
        if (!discordId && this.pickup.manager?.loaded) {
            const store = this.pickup.manager.loaded.find((m: any) => m.id === 'store');
            if (store && typeof (store as any).checkLinkStatus === 'function') {
                await (store as any).checkLinkStatus();
                discordId = localStorage.getItem('discord_id');
            }
        }
        const username = this.getUsername();
        
        if (!discordId) {
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">Rating Changes</h3><p style="font-size:13px;margin:0;">Please link your Discord account to view rating changes</p></div>`;
            return;
        }

        content.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;"><div style="font-size:18px;color:#ff69b4;margin-bottom:12px;">Loading Rating Changes...</div><div style="width:40px;height:40px;border:4px solid rgba(255,105,180,0.2);border-top-color:#ff69b4;border-radius:50%;animation:spin 1s linear infinite;"></div></div>`;

        try {
            const imageUrl = `${this.pickup.waterBotApi}/api/rating-changes/${this.pickup.selectedServer}/${discordId}?username=${encodeURIComponent(username)}&t=${Date.now()}`;
            logger.log('Fetching rating changes:', imageUrl);
            
            const response = await fetch(imageUrl, {
                headers: { 
                    'ngrok-skip-browser-warning': '69420', 
                    'User-Agent': 'Water'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.log('Rating changes error:', response.status, errorText);
                content.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;color:rgba(255,255,255,0.6);"><div style="font-size:18px;color:#ff6464;margin-bottom:8px;font-weight:600;">Failed to Load Rating Changes</div><div style="font-size:13px;margin-bottom:20px;text-align:center;max-width:500px;">Status: ${response.status}<br>${errorText}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">Discord ID: ${discordId}<br>Username: ${username}</div></div>`;
                return;
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            content.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                        <div></div>
                        <div style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;">Rating Changes</div>
                        <button onclick="window.pickupRefreshRatingChanges()" style="background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Refresh</button>
                    </div>
                    <div style="flex:1;background:rgba(0,0,0,0.35);border:2px solid rgba(255,105,180,0.3);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                        <img src="${blobUrl}" alt="Rating Changes" style="max-width:100%;max-height:100%;object-fit:contain;" />
                    </div>
                </div>
            `;
            
            (window as any).pickupRefreshRatingChanges = () => this.renderRatingChangesTab();
        } catch (e) {
            logger.log('Error loading rating changes:', e);
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff6464;margin:0 0 12px 0;font-size:20px;font-weight:600;">Error</h3><p style="font-size:13px;margin:0;">Failed to load rating changes</p><p style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:8px;">Discord ID: ${discordId}<br>Username: ${username}</p></div>`;
        }
    }

    async renderRankTab() {
        const content = document.getElementById('pickupContent');
        if (!content) return;

        if (!this.pickup.selectedServer) {
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">Rank</h3><p style="font-size:13px;margin:0;">Select a server to view rank</p></div>`;
            return;
        }

        let discordId = localStorage.getItem('discord_id');
        if (!discordId && this.pickup.manager?.loaded) {
            const store = this.pickup.manager.loaded.find((m: any) => m.id === 'store');
            if (store && typeof (store as any).checkLinkStatus === 'function') {
                await (store as any).checkLinkStatus();
                discordId = localStorage.getItem('discord_id');
            }
        }
        const username = this.getUsername();
        
        if (!discordId) {
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">Rank</h3><p style="font-size:13px;margin:0;">Please link your Discord account to view rank</p></div>`;
            return;
        }

        content.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;"><div style="font-size:18px;color:#ff69b4;margin-bottom:12px;">Loading Rank...</div><div style="width:40px;height:40px;border:4px solid rgba(255,105,180,0.2);border-top-color:#ff69b4;border-radius:50%;animation:spin 1s linear infinite;"></div></div>`;

        try {
            const imageUrl = `${this.pickup.waterBotApi}/api/rank/${this.pickup.selectedServer}/${discordId}?username=${encodeURIComponent(username)}&t=${Date.now()}`;
            logger.log('Fetching rank:', imageUrl);
            
            const response = await fetch(imageUrl, {
                headers: { 
                    'ngrok-skip-browser-warning': '69420', 
                    'User-Agent': 'Water'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.log('Rank error:', response.status, errorText);
                content.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;color:rgba(255,255,255,0.6);"><div style="font-size:18px;color:#ff6464;margin-bottom:8px;font-weight:600;">Failed to Load Rank</div><div style="font-size:13px;margin-bottom:20px;text-align:center;max-width:500px;">Status: ${response.status}<br>${errorText}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">Discord ID: ${discordId}<br>Username: ${username}</div></div>`;
                return;
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            content.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;">
                    <div style="flex:1;background:linear-gradient(135deg,#0e0c16,#14101e);border:1px solid rgba(255,105,180,0.15);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                        <img src="${blobUrl}" alt="Rank" style="max-width:100%;max-height:100%;object-fit:contain;" />
                    </div>
                </div>
            `;
            
            (window as any).pickupRefreshRank = () => this.renderRankTab();
        } catch (e) {
            logger.log('Error loading rank:', e);
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff6464;margin:0 0 12px 0;font-size:20px;font-weight:600;">Error</h3><p style="font-size:13px;margin:0;">Failed to load rank</p><p style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:8px;">Discord ID: ${discordId}<br>Username: ${username}</p></div>`;
        }
    }

    async renderGameHistoryTab() {
        const content = document.getElementById('pickupContent');
        if (!content) return;

        if (!this.pickup.selectedServer) {
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">Game History</h3><p style="font-size:13px;margin:0;">Select a server to view game history</p></div>`;
            return;
        }

        let discordId = localStorage.getItem('discord_id');
        if (!discordId && this.pickup.manager?.loaded) {
            const store = this.pickup.manager.loaded.find((m: any) => m.id === 'store');
            if (store && typeof (store as any).checkLinkStatus === 'function') {
                await (store as any).checkLinkStatus();
                discordId = localStorage.getItem('discord_id');
            }
        }
        const username = this.getUsername();
        
        if (!discordId) {
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">Game History</h3><p style="font-size:13px;margin:0;">Please link your Discord account to view game history</p></div>`;
            return;
        }

        content.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;"><div style="font-size:18px;color:#ff69b4;margin-bottom:12px;">Loading Game History...</div><div style="width:40px;height:40px;border:4px solid rgba(255,105,180,0.2);border-top-color:#ff69b4;border-radius:50%;animation:spin 1s linear infinite;"></div></div>`;

        try {
            const imageUrl = `${this.pickup.waterBotApi}/api/game-history/${this.pickup.selectedServer}/${discordId}?page=${this.pickup.currentGameHistoryPage}&username=${encodeURIComponent(username)}&t=${Date.now()}`;
            logger.log('Fetching game history:', imageUrl);
            
            const response = await fetch(imageUrl, {
                headers: { 
                    'ngrok-skip-browser-warning': '69420', 
                    'User-Agent': 'Water'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.log('Game history error:', response.status, errorText);
                content.innerHTML = `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;color:rgba(255,255,255,0.6);"><div style="font-size:18px;color:#ff6464;margin-bottom:8px;font-weight:600;">Failed to Load Game History</div><div style="font-size:13px;margin-bottom:20px;text-align:center;max-width:500px;">Status: ${response.status}<br>${errorText}</div><div style="font-size:11px;color:rgba(255,255,255,0.4);">Discord ID: ${discordId}<br>Username: ${username}</div></div>`;
                return;
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            content.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                        <div style="display:flex;gap:8px;">
                            ${this.pickup.currentGameHistoryPage > 1 ? `
                                <button onclick="window.pickupGameHistoryPrevPage()" style="background:rgba(255,105,180,0.15);border:2px solid rgba(255,105,180,0.4);color:#ff69b4;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">&lt; Previous</button>
                            ` : ''}
                            <button onclick="window.pickupGameHistoryNextPage()" style="background:rgba(255,105,180,0.15);border:2px solid rgba(255,105,180,0.4);color:#ff69b4;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Next &gt;</button>
                        </div>
                        <div style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;">Game History - Page ${this.pickup.currentGameHistoryPage}</div>
                        <button onclick="window.pickupRefreshGameHistory()" style="background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Refresh</button>
                    </div>
                    <div style="flex:1;background:rgba(0,0,0,0.35);border:2px solid rgba(255,105,180,0.3);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                        <img src="${blobUrl}" alt="Game History" style="max-width:100%;max-height:100%;object-fit:contain;" />
                    </div>
                </div>
            `;

            (window as any).pickupGameHistoryPrevPage = () => {
                if (this.pickup.currentGameHistoryPage > 1) {
                    this.pickup.currentGameHistoryPage--;
                    this.renderGameHistoryTab();
                }
            };
            (window as any).pickupGameHistoryNextPage = () => {
                this.pickup.currentGameHistoryPage++;
                this.renderGameHistoryTab();
            };
            (window as any).pickupRefreshGameHistory = () => this.renderGameHistoryTab();
        } catch (e) {
            logger.log('Error loading game history:', e);
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff6464;margin:0 0 12px 0;font-size:20px;font-weight:600;">Error</h3><p style="font-size:13px;margin:0;">Failed to load game history</p><p style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:8px;">Discord ID: ${discordId}<br>Username: ${username}</p></div>`;
        }
    }

    renderSettingsTab() {
        const content = document.getElementById('pickupContent');
        if (!content) return;

        if (!this.pickup.selectedServer) {
            content.innerHTML = `<div style="text-align:center;padding:80px 40px;color:rgba(255,255,255,0.6);"><h3 style="color:#ff69b4;margin:0 0 12px 0;font-size:20px;font-weight:600;">Settings</h3><p style="font-size:13px;margin:0;">Select a server to configure queue preferences</p></div>`;
            return;
        }

        const serverInfo = this.pickup.serverData.get(this.pickup.selectedServer);
        const availableQueues = serverInfo?.available_queues || [];
        const currentPreferences = this.pickup.getQueuePreferences(this.pickup.selectedServer);
        const selectedQueues = currentPreferences.length > 0
            ? currentPreferences
            : availableQueues.map((q: any) => q.name);

        content.innerHTML = `
            <div style="max-width:600px;margin:0 auto;color:rgba(255,255,255,0.9);">
                <h2 style="color:#ff69b4;margin:0 0 8px 0;font-size:24px;font-weight:600;">Queue Preferences</h2>
                <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 32px 0;">Select which queues you want to join automatically</p>
                ${availableQueues.length > 0 ? `
                    <div style="padding:24px;background:rgba(0,0,0,0.35);border:2px solid rgba(255,105,180,0.3);border-radius:12px;margin-bottom:20px;">
                        <h3 style="color:rgba(255,255,255,0.9);margin:0 0 16px 0;font-size:16px;font-weight:600;">Available Queues</h3>
                        <div id="queueCheckboxes">
                            ${availableQueues.map((queue: any) => {
                                const isChecked = selectedQueues.includes(queue.name);
                                return `
                                    <label style="display:flex;align-items:center;padding:12px 16px;margin-bottom:8px;background:rgba(255,255,255,0.03);border-radius:8px;cursor:pointer;transition:background 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.06)'" onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
                                        <input type="checkbox" value="${queue.name}" ${isChecked ? 'checked' : ''} style="width:18px;height:18px;margin-right:12px;cursor:pointer;accent-color:#ff69b4;" onchange="window.pickupToggleQueue('${queue.name}', this.checked)" />
                                        <div style="flex:1;">
                                            <div style="color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;">${queue.name}</div>
                                            <div style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:2px;">${queue.size}v${queue.size}</div>
                                        </div>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                        <div style="margin-top:20px;padding:14px;background:rgba(255,105,180,0.08);border-radius:8px;border:1px solid rgba(255,105,180,0.2);">
                            <p style="font-size:12px;color:rgba(255,255,255,0.6);margin:0;">When you join the queue, you'll be added to all selected queues automatically</p>
                        </div>
                    </div>
                    <div style="display:flex;gap:12px;">
                        <button onclick="window.pickupSelectAllQueues()" style="flex:1;background:rgba(255,105,180,0.15);border:2px solid rgba(255,105,180,0.4);color:#ff69b4;padding:12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;" onmouseenter="this.style.background='rgba(255,105,180,0.25)'" onmouseleave="this.style.background='rgba(255,105,180,0.15)'">Select All</button>
                        <button onclick="window.pickupDeselectAllQueues()" style="flex:1;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);padding:12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;" onmouseenter="this.style.background='rgba(255,255,255,0.1)'" onmouseleave="this.style.background='rgba(255,255,255,0.05)'">Deselect All</button>
                    </div>
                ` : `
                    <div style="padding:40px;text-align:center;background:rgba(0,0,0,0.35);border:2px solid rgba(255,105,180,0.3);border-radius:12px;">
                        <p style="color:rgba(255,255,255,0.6);font-size:14px;margin:0;">No queues available for this server</p>
                    </div>
                `}
            </div>
        `;

        (window as any).pickupToggleQueue = (queueName: string, checked: boolean) => {
            const current = this.pickup.getQueuePreferences(this.pickup.selectedServer);
            if (checked && !current.includes(queueName)) {
                current.push(queueName);
            } else if (!checked) {
                const index = current.indexOf(queueName);
                if (index > -1) current.splice(index, 1);
            }
            this.pickup.setQueuePreferences(this.pickup.selectedServer, current);
        };

        (window as any).pickupSelectAllQueues = () => {
            const allQueues = availableQueues.map((q: any) => q.name);
            this.pickup.setQueuePreferences(this.pickup.selectedServer, allQueues);
            this.renderSettingsTab();
        };

        (window as any).pickupDeselectAllQueues = () => {
            this.pickup.setQueuePreferences(this.pickup.selectedServer, []);
            this.renderSettingsTab();
        };
    }
}
