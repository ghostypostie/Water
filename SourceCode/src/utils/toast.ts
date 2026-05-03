/**
 * Show a toast notification for settings that require restart
 */
export function showRestartToast() {
    showToast({ title: 'Changes Detected', message: 'Restart to apply changes', type: 'restart' });
}

/**
 * Show a toast notification for settings that apply instantly
 */
export function showInstantToast() {
    showToast({ title: 'Changes Applied', message: 'Settings updated successfully', type: 'instant' });
}

/**
 * Generic toast notification system
 */
export interface ToastOptions {
    title: string;
    message: string;
    type?: 'restart' | 'instant' | 'success' | 'error' | 'info';
    duration?: number;
    onClick?: () => void;
}

export function showToast(options: ToastOptions | string, message?: string, type?: 'restart' | 'instant') {
    // Support both old and new API
    let opts: ToastOptions;
    if (typeof options === 'string') {
        opts = {
            title: options,
            message: message || '',
            type: type || 'info'
        };
    } else {
        opts = options;
    }

    // Remove existing toast if any
    const existingToast = document.getElementById('settings-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const typeColors = {
        restart: {
            bg: 'radial-gradient(circle, rgba(139,0,0,0.95) 0%, rgba(80,0,0,0.95) 100%)',
            border: 'rgba(200,0,0,0.8)',
            shadow: 'rgba(139,0,0,0.3)'
        },
        instant: {
            bg: 'radial-gradient(circle, rgba(0,139,0,0.95) 0%, rgba(0,80,0,0.95) 100%)',
            border: 'rgba(0,200,0,0.8)',
            shadow: 'rgba(0,139,0,0.3)'
        },
        success: {
            bg: 'radial-gradient(circle, rgba(0,139,0,0.95) 0%, rgba(0,80,0,0.95) 100%)',
            border: 'rgba(0,200,0,0.8)',
            shadow: 'rgba(0,139,0,0.3)'
        },
        error: {
            bg: 'radial-gradient(circle, rgba(139,0,0,0.95) 0%, rgba(80,0,0,0.95) 100%)',
            border: 'rgba(200,0,0,0.8)',
            shadow: 'rgba(139,0,0,0.3)'
        },
        info: {
            bg: 'radial-gradient(circle, rgba(0,100,200,0.95) 0%, rgba(0,60,120,0.95) 100%)',
            border: 'rgba(0,150,255,0.8)',
            shadow: 'rgba(0,100,200,0.3)'
        }
    };

    const colors = typeColors[opts.type || 'info'];

    const toast = document.createElement('div');
    toast.id = 'settings-toast';
    toast.innerHTML = `
        <div>
            <div style="font-weight: bold; font-size: 15px; margin-bottom: 4px;">${opts.title}</div>
            <div style="font-size: 13px; opacity: 0.9;">${opts.message}</div>
        </div>
    `;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        padding: 16px 20px;
        border-radius: 8px;
        background: ${colors.bg};
        border: 2px solid ${colors.border};
        color: #fff;
        font-family: gamefont, sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 40px ${colors.shadow};
        animation: slideInRight 0.3s ease-out;
        min-width: 280px;
        cursor: ${opts.onClick ? 'pointer' : 'default'};
    `;

    if (opts.onClick) {
        toast.addEventListener('click', opts.onClick);
    }

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

    // Auto-dismiss
    const dismissTime = opts.duration || (opts.type === 'restart' ? 5000 : 3000);
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, dismissTime);
}
