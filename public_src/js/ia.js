window.app = window.app || {};
window.app.ui = window.app.ui || {};

window.app.ui.requestIAPurchase = function(productId) {
    if (!window.app.catalog || !window.app.catalog.ia) return;
    const appData = window.app.catalog.ia.find(p => p.id === productId);
    
    // CASO ESPECIAL RED ORBIT
    const product = appData || { id: 'red-orbit-system', name: 'RED ORBIT SYSTEM (FULL ARSENAL)', price: 997, currency: 'USD' };
    
    if (window.app.payments) {
        window.app.payments.openModal(product.id, product.name, product.price, product.currency);
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
            card.className = `black-module`;

            card.innerHTML = `
                <h3 class="module-title">${app.name}</h3>
                <p class="module-desc">${app.desc}</p>
                <div class="module-price">$${app.price} <span style="font-size:0.9rem; color:#000000; opacity: 0.6;">${app.currency}</span></div>

                ${isOwned ? 
                    `<div class="btn-module-purchase" style="background:var(--robotiax-red); color:white;">ADQUIRIDO ✓</div>` : 
                    `<button class="btn-module-purchase" onclick="window.app.ui.requestIAPurchase('${app.id}'); return false;">
                        COMPRAR AHORA
                    </button>`
                }
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