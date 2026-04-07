// Partner configuration - Add your partners here
const partners = [
    {
        name: 'PSVM',
        logo: '../img/partner1.png',
        discordInvite: 'https://discord.gg/vNh35Wx6ua'
    },
    {
        name: 'H1ND',
        logo: '../img/partner2.png',
        discordInvite: 'https://discord.gg/yJJ2KEZR9Y'
    },
    {
        name: 'Vamp',
        logo: '../img/partner3.png',
        discordInvite: 'https://discord.gg/NVpwMqGZxG'
    },
    {
        name: 'Partner 4',
        logo: '../img/logo.png',
        discordInvite: 'https://discord.gg/partner4'
    },
    {
        name: 'Partner 5',
        logo: '../img/logo.png',
        discordInvite: 'https://discord.gg/partner5'
    }
];

function initPartnerSlider() {
    const slideTrack = document.getElementById('slideTrack');
    
    // Duplicate partners array twice to create seamless infinite loop
    const allPartners = [...partners, ...partners];
    
    allPartners.forEach((partner) => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        
        const img = document.createElement('img');
        img.src = partner.logo;
        img.alt = partner.name;
        img.title = partner.name;
        
        img.addEventListener('click', () => {
            if (window.require) {
                const { shell } = window.require('electron');
                shell.openExternal(partner.discordInvite);
            } else {
                window.open(partner.discordInvite, '_blank');
            }
        });
        
        slide.appendChild(img);
        slideTrack.appendChild(slide);
    });
}

window.onload = function() {
    console.log("Splash screen loaded");
    initPartnerSlider();
    
    setTimeout(() => {
        console.log("Client ready");
    }, 4000);
};
