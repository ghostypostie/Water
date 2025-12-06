"use strict";

let { BrowserWindow, ipcMain, app, dialog, globalShortcut } = require("electron");
let path = require("path");
let { exec } = require("child_process");

let BrowserLoader = require("./browser-loader");
let RPCHandler = require("../modules/rpc-handler");

let botClientInstance = null;

class IpcLoader {
    /**
     * Initializes IPC event handlers
     *
     * @param {import("electron-store")} config
     */
    static load(config) {
        ipcMain.handle("get-app-info", () => ({
            name: app.name,
            version: app.getVersion(),
            documentsDir: app.getPath("documents")
        }));

        ipcMain.on("get-path", (event, name) => (event.returnValue = app.getPath(name)));

        ipcMain.on("prompt", (event, message, defaultValue) => {
            let promptWin = BrowserLoader.initPromptWindow(message, defaultValue, config);
            let returnValue = null;

            ipcMain.on("prompt-return", (_, value) => (returnValue = value));

            promptWin.on("closed", () => (event.returnValue = returnValue));
        });

        ipcMain.handle("set-bounds", (event, bounds) => BrowserWindow
            .fromWebContents(event.sender)
            .setBounds(bounds));

        // Allow renderer to persist config keys (e.g., ffmpegPath)
        ipcMain.on("set-config", (_event, { key, value }) => {
            try { config.set(String(key), value); } catch (e) { console.error("[Config] set-config error:", e); }
        });

        // Recording system IPC handlers
        this.setupRecordingHandlers(config);

        // Bot setting change handler
        ipcMain.on("bot-setting-changed", (_event, enabled) => {
            if (botClientInstance) {
                botClientInstance.onSettingChanged(enabled);
            }
        });

        // Matchmaker trigger handler
        ipcMain.on("trigger-matchmaker", () => {
            const matchmaker = require("../modules/matchmaker");
            const windows = BrowserWindow.getAllWindows();
            const mainWindow = windows.find(w => w.webContents.getURL().includes('krunker.io')) || windows[0];
            if (mainWindow && config.get('betterMatchmaker.enable', false)) {
                matchmaker(mainWindow);
            } else if (mainWindow) {
                mainWindow.loadURL('https://krunker.io');
            }
        });

        // Register F4 global shortcut for matchmaker
        app.whenReady().then(() => {
            try {
                globalShortcut.register('F4', () => {
                    const matchmaker = require("../modules/matchmaker");
                    const windows = BrowserWindow.getAllWindows();
                    const mainWindow = windows.find(w => w.webContents.getURL().includes('krunker.io')) || windows[0];
                    if (mainWindow && config.get('betterMatchmaker.enable', false)) {
                        matchmaker(mainWindow);
                    } else if (mainWindow) {
                        mainWindow.loadURL('https://krunker.io');
                    }
                });
                console.log('[Water] F4 matchmaker shortcut registered');
            } catch (e) {
                console.error('[Water] Failed to register F4 shortcut:', e);
            }
        });

        // No app menu – we keep the window clean and use in-game Settings > Water

    }

    static setBotClient(client) {
        botClientInstance = client;
    }

    /**
     * Initializes Discord RPC
     *
     * @param {import("electron-store")} config
     */
    static initRpc(config) {
        let rpcHandler = new RPCHandler(
            "770954802443059220",
            /** @type {boolean} */
            (config.get("discordRPC", true))
        );

        // @TODO: This might deadlock!!!
        let lastSender = null;
        ipcMain.handle("rpc-activity", async (event, activity) => {
            if (rpcHandler.rpcEnabled()) {
                if (lastSender !== event.sender) {
                    if (lastSender) lastSender.send("rpc-stop");
                    lastSender = event.sender;
                    lastSender.on("destroyed", () => (lastSender = null));
                }
                await rpcHandler.update(activity);
            }
        });

        ipcMain.on("bot-token-update", (event, token) => {
            if (botClientInstance) {
                botClientInstance.updateToken(token);
            }
        });

        ipcMain.on("bot-player-name-update", (event, name) => {
            if (botClientInstance) {
                botClientInstance.updatePlayerName(name);
            }
        });

        app.once("ready", async () => await rpcHandler.start());
        app.on("quit", async () => await rpcHandler.end());
    }

    /**
     * Setup recording system IPC handlers and shortcuts
     *
     * @param {import("electron-store")} config
     */
    static setupRecordingHandlers(config) {
        // Live FFmpeg recorder processes per sender
        const liveRecorders = new Map(); // webContentsId -> { proc, outPath }

        // Detect if the given ffmpeg binary supports NVENC
        const nvencSupported = (ffmpegPath) => {
            try {
                const cp = require("child_process");
                const out = cp.execSync(`"${ffmpegPath}" -hide_banner -encoders`, { stdio: ["ignore", "pipe", "pipe"] }).toString();
                return /\bh264_nvenc\b/i.test(out);
            } catch (_) {
                return false;
            }
        };

        // Generic encoder support check
        const encoderSupported = (ffmpegPath, enc) => {
            try {
                const cp = require("child_process");
                const out = cp.execSync(`"${ffmpegPath}" -hide_banner -encoders`, { stdio: ["ignore", "pipe", "pipe"] }).toString();
                const re = new RegExp(`\\b${enc.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
                return re.test(out);
            } catch (_) {
                return false;
            }
        };

        // Resolve FFmpeg binary path in a robust way
        const resolveFfmpeg = () => {
            try {
                const fs = require("fs");
                const p = String(config.get("ffmpegPath", "") || "");
                if (p && fs.existsSync(p)) return p; // Only honor override if it exists
            } catch (_) { }
            try { return require("ffmpeg-static"); } catch (_) { return "ffmpeg"; }
        };

        // Gracefully stop a live recorder so FFmpeg finalizes MP4
        const gracefulStop = (rec) => {
            try {
                if (rec && rec.proc && rec.proc.stdin && !rec.proc.killed) {
                    try { rec.proc.stdin.write("q\n"); } catch (_) { }
                }
            } catch (_) { }
            setTimeout(() => {
                try { rec && rec.helper && !rec.helper.killed && rec.helper.kill(); } catch (_) { }
                try { rec && rec.proc && !rec.proc.killed && rec.proc.kill(); } catch (_) { }
            }, 2000);
        };

        // Attach lifecycle hook so if the renderer closes, we finalize recording
        const attachSenderLifecycle = (webContents) => {
            try {
                const senderId = webContents.id;
                webContents.once("destroyed", () => {
                    const rec = liveRecorders.get(senderId);
                    if (!rec) return;
                    console.log(`[Recording] renderer destroyed -> graceful stop (id=${senderId})`);
                    gracefulStop(rec);
                });
            } catch (_) { }
        };

        // Start live recording (NVENC/FFmpeg) capturing the sender window via gdigrab
        ipcMain.handle("start-live-recording", async (event, { fps, bitrate, outDir, baseName }) => {
            try {
                const senderId = event.sender.id;
                // If one is already running for this sender, ignore
                if (liveRecorders.has(senderId)) return { ok: true, already: true };

                const ffmpegPath = resolveFfmpeg();

                const useNvenc = (process.platform === "win32") && nvencSupported(ffmpegPath);

                const bw = BrowserWindow.fromWebContents(event.sender);
                const title = (bw && bw.getTitle ? bw.getTitle() : "Water").replace(/"/g, '\\"');
                // Note: gdigrab does not officially support hwnd= parameter reliably across builds.
                // We use title= for compatibility; this captures the whole BrowserWindow including HUD/crosshair.
                // (hwnd detection is left in comments for future upgrades.)

                const fs = require("fs");
                const path = require("path");
                if (!fs.existsSync(outDir)) {
                    try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) { }
                }
                const outPath = path.join(outDir, `${baseName}.mkv`);

                // Build args for gdigrab + NVENC
                const safeBitrate = Math.max(1000000, parseInt(String(bitrate), 10) || 8000000);
                const safeFps = Math.max(1, parseInt(String(fps), 10) || 60);

                const args = [
                    "-y",
                    // Video (window)
                    "-f", "gdigrab",
                    "-framerate", String(safeFps),
                    "-draw_mouse", "0",
                    "-i", `title=${title}`,
                    // System audio (loopback)
                    "-thread_queue_size", "1024",
                    "-f", "dshow",
                    "-i", "audio=virtual-audio-capturer",
                    // Common
                    "-pix_fmt", "yuv420p",
                    "-r", String(safeFps)
                ];
                if (useNvenc) {
                    args.push(
                        // Video
                        "-c:v", "h264_nvenc",
                        "-rc", "vbr",
                        "-cq", "19",
                        "-b:v", "10M",
                        "-maxrate", "15M",
                        "-bufsize", "20M",
                        "-preset", "p4",
                        // Audio
                        "-c:a", "aac",
                        "-b:a", "192k",
                        // Mapping and stop when video ends
                        "-map", "0:v:0",
                        "-map", "1:a:0",
                        "-shortest",
                        outPath
                    );
                } else {
                    // CPU fallback when NVENC is unavailable (libx264 only)
                    const x264 = encoderSupported(ffmpegPath, 'libx264');
                    if (x264) {
                        args.push(
                            // Video
                            "-c:v", "libx264",
                            "-preset", "veryfast",
                            "-crf", "19",
                            // Audio
                            "-c:a", "aac",
                            "-b:a", "192k",
                            // Mapping
                            "-map", "0:v:0",
                            "-map", "1:a:0",
                            "-shortest",
                            outPath
                        );
                    } else {
                        // If neither NVENC nor libx264 are available, fail fast
                        throw new Error("No supported H.264 encoder available (NVENC/libx264)");
                    }
                }

                const { spawn } = require("child_process");
                const proc = spawn(ffmpegPath, args, { windowsHide: true });

                proc.on("error", (err) => {
                    console.error("[FFmpeg] spawn error:", err);
                    event.sender.send("show-notification", { message: `Failed to start live recording: ${String(err)}`, type: "error" });
                });
                proc.stderr.on("data", (d) => { try { console.log(`[FFmpeg] ${String(d)}`); } catch (_) { } });
                proc.on("close", (code) => {
                    // Inform renderer this live recording ended
                    try {
                        event.sender.send("live-recording-stopped", { outPath, code });
                    } catch (_) { }
                    liveRecorders.delete(senderId);
                });

                liveRecorders.set(senderId, { proc, outPath, kind: "window" });
                attachSenderLifecycle(event.sender);
                console.log(`[Recording] backend=window ffmpegPath=${ffmpegPath}`);
                event.sender.send("show-notification", { message: "Live recording started (Window/NVENC)", type: "success" });
                return { ok: true, outPath };
            } catch (e) {
                console.error("[FFmpeg] Failed to start live recording:", e);
                event.sender.send("show-notification", { message: `Failed to start live recording: ${String(e)}`, type: "error" });
                return { ok: false, error: String(e) };
            }
        });

        ipcMain.on("stop-live-recording", (event) => {
            const senderId = event.sender.id;
            const rec = liveRecorders.get(senderId);
            if (!rec) return;
            try {
                // Try graceful stop: send 'q' to stdin
                if (rec.proc.stdin && !rec.proc.killed) {
                    try { rec.proc.stdin.write("q\n"); } catch (_) { }
                }
                // Fallback kill after timeout
                setTimeout(() => {
                    try { if (!rec.proc.killed) rec.proc.kill(); } catch (_) { }
                }, 3000);
            } catch (_) { }
        });

        // Start WGC (Windows Graphics Capture) recording using helper -> named pipe -> FFmpeg NVENC
        ipcMain.handle("start-wgc-recording", async (event, { fps, bitrate, outDir, baseName }) => {
            try {
                const isWin = process.platform === "win32";
                if (!isWin) {
                    event.sender.send("show-notification", { message: "WGC unavailable on this platform. Falling back to Window/NVENC.", type: "warning" });
                    // Fall back to window capture NVENC spawn
                    const senderId = event.sender.id;
                    if (liveRecorders.has(senderId)) return { ok: true, already: true };
                    const fs = require("fs");
                    const path = require("path");
                    const { spawn } = require("child_process");
                    const bw = BrowserWindow.fromWebContents(event.sender);
                    const bounds = bw.getBounds();
                    const width = Math.max(2, bounds.width);
                    const height = Math.max(2, bounds.height);
                    const safeBitrate = Math.max(1000000, parseInt(String(bitrate), 10) || 8000000);
                    const safeFps = Math.max(1, parseInt(String(fps), 10) || 60);
                    if (!fs.existsSync(outDir)) { try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) { } }
                    const outPath = path.join(outDir, `${baseName}.mkv`);
                    const ffmpegPath = resolveFfmpeg();
                    const title = (bw && bw.getTitle ? bw.getTitle() : "Water").replace(/"/g, '\\"');
                    const args = [
                        "-y",
                        // Video (window)
                        "-f", "gdigrab",
                        "-framerate", String(safeFps),
                        "-draw_mouse", "0",
                        "-i", `title=${title}`,
                        // Audio (loopback)
                        "-thread_queue_size", "1024",
                        "-f", "dshow",
                        "-i", "audio=virtual-audio-capturer",
                        // Video encode
                        "-c:v", "h264_nvenc",
                        "-rc", "vbr",
                        "-cq", "19",
                        "-b:v", "10M",
                        "-maxrate", "15M",
                        "-bufsize", "20M",
                        "-preset", "p4",
                        // Audio encode
                        "-c:a", "aac",
                        "-b:a", "192k",
                        // Common
                        "-pix_fmt", "yuv420p",
                        "-r", String(safeFps),
                        "-map", "0:v:0",
                        "-map", "1:a:0",
                        "-shortest",
                        outPath
                    ];
                    const proc = spawn(ffmpegPath, args, { windowsHide: true });
                    proc.on("close", (code) => {
                        try { event.sender.send("live-recording-stopped", { outPath, code }); } catch (_) { }
                        liveRecorders.delete(senderId);
                    });
                    liveRecorders.set(senderId, { proc, outPath, kind: "window" });
                    attachSenderLifecycle(event.sender);
                    console.log(`[Recording] backend=window(ffmpeg fallback) ffmpegPath=${ffmpegPath}`);
                    event.sender.send("show-notification", { message: "Live recording started (Window/NVENC)", type: "success" });
                    return { ok: true, outPath, fallback: true };
                }

                const senderId = event.sender.id;
                if (liveRecorders.has(senderId)) return { ok: true, already: true };

                const fs = require("fs");
                const path = require("path");
                const { spawn } = require("child_process");
                const bw = BrowserWindow.fromWebContents(event.sender);
                const bounds = bw.getContentBounds ? bw.getContentBounds() : bw.getBounds();
                let width = Math.max(2, bounds.width);
                let height = Math.max(2, bounds.height);
                // Convert DIP to physical pixels using display scale factor (Windows high-DPI)
                try {
                    const { screen } = require("electron");
                    const disp = screen.getDisplayMatching(bw.getBounds ? bw.getBounds() : bounds);
                    const scale = (disp && typeof disp.scaleFactor === 'number' && disp.scaleFactor > 0) ? disp.scaleFactor : 1;
                    width = Math.max(2, Math.round(width * scale));
                    height = Math.max(2, Math.round(height * scale));
                } catch (_) { }
                const safeBitrate = Math.max(1000000, parseInt(String(bitrate), 10) || 8000000);
                const safeFps = Math.max(1, parseInt(String(fps), 10) || 60);

                if (!fs.existsSync(outDir)) {
                    try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) { }
                }
                const outPath = path.join(outDir, `${baseName}.mkv`);

                let ffmpegPath = String(config.get("ffmpegPath", ""));
                if (!ffmpegPath) {
                    try { ffmpegPath = require("ffmpeg-static"); } catch (_) { ffmpegPath = "ffmpeg"; }
                }

                // Resolve helper exe under packaged resources or dev tree.
                // We support both flat (app/wgc/wgc-capture.exe) and nested (app/wgc/build/bin/wgc-capture.exe) layouts.
                const candidates = [
                    path.join((process.resourcesPath || ''), "wgc", "wgc-capture.exe"),
                    path.join((process.resourcesPath || ''), "wgc", "build", "bin", "wgc-capture.exe"),
                    path.join(__dirname, "..", "wgc", "wgc-capture.exe"),
                    path.join(__dirname, "..", "wgc", "build", "bin", "wgc-capture.exe")
                ];
                let helperPath = null;
                for (const cand of candidates) {
                    try { if (fs.existsSync(cand)) { helperPath = cand; break; } } catch (_) { }
                }
                if (!helperPath || !fs.existsSync(helperPath)) {
                    event.sender.send("show-notification", { message: "WGC helper not found. Falling back to Window/NVENC.", type: "warning" });
                    // Fallback to window capture path
                    const title = (bw && bw.getTitle ? bw.getTitle() : "Water").replace(/"/g, '\\"');
                    const useNvenc = (process.platform === "win32") && nvencSupported(ffmpegPath);
                    const args = [
                        "-y",
                        // Video (window)
                        "-f", "gdigrab",
                        "-framerate", String(safeFps),
                        "-draw_mouse", "0",
                        "-i", `title=${title}`,
                        // Audio (loopback)
                        "-thread_queue_size", "1024",
                        "-f", "dshow",
                        "-i", "audio=virtual-audio-capturer",
                        // Common
                        "-pix_fmt", "yuv420p",
                        "-r", String(safeFps)
                    ];
                    if (useNvenc) {
                        args.push(
                            // Video
                            "-c:v", "h264_nvenc",
                            "-rc", "vbr",
                            "-cq", "19",
                            "-b:v", "10M",
                            "-maxrate", "15M",
                            "-bufsize", "20M",
                            "-preset", "p4",
                            // Audio
                            "-c:a", "aac",
                            "-b:a", "192k",
                            // Mapping
                            "-map", "0:v:0",
                            "-map", "1:a:0",
                            "-shortest",
                            outPath
                        );
                    } else {
                        const x264 = encoderSupported(ffmpegPath, 'libx264');
                        if (x264) {
                            args.push(
                                // Video
                                "-c:v", "libx264",
                                "-preset", "veryfast",
                                "-crf", "19",
                                // Audio
                                "-c:a", "aac",
                                "-b:a", "192k",
                                // Mapping
                                "-map", "0:v:0",
                                "-map", "1:a:0",
                                "-shortest",
                                outPath
                            );
                        } else {
                            throw new Error("No supported H.264 encoder available (NVENC/libx264)");
                        }
                    }
                    const proc = spawn(ffmpegPath, args, { windowsHide: true });
                    proc.on("error", (err) => {
                        console.error("[FFmpeg] spawn error:", err);
                        event.sender.send("show-notification", { message: `Failed to start live recording: ${String(err)}`, type: "error" });
                    });
                    proc.stderr.on("data", (d) => { try { console.log(`[FFmpeg] ${String(d)}`); } catch (_) { } });
                    proc.on("close", (code) => {
                        try { event.sender.send("live-recording-stopped", { outPath, code }); } catch (_) { }
                        liveRecorders.delete(senderId);
                    });
                    liveRecorders.set(senderId, { proc, outPath, kind: "window" });
                    console.log(`[Recording] backend=window(ffmpeg fallback) ffmpegPath=${ffmpegPath}`);
                    event.sender.send("show-notification", { message: "Live recording started (Window/NVENC)", type: "success" });
                    return { ok: true, outPath, fallback: true };
                }

                // Build named pipe and spawn helper
                const pipeName = `\\\\.\\pipe\\WaterWGC_${senderId}`;
                const handleBuf = bw.getNativeWindowHandle();
                let hwnd = 0;
                try {
                    if (handleBuf.length === 8 && typeof handleBuf.readBigUInt64LE === 'function') hwnd = Number(handleBuf.readBigUInt64LE(0));
                    else hwnd = handleBuf.readUInt32LE(0);
                } catch (_) { }

                const helperArgs = [
                    `--hwnd=${hwnd}`,
                    `--pipe=${pipeName}`,
                    `--fps=${safeFps}`,
                    `--format=bgra`,
                    `--width=${width}`,
                    `--height=${height}`
                ];
                const helper = spawn(helperPath, helperArgs, { windowsHide: true });

                // Spawn FFmpeg to read from named pipe
                const useNvenc2 = (process.platform === "win32") && nvencSupported(ffmpegPath);
                const ffArgs = [
                    "-y",
                    // Video from WGC helper
                    "-f", "rawvideo",
                    "-pix_fmt", "bgra",
                    "-video_size", `${width}x${height}`,
                    "-framerate", String(safeFps),
                    "-i", pipeName,
                    // Audio loopback
                    "-thread_queue_size", "1024",
                    "-f", "dshow",
                    "-i", "audio=virtual-audio-capturer",
                    // Common
                    "-pix_fmt", "yuv420p",
                    "-r", String(safeFps)
                ];
                if (useNvenc2) {
                    ffArgs.push(
                        // Video
                        "-c:v", "h264_nvenc",
                        "-rc", "vbr",
                        "-cq", "19",
                        "-b:v", "10M",
                        "-maxrate", "15M",
                        "-bufsize", "20M",
                        "-preset", "p4",
                        // Audio
                        "-c:a", "aac",
                        "-b:a", "192k",
                        // Mapping
                        "-map", "0:v:0",
                        "-map", "1:a:0",
                        "-shortest",
                        outPath
                    );
                } else {
                    const x264 = encoderSupported(ffmpegPath, 'libx264');
                    if (x264) {
                        ffArgs.push(
                            // Video
                            "-c:v", "libx264",
                            "-preset", "veryfast",
                            "-crf", "19",
                            // Audio
                            "-c:a", "aac",
                            "-b:a", "192k",
                            // Mapping
                            "-map", "0:v:0",
                            "-map", "1:a:0",
                            "-shortest",
                            outPath
                        );
                    } else {
                        throw new Error("No supported H.264 encoder available (NVENC/libx264)");
                    }
                }
                const ff = spawn(ffmpegPath, ffArgs, { windowsHide: true });

                const cleanup = (code) => {
                    try { event.sender.send("live-recording-stopped", { outPath, code }); } catch (_) { }
                    try { helper.kill(); } catch (_) { }
                    try { ff.kill(); } catch (_) { }
                    liveRecorders.delete(senderId);
                };
                helper.on("error", (e) => { console.error("[WGC] helper error:", e); cleanup(1); });
                helper.on("close", (code) => {
                    if (typeof code === 'number' && code !== 0) {
                        if (tryWindowFallback()) return;
                        cleanup(code);
                    }
                });
                helper.stderr && helper.stderr.on("data", (d) => { try { console.log(`[WGC] ${String(d)}`); } catch (_) { } });
                ff.on("error", (e) => { console.error("[FFmpeg] error:", e); cleanup(1); });
                ff.stderr && ff.stderr.on("data", (d) => { try { console.log(`[FFmpeg] ${String(d)}`); } catch (_) { } });
                let fallbackAttempted = false;
                const tryWindowFallback = () => {
                    if (fallbackAttempted) return false;
                    fallbackAttempted = true;
                    try {
                        const title = (bw && bw.getTitle ? bw.getTitle() : "Water").replace(/"/g, '\\"');
                        const useNvenc3 = (process.platform === "win32") && nvencSupported(ffmpegPath);
                        const args = [
                            "-y",
                            // Video (window)
                            "-f", "gdigrab",
                            "-framerate", String(safeFps),
                            "-draw_mouse", "0",
                            "-i", `title=${title}`,
                            // Audio (loopback)
                            "-thread_queue_size", "1024",
                            "-f", "dshow",
                            "-i", "audio=virtual-audio-capturer",
                            // Common
                            "-pix_fmt", "yuv420p",
                            "-r", String(safeFps)
                        ];
                        if (useNvenc3) {
                            args.push(
                                // Video
                                "-c:v", "h264_nvenc",
                                "-rc", "vbr",
                                "-cq", "19",
                                "-b:v", "10M",
                                "-maxrate", "15M",
                                "-bufsize", "20M",
                                "-preset", "p4",
                                // Audio
                                "-c:a", "aac",
                                "-b:a", "192k",
                                // Mapping
                                "-map", "0:v:0",
                                "-map", "1:a:0",
                                "-shortest",
                                outPath
                            );
                        } else {
                            args.push(
                                // Video
                                "-c:v", "libx264",
                                "-preset", "veryfast",
                                "-crf", "19",
                                // Audio
                                "-c:a", "aac",
                                "-b:a", "192k",
                                // Mapping
                                "-map", "0:v:0",
                                "-map", "1:a:0",
                                "-shortest",
                                outPath
                            );
                        }
                        try { helper.kill(); } catch (_) { }
                        const proc2 = spawn(ffmpegPath, args, { windowsHide: true });
                        proc2.on("error", (err) => {
                            console.error("[FFmpeg] fallback spawn error:", err);
                            cleanup(1);
                        });
                        proc2.stderr && proc2.stderr.on("data", (d) => { try { console.log(`[FFmpeg] ${String(d)}`); } catch (_) { } });
                        proc2.on("close", (code) => {
                            try { event.sender.send("live-recording-stopped", { outPath, code }); } catch (_) { }
                            liveRecorders.delete(senderId);
                        });
                        liveRecorders.set(senderId, { proc: proc2, outPath, kind: "window" });
                        console.log(`[Recording] fallback engaged backend=window ffmpegPath=${ffmpegPath}`);
                        event.sender.send("show-notification", { message: "Falling back to Window/NVENC recording", type: "warning" });
                        return true;
                    } catch (e) {
                        console.error("[Recording] fallback error:", e);
                        return false;
                    }
                };
                ff.on("close", (code) => {
                    if (typeof code === 'number' && code !== 0) {
                        // Try fallback once if FFmpeg failed
                        if (tryWindowFallback()) return;
                    }
                    cleanup(code);
                });

                liveRecorders.set(senderId, { proc: ff, helper, outPath, pipeName, kind: "wgc" });
                attachSenderLifecycle(event.sender);
                console.log(`[Recording] backend=wgc ffmpegPath=${ffmpegPath} helper=${helperPath}`);
                event.sender.send("show-notification", { message: "Live recording started (WGC/NVENC)", type: "success" });
                return { ok: true, outPath };
            } catch (e) {
                console.error("[WGC] Failed to start game capture:", e);
                event.sender.send("show-notification", { message: `Failed to start WGC recording: ${String(e)}`, type: "error" });
                return { ok: false, error: String(e) };
            }
        });

        ipcMain.on("stop-wgc-recording", (event) => {
            const senderId = event.sender.id;
            const rec = liveRecorders.get(senderId);
            if (!rec) return;
            try {
                if (rec.kind === "wgc") {
                    // Try graceful stop of helper by closing FFmpeg stdin
                    if (rec.proc && rec.proc.stdin && !rec.proc.killed) {
                        try { rec.proc.stdin.write("q\n"); } catch (_) { }
                    }
                    setTimeout(() => {
                        try { rec.helper && !rec.helper.killed && rec.helper.kill(); } catch (_) { }
                        try { rec.proc && !rec.proc.killed && rec.proc.kill(); } catch (_) { }
                    }, 3000);
                } else {
                    // Delegate to window stop
                    if (rec.proc && rec.proc.stdin && !rec.proc.killed) {
                        try { rec.proc.stdin.write("q\n"); } catch (_) { }
                    }
                    setTimeout(() => { try { rec.proc && !rec.proc.killed && rec.proc.kill(); } catch (_) { } }, 3000);
                }
            } catch (_) { }
        });
        // Register global shortcuts for recording (no F8)
        const registerRecordingShortcuts = () => {
            try {
                let lastMs = 0;
                const dispatch = (cmd) => {
                    const now = Date.now();
                    if ((now - lastMs) < 350) return; // throttle spam
                    lastMs = now;
                    BrowserWindow.getAllWindows().forEach(win => win.webContents.send("recording-command", cmd));
                };
                const reg = (accel, handler) => {
                    try { if (globalShortcut.isRegistered(accel)) globalShortcut.unregister(accel); } catch (_) { }
                    const ok = globalShortcut.register(accel, handler);
                    if (!ok) console.warn(`[Shortcuts] Failed to register ${accel}`);
                };
                reg("F9", () => dispatch("toggle-recording"));
                reg("F10", () => dispatch("toggle-pause"));
                reg("F11", () => dispatch("save-replay"));
                // Water-style keys
                reg("F1", () => dispatch("toggle-pause"));
                reg("F2", () => dispatch("save-replay"));
                reg("F3", () => dispatch("cancel-recording"));
                console.log("[Shortcuts] Recording shortcuts registered");
            } catch (e) {
                console.error("[Shortcuts] Registration error:", e);
            }
        };
        ipcMain.on("register-recording-shortcuts", () => { registerRecordingShortcuts(); });
        if (app.isReady()) registerRecordingShortcuts(); else app.once("ready", () => registerRecordingShortcuts());

        // Handle folder selection for save path
        ipcMain.handle("select-folder", async () => {
            const result = await dialog.showOpenDialog({
                properties: ["openDirectory", "createDirectory"]
            });
            return result.canceled ? null : result.filePaths[0];
        });

        // Handle overlay updates from renderer
        ipcMain.on("update-recording-overlay", (event, data) => {
            event.sender.send("update-overlay", data);
        });

        // Handle notification requests
        ipcMain.on("show-recording-notification", (event, data) => {
            event.sender.send("show-notification", data);
        });

        // Free disk space query
        ipcMain.handle("get-disk-free", async (_event, targetPath) => {
            try {
                const os = require("os");
                const { exec } = require("child_process");
                return await new Promise(resolve => {
                    if (process.platform === "win32") {
                        try {
                            const drive = (targetPath || app.getPath("videos")).trim().slice(0, 1).toUpperCase();
                            exec(`powershell -NoProfile -Command "[int64](Get-PSDrive -Name '${drive}').Free"`, { windowsHide: true }, (err, stdout) => {
                                if (err) return resolve(null);
                                const val = parseInt(String(stdout).trim(), 10);
                                resolve(Number.isFinite(val) ? val : null);
                            });
                        } catch (_) { resolve(null); }
                    } else {
                        exec(`df -k "${targetPath || app.getPath('videos')}" | tail -1 | awk '{print $4}'`, (err, stdout) => {
                            if (err) return resolve(null);
                            const kb = parseInt(String(stdout).trim(), 10);
                            resolve(Number.isFinite(kb) ? kb * 1024 : null);
                        });
                    }
                });
            } catch (_) { return null; }
        });

        // Handle FFmpeg transcoding (self-contained)
        ipcMain.on("transcode-video", (event, { input, output, fps, bitrate }) => {
            // Resolve ffmpeg binary robustly
            const ffmpegPath = resolveFfmpeg();

            const pathMod = require("path");
            const fsMod = require("fs");
            const ext = (pathMod.extname(String(output)) || "").toLowerCase();

            // Helper: check encoder availability
            const hasEncoder = (enc) => {
                try {
                    const cp = require("child_process");
                    const out = cp.execSync(`"${ffmpegPath}" -hide_banner -encoders`, { stdio: ["ignore", "pipe", "pipe"] }).toString();
                    const re = new RegExp(`\\b${enc.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
                    return re.test(out);
                } catch (_) { return false; }
            };

            const buildArgs = () => {
                const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", input];
                if (ext === ".mkv") {
                    // MKV finalize: try remux first (copy both streams)
                    args.push("-fflags", "+genpts", "-map", "0", "-c", "copy", output);
                } else if (ext === ".mp4" || ext === ".mov") {
                    // Prefer H.264. Use supplied fps/bitrate when available
                    const outFps = Math.max(1, parseInt(String(fps || 60), 10) || 60);
                    const outBr = Math.max(10000000, parseInt(String(bitrate || 10000000), 10) || 10000000);
                    // Prefer H.264. Fallback to NVENC if present, else MPEG-4
                    const useLibx264 = hasEncoder("libx264");
                    const useNvenc = hasEncoder("h264_nvenc");
                    const vArgs = useNvenc
                        ? ["-c:v", "h264_nvenc", "-rc", "vbr", "-b:v", String(outBr), "-maxrate", String(outBr), "-bufsize", String(outBr * 2), "-preset", "p5"]
                        : (useLibx264
                            ? ["-c:v", "libx264", "-preset", "veryfast", "-b:v", String(outBr), "-maxrate", String(outBr), "-bufsize", String(outBr * 2)]
                            : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22"]);
                    // Audio: AAC if available; else MP3 if available; else no audio
                    const useAac = hasEncoder("aac");
                    const useMp3 = !useAac && hasEncoder("libmp3lame");
                    const aArgs = useAac
                        ? ["-c:a", "aac", "-b:a", "192k"]
                        : (useMp3 ? ["-c:a", "libmp3lame", "-b:a", "192k"] : ["-an"]);
                    // Ensure even dimensions for yuv420p; generate PTS to avoid timeline issues; lock FPS
                    const vf = `scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=${outFps}`;
                    args.push("-fflags", "+genpts", "-r", String(outFps), "-vsync", "1", "-vf", vf, ...vArgs, "-pix_fmt", "yuv420p", "-movflags", "+faststart", ...aArgs, output);
                } else {
                    // Unknown container: stream copy
                    args.push("-c", "copy", output);
                }
                return args;
            };

            const buildEncodeMkvArgs = () => {
                const outFps = Math.max(1, parseInt(String(fps || 60), 10) || 60);
                const outBr = Math.max(10000000, parseInt(String(bitrate || 10000000), 10) || 10000000);
                const useLibx264 = hasEncoder("libx264");
                const useNvenc = hasEncoder("h264_nvenc");
                const vArgs = useNvenc
                    ? ["-c:v", "h264_nvenc", "-rc", "vbr", "-b:v", String(outBr), "-maxrate", String(outBr), "-bufsize", String(outBr * 2), "-preset", "p5"]
                    : (useLibx264 ? ["-c:v", "libx264", "-preset", "veryfast", "-b:v", String(outBr), "-maxrate", String(outBr), "-bufsize", String(outBr * 2)] : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22"]);
                const useAac = hasEncoder("aac");
                const aArgs = useAac ? ["-c:a", "aac", "-b:a", "192k"] : ["-an"];
                const vf = `scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=${outFps}`;
                return ["-y", "-hide_banner", "-loglevel", "error", "-fflags", "+genpts", "-r", String(outFps), "-i", input, "-vsync", "1", "-vf", vf, ...vArgs, "-pix_fmt", "yuv420p", ...aArgs, output];
            };

            const { spawn } = require("child_process");
            const runFfmpeg = (args, onFail) => {
                try {
                    const ff = spawn(ffmpegPath, args, { windowsHide: true });
                    ff.on("error", (err) => {
                        console.error("[Recording] FFmpeg spawn error:", err);
                        if (onFail) onFail(); else {
                            try { event.sender.send("show-notification", { message: "Failed to finalize recording", type: "error" }); } catch (_) { }
                        }
                    });
                    ff.stderr && ff.stderr.on("data", (d) => { try { console.log(`[FFmpeg Finalize] ${String(d)}`); } catch (_) { } });
                    ff.on("close", (code) => {
                        if (typeof code === 'number' && code === 0) {
                            try { fsMod.unlinkSync(input); } catch (_) { }
                            try { event.sender.send("show-notification", { message: `Recording saved at ${output}`, type: "success" }); } catch (_) { }
                        } else {
                            console.error("[Recording] FFmpeg transcode exit code:", code);
                            if (onFail) onFail(); else {
                                try { event.sender.send("show-notification", { message: "Failed to finalize recording", type: "error" }); } catch (_) { }
                            }
                        }
                    });
                } catch (e) {
                    console.error("[Recording] FFmpeg transcode exception:", e);
                    if (onFail) onFail(); else {
                        try { event.sender.send("show-notification", { message: `Failed to finalize recording`, type: "error" }); } catch (_) { }
                    }
                }
            };

            // Execute finalize (for MKV: remux, then re-encode fallback on failure)
            const args1 = buildArgs();
            if (ext === ".mkv") {
                runFfmpeg(args1, () => {
                    const args2 = buildEncodeMkvArgs();
                    runFfmpeg(args2, null);
                });
            } else {
                runFfmpeg(args1, null);
            }
        });

        // Cleanup on app quit
        app.on("before-quit", () => {
            try {
                for (const rec of liveRecorders.values()) gracefulStop(rec);
            } catch (_) { }
        });
        app.on("will-quit", () => {
            globalShortcut.unregisterAll();
        });
    }

}

module.exports = IpcLoader;
