const { ipcRenderer, shell } = require('electron');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Version display
  ipcRenderer.invoke('get-app-info').then(info => {
    const versionEl = document.getElementById('version');
    if (versionEl) {
      versionEl.textContent = `Version ${info.version}`;
    }
  });

  // Handle external link clicks
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a[href^="http"]');
    if (target) {
      e.preventDefault();
      const url = target.getAttribute('href');
      console.log('[Splash] Opening external link:', url);
      shell.openExternal(url).catch(err => {
        console.error('[Splash] Failed to open link:', err);
      });
    }
  });

  // IPC message listener for update status
  ipcRenderer.on('message', (event, message, detailText) => {
    const messageEl = document.getElementById('message');
    const detailsEl = document.getElementById('details');
    if (messageEl) messageEl.innerText = message || '';
    if (detailsEl) detailsEl.innerText = detailText || '';
  });

  // IPC listener for fade-out trigger (seamless transition to game window)
  ipcRenderer.on('fade-out', () => {
    console.log('[Splash] Fade-out triggered');
    document.body.classList.add('fade-out');
  });

  // CRITICAL FIX: Forward 'open-game' event from renderer to main process
  // browser-loader.js sends this TO the splash window, we need to relay it to main.js
  ipcRenderer.on('open-game', () => {
    console.log('[Splash] Received open-game event from browser-loader, forwarding to main process');
    ipcRenderer.send('open-game');
  });

  // Close button handler
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('[Splash] Close button clicked, sending close-splash to main');
      ipcRenderer.send('close-splash');
    });
  }

  // Star trail effect
  let x1 = 0, y1 = 0;
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const dist_to_draw = 50;
  const delay = 50;
  const fsize = ['1.1rem', '1.4rem', '.8rem', '1.7rem'];
  const colors = [
    '#E23636',
    '#F9F3EE',
    '#E1F8DC',
    '#B8AFE6',
    '#AEE1CD',
    '#5EB0E5'
  ];

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const selRand = (o) => o[rand(0, o.length - 1)];
  const distanceTo = (x1, y1, x2, y2) => Math.sqrt((Math.pow(x2 - x1, 2)) + (Math.pow(y2 - y1, 2)));
  const shouldDraw = (x, y) => (distanceTo(x1, y1, x, y) >= dist_to_draw);

  const addStr = (x, y) => {
    const str = document.createElement("div");
    str.innerHTML = '&#10022;';
    str.className = 'star';
    str.style.top = `${y + rand(-20, 20)}px`;
    str.style.left = `${x}px`;
    str.style.color = selRand(colors);
    str.style.fontSize = selRand(fsize);
    document.body.appendChild(str);

    const fs = 10 + 5 * parseFloat(getComputedStyle(str).fontSize);

    // Use requestAnimationFrame to ensure animation starts
    // Full keyframes (not partial) for GPU acceleration compatibility
    requestAnimationFrame(() => {
      str.animate([
        { // Start state (offset 0)
          translate: '0 0px',
          opacity: 1,
          transform: 'rotateX(0deg) rotateY(0deg)',
          offset: 0
        },
        { // End state (offset 1)
          translate: `0 ${(y + fs) > vh ? vh - y : fs}px`,
          opacity: 0,
          transform: `rotateX(${rand(1, 500)}deg) rotateY(${rand(1, 500)}deg)`,
          offset: 1
        }
      ], {
        duration: delay,
        fill: 'forwards',
      });
    });

    // Remove after animation completes
    setTimeout(() => {
      if (str.parentNode) {
        str.parentNode.removeChild(str);
      }
    }, delay + 100);
  };

  window.addEventListener("mousemove", (e) => {
    const { clientX, clientY } = e;
    if (shouldDraw(clientX, clientY)) {
      addStr(clientX, clientY);
      x1 = clientX;
      y1 = clientY;
    }
  });
});
