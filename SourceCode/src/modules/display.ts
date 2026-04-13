import { ipcMain, ipcRenderer, screen } from 'electron';
import { Context, RunAt } from '../context';
import Module from '../module';
import Dropdown from '../options/dropdown';
import { window } from '../main';
import { createLogger } from '../utils/logger';

const logger = createLogger('Display');

export default class Display extends Module {
    name = 'Display';
    id = 'display';
    priority = 2; // Display near top of settings

    options = [
        new Dropdown(this, {
            name: 'Display Mode',
            description: 'Window display mode. Use borderless for best FPS if fullscreen causes issues.',
            id: 'mode',
            needsRestart: false,
            options: [
                { name: 'Windowed', value: 'windowed' },
                { name: 'Maximized', value: 'maximized' },
                { name: 'Fullscreen', value: 'fullscreen' },
                { name: 'Borderless', value: 'borderless' },
            ],
            defaultValue: 'windowed',
            onChange: (value) => {
                ipcRenderer.send('changeDisplayMode', value);
            },
        }),
    ];

    contexts = [
        {
            context: Context.Common,
            runAt: RunAt.LoadStart,
        },
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        }
    ];

    changeDisplayMode(mode: string) {
        if (!window) return;

        try {
            logger.log('Changing display mode to:', mode);

            switch (mode) {
                case 'fullscreen':
                    if (!window.isFullScreen()) {
                        window.setFullScreen(true);
                    }
                    break;

                case 'maximized':
                    if (window.isFullScreen()) {
                        window.setFullScreen(false);
                    }
                    if (!window.isMaximized()) {
                        window.maximize();
                    }
                    break;

                case 'borderless':
                    if (window.isFullScreen()) {
                        window.setFullScreen(false);
                    }
                    const bounds = screen.getPrimaryDisplay().bounds;
                    window.setFullScreenable(false);
                    window.setBounds({
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: bounds.height
                    });
                    window.moveTop();
                    logger.log('Borderless mode applied');
                    break;

                case 'windowed':
                default:
                    if (window.isFullScreen()) {
                        window.setFullScreen(false);
                    }
                    if (window.isMaximized()) {
                        window.unmaximize();
                    }
                    window.setFullScreenable(true);
                    break;
            }

            // Save the mode
            this.config.set('mode', mode);
            logger.log('Display mode changed successfully');
        } catch (e) {
            logger.error('Failed to change display mode:', e);
        }
    }

    applyStartupDisplayMode() {
        const mode = this.config.get('mode', 'windowed');
        logger.log('Applying startup display mode:', mode);
        
        // Delay to ensure window is ready
        setTimeout(() => {
            this.changeDisplayMode(mode);
        }, 500);
    }

    main() {
        ipcMain.on('changeDisplayMode', (event, mode) => {
            this.changeDisplayMode(mode);
        });

        // Apply display mode on startup
        this.applyStartupDisplayMode();
    }

    renderer() {
        // Apply display mode when game loads
        const mode = this.config.get('mode', 'windowed');
        if (mode !== 'windowed') {
            ipcRenderer.send('changeDisplayMode', mode);
        }
    }
}
