import Module from '../module';
import { Context, RunAt } from '../context';
import { waitFor } from '../util';
import { createLogger } from '../utils/logger';
import Store from './store';

const logger = createLogger('StoreButton');

export default class StoreButton extends Module {
    name = 'Store Button';
    id = 'store-button';
    options = [];
    priority = 5;

    contexts = [{ context: Context.Game, runAt: RunAt.LoadEnd }];

    renderer() {
        logger.log('renderer() called');
        this.injectStoreButton();
    }

    private getStoreModule(): Store | null {
        // Find the existing Store module from the manager
        if (this.manager && this.manager.loaded) {
            const storeModule = this.manager.loaded.find((m: any) => m.id === 'store');
            if (storeModule) {
                return storeModule as Store;
            }
        }
        return null;
    }

    private async injectStoreButton() {
        logger.log('injectStoreButton() started');

        // Wait for the subLogoButtons container to be available
        await waitFor(() => document.getElementById('subLogoButtons'));
        logger.log('subLogoButtons found');

        // Check if Store button already exists
        if (document.getElementById('menuBtnWaterStore')) {
            logger.log('Store button already exists');
            return;
        }

        // Find the Ranked button
        const rankedBtn = document.getElementById('menuBtnRanked');
        if (!rankedBtn) {
            logger.log('Ranked button not found, retrying...');
            setTimeout(() => this.injectStoreButton(), 1000);
            return;
        }
        logger.log('Ranked button found');

        // Create the Store button
        const storeBtn = document.createElement('div');
        storeBtn.id = 'menuBtnWaterStore';
        storeBtn.className = 'button small buttonPI';
        storeBtn.setAttribute('onmouseenter', 'playTick()');
        storeBtn.innerHTML = 'Store';
        storeBtn.style.cssText = 'position:relative;margin-right:3px;';

        // Add click handler to open Water Store Marketplace (same as Browse Marketplace)
        storeBtn.addEventListener('click', () => {
            (window as any).playSelect?.();
            // Find the Store module and open its marketplace
            const storeModule = this.getStoreModule();
            if (storeModule && (storeModule as any).marketplaceUI) {
                (storeModule as any).marketplaceUI.open();
                logger.log('Water Store button clicked, opening marketplace');
            } else {
                logger.log('Store module or marketplaceUI not found');
            }
        });

        // Insert before the Ranked button
        rankedBtn.parentNode?.insertBefore(storeBtn, rankedBtn);
        logger.log('Store button injected left of Ranked');
    }
}
