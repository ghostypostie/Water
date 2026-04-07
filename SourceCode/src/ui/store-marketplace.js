"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
const button_1 = __importDefault(require("../options/button"));
class StoreMarketplaceUI extends index_1.default {
    name = 'Marketplace';
    categories = [{
            name: '',
            options: []
        }];
    buttons = [
        new button_1.default(this.module, {
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
    constructor(module) {
        super(module);
    }
    async open() {
        let windowHolder = document.getElementById('windowHolder');
        let menuWindow = document.getElementById('menuWindow');
        if (!windowHolder || !menuWindow)
            return;
        windowHolder.className = 'popupWin';
        menuWindow.style.width = this.width + 'px';
        menuWindow.className = 'dark';
        menuWindow.innerHTML = '';
        if (this.name) {
            let header = document.createElement('div');
            header.id = 'referralHeader';
            header.textContent = this.name;
            menuWindow.append(header);
        }
        let holder = document.createElement('div');
        holder.id = 'settHolder';
        menuWindow.append(holder);
        // Add balance display
        const balanceContainer = document.createElement('div');
        balanceContainer.style.cssText = `
            padding: 15px 20px;
            background: linear-gradient(135deg, rgba(255, 105, 180, 0.1) 0%, rgba(138, 43, 226, 0.1) 100%);
            border-bottom: 2px solid rgba(255, 105, 180, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        `;
        balanceContainer.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff69b4" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
            </svg>
            <span style="color: rgba(255,255,255,0.7); font-size: 14px;">Balance:</span>
            <span id="pani-balance" style="color: #ff69b4; font-size: 16px; font-weight: 700;">Loading...</span>
            <span style="color: #ff69b4; font-size: 14px; font-weight: 600;">Pani</span>
        `;
        holder.appendChild(balanceContainer);
        // Add marketplace content
        const content = document.createElement('div');
        content.style.padding = '20px';
        content.style.textAlign = 'center';
        content.style.color = 'rgba(255,255,255,0.6)';
        content.innerHTML = `
            <p style="margin: 20px 0;">Browse available CSS themes</p>
            <p>Marketplace coming soon!</p>
            <p>You'll be able to browse, preview, and purchase CSS themes with Pani.</p>
        `;
        holder.appendChild(content);
        for (let button of this.buttons)
            menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
        // Load balance
        this.loadBalance();
    }
    async loadBalance() {
        const storeModule = this.module;
        const supabase = storeModule.supabase;
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
            // Get discord_id from user_profiles
            const { data: profileData } = await supabase
                .from('user_profiles')
                .select('discord_id')
                .eq('client_id', clientId);
            if (!profileData || profileData.length === 0 || !profileData[0].discord_id) {
                this.updateBalanceDisplay('0');
                return;
            }
            const discordId = profileData[0].discord_id;
            // Get balance (credits column = Pani)
            const { data: balanceData } = await supabase
                .from('user_balances')
                .select('credits')
                .eq('discord_id', discordId);
            if (balanceData && balanceData.length > 0) {
                const pani = balanceData[0].credits || 0;
                this.updateBalanceDisplay(pani.toLocaleString());
            }
            else {
                this.updateBalanceDisplay('0');
            }
        }
        catch (e) {
            console.error('[Marketplace] Failed to load balance:', e);
            this.updateBalanceDisplay('Error');
        }
    }
    updateBalanceDisplay(balance) {
        const balanceEl = document.getElementById('pani-balance');
        if (balanceEl) {
            balanceEl.textContent = balance;
        }
    }
}
exports.default = StoreMarketplaceUI;
