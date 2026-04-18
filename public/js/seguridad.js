document.addEventListener("DOMContentLoaded", () => {
    console.warn("Protocolo Fortaleza: Escaneando perímetros...");
    
    const secContainer = document.getElementById('security-container');
    const loadMoreBtn = document.getElementById('btn-load-more-sec');

    const renderSecurity = (filterTop = true) => {
        // Lógica de segmentación: Top 6 o Resto
        const items = filterTop 
            ? window.app.catalog.security.slice(0, 6) 
            : window.app.catalog.security.slice(6);
        
        const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');

        items.forEach(node => {
            const isOwned = owned.includes(node.id);
            const card = document.createElement('div');
            card.className = `node-card ${isOwned ? 'module-owned' : ''}`;
            card.innerHTML = `
                <div class="node-icon">${node.icon || '🛡️'}</div>
                <h3 style="color:#fff;">${node.name}</h3>
                <p style="color:#888; font-family:'Share Tech Mono'; font-size:0.9rem; margin-bottom:15px;">${node.desc || ''}</p>
                
                ${isOwned ? 
                    `<div style="background: rgba(0,234,255,0.1); color:#00eaff; border:1px solid #00eaff; padding:12px; font-family:'VT323'; font-size:1.2rem; text-align:center; letter-spacing:2px;">PROTOCOLO ACTIVO ✓</div>` : 
                    `<a href="#" class="btn-node-purchase" 
                       onclick="window.app.ui.requestSecPurchase('${node.id}'); return false;">COMPRAR ESCUDO</a>`
                }

                <div class="node-footer">
                    <div class="node-price" style="color:${isOwned ? '#00eaff' : '#fff'};">$${node.price} ${node.currency}</div>
                    <div style="color:#444; font-size:0.7rem;">ID: ${node.id}</div>
                </div>
            `;
            secContainer.appendChild(card);
        });
    };

    // Carga inicial (Top 6)
    renderSecurity(true);

    // La expansión ahora se maneja por enlace directo a arsenal-completo.html
    // Se elimina el listener para evitar el error de elemento nulo
});

// PUENTE CON EL MOTOR DE PAGOS
window.app.ui = window.app.ui || {};
window.app.ui.requestSecPurchase = (productId) => {
    const secData = window.app.catalog.security.find(p => p.id === productId);
    if(!secData) return;

    // Actualizar labels del panel de activación (Editor)
    const dispName = document.getElementById('display-product-name');
    const dispPrice = document.getElementById('display-product-price');
    if(dispName) dispName.textContent = secData.name;
    if(dispPrice) dispPrice.textContent = `$${secData.price} ${secData.currency}`;

    // Abrir Modal de PayPal
    document.getElementById('modal-template-name').textContent = secData.name;
    const overlay = document.getElementById('payment-modal-overlay');
    if(overlay) overlay.classList.add('visible');
    
    window.app.payments.initPaypalButton(productId, '#modal-paypal-container');
};

// Función para repoblar el panel tras el regreso de PayPal
window.app.ui.initEditorForSecurity = (productId) => {
    const secData = window.app.catalog.security.find(p => p.id === productId);
    if(!secData) return;

    // ¡CRÍTICO! SINCRONIZAR ID CON EL EDITOR
    window.app.editor.currentTemplateId = productId;

    const dispName = document.getElementById('display-product-name');
    const dispPrice = document.getElementById('display-product-price');
    
    if(dispName) dispName.textContent = secData.name;
    if(dispPrice) dispPrice.textContent = `$${secData.price} ${secData.currency}`;
    
    window.app.editor.currentProductName = secData.name;
    console.log("🛡️ [FORTALEZA]: Panel de activación preparado para escudo:", secData.name);
};