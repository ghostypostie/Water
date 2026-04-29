import { Context, RunAt } from '../context';
import Module from '../module';
import TextInput from '../options/textinput';
import Button from '../options/button';
import Dropdown from '../options/dropdown';
import Slider from '../options/slider';
import Checkbox from '../options/checkbox';
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
        new Dropdown(this, {
            name: 'Connection Mode',
            id: 'connectionMode',
            description: 'Anonymous (read-only) or OAuth (can send messages)',
            defaultValue: 'anonymous',
            options: [
                { name: 'Anonymous (Read Only)', value: 'anonymous' },
                { name: 'OAuth Connection (Read/Write)', value: 'bot' },
            ],
        }),
        new Slider(this, {
            name: 'Panel Height',
            id: 'panelHeight',
            description: 'Height of the Twitch chat panel in pixels',
            defaultValue: 250,
            min: 100,
            max: 500,
            step: 10,
        }),
        new Slider(this, {
            name: 'Panel Opacity',
            id: 'panelOpacity',
            description: 'Background opacity of the Twitch chat panel (%)',
            defaultValue: 40,
            min: 0,
            max: 100,
            step: 5,
        }),
        new Slider(this, {
            name: 'Font Size',
            id: 'fontSize',
            description: 'Text size for Twitch chat messages',
            defaultValue: 14,
            min: 10,
            max: 20,
            step: 1,
        }),
        new Slider(this, {
            name: 'Message Timeout',
            id: 'messageTimeout',
            description: 'Time before messages disappear (minutes). 0 = never',
            defaultValue: 0,
            min: 0,
            max: 3,
            step: 0.5,
        }),
        new Button(this, {
            name: 'Twitch Settings',
            description: 'Configure bot credentials, commands, display and notifications',
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
    
    // Twitch GQL constants for badge fetching (from ghost-chat)
    private readonly TWITCH_GQL_URL = 'https://gql.twitch.tv/gql';
    private readonly TWITCH_GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
    private globalBadgesFetched = false;
    activeFilters: Set<string> = new Set();
    messageCleanupTimer: ReturnType<typeof setInterval> | null = null;
    
    // Bot mode properties
    botUsername: string = '';
    oauthToken: string = '';
    messageQueue: string[] = [];
    lastMessageTime: number = 0;
    rateLimitMs: number = 1500; // 40 messages per minute = 20/30s
    messageQueueTimer: ReturnType<typeof setTimeout> | null = null;
    
    // Panel element references
    twitchChatHolder: HTMLElement | null = null;
    twitchChatList: HTMLElement | null = null;
    
    // Track intentional disconnects to prevent auto-reconnect
    intentionalDisconnect: boolean = false;
    
    // Track if joined message was already shown for this session
    joinedMessageShown: boolean = false;
    
    // Chat input elements
    twitchInputContainer: HTMLElement | null = null;
    twitchInputBox: HTMLInputElement | null = null;
    twitchSendButton: HTMLElement | null = null;

    renderer() {
        // Set up /twitch command filter FIRST
        window.addEventListener('twitch-filter-toggle', () => {
            this.toggleTwitchFilter();
        });

        // Intercept Krunker chat for /twitch command
        this.setupTwitchCommand();

        // Set default config values
        this.setDefaultConfig();

        // Create Twitch panel with retry for DOM readiness
        this.ensurePanelExists();
        
        // Update panel when settings change
        this.config.onChange('panelHeight', () => this.updatePanelStyles());
        this.config.onChange('panelOpacity', () => this.updatePanelStyles());
        this.config.onChange('fontSize', () => this.updatePanelStyles());
        
        // Start message cleanup interval for disappearing messages
        this.startMessageCleanup();

        // Handle channel changes - instant panel visibility toggle
        this.config.onChange('channel', (newChannel: string) => {
            this.disconnect();
            
            // Always ensure panel exists first
            this.ensurePanelExists();
            
            if (newChannel && newChannel.trim() !== '') {
                this.connect(newChannel);
                // Show panel instantly when channel is set
                if (this.twitchChatHolder) {
                    this.twitchChatHolder.classList.add('visible');
                    logger.log('Panel shown - channel set to: ' + newChannel);
                }
            } else {
                // Hide panel instantly when channel is cleared
                if (this.twitchChatHolder) {
                    this.twitchChatHolder.classList.remove('visible');
                    logger.log('Panel hidden - channel cleared');
                }
            }
        });
        
        // Check initial channel state and show panel if needed
        const initialChannel = this.config.get('channel', '');
        if (initialChannel && initialChannel.trim() !== '') {
            this.connect(initialChannel);
            if (this.twitchChatHolder) {
                this.twitchChatHolder.classList.add('visible');
                logger.log('Initial panel shown for channel: ' + initialChannel);
            }
        }
        
        this.config.onChange('connectionMode', () => {
            // Reconnect when mode changes
            this.disconnect();
            const channel = this.config.get('channel', '');
            if (channel && channel.trim() !== '') {
                this.connect(channel);
            }
        });

        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    setDefaultConfig() {
        // Set default values for new settings if not already set
        const defaults: Record<string, any> = {
            'connectionMode': 'anonymous',
            'panelHeight': 250,
            'panelOpacity': 40,
            'fontSize': 14,
            'messageTimeout': 0,
            'twitch.showBadges': true,
            'twitch.useUserColors': true,
            'twitch.showEmotes': true,
            'twitch.useGenericNames': false,
            'twitch.notifyRaids': true,
            'twitch.notifyHosts': true,
            'twitch.notifySubs': true,
            'twitch.notifyRedeems': true,
            'twitch.cmd.link': true,
            'twitch.cmd.profile': true,
            'twitch.cmd.nukes': true,
            'twitch.cmd.mods': true,
        };

        for (const [key, value] of Object.entries(defaults)) {
            if (this.config.get(key, null) === null) {
                this.config.set(key, value);
            }
        }
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
            font-family: gamefont, sans-serif;
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

    ensurePanelExists() {
        // Create panel if it doesn't exist yet
        if (!this.twitchChatHolder || !document.getElementById('twitchChatHolder')) {
            this.createTwitchPanel();
        }
    }

    createTwitchPanel() {
        // Check if panel already exists
        if (document.getElementById('twitchChatHolder')) {
            this.twitchChatHolder = document.getElementById('twitchChatHolder');
            this.twitchChatList = document.getElementById('twitchChatList');
            this.twitchInputContainer = document.getElementById('twitchInputContainer');
            this.twitchInputBox = document.getElementById('twitchInputBox') as HTMLInputElement;
            this.twitchSendButton = document.getElementById('twitchSendButton');
            return;
        }

        // Initial styles will be set by refreshPanelStyles() after DOM is ready

        // Create panel container
        this.twitchChatHolder = document.createElement('div');
        this.twitchChatHolder.id = 'twitchChatHolder';

        // Create chat list
        this.twitchChatList = document.createElement('div');
        this.twitchChatList.id = 'twitchChatList';

        this.twitchChatHolder.appendChild(this.twitchChatList);
        
        // Create input container
        this.createInputBox();

        // Insert before the Krunker chat holder
        const chatHolder = document.getElementById('chatHolder');
        const uiBase = document.getElementById('uiBase');
        
        if (chatHolder && chatHolder.parentNode) {
            chatHolder.parentNode.insertBefore(this.twitchChatHolder, chatHolder);
        } else if (uiBase) {
            // Fallback: append to uiBase if chatHolder not ready
            uiBase.appendChild(this.twitchChatHolder);
        } else {
            // Last resort: append to body
            document.body.appendChild(this.twitchChatHolder);
        }

        this.updatePanelStyles();
        
        // Show panel if channel is set
        const channel = this.config.get('channel', '');
        if (channel && channel.trim() !== '' && this.twitchChatHolder) {
            this.twitchChatHolder.classList.add('visible');
            logger.log('Panel created and shown for channel: ' + channel);
        }
        
        // Start tracking Krunker chat position
        this.startPositionTracking();
        
        // Update input box visibility
        this.updateInputBoxVisibility();
    }

    createInputBox() {
        // Create input container
        this.twitchInputContainer = document.createElement('div');
        this.twitchInputContainer.id = 'twitchInputContainer';
        
        // Create input box
        this.twitchInputBox = document.createElement('input');
        this.twitchInputBox.id = 'twitchInputBox';
        this.twitchInputBox.type = 'text';
        this.twitchInputBox.placeholder = 'Send to Twitch...';
        this.twitchInputBox.maxLength = 500; // Twitch message limit
        
        // Create send button
        this.twitchSendButton = document.createElement('button');
        this.twitchSendButton.id = 'twitchSendButton';
        this.twitchSendButton.textContent = 'Send';
        
        // Assemble (no status indicator)
        this.twitchInputContainer.appendChild(this.twitchInputBox);
        this.twitchInputContainer.appendChild(this.twitchSendButton);
        
        // Add to holder
        if (this.twitchChatHolder) {
            this.twitchChatHolder.appendChild(this.twitchInputContainer);
        }
        
        // Event handlers
        this.twitchInputBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendTwitchMessage();
            }
        });
        
        this.twitchSendButton.addEventListener('click', () => {
            this.sendTwitchMessage();
        });
    }

    sendTwitchMessage() {
        if (!this.twitchInputBox || !this.twitchSendButton) return;
        
        const message = this.twitchInputBox.value.trim();
        if (!message) return;
        
        const connectionMode = this.config.get('connectionMode', 'anonymous');
        if (connectionMode !== 'bot') {
            this.showSendButtonState('error', 'Bot mode not enabled');
            return;
        }
        
        if (!this.connected) {
            this.showSendButtonState('error', 'Not connected');
            return;
        }
        
        // Show sending state
        this.showSendButtonState('sending', 'Sending...');
        
        // Send message
        this.sendMessage(message);
        
        // Clear input
        this.twitchInputBox.value = '';
        
        // Show success
        setTimeout(() => {
            this.showSendButtonState('success', 'Sent!');
            
            // Reset after delay
            setTimeout(() => {
                this.showSendButtonState('default', 'Send');
            }, 1500);
        }, 100);
    }

    showSendButtonState(state: 'default' | 'sending' | 'success' | 'error', text: string) {
        if (!this.twitchSendButton) return;
        
        this.twitchSendButton.textContent = text;
        this.twitchSendButton.className = `send-btn-${state}`;
        
        if (state === 'error') {
            setTimeout(() => {
                this.showSendButtonState('default', 'Send');
            }, 2000);
        }
    }

    updateInputBoxVisibility() {
        if (!this.twitchInputContainer) return;
        
        const connectionMode = this.config.get('connectionMode', 'anonymous');
        const shouldShow = connectionMode === 'bot' && this.connected;
        
        if (shouldShow) {
            this.twitchInputContainer.classList.add('visible');
            this.updateInputPlaceholder();
        } else {
            this.twitchInputContainer.classList.remove('visible');
        }
    }

    updateInputPlaceholder() {
        if (!this.twitchInputBox) return;
        
        if (this.channel) {
            this.twitchInputBox.placeholder = `Send to #${this.channel}`;
        } else {
            this.twitchInputBox.placeholder = 'Send to Twitch...';
        }
    }

    setupTwitchCommand() {
        // Intercept chat input to handle /msg command
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        if (!chatInput) {
            setTimeout(() => this.setupTwitchCommand(), 1000);
            return;
        }

        // Store original send function
        const originalSend = (window as any).sendChat;
        
        (window as any).sendChat = (message: string) => {
            // Check if message starts with /msg
            if (message && message.trim().startsWith('/msg ')) {
                const twitchMessage = message.trim().substring(5); // Remove "/msg "
                
                if (!twitchMessage) {
                    // Show error in Krunker chat
                    this.showKrunkerChatMessage('[Twitch] Please provide a message', '#ff0000');
                    return;
                }
                
                const connectionMode = this.config.get('connectionMode', 'anonymous');
                if (connectionMode !== 'bot') {
                    this.showKrunkerChatMessage('[Twitch] Bot mode not enabled. Enable in Settings → Twitch Chat', '#ff0000');
                    return;
                }
                
                if (!this.connected) {
                    this.showKrunkerChatMessage('[Twitch] Not connected to Twitch', '#ff0000');
                    return;
                }
                
                // Send to Twitch
                this.sendMessage(twitchMessage);
                this.showKrunkerChatMessage(`[Twitch] Sent to #${this.channel}`, '#9146ff');
                
                // Clear the input
                chatInput.value = '';
                return;
            }
            
            // Call original send function for normal messages
            if (originalSend) {
                originalSend(message);
            }
        };
    }

    showKrunkerChatMessage(message: string, color: string) {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;
        
        const chatItem = document.createElement('div');
        chatItem.style.color = color;
        chatItem.style.fontWeight = 'bold';
        chatItem.textContent = message;
        
        chatList.appendChild(chatItem);
        chatList.scrollTop = chatList.scrollHeight;
    }

    startPositionTracking() {
        const chatInput = document.getElementById('chatInput');
        const chatList = document.getElementById('chatList');
        if (!chatInput || !chatList) return;

        // Update on window resize
        window.addEventListener('resize', () => this.updatePanelPosition());

        // Watch for Krunker's chat height changes (max-height style changes)
        let lastChatHeight = this.getKrunkerChatHeight();
        const heightObserver = new MutationObserver(() => {
            const currentHeight = this.getKrunkerChatHeight();
            if (currentHeight !== lastChatHeight) {
                lastChatHeight = currentHeight;
                this.refreshPanelStyles();
            }
        });

        heightObserver.observe(chatList, {
            attributes: true,
            attributeFilter: ['style']
        });

        // Set initial position
        this.updatePanelPosition();
    }

    updatePanelStyles() {
        if (!this.twitchChatList) return;

        const height = this.config.get('panelHeight', 250);
        const opacity = this.config.get('panelOpacity', 40);
        const fontSize = this.config.get('fontSize', 14);

        this.twitchChatList.style.maxHeight = `${height}px`;
        this.twitchChatList.style.backgroundColor = `rgba(0,0,0,${opacity / 100})`;
        this.twitchChatList.style.fontSize = `${fontSize}px`;

        // Update CSS positioning with new panel height
        this.refreshPanelStyles();
    }

    updatePanelPosition() {
        // CSS now handles all positioning based on UI state classes
        // This function is kept for backward compatibility and resize events
        // Position is calculated based on panelHeight setting + gap above chatHolder
        this.refreshPanelStyles();
    }

    refreshPanelStyles() {
        // Recreate styles when panel height changes
        const style = document.getElementById('twitch-panel-style');
        if (style) {
            style.remove();
        }

        const gap = 65; // Small gap between Krunker chat and Twitch panel

        // Get Krunker's actual chat height from the chatList element
        const krunkerChatHeight = this.getKrunkerChatHeight();

        // Debug logging
        const uiBase = document.getElementById('uiBase');
        const isMenu = uiBase?.classList.contains('onMenu');
        const isGame = uiBase?.classList.contains('onGame');
        const menuBottom = 20 + krunkerChatHeight + gap;
        const gameBottom = 130 + krunkerChatHeight + gap;
        logger.log(`[Debug] krunkerChatHeight=${krunkerChatHeight}, isMenu=${isMenu}, isGame=${isGame}`);
        logger.log(`[Debug] Menu: left=150px, bottom=${menuBottom}px | Game: left=15px, bottom=${gameBottom}px`);

        const newStyle = document.createElement('style');
        newStyle.id = 'twitch-panel-style';
        newStyle.textContent = `
            #twitchChatHolder {
                position: fixed;
                z-index: 9999;
                max-width: min-content;
                display: none;
                pointer-events: none;
                left: 15px;
                /* Position directly above Krunker chat: base + krunker height + small gap */
                bottom: calc(130px + ${krunkerChatHeight}px + ${gap}px);
            }
            #twitchChatHolder.visible {
                display: block !important;
            }
            #uiBase.onMenu #twitchChatHolder {
                left: 150px;
                bottom: calc(20px + ${krunkerChatHeight}px + ${gap}px);
            }
            #uiBase.onGame #twitchChatHolder {
                left: 15px;
                bottom: calc(130px + ${krunkerChatHeight}px + ${gap}px);
            }
            #uiBase.onCompMenu #twitchChatHolder {
                left: 20px;
                bottom: calc(150px + ${krunkerChatHeight}px + ${gap}px);
            }
            #uiBase.onSpect #twitchChatHolder {
                left: 20px;
                bottom: calc(20px + ${krunkerChatHeight}px + ${gap}px);
            }
            #uiBase.onEndScrn #twitchChatHolder {
                left: 20px;
                bottom: calc(20px + ${krunkerChatHeight}px + ${gap}px);
            }
            #uiBase.onDeathScrn #twitchChatHolder {
                display: none !important;
            }
            #twitchChatList {
                overflow-y: auto;
                overflow-x: hidden;
                z-index: 999999;
                border-radius: 5px 5px 0 0;
                pointer-events: all;
                position: relative;
                text-align: left;
                width: 413px;
                -ms-overflow-style: none;
                scrollbar-width: none;
                display: flex;
                flex-direction: column-reverse;
                justify-content: flex-start;
                min-height: 100%;
                font-family: gamefont, sans-serif;
                padding-top: 10px;
            }
            #twitchChatList::-webkit-scrollbar {
                display: none;
            }
            .twitchChatItem {
                word-wrap: break-word;
                display: block;
                margin-bottom: 10px;
                margin-top: 10px;
                margin-left: 12px;
                color: #fff;
                max-width: 100%;
                direction: ltr;
                font-family: gamefont, sans-serif;
                flex-shrink: 0;
            }
            .twitchChatMsg {
                color: rgba(255,255,255,0.7);
                word-wrap: break-word;
                word-break: break-word;
                overflow-wrap: break-word;
                white-space: pre-wrap;
                max-width: 100%;
                font-family: gamefont, sans-serif;
            }
            #twitchInputContainer {
                display: none;
                width: 413px;
                background: rgba(0,0,0,0.6);
                border-radius: 0 0 5px 5px;
                padding: 8px 10px;
                gap: 8px;
                align-items: center;
                pointer-events: all;
                position: relative;
                box-sizing: border-box;
            }
            #twitchInputContainer.visible {
                display: flex !important;
            }
            #twitchInputBox {
                flex: 1;
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 4px;
                padding: 8px 10px;
                color: #fff;
                font-family: gamefont, sans-serif;
                font-size: 13px;
                outline: none;
                box-sizing: border-box;
            }
            #twitchInputBox:focus {
                background: rgba(255,255,255,0.15);
                border-color: rgba(145,70,255,0.6);
            }
            #twitchInputBox::placeholder {
                color: rgba(255,255,255,0.4);
            }
            #twitchSendButton {
                background: linear-gradient(135deg, #9146ff 0%, #6441a5 100%);
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                color: #fff;
                font-family: gamefont, sans-serif;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.3s;
                font-weight: bold;
                min-width: 80px;
                box-sizing: border-box;
            }
            #twitchSendButton:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(145,70,255,0.4);
            }
            #twitchSendButton:active {
                transform: translateY(0);
            }
            .send-btn-default {
                background: linear-gradient(135deg, #9146ff 0%, #6441a5 100%) !important;
            }
            .send-btn-sending {
                background: linear-gradient(135deg, #ffa500 0%, #ff8c00 100%) !important;
                animation: pulse 1s infinite;
            }
            .send-btn-success {
                background: linear-gradient(135deg, #00ff00 0%, #00aa00 100%) !important;
                box-shadow: 0 0 12px rgba(0,255,0,0.6) !important;
            }
            .send-btn-error {
                background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%) !important;
                box-shadow: 0 0 12px rgba(255,0,0,0.6) !important;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        `;
        document.head.appendChild(newStyle);
    }

    getKrunkerChatHeight(): number {
        const chatList = document.getElementById('chatList');
        if (!chatList) return 250; // Default fallback

        // Read the max-height from inline style (Krunker sets this via settings)
        const maxHeightStyle = chatList.style.maxHeight;
        if (maxHeightStyle) {
            const parsed = parseInt(maxHeightStyle);
            if (!isNaN(parsed)) return parsed;
        }

        // Fallback: try computed style
        const computedStyle = window.getComputedStyle(chatList);
        const computedMaxHeight = computedStyle.maxHeight;
        if (computedMaxHeight && computedMaxHeight !== 'none') {
            const parsed = parseInt(computedMaxHeight);
            if (!isNaN(parsed)) return parsed;
        }

        // Default fallback if nothing found
        return 250;
    }

    connect(channelName: string) {
        if (!channelName || channelName.trim() === '') {
            logger.log('No channel specified');
            return;
        }

        // If already connected to this channel, don't reconnect
        if (this.connected && this.channel === channelName.toLowerCase().trim()) {
            logger.log(`Already connected to ${channelName}`);
            return;
        }

        // Clean up any existing connection first
        if (this.ws) {
            logger.log('Closing existing connection before reconnecting...');
            this.intentionalDisconnect = true;
            this.ws.close();
            this.ws = null;
        }

        this.channel = channelName.toLowerCase().trim();
        this.reconnectAttempts = 0; // Reset reconnect counter for new channel
        this.joinedMessageShown = false; // Reset joined message flag for new channel
        const connectionMode = this.config.get('connectionMode', 'anonymous');
        
        logger.log(`Connecting to channel: ${this.channel} (mode: ${connectionMode})`);
        
        // Fetch badges (global + channel-specific) from Twitch GQL API
        this.fetchGlobalBadges().then(() => {
            if (this.channel) {
                this.fetchChannelBadges(this.channel);
            }
        });

        this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

        this.ws.onopen = () => {
            logger.log('WebSocket connected');
            this.ws!.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
            
            if (connectionMode === 'bot') {
                // Bot mode: use OAuth token
                let token = this.config.get('twitch.oauthToken', '');
                this.botUsername = this.config.get('twitch.botUsername', '');
                
                // Auto-add oauth: prefix if missing
                if (token && !token.startsWith('oauth:')) {
                    token = 'oauth:' + token;
                }
                this.oauthToken = token;
                
                if (!this.oauthToken || !this.botUsername) {
                    logger.error('Bot mode selected but missing OAuth token or username');
                    return;
                }
                
                this.ws!.send(`PASS ${this.oauthToken}`);
                this.ws!.send(`NICK ${this.botUsername.toLowerCase()}`);
            } else {
                // Anonymous mode
                this.ws!.send('PASS SCHMOOPIIE');
                this.ws!.send('NICK justinfan67420');
            }
            
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
            
            // Don't reconnect if this was an intentional disconnect (e.g., channel change)
            if (this.intentionalDisconnect) {
                logger.log('Intentional disconnect - not attempting reconnect');
                this.intentionalDisconnect = false;
                return;
            }
            
            this.attemptReconnect();
        };
    }

    isMod(tags: Record<string, string>): boolean {
        // Check mod flag
        if (tags.mod === '1') return true;
        
        // Check badges for moderator or broadcaster
        if (tags.badges) {
            const badges = tags.badges.split(',');
            for (const badge of badges) {
                const [type] = badge.split('/');
                if (type === 'moderator' || type === 'broadcaster') {
                    return true;
                }
            }
        }
        
        return false;
    }

    handleCommand(username: string, message: string, tags: Record<string, string>) {
        const command = message.toLowerCase().trim();
        const args = command.split(' ');
        const cmd = args[0];
        const channel = this.config.get('channel', '').toLowerCase();
        
        // Check if bot mode is enabled
        const connectionMode = this.config.get('connectionMode', 'anonymous');
        const canReply = connectionMode === 'bot' && this.connected && this.ws;
        
        let response = '';
        
        switch (cmd) {
            case '!link':
                if (!this.config.get('twitch.cmd.link', true)) return;
                const gameActivity = (typeof window.getGameActivity === 'function') 
                    ? window.getGameActivity() 
                    : null;
                if (gameActivity && gameActivity.id) {
                    response = `Join the game: https://krunker.io/?game=${gameActivity.id}`;
                } else {
                    response = 'Not currently in a game.';
                }
                break;
                
            case '!profile':
                if (!this.config.get('twitch.cmd.profile', true)) return;
                let profileUser = args[1];
                if (!profileUser) {
                    // Default to channel name (streamer)
                    profileUser = channel;
                }
                response = `Krunker profile: https://krunker.io/social.html?p=profile&q=${encodeURIComponent(profileUser)}`;
                break;
                
            case '!nukes':
                if (!this.config.get('twitch.cmd.nukes', true)) return;
                const activity = (typeof window.getGameActivity === 'function') 
                    ? window.getGameActivity() 
                    : null;
                if (activity && activity.nukes !== undefined) {
                    response = `Current nuke count: ${activity.nukes}`;
                } else {
                    response = 'Nuke information not available.';
                }
                break;
                
            case '!mods':
                if (!this.config.get('twitch.cmd.mods', true)) return;
                // Check if user is mod
                if (!this.isMod(tags)) {
                    response = 'This command is only available to moderators.';
                    break;
                }
                // Get active modules from manager
                const manager = (this as any).manager;
                if (manager && manager.loaded) {
                    const modules = manager.loaded.map((m: any) => m.name).join(', ');
                    response = `Active modules: ${modules}`;
                } else {
                    response = 'Module information not available.';
                }
                break;
                
            default:
                return; // Unknown command, do nothing
        }
        
        if (response && canReply) {
            this.sendMessage(response);
        } else if (response && !canReply) {
            logger.log(`Command ${cmd} triggered but bot mode not enabled. Response: ${response}`);
        }
    }

    sendMessage(message: string) {
        if (!this.ws || !this.connected || !this.channel) {
            logger.error('Cannot send message: not connected');
            return;
        }
        
        const connectionMode = this.config.get('connectionMode', 'anonymous');
        if (connectionMode !== 'bot') {
            logger.error('Cannot send message: not in bot mode');
            return;
        }
        
        // Add to queue
        this.messageQueue.push(message);
        this.processMessageQueue();
    }

    processMessageQueue() {
        if (this.messageQueueTimer) return; // Already processing
        
        const processNext = () => {
            if (this.messageQueue.length === 0) {
                this.messageQueueTimer = null;
                return;
            }
            
            const now = Date.now();
            const timeSinceLastMessage = now - this.lastMessageTime;
            
            if (timeSinceLastMessage >= this.rateLimitMs) {
                const message = this.messageQueue.shift();
                if (message && this.ws && this.connected) {
                    this.ws.send(`PRIVMSG #${this.channel} :${message}`);
                    this.lastMessageTime = now;
                    logger.log(`Sent message: ${message}`);
                }
                
                // Schedule next if more messages
                if (this.messageQueue.length > 0) {
                    this.messageQueueTimer = setTimeout(processNext, this.rateLimitMs);
                } else {
                    this.messageQueueTimer = null;
                }
            } else {
                // Wait for rate limit
                const waitTime = this.rateLimitMs - timeSinceLastMessage;
                this.messageQueueTimer = setTimeout(processNext, waitTime);
            }
        };
        
        processNext();
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
                // Show joined message in Twitch panel (only once per session)
                if (!this.joinedMessageShown) {
                    const connectionMode = this.config.get('connectionMode', 'anonymous');
                    const authType = connectionMode === 'bot' ? ' (Bot authenticated)' : '';
                    this.showSystemMessage(`Joined #${this.channel}${authType}`);
                    this.joinedMessageShown = true;
                }
                // Update input box visibility
                this.updateInputBoxVisibility();
            } else if (line.includes('PRIVMSG')) {
                this.parseChatMessage(line);
            } else if (line.includes('USERNOTICE')) {
                this.parseUserNotice(line);
            } else if (line.includes(' 001 ') && !this.joinedMessageShown) {
                // RPL_WELCOME - numeric reply for successful bot auth
                logger.log(`Bot authentication successful for #${this.channel}`);
                this.connected = true;
                this.reconnectAttempts = 0;
                this.showSystemMessage(`Bot authenticated & joined #${this.channel}`);
                this.joinedMessageShown = true;
                // Update input box visibility
                this.updateInputBoxVisibility();
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
            let message = msgMatch[1];

            // Clean up reply messages - remove @mention prefix if it's a reply
            if (tags['reply-parent-msg-id']) {
                // Reply messages often start with @username, remove it
                message = message.replace(/^@\S+\s+/, '');
            }

            // Check for commands
            if (message.startsWith('!')) {
                this.handleCommand(username, message, tags);
            }
            
            // Inject to separate Twitch panel only (not Krunker chat)
            this.injectToTwitchPanel(username, message, tags);
        } catch (error) {
            logger.error('Error parsing message:', error);
        }
    }

    injectToTwitchPanel(username: string, message: string, tags: Record<string, string>) {
        if (!this.twitchChatList) return;
        
        // Only inject if panel is visible (channel is set)
        if (this.twitchChatHolder && this.twitchChatHolder.style.display === 'none') return;

        const messageId = `twitch:${username}:${message}`;
        if (this.recentMessages.indexOf(messageId) !== -1) return;
        this.recentMessages.push(messageId);
        if (this.recentMessages.length > this.messageHistoryLimit) {
            this.recentMessages.shift();
        }

        const chatItem = document.createElement('div');
        chatItem.className = 'twitchChatItem';
        chatItem.dataset.timestamp = Date.now().toString();

        if (this.config.get('twitch.showBadges', true) && tags.badges) {
            this.addBadges(chatItem, tags.badges);
        }

        const usernameSpan = document.createElement('span');
        let displayName = tags['display-name'] || username;
        
        // Use generic names if enabled
        const useGenericNames = this.config.get('twitch.useGenericNames', false);
        logger.log(`[Generic Names] Enabled: ${useGenericNames}, Original: ${displayName}`);
        
        if (useGenericNames) {
            displayName = this.getGenericName(tags);
            logger.log(`[Generic Names] Changed to: ${displayName}`);
        }
        
        // Apply colors - use role-based colors when generic names are enabled
        if (useGenericNames) {
            usernameSpan.style.color = this.getGenericColor(tags);
        } else if (this.config.get('twitch.useUserColors', true) && tags.color) {
            usernameSpan.style.color = tags.color;
        } else {
            usernameSpan.style.color = '#B500B5';
        }
        
        usernameSpan.style.fontWeight = '600';
        usernameSpan.textContent = `\u200E${displayName}\u200E`;

        const messageSpan = document.createElement('span');
        messageSpan.className = 'twitchChatMsg';
        
        if (this.config.get('twitch.showEmotes', true) && tags.emotes && tags.emotes !== '') {
            this.parseEmotes(messageSpan, message, tags.emotes);
        } else {
            messageSpan.textContent = `\u200E${message}\u200E`;
        }

        chatItem.appendChild(usernameSpan);
        chatItem.appendChild(document.createTextNode(': '));
        chatItem.appendChild(messageSpan);

        // Append new messages (with flex-direction: column-reverse, newest at top)
        this.twitchChatList.appendChild(chatItem);

        // Auto-scroll to show latest messages (scroll to top since reversed)
        this.twitchChatList.scrollTop = 0;
    }

    getGenericName(tags: Record<string, string>): string {
        // Check if user is a bot
        if (tags.badges && tags.badges.includes('bot')) {
            return 'Bot';
        }
        
        // Check if user is broadcaster
        if (tags.badges && tags.badges.includes('broadcaster')) {
            return 'Broadcaster';
        }
        
        // Check if user is moderator
        if (this.isMod(tags)) {
            return 'Moderator';
        }
        
        // Check if user is VIP
        if (tags.badges && tags.badges.includes('vip')) {
            return 'VIP';
        }
        
        // Check if user is subscriber
        if (tags.badges && (tags.badges.includes('subscriber') || tags.badges.includes('founder'))) {
            return 'Subscriber';
        }
        
        // Default to Viewer
        return 'Viewer';
    }

    getGenericColor(tags: Record<string, string>): string {
        // Return consistent colors based on role
        if (tags.badges && tags.badges.includes('bot')) {
            return '#9147FF'; // Purple for bots
        }
        
        if (tags.badges && tags.badges.includes('broadcaster')) {
            return '#E91916'; // Red for broadcaster
        }
        
        if (this.isMod(tags)) {
            return '#00AD03'; // Green for moderators
        }
        
        if (tags.badges && tags.badges.includes('vip')) {
            return '#E005B9'; // Magenta for VIPs
        }
        
        if (tags.badges && (tags.badges.includes('subscriber') || tags.badges.includes('founder'))) {
            return '#9147FF'; // Purple for subscribers
        }
        
        // Default viewer color
        return '#B4B4B4'; // Gray for regular viewers
    }

    showSystemMessage(message: string) {
        if (!this.twitchChatList) return;
        
        const chatItem = document.createElement('div');
        chatItem.className = 'twitchChatItem';
        chatItem.style.fontStyle = 'italic';
        chatItem.style.opacity = '0.8';
        chatItem.dataset.timestamp = Date.now().toString();
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'twitchChatMsg';
        messageSpan.style.color = '#00FF00'; // Green for system messages
        messageSpan.textContent = `\u200E${message}\u200E`;
        
        chatItem.appendChild(messageSpan);
        // Append so it appears at top (with column-reverse)
        this.twitchChatList.appendChild(chatItem);
        
        // Auto-scroll to top (since reversed)
        this.twitchChatList.scrollTop = 0;
    }

    startMessageCleanup() {
        // Run cleanup every 5 seconds
        this.messageCleanupTimer = setInterval(() => {
            const timeoutMinutes = this.config.get('messageTimeout', 0) as number;
            if (!timeoutMinutes || timeoutMinutes <= 0) return;
            
            const timeoutMs = timeoutMinutes * 60 * 1000;
            const now = Date.now();
            
            const chatItems = this.twitchChatList?.querySelectorAll('.twitchChatItem');
            if (!chatItems) return;
            
            chatItems.forEach((item) => {
                const timestamp = parseInt(item.getAttribute('data-timestamp') || '0');
                if (timestamp && (now - timestamp) > timeoutMs) {
                    item.remove();
                }
            });
        }, 5000);
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
        chatItem.style.display = 'flex';
        chatItem.style.alignItems = 'center';
        chatItem.style.flexWrap = 'wrap';

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
        usernameSpan.style.lineHeight = '16px';
        usernameSpan.style.flexShrink = '0';
        usernameSpan.textContent = `\u200E${displayName}\u200E`;

        const messageSpan = document.createElement('span');
        messageSpan.className = 'chatMsg';
        messageSpan.style.wordWrap = 'break-word';
        messageSpan.style.wordBreak = 'break-word';
        messageSpan.style.overflowWrap = 'break-word';
        messageSpan.style.whiteSpace = 'pre-wrap';
        messageSpan.style.maxWidth = '100%';
        messageSpan.style.fontFamily = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        messageSpan.style.lineHeight = '16px';
        messageSpan.style.flex = '1';
        
        if (this.config.get('twitch.showEmotes', true) && tags.emotes && tags.emotes !== '') {
            this.parseEmotes(messageSpan, message, tags.emotes);
        } else {
            messageSpan.textContent = `\u200E${message}\u200E`;
        }

        chatItem.appendChild(usernameSpan);
        const colonSpan = document.createElement('span');
        colonSpan.textContent = ': ';
        colonSpan.style.lineHeight = '16px';
        colonSpan.style.flexShrink = '0';
        chatItem.appendChild(colonSpan);
        chatItem.appendChild(messageSpan);

        chatMsgContainer.appendChild(chatItem);

        chatList.appendChild(chatMsgContainer);

        if (chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 100) {
            chatList.scrollTop = chatList.scrollHeight;
        }

        logger.log(`${displayName}: ${message}`);
    }

    // Fetch global badges from Twitch GQL API (from ghost-chat)
    async fetchGlobalBadges(): Promise<void> {
        if (this.globalBadgesFetched) return;
        
        const query = JSON.stringify({
            query: '{ badges { imageURL(size: NORMAL) setID version } }'
        });
        
        try {
            const response = await fetch(this.TWITCH_GQL_URL, {
                method: 'POST',
                headers: {
                    'Client-Id': this.TWITCH_GQL_CLIENT_ID,
                    'Content-Type': 'application/json'
                },
                body: query
            });
            
            if (!response.ok) {
                throw new Error(`Twitch GQL returned ${response.status}`);
            }
            
            const data = await response.json();
            const badges = data.data?.badges || [];
            
            badges.forEach((badge: any) => {
                const cacheKey = `${badge.setID}/${badge.version}`;
                this.badgeCache.set(cacheKey, badge.imageURL);
            });
            
            this.globalBadgesFetched = true;
            logger.log(`[Twitch] Fetched ${badges.length} global badges`);
        } catch (error) {
            logger.error('[Twitch] Failed to fetch global badges:', error);
        }
    }
    
    // Fetch channel-specific badges from Twitch GQL API (from ghost-chat)
    async fetchChannelBadges(channelLogin: string): Promise<void> {
        if (!channelLogin || !/^[a-zA-Z0-9_]{1,25}$/.test(channelLogin)) {
            logger.error('[Twitch] Invalid channel login for badge fetch:', channelLogin);
            return;
        }
        
        const query = JSON.stringify({
            query: `query { user(login: "${channelLogin}") { broadcastBadges { imageURL(size: NORMAL) setID version } } }`
        });
        
        try {
            const response = await fetch(this.TWITCH_GQL_URL, {
                method: 'POST',
                headers: {
                    'Client-Id': this.TWITCH_GQL_CLIENT_ID,
                    'Content-Type': 'application/json'
                },
                body: query
            });
            
            if (!response.ok) {
                throw new Error(`Twitch GQL returned ${response.status}`);
            }
            
            const data = await response.json();
            const badges = data.data?.user?.broadcastBadges || [];
            
            badges.forEach((badge: any) => {
                const cacheKey = `${badge.setID}/${badge.version}`;
                this.badgeCache.set(cacheKey, badge.imageURL);
            });
            
            logger.log(`[Twitch] Fetched ${badges.length} channel badges for ${channelLogin}`);
        } catch (error) {
            logger.error('[Twitch] Failed to fetch channel badges:', error);
        }
    }

    addBadges(container: HTMLElement, badgesData: string) {
        const badges = badgesData.split(',');
        
        // Create wrapper for badges to align as a group with username
        const badgeWrapper = document.createElement('span');
        badgeWrapper.style.display = 'inline-flex';
        badgeWrapper.style.alignItems = 'center';
        badgeWrapper.style.marginRight = '4px';
        badgeWrapper.style.flexShrink = '0';
        
        badges.forEach(badge => {
            const [badgeType, version] = badge.split('/');
            if (!badgeType || !version) return;
            
            const img = document.createElement('img');
            img.style.height = '16px';
            img.style.width = '16px';
            img.style.marginRight = '2px';
            img.style.display = 'block';
            img.alt = badgeType;
            img.title = badgeType;
            
            // Check cache first (populated from GQL API)
            const cacheKey = `${badgeType}/${version}`;
            if (this.badgeCache.has(cacheKey)) {
                img.src = this.badgeCache.get(cacheKey)!;
                badgeWrapper.appendChild(img);
                return;
            }
            
            // If not in cache, try to construct URL (fallback)
            const fallbackUrl = `https://static-cdn.jtvnw.net/badges/v1/${badgeType}/${version}/1`;
            img.src = fallbackUrl;
            
            img.onload = () => {
                this.badgeCache.set(cacheKey, img.src);
            };
            
            img.onerror = () => {
                img.style.display = 'none';
                console.warn(`[Water] [Twitch] Failed to load badge: ${badgeType}/${version}`);
            };
            
            badgeWrapper.appendChild(img);
        });
        
        // Only add wrapper if it has badges
        if (badgeWrapper.children.length > 0) {
            container.appendChild(badgeWrapper);
        }
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
            this.intentionalDisconnect = true;
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
        
        // Clear message queue timer
        if (this.messageQueueTimer) {
            clearTimeout(this.messageQueueTimer);
            this.messageQueueTimer = null;
        }
        
        // Clear message cleanup interval
        if (this.messageCleanupTimer) {
            clearInterval(this.messageCleanupTimer);
            this.messageCleanupTimer = null;
        }
        
        // Remove panel elements
        const panelStyle = document.getElementById('twitch-panel-style');
        if (panelStyle) panelStyle.remove();
        
        if (this.twitchChatHolder && this.twitchChatHolder.parentNode) {
            this.twitchChatHolder.parentNode.removeChild(this.twitchChatHolder);
        }
        this.twitchChatHolder = null;
        this.twitchChatList = null;
        
        logger.log('Cleanup completed');
    }
}
