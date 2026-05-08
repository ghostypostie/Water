// PINK VERSION - All cyan/tidal colors replaced with pink
let injected = false;

export function injectTidalGridStyles() {
    if (injected) return;
    if (document.getElementById('qp-tidal-grid-styles')) {
        injected = true;
        return;
    }
    const style = document.createElement('style');
    style.id = 'qp-tidal-grid-styles';
    style.textContent = TIDAL_GRID_CSS;
    document.head.appendChild(style);
    injected = true;
}

const TIDAL_GRID_CSS = `
.qp-tidal-window {
    background:
        radial-gradient(ellipse at 50% 0%, rgba(255, 20, 147, 0.10) 0%, transparent 60%),
        linear-gradient(180deg, rgba(26, 2, 17, 0.96), rgba(26, 2, 17, 0.99)) !important;
    border: 1px solid rgba(255, 20, 147, 0.18) !important;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6), inset 0 0 60px rgba(255, 20, 147, 0.05) !important;
    color: #FFE5FA !important;
    overflow: hidden;
    position: relative;
}
.qp-tidal-window::before {
    content: '';
    position: absolute; inset: 0;
    background-image:
        linear-gradient(transparent 95%, rgba(255, 20, 147, 0.04) 100%),
        linear-gradient(90deg, transparent 95%, rgba(255, 20, 147, 0.04) 100%);
    background-size: 40px 40px;
    pointer-events: none;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 90%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 90%);
}

.qp-tidal-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 20, 147, 0.18);
    background: linear-gradient(90deg, rgba(255, 20, 147, 0.08), transparent 60%);
    position: relative;
}
.qp-tidal-header-glyph {
    width: 16px; height: 16px;
    background: #FF1493;
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    box-shadow: 0 0 14px rgba(255, 20, 147, 0.6);
    animation: qpGlyphSpin 3s linear infinite;
}
@keyframes qpGlyphSpin {
    to { transform: rotate(360deg); }
}
.qp-tidal-header-title {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 13px;
    letter-spacing: 0.3em;
    color: #FFE5FA;
    text-shadow: 0 0 6px rgba(255, 20, 147, 0.5);
    flex: 1;
}
.qp-tidal-header-meter {
    width: 80px; height: 4px;
    background: rgba(255, 20, 147, 0.1);
    overflow: hidden;
    position: relative;
}
.qp-tidal-header-meter::after {
    content: '';
    position: absolute;
    top: 0; left: -50%;
    width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, #FF69B4, transparent);
    animation: qpHeaderScan 2s linear infinite;
}
@keyframes qpHeaderScan {
    to { left: 100%; }
}

.qp-tidal-holder {
    padding: 22px !important;
    overflow-y: auto;
    max-height: 70vh;
    position: relative;
    z-index: 1;
}

.qp-tidal-toolbar {
    display: grid;
    grid-template-columns: 280px 1fr auto;
    gap: 18px;
    align-items: center;
    margin-bottom: 14px;
    padding: 14px 18px;
    background: rgba(255, 20, 147, 0.04);
    border: 1px solid rgba(255, 20, 147, 0.18);
    clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.qp-tidal-search {
    position: relative;
    display: flex;
    align-items: center;
}
.qp-tidal-search-icon {
    position: absolute;
    left: 10px;
    width: 12px; height: 12px;
    border: 1.5px solid #FF1493;
    border-radius: 50%;
    box-shadow: 6px 6px 0 -3px #FF1493;
}
.qp-tidal-search-input {
    width: 100%;
    background: rgba(26, 2, 17, 0.7);
    border: 1px solid rgba(255, 20, 147, 0.28);
    color: #FFE5FA;
    padding: 8px 12px 8px 32px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 12px;
    letter-spacing: 0.05em;
    outline: none;
    clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
    transition: border-color 180ms, box-shadow 180ms;
}
.qp-tidal-search-input:focus {
    border-color: #FF1493;
    box-shadow: 0 0 0 1px rgba(255, 20, 147, 0.3), 0 0 12px rgba(255, 20, 147, 0.2);
}
.qp-tidal-search-input::placeholder {
    color: rgba(240, 196, 230, 0.4);
}

.qp-tidal-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
}
.qp-tidal-chip {
    background: transparent;
    border: 1px solid rgba(255, 20, 147, 0.22);
    color: rgba(240, 196, 230, 0.65);
    padding: 6px 14px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 10px;
    letter-spacing: 0.25em;
    cursor: pointer;
    text-transform: uppercase;
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
    transition: background 160ms, color 160ms, border-color 160ms;
}
.qp-tidal-chip:hover {
    color: #FFE5FA;
    border-color: #FF1493;
}
.qp-tidal-chip.is-active {
    background: rgba(255, 20, 147, 0.18);
    color: #FF69B4;
    border-color: #FF69B4;
    text-shadow: 0 0 6px rgba(255, 105, 180, 0.6);
}

.qp-tidal-actions { display: flex; gap: 6px; }
.qp-tidal-action {
    background: transparent;
    border: 1px solid rgba(255, 85, 119, 0.4);
    color: rgba(255, 192, 200, 0.8);
    padding: 6px 14px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 10px;
    letter-spacing: 0.25em;
    cursor: pointer;
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
    transition: background 160ms;
}
.qp-tidal-action:hover {
    background: rgba(255, 85, 119, 0.15);
    color: #FFE5E9;
}
.qp-tidal-action-primary {
    border-color: rgba(255, 20, 147, 0.4);
    color: rgba(240, 196, 230, 0.85);
}
.qp-tidal-action-primary:hover {
    background: rgba(255, 20, 147, 0.18);
    color: #FF69B4;
}

.qp-tidal-summary {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 10px 14px;
    margin-bottom: 14px;
    background: linear-gradient(90deg, rgba(255, 105, 180, 0.06), transparent);
    border-left: 2px solid #FF69B4;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
}
.qp-tidal-summary-tag {
    font-size: 9px;
    letter-spacing: 0.3em;
    color: rgba(240, 196, 230, 0.6);
}
.qp-tidal-summary-num {
    font-size: 22px;
    font-weight: 700;
    color: #FF69B4;
    text-shadow: 0 0 8px rgba(255, 105, 180, 0.6);
    font-feature-settings: "tnum";
    font-variant-numeric: tabular-nums;
}
.qp-tidal-summary-of {
    font-size: 11px;
    letter-spacing: 0.15em;
    color: rgba(240, 196, 230, 0.55);
}

.qp-tidal-hex-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    padding: 8px 0;
}

.qp-tidal-hex {
    position: relative;
    background: transparent;
    border: none;
    padding: 0;
    height: 86px;
    cursor: pointer;
    color: rgba(240, 196, 230, 0.78);
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    transition: transform 220ms cubic-bezier(.23,1,.32,1), filter 220ms;
}
.qp-tidal-hex:hover {
    transform: translateY(-3px);
    filter: brightness(1.15);
}

.qp-tidal-hex-shape {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(44, 7, 32, 0.9), rgba(26, 2, 17, 0.9));
    clip-path: polygon(50% 0, 100% 28%, 100% 72%, 50% 100%, 0 72%, 0 28%);
    transition: background 220ms, box-shadow 220ms;
    box-shadow: inset 0 0 0 1px rgba(255, 20, 147, 0.2);
}
.qp-tidal-hex:hover .qp-tidal-hex-shape {
    background: linear-gradient(135deg, rgba(255, 20, 147, 0.15), rgba(255, 20, 147, 0.05));
    box-shadow: inset 0 0 0 1px rgba(255, 20, 147, 0.5);
}

.qp-tidal-hex.is-selected .qp-tidal-hex-shape {
    background: linear-gradient(135deg, rgba(255, 105, 180, 0.22), rgba(255, 20, 147, 0.12));
    box-shadow:
        inset 0 0 0 1.5px #FF69B4,
        0 0 22px rgba(255, 105, 180, 0.45),
        0 0 0 6px rgba(255, 105, 180, 0.0);
    animation: qpHexLock 0.4s cubic-bezier(.23,1,.32,1);
}
@keyframes qpHexLock {
    0% { transform: scale(0.92); }
    60% { transform: scale(1.04); }
    100% { transform: scale(1); }
}

.qp-tidal-hex.is-selected::after {
    content: '';
    position: absolute;
    inset: -2px;
    clip-path: polygon(50% 0, 100% 28%, 100% 72%, 50% 100%, 0 72%, 0 28%);
    background: linear-gradient(135deg, transparent 0 30%, rgba(255, 105, 180, 0.6) 50%, transparent 70%);
    animation: qpHexShimmer 2s linear infinite;
    pointer-events: none;
    opacity: 0.6;
    mix-blend-mode: screen;
}
@keyframes qpHexShimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

.qp-tidal-hex.is-any .qp-tidal-hex-shape {
    background: linear-gradient(135deg, rgba(244, 57, 225, 0.15), rgba(255, 20, 147, 0.08));
}
.qp-tidal-hex.is-any.is-selected .qp-tidal-hex-shape {
    background: linear-gradient(135deg, rgba(255, 105, 180, 0.3), rgba(244, 57, 225, 0.18));
}

.qp-tidal-hex-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 8px;
    z-index: 1;
}

.qp-tidal-hex-tag {
    font-size: 8px;
    letter-spacing: 0.25em;
    color: rgba(240, 196, 230, 0.45);
    text-transform: uppercase;
}
.qp-tidal-hex.is-any .qp-tidal-hex-tag {
    font-size: 14px;
    color: #F439E1;
    letter-spacing: 0;
}
.qp-tidal-hex.is-selected .qp-tidal-hex-tag {
    color: rgba(255, 105, 180, 0.75);
}

.qp-tidal-hex-name {
    font-size: 12px;
    text-align: center;
    color: rgba(240, 196, 230, 0.85);
    line-height: 1.2;
    font-weight: 500;
}
.qp-tidal-hex.is-selected .qp-tidal-hex-name {
    color: #FFE5FA;
    text-shadow: 0 0 6px rgba(255, 105, 180, 0.5);
}

/* map specific */
.qp-tidal-hex.is-map { height: 96px; }
.qp-tidal-hex.is-map .qp-tidal-hex-shape {
    clip-path: polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
}
.qp-tidal-hex.is-map.is-selected::after {
    clip-path: polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
}

/* region specific - wider rectangular cards with side stripe */
.qp-tidal-region-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
}
.qp-tidal-region {
    position: relative;
    background: linear-gradient(90deg, rgba(44, 7, 32, 0.9), rgba(26, 2, 17, 0.9));
    border: 1px solid rgba(255, 20, 147, 0.2);
    padding: 14px 16px 14px 22px;
    cursor: pointer;
    color: rgba(240, 196, 230, 0.78);
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    text-align: left;
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
    transition: background 200ms, transform 200ms;
}
.qp-tidal-region::before {
    content: '';
    position: absolute;
    left: 0; top: 12px; bottom: 12px;
    width: 3px;
    background: rgba(255, 20, 147, 0.3);
    transition: background 200ms, box-shadow 200ms;
}
.qp-tidal-region:hover {
    transform: translateX(2px);
    background: linear-gradient(90deg, rgba(255, 20, 147, 0.12), rgba(26, 2, 17, 0.9));
}
.qp-tidal-region:hover::before {
    background: #FF1493;
    box-shadow: 0 0 12px rgba(255, 20, 147, 0.6);
}
.qp-tidal-region.is-selected {
    background: linear-gradient(90deg, rgba(255, 105, 180, 0.18), rgba(255, 20, 147, 0.08));
    border-color: #FF69B4;
    box-shadow: 0 0 22px rgba(255, 105, 180, 0.25);
}
.qp-tidal-region.is-selected::before {
    background: #FF69B4;
    box-shadow: 0 0 14px #FF69B4;
}
.qp-tidal-region-code {
    display: block;
    font-size: 10px;
    letter-spacing: 0.3em;
    color: #F439E1;
    margin-bottom: 4px;
}
.qp-tidal-region.is-selected .qp-tidal-region-code {
    color: #FF69B4;
    text-shadow: 0 0 6px rgba(255, 105, 180, 0.6);
}
.qp-tidal-region-name {
    display: block;
    font-size: 14px;
    color: #FFE5FA;
    font-weight: 500;
}
.qp-tidal-region-coords {
    display: block;
    margin-top: 4px;
    font-size: 9px;
    letter-spacing: 0.15em;
    color: rgba(240, 196, 230, 0.45);
}
`;
