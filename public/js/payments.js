/**
 * payments.js - Motor Maestro de Pagos
 * Versión Certificada - Lógica de Pasarela
 */
window.app = window.app || {};
window.app.payments = {
    endpoints: {
        create: 'https://createpaypalorder-bh64qprvqa-uc.a.run.app',
        capture: 'https://capturepaypalorder-bh64qprvqa-uc.a.run.app'
    },

    executePurchase: function(productId, fundingType) {
        const targetId = document.getElementById('modal-paypal-container') ? 'modal-paypal-container' : 'paypal-actual-button';
        const btnBox = document.getElementById(targetId);
        
        if (btnBox) btnBox.innerHTML = '<div style="color:#00f2ff; font-family:Rajdhani; padding:20px; font-size:0.8rem;">ESTABLECIENDO CONEXIÓN SEGURA...</div>';

        fetch(this.endpoints.create, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                productId: productId,
                fundingType: fundingType,
                returnUrl: window.location.origin + window.location.pathname 
            })
        })
        .then(res => res.json())
        .then(data => {
            if(data.approveUrl) {
                localStorage.setItem('pending_purchase_id', productId);
                window.location.href = data.approveUrl;
            }
        })
        .catch(err => {
            console.error("Fallo en Pasarela:", err);
            if(btnBox) btnBox.innerHTML = '<p style="color:#ff003c;">ERROR DE PROTOCOLO. REINTENTE.</p>';
        });
    },

    openModal: function(productId, productName, price, currency) {
        const modal = document.getElementById('payment-modal-overlay');
        const nameEl = document.getElementById('modal-template-name');
        const targetId = document.getElementById('modal-paypal-container') ? 'modal-paypal-container' : 'paypal-actual-button';
        const btnBox = document.getElementById(targetId);

        if (modal && btnBox) {
            if (nameEl) nameEl.textContent = productName;
            modal.style.setProperty('display', 'flex', 'important');
            modal.classList.add('visible');

            btnBox.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px;">
                    <button onclick="window.app.payments.executePurchase('${productId}', 'paypal')" 
                        style="background: #FFD700; color: #000; border: none; padding: 18px; font-family: 'Orbitron'; font-weight: 900; cursor: pointer; text-transform: uppercase; border-radius: 2px; font-size: 0.85rem; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);">
                        PAGAR CON CUENTA PAYPAL
                    </button>
                    <button onclick="window.app.payments.executePurchase('${productId}', 'card')" 
                        style="background: transparent; color: #00f2ff; border: 2px solid #00f2ff; padding: 16px; font-family: 'Orbitron'; font-weight: 900; cursor: pointer; text-transform: uppercase; border-radius: 2px; font-size: 0.85rem; letter-spacing: 1px; box-shadow: 0 0 20px rgba(0, 234, 255, 0.1);">
                        TARJETA DE CRÉDITO / DÉBITO
                    </button>
                </div>
            `;
        }
    },

    closeModal: function() {
        const modal = document.getElementById('payment-modal-overlay');
        if (modal) {
            modal.classList.remove('visible');
            modal.style.display = 'none';
            modal.style.setProperty('display', 'none', 'important');
        }
    },

    checkAccess: function(productId) {
        const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
        return owned.includes(productId);
    },

    handleReturn: function() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'success') {
            const pendingId = localStorage.getItem('pending_purchase_id');
            if (pendingId) {
                // 1. FORZADO INMEDIATO DE INTERFAZ (LATENCIA CERO)
                const panel = document.getElementById('editor-panel');
                if (panel) {
                    console.log("🔥 [SISTEMA]: Pago detectado. Forzando Panel de Activación para:", pendingId);
                    panel.style.setProperty('display', 'block', 'important');
                    panel.style.zIndex = "200000";
                    
                    // Asegurar que el overlay de pago se cierre si quedó abierto
                    const overlay = document.getElementById('payment-modal-overlay');
                    if (overlay) overlay.style.setProperty('display', 'none', 'important');
                }

                // 2. Persistencia de compra
                const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
                if (!owned.includes(pendingId)) {
                    owned.push(pendingId);
                    localStorage.setItem('makumoto_owned', JSON.stringify(owned));
                }

                // 3. Inicialización de datos
                const checkDependencies = () => {
                    if (window.app.editor) {
                        // Si estamos en seguridad, usamos el inicializador de seguridad
                        const path = window.location.pathname;
                        if (path.includes('seguridad') || path.includes('arsenal-completo')) {
                            // Sincronización manual para listados y seguridad
                            window.app.editor.currentTemplateId = pendingId;
                            const product = [...window.app.catalog.ia, ...window.app.catalog.security].find(p => p.id === pendingId);
                            if (product) {
                                window.app.editor.currentProductName = product.name;
                                const n = document.getElementById('display-product-name');
                                const p = document.getElementById('display-product-price');
                                if (n) n.textContent = product.name;
                                if (p) p.textContent = `$${product.price} ${product.currency}`;
                            }
                        } else if (window.app.editor.init) {
                            window.app.editor.init(pendingId);
                        }
                        
                        // Limpiar URL una vez asegurado el panel
                        const cleanUrl = window.location.origin + window.location.pathname;
                        window.history.replaceState({}, document.title, cleanUrl);
                        localStorage.removeItem('pending_purchase_id');
                    } else {
                        setTimeout(checkDependencies, 50);
                    }
                };
                checkDependencies();
            }
        }
    }
};

// Ejecución inmediata: no espera al DOM, intercepta la carga
window.app.payments.handleReturn();