/**
 * ia.js - Motor de Renderizado Arsenal IA
 * Versión Certificada - Solo UI y Puentes
 */
window.app = window.app || {};
window.app.ui = window.app.ui || {};

window.app.ui.showSuccessMessage = function(productId) {
    console.log("🎯 [IA]: Abriendo Panel de Activación para:", productId);
    const panel = document.getElementById('editor-panel');
    if (panel) {
        panel.style.setProperty('display', 'block', 'important');
        panel.style.zIndex = "99999";
        if (window.app.editor && typeof window.app.editor.init === 'function') {
            window.app.editor.init(productId);
        }
    }
};

window.app.ui.requestIAPurchase = function(productId) {
    if (!window.app.catalog || !window.app.catalog.ia) return;
    const appData = window.app.catalog.ia.find(p => p.id === productId);
    if(!appData) return;

    if (window.app.payments) {
        window.app.payments.openModal(productId, appData.name, appData.price, appData.currency);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const iaContainer = document.getElementById('ia-container');
    if (!iaContainer) return;

    const renderIA = (filterTop = true) => {
        const items = filterTop ? window.app.catalog.ia.slice(0, 6) : window.app.catalog.ia.slice(6);
        const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');

        items.forEach(app => {
            const isOwned = owned.includes(app.id);
            const card = document.createElement('div');
            card.className = `black-module ${isOwned ? 'module-owned' : ''}`;

            card.innerHTML = `
                <span class="module-icon">${app.icon || '🚀'}</span>
                <h3 class="module-title" style="color: #ffffff !important; font-family: 'Orbitron';">${app.name}</h3>
                <p class="module-desc" style="color: #ffffff !important; font-family: 'Rajdhani'; opacity: 1;">${app.desc}</p>
                <div style="color:${isOwned ? '#00f2ff' : '#ff3333'}; font-family:'Orbitron'; font-weight:bold; margin-bottom:15px; font-size:1.2rem;">
                    ${isOwned ? 'PROTOCOLO ADQUIRIDO' : '$' + app.price + ' ' + app.currency}
                </div>
                
                ${isOwned ? 
                    `<div style="background: rgba(0,242,255,0.1); color:#00f2ff; border:1px solid #00f2ff; padding:12px; font-family:'Orbitron'; font-size:0.8rem; text-align:center; letter-spacing:2px; border-radius:2px;">MÓDULO ACTIVO ✓</div>` : 
                    `<button class="btn-tactic-purchase" 
                        onclick="window.app.ui.requestIAPurchase('${app.id}'); return false;"
                        style="width:100%; background:#ff3333; color:#000; border:none; padding:12px; font-family:'Orbitron'; font-weight:900; cursor:pointer; text-transform:uppercase; letter-spacing:1px; border-radius:2px;">
                        COMPRAR AHORA
                    </button>`
                }

                <div class="module-footer" style="margin-top:15px; border-top:1px solid #333; padding-top:10px;">
                    <div class="module-price" style="color:#fff !important; font-size:0.6rem; letter-spacing:1px;">:: NÚCLEO EN SINCRONIZACIÓN</div>
                    <div class="module-details-link" style="color:#fff !important; font-size:0.6rem; opacity:0.6;">ID: ${app.id}</div>
                </div>
            `;
            iaContainer.appendChild(card);
        });
    };

    renderIA(true);

    const btnLoad = document.getElementById('btn-load-more-ia');
    if (btnLoad) {
        btnLoad.onclick = () => { renderIA(false); btnLoad.style.display = 'none'; };
    }
});