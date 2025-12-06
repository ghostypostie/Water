"use strict";

/**
 * Enhanced Account Manager for Water Client
 * Stores accounts with encryption and color-coding
 * 
 * @class AccountManager
 */
class AccountManager {
	constructor() {
		this.button = document.createElement("div");
		this.button.id = "accManagerBtn";
		this.button.textContent = "Alt-Manager";
		this.button.classList.add("button", "buttonB", "bigShadowT");
		this.button.setAttribute("onmouseenter", "playTick()");
		this.button.style.cssText =
			"display:block;width:450px;text-align:center;padding:15px;font-size:25px;pointer-events:all;padding-bottom:22px;margin-left:300px;margin-top:0px";

		this.container = document.createElement("div");
		this.accounts = JSON.parse(localStorage.getItem("accounts") || "[]");

		// Don't call injectStyles here - it will be called from game.js when DOM is ready
	}

	/**
	 * Encode string with character shifting
	 * @param {string} decoded 
	 * @returns {string}
	 */
	encode(decoded) {
		const key = decoded.length;
		const encoded = decoded
			.split("")
			.map((char) => String.fromCharCode(char.charCodeAt(0) + key))
			.join("");
		return encodeURIComponent(encoded);
	}

	/**
	 * Decode string with character shifting
	 * @param {string} encoded 
	 * @returns {string}
	 */
	decode(encoded) {
		const username = decodeURIComponent(encoded);
		const key = username.length;
		return username
			.split("")
			.map((char) => String.fromCharCode(char.charCodeAt(0) - key))
			.join("");
	}

	/**
	 * Create new account
	 */
	createNewAccount() {
		let username = document.querySelector("#accName")?.value || "";
		let password = document.querySelector("#accPass")?.value || "";
		const color = document.querySelector("#color-picker")?.value || "#FFC147";

		if (username.replace(/\s/, "") === "" || password.replace(/\s/, "") === "") {
			this.switchTabs();
			return;
		}
		if (this.accounts.some((account) => this.decode(account.username) === username)) {
			alert("This username has already been added.");
			return;
		}

		const encodedUsername = this.encode(username);
		const encodedPassword = this.encode(password);

		this.accounts.push({ username: encodedUsername, password: encodedPassword, color });
		localStorage.setItem("accounts", JSON.stringify(this.accounts));
		this.resetForm();
		this.updateAccounts();
		this.switchTabs();
	}

	/**
	 * Handle account selection and auto-login
	 * @param {HTMLElement} element 
	 */
	handleAccountSelection(element) {
		const account = this.accounts.find((acc) => this.decode(acc.username) === element.textContent);
		if (!account) return;

		this.removeWindow();

		// Trigger Krunker login dialog
		if (typeof window.loginOrRegister === 'function') {
			window.loginOrRegister();
		}

		setTimeout(() => {
			// Switch to login tab if on register
			const toggleBtn = document.querySelector(".auth-toggle-btn");
			if (toggleBtn && toggleBtn.textContent.includes("username")) {
				toggleBtn.click();
			}

			setTimeout(() => {
				const nameInput = document.querySelector("#accName");
				const passInput = document.querySelector("#accPass");

				if (nameInput && passInput) {
					nameInput.value = this.decode(account.username);
					passInput.value = this.decode(account.password);
					// Dispatch input events so Krunker recognizes the values
					nameInput.dispatchEvent(new Event("input", { bubbles: true }));
					passInput.dispatchEvent(new Event("input", { bubbles: true }));

					// Auto-submit
					const submitBtn = document.querySelector(".io-button");
					if (submitBtn) submitBtn.click();
				}
			}, 50);
		}, 50);
	}

	/**
	 * Reset form fields
	 */
	resetForm() {
		const colorPicker = document.querySelector("#color-picker");
		const usernameInput = document.querySelector("#username");
		const passwordInput = document.querySelector("#password");

		if (colorPicker) {
			colorPicker.value = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`;
		}
		if (usernameInput) usernameInput.value = "";
		if (passwordInput) passwordInput.value = "";
	}

	/**
	 * Switch between account list and creation form
	 */
	switchTabs() {
		const containerTab = document.querySelector("#accountContainerTab");
		const creatorTab = document.querySelector("#accountCreatorTab");
		if (containerTab) containerTab.classList.toggle("hidden");
		if (creatorTab) creatorTab.classList.toggle("hidden");
	}

	/**
	 * Update accounts display
	 */
	updateAccounts() {
		const accountContainer = document.querySelector("#accountContainer");
		if (!accountContainer) return;

		while (accountContainer.children.length > 0) {
			accountContainer.removeChild(accountContainer.children[0]);
		}

		for (const account of this.accounts) {
			const accountHolder = document.createElement("div");
			accountHolder.classList.add("accountHolder");
			accountHolder.style.color = account.color;
			accountHolder.textContent = this.decode(account.username);
			accountContainer.append(accountHolder);
		}
	}

	/**
	 * Remove account window
	 */
	removeWindow() {
		this.container.removeEventListener("contextmenu", this.removeAccount);
		document.removeEventListener("click", this.handleMenuClick);
		this.container.remove();
	}

	/**
	 * Handle menu clicks
	 * @param {Event} event 
	 */
	handleMenuClick = (event) => {
		const clickedElement = event.target;
		if (clickedElement.classList.contains("accountHolder")) {
			this.handleAccountSelection(clickedElement);
		} else {
			switch (clickedElement.id) {
				case "newAccountButton":
					this.switchTabs();
					break;
				case "createAccountButton":
					this.createNewAccount();
					break;
				case "accountMenu":
				case "windowHolder":
				case "accountContainer":
					this.removeWindow();
					break;
			}
		}
	};

	/**
	 * Remove account via right-click
	 * @param {Event} event 
	 */
	removeAccount = (event) => {
		event.preventDefault();
		const clickedElement = event.target;
		if (clickedElement.classList.contains("accountHolder")) {
			const index = this.accounts.findIndex(
				(account) => this.decode(account.username) === clickedElement.textContent
			);
			if (index > -1) {
				if (confirm(`Remove account "${clickedElement.textContent}"?`)) {
					this.accounts.splice(index, 1);
					localStorage.setItem("accounts", JSON.stringify(this.accounts));
					this.updateAccounts();
				}
			}
		}
	};

	/**
	 * Create and show account menu
	 */
	createMenu = () => {
		// Create HTML structure inline
		const menuHTML = `
			<div id="accountMenu" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 999999; display: flex; align-items: center; justify-content: center;">
				<div id="windowHolder" style="background: #2c2c2c; border-radius: 8px; padding: 20px; min-width: 400px; max-width: 500px; max-height: 80vh; overflow-y: auto;">
					<h2 style="color: #fff; margin: 0 0 20px 0; text-align: center;">Alt-Manager</h2>
					
					<div id="accountContainerTab">
						<div id="accountContainer" style="margin-bottom: 15px; max-height: 300px; overflow-y: auto; overflow-x: hidden;"></div>
						<button id="newAccountButton" class="button buttonB" style="width: 100%; padding: 15px 0px 50px 0px; color: white; font-size: 18px; text-align: center;">Add New Account</button>
					</div>

					<div id="accountCreatorTab" class="hidden">
						<h3 style="color: #fff; margin-bottom: 15px;">Add Account</h3>
						<input id="accName" type="text" placeholder="Username" class="accountInput" style="width: 100%; padding: 10px; margin-bottom: 10px; border: none; border-radius: 4px; background: #fff; color: #000;">
                        <input id="accPass" type="password" placeholder="Password (Hidden)" class="accountInput" style="width: 100%; padding: 10px; margin-bottom: 10px; border: none; border-radius: 4px; background: #fff; color: #000;">
						<div style="display: flex; align-items: center; margin-bottom: 10px;">
							<span style="color: #fff; margin-right: 10px;">Color:</span>
							<input id="color-picker" type="color" value="#FFC147" style="flex-grow: 1; height: 40px; cursor: pointer; border: none; border-radius: 4px;">
						</div>
						<button id="createAccountButton" class="button buttonB" style="width: 100%; padding: 15px 0px 50px 0px; margin-bottom: 10px;">Create Account</button>
						<button id="cancelAccountButton" class="button" style="width: 100%; padding: 15px 0px 50px 0px; background: #444; color: #fff; border: none; border-radius: 4px; cursor: pointer;" onclick="document.getElementById('newAccountButton').click()">Cancel</button>
					</div>
				</div>
			</div>
		`;

		this.container.innerHTML = menuHTML;
		document.body.append(this.container);
		this.updateAccounts();
		this.container.addEventListener("contextmenu", this.removeAccount);
		document.addEventListener("click", this.handleMenuClick);

		// Set random color
		const colorPicker = document.querySelector("#color-picker");
		if (colorPicker) {
			colorPicker.value = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`;
		}
	};

	/**
	 * Inject styles and button
	 */
	injectStyles() {
		const style = document.createElement("style");
		style.textContent = `
			.accountHolder {
				padding: 12px 15px;
				margin: 8px 10px 8px 0;
				background: rgba(255,255,255,0.1);
				border-radius: 6px;
				cursor: pointer;
				transition: all 0.2s;
				font-size: 18px;
				font-weight: bold;
			}
			.accountHolder:hover {
				background: rgba(255,255,255,0.2);
				transform: translateX(5px);
			}
			.accountInput {
				background: rgba(255,255,255,0.9);
				color: #000;
				font-size: 16px;
			}
			.hidden {
				display: none !important;
			}
		`;
		document.head.appendChild(style);

		// Inject button after customize button
		const customizeBtn = document.getElementById("customizeButton");
		if (customizeBtn) {
			customizeBtn.parentNode.insertBefore(this.button, customizeBtn.nextSibling);
			this.button.addEventListener("click", () => this.createMenu());
		}
	}
}

module.exports = AccountManager;
