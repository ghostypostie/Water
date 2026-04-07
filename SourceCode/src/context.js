"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunAt = exports.Context = void 0;
exports.fromURL = fromURL;
var Context;
(function (Context) {
    Context[Context["Game"] = 0] = "Game";
    Context[Context["Editor"] = 1] = "Editor";
    Context[Context["Viewer"] = 2] = "Viewer";
    Context[Context["Startup"] = 3] = "Startup";
    Context[Context["Common"] = 4] = "Common";
})(Context || (exports.Context = Context = {}));
var RunAt;
(function (RunAt) {
    RunAt[RunAt["LoadStart"] = 0] = "LoadStart";
    RunAt[RunAt["LoadEnd"] = 1] = "LoadEnd";
})(RunAt || (exports.RunAt = RunAt = {}));
function fromURL(url) {
    if (!['krunker.io', 'browserfps.com'].includes(url.hostname))
        return null;
    switch (url.pathname) {
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
