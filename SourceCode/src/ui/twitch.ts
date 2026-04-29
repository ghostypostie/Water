import TwitchChat from '../modules/twitch';
import Checkbox from '../options/checkbox';
import Button from '../options/button';
import TextInput from '../options/textinput';
import Slider from '../options/slider';
import Dropdown from '../options/dropdown';
import UI from './index';
import config from '../config';
import { showRestartToast } from '../utils/toast';

export default class TwitchUI extends UI {
    name = 'Twitch Chat Settings';
    twitchModule: TwitchChat;
    categories = [
        {
            name: 'Connection',
            options: []
        },
        {
            name: 'Font',
            options: []
        },
        {
            name: 'Commands',
            options: []
        },
        {
            name: 'Display Options',
            options: []
        },
        {
            name: 'Notifications',
            options: []
        }
    ];

    buttons = [
        new Button(this.module, {
            label: 'Back to settings',
            color: 'purple',
            name: '',
            description: '',
            id: '',
            onChange: () => {
                window.showWindow?.(1);
            },
        }),
    ];

    private panelOptions = [
        { id: 'twitch.showBadges', name: 'Show User Badges' },
        { id: 'twitch.useUserColors', name: 'Use Username Colors' },
        { id: 'twitch.showEmotes', name: 'Show Emotes' },
        { id: 'twitch.useGenericNames', name: 'Use Generic Names' }
    ];

    private notificationOptions = [
        { id: 'twitch.notifyRaids', name: 'Raid Notifications' },
        { id: 'twitch.notifyHosts', name: 'Host Notifications' },
        { id: 'twitch.notifySubs', name: 'Subscriber Alerts' },
        { id: 'twitch.notifyRedeems', name: 'Channel Point Redemptions' }
    ];

    private commandOptions = [
        { id: 'twitch.cmd.link', name: '!link - Game URL' },
        { id: 'twitch.cmd.profile', name: '!profile - Krunker Profile' },
        { id: 'twitch.cmd.nukes', name: '!nukes - Nuke Count' },
        { id: 'twitch.cmd.mods', name: '!mods - Active Modules (Mod Only)' }
    ];

    constructor(module: TwitchChat) {
        super(module);
        this.twitchModule = module;
    }

    open() {
        let windowHolder = document.getElementById('windowHolder');
        let menuWindow = document.getElementById('menuWindow');

        if(!windowHolder || !menuWindow) return;

        // Clear saved scroll position to start at top
        sessionStorage.removeItem('settings-scroll-position');

        windowHolder.className = 'popupWin';
        menuWindow.style.width = this.width + 'px';
        menuWindow.className = 'dark';
        menuWindow.innerHTML = '';

        if(this.name) {
            let header = document.createElement('div');
            header.id = 'referralHeader';
            header.textContent = this.name;
            menuWindow.append(header);
        }

        let holder = document.createElement('div');
        holder.id = 'settHolder';
        menuWindow.append(holder);

        // Get current connection mode
        const connectionMode = config.get('connectionMode', 'anonymous');

        // Add Connection section
        this.addSectionHeader(holder, 'Connection');
        this.addConnectionSettings(holder);

        // Add Commands section (only relevant for bot mode, but show disabled state)
        this.addSection(holder, 'Commands', this.commandOptions);

        // Add Display and Notifications sections
        this.addSection(holder, 'Display Options', this.panelOptions);
        this.addSection(holder, 'Notifications', this.notificationOptions);

        for(let button of this.buttons) menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
        
        // Ensure scroll is at top
        setTimeout(() => {
            const settHolder = document.getElementById('settHolder');
            if (settHolder) {
                settHolder.scrollTop = 0;
            }
            if (menuWindow) {
                menuWindow.scrollTop = 0;
            }
            if (windowHolder) {
                windowHolder.scrollTop = 0;
            }
        }, 10);
    }

    addSectionHeader(holder: HTMLElement, title: string) {
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'setHed';
        sectionHeader.textContent = title;
        sectionHeader.style.marginTop = '15px';
        holder.appendChild(sectionHeader);
    }

    addConnectionSettings(holder: HTMLElement) {
        const container = document.createElement('div');
        container.className = 'setBodH';
        container.style.padding = '20px';
        container.style.background = 'rgba(40,40,40,0.8)';
        container.style.borderRadius = '8px';
        container.style.border = '1px solid rgba(255,255,255,0.1)';

        // Connection Status Header
        const statusHeader = document.createElement('div');
        statusHeader.style.display = 'flex';
        statusHeader.style.alignItems = 'center';
        statusHeader.style.gap = '12px';
        statusHeader.style.marginBottom = '20px';
        statusHeader.style.padding = '12px 15px';
        statusHeader.style.background = this.twitchModule.connected 
            ? 'linear-gradient(135deg, rgba(0,255,0,0.15) 0%, rgba(0,100,0,0.1) 100%)' 
            : 'linear-gradient(135deg, rgba(255,0,0,0.15) 0%, rgba(100,0,0,0.1) 100%)';
        statusHeader.style.borderRadius = '6px';
        statusHeader.style.border = `1px solid ${this.twitchModule.connected ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.3)'}`;
        
        const statusDot = document.createElement('span');
        statusDot.style.width = '12px';
        statusDot.style.height = '12px';
        statusDot.style.borderRadius = '50%';
        statusDot.style.background = this.twitchModule.connected 
            ? 'radial-gradient(circle, #00ff00 0%, #00aa00 100%)' 
            : 'radial-gradient(circle, #ff4444 0%, #aa0000 100%)';
        statusDot.style.boxShadow = this.twitchModule.connected 
            ? '0 0 8px rgba(0,255,0,0.6)' 
            : '0 0 8px rgba(255,0,0,0.6)';
        statusDot.id = 'twitch-status-dot';
        
        const statusText = document.createElement('span');
        statusText.textContent = this.twitchModule.connected ? 'Connected' : 'Disconnected';
        statusText.id = 'twitch-status-text';
        statusText.style.fontWeight = 'bold';
        statusText.style.fontSize = '16px';
        statusText.style.color = this.twitchModule.connected ? '#00ff88' : '#ff6666';
        statusText.style.textTransform = 'uppercase';
        statusText.style.letterSpacing = '2px';
        
        const modeText = document.createElement('span');
        const connectionMode = config.get('connectionMode', 'anonymous') as string;
        modeText.textContent = connectionMode === 'bot' ? 'BOT MODE' : 'ANONYMOUS';
        modeText.style.color = connectionMode === 'bot' ? '#9146ff' : 'rgba(255,255,255,0.5)';
        modeText.style.fontSize = '11px';
        modeText.style.fontWeight = 'bold';
        modeText.style.padding = '3px 8px';
        modeText.style.background = connectionMode === 'bot' ? 'rgba(145,70,255,0.2)' : 'rgba(255,255,255,0.1)';
        modeText.style.borderRadius = '4px';
        modeText.style.marginLeft = 'auto';
        
        statusHeader.appendChild(statusDot);
        statusHeader.appendChild(statusText);
        statusHeader.appendChild(modeText);
        container.appendChild(statusHeader);

        // Bot Username (removed "BOT CREDENTIALS" header)
        const usernameInput = new TextInput(this.module, {
            name: 'Bot Username',
            id: 'twitch.botUsername',
            description: 'Your Twitch bot account username',
            label: 'username',
        });
        container.appendChild(usernameInput.generate());

        // OAuth Token
        const tokenInput = new TextInput(this.module, {
            name: 'OAuth Token',
            id: 'twitch.oauthToken',
            description: 'Access token from twitchtokengenerator.com',
            label: 'paste token here',
            type: 'password',
        });
        container.appendChild(tokenInput.generate());

        // Quick Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.style.marginTop = '20px';
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '10px';
        
        const testBtn = document.createElement('button');
        testBtn.textContent = 'Test Connection';
        testBtn.style.padding = '12px 24px';
        testBtn.style.fontWeight = 'bold';
        testBtn.style.fontSize = '14px';
        testBtn.style.color = '#fff';
        testBtn.style.background = 'linear-gradient(135deg, #9146ff 0%, #6441a5 100%)';
        testBtn.style.border = 'none';
        testBtn.style.borderRadius = '6px';
        testBtn.style.cursor = 'pointer';
        testBtn.style.transition = 'all 0.2s';
        testBtn.style.whiteSpace = 'nowrap';
        testBtn.style.width = 'auto';
        testBtn.style.display = 'inline-block';
        testBtn.onmouseenter = () => {
            testBtn.style.transform = 'translateY(-2px)';
            testBtn.style.boxShadow = '0 4px 12px rgba(145,70,255,0.4)';
        };
        testBtn.onmouseleave = () => {
            testBtn.style.transform = 'translateY(0)';
            testBtn.style.boxShadow = 'none';
        };
        testBtn.onclick = () => {
            const channel = config.get('channel', '') as string;
            const trimmedChannel = channel?.trim();
            if (!trimmedChannel) {
                alert('Please set a channel name in the main Twitch Chat settings tab first!\n\nGo to: Settings → Twitch Chat → Channel Name');
                return;
            }
            this.twitchModule.disconnect();
            setTimeout(() => this.twitchModule.connect(trimmedChannel), 500);
        };
        actionsDiv.appendChild(testBtn);
        
        container.appendChild(actionsDiv);

        // Help Section
        const helpSection = document.createElement('div');
        helpSection.style.marginTop = '20px';
        helpSection.style.padding = '15px';
        helpSection.style.background = 'rgba(0,0,0,0.3)';
        helpSection.style.borderRadius = '6px';
        helpSection.style.borderLeft = '3px solid #9146ff';
        
        const helpTitle = document.createElement('div');
        helpTitle.textContent = 'How to get a token:';
        helpTitle.style.fontSize = '12px';
        helpTitle.style.fontWeight = 'bold';
        helpTitle.style.color = '#fff';
        helpTitle.style.marginBottom = '8px';
        helpSection.appendChild(helpTitle);
        
        const helpText = document.createElement('div');
        helpText.style.fontSize = '13px';
        helpText.style.color = 'rgba(255,255,255,0.85)';
        helpText.style.lineHeight = '2.2';
        helpText.innerHTML = `
            <div style="margin-bottom: 8px;">1. Visit <a href="https://twitchtokengenerator.com" target="_blank" style="color:#a970ff;text-decoration:none;font-weight:bold;">twitchtokengenerator.com ↗</a></div>
            <div style="margin-bottom: 8px;">2. Click <strong style="color:#fff;">"Connect with Twitch"</strong> and authorize</div>
            <div style="margin-bottom: 8px;">3. Copy the green <strong style="color:#00ff88;">Access Token</strong></div>
            <div>4. Paste above — <code style="background:rgba(145,70,255,0.3);color:#fff;padding:3px 8px;border-radius:4px;font-weight:bold;">oauth:</code> is added automatically</div>
        `;
        helpSection.appendChild(helpText);
        
        const noteText = document.createElement('div');
        noteText.style.marginTop = '15px';
        noteText.style.padding = '10px 12px';
        noteText.style.background = 'rgba(255,140,0,0.15)';
        noteText.style.border = '1px solid rgba(255,140,0,0.4)';
        noteText.style.borderRadius = '4px';
        noteText.style.fontSize = '12px';
        noteText.style.color = '#ffcc00';
        noteText.style.fontWeight = '500';
        noteText.innerHTML = '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#ff9500;color:#000;font-weight:bold;font-size:12px;border-radius:3px;margin-right:6px;">!</span><strong style="color:#fff;">Required:</strong> Change Connection Mode to "OAuth Connection" in main Client Settings → Twitch Chat';
        helpSection.appendChild(noteText);
        
        container.appendChild(helpSection);

        holder.appendChild(container);
    }

    addFontSettings(holder: HTMLElement) {
        const container = document.createElement('div');
        container.className = 'setBodH';
        container.style.padding = '15px';

        // Font Size
        const fontSizeSlider = new Slider(this.module, {
            name: 'Font Size',
            id: 'fontSize',
            description: 'Text size for Twitch chat',
            defaultValue: 14,
            min: 10,
            max: 20,
            step: 1,
        });
        container.appendChild(fontSizeSlider.generate());

        holder.appendChild(container);
    }

    addSection(holder: HTMLElement, title: string, options: Array<{id: string, name: string}>) {
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'setHed';
        sectionHeader.textContent = title;
        sectionHeader.style.marginTop = '15px';
        holder.appendChild(sectionHeader);

        const gridContainer = document.createElement('div');
        gridContainer.className = 'quickplay-grid';
        
        const renderGrid = () => {
            gridContainer.innerHTML = options.map(option => {
                // Get the actual default value for each option
                const defaultValue = option.id === 'twitch.useGenericNames' ? false : true;
                // Use module config path: modules.twitch.{option.id}
                const configKey = `modules.${this.twitchModule.id}.${option.id}`;
                const isEnabled = config.get(configKey, defaultValue) as boolean;
                return `
                    <div class="quickplay-item ${isEnabled ? 'selected' : ''}" data-option="${option.id}">
                        ${option.name}
                    </div>
                `;
            }).join('');

            gridContainer.querySelectorAll('.quickplay-item').forEach(el => {
                el.addEventListener('click', () => {
                    const optionId = el.getAttribute('data-option');
                    if (!optionId) return;

                    // Get the actual default value for this option
                    const defaultValue = optionId === 'twitch.useGenericNames' ? false : true;
                    // Use module config path: modules.twitch.{optionId}
                    const configKey = `modules.${this.twitchModule.id}.${optionId}`;
                    const currentValue = config.get(configKey, defaultValue) as boolean;
                    config.set(configKey, !currentValue);
                    
                    // Show toast notification for restart
                    showRestartToast();
                    
                    renderGrid();
                });
            });
        };

        holder.appendChild(gridContainer);
        renderGrid();
    }
}
