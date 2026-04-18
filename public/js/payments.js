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

    initPaypalButton: function(productId, containerSelector) {
        const targetId = containerSelector.replace('#', '');
        const btnBox = document.getElementById(targetId);
        if (!btnBox) return;
        
        btnBox.innerHTML = '<div style="color:#00f2ff; font-family:Rajdhani; padding:20px;">CONECTANDO CON PAYPAL...</div>';

        fetch(this.endpoints.create, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                productId: productId,
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
            btnBox.innerHTML = '<p style="color:red;">Error de conexión.</p>';
        });
    },

    closeModal: function() {
        const modal = document.getElementById('payment-modal-overlay');
        if (modal) modal.style.setProperty('display', 'none', 'important');
    },

    handleReturn: function() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'success') {
            const pendingId = localStorage.getItem('pending_purchase_id');
            if (pendingId) {
                // 1. FORZADO INMEDIATO DE INTERFAZ (LATENCIA CERO)
                const panel = document.getElementById('editor-panel');
                if (panel) {
                    panel.style.setProperty('display', 'block', 'important');
                    panel.style.zIndex = "200000"; // Por encima de todo
                }

                // 2. Persistencia de compra
                const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
                if (!owned.includes(pendingId)) {
                    owned.push(pendingId);
                    localStorage.setItem('makumoto_owned', JSON.stringify(owned));
                }

                // 3. Inicialización de datos
                const checkDependencies = () => {
                    if (window.app.editor && window.app.editor.init) {
                        window.app.editor.init(pendingId);
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