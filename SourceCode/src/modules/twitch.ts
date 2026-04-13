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
    chatObserver: MutationObserver | null = null;

    renderer() {
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

        // Add /twitch command filter
        this.setupTwitchFilter();

        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    setupTwitchFilter() {
        // Wait for chat input to be available
        const waitForChatInput = () => {
            const chatInput = document.getElementById('chatInput') as HTMLInputElement;
            if (!chatInput) {
                setTimeout(waitForChatInput, 500);
                return;
            }

            logger.log('Setting up /twitch command filter');

            // Handler function
            const handleTwitchCommand = (e: KeyboardEvent) => {
                const value = chatInput.value.trim();
                logger.log(`Key pressed: ${e.key}, Input value: "${value}"`);
                
                if (e.key === 'Enter' && value === '/twitch') {
                    logger.log('Twitch command detected! Intercepting...');
                    
                    // Stop all event propagation
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    // Clear input immediately
                    chatInput.value = '';
                    
                    // Toggle filter
                    this.toggleTwitchFilter();
                    
                    // Blur input to close chat
                    setTimeout(() => {
                        chatInput.blur();
                    }, 10);
                    
                    return false;
                }
            };

            // Try multiple event interception strategies
            // Strategy 1: Capture phase keydown (highest priority)
            chatInput.addEventListener('keydown', handleTwitchCommand, { capture: true });
            
            // Strategy 2: Bubble phase keydown (backup)
            chatInput.addEventListener('keydown', handleTwitchCommand, { capture: false });
            
            // Strategy 3: Keypress event (older browsers/different timing)
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && chatInput.value.trim() === '/twitch') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            }, { capture: true });

            // Strategy 4: Monitor input changes and intercept before submission
            let lastValue = '';
            chatInput.addEventListener('input', () => {
                lastValue = chatInput.value;
            });

            // Strategy 5: Override the form submission if chat is in a form
            const chatForm = chatInput.closest('form');
            if (chatForm) {
                chatForm.addEventListener('submit', (e) => {
                    if (chatInput.value.trim() === '/twitch') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        chatInput.value = '';
                        this.toggleTwitchFilter();
                        chatInput.blur();
                        return false;
                    }
                }, { capture: true });
            }

            logger.log('/twitch command filter ready with multiple interception strategies');
        };

        waitForChatInput();
    }

    toggleTwitchFilter() {
        const chatList = document.getElementById('chatList');
        if (!chatList) {
            logger.error('chatList not found - cannot toggle filter');
            console.error('[Water] [Twitch] chatList element not found');
            return;
        }

        const allMessages = chatList.querySelectorAll('[id^="chatMsg_"]');
        const isTwitchFilterActive = chatList.getAttribute('data-twitch-filter') === 'true';

        logger.log(`Toggling Twitch filter. Current state: ${isTwitchFilterActive ? 'ON' : 'OFF'}`);
        console.log(`[Water] [Twitch] Filter toggled. New state: ${!isTwitchFilterActive ? 'ON' : 'OFF'}`);

        if (isTwitchFilterActive) {
            // Show all messages
            allMessages.forEach(msg => {
                (msg as HTMLElement).style.display = '';
            });
            chatList.setAttribute('data-twitch-filter', 'false');
            this.showFilterNotification('✓ Showing all chat', '#00FF00');
            
            // Stop observing
            if (this.chatObserver) {
                this.chatObserver.disconnect();
                this.chatObserver = null;
            }
        } else {
            // Show only Twitch messages
            const twitchCount = Array.from(allMessages).filter(msg => 
                msg.getAttribute('data-twitch') === 'true'
            ).length;
            
            allMessages.forEach(msg => {
                const isTwitch = msg.getAttribute('data-twitch') === 'true';
                (msg as HTMLElement).style.display = isTwitch ? '' : 'none';
            });
            chatList.setAttribute('data-twitch-filter', 'true');
            this.showFilterNotification(`✓ Twitch filter ON (${twitchCount} messages) - type /twitch to toggle`, '#9147FF');
            
            // Start observing for new messages
            this.startChatObserver();
        }
    }

    startChatObserver() {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;

        // Disconnect existing observer if any
        if (this.chatObserver) {
            this.chatObserver.disconnect();
        }

        // Create new observer to hide non-Twitch messages
        this.chatObserver = new MutationObserver((mutations) => {
            const isTwitchFilterActive = chatList.getAttribute('data-twitch-filter') === 'true';
            if (!isTwitchFilterActive) return;

            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement && node.id && node.id.startsWith('chatMsg_')) {
                        const isTwitch = node.getAttribute('data-twitch') === 'true';
                        if (!isTwitch) {
                            node.style.display = 'none';
                        }
                    }
                });
            });
        });

        // Start observing
        this.chatObserver.observe(chatList, {
            childList: true,
            subtree: false
        });
    }

    showFilterNotification(message: string, color: string) {
        logger.log(`Filter notification: ${message}`);
        console.log(`[Water] [Twitch] ${message}`);
        
        const chatList = document.getElementById('chatList');
        if (!chatList) {
            logger.warn('chatList not found for notification');
            return;
        }

        // Get next message ID
        const existingMsgs = chatList.querySelectorAll('[id^="chatMsg_"]');
        let maxId = -1;
        existingMsgs.forEach(msg => {
            const id = parseInt(msg.id.replace('chatMsg_', ''));
            if (!isNaN(id) && id > maxId) maxId = id;
        });
        const newId = maxId + 1;

        // Create message container with more prominent styling
        const chatMsgContainer = document.createElement('div');
        chatMsgContainer.setAttribute('data-tab', '0');
        chatMsgContainer.setAttribute('data-twitch', 'true'); // Mark as Twitch so it's not hidden by Twitch filter
        chatMsgContainer.classList.add('vanillaChatMsg'); // Add vanilla class for compatibility
        chatMsgContainer.classList.add('msg--server'); // Categorize as server message so it respects chat filters
        chatMsgContainer.id = `chatMsg_${newId}`;
        chatMsgContainer.style.backgroundColor = 'rgba(145, 71, 255, 0.2)';
        chatMsgContainer.style.borderLeft = `4px solid ${color}`;
        chatMsgContainer.style.borderRight = `4px solid ${color}`;
        chatMsgContainer.style.padding = '8px';
        chatMsgContainer.style.marginBottom = '4px';
        chatMsgContainer.style.borderRadius = '4px';
        chatMsgContainer.style.boxShadow = '0 2px 8px rgba(145, 71, 255, 0.3)';

        // Create chat item
        const chatItem = document.createElement('div');
        chatItem.className = 'chatItem';

        // Create message span
        const messageSpan = document.createElement('span');
        messageSpan.className = 'chatMsg';
        messageSpan.style.color = color;
        messageSpan.style.fontWeight = 'bold';
        messageSpan.style.fontSize = '14px';
        messageSpan.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
        messageSpan.textContent = `[Twitch Filter] ${message}`;

        chatItem.appendChild(messageSpan);
        chatMsgContainer.appendChild(chatItem);

        chatList.appendChild(chatMsgContainer);
        chatList.scrollTop = chatList.scrollHeight;

        // Remove after 7 seconds (increased from 5)
        setTimeout(() => {
            if (chatMsgContainer.parentNode) {
                chatMsgContainer.style.transition = 'opacity 0.5s';
                chatMsgContainer.style.opacity = '0';
                setTimeout(() => {
                    if (chatMsgContainer.parentNode) {
                        chatMsgContainer.remove();
                    }
                }, 500);
            }
        }, 7000);
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
                    this.showNotification(`🚀 ${raider} is raiding with ${viewers} viewers!`, '#FF4500');
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
        usernameSpan.textContent = `\u200E${displayName}\u200E`;

        const messageSpan = document.createElement('span');
        messageSpan.className = 'chatMsg';
        
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
                const textNode = document.createTextNode(message.substring(lastIndex, emote.start));
                container.appendChild(textNode);
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
            const textNode = document.createTextNode(message.substring(lastIndex));
            container.appendChild(textNode);
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
        
        // Disconnect observer
        if (this.chatObserver) {
            this.chatObserver.disconnect();
            this.chatObserver = null;
        }
        
        logger.log('Cleanup completed');
    }
}
