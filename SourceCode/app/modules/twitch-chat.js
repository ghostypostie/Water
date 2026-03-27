// Water Twitch Chat Integration
// Connects to Twitch IRC and displays messages in Krunker chat with purple usernames

class TwitchChatIntegration {
    constructor() {
        this.ws = null;
        this.channel = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.recentMessages = []; // Track recent messages to prevent duplicates
        this.messageHistoryLimit = 50; // Keep last 50 messages for comparison
    }

    // Initialize and connect to Twitch chat
    connect(channelName) {
        if (!channelName || channelName.trim() === '') {
            console.log('[Water] [Twitch] No channel specified');
            return;
        }

        this.channel = channelName.toLowerCase().trim();
        console.log(`[Water] [Twitch] Connecting to channel: ${this.channel}`);

        // Connect to Twitch IRC via WebSocket
        this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

        this.ws.onopen = () => {
            console.log('[Water] [Twitch] WebSocket connected');
            // Send CAP REQ for Twitch IRC capabilities
            this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            // Anonymous login
            this.ws.send('PASS SCHMOOPIIE');
            this.ws.send('NICK justinfan67420');
            // Join the channel
            this.ws.send(`JOIN #${this.channel}`);
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
            console.error('[Water] [Twitch] WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('[Water] [Twitch] WebSocket disconnected');
            this.connected = false;
            this.attemptReconnect();
        };
    }

    // Handle incoming IRC messages
    handleMessage(data) {
        const lines = data.split('\r\n');

        lines.forEach(line => {
            if (line.startsWith('PING')) {
                // Respond to PING to keep connection alive
                this.ws.send('PONG :tmi.twitch.tv');
            } else if (line.includes('Welcome, GLHF!')) {
                console.log(`[Water] [Twitch] Successfully joined #${this.channel}`);
                this.connected = true;
                this.reconnectAttempts = 0;
            } else if (line.includes('PRIVMSG')) {
                // Parse chat message
                this.parseChatMessage(line);
            }
        });
    }

    // Parse PRIVMSG and inject into Krunker chat
    parseChatMessage(line) {
        try {
            // Extract username
            const userMatch = line.match(/:(.+?)!/);
            if (!userMatch) return;
            const username = userMatch[1];

            // Extract message
            const msgMatch = line.match(/PRIVMSG #.+ :(.+)/);
            if (!msgMatch) return;
            const message = msgMatch[1];

            // Inject into Krunker chat
            this.injectToKrunkerChat(username, message);
        } catch (error) {
            console.error('[Water] [Twitch] Error parsing message:', error);
        }
    }

    // Inject Twitch message into Krunker's chat display
    injectToKrunkerChat(username, message) {
        const chatList = document.getElementById('chatList');
        if (!chatList) {
            console.warn('[Water] [Twitch] chatList element not found');
            return;
        }

        // Create unique message identifier
        const messageId = `${username}:${message}`;

        // Check if this message was recently sent (prevent duplicates)
        if (this.recentMessages.includes(messageId)) {
            console.log(`[Water] [Twitch] Duplicate message filtered: ${username}: ${message}`);
            return;
        }

        // Add to recent messages
        this.recentMessages.push(messageId);

        // Keep only last N messages in history
        if (this.recentMessages.length > this.messageHistoryLimit) {
            this.recentMessages.shift();
        }

        // Find the highest message ID
        const existingMsgs = chatList.querySelectorAll('[id^="chatMsg_"]');
        let maxId = -1;
        existingMsgs.forEach(msg => {
            const id = parseInt(msg.id.replace('chatMsg_', ''));
            if (id > maxId) maxId = id;
        });
        const newId = maxId + 1;

        // Create chat message element with purple username
        const chatMsgContainer = document.createElement('div');
        chatMsgContainer.setAttribute('data-tab', '0');
        chatMsgContainer.id = `chatMsg_${newId}`;

        const chatItem = document.createElement('div');
        chatItem.className = 'chatItem';
        chatItem.style.backgroundColor = 'rgba(0, 0, 0, 0)';

        // Create username span with purple color
        const usernameSpan = document.createElement('span');
        usernameSpan.style.color = '#B500B5';
        usernameSpan.textContent = `\u200E${username}\u200E`;

        // Create message span
        const messageSpan = document.createElement('span');
        messageSpan.className = 'chatMsg';
        messageSpan.textContent = `\u200E${message}\u200E`;

        // Assemble the chat item
        chatItem.appendChild(usernameSpan);
        chatItem.appendChild(document.createTextNode(': '));
        chatItem.appendChild(messageSpan);

        chatMsgContainer.appendChild(chatItem);
        chatMsgContainer.appendChild(document.createElement('br'));

        // Append to chatList
        chatList.appendChild(chatMsgContainer);

        // Auto-scroll to bottom if user is near bottom
        if (chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 100) {
            chatList.scrollTop = chatList.scrollHeight;
        }

        console.log(`[Water] [Twitch] ${username}: ${message}`);
    }

    // Attempt to reconnect after disconnect
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[Water] [Twitch] Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`[Water] [Twitch] Reconnecting in ${this.reconnectDelay / 1000}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            if (this.channel) {
                this.connect(this.channel);
            }
        }, this.reconnectDelay);
    }

    // Disconnect from Twitch chat
    disconnect() {
        if (this.ws) {
            console.log('[Water] [Twitch] Disconnecting...');
            this.ws.close();
            this.ws = null;
            this.connected = false;
            this.channel = null;
            this.recentMessages = []; // Clear message history
        }
    }

    // Cleanup method to be called on window unload
    cleanup() {
        this.disconnect();
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
        console.log('[Water] [Twitch] Cleanup completed');
    }
}

// Initialize Twitch integration
const twitchChat = new TwitchChatIntegration();

// Check if Twitch integration is enabled and connect
const twitchChannel = localStorage.getItem('water_twitch_channel');
if (twitchChannel && twitchChannel.trim() !== '') {
    console.log('[Water] [Twitch] Auto-connecting to saved channel');
    twitchChat.connect(twitchChannel);
}

// Export for use in other modules
window.waterTwitchChat = twitchChat;

// Auto-cleanup on window unload
window.addEventListener('beforeunload', () => {
    if (window.waterTwitchChat) {
        window.waterTwitchChat.cleanup();
    }
});
window.addEventListener('unload', () => {
    if (window.waterTwitchChat) {
        window.waterTwitchChat.cleanup();
    }
});
