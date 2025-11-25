# Water
[![Discord server](https://discord.com/api/guilds/697366856914173994/widget.png)](https://discord.gg/wEZbFFX)

Fresh Water Available.

This client aims for:
- Stable behavior and performance
- Advanced customizability (settings and userscripts)
- Constructive to the community (open source; under [AGPL-3.0](https://github.com/Water-client/Water/blob/master/LICENSE))

## Best Features

### Quick Play (F4)
Press **F4** to instantly join a random public game with complete customization:
- Filter by **player count** (min/max)
- Filter by **game modes** (FFA, TDM, CTF, etc.)
- Filter by **remaining time**
- **Force current region** option
- Avoid rejoining the same game

### WebSocket Ranked Matchmaking
Click "**CLICK TO PLAY**" to queue for ranked games via direct WebSocket connection:
- Connects to official Krunker matchmaking service
- Real-time **queue status** updates
- **Toggle queue** by clicking again
- Handles **errors and cooldowns** gracefully
- Button shows "**Leave Queue**" when active

### Twitch Chat Integration
Display **Twitch stream chat** directly in Krunker's in-game chat:
- Real-time IRC WebSocket connection
- **Purple usernames** (#B500B5) for easy distinction
- **Auto-reconnect** on disconnect
- **Duplicate message filtering** (last 50 messages)
- Configure via **Client Settings → Chat**

### Water Customizations
Custom theme and UI toggle system:
- **8 UI toggles**: Hide ADs, Terms Info, Signup Alerts, Social/Trading, Community, Games, Stream Container, Quick Match
- **Community CSS themes** support
- **Scripts section** for custom functionality
- Click outside window to close
- Modern dark UI (#353535 background)

### Performance Optimizations
- **Lightweight DevTools** (F12) - Opens in detached mode for minimal impact
- **Uncapped FPS** support
- **ANGLE Graphics Backend** selection
- **Accelerated Canvas** option
- **In-Process GPU** mode

### Advanced Settings
- **Discord Rich Presence**
- **Auto-Update** behavior control
- **Userscripts** support
- **Resource Swapper** (Normal/Advanced modes)
- **Chromium Flags** customization
- **Display Mode** options (Windowed/Maximized/Fullscreen/Borderless)

### Discord Bot Integration
Share game stats with Water Discord Bot (optional):
- **Profile statistics**
- **Clan information**
- **Leaderboard data**
- **Ranked leaderboard** stats
- Localhost-only WebSocket (no external hosting needed)

## Screenshots

### Quick Play Feature
![Quick Play in action](screenshots/quickplay.png)

### Twitch Chat Integration
![Twitch chat in Krunker](screenshots/twitch-chat.png)

### Water Customizations Window
![Customization menu](screenshots/water-window.png)
```

### Tips
- Use **descriptive alt text** in square brackets
- Keep images at reasonable resolution (1920x1080 or smaller)
- Use PNG for UI screenshots, JPG for game screenshots
- Organize images in a dedicated folder for easy management

---

## Supported Platforms
| Platform | File Type |
|-|-|
| Windows | `exe` |
| macOS | `dmg` |
| Linux | `AppImage` |