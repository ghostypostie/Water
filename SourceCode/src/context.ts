export enum Context {
    Game,
    Editor,
    Viewer,
    Startup,
    Common
}

export enum RunAt {
    LoadStart,
    LoadEnd
}

export function fromURL(url: URL): Context | null {
    if(!['krunker.io', 'browserfps.com'].includes(url.hostname)) return null;

    switch(url.pathname) {
        case '/':
            return Context.Game;
        case '/editor.html':
            return Context.Editor;
        case '/viewer.html':
            return Context.Viewer;
        default:
            // All other krunker.io/browserfps.com links open in a Water window
            return Context.Viewer;
    }
}