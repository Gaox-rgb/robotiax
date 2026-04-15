/**
 * payments.js - Motor Maestro de Pagos Robotiax
 * Versión Certificada 4.2 - Sin Errores de Sintaxis
 */
window.app = window.app || {};

window.app.payments = {
    endpoints: {
        create: 'https://createpaypalorder-bh64qprvqa-uc.a.run.app',
        capture: 'https://capturepaypalorder-bh64qprvqa-uc.a.run.app'
    },

    /**
     * Abre el modal y prepara el terreno para PayPal
     */
    openModal: function(id, name, price, currency) {
        console.log("Preparando pasarela para:", id);
        const modal = document.getElementById('payment-modal-overlay');
        const title = document.getElementById('modal-template-name');
        
        window.app.activePurchase = { id, name, price, currency };

        if (title) title.textContent = name;
        if (modal) modal.classList.add('visible');
        
        // Determinar contenedor según la página (desarrollo-web vs las otras)
        const container = document.getElementById('paypal-actual-button') ? '#paypal-actual-button' : '#modal-paypal-container';
        this.initPaypalButton(id, container);
    },

    /**
     * Renderiza el botón de PayPal oficial
     */
    initPaypalButton: function(productId, containerSelector) {
        const targetId = containerSelector.replace('#', '');
        const btnBox = document.getElementById(targetId);
        if (!btnBox) return;
        
        btnBox.innerHTML = '<div style="text-align:center; padding:20px;"><div style="border:3px solid #333; border-top:3px solid #00f2ff; border-radius:50%; width:30px; height:30px; animation:spinPay 1s linear infinite; margin:0 auto 15px;"></div><p style="font-family:Rajdhani; color:#00f2ff; font-size:0.8rem; letter-spacing:2px;">SALTANDO A PASARELA...</p></div><style>@keyframes spinPay{to{transform:rotate(360deg)}}</style>';

        // Buscar el producto en el catálogo si no está en la variable global
        let product = window.app.activePurchase || 
                      window.app.catalog.ia.find(p => p.id === productId) || 
                      window.app.catalog.security.find(p => p.id === productId);

        if (!product) {
            console.error("❌ Producto no encontrado en el catálogo:", productId);
            btnBox.innerHTML = '<p style="color:red; font-size:0.7rem;">ERROR: PRODUCTO NO IDENTIFICADO</p>';
            return;
        }

        fetch(this.endpoints.create, { 
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                productId: product.id, 
                amount: product.price, 
                currency: product.currency,
                returnPage: window.location.pathname.split('/').pop() // Captura 'soluciones-ia.html', 'seguridad.html', etc.
            })
        })
        .then(res => res.json())
        .then(data => {
            if(data.approveUrl) {
                localStorage.setItem('pending_purchase_id', product.id);
                window.location.href = data.approveUrl;
            }
        })
        .catch(err => { btnBox.innerHTML = '<p style="color:red; font-size:0.7rem;">ERROR DE CONEXIÓN</p>'; });
    },

    resetUI: function() {
        const btn = document.getElementById('paypal-actual-button') || document.getElementById('modal-paypal-container');
        if (btn) btn.innerHTML = '';
    },

    closeModal: function() {
        const modal = document.getElementById('payment-modal-overlay');
        if (modal) modal.classList.remove('visible');
        this.resetUI();
    },

    checkAccess: function(templateId) {
        const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
        return owned.includes(templateId);
    },

    handleReturn: function() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('status') === 'success') {
            const pendingId = localStorage.getItem('pending_purchase_id');
            if (pendingId) {
                const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
                if (!owned.includes(pendingId)) owned.push(pendingId);
                localStorage.setItem('makumoto_owned', JSON.stringify(owned));
                localStorage.removeItem('pending_purchase_id');
                window.history.replaceState({}, document.title, window.location.pathname);
                setTimeout(() => { if(window.app.ui) window.app.ui.showSuccessMessage(pendingId); }, 1000);
            }
        }
    }
};

window.app.payments.handleReturn();