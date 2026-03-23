"use strict";

let DiscordRPC = require("discord-rpc");
const logger = require("../utils/logger");

/**
 * Handles RPC start, stop and changes
 *
 * @class RPCHandler
 */
class RPCHandler {
	/**
	 * Creates an instance of RPCHandler.
	 *
	 * @param {string} rpcClientId
	 * @param {boolean} isEnabled
	 * @memberof RPCHandler
	 */
	constructor(rpcClientId, isEnabled) {
		DiscordRPC.register(rpcClientId);
		this.rpcClientId = rpcClientId;
		this.rpc = new DiscordRPC.Client({ transport: "ipc" });
		this.isEnabled = isEnabled;
	}

	/**
	 * Current RPC status
	 *
	 * @returns {boolean}
	 * @memberof RPCHandler
	 */
	rpcEnabled() {
		return this.isEnabled;
	}

	/**
	 * Update RPC activity
	 *
	 * @param {import("discord-rpc").Presence} activity
	 * @memberof RPCHandler
	 */
	async update(activity) {
		if (!this.isEnabled) return;
		console.log('[Water RPC] Updating activity:', activity);
		await this.rpc.setActivity(activity).catch(err => {
			// Suppress "connection closed" errors during shutdown
			if (err && err.message && err.message.includes('connection closed')) {
				return; // Silently ignore
			}
			console.error('[Water RPC] Update failed:', err);
		});
	}

	/**
	 * Start the RPC handler
	 *
	 * @returns {Promise<void>}
	 * @memberof RPCHandler
	 */
	async start() {
		if (!this.isEnabled) {
			console.log('[Water RPC] Disabled in settings');
			return;
		}
		console.log('[Water RPC] Starting with client ID:', this.rpcClientId);
		this.rpc.on("ready", () => {
			console.log('[Water RPC] Connected and ready');
		});
		await this.rpc.login({ clientId: this.rpcClientId }).catch(error => {
			console.error('[Water RPC] Login failed:', error);
			this.isEnabled = false;
		});
	}

	/**
	 * Ends the RPC handler
	 *
	 * @returns {Promise<void>}
	 * @memberof RPCHandler
	 */
	async end() {
		if (!this.isEnabled) return null;
		try {
			await this.rpc.clearActivity().catch(() => {});
			await this.rpc.destroy().catch(() => {});
		} catch (e) {
			// Silently ignore errors during shutdown
		}
	}
}

module.exports = RPCHandler;
