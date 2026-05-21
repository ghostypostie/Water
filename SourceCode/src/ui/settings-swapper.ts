import UI from './index';
import Button from '../options/button';
import SettingsSwapper from '../modules/settings-swapper';
import config from '../config';

interface SettingsProfile {
    name: string;
    color: string;
    settings: string;
}

export default class SettingsSwapperUI extends UI {
    name = 'Settings Swapper';
    width = 900;
    categories = [];
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

    constructor(module: SettingsSwapper) {
        super(module);
    }

    open() {
        let windowHolder = document.getElementById('windowHolder');
        let menuWindow = document.getElementById('menuWindow');

        if (!windowHolder || !menuWindow) return;

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
        holder.style.padding = '20px';
        menuWindow.append(holder);

        this.renderProfiles(holder);

        for (let button of this.buttons) menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }

    private renderProfiles(holder: HTMLElement) {
        const profiles = this.getProfiles();

        // Profiles List
        const profilesList = document.createElement('div');
        profilesList.id = 'settingsProfilesList';
        profilesList.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

        if (profiles.length === 0) {
            const emptyContainer = document.createElement('div');
            emptyContainer.style.cssText = 'text-align: center; padding: 40px;';
            
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 20px;';
            emptyMsg.textContent = 'No settings profiles yet.';
            
            // Button container
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center;';
            
            // Add Profile Button (centered, same alignment as text)
            const addButton = document.createElement('button');
            addButton.className = 'settingsBtn';
            addButton.textContent = '+';
            addButton.style.cssText = `
                background: rgba(255, 20, 147, 0.15);
                border: 1px solid #FF1493;
                color: #FFE5FA;
                padding: 12px 24px;
                cursor: pointer;
                border-radius: 4px;
                font-weight: bold;
                font-size: 20px;
                transition: none;
            `;
            addButton.onmouseenter = () => {
                addButton.style.background = 'rgba(255, 20, 147, 0.25)';
            };
            addButton.onmouseleave = () => {
                addButton.style.background = 'rgba(255, 20, 147, 0.15)';
            };
            addButton.onclick = () => {
                this.showAddProfileDialog();
            };
            
            // Save Current Settings Button
            const saveCurrentButton = document.createElement('button');
            saveCurrentButton.className = 'settingsBtn';
            saveCurrentButton.textContent = 'Save Current Settings';
            saveCurrentButton.style.cssText = `
                background: rgba(100, 200, 100, 0.15);
                border: 1px solid rgba(100, 200, 100, 0.6);
                color: #E5FFE5;
                padding: 12px 24px;
                cursor: pointer;
                border-radius: 4px;
                font-weight: bold;
                font-size: 14px;
                transition: none;
            `;
            saveCurrentButton.onmouseenter = () => {
                saveCurrentButton.style.background = 'rgba(100, 200, 100, 0.25)';
            };
            saveCurrentButton.onmouseleave = () => {
                saveCurrentButton.style.background = 'rgba(100, 200, 100, 0.15)';
            };
            saveCurrentButton.onclick = () => {
                this.showSaveCurrentSettingsDialog();
            };
            
            buttonContainer.appendChild(addButton);
            buttonContainer.appendChild(saveCurrentButton);
            
            emptyContainer.appendChild(emptyMsg);
            emptyContainer.appendChild(buttonContainer);
            profilesList.appendChild(emptyContainer);
        } else {
            // Button container for top buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
            
            // Add Profile Button (top when profiles exist)
            const addButton = document.createElement('button');
            addButton.className = 'settingsBtn';
            addButton.textContent = '+';
            addButton.style.cssText = `
                background: rgba(255, 20, 147, 0.15);
                border: 1px solid #FF1493;
                color: #FFE5FA;
                padding: 12px;
                text-align: center;
                cursor: pointer;
                border-radius: 4px;
                font-weight: bold;
                font-size: 20px;
                transition: none;
                flex: 0 0 auto;
            `;
            addButton.onmouseenter = () => {
                addButton.style.background = 'rgba(255, 20, 147, 0.25)';
            };
            addButton.onmouseleave = () => {
                addButton.style.background = 'rgba(255, 20, 147, 0.15)';
            };
            addButton.onclick = () => {
                this.showAddProfileDialog();
            };
            
            // Save Current Settings Button
            const saveCurrentButton = document.createElement('button');
            saveCurrentButton.className = 'settingsBtn';
            saveCurrentButton.textContent = 'Save Current Settings';
            saveCurrentButton.style.cssText = `
                background: rgba(100, 200, 100, 0.15);
                border: 1px solid rgba(100, 200, 100, 0.6);
                color: #E5FFE5;
                padding: 12px 20px;
                cursor: pointer;
                border-radius: 4px;
                font-weight: bold;
                font-size: 14px;
                transition: none;
                flex: 1;
            `;
            saveCurrentButton.onmouseenter = () => {
                saveCurrentButton.style.background = 'rgba(100, 200, 100, 0.25)';
            };
            saveCurrentButton.onmouseleave = () => {
                saveCurrentButton.style.background = 'rgba(100, 200, 100, 0.15)';
            };
            saveCurrentButton.onclick = () => {
                this.showSaveCurrentSettingsDialog();
            };
            
            buttonContainer.appendChild(addButton);
            buttonContainer.appendChild(saveCurrentButton);
            profilesList.appendChild(buttonContainer);
            
            profiles.forEach((profile, index) => {
                const profileCard = this.createProfileCard(profile, index);
                profilesList.appendChild(profileCard);
            });
        }

        holder.appendChild(profilesList);
    }

    private showSaveCurrentSettingsDialog() {
        // Get current settings using exportSettings
        let currentSettings = '';
        try {
            if (typeof (window as any).exportSettings === 'function') {
                currentSettings = (window as any).exportSettings(1);
            } else {
                alert('Unable to export current settings. Please make sure you are in-game.');
                return;
            }
        } catch (err) {
            alert('Failed to export current settings!');
            return;
        }

        // Create modal with maximum z-index
        const modal = document.createElement('div');
        modal.id = 'settingsSwapperModal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 30, 0, 0.85) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999999 !important;
            pointer-events: all !important;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: rgba(0, 80, 0, 0.98) !important;
            border: 2px solid #64C864 !important;
            border-radius: 8px !important;
            padding: 25px !important;
            width: 500px !important;
            max-width: 90vw !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
            position: relative !important;
            z-index: 1000000000 !important;
        `;
        
        content.innerHTML = `
            <h3 style="color: #E5FFE5; margin: 0 0 20px 0; font-size: 18px; font-weight: bold;">Save Current Settings</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="color: rgba(200, 255, 200, 0.8); font-size: 13px; display: block; margin-bottom: 5px;">Profile Name:</label>
                <input type="text" id="profileName" placeholder="e.g., My Current Setup" style="width: 100%; padding: 8px; background: rgba(0, 40, 0, 0.6); border: 1px solid rgba(100, 200, 100, 0.3); color: #E5FFE5; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="color: rgba(200, 255, 200, 0.8); font-size: 13px; display: block; margin-bottom: 5px;">Color (hex):</label>
                <input type="text" id="profileColor" value="#64C864" placeholder="#64C864" style="width: 100%; padding: 8px; background: rgba(0, 40, 0, 0.6); border: 1px solid rgba(100, 200, 100, 0.3); color: #E5FFE5; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="color: rgba(200, 255, 200, 0.8); font-size: 13px; display: block; margin-bottom: 5px;">Current Settings (auto-captured):</label>
                <textarea id="profileSettings" readonly style="width: 100%; height: 100px; padding: 8px; background: rgba(0, 40, 0, 0.4); border: 1px solid rgba(100, 200, 100, 0.3); color: rgba(200, 255, 200, 0.6); border-radius: 4px; font-size: 13px; resize: vertical; font-family: monospace; box-sizing: border-box;">${currentSettings}</textarea>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 10px 20px; background: rgba(0, 100, 0, 0.3); border: 1px solid rgba(100, 200, 100, 0.4); color: #fff; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                <button id="saveBtn" style="padding: 10px 20px; background: rgba(100, 200, 100, 0.25); border: 1px solid rgba(100, 200, 100, 0.8); color: #E5FFE5; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">Save Profile</button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Focus first input
        setTimeout(() => {
            const input = document.getElementById('profileName') as HTMLInputElement;
            if (input) {
                input.focus();
            }
        }, 100);
        
        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
        
        // Handle buttons
        const cancelBtn = document.getElementById('cancelBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
            };
        }
        
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = (document.getElementById('profileName') as HTMLInputElement).value.trim();
                const color = (document.getElementById('profileColor') as HTMLInputElement).value.trim();
                const settings = (document.getElementById('profileSettings') as HTMLTextAreaElement).value.trim();
                
                if (!name) {
                    alert('Please enter a profile name');
                    return;
                }
                
                if (!color) {
                    alert('Please enter a color');
                    return;
                }
                
                if (!settings) {
                    alert('No settings data captured');
                    return;
                }
                
                const profiles = this.getProfiles();
                profiles.push({ name, color, settings });
                this.saveProfiles(profiles);
                
                document.body.removeChild(modal);
                this.refreshUI();
                
                alert(`Profile "${name}" saved successfully!`);
            };
        }
    }

    private showAddProfileDialog() {
        // Create modal with maximum z-index
        const modal = document.createElement('div');
        modal.id = 'settingsSwapperModal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.85) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999999 !important;
            pointer-events: all !important;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: rgba(26, 2, 17, 0.98) !important;
            border: 2px solid #FF1493 !important;
            border-radius: 8px !important;
            padding: 25px !important;
            width: 500px !important;
            max-width: 90vw !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
            position: relative !important;
            z-index: 1000000000 !important;
        `;
        
        content.innerHTML = `
            <h3 style="color: #FFE5FA; margin: 0 0 20px 0; font-size: 18px; font-weight: bold;">Add Settings Profile</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="color: rgba(240, 196, 230, 0.8); font-size: 13px; display: block; margin-bottom: 5px;">Profile Name:</label>
                <input type="text" id="profileName" placeholder="e.g., Competitive" style="width: 100%; padding: 8px; background: rgba(26, 2, 17, 0.6); border: 1px solid rgba(255, 20, 147, 0.3); color: #FFE5FA; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="color: rgba(240, 196, 230, 0.8); font-size: 13px; display: block; margin-bottom: 5px;">Color (hex):</label>
                <input type="text" id="profileColor" value="#FF1493" placeholder="#FF1493" style="width: 100%; padding: 8px; background: rgba(26, 2, 17, 0.6); border: 1px solid rgba(255, 20, 147, 0.3); color: #FFE5FA; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="color: rgba(240, 196, 230, 0.8); font-size: 13px; display: block; margin-bottom: 5px;">Krunker Settings String:</label>
                <textarea id="profileSettings" placeholder="Paste your Krunker settings here..." style="width: 100%; height: 100px; padding: 8px; background: rgba(26, 2, 17, 0.6); border: 1px solid rgba(255, 20, 147, 0.3); color: #FFE5FA; border-radius: 4px; font-size: 13px; resize: vertical; font-family: monospace; box-sizing: border-box;"></textarea>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 10px 20px; background: rgba(200, 0, 0, 0.15); border: 1px solid rgba(200, 0, 0, 0.4); color: #fff; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                <button id="saveBtn" style="padding: 10px 20px; background: rgba(255, 20, 147, 0.15); border: 1px solid #FF1493; color: #FFE5FA; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">Save Profile</button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Focus first input
        setTimeout(() => {
            const input = document.getElementById('profileName') as HTMLInputElement;
            if (input) {
                input.focus();
            }
        }, 100);
        
        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
        
        // Handle buttons
        const cancelBtn = document.getElementById('cancelBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
            };
        }
        
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = (document.getElementById('profileName') as HTMLInputElement).value.trim();
                const color = (document.getElementById('profileColor') as HTMLInputElement).value.trim();
                const settings = (document.getElementById('profileSettings') as HTMLTextAreaElement).value.trim();
                
                if (!name) {
                    alert('Please enter a profile name');
                    return;
                }
                
                if (!color) {
                    alert('Please enter a color');
                    return;
                }
                
                if (!settings) {
                    alert('Please paste your Krunker settings string');
                    return;
                }
                
                const profiles = this.getProfiles();
                profiles.push({ name, color, settings });
                this.saveProfiles(profiles);
                
                document.body.removeChild(modal);
                this.refreshUI();
            };
        }
    }



    private createProfileCard(profile: SettingsProfile, index: number): HTMLElement {
        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(26, 2, 17, 0.6);
            border: 1px solid rgba(255, 20, 147, 0.3);
            border-left: 4px solid ${profile.color};
            padding: 15px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 15px;
            cursor: pointer;
            transition: none;
        `;

        // Color indicator
        const colorBox = document.createElement('div');
        colorBox.style.cssText = `
            width: 40px;
            height: 40px;
            background: ${profile.color};
            border-radius: 4px;
            flex-shrink: 0;
        `;

        // Profile info
        const info = document.createElement('div');
        info.style.cssText = 'flex: 1;';
        
        const name = document.createElement('div');
        name.textContent = profile.name;
        name.style.cssText = 'color: #FFE5FA; font-size: 16px; font-weight: bold; margin-bottom: 4px;';
        
        const hint = document.createElement('div');
        hint.textContent = 'Click to load settings';
        hint.style.cssText = 'color: rgba(240, 196, 230, 0.6); font-size: 12px;';
        
        info.appendChild(name);
        info.appendChild(hint);

        // Action buttons
        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 8px;';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.style.cssText = `
            background: rgba(100, 150, 255, 0.15);
            border: 1px solid rgba(100, 150, 255, 0.4);
            color: #fff;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: none;
        `;
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showEditProfileDialog(profile, index);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.cssText = `
            background: rgba(200, 0, 0, 0.15);
            border: 1px solid rgba(200, 0, 0, 0.4);
            color: #fff;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: none;
        `;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteProfile(index);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        card.appendChild(colorBox);
        card.appendChild(info);
        card.appendChild(actions);

        // Click to load profile
        card.addEventListener('click', () => this.loadProfile(profile));

        // Hover effect
        card.addEventListener('mouseenter', () => {
            card.style.background = 'rgba(44, 7, 32, 0.7)';
            card.style.borderColor = 'rgba(255, 20, 147, 0.5)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.background = 'rgba(26, 2, 17, 0.6)';
            card.style.borderColor = 'rgba(255, 20, 147, 0.3)';
        });

        return card;
    }

    private showEditProfileDialog(profile: SettingsProfile, index: number) {
        // Create modal with maximum z-index
        const modal = document.createElement('div');
        modal.id = 'settingsSwapperModal';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.85) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999999 !important;
            pointer-events: all !important;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: rgba(26, 2, 17, 0.98) !important;
            border: 2px solid #FF1493 !important;
            border-radius: 8px !important;
            padding: 25px !important;
            width: 500px !important;
            max-width: 90vw !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
            position: relative !important;
            z-index: 1000000000 !important;
        `;
        
        content.innerHTML = `
            <h3 style="color: #FFE5FA; margin: 0 0 20px 0; font-size: 18px; font-weight: bold;">Edit Settings Profile</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="color: rgba(240, 196, 230, 0.8); font-size: 13px; display: block; margin-bottom: 5px;">Profile Name:</label>
                <input type="text" id="profileName" value="${profile.name}" style="width: 100%; padding: 8px; background: rgba(26, 2, 17, 0.6); border: 1px solid rgba(255, 20, 147, 0.3); color: #FFE5FA; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="color: rgba(240, 196, 230, 0.8); font-size: 13px; display: block; margin-bottom: 5px;">Color (hex):</label>
                <input type="text" id="profileColor" value="${profile.color}" style="width: 100%; padding: 8px; background: rgba(26, 2, 17, 0.6); border: 1px solid rgba(255, 20, 147, 0.3); color: #FFE5FA; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="color: rgba(240, 196, 230, 0.8); font-size: 13px; display: block; margin-bottom: 5px;">Krunker Settings String:</label>
                <textarea id="profileSettings" style="width: 100%; height: 100px; padding: 8px; background: rgba(26, 2, 17, 0.6); border: 1px solid rgba(255, 20, 147, 0.3); color: #FFE5FA; border-radius: 4px; font-size: 13px; resize: vertical; font-family: monospace; box-sizing: border-box;">${profile.settings}</textarea>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 10px 20px; background: rgba(200, 0, 0, 0.15); border: 1px solid rgba(200, 0, 0, 0.4); color: #fff; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                <button id="saveBtn" style="padding: 10px 20px; background: rgba(255, 20, 147, 0.15); border: 1px solid #FF1493; color: #FFE5FA; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">Save Changes</button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
        
        // Handle buttons
        const cancelBtn = document.getElementById('cancelBtn');
        const saveBtn = document.getElementById('saveBtn');
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
            };
        }
        
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = (document.getElementById('profileName') as HTMLInputElement).value.trim();
                const color = (document.getElementById('profileColor') as HTMLInputElement).value.trim();
                const settings = (document.getElementById('profileSettings') as HTMLTextAreaElement).value.trim();
                
                if (!name || !color || !settings) {
                    alert('All fields are required');
                    return;
                }
                
                const profiles = this.getProfiles();
                profiles[index] = { name, color, settings };
                this.saveProfiles(profiles);
                
                document.body.removeChild(modal);
                this.refreshUI();
            };
        }
    }

    private deleteProfile(index: number) {
        if (!confirm('Delete this settings profile?')) return;

        const profiles = this.getProfiles();
        profiles.splice(index, 1);
        this.saveProfiles(profiles);
        this.refreshUI();
    }

    private loadProfile(profile: SettingsProfile) {
        const resetEnabled = config.get('modules.settingsswapper.resetBeforeLoad', true) as boolean;

        try {
            // Step 1: Reset settings if enabled (silently)
            if (resetEnabled) {
                if (typeof (window as any).resetSettings === 'function') {
                    const originalConfirm = window.confirm;
                    window.confirm = () => true;
                    (window as any).resetSettings(1);
                    window.confirm = originalConfirm;
                }
            }

            // Step 2: Apply settings directly without showing UI
            // Parse the settings string and apply directly to localStorage
            try {
                const settingsData = JSON.parse(profile.settings);
                
                // Apply each setting to localStorage
                for (const key in settingsData) {
                    if (settingsData.hasOwnProperty(key)) {
                        localStorage.setItem(key, JSON.stringify(settingsData[key]));
                    }
                }
                
                // Trigger settings reload
                if (typeof (window as any).loadSettings === 'function') {
                    (window as any).loadSettings();
                }
                
                // Show success message
                alert(`Settings profile "${profile.name}" loaded successfully!`);
            } catch (parseError) {
                // Fallback to the import method if direct parsing fails
                if (typeof (window as any).importSettingsPopup === 'function') {
                    (window as any).importSettingsPopup(1);
                }

                setTimeout(() => {
                    const textarea = document.getElementById('importTxt') as HTMLTextAreaElement;
                    if (textarea) {
                        textarea.value = profile.settings;
                        
                        if (typeof (window as any).importSettings === 'function') {
                            (window as any).importSettings(1);
                        }
                    } else {
                        alert('Failed to find import textarea. Please try again.');
                    }
                }, 100);
            }
        } catch (err) {
            alert('Failed to load settings profile!');
        }
    }

    public getProfiles(): SettingsProfile[] {
        const stored = config.get('modules.settingsswapper.profiles', []) as SettingsProfile[];
        return stored;
    }

    private saveProfiles(profiles: SettingsProfile[]) {
        config.set('modules.settingsswapper.profiles', profiles);
        this.refreshDropdown();
    }

    private refreshDropdown() {
        // Trigger dropdown refresh by dispatching a custom event
        setTimeout(() => {
            const dropdown = document.getElementById('settingsPreset') as HTMLSelectElement;
            if (dropdown && (window as any).selectSettingPre) {
                // The module's config.onChange will handle the refresh
            }
        }, 100);
    }

    private refreshUI() {
        const holder = document.getElementById('settHolder');
        if (holder) {
            holder.innerHTML = '';
            this.renderProfiles(holder);
        }
    }
}
