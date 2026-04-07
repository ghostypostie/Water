"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
const button_1 = __importDefault(require("../options/button"));
const textinput_1 = __importDefault(require("../options/textinput"));
class RPCButtonsUI extends index_1.default {
    name = 'Edit Rich Presence Buttons';
    categories = [
        {
            name: 'First button',
            options: [
                new textinput_1.default(this.module, {
                    name: 'Label',
                    description: '',
                    id: 'buttons.0.label',
                    label: 'Label',
                }),
                new textinput_1.default(this.module, {
                    name: 'URL',
                    description: '',
                    id: 'buttons.0.url',
                    label: 'URL',
                }),
            ],
        },
        {
            name: 'Second button',
            options: [
                new textinput_1.default(this.module, {
                    name: 'Label',
                    description: '',
                    id: 'buttons.1.label',
                    label: 'Label',
                }),
                new textinput_1.default(this.module, {
                    name: 'URL',
                    description: '',
                    id: 'buttons.1.url',
                    label: 'URL',
                }),
            ],
        },
    ];
    buttons = [
        new button_1.default(this.module, {
            label: 'Back to settings',
            color: 'purple',
            name: '',
            description: '',
            id: '',
            onChange: () => {
                window.showWindow?.(1);
            },
        }),
    ];
}
exports.default = RPCButtonsUI;
