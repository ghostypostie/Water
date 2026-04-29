import { join } from 'path';
import { existsSync, readdirSync, copyFileSync, mkdirSync } from 'fs';

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
 * Copy bundled scripts from assets to user's Scripts folder
 * Only copies if the file doesn't already exist (won't overwrite user modifications)
 */
export function copyBundledScripts(userScriptsPath: string): void {
    try {
        console.log('[Water] copyBundledScripts called with path:', userScriptsPath);
        
        // Ensure user scripts directory exists
        if (!existsSync(userScriptsPath)) {
            mkdirSync(userScriptsPath, { recursive: true });
            console.log('[Water] Created Scripts directory:', userScriptsPath);
        }

        // Path to bundled scripts in assets
        // __dirname in renderer process points to: app.asar/js/utils
        // So we go up to app.asar root, then into assets/scripts
        const bundledScriptsPath = join(__dirname, '../../assets/scripts');
        
        console.log('[Water] __dirname is:', __dirname);
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
            .filter(entry => entry.isFile() && entry.name.endsWith('.js'));

        if (bundledScripts.length === 0) {
            console.log('[Water] No .js files found in bundled scripts folder');
            return;
        }

        console.log(`[Water] Found ${bundledScripts.length} bundled scripts:`, bundledScripts.map(s => s.name));

        // Copy each script if it doesn't exist
        for (const script of bundledScripts) {
            const sourcePath = join(bundledScriptsPath, script.name);
            const destPath = join(userScriptsPath, script.name);

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
 * Get the Water folder path, checking multiple possible locations
 * to handle OneDrive redirected folders and local Documents folder.
 * If multiple folders exist, uses the one with the most content.
 */
export function getWaterPath(): string {
    const possiblePaths: string[] = [];
    
    const userProfile = process.env.USERPROFILE || process.env.HOME || '';
    
    if (userProfile) {
        // Method 1: Check OneDrive Documents folder
        const oneDriveDocs = join(userProfile, 'OneDrive', 'Documents', 'Water');
        possiblePaths.push(oneDriveDocs);
        
        // Method 2: Check local Documents folder
        const localDocs = join(userProfile, 'Documents', 'Water');
        possiblePaths.push(localDocs);
    }
    
    // Find all existing paths
    const existingPaths = possiblePaths.filter(p => existsSync(p));
    
    if (existingPaths.length === 0) {
        // No existing folder, use local Documents as default
        const defaultPath = join(userProfile, 'Documents', 'Water');
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
