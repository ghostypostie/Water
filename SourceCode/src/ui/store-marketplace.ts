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

        const isLinked = await this.checkDiscordLinked();

        if (isLinked) {
            const balanceContainer = document.createElement('div');
            balanceContainer.style.cssText = 'padding: 6px 12px; background: rgba(255, 105, 180, 0.15); border-radius: 4px; display: inline-flex; align-items: center; gap: 5px; font-size: 13px; margin: 10px 20px; float: right;';
            balanceContainer.innerHTML = '<span id="pani-balance" style="color: #ff69b4; font-weight: 600;">Loading...</span><span style="color: rgba(255,255,255,0.7); font-size: 12px;">Pani</span>';
            holder.appendChild(balanceContainer);
            this.loadBalance();
        }

        const content = document.createElement('div');
        content.id = 'marketplace-content';
        content.style.padding = '20px';
        content.style.maxHeight = '500px';
        content.style.overflowY = 'auto';
        holder.appendChild(content);

        await this.loadItems(isLinked);

        for(let button of this.buttons) menuWindow.append(button.generateBig());
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
            // Fetch from premium_items table - ordered by created_at ascending (oldest first)
            const { data: items, error } = await supabase.from('premium_items').select('id, name, author, description, price, thumbnail_url, type, github_path').order('created_at', { ascending: true }).limit(50);
            if (error) throw error;
            
            if (!items || items.length === 0) { content.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); padding: 40px;"><p style="font-size: 18px; margin-bottom: 10px;">No items available yet</p><p style="font-size: 14px;">Check back soon for premium content!</p></div>'; return; }
            
            let userPurchases: string[] = [];
            
            // Check database purchases
            if (isLinked) {
                const clientId = localStorage.getItem('water_client_id');
                if (clientId) {
                    const { data: profileData } = await supabase.from('user_profiles').select('discord_id').eq('client_id', clientId).limit(1);
                    if (profileData && profileData.length > 0) {
                        const discordId = profileData[0].discord_id;
                        console.log('[Marketplace] Checking purchases for Discord ID:', discordId);
                        const { data: purchases } = await supabase.from('user_purchases').select('item_id').eq('discord_id', discordId);
                        console.log('[Marketplace] Raw purchases:', purchases);
                        if (purchases) { 
                            userPurchases = purchases.map((p: any) => p.item_id).filter(Boolean);
                            console.log('[Marketplace] Processed purchase IDs:', userPurchases);
                        }
                    }
                }
            }
            
            const itemCards = items.map(item => {
                let purchased = userPurchases.includes(item.id);
                
                console.log(`[Marketplace] Item ${item.id} (${item.name}) - Purchased: ${purchased}`);
                return this.renderItemCard(item, purchased, isLinked);
            }).join('');
            content.innerHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; padding: 10px;">' + itemCards + '</div>';
            
            content.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const buyBtn = target.closest('[id^="buy-item-"]');
                const applyBtn = target.closest('[id^="apply-item-"]');
                if (buyBtn) { const itemId = buyBtn.id.replace('buy-item-', ''); const item = items.find(t => t.id === itemId); if (item) this.purchaseItem(item); }
                else if (applyBtn) { const itemId = applyBtn.id.replace('apply-item-', ''); const item = items.find(t => t.id === itemId); if (item) this.applyItem(item); }
            });
        } catch (e) { console.error('[Marketplace] Failed to load items:', e); content.innerHTML = '<div style="text-align: center; color: rgba(255,100,100,0.8); padding: 40px;"><p>Failed to load marketplace</p></div>'; }
    }

    renderItemCard(item: any, isPurchased: boolean, isLinked: boolean): string {
        console.log(`[Marketplace] Rendering card for ${item.id} - isPurchased: ${isPurchased}`);
        
        // DEBUG: Log to help troubleshoot
        if (!isPurchased) {
            console.log(`[Marketplace] ${item.id} NOT marked as purchased - check console logs above for purchase detection`);
        }
        
        const thumbnailUrl = item.thumbnail_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3C/svg%3E';
        const typeColors: Record<string, string> = { 'css_theme': '#8a2be2', 'userscript': '#ff69b4', 'feature': '#00bfff' };
        const typeLabels: Record<string, string> = { 'css_theme': 'CSS THEME', 'userscript': 'SCRIPT', 'feature': 'FEATURE' };
        const typeColor = typeColors[item.type] || '#666';
        const typeLabel = typeLabels[item.type] || item.type;
        
        // PURCHASED overlay - covers entire card
        const purchasedOverlay = isPurchased 
            ? `<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; z-index: 100; border-radius: 12px;">
                <div style="font-size: 42px; font-weight: 900; color: #28a745; text-shadow: 0 0 30px rgba(40, 167, 69, 0.9); transform: rotate(-25deg); letter-spacing: 4px; text-transform: uppercase;">PURCHASED</div>
               </div>` 
            : '';
        
        console.log(`[Marketplace] Overlay HTML length for ${item.id}:`, purchasedOverlay.length);
        
        return `<div style="background: linear-gradient(145deg, rgba(30, 30, 35, 0.98), rgba(20, 20, 25, 0.98)); border-radius: 12px; overflow: hidden; border: 2px solid rgba(255, 255, 255, 0.08); position: relative; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column; height: 100%;">
            ${purchasedOverlay}
            <div style="width: 100%; height: 180px; background: linear-gradient(135deg, rgba(138, 43, 226, 0.25), rgba(255, 105, 180, 0.25)); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; border-bottom: 2px solid rgba(255, 255, 255, 0.05); flex-shrink: 0;">
                <img src="${thumbnailUrl}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;" />
                <div style="position: absolute; top: 12px; right: 12px; background: ${typeColor}; color: white; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);">${typeLabel}</div>
            </div>
            <div style="padding: 20px; display: flex; flex-direction: column; flex-grow: 1;">
                <div style="font-size: 20px; font-weight: 700; color: rgba(255, 255, 255, 0.95); margin-bottom: 8px; letter-spacing: 0.5px;">${item.name}</div>
                <div style="font-size: 13px; color: rgba(255, 255, 255, 0.5); margin-bottom: 12px; font-weight: 500;">By ${item.author}</div>
                <div style="font-size: 13px; color: rgba(255, 255, 255, 0.65); margin-bottom: 18px; line-height: 1.5; flex-grow: 1;">${item.description || ''}</div>
                <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 18px; border-top: 1px solid rgba(255, 255, 255, 0.08); margin-top: auto;">
                    <div style="font-size: 24px; font-weight: 800; color: #ff69b4;">${item.price} <span style="font-size: 14px; color: rgba(255,255,255,0.6); font-weight: 600;">Pani</span></div>
                    ${isPurchased 
                        ? `<button id="apply-item-${item.id}" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);">${item.type === 'css_theme' ? 'Apply' : 'Installed'}</button>` 
                        : isLinked 
                            ? `<button id="buy-item-${item.id}" style="background: linear-gradient(135deg, #ff69b4, #ff1493); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(255, 105, 180, 0.4);">Buy</button>` 
                            : `<button disabled style="background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); padding: 10px 20px; border-radius: 6px; cursor: not-allowed; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Link Discord</button>`}
                </div>
            </div>
        </div>`;
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
            
            // Don't save to local file - scripts are loaded from database only
            console.log('[Marketplace] Script downloaded successfully (stored in memory only)');
            console.log('[Marketplace] Script will be loaded from database when Discord is linked');
            
            return true;
        } catch (e) { 
            console.error('[Marketplace] Script download error:', e); 
            await this.showCustomAlert('Failed to install script. Please try again.'); 
            return false;
        }
    }

    async downloadCSSTheme(item: any, discordId: string): Promise<boolean> {
        try {
            console.log('[Marketplace] Starting CSS theme download for:', item.id, 'path:', item.github_path);
            const { fetchGitHubContent } = require('../utils/github');
            const result = await fetchGitHubContent(item.github_path);
            console.log('[Marketplace] GitHub fetch result:', result);
            if (!result.success || !result.content) { 
                console.error('[Marketplace] CSS theme download failed:', result.error); 
                await this.showCustomAlert('Failed to download theme. Please contact support.'); 
                return false; 
            }
            
            // Don't save to local file - themes are loaded from database only
            console.log('[Marketplace] Theme downloaded successfully (stored in memory only)');
            console.log('[Marketplace] Theme will be loaded from database when Discord is linked');
            
            return true;
        } catch (e) { 
            console.error('[Marketplace] CSS theme download error:', e); 
            await this.showCustomAlert('Failed to install theme. Please try again.'); 
            return false;
        }
    }

    async applyItem(item: any) {
        if (item.type === 'css_theme') { await this.applyPremiumTheme(item.id); }
        else if (item.type === 'userscript') { await this.showCustomAlert('Script installed! Enable it in Client Settings > Premium Scripts'); }
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
            
            // Add username variable if available
            const { data: profileData2 } = await supabase.from('user_profiles').select('discord_username').eq('discord_id', discordId);
            if (profileData2 && profileData2.length > 0 && profileData2[0].discord_username) { 
                const username = profileData2[0].discord_username; 
                cssContent = ':root { --username: "' + username + '"; }\n\n' + cssContent; 
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
