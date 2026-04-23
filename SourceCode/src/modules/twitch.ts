import { Context, RunAt } from '../context';
import Module from '../module';
import TextInput from '../options/textinput';
import Button from '../options/button';
import TwitchUI from '../ui/twitch';
import { createLogger } from '../utils/logger';

const logger = createLogger('Twitch');

export default class TwitchChat extends Module {
    name = 'Twitch Chat';
    id = 'twitch';
    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        }
    ];

    twitchUI = new TwitchUI(this);

    options = [
        new TextInput(this, {
            name: 'Channel Name',
            id: 'channel',
            description: 'Enter a Twitch channel name to display its chat in Krunker',
            label: 'Channel Name',
        }),
        new Button(this, {
            name: 'Twitch Settings',
            description: 'Configure Twitch chat display and notifications',
            id: '',
            label: 'Edit',
            onChange: this.twitchUI.open.bind(this.twitchUI),
        }),
    ];

    ws: WebSocket | null = null;
    channel: string | null = null;
    connected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 3000;
    recentMessages: string[] = [];
    messageHistoryLimit = 50;
    badgeCache: Map<string, string> = new Map();
    channelId: string | null = null;
    activeFilters: Set<string> = new Set();

    renderer() {
        // Set up /twitch command filter FIRST
        window.addEventListener('twitch-filter-toggle', () => {
            this.toggleTwitchFilter();
        });

        const channelName = this.config.get('channel', '');
        if (channelName && channelName.trim() !== '') {
            this.connect(channelName);
        }

        this.config.onChange('channel', (newChannel: string) => {
            this.disconnect();
            if (newChannel && newChannel.trim() !== '') {
                this.connect(newChannel);
            }
        });

        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    toggleTwitchFilter() {
        const chatList = document.getElementById('chatList');
        if (!chatList) {
            logger.error('chatList not found - cannot toggle filter');
            return;
        }

        const isTwitchFilterActive = this.activeFilters.has('twitch');

        if (isTwitchFilterActive) {
            // Turn off Twitch filter
            this.activeFilters.delete('twitch');
            this.applyFilters();
            this.showTwitchNotification('All Messages Visible', '#00FF00', false);
        } else {
            // Turn on Twitch filter
            this.activeFilters.add('twitch');
            this.applyFilters();
            
            const twitchCount = chatList.querySelectorAll('[data-twitch="true"]').length;
            this.showTwitchNotification(`Showing Twitch Only (${twitchCount} messages)`, '#9147FF', true);
        }
        
        this.updatePlaceholder();
    }

    private applyFilters() {
        // Remove existing Twitch filter styles
        let twitchStyle = document.getElementById('twitch-filter-style');
        if (!twitchStyle) {
            twitchStyle = document.createElement('style');
            twitchStyle.id = 'twitch-filter-style';
            document.head.appendChild(twitchStyle);
        }

        if (this.activeFilters.has('twitch')) {
            // Hide all non-Twitch messages
            twitchStyle.textContent = `
                #chatList > div:not([data-twitch="true"]) { 
                    display: none !important; 
                }
            `;
        } else {
            // Show all messages
            twitchStyle.textContent = '';
        }
    }

    private updatePlaceholder() {
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        if (!chatInput) return;

        if (this.activeFilters.has('twitch')) {
            chatInput.placeholder = 'Showing Twitch Only';
        } else {
            // Don't override if other filters might be active
            if (chatInput.placeholder.includes('Showing')) {
                // Another filter is active, don't change
                return;
            }
            chatInput.placeholder = 'Enter Message';
        }
    }

    private showTwitchNotification(text: string, color: string, isActive: boolean) {
        // Remove existing notifications
        document.querySelectorAll('.chat-filter-notif').forEach(n => n.remove());

        const notif = document.createElement('div');
        notif.className = 'chat-filter-notif';
        notif.innerHTML = `<span style="color: ${color}; font-weight: bold;">[Twitch Filter]</span> <span style="color: rgba(255,255,255,0.85); margin-left: 6px;">${text}</span>`;
        notif.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000000;
            padding: 12px 24px;
            border-radius: 8px;
            background: rgba(0,0,0,0.9);
            border-left: 4px solid ${color};
            font-size: 15px;
            font-family: 'Segoe UI', Arial, sans-serif;
            opacity: 1;
            transition: opacity 0.3s ease;
            pointer-events: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;

        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => {
                if (notif.parentNode) notif.parentNode.removeChild(notif);
            }, 300);
        }, 2500);
    }

    connect(channelName: string) {
        if (!channelName || channelName.trim() === '') {
            logger.log('No channel specified');
            return;
        }

        this.channel = channelName.toLowerCase().trim();
        logger.log(`Connecting to channel: ${this.channel}`);

        this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

        this.ws.onopen = () => {
            logger.log('WebSocket connected');
            this.ws!.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            this.ws!.send('PASS SCHMOOPIIE');
            this.ws!.send('NICK justinfan67420');
            this.ws!.send(`JOIN #${this.channel}`);
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
            logger.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            logger.log('WebSocket disconnected');
            this.connected = false;
            this.attemptReconnect();
        };
    }

    handleMessage(data: string) {
        const lines = data.split('\r\n');

        lines.forEach(line => {
            if (line.startsWith('PING')) {
                this.ws!.send('PONG :tmi.twitch.tv');
            } else if (line.includes('Welcome, GLHF!')) {
                logger.log(`Successfully joined #${this.channel}`);
                this.connected = true;
                this.reconnectAttempts = 0;
            } else if (line.includes('PRIVMSG')) {
                this.parseChatMessage(line);
            } else if (line.includes('USERNOTICE')) {
                this.parseUserNotice(line);
            }
        });
    }

    parseChatMessage(line: string) {
        try {
            let tags: Record<string, string> = {};
            const tagsMatch = line.match(/^@([^ ]+)/);
            if (tagsMatch) {
                const tagPairs = tagsMatch[1].split(';');
                tagPairs.forEach(pair => {
                    const [key, value] = pair.split('=');
                    tags[key] = value;
                });
            }

            const userMatch = line.match(/:(.+?)!/);
            if (!userMatch) return;
            const username = userMatch[1];

            const msgMatch = line.match(/PRIVMSG #.+ :(.+)/);
            if (!msgMatch) return;
            const message = msgMatch[1];

            this.injectToKrunkerChat(username, message, tags);
        } catch (error) {
            logger.error('Error parsing message:', error);
        }
    }

    parseUserNotice(line: string) {
        try {
            let tags: Record<string, string> = {};
            const tagsMatch = line.match(/^@([^ ]+)/);
            if (tagsMatch) {
                const tagPairs = tagsMatch[1].split(';');
                tagPairs.forEach(pair => {
                    const [key, value] = pair.split('=');
                    tags[key] = value || '';
                });
            }

            const msgId = tags['msg-id'];
            
            if (msgId === 'sub' || msgId === 'resub') {
                if (this.config.get('twitch.notifySubs', true)) {
                    const username = tags['login'] || tags['display-name'] || 'Someone';
                    const months = tags['msg-param-cumulative-months'] || '1';
                    this.showNotification(`🎉 ${username} subscribed for ${months} months!`, '#9147FF');
                }
            } else if (msgId === 'raid') {
                if (this.config.get('twitch.notifyRaids', true)) {
                    const raider = tags['msg-param-displayName'] || tags['login'] || 'Someone';
                    const viewers = tags['msg-param-viewerCount'] || '0';
                    this.showNotification(`${raider} is raiding with ${viewers} viewers!`, '#FF4500');
                }
            } else if (msgId === 'ritual') {
                const username = tags['login'] || tags['display-name'] || 'Someone';
                this.showNotification(`👋 ${username} is new to chat!`, '#00FF00');
            } else if (msgId === 'rewardgift' || msgId.includes('redeem')) {
                if (this.config.get('twitch.notifyRedeems', true)) {
                    const username = tags['login'] || tags['display-name'] || 'Someone';
                    const reward = tags['msg-param-reward-name'] || 'a reward';
                    this.showNotification(`⭐ ${username} redeemed: ${reward}`, '#FFD700');
                }
            }
        } catch (error) {
            logger.error('Error parsing user notice:', error);
        }
    }

    showNotification(message: string, color: string) {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;

        const existingMsgs = chatList.querySelectorAll('[id^="chatMsg_"]');
        let maxId = -1;
        existingMsgs.forEach(msg => {
            const id = parseInt(msg.id.replace('chatMsg_', ''));
            if (id > maxId) maxId = id;
        });
        const newId = maxId + 1;

        const chatMsgContainer = document.createElement('div');
        chatMsgContainer.setAttribute('data-tab', '0');
        chatMsgContainer.setAttribute('data-twitch', 'true'); // Mark as Twitch
        chatMsgContainer.classList.add('vanillaChatMsg'); // Add vanilla class for compatibility
        chatMsgContainer.classList.add('msg--server'); // Categorize as server message
        chatMsgContainer.id = `chatMsg_${newId}`;

        const chatItem = document.createElement('div');
        chatItem.className = 'chatItem';

        const messageSpan = document.createElement('span');
        messageSpan.className = 'chatMsg';
        messageSpan.style.color = color;
        messageSpan.style.fontWeight = 'bold';
        messageSpan.style.fontFamily = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        messageSpan.textContent = message;

        chatItem.appendChild(messageSpan);
        chatMsgContainer.appendChild(chatItem);

        chatList.appendChild(chatMsgContainer);

        if (chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 100) {
            chatList.scrollTop = chatList.scrollHeight;
        }

        logger.log(`Notification: ${message}`);
    }

    injectToKrunkerChat(username: string, message: string, tags: Record<string, string>) {
        const chatList = document.getElementById('chatList');
        if (!chatList) {
            logger.warn('chatList element not found');
            return;
        }

        const messageId = `${username}:${message}`;

        if (this.recentMessages.indexOf(messageId) !== -1) {
            logger.log(`Duplicate message filtered: ${username}: ${message}`);
            return;
        }

        this.recentMessages.push(messageId);

        if (this.recentMessages.length > this.messageHistoryLimit) {
            this.recentMessages.shift();
        }

        const existingMsgs = chatList.querySelectorAll('[id^="chatMsg_"]');
        let maxId = -1;
        existingMsgs.forEach(msg => {
            const id = parseInt(msg.id.replace('chatMsg_', ''));
            if (id > maxId) maxId = id;
        });
        const newId = maxId + 1;

        const chatMsgContainer = document.createElement('div');
        chatMsgContainer.setAttribute('data-tab', '0');
        chatMsgContainer.setAttribute('data-twitch', 'true'); // Mark as Twitch message
        chatMsgContainer.classList.add('vanillaChatMsg'); // Add vanilla class for compatibility
        chatMsgContainer.classList.add('msg--player'); // Categorize as player message so it respects chat filters
        chatMsgContainer.id = `chatMsg_${newId}`;

        const chatItem = document.createElement('div');
        chatItem.className = 'chatItem';

        if (this.config.get('twitch.showBadges', true) && tags.badges) {
            this.addBadges(chatItem, tags.badges);
        }

        const usernameSpan = document.createElement('span');
        const displayName = tags['display-name'] || username;
        
        if (this.config.get('twitch.useUserColors', true) && tags.color) {
            usernameSpan.style.color = tags.color;
        } else {
            usernameSpan.style.color = '#B500B5';
        }
        
        usernameSpan.style.fontWeight = '600';
        usernameSpan.style.fontFamily = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        usernameSpan.textContent = `\u200E${displayName}\u200E`;

        const messageSpan = document.createElement('span');
        messageSpan.className = 'chatMsg';
        messageSpan.style.wordWrap = 'break-word';
        messageSpan.style.wordBreak = 'break-word';
        messageSpan.style.overflowWrap = 'break-word';
        messageSpan.style.whiteSpace = 'pre-wrap';
        messageSpan.style.maxWidth = '100%';
        messageSpan.style.fontFamily = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        
        if (this.config.get('twitch.showEmotes', true) && tags.emotes && tags.emotes !== '') {
            this.parseEmotes(messageSpan, message, tags.emotes);
        } else {
            messageSpan.textContent = `\u200E${message}\u200E`;
        }

        chatItem.appendChild(usernameSpan);
        chatItem.appendChild(document.createTextNode(': '));
        chatItem.appendChild(messageSpan);

        chatMsgContainer.appendChild(chatItem);

        chatList.appendChild(chatMsgContainer);

        if (chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 100) {
            chatList.scrollTop = chatList.scrollHeight;
        }

        logger.log(`${displayName}: ${message}`);
    }

    addBadges(container: HTMLElement, badgesData: string) {
        const badges = badgesData.split(',');
        
        badges.forEach(badge => {
            const [badgeType, version] = badge.split('/');
            if (!badgeType || !version) return;
            
            const img = document.createElement('img');
            img.style.height = '18px';
            img.style.width = '18px';
            img.style.verticalAlign = 'middle';
            img.style.marginRight = '4px';
            img.alt = badgeType;
            img.title = badgeType;
            
            // Check cache first
            const cacheKey = `${badgeType}/${version}`;
            if (this.badgeCache.has(cacheKey)) {
                img.src = this.badgeCache.get(cacheKey)!;
                container.appendChild(img);
                return;
            }
            
            // Try multiple badge URL formats
            const urls = [
                // Format 1: Standard global badges
                `https://static-cdn.jtvnw.net/badges/v1/${badgeType}/${version}/1`,
                // Format 2: Alternative CDN
                `https://badges.twitch.tv/v1/badges/global/display?id=${badgeType}&version=${version}`,
            ];
            
            let urlIndex = 0;
            
            const tryNextUrl = () => {
                if (urlIndex < urls.length) {
                    img.src = urls[urlIndex];
                    urlIndex++;
                } else {
                    // All URLs failed, hide badge
                    img.style.display = 'none';
                    console.warn(`[Water] [Twitch] Failed to load badge: ${badgeType}/${version}`);
                }
            };
            
            img.onload = () => {
                // Cache successful URL
                this.badgeCache.set(cacheKey, img.src);
            };
            
            img.onerror = () => {
                tryNextUrl();
            };
            
            // Start with first URL
            tryNextUrl();
            
            container.appendChild(img);
        });
    }

    parseEmotes(container: HTMLElement, message: string, emotesData: string) {
        // Ensure container has emoji font support
        container.style.fontFamily = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        
        const emoteMap: Array<{ start: number; end: number; id: string }> = [];
        
        const emoteParts = emotesData.split('/');
        emoteParts.forEach(part => {
            const [emoteId, positions] = part.split(':');
            if (!positions) return;
            
            const ranges = positions.split(',');
            ranges.forEach(range => {
                const [start, end] = range.split('-').map(Number);
                emoteMap.push({ start, end, id: emoteId });
            });
        });

        emoteMap.sort((a, b) => a.start - b.start);

        let lastIndex = 0;
        emoteMap.forEach(emote => {
            if (emote.start > lastIndex) {
                const textSpan = document.createElement('span');
                textSpan.style.fontFamily = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
                textSpan.textContent = message.substring(lastIndex, emote.start);
                container.appendChild(textSpan);
            }

            const img = document.createElement('img');
            img.src = `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/1.0`;
            img.style.height = '18px';
            img.style.verticalAlign = 'middle';
            img.style.margin = '0 2px';
            img.alt = message.substring(emote.start, emote.end + 1);
            container.appendChild(img);

            lastIndex = emote.end + 1;
        });

        if (lastIndex < message.length) {
            const textSpan = document.createElement('span');
            textSpan.style.fontFamily = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
            textSpan.textContent = message.substring(lastIndex);
            container.appendChild(textSpan);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.log('Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        logger.log(`Reconnecting in ${this.reconnectDelay / 1000}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            if (this.channel) {
                this.connect(this.channel);
            }
        }, this.reconnectDelay);
    }

    disconnect() {
        if (this.ws) {
            logger.log('Disconnecting...');
            this.ws.close();
            this.ws = null;
            this.connected = false;
            this.channel = null;
            this.recentMessages = [];
        }
    }

    cleanup() {
        this.disconnect();
        this.reconnectAttempts = this.maxReconnectAttempts;
        logger.log('Cleanup completed');
    }
}
