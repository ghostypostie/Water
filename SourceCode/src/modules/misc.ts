import { ipcMain, ipcRenderer } from 'electron';
import { Context, RunAt } from '../context';
import Module from '../module';
import Checkbox from '../options/checkbox';
import { window } from '../main';
import TextInput from '../options/textinput';
import { createLogger } from '../utils/logger';

const logger = createLogger('Misc');

export default class Misc extends Module {
    name = 'Miscellaneous';
    id = 'misc';
    options = [
        new Checkbox(this, {
            name: 'Show client watermark',
            id: 'watermark',
            onChange(value) {
                document.body.style.setProperty(
                    '--watermark-display',
                    value ? '' : 'none'
                );
            },
            defaultValue: true,
        }),
        new TextInput(this, {
            name: 'Custom Loading Screen',
            label: 'https://example.com/image.gif',
            id: 'customLoadingScreen',
            needsRestart: true,
        }),
        new Checkbox(this, {
            name: 'Lock window size',
            id: 'lockWindowSize',
            onChange() {
                ipcRenderer.send('updateWindowSizeLock');
            }
        }),
        new TextInput(this, {
            name: 'Window size',
            label: '1920x1080',
            id: 'windowSize',
            onChange() {
                ipcRenderer.send('updateWindowSizeLock');
            }
        })
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

    updateWindowSizeLock() {
        let shouldLock = this.config.get('lockWindowSize', false);
        let [w, h] = this.config.get('windowSize', '0x0').split('x');

        logger.log('updating window lock', w, h);
        window.setResizable(true);

        if (shouldLock && !isNaN(w) && !isNaN(h)) {
            window.setSize(parseInt(w), parseInt(h));
            window.setResizable(false);
        }
    }

    renderer() {
        // Placebo FPS is handled by the Performance module
    }

    main() {
        this.updateWindowSizeLock();
        ipcMain.on('updateWindowSizeLock', () => this.updateWindowSizeLock());
    }
}
