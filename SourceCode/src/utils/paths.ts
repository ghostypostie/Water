import { join, normalize, sep } from 'path';
import { existsSync, readdirSync, copyFileSync, mkdirSync } from 'fs';
import { app } from 'electron';

/**
 * Count files in a directory (non-recursive)
 */
function countFiles(path: string): number {
    try {
        if (!existsSync(path)) return 0;
        return readdirSync(path, { withFileTypes: true })
            .filter(dirent => dirent.isFile())
            .length;
    } catch (e) {
        return 0;
    }
}

/**
 * Get the application resources path (works in both dev and production, all platforms)
 */
function getAppResourcesPath(): string {
    // In production (packaged app), app.getAppPath() returns the asar path
    // In development, it returns the project root
    const appPath = app.getAppPath();
    
    // Check if we're in an asar archive
    if (appPath.includes('.asar')) {
        // In production: app.asar is in resources folder
        // We need to go to resources/app.asar/assets
        return appPath;
    } else {
        // In development: appPath is the project root
        return appPath;
    }
}

/**
 * Copy bundled scripts from assets to user's Scripts folder
 * Only copies if the file doesn't already exist (won't overwrite user modifications)
 * Cross-platform compatible (Windows, macOS, Linux)
 */
export function copyBundledScripts(userScriptsPath: string): void {
    try {
        console.log('[Water] copyBundledScripts called with path:', userScriptsPath);
        console.log('[Water] Platform:', process.platform);
        
        // Ensure user scripts directory exists
        if (!existsSync(userScriptsPath)) {
            mkdirSync(userScriptsPath, { recursive: true });
            console.log('[Water] Created Scripts directory:', userScriptsPath);
        }

        // Get the app resources path (cross-platform)
        const appPath = getAppResourcesPath();
        console.log('[Water] App path:', appPath);
        
        // Build path to bundled scripts using platform-appropriate separators
        const bundledScriptsPath = normalize(join(appPath, 'assets', 'scripts'));
        
        console.log('[Water] Looking for bundled scripts at:', bundledScriptsPath);
        console.log('[Water] Checking if path exists...');
        
        // If bundled scripts folder doesn't exist, skip (not included in this build)
        if (!existsSync(bundledScriptsPath)) {
            console.log('[Water] No bundled scripts folder found at:', bundledScriptsPath);
            console.log('[Water] This is normal for public builds without bundled scripts');
            return;
        }

        console.log('[Water] Bundled scripts folder exists! Reading directory...');

        // Read all .js files from bundled scripts
        const bundledScripts = readdirSync(bundledScriptsPath, { withFileTypes: true })
            .filter(entry => entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.user.js')));

        if (bundledScripts.length === 0) {
            console.log('[Water] No .js files found in bundled scripts folder');
            return;
        }

        console.log(`[Water] Found ${bundledScripts.length} bundled scripts:`, bundledScripts.map(s => s.name));

        // Copy each script if it doesn't exist
        for (const script of bundledScripts) {
            const sourcePath = normalize(join(bundledScriptsPath, script.name));
            const destPath = normalize(join(userScriptsPath, script.name));

            console.log(`[Water] Processing ${script.name}...`);
            console.log(`[Water]   Source: ${sourcePath}`);
            console.log(`[Water]   Dest: ${destPath}`);

            if (existsSync(destPath)) {
                console.log(`[Water] Skipping ${script.name} (already exists)`);
                continue;
            }

            try {
                copyFileSync(sourcePath, destPath);
                console.log(`[Water] ✓ Successfully copied bundled script: ${script.name}`);
            } catch (err) {
                console.error(`[Water] ✗ Failed to copy ${script.name}:`, err);
            }
        }
        
        console.log('[Water] Finished copying bundled scripts');
    } catch (err) {
        console.error('[Water] Error in copyBundledScripts:', err);
    }
}

/**
 * Get the user's home directory (cross-platform)
 */
function getUserHome(): string {
    // Windows: USERPROFILE (C:\Users\Username)
    // macOS/Linux: HOME (/Users/Username or /home/username)
    return process.env.USERPROFILE || process.env.HOME || '';
}

/**
 * Get the user's Documents folder path (cross-platform)
 */
function getDocumentsPath(): string {
    const home = getUserHome();
    
    if (process.platform === 'darwin') {
        // macOS: ~/Documents
        return join(home, 'Documents');
    } else if (process.platform === 'win32') {
        // Windows: Check both OneDrive and local Documents
        return join(home, 'Documents');
    } else {
        // Linux: ~/Documents (or fallback to home)
        const docsPath = join(home, 'Documents');
        return existsSync(docsPath) ? docsPath : home;
    }
}

/**
 * Get the Water folder path, checking multiple possible locations
 * to handle OneDrive redirected folders and local Documents folder.
 * If multiple folders exist, uses the one with the most content.
 * Cross-platform compatible (Windows, macOS, Linux)
 */
export function getWaterPath(): string {
    const possiblePaths: string[] = [];
    const home = getUserHome();
    
    if (!home) {
        console.error('[Water] Could not determine user home directory');
        return join('.', 'Water'); // Fallback to current directory
    }
    
    if (process.platform === 'win32') {
        // Windows: Check OneDrive Documents and local Documents
        const oneDriveDocs = normalize(join(home, 'OneDrive', 'Documents', 'Water'));
        const localDocs = normalize(join(home, 'Documents', 'Water'));
        possiblePaths.push(oneDriveDocs, localDocs);
    } else if (process.platform === 'darwin') {
        // macOS: Check ~/Documents/Water and ~/Library/Application Support/Water
        const docsDocs = normalize(join(home, 'Documents', 'Water'));
        const appSupport = normalize(join(home, 'Library', 'Application Support', 'Water'));
        possiblePaths.push(docsDocs, appSupport);
    } else {
        // Linux: Check ~/Documents/Water, ~/.local/share/Water, and ~/.config/Water
        const docsDocs = normalize(join(home, 'Documents', 'Water'));
        const localShare = normalize(join(home, '.local', 'share', 'Water'));
        const configDir = normalize(join(home, '.config', 'Water'));
        possiblePaths.push(docsDocs, localShare, configDir);
    }
    
    console.log('[Water] Platform:', process.platform);
    console.log('[Water] Checking possible Water folder locations:', possiblePaths);
    
    // Find all existing paths
    const existingPaths = possiblePaths.filter(p => existsSync(p));
    
    if (existingPaths.length === 0) {
        // No existing folder, use platform-appropriate default
        let defaultPath: string;
        
        if (process.platform === 'darwin') {
            // macOS: Use Documents folder
            defaultPath = normalize(join(home, 'Documents', 'Water'));
        } else if (process.platform === 'win32') {
            // Windows: Use local Documents folder
            defaultPath = normalize(join(home, 'Documents', 'Water'));
        } else {
            // Linux: Use Documents if it exists, otherwise ~/.local/share
            const docsPath = join(home, 'Documents');
            if (existsSync(docsPath)) {
                defaultPath = normalize(join(docsPath, 'Water'));
            } else {
                defaultPath = normalize(join(home, '.local', 'share', 'Water'));
            }
        }
        
        console.log('[Water] No existing Water folder found, will use:', defaultPath);
        return defaultPath;
    }
    
    if (existingPaths.length === 1) {
        // Only one folder exists, use it
        console.log('[Water] Using Water folder:', existingPaths[0]);
        return existingPaths[0];
    }
    
    // Multiple folders exist - check which has more content
    console.warn('[Water] WARNING: Multiple Water folders found!');
    
    const pathsWithCounts = existingPaths.map(path => {
        const swapFiles = countFiles(join(path, 'Swap'));
        const scriptFiles = countFiles(join(path, 'Scripts'));
        const cssFiles = countFiles(join(path, 'Swap', 'css'));
        const totalFiles = swapFiles + scriptFiles + cssFiles;
        
        console.log(`[Water] - ${path}: ${totalFiles} files (Swap: ${swapFiles}, Scripts: ${scriptFiles}, CSS: ${cssFiles})`);
        
        return { path, totalFiles };
    });
    
    // Sort by file count (descending) and use the one with most content
    pathsWithCounts.sort((a, b) => b.totalFiles - a.totalFiles);
    const selectedPath = pathsWithCounts[0].path;
    
    console.log('[Water] Using folder with most content:', selectedPath);
    console.log('[Water] NOTE: If you want to use a different folder, please move all files to one location and delete the other.');
    
    return selectedPath;
}

/**
 * Get the Swap folder path
 */
export function getSwapPath(): string {
    return join(getWaterPath(), 'Swap');
}

/**
 * Get the Scripts folder path
 */
export function getScriptsPath(): string {
    return join(getWaterPath(), 'Scripts');
}
