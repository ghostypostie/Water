import Module from '../module';
import { Context, RunAt } from '../context';
import { Client } from 'discord-rpc-revamp';
import Dropdown from '../options/dropdown';
import { ipcMain, ipcRenderer, app } from 'electron';
import Checkbox from '../options/checkbox';
import Button from '../options/button';
import RPCButtonsUI from '../ui/rpcButtons';

enum RPCMode {
    GameInvite,
    Buttons,
    Off,
}

export default class Discord extends Module {
    clientId = '1310915417312722984';
    client: Client | null = null;
    updateInterval = 2000;

    buttonUI = new RPCButtonsUI(this);

    name = 'Discord';
    id = 'discord';
    options = [
        new Dropdown(this, {
            name: 'Rich Presence Mode',
            id: 'mode',
            description: 'What to display on Discord',
            options: [
                {
                    name: 'Join Game Button',
                    value: RPCMode.GameInvite,
                },
                {
                    name: 'Custom Buttons',
                    value: RPCMode.Buttons,
                },
                {
                    name: 'Off',
                    value: RPCMode.Off,
                },
            ],
        }),
        new Checkbox(this, {
            name: 'Show match info',
            id: 'matchInfo',
            description: 'Show match info on Discord',
        }),
        new Checkbox(this, {
            name: 'Show time left',
            id: 'showTime',
            description: 'Show time left on Discord',
        }),
        new Checkbox(this, {
            name: 'Show lobby size',
            id: 'showLobbySize',
            description: 'Show lobby size on Discord',
        }),
        new Checkbox(this, {
            name: 'Show user info',
            id: 'showUser',
            description: 'Show username & class on Discord',
        }),
        new Button(this, {
            name: 'Buttons',
            id: 'buttons',
            description: 'Configure buttons',
            label: 'Edit',

            onChange: this.buttonUI.open.bind(this.buttonUI),
        }),
    ];

    contexts = [
        {
            context: Context.Common,
            runAt: RunAt.LoadStart,
        },
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        },
    ];

    connect() {
        console.log('[Discord] Attempting to connect to Discord RPC...');
        this.client
            .connect({ clientId: this.clientId })
            .then(() => {
                console.log('[Discord] Successfully connected to Discord RPC');
            })
            .catch((err) => {
                console.error('[Discord] Failed to connect to Discord RPC:', err);
                setTimeout(
                    this.connect.bind(this),
                    this.updateInterval
                );
            });
    }

    update(event: Electron.IpcMainEvent, activity: any) {
        let mode = this.config.get('mode', RPCMode.GameInvite);
        
        console.log('[Discord] Update called - Mode:', mode, 'Activity:', activity);
        
        if (mode === RPCMode.Off) {
            console.log('[Discord] RPC is disabled in settings');
            this.client.clearActivity();
            return;
        }
        
        let matchInfo = this.config.get('matchInfo', false);
        let showTime = this.config.get('showTime', false);
        let showUser = this.config.get('showUser', false);
        let showLobbySize = this.config.get('showLobbySize', false);

        let now = Date.now();
        const baseActivity = {
            largeImageKey: 'logo',
            largeImageText: app.getName() + ' v' + app.getVersion(),
        };

        const gameActivity = activity.id
            ? Object.assign(
                  {
                      ...baseActivity,

                      details: activity.comp
                          ? 'Competitive Game'
                          : activity.custom
                          ? 'Custom Game'
                          : 'Pubstomping',
                      state: matchInfo
                          ? activity.mode + ' - ' + activity.map
                          : 'Playing Krunker',
                  },
                  showTime
                      ? {
                            startTimestamp: now,
                            endTimestamp: now + activity.time * 1000,
                        }
                      : {},
                  showLobbySize
                      ? {
                            partySize: activity.players,
                            partyMax: activity.maxPlayers,
                            partyId: 'P-' + activity.id,
                        }
                      : {},
                  showUser
                      ? {
                            smallImageKey:
                                'https://assets.krunker.io/textures/classes/icon_' +
                                activity.class.index +
                                '.png',
                            smallImageText: activity.user,
                        }
                      : {}
              )
            : Object.assign({
                  ...baseActivity,

                  details: 'Not in game',
                  state: 'Idle',
              });

        switch (mode) {
            case RPCMode.GameInvite:
                console.log('[Discord] Setting activity with join button:', gameActivity);

                this.client.setActivity(
                    Object.assign(gameActivity, {
                        joinSecret: activity.id,
                    })
                ).catch(err => console.error('[Discord] Failed to set activity:', err));
                break;
            case RPCMode.Buttons:
                let buttons = this.config.get('buttons', {}) || {};
                let parsedButtons = [];

                for (let i = 0; i < 2; i++) {
                    if (!buttons[i]) continue;
                    let button = buttons[i];
                    if (!button.label || !button.url) continue;
                    parsedButtons.push({
                        label: button.label,
                        url: button.url,
                    });
                }

                console.log('[Discord] Setting activity with buttons:', parsedButtons);

                this.client
                    .setActivity(
                        Object.assign(gameActivity, {
                            buttons: parsedButtons,
                        })
                    )
                    .catch(err => console.error('[Discord] Failed to set activity:', err));
                break;
        }
    }

    main() {
        let { window: mainWindow } = require('../main');

        console.log('[Discord] Initializing Discord RPC module...');
        this.client = new Client();
        this.connect();

        this.client.on('close', () => {
            console.error('[Discord] RPC disconnected. Reconnecting...');
            setTimeout(() => this.connect(), this.updateInterval);
        });

        this.client.on('ready', () => {
            console.log('[Discord] RPC ready and connected!');
            this.client.subscribe('ACTIVITY_JOIN');
        });

        this.client.on('ACTIVITY_JOIN', ({ secret }) => {
            console.log('[Discord] Joining game ' + secret);
            mainWindow.loadURL('https://krunker.io/?game=' + secret);
        });

        ipcMain.on('updateRPC', this.update.bind(this));
        console.log('[Discord] RPC update listener registered');
    }

    renderer(): void {
        setInterval(async function () {
            let gameActivity = (typeof window.getGameActivity === 'function')
                ? window.getGameActivity() || {}
                : {};
            
            gameActivity.comp = !(
                document.getElementById('mMenuHolComp')?.style.display == 'none'
            );

            gameActivity.loggedIn =
                document.getElementById('signedOutHeaderBar')?.style.display ==
                'none';

            if (gameActivity.id) {
                let matchInfo = await fetch(
                    'https://matchmaker.krunker.io/game-info?game=' +
                        gameActivity.id
                )
                    .then((res) => res.json())
                    .catch(() => null);
                if (matchInfo && Array.isArray(matchInfo)) {
                    gameActivity.players = matchInfo[2];
                    gameActivity.maxPlayers = matchInfo[3];
                }
            }

            ipcRenderer.send('updateRPC', gameActivity);
        }, this.updateInterval);
    }
}
