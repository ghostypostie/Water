import Module from '../module';
import { Context, RunAt } from '../context';
import { waitFor } from '../util';
import { createLogger } from '../utils/logger';

const logger = createLogger('PugsButton');

export default class PugsButton extends Module {
    name = 'PUGs Button';
    id = 'pugs-button';
    options = [];
    priority = 5;

    contexts = [{ context: Context.Game, runAt: RunAt.LoadEnd }];

    renderer() {
        logger.log('renderer() called');
        this.injectPugsButton();
        this.setupModeListener();
    }

    private setupModeListener() {
        // Listen for mode changes from Water menu
        window.addEventListener('waterModeChanged', ((event: CustomEvent) => {
            const mode = event.detail.mode;
            logger.log('Mode changed to:', mode);
            this.updateButtonVisibility(mode);
        }) as EventListener);
    }

    private updateButtonVisibility(mode: 'pugs' | 'ranked') {
        const pugsBtn = document.getElementById('menuBtnPugs');
        const rankedBtn = document.getElementById('menuBtnRanked');

        if (mode === 'pugs') {
            // Show PUGs, hide Ranked
            if (pugsBtn) pugsBtn.style.display = '';
            if (rankedBtn) rankedBtn.style.display = 'none';
            logger.log('PUGs mode: showing PUGs button, hiding Ranked button');
        } else {
            // Show Ranked, hide PUGs
            if (pugsBtn) pugsBtn.style.display = 'none';
            if (rankedBtn) rankedBtn.style.display = '';
            logger.log('Ranked mode: showing Ranked button, hiding PUGs button');
        }
    }

    private async injectPugsButton() {
        logger.log('injectPugsButton() started');

        // Wait for the subLogoButtons container to be available
        await waitFor(() => document.getElementById('subLogoButtons'));
        logger.log('subLogoButtons found');

        // Check if PUGs button already exists
        if (document.getElementById('menuBtnPugs')) {
            logger.log('PUGs button already exists');
            return;
        }

        // Find the Ranked button
        const rankedBtn = document.getElementById('menuBtnRanked');
        if (!rankedBtn) {
            logger.log('Ranked button not found, retrying...');
            setTimeout(() => this.injectPugsButton(), 1000);
            return;
        }
        logger.log('Ranked button found');

        // Create the PUGs button (same style as Store/Ranked)
        const pugsBtn = document.createElement('div');
        pugsBtn.id = 'menuBtnPugs';
        pugsBtn.className = 'button small buttonPI';
        pugsBtn.setAttribute('onmouseenter', 'playTick()');
        pugsBtn.innerHTML = 'PUGs';
        pugsBtn.style.cssText = 'position:relative;margin-right:3px;border:4px solid #000000 !important;';

        // Add click handler to open PUGs window
        pugsBtn.addEventListener('click', () => {
            (window as any).playSelect?.();
            this.openPugsWindow();
            logger.log('PUGs button clicked');
        });

        // Insert before the Ranked button
        rankedBtn.parentNode?.insertBefore(pugsBtn, rankedBtn);
        logger.log('PUGs button injected left of Ranked');

        // Apply initial visibility based on saved mode
        const savedMode = localStorage.getItem('water_mode') as 'pugs' | 'ranked' || 'ranked';
        this.updateButtonVisibility(savedMode);
    }

    private openPugsWindow() {
        // Find the pickup module and open its window
        if (this.manager && this.manager.loaded) {
            const pickupModule = this.manager.loaded.find((m: any) => m.id === 'pickup');
            if (pickupModule && (pickupModule as any).openPickupWindow) {
                (pickupModule as any).openPickupWindow();
                logger.log('Opening pickup window');
            } else {
                logger.log('Pickup module not found or openPickupWindow method missing');
            }
        }
    }
}
