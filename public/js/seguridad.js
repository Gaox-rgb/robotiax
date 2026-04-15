document.addEventListener("DOMContentLoaded", () => {
    console.warn("Protocolo Fortaleza: Escaneando perímetros...");
    
    const secContainer = document.getElementById('security-container');
    const loadMoreBtn = document.getElementById('btn-load-more-sec');

    const renderSecurity = (filterTop = true) => {
        const items = window.app.catalog.security.filter(item => item.top === filterTop);
        
        items.forEach(node => {
            const isOwned = localStorage.getItem(`owned_${node.id}`) === 'true';
            const card = document.createElement('div');
            card.className = 'node-card';
            card.innerHTML = `
                <div class="node-icon">${node.icon}</div>
                <h3>${node.name}</h3>
                ${isOwned ? 
                    `<div style="background:rgba(0,234,255,0.1); color:#00eaff; border:1px dashed #00eaff; padding:12px; text-align:center; font-family:'VT323'; font-size:1.2rem; letter-spacing:1px;">ADQUIRIDO / EN COLA DE ACTIVACIÓN</div>` :
                    `<a href="#" class="btn-node-purchase" 
                       onclick="window.app.ui.requestSecPurchase('${node.id}')">COMPRAR ESCUDO</a>`
                }
                <div class="node-footer">
                    <a href="arsenal-completo.html" class="node-details-link">[ LISTADO MAESTRO ]</a>
                    <div class="node-price">$${node.price} ${node.currency}</div>
                </div>
            `;
            secContainer.appendChild(card);
        });
    };

    // Carga inicial (Top 6)
    renderSecurity(true);

    // Expansión del Búnker
    loadMoreBtn.addEventListener('click', () => {
        renderSecurity(false);
        loadMoreBtn.style.display = 'none';
    });
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
    if(overlay) overlay.style.setProperty('display', 'flex', 'important');
    
    window.app.payments.initPaypalButton(productId, '#modal-paypal-container');
};

window.app.ui.closeModal = () => {
    const overlay = document.getElementById('payment-modal-overlay');
    if(overlay) overlay.style.setProperty('display', 'none', 'important');
};