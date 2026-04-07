"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitFor = waitFor;
function waitFor(func, maxTime) {
    return new Promise(resolve => {
        let start = Date.now();
        let interval = setInterval(() => {
            let r = func();
            if (r || (maxTime && Date.now() - start > maxTime)) {
                clearInterval(interval);
                resolve(r);
            }
        });
    });
}
