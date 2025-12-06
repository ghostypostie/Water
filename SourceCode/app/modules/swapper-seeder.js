"use strict";

const fs = require("fs");
const path = require("path");

/**
 * SwapperSeeder
 *
 * Seeds the resource swapper directory with built-in defaults shipped with the app
 * (if any exist), and ensures the expected folder structure exists.
 *
 * Rules:
 * - Never overwrite existing user files.
 * - Create missing directories as needed.
 * - If no packaged defaults are present, still create a helpful README in the sound folder.
 */
async function seedDefaults(appDir, swapDir) {
	try {
		// Ensure base directories exist
		await ensureDir(swapDir);

		// Always ensure the "sound" directory exists for normal swapper mode
		const normalSoundDir = path.join(swapDir, "sound");
		await ensureDir(normalSoundDir);

		// Ensure the advanced-mode mirror also exists for asset-bound resources
		const advancedAssetsSoundDir = path.join(swapDir, "assets.krunker.io", "sound");
		await ensureDir(advancedAssetsSoundDir);

		// Packaged defaults may be located in two places depending on dev vs packaged:
		// - app/default-swaps (dev, unpacked)
		// - process.resourcesPath/defaults (packaged via extraResources)
		const defaultsRootDev = path.join(appDir, "default-swaps");
		const defaultsRootPkg = process.resourcesPath ? path.join(process.resourcesPath, "defaults") : null;

		async function seedFrom(root) {
			if (!root || !(await exists(root))) return;
			await copyTreeIfMissing(root, swapDir);
			const defaultsSound = path.join(root, "sound");
			if (await exists(defaultsSound)) {
				await mirrorFolderIfMissing(defaultsSound, advancedAssetsSoundDir);
			}
		}

		await seedFrom(defaultsRootDev);
		await seedFrom(defaultsRootPkg);

		// Ensure README exists in sound folder to guide the user
		await writeReadmeIfMissing(normalSoundDir);
		await writeReadmeIfMissing(advancedAssetsSoundDir, true);
	}
	catch (err) {
		console.log("[SwapperSeeder] seedDefaults error:", err);
	}
}

async function mirrorFolderIfMissing(srcDir, destDir) {
	await ensureDir(destDir);
	const items = await fs.promises.readdir(srcDir, { withFileTypes: true });
	for (const it of items) {
		if (it.isFile()) {
			const s = path.join(srcDir, it.name);
			const d = path.join(destDir, it.name);
			if (!(await exists(d))) await fs.promises.copyFile(s, d);
		}
	}
}

async function copyTreeIfMissing(srcRoot, destRoot) {
	const stack = [{ src: srcRoot, dest: destRoot }];
	while (stack.length) {
		const { src, dest } = stack.pop();
		await ensureDir(dest);
		const entries = await fs.promises.readdir(src, { withFileTypes: true });
		for (const entry of entries) {
			const s = path.join(src, entry.name);
			const d = path.join(dest, entry.name);
			if (entry.isDirectory()) stack.push({ src: s, dest: d });
			else if (entry.isFile()) {
				if (!(await exists(d))) await fs.promises.copyFile(s, d);
			}
		}
	}
}

async function writeReadmeIfMissing(dir, isAdvancedMirror = false) {
	const readmePath = path.join(dir, "README.txt");
	if (await exists(readmePath)) return;
	const lines = [
		"This folder is managed by Water's Resource Swapper.",
		"",
		"Place your custom Krunker sound files here to override the game's defaults.",
		"Examples:",
		"  headshot_0.ogg",
		"  hit_0.ogg",
		"  kill_0.ogg",
		"  hitmarker_0.ogg",
		"",
		"Notes:",
		"- File names must match the exact asset names expected by Krunker.",
		"- Existing files will not be overwritten by the client.",
		isAdvancedMirror
			? "- This is the advanced-mode mirror path (assets.krunker.io/sound)."
			: "- This is the normal-mode path (/sound).",
		"- Supported formats are whatever Krunker loads for the given asset (commonly .ogg or .mp3).",
		"",
		"You can also pre-package defaults under app/default-swaps/sound when building the app."
	];
	await fs.promises.writeFile(readmePath, lines.join("\n"), "utf8");
}

async function exists(p) {
	try { await fs.promises.access(p, fs.constants.F_OK); return true; }
	catch (_) { return false; }
}

async function ensureDir(p) {
	await fs.promises.mkdir(p, { recursive: true }).catch(() => {});
}

module.exports = { seedDefaults };
