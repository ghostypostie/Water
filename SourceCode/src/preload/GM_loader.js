"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GM_getValue = GM_getValue;
exports.GM_setValue = GM_setValue;
exports.GM_deleteValue = GM_deleteValue;
exports.parseHeader = parseHeader;
function GM_getValue(key) {
    return window.localStorage.getItem('GM_' + key);
}
function GM_setValue(key, value) {
    window.localStorage.setItem('GM_' + key, value);
}
function GM_deleteValue(key) {
    window.localStorage.removeItem('GM_' + key);
}
function parseHeader(script) {
    let obj = {};
    let lines = script.split('\n');
    if (!lines[0].includes(' ==UserScript=='))
        return obj;
    let endLine = lines.findIndex((line) => line.includes(' ==/UserScript=='));
    if (endLine === -1)
        return obj;
    let header = lines.slice(1, endLine);
    for (let i = 0; i < header.length; i++) {
        let line = header[i].replace(/^\/\/\s?/, '').trim();
        let match = [...line.matchAll(/^@(\S+)\s+([\S\s]+)$/g)];
        if (!match?.[0])
            continue;
        let [_, key, value] = match[0];
        if (obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key]))
                obj[key].push(value);
            else
                obj[key] = [obj[key], value];
        }
        else
            obj[key] = value;
    }
    return obj;
}
