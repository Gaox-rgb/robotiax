document.addEventListener("DOMContentLoaded", () => {
    console.log("Arsenal IA: Sistema Iniciado...");
    
    const iaContainer = document.getElementById('ia-container');
    const loadMoreBtn = document.getElementById('btn-load-more-ia');
    
    // 1. RENDERIZAR TOP 6 (Soldados de Infantería)
    const renderIA = (filterTop = true) => {
        // Si filterTop es true, toma los primeros 6 del catálogo. Si es false, toma el resto.
        const items = filterTop 
            ? window.app.catalog.ia.slice(0, 6) 
            : window.app.catalog.ia.slice(6);
        
        items.forEach(app => {
            const card = document.createElement('div');
            card.className = 'black-module';
            card.innerHTML = `
                <span class="module-icon">${app.icon || '🚀'}</span>
                <h3 class="module-title">${app.name}</h3>
                <p class="module-desc">${app.desc}</p>
                <div style="color: #ff3333; font-family: 'Orbitron'; font-weight: bold; margin-bottom: 10px; font-size: 1.1rem;">$${app.price} ${app.currency}</div>
                <a href="#" class="action-button-purchase btn-module-purchase" 
                   onclick="window.app.ui.requestIAPurchase('${app.id}'); return false;">COMPRAR AHORA</a>
                <div class="module-footer">
                    <div class="module-price">:: PROCESO IA ACTIVO</div>
                    <div class="module-details-link" style="color:#666; font-size:0.7rem;">CÓDIGO: ${app.id}</div>
                </div>
            `;
            iaContainer.appendChild(card);
        });
    };

    // Carga inicial
    renderIA(true);

    // 2. LOGICA "VER MÁS"
    loadMoreBtn.addEventListener('click', () => {
        renderIA(false); // Carga las 24 restantes
        loadMoreBtn.style.display = 'none';
    });
});

// PUENTE CON EL MOTOR DE PAGOS
window.app.ui = window.app.ui || {};
window.app.ui.requestIAPurchase = (productId) => {
    const appData = window.app.catalog.ia.find(p => p.id === productId);
    if(!appData) return;

    // Actualizar encabezado del formulario de datos
    document.getElementById('display-product-name').textContent = appData.name;
    document.getElementById('display-product-price').textContent = `$${appData.price} ${appData.currency}`;
    
    console.log("🕹️ Iniciando Pasarela para:", productId);
    const overlay = document.getElementById('payment-modal-overlay');
    if (overlay) {
        overlay.style.setProperty('display', 'flex', 'important');
    }
    
    window.app.payments.initPaypalButton(productId, '#modal-paypal-container');
};