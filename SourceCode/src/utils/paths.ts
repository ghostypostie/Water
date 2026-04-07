import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

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
