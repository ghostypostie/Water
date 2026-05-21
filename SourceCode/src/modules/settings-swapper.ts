import { Context, RunAt } from '../context';
import Module from '../module';
import Checkbox from '../options/checkbox';
import Button from '../options/button';
import SettingsSwapperUI from '../ui/settings-swapper';

interface SettingsProfile {
    name: string;
    color: string;
    settings: string;
}

export default class SettingsSwapper extends Module {
    name = 'Settings Swapper';
    id = 'settingsswapper';
    
    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        }
    ];

    options = [
        new Checkbox(this, {
            name: 'Reset Settings Before Load',
            id: 'resetBeforeLoad',
            defaultValue: true,
        }),
        new Button(this, {
            name: 'Manage Profiles',
            id: 'manageProfiles',
            label: 'Open Settings Swapper',
            onChange: () => {
                this.openUI();
            }
        })
    ];

    private ui: SettingsSwapperUI;

    constructor() {
        super();
        this.ui = new SettingsSwapperUI(this);
    }

    renderer() {
        this.createWaterSettingsPreset();
        this.interceptResetSettings();
    }

    private interceptResetSettings() {
        // Intercept Krunker's resetSettings to reset our dropdown
        const originalResetSettings = (window as any).resetSettings;
        if (typeof originalResetSettings === 'function') {
            (window as any).resetSettings = (...args: any[]) => {
                // Call original function
                const result = originalResetSettings.apply(window, args);
                
                // Reset our dropdown
                this.resetDropdownSelection();
                
                return result;
            };
        }
    }

    private createWaterSettingsPreset() {
        // Wait for settings window to be available
        const checkInterval = setInterval(() => {
            const originalDropdown = document.getElementById('settingsPreset') as HTMLSelectElement;
            if (originalDropdown) {
                clearInterval(checkInterval);
                this.replaceWithWaterDropdown(originalDropdown);
            }
        }, 500);

        setTimeout(() => clearInterval(checkInterval), 10000);

        // Watch for settings window opening and re-create if needed
        const observer = new MutationObserver(() => {
            const originalDropdown = document.getElementById('settingsPreset') as HTMLSelectElement;
            const waterDropdown = document.getElementById('waterSettingsPreset') as HTMLSelectElement;
            
            if (originalDropdown && !waterDropdown) {
                this.replaceWithWaterDropdown(originalDropdown);
            }
        });

        // Observe the entire document for dropdown appearing
        observer.observe(document.body, { childList: true, subtree: true });
    }

    private replaceWithWaterDropdown(originalDropdown: HTMLSelectElement) {
        // Hide the original dropdown
        originalDropdown.style.display = 'none';

        // Check if water dropdown already exists
        let waterDropdown = document.getElementById('waterSettingsPreset') as HTMLSelectElement;
        if (waterDropdown) {
            // Just update it
            this.populateWaterDropdown(waterDropdown);
            return;
        }

        // Create new Water dropdown with same styling
        waterDropdown = document.createElement('select');
        waterDropdown.id = 'waterSettingsPreset';
        waterDropdown.className = originalDropdown.className;
        waterDropdown.style.cssText = originalDropdown.style.cssText;
        waterDropdown.style.display = '';

        // Insert after the original dropdown
        originalDropdown.parentNode?.insertBefore(waterDropdown, originalDropdown.nextSibling);

        // Populate with profiles
        this.populateWaterDropdown(waterDropdown);

        // Attach event listener
        waterDropdown.addEventListener('change', this.dropdownChangeHandler);

        // Update dropdown when profiles change
        this.config.onChange('profiles', () => {
            setTimeout(() => {
                const dropdown = document.getElementById('waterSettingsPreset') as HTMLSelectElement;
                if (dropdown) {
                    this.populateWaterDropdown(dropdown);
                }
            }, 100);
        });
    }

    private populateWaterDropdown(dropdown: HTMLSelectElement) {
        const profiles = this.ui.getProfiles();
        
        // Clear existing options
        dropdown.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = profiles.length === 0 ? 'No Profiles' : 'Select Profile';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        dropdown.appendChild(defaultOption);

        // Add Water profiles
        profiles.forEach((profile, index) => {
            const option = document.createElement('option');
            option.value = `water_${index}`;
            option.textContent = profile.name;
            option.style.color = profile.color;
            dropdown.appendChild(option);
        });
    }

    private dropdownChangeHandler = (event: Event) => {
        const dropdown = event.target as HTMLSelectElement;
        const selectedValue = dropdown.value;
        
        if (selectedValue.startsWith('water_')) {
            const index = parseInt(selectedValue.replace('water_', ''));
            const profiles = this.ui.getProfiles();
            
            if (profiles[index]) {
                this.loadProfileSilently(profiles[index]);
                // Keep the profile selected - don't reset
            }
        }
    };

    private loadProfileSilently(profile: SettingsProfile) {
        const resetEnabled = this.config.get('resetBeforeLoad', true) as boolean;

        try {
            // Step 1: Reset settings if enabled (silently)
            if (resetEnabled) {
                if (typeof (window as any).resetSettings === 'function') {
                    const originalConfirm = window.confirm;
                    window.confirm = () => true;
                    (window as any).resetSettings(1);
                    window.confirm = originalConfirm;
                    
                    // After reset, dropdown should go back to default
                    this.resetDropdownSelection();
                }
            }

            // Step 2: Use Krunker's import method (hidden)
            if (typeof (window as any).importSettingsPopup === 'function') {
                (window as any).importSettingsPopup(1);
            }

            // Wait for textarea and apply settings
            setTimeout(() => {
                const textarea = document.getElementById('importTxt') as HTMLTextAreaElement;
                if (textarea) {
                    textarea.value = profile.settings;
                    
                    if (typeof (window as any).importSettings === 'function') {
                        (window as any).importSettings(1);
                    }
                }
            }, 100);
        } catch (err) {
            alert('Failed to load settings profile!');
        }
    }

    private resetDropdownSelection() {
        setTimeout(() => {
            const dropdown = document.getElementById('waterSettingsPreset') as HTMLSelectElement;
            if (dropdown) {
                dropdown.selectedIndex = 0;
            }
        }, 200);
    }

    openUI() {
        this.ui.open();
    }
}
