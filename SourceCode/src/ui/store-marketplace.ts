import UI from './index';
import Button from '../options/button';
import Store from '../modules/store';

export default class StoreMarketplaceUI extends UI {
    name = 'Marketplace';

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

        // Hide the default menuWindow completely
        menuWindow.style.display = 'none';

        // Create a completely separate marketplace container
        let marketplaceContainer = document.getElementById('water-marketplace-container');
        if (!marketplaceContainer) {
            marketplaceContainer = document.createElement('div');
            marketplaceContainer.id = 'water-marketplace-container';
            document.body.appendChild(marketplaceContainer);
        }

        // Style the marketplace container
        marketplaceContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 95vw;
            max-width: 1400px;
            height: 85vh;
            background: #0a0a0f;
            border-radius: 12px;
            border: 1px solid rgba(254, 139, 187, 0.3);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            z-index: 100000;
        `;

        marketplaceContainer.innerHTML = '';

        const isLinked = await this.checkDiscordLinked();

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            background: rgba(254, 139, 187, 0.08);
            padding: 20px 28px;
            border-bottom: 1px solid rgba(254, 139, 187, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        `;
        
        const titleSection = document.createElement('div');
        titleSection.innerHTML = `
            <h1 style="
                margin: 0;
                font-size: 26px;
                font-weight: 700;
                color: #fe8bbb;
            ">Water Store</h1>
            <p style="
                margin: 4px 0 0 0;
                font-size: 13px;
                color: rgba(255, 255, 255, 0.7);
            ">Featuring Themes, Scripts, & Other Features</p>
        `;
        
        header.appendChild(titleSection);

        if (isLinked) {
            const balanceContainer = document.createElement('div');
            balanceContainer.style.cssText = `
                background: rgba(254, 139, 187, 0.12);
                border: 1px solid rgba(254, 139, 187, 0.3);
                border-radius: 8px;
                padding: 10px 18px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            balanceContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 11px; color: rgba(255, 255, 255, 0.6); font-weight: 500;">BALANCE</span>
                    <span id="pani-balance" style="color: #fe8bbb; font-weight: 700; font-size: 18px;">Loading...</span>
                </div>
            `;
            header.appendChild(balanceContainer);
            this.loadBalance();
        }

        marketplaceContainer.appendChild(header);

        // Content area
        const content = document.createElement('div');
        content.id = 'marketplace-content';
        content.style.cssText = `
            padding: 24px;
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        `;
        
        // Scrollbar styling
        const style = document.createElement('style');
        style.id = 'marketplace-scrollbar-style';
        style.textContent = `
            #marketplace-content::-webkit-scrollbar {
                width: 10px;
            }
            #marketplace-content::-webkit-scrollbar-track {
                background: rgba(254, 139, 187, 0.08);
            }
            #marketplace-content::-webkit-scrollbar-thumb {
                background: rgba(254, 139, 187, 0.4);
                border-radius: 5px;
            }
            #marketplace-content::-webkit-scrollbar-thumb:hover {
                background: rgba(254, 139, 187, 0.6);
            }
        `;
        if (!document.getElementById('marketplace-scrollbar-style')) {
            document.head.appendChild(style);
        }
        
        marketplaceContainer.appendChild(content);

        await this.loadItems(isLinked);

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 16px 28px;
            border-top: 1px solid rgba(254, 139, 187, 0.2);
            display: flex;
            justify-content: center;
            flex-shrink: 0;
        `;
        
        // Define click-outside handler first
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if click is outside the marketplace container
            if (!marketplaceContainer.contains(target)) {
                // Close marketplace
                marketplaceContainer.remove();
                
                // Remove scrollbar style
                const scrollbarStyle = document.getElementById('marketplace-scrollbar-style');
                if (scrollbarStyle) scrollbarStyle.remove();
                
                // Show the original menuWindow
                menuWindow.style.display = '';
                
                // Remove this event listener
                document.removeEventListener('click', handleOutsideClick);
                
                // Prevent the click from propagating to close the settings window
                e.stopPropagation();
            }
        };
        
        const backButton = document.createElement('button');
        backButton.style.cssText = `
            background: rgba(254, 139, 187, 0.15);
            border: 1px solid rgba(254, 139, 187, 0.4);
            color: #fe8bbb;
            padding: 10px 28px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        `;
        backButton.textContent = 'BACK TO SETTINGS';
        backButton.onmouseover = () => {
            backButton.style.background = 'rgba(254, 139, 187, 0.25)';
        };
        backButton.onmouseout = () => {
            backButton.style.background = 'rgba(254, 139, 187, 0.15)';
        };
        backButton.onclick = () => {
            // Remove marketplace container
            const container = document.getElementById('water-marketplace-container');
            if (container) container.remove();
            
            // Remove scrollbar style
            const scrollbarStyle = document.getElementById('marketplace-scrollbar-style');
            if (scrollbarStyle) scrollbarStyle.remove();
            
            // Remove click-outside handler
            document.removeEventListener('click', handleOutsideClick);
            
            // Show the original menuWindow
            menuWindow.style.display = '';
            
            // Go back to settings
            window.showWindow?.(1);
        };
        
        footer.appendChild(backButton);
        marketplaceContainer.appendChild(footer);

        // Add click-outside handler after a short delay to prevent immediate closure
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 100);

        windowHolder.style.display = '';
    }

    async loadBalance() {
        const storeModule = this.module as Store;
        const supabase = (storeModule as any).supabase;
        if (!supabase) { this.updateBalanceDisplay('N/A'); return; }
        try {
            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) { this.updateBalanceDisplay('N/A'); return; }
            const { data: profileData } = await supabase.from('user_profiles').select('discord_id').eq('client_id', clientId);
            if (!profileData || profileData.length === 0 || !profileData[0].discord_id) { this.updateBalanceDisplay('0'); return; }
            const discordId = profileData[0].discord_id;
            const { data: balanceData } = await supabase.from('user_balances').select('credits').eq('discord_id', discordId);
            if (balanceData && balanceData.length > 0) { this.updateBalanceDisplay(balanceData[0].credits || 0); } else { this.updateBalanceDisplay('0'); }
        } catch (e) { console.error('[Marketplace] Failed to load balance:', e); this.updateBalanceDisplay('Error'); }
    }

    updateBalanceDisplay(balance: number | string) {
        const balanceEl = document.getElementById('pani-balance');
        if (balanceEl) { balanceEl.textContent = String(balance); }
    }

    async checkDiscordLinked(): Promise<boolean> {
        const storeModule = this.module as Store;
        const supabase = (storeModule as any).supabase;
        if (!supabase) return false;
        try {
            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) return false;
            const { data: profileData } = await supabase.from('user_profiles').select('discord_id').eq('client_id', clientId);
            return !!(profileData && profileData.length > 0 && profileData[0].discord_id);
        } catch (e) { console.error('[Marketplace] Failed to check Discord link:', e); return false; }
    }

    async loadItems(isLinked: boolean) {
        const content = document.getElementById('marketplace-content');
        if (!content) return;
        const storeModule = this.module as Store;
        const supabase = (storeModule as any).supabase;
        if (!supabase) { content.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); padding: 40px;"><p>Store system not available</p></div>'; return; }
        try {
            // Fetch from premium_items table - ordered by price (free first), then by created_at
            const { data: items, error } = await supabase.from('premium_items').select('id, name, author, description, price, thumbnail_url, type, github_path').order('price', { ascending: true }).order('created_at', { ascending: true }).limit(50);
            if (error) throw error;
            
            if (!items || items.length === 0) { 
                content.innerHTML = `
                    <div style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 80px 20px;
                        text-align: center;
                    ">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" style="opacity: 0.3; margin-bottom: 24px;">
                            <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" stroke="#fe8bbb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="#fe8bbb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <h2 style="
                            font-size: 24px;
                            font-weight: 700;
                            color: rgba(255, 255, 255, 0.9);
                            margin: 0 0 12px 0;
                        ">No Items Available</h2>
                        <p style="
                            font-size: 14px;
                            color: rgba(255, 255, 255, 0.5);
                            margin: 0;
                        ">Check back soon for premium content!</p>
                    </div>
                `; 
                return; 
            }
            
            let userPurchases: string[] = [];
            
            // Check database purchases
            if (isLinked) {
                const clientId = localStorage.getItem('water_client_id');
                if (clientId) {
                    const { data: profileData } = await supabase.from('user_profiles').select('discord_id').eq('client_id', clientId).limit(1);
                    if (profileData && profileData.length > 0) {
                        const discordId = profileData[0].discord_id;
                        const { data: purchases } = await supabase.from('user_purchases').select('item_id').eq('discord_id', discordId);
                        if (purchases) { 
                            userPurchases = purchases.map((p: any) => p.item_id).filter(Boolean);
                        }
                    }
                }
            }
            
            const itemCards = items.map(item => {
                let purchased = userPurchases.includes(item.id);
                return this.renderItemCard(item, purchased, isLinked);
            }).join('');
            
            content.innerHTML = `
                <div style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 20px;
                ">
                    ${itemCards}
                </div>
            `;
            
            content.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const buyBtn = target.closest('[id^="buy-item-"]');
                const applyBtn = target.closest('[id^="apply-item-"]');
                if (buyBtn) { const itemId = buyBtn.id.replace('buy-item-', ''); const item = items.find(t => t.id === itemId); if (item) this.purchaseItem(item); }
                else if (applyBtn) { const itemId = applyBtn.id.replace('apply-item-', ''); const item = items.find(t => t.id === itemId); if (item) this.applyItem(item); }
            });
        } catch (e) { 
            console.error('[Marketplace] Failed to load items:', e); 
            content.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 80px 20px;
                    text-align: center;
                ">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" style="opacity: 0.3; margin-bottom: 24px;">
                        <circle cx="12" cy="12" r="10" stroke="#fe8bbb" stroke-width="2"/>
                        <path d="M12 8V12" stroke="#fe8bbb" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1" fill="#fe8bbb"/>
                    </svg>
                    <h2 style="
                        font-size: 24px;
                        font-weight: 700;
                        color: rgba(255, 255, 255, 0.9);
                        margin: 0 0 12px 0;
                    ">Failed to Load Marketplace</h2>
                    <p style="
                        font-size: 14px;
                        color: rgba(255, 255, 255, 0.5);
                        margin: 0;
                    ">Please try again later</p>
                </div>
            `; 
        }
    }

    renderItemCard(item: any, isPurchased: boolean, isLinked: boolean): string {
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
                border: 1px solid rgba(254, 139, 187, 0.25);
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
                    
                    <!-- Description -->
                    <div style="
                        font-size: 13px;
                        color: rgba(255, 255, 255, 0.8);
                        line-height: 1.5;
                        flex-grow: 1;
                    ">${item.description || 'No description available'}</div>
                    
                    <!-- Footer -->
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 12px;
                        padding-top: 12px;
                        border-top: 1px solid rgba(254, 139, 187, 0.15);
                        margin-top: auto;
                    ">
                        <!-- Price -->
                        ${item.price === 0 
                            ? `<div style="
                                font-size: 22px;
                                font-weight: 800;
                                color: #4ade80;
                            ">FREE</div>`
                            : `<div style="
                                display: flex;
                                align-items: baseline;
                                gap: 6px;
                            ">
                                <span style="
                                    font-size: 22px;
                                    font-weight: 800;
                                    color: #fe8bbb;
                                ">${item.price}</span>
                                <span style="
                                    font-size: 12px;
                                    color: rgba(254, 139, 187, 0.7);
                                    font-weight: 600;
                                ">PANI</span>
                            </div>`
                        }
                        
                        <!-- Action button -->
                        ${isPurchased 
                            ? `<button id="apply-item-${item.id}" style="
                                background: #4ade80;
                                color: #000;
                                border: none;
                                padding: 9px 20px;
                                border-radius: 7px;
                                cursor: pointer;
                                font-size: 12px;
                                font-weight: 700;
                                letter-spacing: 0.3px;
                            " onmouseover="this.style.background='#22c55e'" onmouseout="this.style.background='#4ade80'">${item.type === 'css_theme' ? 'APPLY' : item.type === 'feature' ? 'DOWNLOAD' : 'OWNED'}</button>` 
                            : isLinked 
                                ? `<button id="buy-item-${item.id}" style="
                                    background: #fe8bbb;
                                    color: #fff;
                                    border: none;
                                    padding: 9px 20px;
                                    border-radius: 7px;
                                    cursor: pointer;
                                    font-size: 12px;
                                    font-weight: 700;
                                    letter-spacing: 0.3px;
                                " onmouseover="this.style.background='#ff6ba9'" onmouseout="this.style.background='#fe8bbb'">${item.price === 0 ? 'GET' : 'PURCHASE'}</button>` 
                                : `<button disabled style="
                                    background: rgba(255, 255, 255, 0.08);
                                    color: rgba(255, 255, 255, 0.4);
                                    border: 1px solid rgba(255, 255, 255, 0.15);
                                    padding: 9px 20px;
                                    border-radius: 7px;
                                    cursor: not-allowed;
                                    font-size: 12px;
                                    font-weight: 700;
                                    letter-spacing: 0.3px;
                                ">LINK DISCORD</button>`}
                    </div>
                </div>
            </div>
        `;
    }

    async purchaseItem(item: any) {
        const storeModule = this.module as Store;
        const supabase = (storeModule as any).supabase;
        if (!supabase) { await this.showCustomAlert('Store system not available'); return; }
        try {
            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) { await this.showCustomAlert('Client ID not found'); return; }
            const { data: profileData } = await supabase.from('user_profiles').select('discord_id').eq('client_id', clientId);
            if (!profileData || profileData.length === 0 || !profileData[0].discord_id) { await this.showCustomAlert('Please link your Discord account first'); return; }
            const discordId = profileData[0].discord_id;
            
            // Handle free items differently
            if (item.price === 0) {
                const confirmed = await this.showCustomConfirm('Get "' + item.name + '" for FREE?');
                if (!confirmed) return;
                
                // Download and install the item FIRST
                let downloadSuccess = false;
                if (item.type === 'userscript') { 
                    downloadSuccess = await this.downloadScript(item, discordId); 
                } else if (item.type === 'css_theme' && item.github_path) {
                    downloadSuccess = await this.downloadCSSTheme(item, discordId);
                } else if (item.type === 'feature' && item.github_path) {
                    downloadSuccess = await this.downloadResource(item, discordId);
                } else {
                    downloadSuccess = true;
                }
                
                if (!downloadSuccess) {
                    console.error('[Marketplace] Download failed, aborting');
                    return;
                }
                
                // Record the "purchase" (free item)
                const { error: purchaseError } = await supabase.from('user_purchases').insert({ discord_id: discordId, item_id: item.id, purchased_at: new Date().toISOString() });
                if (purchaseError) { 
                    console.error('[Marketplace] Failed to record free item:', purchaseError);
                    await this.showCustomAlert('Failed to claim item. Please try again.');
                    return;
                }
                
                // Show success screen
                this.showPurchaseSuccessScreen(item.name);
                const isLinked = await this.checkDiscordLinked();
                await this.loadItems(isLinked);
                return;
            }
            
            // Handle paid items
            const { data: balanceData } = await supabase.from('user_balances').select('credits').eq('discord_id', discordId);
            if (!balanceData || balanceData.length === 0) { await this.showCustomAlert('Balance not found'); return; }
            const currentBalance = balanceData[0].credits || 0;
            if (currentBalance < item.price) { await this.showCustomAlert('Insufficient Pani! You need ' + item.price + ' Pani but only have ' + currentBalance + ' Pani.'); return; }
            const confirmed = await this.showCustomConfirm('Purchase "' + item.name + '" for ' + item.price + ' Pani?');
            if (!confirmed) return;
            
            // Download and install the item FIRST before deducting balance
            let downloadSuccess = false;
            if (item.type === 'userscript') { 
                downloadSuccess = await this.downloadScript(item, discordId); 
            } else if (item.type === 'css_theme' && item.github_path) {
                downloadSuccess = await this.downloadCSSTheme(item, discordId);
            } else if (item.type === 'feature' && item.github_path) {
                downloadSuccess = await this.downloadResource(item, discordId);
            } else {
                downloadSuccess = true; // No download needed for other types
            }
            
            // Only proceed with payment if download succeeded
            if (!downloadSuccess) {
                console.error('[Marketplace] Download failed, aborting purchase');
                return;
            }
            
            // Now deduct balance and record purchase
            const { error: balanceError } = await supabase.from('user_balances').update({ credits: currentBalance - item.price }).eq('discord_id', discordId);
            if (balanceError) {
                console.error('[Marketplace] Failed to deduct balance:', balanceError);
                await this.showCustomAlert('Payment processing failed. Please contact support.');
                return;
            }
            
            // Insert purchase record
            const { error: purchaseError } = await supabase.from('user_purchases').insert({ discord_id: discordId, item_id: item.id, purchased_at: new Date().toISOString() });
            if (purchaseError) { 
                // Refund the balance if purchase record fails
                await supabase.from('user_balances').update({ credits: currentBalance }).eq('discord_id', discordId); 
                console.error('[Marketplace] Failed to record purchase:', purchaseError);
                await this.showCustomAlert('Purchase recording failed. Your balance has been refunded.');
                return;
            }
            
            // Show success screen
            this.showPurchaseSuccessScreen(item.name);
            const isLinked = await this.checkDiscordLinked();
            await this.loadItems(isLinked);
            this.loadBalance();
        } catch (e) { console.error('[Marketplace] Purchase failed:', e); await this.showCustomAlert('Purchase failed. Please try again.'); }
    }

    async downloadScript(item: any, discordId: string): Promise<boolean> {
        try {
            const { fetchGitHubContent } = require('../utils/github');
            const result = await fetchGitHubContent(item.github_path);
            if (!result.success || !result.content) { 
                console.error('[Marketplace] Script download failed:', result.error); 
                await this.showCustomAlert('Failed to download script. Please contact support.'); 
                return false; 
            }
            
            // Scripts are loaded from database only - no local file saving
            console.log('[Marketplace] Script downloaded successfully (database only)');
            return true;
        } catch (e) { 
            console.error('[Marketplace] Script download error:', e); 
            await this.showCustomAlert('Failed to install script. Please try again.'); 
            return false;
        }
    }

    async downloadCSSTheme(item: any, discordId: string): Promise<boolean> {
        try {
            const { fetchGitHubContent } = require('../utils/github');
            const result = await fetchGitHubContent(item.github_path);
            if (!result.success || !result.content) { 
                console.error('[Marketplace] CSS theme download failed:', result.error); 
                await this.showCustomAlert('Failed to download theme. Please contact support.'); 
                return false; 
            }
            
            // Don't save to local file - themes are loaded from database only
            return true;
        } catch (e) { 
            console.error('[Marketplace] CSS theme download error:', e); 
            await this.showCustomAlert('Failed to install theme. Please try again.'); 
            return false;
        }
    }

    async downloadResource(item: any, discordId: string): Promise<boolean> {
        try {
            const { fetchGitHubContent } = require('../utils/github');
            const { getSwapPath } = require('../utils/paths');
            const { writeFileSync, mkdirSync, existsSync } = require('fs');
            const { join, dirname } = require('path');
            
            // Fetch the file from GitHub
            const result = await fetchGitHubContent(item.github_path);
            if (!result.success || !result.content) { 
                console.error('[Marketplace] Resource download failed:', result.error); 
                await this.showCustomAlert('Failed to download resource. Please contact support.'); 
                return false; 
            }
            
            // Get the Swap folder path
            const swapPath = getSwapPath();
            
            // Determine target path
            const fileName = item.github_path.split('/').pop();
            let targetPath = item.metadata?.target_path || fileName;
            
            // ADDITION: Special handling for sound files
            if (fileName.startsWith('headshot_') && fileName.endsWith('.mp3')) {
                targetPath = `sound/${fileName}`;
            }
            
            const fullPath = join(swapPath, targetPath);
            
            // Create directory if it doesn't exist
            const dir = dirname(fullPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            
            // Write the file (handle both text and binary)
            // GitHub API returns base64-encoded content for binary files
            if (result.content.startsWith('data:')) {
                // Base64 data URL
                const base64Data = result.content.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                writeFileSync(fullPath, buffer);
            } else {
                // GitHub API returns base64 string directly for binary files
                // Try to decode as base64 first
                try {
                    const buffer = Buffer.from(result.content, 'base64');
                    writeFileSync(fullPath, buffer);
                } catch (e) {
                    // If base64 decode fails, write as text
                    writeFileSync(fullPath, result.content);
                }
            }
            
            console.log('[Marketplace] Resource installed to:', fullPath);
            await this.showCustomAlert('Resource installed successfully! File saved to: ' + targetPath);
            return true;
        } catch (e) { 
            console.error('[Marketplace] Resource download error:', e); 
            await this.showCustomAlert('Failed to install resource. Please try again.'); 
            return false;
        }
    }

    async applyItem(item: any) {
        if (item.type === 'css_theme') { 
            await this.applyPremiumTheme(item.id); 
        } else if (item.type === 'userscript') { 
            await this.showCustomAlert('Script installed! Enable it in Client Settings > Premium Scripts'); 
        } else if (item.type === 'feature') {
            // Re-download the feature item
            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) { await this.showCustomAlert('Client ID not found'); return; }
            
            const storeModule = this.module as Store;
            const supabase = (storeModule as any).supabase;
            if (!supabase) { await this.showCustomAlert('Store system not available'); return; }
            
            const { data: profileData } = await supabase.from('user_profiles').select('discord_id').eq('client_id', clientId);
            if (!profileData || profileData.length === 0 || !profileData[0].discord_id) { 
                await this.showCustomAlert('Please link your Discord account first'); 
                return; 
            }
            const discordId = profileData[0].discord_id;
            
            const downloadSuccess = await this.downloadResource(item, discordId);
            if (!downloadSuccess) {
                await this.showCustomAlert('Download failed. Please try again.');
            }
        }
    }

    async applyPremiumTheme(themeId: string) {
        const storeModule = this.module as Store;
        const supabase = (storeModule as any).supabase;
        if (!supabase) { await this.showCustomAlert('Store system not available'); return; }
        try {
            const clientId = localStorage.getItem('water_client_id');
            if (!clientId) { await this.showCustomAlert('Client ID not found'); return; }
            const { data: profileData } = await supabase.from('user_profiles').select('discord_id').eq('client_id', clientId);
            if (!profileData || profileData.length === 0 || !profileData[0].discord_id) { await this.showCustomAlert('Please link your Discord account first'); return; }
            const discordId = profileData[0].discord_id;
            
            // Check purchase
            const { data: purchaseData } = await supabase.from('user_purchases').select('*').eq('discord_id', discordId).eq('item_id', themeId);
            if (!purchaseData || purchaseData.length === 0) { await this.showCustomAlert('You have not purchased this theme'); return; }
            
            // Get theme info from database
            const { data: themeData } = await supabase.from('premium_items').select('github_path').eq('id', themeId).limit(1);
            if (!themeData || themeData.length === 0) { await this.showCustomAlert('Theme not found'); return; }
            
            // Fetch CSS from GitHub
            const { fetchGitHubContent } = require('../utils/github');
            const result = await fetchGitHubContent(themeData[0].github_path);
            if (!result.success || !result.content) { 
                await this.showCustomAlert('Failed to load theme from server'); 
                return; 
            }
            
            let cssContent = result.content;
            
            // Add CSS variables for theme customization
            try {
                const { data: profileData2 } = await supabase.from('user_profiles').select('discord_username, discord_id').eq('discord_id', discordId).limit(1);
                
                let cssVars = ':root {\n';
                let hasVars = false;
                
                if (profileData2 && profileData2.length > 0) {
                    // Add username variable
                    if (profileData2[0].discord_username) {
                        cssVars += `  --username: "${profileData2[0].discord_username}";\n`;
                        cssVars += `  --discord-username: "${profileData2[0].discord_username}";\n`;
                        hasVars = true;
                    }
                    
                    // Add discord ID (last 4 digits as discriminator)
                    if (profileData2[0].discord_id) {
                        const discrim = profileData2[0].discord_id.slice(-4);
                        cssVars += `  --discord-id: "${profileData2[0].discord_id}";\n`;
                        cssVars += `  --discord-discriminator: "${discrim}";\n`;
                        hasVars = true;
                    }
                }
                
                // Add client ID
                if (clientId) {
                    cssVars += `  --client-id: "${clientId}";\n`;
                    hasVars = true;
                }
                
                cssVars += '}\n\n';
                
                // Prepend variables to CSS if any were added
                if (hasVars) {
                    cssContent = cssVars + cssContent;
                }
            } catch (e) {
                console.error('[Marketplace] Failed to inject CSS variables:', e);
                // Continue anyway - theme will work without variables
            }
            
            // Apply CSS
            const existingStyle = document.getElementById('water-premium-theme');
            if (existingStyle) existingStyle.remove();
            const style = document.createElement('style');
            style.id = 'water-premium-theme';
            style.textContent = cssContent;
            document.head.appendChild(style);
            localStorage.setItem('water-active-premium-theme', themeId);
            await this.showCustomAlert('Theme applied successfully!');
        } catch (e) { console.error('[Marketplace] Failed to apply theme:', e); await this.showCustomAlert('Failed to apply theme. Please try again.'); }
    }

    showCustomConfirm(message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 999998; display: flex; align-items: center; justify-content: center; pointer-events: auto;';
            const popup = document.createElement('div');
            popup.style.cssText = 'pointer-events: auto; border-radius: 10px; background-color: rgba(0, 0, 0, 0.95); padding: 20px; text-align: center; color: #fff; width: 400px; border: 2px solid rgba(255, 105, 180, 0.6);';
            popup.innerHTML = '<div style="font-size: 16px; margin-bottom: 20px; line-height: 1.5; color: #ffffff;">' + message + '</div><div style="display: flex; gap: 10px; justify-content: center;"><button id="confirmYes" style="background: #ff69b4; color: white; border: none; padding: 10px 30px; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 600;">YES</button><button id="confirmNo" style="background: rgba(255, 255, 255, 0.2); color: white; border: none; padding: 10px 30px; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 600;">NO</button></div>';
            overlay.appendChild(popup);
            document.body.appendChild(overlay);
            const cleanup = () => overlay.remove();
            document.getElementById('confirmYes')!.onclick = () => { cleanup(); resolve(true); };
            document.getElementById('confirmNo')!.onclick = () => { cleanup(); resolve(false); };
        });
    }

    showCustomAlert(message: string): Promise<void> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 999998; display: flex; align-items: center; justify-content: center; pointer-events: auto;';
            const popup = document.createElement('div');
            popup.style.cssText = 'pointer-events: auto; border-radius: 10px; background-color: rgba(0, 0, 0, 0.95); padding: 20px; text-align: center; color: #fff; width: 400px; border: 2px solid rgba(255, 105, 180, 0.6);';
            popup.innerHTML = '<div style="font-size: 16px; margin-bottom: 20px; line-height: 1.5; color: #ffffff;">' + message + '</div><button id="alertOk" style="background: #ff69b4; color: white; border: none; padding: 10px 40px; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 600;">OK</button>';
            overlay.appendChild(popup);
            document.body.appendChild(overlay);
            document.getElementById('alertOk')!.onclick = () => { overlay.remove(); resolve(); };
        });
    }

    showPurchaseSuccessScreen(itemName: string) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #ff69b4 0%, #ff1493 50%, #c71585 100%); z-index: 999999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: auto;';
        overlay.innerHTML = '<div style="text-align: center; transform: scale(0.9); opacity: 0; transition: transform 0.4s ease-out, opacity 0.4s ease-out;"><div style="font-size: 72px; font-weight: 900; color: #ffffff; margin-bottom: 40px; text-shadow: 0 0 40px rgba(255,255,255,0.3); letter-spacing: 3px;">PURCHASE COMPLETE</div><div style="font-size: 48px; color: #ffffff; font-weight: 600; opacity: 0.95; margin-bottom: 20px;">Unlocked</div><div style="font-size: 56px; color: #ffd700; font-weight: 700; text-shadow: 0 0 30px rgba(255,215,0,0.5);">' + itemName + '</div></div>';
        document.body.appendChild(overlay);
        requestAnimationFrame(() => { overlay.style.transition = 'opacity 0.4s ease-out'; overlay.style.opacity = '1'; const content = overlay.firstElementChild as HTMLElement; if (content) { content.style.transform = 'scale(1)'; content.style.opacity = '1'; } });
        setTimeout(() => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 400); }, 3000);
    }
}
