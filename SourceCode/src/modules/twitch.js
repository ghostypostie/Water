"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const context_1 = require("../context");
const module_1 = __importDefault(require("../module"));
const textinput_1 = __importDefault(require("../options/textinput"));
const button_1 = __importDefault(require("../options/button"));
const twitch_1 = __importDefault(require("../ui/twitch"));
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('Twitch');
class TwitchChat extends module_1.default {
    name = 'Twitch Chat';
    id = 'twitch';
    contexts = [
        {
            context: context_1.Context.Game,
            runAt: context_1.RunAt.LoadEnd,
        }
    ];
    twitchUI = new twitch_1.default(this);
    options = [
        new textinput_1.default(this, {
            name: 'Channel Name',
            id: 'channel',
            description: 'Enter a Twitch channel name to display its chat in Krunker',
            label: 'Channel Name',
        }),
        new button_1.default(this, {
            name: 'Twitch Settings',
            description: 'Configure Twitch chat display and notifications',
            id: '',
            label: 'Edit',
            onChange: this.twitchUI.open.bind(this.twitchUI),
        }),
    ];
    ws = null;
    channel = null;
    connected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 3000;
    recentMessages = [];
    messageHistoryLimit = 50;
    badgeCache = new Map();
    channelId = null;
    chatObserver = null;
    renderer() {
        const channelName = this.config.get('channel', '');
        if (channelName && channelName.trim() !== '') {
            this.connect(channelName);
        }
        this.config.onChange('channel', (newChannel) => {
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
        // Intercept chat input to handle /twitch command
        const chatInput = document.getElementById('chatInput');
        if (!chatInput)
            return;
        const originalKeyDown = chatInput.onkeydown;
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && chatInput.value.trim() === '/twitch') {
                e.preventDefault();
                e.stopPropagation();
                this.toggleTwitchFilter();
                chatInput.value = '';
                return false;
            }
        }, true);
    }
    toggleTwitchFilter() {
        const chatList = document.getElementById('chatList');
        if (!chatList)
            return;
        const allMessages = chatList.querySelectorAll('[id^="chatMsg_"]');
        const isTwitchFilterActive = chatList.getAttribute('data-twitch-filter') === 'true';
        if (isTwitchFilterActive) {
            // Show all messages
            allMessages.forEach(msg => {
                msg.style.display = '';
            });
            chatList.setAttribute('data-twitch-filter', 'false');
            this.showFilterNotification('Showing all chat', '#00FF00');
            // Stop observing
            if (this.chatObserver) {
                this.chatObserver.disconnect();
                this.chatObserver = null;
            }
        }
        else {
            // Show only Twitch messages
            allMessages.forEach(msg => {
                const isTwitch = msg.getAttribute('data-twitch') === 'true';
                msg.style.display = isTwitch ? '' : 'none';
            });
            chatList.setAttribute('data-twitch-filter', 'true');
            this.showFilterNotification('Showing Twitch chat only (type /twitch to toggle)', '#9147FF');
            // Start observing for new messages
            this.startChatObserver();
        }
    }
    startChatObserver() {
        const chatList = document.getElementById('chatList');
        if (!chatList)
            return;
        // Disconnect existing observer if any
        if (this.chatObserver) {
            this.chatObserver.disconnect();
        }
        // Create new observer to hide non-Twitch messages
        this.chatObserver = new MutationObserver((mutations) => {
            const isTwitchFilterActive = chatList.getAttribute('data-twitch-filter') === 'true';
            if (!isTwitchFilterActive)
                return;
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
    showFilterNotification(message, color) {
        const chatList = document.getElementById('chatList');
        if (!chatList)
            return;
        // Get next message ID
        const existingMsgs = chatList.querySelectorAll('[id^="chatMsg_"]');
        let maxId = -1;
        existingMsgs.forEach(msg => {
            const id = parseInt(msg.id.replace('chatMsg_', ''));
            if (id > maxId)
                maxId = id;
        });
        const newId = maxId + 1;
        // Create message container
        const chatMsgContainer = document.createElement('div');
        chatMsgContainer.setAttribute('data-tab', '0');
        chatMsgContainer.id = `chatMsg_${newId}`;
        // Create chat item
        const chatItem = document.createElement('div');
        chatItem.className = 'chatItem';
        // Create message span
        const messageSpan = document.createElement('span');
        messageSpan.className = 'chatMsg';
        messageSpan.style.color = color;
        messageSpan.style.fontWeight = 'bold';
        messageSpan.textContent = message;
        chatItem.appendChild(messageSpan);
        chatMsgContainer.appendChild(chatItem);
        chatList.appendChild(chatMsgContainer);
        chatList.scrollTop = chatList.scrollHeight;
        setTimeout(() => {
            chatMsgContainer.remove();
        }, 3000);
    }
    connect(channelName) {
        if (!channelName || channelName.trim() === '') {
            logger.log('No channel specified');
            return;
        }
        this.channel = channelName.toLowerCase().trim();
        logger.log(`Connecting to channel: ${this.channel}`);
        this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
        this.ws.onopen = () => {
            logger.log('WebSocket connected');
            this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            this.ws.send('PASS SCHMOOPIIE');
            this.ws.send('NICK justinfan67420');
            this.ws.send(`JOIN #${this.channel}`);
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
    handleMessage(data) {
        const lines = data.split('\r\n');
        lines.forEach(line => {
            if (line.startsWith('PING')) {
                this.ws.send('PONG :tmi.twitch.tv');
            }
            else if (line.includes('Welcome, GLHF!')) {
                logger.log(`Successfully joined #${this.channel}`);
                this.connected = true;
                this.reconnectAttempts = 0;
            }
            else if (line.includes('PRIVMSG')) {
                this.parseChatMessage(line);
            }
            else if (line.includes('USERNOTICE')) {
                this.parseUserNotice(line);
            }
        });
    }
    parseChatMessage(line) {
        try {
            let tags = {};
            const tagsMatch = line.match(/^@([^ ]+)/);
            if (tagsMatch) {
                const tagPairs = tagsMatch[1].split(';');
                tagPairs.forEach(pair => {
                    const [key, value] = pair.split('=');
                    tags[key] = value;
                });
            }
            const userMatch = line.match(/:(.+?)!/);
            if (!userMatch)
                return;
            const username = userMatch[1];
            const msgMatch = line.match(/PRIVMSG #.+ :(.+)/);
            if (!msgMatch)
                return;
            const message = msgMatch[1];
            this.injectToKrunkerChat(username, message, tags);
        }
        catch (error) {
            logger.error('Error parsing message:', error);
        }
    }
    parseUserNotice(line) {
        try {
            let tags = {};
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
            }
            else if (msgId === 'raid') {
                if (this.config.get('twitch.notifyRaids', true)) {
                    const raider = tags['msg-param-displayName'] || tags['login'] || 'Someone';
                    const viewers = tags['msg-param-viewerCount'] || '0';
                    this.showNotification(`🚀 ${raider} is raiding with ${viewers} viewers!`, '#FF4500');
                }
            }
            else if (msgId === 'ritual') {
                const username = tags['login'] || tags['display-name'] || 'Someone';
                this.showNotification(`👋 ${username} is new to chat!`, '#00FF00');
            }
            else if (msgId === 'rewardgift' || msgId.includes('redeem')) {
                if (this.config.get('twitch.notifyRedeems', true)) {
                    const username = tags['login'] || tags['display-name'] || 'Someone';
                    const reward = tags['msg-param-reward-name'] || 'a reward';
                    this.showNotification(`⭐ ${username} redeemed: ${reward}`, '#FFD700');
                }
            }
        }
        catch (error) {
            logger.error('Error parsing user notice:', error);
        }
    }
    showNotification(message, color) {
        const chatList = document.getElementById('chatList');
        if (!chatList)
            return;
        const existingMsgs = chatList.querySelectorAll('[id^="chatMsg_"]');
        let maxId = -1;
        existingMsgs.forEach(msg => {
            const id = parseInt(msg.id.replace('chatMsg_', ''));
            if (id > maxId)
                maxId = id;
        });
        const newId = maxId + 1;
        const chatMsgContainer = document.createElement('div');
        chatMsgContainer.setAttribute('data-tab', '0');
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
    injectToKrunkerChat(username, message, tags) {
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
            if (id > maxId)
                maxId = id;
        });
        const newId = maxId + 1;
        const chatMsgContainer = document.createElement('div');
        chatMsgContainer.setAttribute('data-tab', '0');
        chatMsgContainer.setAttribute('data-twitch', 'true'); // Mark as Twitch message
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
        }
        else {
            usernameSpan.style.color = '#B500B5';
        }
        usernameSpan.style.fontWeight = '600';
        usernameSpan.textContent = `\u200E${displayName}\u200E`;
        const messageSpan = document.createElement('span');
        messageSpan.className = 'chatMsg';
        if (this.config.get('twitch.showEmotes', true) && tags.emotes && tags.emotes !== '') {
            this.parseEmotes(messageSpan, message, tags.emotes);
        }
        else {
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
    addBadges(container, badgesData) {
        const badges = badgesData.split(',');
        badges.forEach(badge => {
            const [badgeType, version] = badge.split('/');
            if (!badgeType || !version)
                return;
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
                img.src = this.badgeCache.get(cacheKey);
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
                }
                else {
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
    parseEmotes(container, message, emotesData) {
        const emoteMap = [];
        const emoteParts = emotesData.split('/');
        emoteParts.forEach(part => {
            const [emoteId, positions] = part.split(':');
            if (!positions)
                return;
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
exports.default = TwitchChat;
