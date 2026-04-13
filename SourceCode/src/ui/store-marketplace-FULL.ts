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
                .select('theme_id, purchased_at')
                .eq('discord_id', discordId)
                .order('purchased_at', { ascending: false });

            if (error) throw error;

            if (!purchases || purchases.length === 0) {
                content.innerHTML = `
                    <div style="text-align: center; color: rgba(255,255,255,0.6); padding: 60px 20px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">📦</div>
                        <p style="font-size: 18px; margin-bottom: 10px;">No Themes Yet</p>
                        <p style="font-size: 14px; margin-bottom: 20px;">Visit the marketplace to purchase themes</p>
                    </div>
                `;
                return;
            }

            // Get theme details for all purchases
            const themeIds = purchases.map((p: any) => p.theme_id);
            const { data: themes } = await supabase
                .from('premium_themes')
                .select('id, name, author, description, thumbnail_url')
                .in('id', themeIds);

            if (!themes || themes.length === 0) {
                content.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); padding: 40px;"><p>No theme details found</p></div>';
                return;
            }

            // Get active premium theme
            const activeThemeId = localStorage.getItem('water-active-premium-theme');

            // Render inventory grid
            const themeCards = themes.map((theme: any) => {
                const isActive = theme.id === activeThemeId;
                const thumbnailUrl = theme.thumbnail_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3C/svg%3E';
                
                return `
                    <div style="
                        background: rgba(30, 30, 35, 0.95);
                        border-radius: 8px;
                        overflow: hidden;
                        border: 2px solid ${isActive ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.05)'};
                        transition: all 0.3s ease;
                        position: relative;
                    " onmouseover="this.style.borderColor='rgba(255, 105, 180, 0.5)'" onmouseout="this.style.borderColor='${isActive ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.05)'}'">
                        ${isActive ? '<div style="position: absolute; top: 10px; right: 10px; background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; z-index: 10;">ACTIVE</div>' : ''}
                        <div style="
                            width: 100%;
                            height: 150px;
                            background: linear-gradient(135deg, rgba(138, 43, 226, 0.2), rgba(255, 105, 180, 0.2));
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            overflow: hidden;
                        ">
                            <img src="${thumbnailUrl}" alt="${theme.name}" style="width: 100%; height: 100%; object-fit: cover;" />
                        </div>
                        <div style="padding: 15px;">
                            <div style="font-size: 16px; font-weight: 600; color: rgba(255, 255, 255, 0.9); margin-bottom: 5px;">
                                ${theme.name}
                            </div>
                            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.5); margin-bottom: 15px;">
                                By ${theme.author}
                            </div>
                            <button id="apply-inv-${theme.id}" style="
                                width: 100%;
                                background: ${isActive ? 'rgba(255, 255, 255, 0.1)' : '#ff69b4'};
                                color: white;
                                border: none;
                                padding: 10px;
                                border-radius: 4px;
                                cursor: ${isActive ? 'not-allowed' : 'pointer'};
                                font-size: 13px;
                                font-weight: 600;
                            " ${isActive ? 'disabled' : ''}>${isActive ? 'Currently Active' : 'Apply Theme'}</button>
                        </div>
                    </div>
                `;
            }).join('');

            content.innerHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px;">${themeCards}</div>`;

            // Attach event listeners using event delegation
            content.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const applyBtn = target.closest('[id^="apply-inv-"]');

                if (applyBtn && !applyBtn.hasAttribute('disabled')) {
                    const themeId = applyBtn.id.replace('apply-inv-', '');
                    this.applyThemeFromInventory(themeId);
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
