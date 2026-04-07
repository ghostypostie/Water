import UI from './index';
import Button from '../options/button';
import Store from '../modules/store';

export default class StoreUploadUI extends UI {
    name = 'Upload Theme';

    categories = [{
        name: '',
        options: []
    }];

    buttons = [
        new Button(this.module, {
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

    constructor(module: Store) {
        super(module);
    }

    open() {
        let windowHolder = document.getElementById('windowHolder');
        let menuWindow = document.getElementById('menuWindow');

        if(!windowHolder || !menuWindow) return;

        windowHolder.className = 'popupWin';
        menuWindow.style.width = this.width + 'px';
        menuWindow.className = 'dark';
        menuWindow.innerHTML = '';

        if(this.name) {
            let header = document.createElement('div');
            header.id = 'referralHeader';
            header.textContent = this.name;
            menuWindow.append(header);
        }

        let holder = document.createElement('div');
        holder.id = 'settHolder';
        menuWindow.append(holder);

        // Add upload content
        const content = document.createElement('div');
        content.style.padding = '20px';
        content.style.textAlign = 'center';
        content.style.color = 'rgba(255,255,255,0.6)';
        content.innerHTML = `
            <p style="margin: 20px 0;">Upload and sell your CSS theme</p>
            <p>Upload functionality coming soon!</p>
            <p>You'll be able to upload CSS themes, set prices, and earn credits here.</p>
        `;
        holder.appendChild(content);

        for(let button of this.buttons) menuWindow.append(button.generateBig());
        windowHolder.style.display = '';
    }
}
