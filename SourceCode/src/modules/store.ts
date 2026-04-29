import { Context, RunAt } from '../context';
import Module from '../module';
import ClientOption from '../options';
import StoreMarketplaceUI from '../ui/store-marketplace';
import StoreInventoryUI from '../ui/store-inventory';
import StoreLinkUI from '../ui/store-link';
import { ipcRenderer } from 'electron';
import { createLogger } from '../utils/logger';

const logger = createLogger('Store');

// Simple button option class
class StoreButton extends ClientOption {
    label: string;
    callback: () => void;
    buttonStyle?: string;
    nameColor?: string;

    constructor(module: Module, opts: {
        name: string;
        id: string;
        description: string;
        label: string;
        callback: () => void;
        buttonStyle?: string;
        nameColor?: string;
    }) {
        super(module, opts);
        this.label = opts.label;
        this.callback = opts.callback;
        this.buttonStyle = opts.buttonStyle;
        this.nameColor = opts.nameColor;
    }

    generate(): HTMLElement {
        let container = super.generate();
        container.setAttribute('data-option-id', this.id);
        
        // Apply name color if specified
        if (this.nameColor) {
            const nameElement = container.querySelector('.name');
            if (nameElement) {
                (nameElement as HTMLElement).style.color = this.nameColor;
            }
        }

        let button = document.createElement('div');
        button.classList.add('settingsBtn');
        button.style.width = '300px';
        button.textContent = this.label;
        button.onclick = this.callback;
        
        // Apply custom button style if provided
        if (this.buttonStyle) {
            button.style.cssText += this.buttonStyle;
        }

        container.append(button);
        return container;
    }
}

// Info display option class
class StoreInfo extends ClientOption {
    content: string;

    constructor(module: Module, opts: {
        name: string;
        id: string;
        description: string;
        content: string;
    }) {
        super(module, opts);
        this.content = opts.content;
    }

    generate(): HTMLElement {
        let container = document.createElement('div');
        container.classList.add('settName');
        container.setAttribute('data-option-id', this.id);
        container.style.marginBottom = '16px';
        
        const infoBox = document.createElement('div');
        infoBox.style.cssText = `
            background: rgba(0, 0, 0, 0.2);
            border-left: 3px solid #ff69b4;
            padding: 12px 16px;
            font-size: 12px;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.8);
            font-family: 'Ubuntu', sans-serif;
        `;
        infoBox.innerHTML = this.content;

        container.append(infoBox);
        return container;
    }
}

// Supabase types
type SupabaseClient = any;

export default class Store extends Module {
    name = 'Water Store';
    id = 'store';
    
    private marketplaceUI: StoreMarketplaceUI;
    private inventoryUI: StoreInventoryUI;
    private linkUI: StoreLinkUI;
    
    private linkButton: StoreButton;
    private marketplaceButton: StoreButton;
    private inventoryButton: StoreButton;
    
    options: ClientOption[] = [];
    
    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        }
    ];

    private supabase: SupabaseClient | null = null;
    private lastCodeGeneration: number = 0;
    private readonly CODE_COOLDOWN = 10000; // 10 seconds
    private isLinked: boolean = false;
    private linkCheckInterval: number | null = null;
    private lastLinkCheck: number = 0;
    private isUnlinking: boolean = false;
    private hasInitializedLinkStatus: boolean = false;

    constructor() {
        super();
        this.marketplaceUI = new StoreMarketplaceUI(this);
        this.inventoryUI = new StoreInventoryUI(this);
        this.linkUI = new StoreLinkUI(this);

        // Create buttons (will be updated based on link status)
        this.linkButton = new StoreButton(this, {
            name: 'Link Discord',
            id: 'store.link',
            description: 'Generate a code to link your Discord account',
            label: 'Generate Link Code',
            callback: () => this.handleLinkButtonClick()
        });

        this.marketplaceButton = new StoreButton(this, {
            name: 'Marketplace',
            id: 'store.marketplace',
            description: 'Browse and purchase CSS themes',
            label: 'Browse Marketplace',
            callback: () => this.marketplaceUI.open()
        });

        this.inventoryButton = new StoreButton(this, {
            name: 'Inventory',
            id: 'store.inventory',
            description: 'View your purchased themes',
            label: 'My Inventory',
            callback: () => this.inventoryUI.open()
        });

        this.updateOptions();
    }

    init() {
        try {
            const { getSupabaseClient } = require('../utils/supabase');
            this.supabase = getSupabaseClient();
            
            // Check if account is linked
            this.checkLinkStatus();
        } catch (e) {
            console.error('[Store] Supabase init failed:', e);
        }
    }

    async checkLinkStatus() {
        if (!this.supabase) return;
        
        try {
            // We need to identify the user somehow - for now we'll use a stored identifier
            // In a real implementation, you'd have a unique client ID
            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) {
                // Generate a unique client ID if it doesn't exist
                const newClientId = this.generateRandomCode() + this.generateRandomCode();
                localStorage.setItem('water_client_id', newClientId);
                this.isLinked = false;
                this.hasInitializedLinkStatus = true;
                this.updateOptions();
                return;
            }
            
            // Check if this client ID has a linked Discord account (don't use .single())
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('discord_id')
                .eq('client_id', clientId);
            
            if (data && data.length > 0 && data[0].discord_id) {
                this.isLinked = true;
                localStorage.setItem('water_store_linked', 'true');
            } else {
                this.isLinked = false;
                localStorage.setItem('water_store_linked', 'false');
            }
            
            this.hasInitializedLinkStatus = true;
            this.updateOptions();
        } catch (e) {
            console.error('[Store] Error checking link status:', e);
            // Fallback to localStorage
            const linkedAccount = localStorage.getItem('water_store_linked');
            this.isLinked = linkedAccount === 'true';
            this.hasInitializedLinkStatus = true;
            this.updateOptions();
        }
    }

    updateOptions() {
        if (this.isLinked) {
            // Update link button to show "Unlink" with red background and green name
            this.linkButton.name = 'Discord Linked';
            this.linkButton.description = 'Your Discord account is linked';
            this.linkButton.label = 'Unlink';
            this.linkButton.buttonStyle = 'width: 300px; background: #dc3545 !important;';
            this.linkButton.nameColor = '#28a745';
            
            // Show all options when linked
            this.options = [
                this.linkButton,
                this.marketplaceButton,
                this.inventoryButton
            ];
        } else {
            // Update link button to show "Generate Link Code"
            this.linkButton.name = 'Link Discord';
            this.linkButton.description = 'Generate a code to link your Discord account';
            this.linkButton.label = 'Generate Link Code';
            this.linkButton.buttonStyle = 'width: 300px;';
            this.linkButton.nameColor = undefined;
            
            // Show link and marketplace when not linked
            this.options = [
                this.linkButton,
                this.marketplaceButton
            ];
        }
    }

    handleLinkButtonClick() {
        if (this.isLinked) {
            // Show confirmation dialog for unlinking
            if (confirm('Are you sure you want to unlink your Discord account?')) {
                this.unlinkAccount();
            }
        } else {
            // Open link UI to generate code
            this.linkUI.open();
        }
    }

    async unlinkAccount() {
        if (!this.supabase) return;
        
        const clientId = localStorage.getItem('water_client_id');
        if (!clientId) return;
        
        try {
            // Set flag to prevent notification
            this.isUnlinking = true;
            
            // Stop polling temporarily to avoid race conditions
            if (this.linkCheckInterval) {
                clearInterval(this.linkCheckInterval);
                this.linkCheckInterval = null;
            }
            
            // Remove client_id from user profile
            const { error } = await this.supabase
                .from('user_profiles')
                .update({ client_id: null })
                .eq('client_id', clientId);
            
            if (error) {
                console.error('[Store] Error unlinking account:', error);
                this.isUnlinking = false;
                // Restart polling
                this.startLinkPolling();
                return;
            }
            
            // Update local state
            this.isLinked = false;
            localStorage.setItem('water_store_linked', 'false');
            this.updateOptions();
            
            // Restart polling after a delay and reset flag
            setTimeout(() => {
                this.isUnlinking = false;
                this.startLinkPolling();
            }, 3000);
        } catch (e) {
            console.error('[Store] Error unlinking account:', e);
            this.isUnlinking = false;
            // Restart polling
            this.startLinkPolling();
        }
    }

    setLinked(linked: boolean) {
        this.isLinked = linked;
        localStorage.setItem('water_store_linked', linked ? 'true' : 'false');
        this.updateOptions();
    }

    renderer() {
        // Start polling for link status
        this.startLinkPolling();
    }

    startLinkPolling() {
        // Check immediately
        this.pollLinkStatus();
        
        // Then check every 10 seconds (reduced from 3 seconds to reduce lag)
        this.linkCheckInterval = window.setInterval(() => {
            this.pollLinkStatus();
        }, 10000);
    }

    async pollLinkStatus() {
        if (!this.supabase) return;
        
        const clientId = localStorage.getItem('water_client_id');
        if (!clientId) return;
        
        // Don't poll if we're in the middle of unlinking
        if (this.isUnlinking) return;
        
        // Don't poll if we haven't initialized yet
        if (!this.hasInitializedLinkStatus) return;
        
        // Don't poll if we're already linked (no need to keep checking)
        if (this.isLinked) return;
        
        try {
            // Don't use .single() - it throws 406 when no rows found
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('discord_id, discord_username')
                .eq('client_id', clientId);
            
            const wasLinked = this.isLinked;
            const nowLinked = !!(data && data.length > 0 && data[0].discord_id);
            
            // Only show notification if we're transitioning from unlinked to linked
            // This prevents showing notification on startup
            if (!wasLinked && nowLinked) {
                // Just got linked! Show notification
                this.isLinked = true;
                localStorage.setItem('water_store_linked', 'true');
                this.updateOptions();
                this.showLinkSuccessNotification(data[0].discord_username);
                
                // Focus the window
                try {
                    ipcRenderer.send('focus-window');
                } catch (e) {
                    console.error('[Store] Failed to send focus IPC:', e);
                }
                
                // Stop polling once linked
                if (this.linkCheckInterval) {
                    clearInterval(this.linkCheckInterval);
                    this.linkCheckInterval = null;
                }
            } else if (wasLinked && !nowLinked) {
                // Got unlinked (but don't show notification)
                this.isLinked = false;
                localStorage.setItem('water_store_linked', 'false');
                this.updateOptions();
            }
        } catch (e) {
            // Silently fail - don't spam console
        }
    }

    showLinkSuccessNotification(discordUsername: string) {
        // Close settings window if open
        try {
            if (typeof (window as any).showWindow === 'function') {
                (window as any).showWindow(1);
            }
        } catch (e) {
            console.error('[Store] Failed to close settings window:', e);
        }
        
        // Create immersive overlay with solid black background
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000000;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            will-change: opacity;
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center; transform: scale(0.9); opacity: 0; will-change: transform, opacity; transition: transform 0.4s ease-out, opacity 0.4s ease-out;">
                <div style="font-size: 72px; font-weight: 900; color: #ffffff; margin-bottom: 40px; text-shadow: 0 0 40px rgba(255,255,255,0.3); letter-spacing: 3px;">
                    CONNECTION SUCCESSFUL
                </div>
                <div style="font-size: 48px; color: #ffffff; font-weight: 600; opacity: 0.95;">
                    Welcome ${discordUsername}
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Use requestAnimationFrame for smooth animations
        requestAnimationFrame(() => {
            overlay.style.transition = 'opacity 0.4s ease-out';
            overlay.style.opacity = '1';
            
            const content = overlay.firstElementChild as HTMLElement;
            if (content) {
                content.style.transform = 'scale(1)';
                content.style.opacity = '1';
            }
        });
        
        // Remove after 5 seconds with smooth fade
        setTimeout(() => {
            overlay.style.transition = 'opacity 0.4s ease-out';
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
            }, 400);
        }, 5000);
    }

    async generateLinkCode(): Promise<{ success: boolean; code?: string; expiresAt?: number; message: string }> {
        try {
            // Rate limiting
            const now = Date.now();
            const timeSinceLastGen = now - this.lastCodeGeneration;
            
            if (timeSinceLastGen < this.CODE_COOLDOWN) {
                const waitTime = Math.ceil((this.CODE_COOLDOWN - timeSinceLastGen) / 1000);
                return {
                    success: false,
                    message: `Please wait ${waitTime} seconds before generating a new code`
                };
            }

            if (!this.supabase) {
                return {
                    success: false,
                    message: 'Store system not initialized'
                };
            }

            // Get or create client ID
            let clientId = localStorage.getItem('water_client_id');
            if (!clientId) {
                clientId = this.generateRandomCode() + this.generateRandomCode();
                localStorage.setItem('water_client_id', clientId);
            }

            const code = this.generateRandomCode();
            const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

            // Delete any existing codes for this client_id to prevent duplicates
            await this.supabase
                .from('link_codes')
                .delete()
                .eq('client_id', clientId);

            // Insert new code into Supabase with client_id
            const { error } = await this.supabase
                .from('link_codes')
                .insert({
                    code: code,
                    client_id: clientId,
                    expires_at: new Date(expiresAt).toISOString(),
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('[Store] Failed to insert link code:', error);
                return {
                    success: false,
                    message: 'Failed to save link code. Please try again.'
                };
            }

            this.lastCodeGeneration = now;
            
            return {
                success: true,
                code,
                expiresAt,
                message: 'Code generated successfully'
            };
        } catch (e) {
            console.error('[Store] Failed to generate link code:', e);
            return {
                success: false,
                message: 'Failed to generate link code. Please try again.'
            };
        }
    }

    generateRandomCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    cleanup() {
        // Stop polling when module is cleaned up
        if (this.linkCheckInterval) {
            clearInterval(this.linkCheckInterval);
            this.linkCheckInterval = null;
        }
    }
}
