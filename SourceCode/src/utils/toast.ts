/**
 * Show a toast notification for settings that require restart
 */
export function showRestartToast() {
    // Remove existing toast if any
    const existingToast = document.getElementById('restart-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'restart-toast';
    toast.innerHTML = `
        <div>
            <div style="font-weight: bold; font-size: 15px; margin-bottom: 4px;">Changes Detected</div>
            <div style="font-size: 13px; opacity: 0.9;">Restart to apply changes</div>
        </div>
    `;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        padding: 16px 20px;
        border-radius: 8px;
        background: radial-gradient(circle, rgba(139,0,0,0.95) 0%, rgba(80,0,0,0.95) 100%);
        border: 2px solid rgba(200,0,0,0.8);
        color: #fff;
        font-family: gamefont, sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 40px rgba(139,0,0,0.3);
        animation: slideInRight 0.3s ease-out;
        min-width: 280px;
    `;

    // Add animation keyframes if not already added
    if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}
