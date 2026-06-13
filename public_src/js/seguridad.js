document.addEventListener("DOMContentLoaded", () => {
    const secContainer = document.getElementById('security-container');
    if (!secContainer) return;

    const renderSecurity = (filterTop = true) => {
        const items = filterTop 
            ? window.app.catalog.security.slice(0, 6) 
            : window.app.catalog.security.slice(6);
        
        const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');

        items.forEach(node => {
            const isOwned = owned.includes(node.id);
            const card = document.createElement('div');
            card.className = `node-card`;
            card.innerHTML = `
                <div class="node-icon">${node.icon || '🛡️'}</div>
                <h3>${node.name}</h3>
                <p>${node.desc}</p>
                <div class="node-price">$${node.price} <span style="font-size:0.8rem; color:black; opacity:0.6;">${node.currency}</span></div>
                
                ${isOwned ? 
                    `<div class="node-owned-badge">ESCUDO ACTIVO ✓</div>` : 
                    `<button class="btn-node-purchase" onclick="window.app.ui.requestSecPurchase('${node.id}'); return false;">
                        COMPRAR AHORA
                    </button>`
                }
            `;
            secContainer.appendChild(card);
        });
    };

    renderSecurity(true);
});

// PUENTE CON EL MOTOR DE PAGOS
window.app.ui = window.app.ui || {};
window.app.ui.requestSecPurchase = (productId) => {
    const secData = window.app.catalog.security.find(p => p.id === productId);
    if(!secData) return;

    if (window.app.payments) {
        window.app.payments.openModal(productId, secData.name, secData.price, secData.currency);
    }
};