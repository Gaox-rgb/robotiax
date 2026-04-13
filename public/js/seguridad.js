document.addEventListener("DOMContentLoaded", () => {
    console.warn("Protocolo Fortaleza: Escaneando perímetros...");
    
    const secContainer = document.getElementById('security-container');
    const loadMoreBtn = document.getElementById('btn-load-more-sec');

    const renderSecurity = (filterTop = true) => {
        const items = window.app.catalog.security.filter(item => item.top === filterTop);
        
        items.forEach(node => {
            const card = document.createElement('div');
            card.className = 'node-card';
            card.innerHTML = `
                <div class="node-icon">${node.icon}</div>
                <h3>${node.name}</h3>
                <p>${node.desc}</p>
                <a href="#" class="btn-node-purchase" 
                   onclick="window.app.ui.requestSecPurchase('${node.id}')">ACTIVAR ESCUDO</a>
                <div class="node-footer">
                    <a href="#" class="node-details-link">&lt;DETALLES&gt;</a>
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
window.app.ui.requestSecPurchase = (productId) => {
    const secData = window.app.catalog.security.find(p => p.id === productId);
    if(!secData) return;

    document.getElementById('modal-template-name').textContent = secData.name;
    document.getElementById('payment-modal-overlay').classList.add('visible');
    
    // Iniciar PayPal dinámico (Detección automática de USD/MXN en payments.js)
    window.app.payments.initPaypalButton(productId, '#modal-paypal-container');
};