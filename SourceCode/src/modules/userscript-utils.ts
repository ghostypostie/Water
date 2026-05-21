/**
 * Water Client - Userscript Shared Utilities
 * Centralized helpers to reduce duplication across the userscript subsystem.
 */

import { existsSync, statSync } from 'fs';
import { strippedConsole } from './userscript-loader';

// ============================================================================
// Key Humanization
// ============================================================================

/**
 * Convert camelCase / snake_case / SCREAMING_CASE / kebab-case keys
 * into a readable "Human Readable Title".
 *
 * Examples:
 *   fadeOutDelay   → "Fade Out Delay"
 *   SHOW_HUD       → "Show Hud"
 *   my-awesome-key → "My Awesome Key"
 *   volume         → "Volume"
 */
export function humanizeKey(key: string): string {
	if (!key) return '';

	// 1. Insert space before uppercase letters in camelCase / PascalCase
	let result = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

	// 2. Replace underscores and hyphens with spaces
	result = result.replace(/[_-]+/g, ' ');

	// 3. Collapse multiple spaces
	result = result.replace(/\s+/g, ' ').trim();

	// 4. Title-case every word
	result = result
		.split(' ')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');

	return result;
}

// ============================================================================
// Smart Type Inference
// ============================================================================

/**
 * Given a config key name and its current value, infer the best setting type
 * and appropriate min/max/step for numeric values.
 *
 * Returns an object with { type, min?, max?, step?, opts? }.
 */
export function inferSettingType(
	key: string,
	value: any
): {
	type: string;
	min?: number;
	max?: number;
	step?: number;
	opts?: string[];
} {
	// Boolean
	if (typeof value === 'boolean') {
		return { type: 'bool' };
	}

	// Array of strings → select
	if (Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'string')) {
		return { type: 'sel', opts: value };
	}

	// Color string
	if (typeof value === 'string') {
		if (/^#([0-9a-fA-F]{3}){1,2}$/.test(value)) {
			return { type: 'color' };
		}
		if (/^rgba?\(/.test(value) || /^hsla?\(/.test(value)) {
			return { type: 'color' };
		}
		// Keybind object stored as string is handled elsewhere
		return { type: 'text' };
	}

	// Keybind object
	if (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		typeof value.key === 'string' &&
		typeof value.ctrl === 'boolean'
	) {
		return { type: 'keybind' };
	}

	// Number → smart range detection based on key name
	if (typeof value === 'number') {
		const k = key.toLowerCase();

		// 0-1 fractional ranges
		if (
			k.includes('volume') ||
			k.includes('opacity') ||
			k.includes('alpha') ||
			k.includes('transparency')
		) {
			return { type: 'num', min: 0, max: 1, step: 0.01 };
		}

		// Percentage ranges
		if (k.includes('percent') || k === 'verticalposition' || k === 'horizontalposition') {
			return { type: 'num', min: 0, max: 100, step: 1 };
		}

		// Time / delay / duration (milliseconds)
		if (k.includes('time') || k.includes('delay') || k.includes('duration') || k.includes('interval') || k.includes('timeout')) {
			if (k.includes('streakreset')) {
				return { type: 'num', min: 0, max: 20000, step: 1000 };
			}
			if (k.includes('fadeout')) {
				return { type: 'num', min: 0, max: 10000, step: 100 };
			}
			return { type: 'num', min: 0, max: 60000, step: 100 };
		}

		// Size / font / scale / zoom
		if (k.includes('size') || k.includes('font') || k.includes('width') || k.includes('height')) {
			return { type: 'num', min: 0, max: 500, step: 1 };
		}
		if (k.includes('scale') || k.includes('zoom') || k.includes('multiplier')) {
			return { type: 'num', min: 0.1, max: 5, step: 0.1 };
		}

		// Angle / rotation / FOV
		if (k.includes('angle') || k.includes('rotation') || k.includes('direction')) {
			return { type: 'num', min: 0, max: 360, step: 1 };
		}
		if (k.includes('fov')) {
			return { type: 'num', min: 30, max: 170, step: 1 };
		}

		// Speed / velocity
		if (k.includes('speed') || k.includes('velocity')) {
			return { type: 'num', min: 0, max: 100, step: 0.5 };
		}

		// Count / amount / limit
		if (k.includes('count') || k.includes('amount') || k.includes('limit') || k.includes('max') || k.includes('min')) {
			return { type: 'num', min: 0, max: 1000, step: 1 };
		}

		// Radius / distance
		if (k.includes('radius') || k.includes('distance') || k.includes('range')) {
			return { type: 'num', min: 0, max: 2000, step: 1 };
		}

		// Fallback for unknown numbers — smart range based on current value
		const absVal = Math.abs(value);
		if (absVal <= 1) {
			return { type: 'num', min: 0, max: 1, step: 0.01 };
		}
		if (absVal <= 10) {
			return { type: 'num', min: Math.min(0, value - 10), max: Math.max(10, value + 10), step: 0.1 };
		}
		return {
			type: 'num',
			min: Math.min(0, value - 100),
			max: Math.max(100, value + 100),
			step: value < 10 ? 0.1 : 1,
		};
	}

	// Nested objects and functions are skipped
	return { type: 'skip' };
}

// ============================================================================
// Script File Validation
// ============================================================================

// Increased from 1 MB so large userscripts with embedded base64 audio/images still load.
// 25 MB is enough for most userscripts while still blocking accidental huge/binary files.
const MAX_SCRIPT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Validate a script file before loading.
 * Returns { valid, reason? }.
 */
export function validateScriptFile(
	filepath: string,
	content?: string
): { valid: boolean; reason?: string } {
	// Check existence
	if (!existsSync(filepath)) {
		return { valid: false, reason: 'File does not exist' };
	}

	// Check file size
	try {
		const stats = statSync(filepath);
		if (stats.size > MAX_SCRIPT_SIZE_BYTES) {
			return {
				valid: false,
				reason: `File too large (${(stats.size / 1024 / 1024).toFixed(2)} MB). Max allowed: ${(MAX_SCRIPT_SIZE_BYTES / 1024 / 1024).toFixed(0)} MB`,
			};
		}
		if (stats.size === 0) {
			return { valid: false, reason: 'File is empty' };
		}
	} catch (e) {
		return { valid: false, reason: `Cannot read file stats: ${e}` };
	}

	// Check extension
	const ext = filepath.toLowerCase();
	if (!ext.endsWith('.js') && !ext.endsWith('.ts')) {
		return { valid: false, reason: 'Invalid file extension. Only .js and .ts are supported' };
	}

	// If content is provided, basic sanity check
	if (content !== undefined) {
		// Check for null bytes (binary file)
		if (content.includes('\0')) {
			return { valid: false, reason: 'File appears to be binary (contains null bytes)' };
		}
	}

	return { valid: true };
}

// ============================================================================
// Orphan Settings Cleanup
// ============================================================================

/**
 * Remove saved settings for scripts that no longer exist.
 * `existingScriptNames` should be a Set of all currently known script names.
 * `cleanPurchased` - whether to clean purchased script settings (default: false, since purchased scripts load async)
 */
export function cleanOrphanSettings(
	configStore: any, // electron-store instance
	existingScriptNames: Set<string>,
	cleanPurchased: boolean = false
): number {
	let cleaned = 0;

	try {
		// Check local namespace
		const localSettings = configStore.get('userscript.local', {});
		for (const scriptName of Object.keys(localSettings)) {
			if (!existingScriptNames.has(scriptName) && !existingScriptNames.has(scriptName + '.js')) {
				configStore.delete(`userscript.local.${scriptName}`);
				cleaned++;
				strippedConsole.log(`[Water] Cleaned orphan settings for local script: ${scriptName}`);
			}
		}

		// Check purchased namespace ONLY if explicitly requested
		// (purchased scripts load asynchronously, so we shouldn't clean them during initial local script load)
		if (cleanPurchased) {
			const purchasedSettings = configStore.get('userscript.purchased', {});
			for (const scriptName of Object.keys(purchasedSettings)) {
				if (!existingScriptNames.has(scriptName)) {
					configStore.delete(`userscript.purchased.${scriptName}`);
					cleaned++;
					strippedConsole.log(`[Water] Cleaned orphan settings for purchased script: ${scriptName}`);
				}
			}
		}

		// Check enable/disable flags
		const localFlags = configStore.get('userscripts.local', {});
		for (const scriptName of Object.keys(localFlags)) {
			if (!existingScriptNames.has(scriptName) && !existingScriptNames.has(scriptName + '.js')) {
				configStore.delete(`userscripts.local.${scriptName}`);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			strippedConsole.log(`[Water] Cleaned ${cleaned} orphan setting entries`);
		}
	} catch (e) {
		strippedConsole.error('[Water] Error cleaning orphan settings:', e);
	}

	return cleaned;
}

// ============================================================================
// Namespace Resolution
// ============================================================================

/**
 * Determine the storage namespace for a script.
 * Returns 'local' | 'purchased'.
 */
export function getScriptNamespace(script: {
	fullpath?: string;
	scriptType?: string;
}): 'local' | 'purchased' {
	if (script.scriptType === 'premium' || (script.fullpath && script.fullpath.startsWith('[PURCHASED]'))) {
		return 'purchased';
	}
	return 'local';
}

// ============================================================================
// Storage Quota
// ============================================================================

const MAX_GM_STORAGE_PER_SCRIPT = 512 * 1024; // 512 KB

/**
 * Calculate the total storage used by a script's GM_* values.
 * Returns size in bytes.
 */
export function getGMStorageUsage(scriptNamespace: string): number {
	let totalSize = 0;
	const prefix = `GM_${scriptNamespace}_`;

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key && key.startsWith(prefix)) {
			const value = localStorage.getItem(key);
			if (value) {
				totalSize += key.length * 2 + value.length * 2; // UTF-16
			}
		}
	}

	return totalSize;
}

/**
 * Check if adding a value would exceed the quota.
 */
export function checkGMStorageQuota(
	scriptNamespace: string,
	key: string,
	value: string
): { allowed: boolean; currentUsage: number; limit: number } {
	const currentUsage = getGMStorageUsage(scriptNamespace);
	const newSize = (key.length * 2) + (value.length * 2);
	const limit = MAX_GM_STORAGE_PER_SCRIPT;

	return {
		allowed: currentUsage + newSize <= limit,
		currentUsage,
		limit,
	};
}
