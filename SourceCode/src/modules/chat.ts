import { Context, RunAt } from '../context';
import Module from '../module';

export default class Chat extends Module {
    name = 'Chat Categories';
    id = 'chat';
    options = [];

    stylesheet = document.createElement('style');
    readonly categories = [
        {
            key: 'msg--player',
            name: 'Players',
            settName: 'player',
            col: '#00ff00',
        },
        {
            key: 'msg--killfeed',
            name: 'Killfeed',
            settName: 'kill feed',
            col: '#ff0000',
        },
        {
            key: 'msg--unbox',
            name: 'Unboxings',
            settName: 'unboxing',
            col: '#0000ff',
        },
        {
            key: 'msg--server',
            name: 'Server',
            settName: 'server',
            col: '#aa00ff',
        },
    ];

    contexts = [
        {
            context: Context.Game,
            runAt: RunAt.LoadEnd,
        },
    ];

    private activeFilters: Set<string> = new Set();
    private chatList: HTMLElement | null = null;
    private commandHint: HTMLElement | null = null;

    private readonly commands = [
        { cmd: '/players', desc: 'Filter Players Only', col: '#00ff00' },
        { cmd: '/kills', desc: 'Filter Killfeed Only', col: '#ff0000' },
        { cmd: '/unbox', desc: 'Filter Unboxings Only', col: '#0000ff' },
        { cmd: '/server', desc: 'Filter Server Only', col: '#aa00ff' },
        { cmd: '/twitch', desc: 'Toggle Twitch Chat Filter', col: '#9147FF' },
        { cmd: '/all', desc: 'Clear All Filters', col: '#ffffff' },
    ];

    private readonly commandMap: Record<string, string> = {
        '/players': 'msg--player',
        '/player': 'msg--player',
        '/killfeed': 'msg--killfeed',
        '/kills': 'msg--killfeed',
        '/kill': 'msg--killfeed',
        '/unbox': 'msg--unbox',
        '/unboxing': 'msg--unbox',
        '/unboxes': 'msg--unbox',
        '/server': 'msg--server',
        '/system': 'msg--server',
    };

    toggleCategory(category: string) {
        if (this.activeFilters.has(category)) {
            this.activeFilters.delete(category);
        } else {
            this.activeFilters.add(category);
        }
        this.applyFilters();
        this.showFilterNotification(category);
        this.updatePlaceholder();
    }

    private applyFilters() {
        this.stylesheet.textContent = `#chatUIHolder { display: block !important; }\n`;

        if (this.activeFilters.size > 0) {
            this.categories.forEach(cat => {
                if (!this.activeFilters.has(cat.key)) {
                    this.stylesheet.textContent += `#chatList > div.${cat.key} { display: none !important; }\n`;
                }
            });
        }
    }

    private showFilterNotification(categoryKey: string) {
        const category = this.categories.find(c => c.key === categoryKey);
        if (!category) return;

        const isActive = this.activeFilters.has(categoryKey);
        const filterCount = this.activeFilters.size;

        let text: string;
        if (isActive) {
            text = `Filtered ${category.name} Only!`;
        } else {
            text = filterCount === 0
                ? 'All Messages Visible'
                : `${category.name} Unfiltered`;
        }

        document.querySelectorAll('.chat-filter-notif').forEach(n => n.remove());

        const notif = document.createElement('div');
        notif.className = 'chat-filter-notif';
        notif.innerHTML = `<span style="color: ${category.col}; font-weight: bold;">[Filter]</span> <span style="color: rgba(255,255,255,0.85); margin-left: 6px;">${text}</span>`;
        notif.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000000;
            padding: 12px 24px;
            border-radius: 8px;
            background: rgba(0,0,0,0.9);
            border-left: 4px solid ${category.col};
            font-size: 15px;
            font-family: 'Segoe UI', Arial, sans-serif;
            opacity: 1;
            transition: opacity 0.3s ease;
            pointer-events: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;

        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => {
                if (notif.parentNode) notif.parentNode.removeChild(notif);
            }, 300);
        }, 2500);
    }

    private clearAllFilters() {
        this.activeFilters.clear();
        this.applyFilters();

        document.querySelectorAll('.chat-filter-notif').forEach(n => n.remove());

        const notif = document.createElement('div');
        notif.className = 'chat-filter-notif';
        notif.innerHTML = `<span style="color: #ffffff; font-weight: bold;">[Filter]</span> <span style="color: rgba(255,255,255,0.85); margin-left: 6px;">All Messages Visible</span>`;
        notif.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000000;
            padding: 12px 24px;
            border-radius: 8px;
            background: rgba(0,0,0,0.9);
            border-left: 4px solid #ffffff;
            font-size: 15px;
            font-family: 'Segoe UI', Arial, sans-serif;
            opacity: 1;
            transition: opacity 0.3s ease;
            pointer-events: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;

        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => {
                if (notif.parentNode) notif.parentNode.removeChild(notif);
            }, 300);
        }, 2500);

        this.updatePlaceholder();
    }

    private updatePlaceholder() {
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        if (!chatInput) return;

        if (this.activeFilters.size === 0) {
            chatInput.placeholder = 'Enter Message';
            return;
        }

        const filterNames: string[] = [];
        this.activeFilters.forEach(key => {
            const cat = this.categories.find(c => c.key === key);
            if (cat) filterNames.push(cat.name);
        });

        if (filterNames.length === 1) {
            chatInput.placeholder = `Showing ${filterNames[0]} Only`;
        } else {
            chatInput.placeholder = `Showing ${filterNames.join(', ')}`;
        }
    }

    categorizeMessage(elem: HTMLElement) {
        let msgNode = elem.firstChild;

        // Check if message has the server color (#fc03ec or similar purple variants)
        const msgSpan = elem.querySelector('.chatMsg');
        if (msgSpan) {
            const color = window.getComputedStyle(msgSpan).color;
            // Convert rgb to hex and check if it matches server message colors
            const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]);
                const g = parseInt(rgbMatch[2]);
                const b = parseInt(rgbMatch[3]);
                
                // Check for purple-ish colors (server messages)
                // #fc03ec = rgb(252, 3, 236) - bright magenta/purple
                // #aa00ff = rgb(170, 0, 255) - purple
                // Allow some tolerance for similar colors
                if (r > 150 && g < 50 && b > 200) {
                    elem.classList.add('msg--server');
                    return;
                }
            }
        }

        if (msgNode.childNodes.length > 1) elem.classList.add('msg--player');
        else {
            if (msgNode.firstChild.childNodes.length > 1) {
                if (
                    (msgNode.firstChild as HTMLElement).children.length > 1 &&
                    ![...msgNode.firstChild.childNodes].some(
                        (e) => e.nodeName === 'IMG'
                    )
                )
                    elem.classList.add('msg--unbox');
                else elem.classList.add('msg--killfeed');
            } else elem.classList.add('msg--server');
        }
    }

    renderer() {
        const elem = document.getElementById('chatList');
        if (!elem) return;

        this.chatList = elem;
        const mock = document.createElement('div');

        window.chatList = Object.defineProperties(
            {},
            {
                childNodes: {
                    get: () =>
                        [...elem.childNodes].filter((e) =>
                            (e as HTMLElement).classList?.contains(
                                'vanillaChatMsg'
                            )
                        ),
                },
                removeChild: {
                    value: elem.removeChild.bind(elem),
                },
                insertAdjacentElement: {
                    value: (position: InsertPosition, element: HTMLElement) => {
                        element.classList.add('vanillaChatMsg');
                        this.categorizeMessage(element);

                        mock.insertAdjacentElement(
                            position,
                            document.createElement('div')
                        );
                        elem.insertAdjacentElement(position, element);
                    },
                },
                scrollHeight: {
                    get: () => elem.scrollHeight,
                },
                scrollTop: {
                    set: (v) => (elem.scrollTop = v),
                },
                clientHeight: {
                    get: () => elem.clientHeight,
                },
                style: {
                    get: () =>
                        new Proxy(mock.style, {
                            set: (target, prop, value) => {
                                elem.style[prop as any] = value;
                                return Reflect.set(target, prop, value);
                            },
                        }),
                },
            }
        ) as any;

        document.head.appendChild(this.stylesheet);
        this.applyFilters();
        this.setupCommandHint();
        this.interceptChatCommands();
        this.bypassGuestChat();
    }

    private bypassGuestChat() {
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        if (!chatInput) return;

        Object.defineProperty(chatInput, 'disabled', {
            set: () => {},
            get: () => false,
        });
        Object.defineProperty(chatInput, 'readOnly', {
            set: () => {},
            get: () => false,
        });

        chatInput.disabled = false;
        chatInput.readOnly = false;
        chatInput.style.pointerEvents = 'auto';
        chatInput.style.opacity = '1';
    }

    private setupCommandHint() {
        if (!this.chatList) return;

        this.commandHint = document.createElement('div');
        this.commandHint.id = 'chatCommandHint';
        this.commandHint.style.display = 'none';
        this.commandHint.innerHTML = `
            ${this.commands.map(c => `
                <div class="chat-cmd-row" data-cmd="${c.cmd}" style="direction: ltr; cursor: pointer; padding: 8px 10px; margin: 4px 12px; border-radius: 3px; background: transparent; transition: background 0.15s; font-size: 14px;">
                    <span style="color: ${c.col}; font-weight: bold;">${c.cmd}</span>
                    <span style="color: rgba(255,255,255,0.4); margin-left: 6px;">- ${c.desc}</span>
                </div>
            `).join('')}
        `;

        this.commandHint.querySelectorAll('.chat-cmd-row').forEach(row => {
            row.addEventListener('mouseenter', () => {
                (row as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
            });
            row.addEventListener('mouseleave', () => {
                (row as HTMLElement).style.background = 'transparent';
            });
            row.addEventListener('click', () => {
                const chatInput = document.getElementById('chatInput') as HTMLInputElement;
                if (!chatInput) return;
                const cmd = (row as HTMLElement).dataset.cmd;
                if (!cmd) return;

                if (cmd === '/all') {
                    this.clearAllFilters();
                } else if (cmd === '/twitch') {
                    // Trigger Twitch filter toggle
                    window.dispatchEvent(new CustomEvent('twitch-filter-toggle'));
                } else {
                    const cat = this.commandMap[cmd];
                    if (cat) this.toggleCategory(cat);
                }
                chatInput.value = '';
                this.hideCommandHint();
            });
        });

        this.chatList.appendChild(this.commandHint);

        const observer = new MutationObserver(() => {
            if (this.commandHint && this.chatList && this.commandHint.style.display !== 'none') {
                const lastChild = this.chatList.lastElementChild;
                if (lastChild !== this.commandHint) {
                    this.chatList.appendChild(this.commandHint);
                }
            }
        });
        observer.observe(this.chatList, { childList: true });
    }

    private showCommandHint() {
        if (this.commandHint && this.chatList) {
            this.commandHint.style.display = 'block';
            this.chatList.appendChild(this.commandHint);
            this.chatList.scrollTop = this.chatList.scrollHeight;
        }
    }

    private hideCommandHint() {
        if (this.commandHint) {
            this.commandHint.style.display = 'none';
        }
    }

    private interceptChatCommands() {
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        if (!chatInput) return;

        const checkHint = () => {
            if (chatInput.value === '/') {
                this.showCommandHint();
            } else {
                this.hideCommandHint();
            }
        };

        chatInput.addEventListener('input', checkHint);
        chatInput.addEventListener('keyup', checkHint);
        chatInput.addEventListener('blur', () => this.hideCommandHint());
        chatInput.addEventListener('focus', checkHint);

        chatInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hideCommandHint();
                return;
            }

            if (e.key !== 'Enter') return;

            const value = chatInput.value.trim().toLowerCase();
            if (!value) {
                this.hideCommandHint();
                return;
            }

            if (!value.startsWith('/')) {
                this.hideCommandHint();
                return;
            }

            if (value === '/all') {
                e.preventDefault();
                e.stopPropagation();
                this.clearAllFilters();
                chatInput.value = '';
                this.hideCommandHint();
                return;
            }

            // Handle /twitch command - delegate to Twitch module
            if (value === '/twitch') {
                e.preventDefault();
                e.stopPropagation();
                chatInput.value = '';
                this.hideCommandHint();
                
                // Trigger custom event for Twitch module to handle
                window.dispatchEvent(new CustomEvent('twitch-filter-toggle'));
                return;
            }

            const categoryKey = this.commandMap[value];
            if (!categoryKey) {
                chatInput.value = '';
                this.hideCommandHint();
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            this.toggleCategory(categoryKey);
            chatInput.value = '';
            this.hideCommandHint();
        }, true);
    }
}
