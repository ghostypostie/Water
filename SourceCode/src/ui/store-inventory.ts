import UI from './index';
import Button from '../options/button';
import Store from '../modules/store';
import StoreMarketplaceUI from './store-marketplace';

export default class StoreInventoryUI extends UI {
    name = 'My Inventory';

    categories = [{
        name: '',
        options: []
    }];

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

    constructor(module: Store) {
        super(module);
    }

    async open() {
        let windowHolder = document.getElementById('windowHolder');
        let menuWindow = document.getElementById('menuWindow');

        if(!windowHolder || !menuWindow) return;

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

        // Check if Discord is linked
        const isLinked = await this.checkDiscordLinked();

        // Add balance display
        if (isLinked) {
            const balanceContainer = document.createElement('div');
            balanceContainer.style.cssText = `
                padding: 6px 12px;
                background: rgba(255, 105, 180, 0.15);
                border-radius: 4px;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-size: 13px;
                margin: 10px 20px;
                float: right;
            `;
            balanceContainer.innerHTML = `
                <span id="pani-balance-inv" style="color: #ff69b4; font-weight: 600;">Loading...</span>
                <span style="color: rgba(255,255,255,0.7); font-size: 12px;">Pani</span>
            `;
            holder.appendChild(balanceContainer);
            this.loadBalance();
        }

        // Add inventory content
        const content = document.createElement('div');
        content.id = 'inventory-content';
        content.style.padding = '10px 20px 20px 20px';
        content.style.clear = 'both';
        holder.appendChild(content);

        // Load purchased themes
        await this.loadInventory(isLinked);

        for(let button of this.buttons) menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }

    async checkDiscordLinked(): Promise<boolean> {
        const storeModule = this.module as Store;
        const supabase = (storeModule as any).supabase;
        
        if (!supabase) return false;

        try {
            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) return false;

            const { data: profileData } = await supabase
                .from('user_profiles')
                .select('discord_id')
                .eq('client_id', clientId);

            return !!(profileData && profileData.length > 0 && profileData[0].discord_id);
        } catch (e) {
            console.error('[Inventory] Failed to check Discord link:', e);
            return false;
        }
    }

    async loadInventory(isLinked: boolean) {
        const content = document.getElementById('inventory-content');
        if (!content) return;

        if (!isLinked) {
            content.innerHTML = `
                <div style="text-align: center; color: rgba(255,255,255,0.6); padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔒</div>
                    <p style="font-size: 18px; margin-bottom: 10px;">Link Discord to View Inventory</p>
                    <p style="font-size: 14px;">Your purchased themes will appear here</p>
                </div>
            `;
            return;
        }

        const storeModule = this.module as Store;
        const supabase = (storeModule as any).supabase;

        if (!supabase) {
            content.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); padding: 40px;"><p>Store system not available</p></div>';
            return;
        }

        try {
            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) {
                content.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); padding: 40px;"><p>Client ID not found</p></div>';
                return;
            }

            // Get discord_id
            const { data: profileData } = await supabase
                .from('user_profiles')
                .select('discord_id')
                .eq('client_id', clientId)
                .limit(1);

            if (!profileData || profileData.length === 0) {
                content.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); padding: 40px;"><p>Profile not found</p></div>';
                return;
            }

            const discordId = profileData[0].discord_id;

            // Get user's purchases
            const { data: purchases, error } = await supabase
                .from('user_purchases')
                .select('item_id, purchased_at')
                .eq('discord_id', discordId)
                .order('purchased_at', { ascending: false });

            if (error) throw error;

            if (!purchases || purchases.length === 0) {
                content.innerHTML = `
                    <div style="text-align: center; color: rgba(255,255,255,0.6); padding: 60px 20px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">📦</div>
                        <p style="font-size: 18px; margin-bottom: 10px;">No Items Yet</p>
                        <p style="font-size: 14px; margin-bottom: 20px;">Visit the marketplace to purchase items</p>
                    </div>
                `;
                return;
            }

            // Get item details for all purchases
            const itemIds = purchases.map((p: any) => p.item_id);
            const { data: items } = await supabase
                .from('premium_items')
                .select('id, name, author, description, thumbnail_url, type, github_path')
                .in('id', itemIds);

            if (!items || items.length === 0) {
                content.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); padding: 40px;"><p>No item details found</p></div>';
                return;
            }

            // Get active premium theme
            const activeThemeId = localStorage.getItem('water-active-premium-theme');

            // Render inventory grid
            const itemCards = items.map((item: any) => {
                const isActive = item.id === activeThemeId && item.type === 'css_theme';
                const hasThumb = item.thumbnail_url && item.thumbnail_url.trim() !== '';
                const thumbnailUrl = hasThumb ? item.thumbnail_url : null;
                
                const typeLabels: Record<string, string> = { 
                    'css_theme': 'THEME', 
                    'userscript': 'SCRIPT', 
                    'resource': 'RESOURCE',
                    'feature': 'FEATURE' 
                };
                const typeLabel = typeLabels[item.type] || item.type;
                
                // Icon SVGs for different types
                const typeIcons: Record<string, string> = {
                    'css_theme': '<svg width="60" height="60" viewBox="0 0 24 24" fill="none"><path d="M7 21C6.45 21 5.97933 20.8043 5.588 20.413C5.196 20.021 5 19.55 5 19V5C5 4.45 5.196 3.979 5.588 3.587C5.97933 3.19567 6.45 3 7 3H14L19 8V19C19 19.55 18.8043 20.021 18.413 20.413C18.021 20.8043 17.55 21 17 21H7ZM13 9V4H7V19H17V9H13Z" fill="#fe8bbb"/></svg>',
                    'userscript': '<svg width="60" height="60" viewBox="0 0 24 24" fill="none"><path d="M9.4 16.6L4.8 12L9.4 7.4L8 6L2 12L8 18L9.4 16.6ZM14.6 16.6L19.2 12L14.6 7.4L16 6L22 12L16 18L14.6 16.6Z" fill="#fe8bbb"/></svg>',
                    'resource': '<svg width="60" height="60" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#fe8bbb"/></svg>',
                    'feature': '<svg width="60" height="60" viewBox="0 0 24 24" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#fe8bbb"/></svg>'
                };
                const typeIcon = typeIcons[item.type] || typeIcons['feature'];
                
                return `
                    <div style="
                        background: rgba(20, 20, 30, 0.8);
                        border-radius: 10px;
                        overflow: hidden;
                        border: ${isActive ? '2px solid rgba(0, 255, 0, 0.6)' : '1px solid rgba(254, 139, 187, 0.25)'};
                        position: relative;
                        display: flex;
                        flex-direction: column;
                    ">
                        <!-- Thumbnail -->
                        <div style="
                            width: 100%;
                            height: 180px;
                            background: ${hasThumb ? 'rgba(254, 139, 187, 0.05)' : 'linear-gradient(135deg, rgba(254, 139, 187, 0.15) 0%, rgba(254, 139, 187, 0.05) 100%)'};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            overflow: hidden;
                            position: relative;
                            border-bottom: 1px solid rgba(254, 139, 187, 0.15);
                        ">
                            ${hasThumb 
                                ? `<img src="${thumbnailUrl}" alt="${item.name}" style="
                                    width: 100%;
                                    height: 100%;
                                    object-fit: cover;
                                " />`
                                : `<div style="
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    width: 100%;
                                    height: 100%;
                                    opacity: 0.6;
                                ">${typeIcon}</div>`
                            }
                            
                            <!-- Type badge -->
                            <div style="
                                position: absolute;
                                top: 12px;
                                right: 12px;
                                background: rgba(254, 139, 187, 0.95);
                                color: #fff;
                                padding: 5px 12px;
                                border-radius: 6px;
                                font-size: 10px;
                                font-weight: 700;
                                letter-spacing: 0.5px;
                            ">${typeLabel}</div>
                            
                            ${isActive ? `<div style="
                                position: absolute;
                                top: 12px;
                                left: 12px;
                                background: #28a745;
                                color: white;
                                padding: 5px 12px;
                                border-radius: 6px;
                                font-size: 10px;
                                font-weight: 700;
                                letter-spacing: 0.5px;
                            ">ACTIVE</div>` : ''}
                        </div>
                        
                        <!-- Content -->
                        <div style="
                            padding: 16px;
                            display: flex;
                            flex-direction: column;
                            flex-grow: 1;
                            gap: 10px;
                        ">
                            <!-- Title -->
                            <div style="
                                font-size: 17px;
                                font-weight: 700;
                                color: #fff;
                                line-height: 1.3;
                            ">${item.name}</div>
                            
                            <!-- Author -->
                            <div style="
                                font-size: 12px;
                                color: rgba(254, 139, 187, 0.9);
                                font-weight: 600;
                            ">by ${item.author}</div>
                            
                            <!-- Button -->
                            <div style="margin-top: auto;">
                                ${item.type === 'css_theme'
                                    ? `<button id="apply-inv-${item.id}" style="
                                        width: 100%;
                                        background: ${isActive ? 'rgba(255, 255, 255, 0.1)' : '#ff69b4'};
                                        color: white;
                                        border: none;
                                        padding: 10px;
                                        border-radius: 4px;
                                        cursor: ${isActive ? 'not-allowed' : 'pointer'};
                                        font-size: 13px;
                                        font-weight: 600;
                                    " ${isActive ? 'disabled' : ''}>${isActive ? 'Currently Active' : 'Apply Theme'}</button>` 
                                    : (item.type === 'resource' || item.type === 'feature')
                                        ? `<button id="download-inv-${item.id}" style="
                                            width: 100%;
                                            background: #4CAF50;
                                            color: white;
                                            border: none;
                                            padding: 10px;
                                            border-radius: 4px;
                                            cursor: pointer;
                                            font-size: 13px;
                                            font-weight: 600;
                                            transition: background 0.2s;
                                        " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">Download</button>`
                                        : `<div style="text-align: center; color: rgba(255, 255, 255, 0.5); font-size: 13px; padding: 10px; font-weight: 600;">Owned</div>`
                                }
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            content.innerHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px;">${itemCards}</div>`;

            // Attach event listeners using event delegation
            content.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const applyBtn = target.closest('[id^="apply-inv-"]');
                const downloadBtn = target.closest('[id^="download-inv-"]');

                if (applyBtn && !applyBtn.hasAttribute('disabled')) {
                    const itemId = applyBtn.id.replace('apply-inv-', '');
                    this.applyThemeFromInventory(itemId);
                } else if (downloadBtn) {
                    const itemId = downloadBtn.id.replace('download-inv-', '');
                    this.downloadItemFromInventory(itemId, items);
                }
            });

        } catch (e) {
            console.error('[Inventory] Failed to load inventory:', e);
            content.innerHTML = '<div style="text-align: center; color: rgba(255,100,100,0.8); padding: 40px;"><p>Failed to load inventory</p></div>';
        }
    }

    async applyThemeFromInventory(themeId: string) {
        // Reuse marketplace apply function
        const marketplaceUI = new StoreMarketplaceUI(this.module as Store);
        await marketplaceUI.applyPremiumTheme(themeId);
        
        // Reload inventory to update active state
        const isLinked = await this.checkDiscordLinked();
        await this.loadInventory(isLinked);
    }

    async downloadItemFromInventory(itemId: string, items: any[]) {
        const item = items.find((i: any) => i.id === itemId);
        if (!item) return;

        // ONLY allow downloading resources/features - scripts are loaded from database
        if (item.type !== 'resource' && item.type !== 'feature') {
            console.warn('[Inventory] Download not allowed for type:', item.type);
            return;
        }

        const btn = document.getElementById(`download-inv-${itemId}`) as HTMLButtonElement;
        if (!btn) return;

        const originalText = btn.textContent;
        btn.textContent = 'Downloading...';
        btn.disabled = true;

        try {
            const storeModule = this.module as Store;
            const supabase = (storeModule as any).supabase;
            
            if (!supabase) {
                btn.textContent = 'Error';
                setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
                return;
            }

            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) {
                btn.textContent = 'Error';
                setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
                return;
            }

            const { data: profileData } = await supabase
                .from('user_profiles')
                .select('discord_id')
                .eq('client_id', clientId);

            if (!profileData || profileData.length === 0 || !profileData[0].discord_id) {
                btn.textContent = 'Error';
                setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
                return;
            }

            const discordId = profileData[0].discord_id;
            const marketplaceUI = new StoreMarketplaceUI(this.module as Store);
            
            // Only download resources/features
            const success = await marketplaceUI.downloadResource(item, discordId);

            if (success) {
                btn.textContent = '✓ Downloaded';
                btn.style.background = '#28a745';
                setTimeout(() => { btn.textContent = originalText; btn.disabled = false; btn.style.background = '#4CAF50'; }, 3000);
            } else {
                btn.textContent = 'Failed';
                setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
            }
        } catch (e) {
            console.error('[Inventory] Download failed:', e);
            btn.textContent = 'Error';
            setTimeout(() => { btn.textContent = originalText!; btn.disabled = false; }, 2000);
        }
    }

    async loadBalance() {
        const storeModule = this.module as Store;
        const supabase = (storeModule as any).supabase;
        
        if (!supabase) {
            this.updateBalanceDisplay('N/A');
            return;
        }

        try {
            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) {
                this.updateBalanceDisplay('0');
                return;
            }

            const { data: profileData } = await supabase
                .from('user_profiles')
                .select('discord_id')
                .eq('client_id', clientId);

            if (!profileData || profileData.length === 0 || !profileData[0].discord_id) {
                this.updateBalanceDisplay('0');
                return;
            }

            const discordId = profileData[0].discord_id;

            const { data: balanceData } = await supabase
                .from('user_balances')
                .select('credits')
                .eq('discord_id', discordId);

            if (balanceData && balanceData.length > 0) {
                const pani = balanceData[0].credits || 0;
                this.updateBalanceDisplay(pani.toLocaleString());
            } else {
                this.updateBalanceDisplay('0');
            }
        } catch (e) {
            console.error('[Inventory] Failed to load balance:', e);
            this.updateBalanceDisplay('Error');
        }
    }

    updateBalanceDisplay(balance: string) {
        const balanceEl = document.getElementById('pani-balance-inv');
        if (balanceEl) {
            balanceEl.textContent = balance;
        }
    }
}
