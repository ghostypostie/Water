// Disable sandbox for Linux AppImage compatibility - MUST be first!
process.env.ELECTRON_NO_SANDBOX = '1';
process.env.ELECTRON_DISABLE_SANDBOX = '1';
process.env.ELECTRON_DISABLE_GPU_SANDBOX = '1';

import { launch } from './index';

launch();
