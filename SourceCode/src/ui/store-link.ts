import UI from './index';
import Button from '../options/button';
import Store from '../modules/store';

export default class StoreLinkUI extends UI {
    name = 'Link Discord Account';

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

    private codeDisplay: HTMLElement | null = null;
    private countdownInterval: number | null = null;

    constructor(module: Store) {
        super(module);
    }

    open() {
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

        // Add link content
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 30px 50px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 300px;
        `;
        
        const instructions = document.createElement('div');
        instructions.style.cssText = `
            text-align: center;
            margin-bottom: 30px;
            max-width: 600px;
        `;
        instructions.innerHTML = `
            <div style="font-size: 15px; color: rgba(255,255,255,0.8); margin-bottom: 8px;">
                Link your Discord account to access the Water Store
            </div>
            <div style="font-size: 13px; color: rgba(255,255,255,0.5);">
                Generate a code and use <span style="color: #ff69b4;">!link CODE</span> in Discord
            </div>
        `;
        content.appendChild(instructions);

        // Code display area
        this.codeDisplay = document.createElement('div');
        this.codeDisplay.style.cssText = `
            background: linear-gradient(135deg, rgba(255, 105, 180, 0.08) 0%, rgba(138, 43, 226, 0.08) 100%);
            border: 2px solid rgba(255, 105, 180, 0.25);
            border-radius: 12px;
            padding: 30px 40px;
            width: 100%;
            max-width: 550px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            margin-bottom: 25px;
        `;
        this.codeDisplay.innerHTML = `
            <div style="color: rgba(255, 105, 180, 0.4); font-size: 14px; margin-bottom: 8px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 105, 180, 0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            </div>
            <div style="color: rgba(255,255,255,0.5); font-size: 14px;">No code generated</div>
            <div style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 8px;">Click below to generate</div>
        `;
        content.appendChild(this.codeDisplay);

        // Generate button
        const generateBtn = document.createElement('div');
        generateBtn.className = 'settingsBtn';
        generateBtn.textContent = 'Generate Link Code';
        generateBtn.style.cssText = `
            width: 280px;
            padding: 12px 28px;
            background: linear-gradient(135deg, #ff69b4 0%, #ff85c1 100%);
            color: #fff;
            font-weight: 600;
            font-size: 14px;
            transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
            box-shadow: 0 4px 16px rgba(255, 105, 180, 0.3);
            cursor: pointer;
        `;
        generateBtn.onmouseover = () => {
            generateBtn.style.transform = 'translateY(-2px)';
            generateBtn.style.boxShadow = '0 6px 24px rgba(255, 105, 180, 0.45)';
        };
        generateBtn.onmouseout = () => {
            generateBtn.style.transform = 'translateY(0)';
            generateBtn.style.boxShadow = '0 4px 16px rgba(255, 105, 180, 0.3)';
        };
        generateBtn.onclick = () => this.generateCode();
        content.appendChild(generateBtn);

        holder.appendChild(content);

        for(let button of this.buttons) menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }

    async generateCode() {
        const storeModule = this.module as Store;
        const result = await storeModule.generateLinkCode();
        
        // Clear any existing countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        if (result.success && this.codeDisplay && result.expiresAt) {
            this.codeDisplay.style.background = 'linear-gradient(135deg, rgba(255, 105, 180, 0.15) 0%, rgba(138, 43, 226, 0.15) 100%)';
            this.codeDisplay.style.borderColor = 'rgba(255, 105, 180, 0.5)';
            
            const updateCountdown = () => {
                const now = Date.now();
                const timeLeft = result.expiresAt! - now;
                
                if (timeLeft <= 0) {
                    if (this.countdownInterval) {
                        clearInterval(this.countdownInterval);
                        this.countdownInterval = null;
                    }
                    if (this.codeDisplay) {
                        this.codeDisplay.style.background = 'linear-gradient(135deg, rgba(255, 100, 100, 0.12) 0%, rgba(200, 50, 50, 0.12) 100%)';
                        this.codeDisplay.style.borderColor = 'rgba(255, 100, 100, 0.4)';
                        this.codeDisplay.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,120,120,0.9)" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                <div style="color: rgba(255,120,120,0.9); font-size: 14px; font-weight: 500;">Code expired - Generate a new one</div>
                            </div>
                        `;
                    }
                    return;
                }
                
                const minutes = Math.floor(timeLeft / 60000);
                const seconds = Math.floor((timeLeft % 60000) / 1000);
                const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                const countdownEl = document.getElementById('code-countdown');
                if (countdownEl) {
                    countdownEl.textContent = timeString;
                }
            };
            
            this.codeDisplay.innerHTML = `
                <div style="text-align: center; width: 100%;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 6px 16px; border-radius: 16px; margin-bottom: 20px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff69b4" stroke-width="2.5">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span style="font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 600; letter-spacing: 0.5px;">CODE GENERATED</span>
                    </div>

                    <div style="margin: 20px auto; max-width: 400px;">
                        <div style="background: rgba(0,0,0,0.4); padding: 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,105,180,0.7)" stroke-width="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                    <span style="font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">Discord</span>
                                </div>
                                <div id="copy-btn" style="cursor: pointer; padding: 5px; background: rgba(255, 105, 180, 0.15); border: 1px solid rgba(255, 105, 180, 0.3); border-radius: 5px; transition: all 0.2s ease-out; display: flex; align-items: center;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 105, 180, 0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </div>
                            </div>
                            <div style="color: #fff; font-size: 16px; font-weight: 600; padding: 10px 14px; background: rgba(0,0,0,0.4); border-radius: 6px;">
                                !link ${result.code}
                            </div>
                        </div>
                    </div>

                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,105,180,0.7)" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span style="color: rgba(255,255,255,0.6); font-size: 12px;">
                            Expires in <span id="code-countdown" style="color: #ff69b4; font-weight: 700;">5:00</span>
                        </span>
                    </div>
                </div>
                
                <style>
                    @keyframes glow {
                        from { text-shadow: 0 0 30px rgba(255, 105, 180, 0.5); }
                        to { text-shadow: 0 0 40px rgba(255, 105, 180, 0.7); }
                    }
                </style>
            `;
            
            // Add copy button functionality
            const copyBtn = document.getElementById('copy-btn');
            if (copyBtn) {
                copyBtn.onmouseover = () => {
                    copyBtn.style.background = 'rgba(255, 105, 180, 0.25)';
                    copyBtn.style.borderColor = 'rgba(255, 105, 180, 0.5)';
                    copyBtn.style.transform = 'scale(1.1)';
                };
                copyBtn.onmouseout = () => {
                    copyBtn.style.background = 'rgba(255, 105, 180, 0.15)';
                    copyBtn.style.borderColor = 'rgba(255, 105, 180, 0.3)';
                    copyBtn.style.transform = 'scale(1)';
                };
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(`!link ${result.code}`).then(() => {
                        copyBtn.innerHTML = `
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(100, 255, 100, 0.9)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        `;
                        copyBtn.style.background = 'rgba(100, 255, 100, 0.2)';
                        copyBtn.style.borderColor = 'rgba(100, 255, 100, 0.4)';
                        setTimeout(() => {
                            copyBtn.innerHTML = `
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 105, 180, 0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            `;
                            copyBtn.style.background = 'rgba(255, 105, 180, 0.15)';
                            copyBtn.style.borderColor = 'rgba(255, 105, 180, 0.3)';
                        }, 2000);
                    });
                };
            }
            
            // Start countdown
            updateCountdown();
            this.countdownInterval = window.setInterval(updateCountdown, 1000);
            
        } else if (this.codeDisplay) {
            this.codeDisplay.style.background = 'linear-gradient(135deg, rgba(255, 100, 100, 0.12) 0%, rgba(200, 50, 50, 0.12) 100%)';
            this.codeDisplay.style.borderColor = 'rgba(255, 100, 100, 0.4)';
            this.codeDisplay.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,120,120,0.9)" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <div style="color: rgba(255,120,120,0.9); font-size: 14px; font-weight: 500;">${result.message}</div>
                </div>
            `;
        }
    }
}
