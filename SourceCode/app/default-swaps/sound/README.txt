Place default sound overrides in this folder to ship them with the client.

How it works:
- Files placed here will be copied to the user's resource swapper folder on first run (and on subsequent runs for any new files).
- Existing user files are never overwritten.

Examples of file names you can include:
- headshot_0.ogg
- hit_0.ogg
- kill_0.ogg
- hitmarker_0.ogg

Normal swapper path:
- The client uses `/sound/<file>` for normal mode.
Advanced swapper mirror:
- The client also mirrors into `/assets.krunker.io/sound/<file>` for advanced mode.

To provide a default headshot sound out of the box:
- Add your audio file as `app/default-swaps/sound/headshot_0.ogg` before building.

Note:
- Use the exact filenames that Krunker expects. Formats commonly used are .ogg or .mp3.
- If you later remove a default from the package, it will not remove the user's copy.
