// @ts-nocheck
"use strict";
let UtilManager = require("../modules/util-manager");
// RecordingSystem removed

module.exports = {
	disableFrameRateLimit: {
		name: "Disable Frame Rate Limit",
		id: "disableFrameRateLimit",
		cat: "Performance",
		type: "checkbox",
		val: true,
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		}
	},

	// Recording settings removed

	// Ad Block settings
	adBlock: {
		name: "Enable Ad Block",
		id: "adBlock",
		cat: "Ad Block",
		type: "checkbox",
		val: false,
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Block ads from showing up in the game using hosts-based blocklist"
	},
	adblockURL: {
		name: "Blocklist URL",
		id: "adblockURL",
		cat: "Ad Block",
		type: "text",
		val: "https://blocklistproject.github.io/Lists/ads.txt",
		placeholder: "https://...",
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "URL to hosts file for ad blocking"
	},

	// Ranked settings
	autoFocusRanked: {
		name: "Auto-Focus on Match Found",
		id: "autoFocusRanked",
		cat: "Ranked",
		type: "checkbox",
		val: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Automatically brings the game window to focus when a match is found"
	},
	instaLockClass: {
		name: "Insta-Lock Class",
		id: "instaLockClass",
		cat: "Ranked",
		type: "select",
		options: {
			"-1": "Disabled",
			"0": "Triggerman (Assault Rifle)",
			"1": "Hunter (Sniper)",
			"2": "Run N Gun (SMG)",
			"3": "Spray N Pray (LMG)",
			"5": "Detective (Revolver)",
			"6": "Marksman (Semi)",
			"8": "Agent (UZI)",
			"12": "Commando (Famas)",
			"13": "Trooper (Blaster)"
		},
		val: "-1",
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Automatically select this class when a ranked match is found"
	},

	// Better Matchmaker settings
	betterMatchmaker_enabled: {
		name: "Enable Better Matchmaker",
		id: "betterMatchmaker.enable",
		cat: "Matchmaker",
		type: "checkbox",
		val: false,
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Automatically find and join best game based on filters when pressing F6"
	},
	betterMatchmaker_minTime: {
		name: "Minimum Time (minutes)",
		id: "betterMatchmaker.minTime",
		cat: "Matchmaker",
		type: "slider",
		min: 0,
		max: 60,
		step: 1,
		val: 2,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Minimum time remaining in game"
	},
	betterMatchmaker_minPlayers: {
		name: "Minimum Players",
		id: "betterMatchmaker.minPlayers",
		cat: "Matchmaker",
		type: "slider",
		min: 0,
		max: 100,
		step: 1,
		val: 0,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Minimum number of players in game"
	},
	betterMatchmaker_maxPlayers: {
		name: "Maximum Players",
		id: "betterMatchmaker.maxPlayers",
		cat: "Matchmaker",
		type: "slider",
		min: 1,
		max: 100,
		step: 1,
		val: 8,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Maximum number of players in game"
	},
	betterMatchmaker_allowCustoms: {
		name: "Allow Custom Games",
		id: "betterMatchmaker.allowCustoms",
		cat: "Matchmaker",
		type: "checkbox",
		val: false,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Allow joining custom games"
	},
	betterMatchmaker_allowOfficialCustoms: {
		name: "Allow Official Customs",
		id: "betterMatchmaker.allowOfficialCustoms",
		cat: "Matchmaker",
		type: "checkbox",
		val: false,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Allow joining official custom games"
	},
	betterMatchmaker_gamemodes: {
		name: "Gamemodes",
		id: "betterMatchmaker.gamemodes",
		cat: "Matchmaker",
		type: "button",
		val: "Edit",
		html() {
			return `<div class="settingsBtn" onclick="openMatchmakerModes()">Edit</div>`;
		},
		info: "Select which game modes to join"
	},
	betterMatchmaker_maps: {
		name: "Maps",
		id: "betterMatchmaker.maps",
		cat: "Matchmaker",
		type: "button",
		val: "Edit",
		html() {
			return `<div class="settingsBtn" onclick="openMatchmakerMaps()">Edit</div>`;
		},
		info: "Select which maps to join"
	},
	betterMatchmaker_regions: {
		name: "Regions",
		id: "betterMatchmaker.regions",
		cat: "Matchmaker",
		type: "button",
		val: "Edit",
		html() {
			return `<div class="settingsBtn" onclick="openMatchmakerRegions()">Edit</div>`;
		},
		info: "Select which regions to join"
	},

	acceleratedCanvas: {
		name: "Accelerated Canvas",
		id: "acceleratedCanvas",
		cat: "Performance",
		type: "checkbox",
		val: true,
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Enables the use of the GPU to perform 2d canvas rendering instead of using software rendering."
	},
	removeAnimations: {
		name: "Remove Animations",
		id: "removeAnimations",
		cat: "Performance",
		type: "checkbox",
		val: false,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Disables all CSS animations and transitions in Krunker and the client UI for a potential FPS boost.",
		set: (val) => {
			const STYLE_ID = 'water-no-animations';
			if (val) {
				if (!document.getElementById(STYLE_ID)) {
					const style = document.createElement('style');
					style.id = STYLE_ID;
					style.textContent = `
*, *::before, *::after {
  animation: none !important;
  animation-name: none !important;
  animation-duration: 0.001ms !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  animation-play-state: paused !important;
  animation-fill-mode: none !important;
  transition: none !important;
  transition-duration: 0.001ms !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}`;
					document.head.appendChild(style);
				}
			} else {
				const el = document.getElementById(STYLE_ID);
				if (el) el.remove();
			}
		}
	},
    enablePerformanceOptimizations: {
        name: "Performance Mode",
        id: "enablePerformanceOptimizations",
        cat: "Performance",
        type: "checkbox",
        val: true,
        needsRestart: true,
        html() {
            return UtilManager.instance.clientUtils.genCSettingsHTML(this);
        },
        info: "Enables advanced performance tweaks (Uncapped FPS, Lower Latency, GPU Rasterization)"
    },
	angleBackend: {
		name: "ANGLE Graphics Backend",
		id: "angleBackend",
		cat: "Performance",
		platforms: ["win32", "linux", "darwin"],
		type: "select",
		// https://chromium.googlesource.com/angle/angle#platform-support-via-backing-renderers
		options: {
			"default": "Default",
			gl: "OpenGL (Windows, Linux, MacOS)",
			d3d11: "D3D11 (Windows-Only)",
			d3d9: "D3D9 (Windows-Only)",
			d3d11on12: "D3D11on12 (Windows, Linux)",
			vulkan: "Vulkan (Windows, Linux)",
			metal: "Metal (MacOS-Only)"
		},
		val: "d3d11",
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Choose the graphics backend for ANGLE. D3D11 is used on most Windows computers by default. Using the OpenGL driver as the graphics backend may result in higher performance, particularly on NVIDIA GPUs. It can increase battery and memory usage of video playback."
	},
	colorProfile: {
		name: "Color Profile",
		id: "colorProfile",
		cat: "Chromium",
		type: "select",
		options: {
			"default": "Default",
			srgb: "sRGB",
			"display-p3-d65": "Display P3 D65",
			"color-spin-gamma24": "Color spin with gamma 2.4"
		},
		val: "default",
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Forces color profile."
	},
	debugLogging: {
		name: "Debug Logging",
		id: "debugLogging",
		cat: "Chromium",
		type: "checkbox",
		val: false,
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Enable detailed console logging for debugging. Disable for cleaner console output."
	},
	inProcessGPU: {
		name: "In-Process GPU",
		id: "inProcessGPU",
		cat: "Chromium",
		type: "checkbox",
		val: false,
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Run the GPU process as a thread in the browser process. Using this may help with window capture. Known to have issues with some Linux machines."
	},
	chromiumFlags: {
		name: "Chromium Flags",
		id: "chromiumFlags",
		cat: "Chromium",
		type: "text",
		val: "",
		placeholder: "--flag=value",
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Additional Chromium flags."
	},

	showExitButton: {
		name: "Show Exit Button",
		id: "showExitButton",
		cat: "Interface",
		type: "checkbox",
		val: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		set: val => {
			let btn = document.getElementById("clientExit");
			if (btn) btn.style.display = val ? "flex" : "none";
		}
	},
	showAltManagerButton: {
		name: "Show Alt-Manager Button",
		id: "showAltManagerButton",
		cat: "Interface",
		type: "checkbox",
		val: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		set: val => {
			let btn = document.getElementById("accManagerBtn");
			if (btn) btn.style.display = val ? "block" : "none";
		}
	},
	enableMenuTimer: {
		name: "Always show Menu-Timer",
		id: "enableMenuTimer",
		cat: "Interface",
		type: "checkbox",
		val: true,
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		}
	},
	fullscreen: {
		name: "Display Mode",
		id: "fullscreen",
		cat: "Interface",
		type: "select",
		options: {
			windowed: "Windowed",
			maximized: "Maximized",
			fullscreen: "Fullscreen",
			borderless: "Borderless"
		},
		val: "windowed",
		needsRestart: false,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Start in Windowed/Maximized/Fullscreen/Borderless mode. Use 'borderless' if you have client-capped fps and unstable fps in fullscreen.",
		set: (val) => {
			const { remote } = require('electron');
			const win = remote.getCurrentWindow();
			const { screen } = remote;
			
			try {
				switch (val) {
					case "fullscreen":
						if (!win.isFullScreen()) {
							win.setFullScreen(true);
						}
						break;
					case "maximized":
						if (win.isFullScreen()) {
							win.setFullScreen(false);
						}
						if (!win.isMaximized()) {
							win.maximize();
						}
						break;
					case "borderless":
						if (win.isFullScreen()) {
							win.setFullScreen(false);
						}
						const bounds = screen.getPrimaryDisplay().bounds;
						win.setFullScreenable(false);
						win.setBounds({
							x: 0,
							y: 0,
							width: bounds.width,
							height: bounds.height
						});
						win.moveTop();
						break;
					case "windowed":
					default:
						if (win.isFullScreen()) {
							win.setFullScreen(false);
						}
						if (win.isMaximized()) {
							win.unmaximize();
						}
						win.setFullScreenable(true);
						break;
				}
			} catch (e) {
				console.error('[Water] Failed to change display mode:', e);
			}
		}
	},
	discordRPC: {
		name: "Discord Rich Presence",
		id: "discordRPC",
		cat: "Discord",
		type: "checkbox",
		val: true,
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		}
	},
	waterBotHelper: {
		name: "Help Tron Bot to carry information (Under Development)",
		id: "tronBotHelper",
		cat: "Discord",
		type: "checkbox",
		val: false,
		disabled: true,
		hide: true, // Hidden from settings UI
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Share game stats and access token with Tron Discord Bot (localhost only)",
		set: (val) => {
			// Disabled - no longer functional
		}
	},
	autoUpdate: {
		name: "Auto Update Behavior",
		id: "autoUpdate",
		cat: "Maintenance",
		type: "select",
		options: {
			download: "Download",
			check: "Check only",
			skip: "Skip"
		},
		val: "download",
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		}
	},
	enableUserscripts: {
		name: "Enable Userscripts",
		id: "enableUserscripts",
		cat: "Maintenance",
		type: "checkbox",
		val: false,
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		}
	},
	userscriptsPath: {
		name: "Userscripts Path",
		id: "userscriptsPath",
		cat: "Maintenance",
		type: "text",
		val: "",
		placeholder: "Userscripts Folder Path",
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		}
	},
	killstreakMuteKeywords: {
		name: "Killstreak Mute Keywords",
		id: "killstreakMuteKeywords",
		cat: "Maintenance",
		type: "text",
		val: "valorant,killstreak",
		placeholder: "comma-separated script ids/names",
		info: "Separated by Comma",
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		}
	},
	resourceSwapperMode: {
		name: "Resource Swapper Mode",
		id: "resourceSwapperMode",
		cat: "Maintenance",
		type: "select",
		options: {
			normal: "Normal",
			advanced: "Advanced",
			disabled: "Disabled"
		},
		val: "normal",
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		}
	},
	resourceSwapperPath: {
		name: "Resource Swapper Path",
		id: "resourceSwapperPath",
		cat: "Maintenance",
		type: "text",
		val: "",
		placeholder: "Resource Swapper Folder Path",
		needsRestart: true,
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		}
	},

	// Twitch Chat Integration
	twitchChannel: {
		name: "Twitch Chat Integration",
		id: "twitchChannel",
		cat: "Chat",
		type: "text",
		val: "",
		placeholder: "Channel Name",
		html() {
			return UtilManager.instance.clientUtils.genCSettingsHTML(this);
		},
		info: "Enter a Twitch channel name to display its chat in Krunker",
		set: (val) => {
			localStorage.setItem("water_twitch_channel", val);
			// Reconnect to new channel
			if (window.waterTwitchChat) {
				window.waterTwitchChat.disconnect();
				if (val && val.trim() !== '') {
					window.waterTwitchChat.connect(val);
				}
			}
		}
	}
};
