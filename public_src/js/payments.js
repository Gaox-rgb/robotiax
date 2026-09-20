/**
 * payments.js - Motor Maestro de Pagos
 * Versión Certificada - Lógica de Pasarela
 */
window.app = window.app || {};
window.app.payments = {
    // ENLACES OFICIALES DE STRIPE: MAKUMOTO & ROBOTIAX PAY
    stripeLinks: {
        // Enlace Universal para todas las Suites Digitales Web con soporte de cupones
        web_suite: 'https://buy.stripe.com/3cIcN6dhi9WG0rIdVB4gg0f?allow_promotion_codes=true',
        upgrade_perfecciona: 'https://buy.stripe.com/bJe8wQ9128SC7UacRx4gg0g',
        default: 'https://buy.stripe.com/3cIcN6dhi9WG0rIdVB4gg0f?allow_promotion_codes=true'
    },

    executePurchase: function(productId, price, currency) {
        localStorage.setItem('pending_purchase_id', productId);
        console.log("💳 [STRIPE PAY]: Redirigiendo con cupones activos para:", productId);
        
        const targetLink = this.stripeLinks.web_suite || this.stripeLinks.default;
        
        if (window.top && window.top !== window) {
            window.top.location.href = targetLink;
        } else {
            window.location.href = targetLink;
        }
    },

    openModal: function(productId, productName, price, currency) {
        // Ejecución directa de compra con Makumoto & Robotiax Pay
        this.executePurchase(productId, price, currency);
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
        if (params.get('status') === 'success' || params.has('session_id') || params.has('client_reference_id')) {
            const pendingId = localStorage.getItem('pending_purchase_id') || 'salud';
            
            // Persistencia inmediata de compra
            const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
            if (!owned.includes(pendingId)) {
                owned.push(pendingId);
                localStorage.setItem('makumoto_owned', JSON.stringify(owned));
            }

            // AUTO-LOGIN: Activar sesión del comprador para que aparezca "Hola, [Nombre]"
            const draftDetails = JSON.parse(localStorage.getItem('pending_draft_details') || '{}');
            const buyerName = draftDetails.negocio || localStorage.getItem('pending_buyer_name') || 'Cliente';
            const buyerEmail = draftDetails.email || localStorage.getItem('pending_buyer_email') || '';

            localStorage.setItem('robotiax_user', JSON.stringify({
                name: buyerName,
                email: buyerEmail,
                authenticated: true
            }));

            // Desplegar modal informativo automático
            const modal = document.getElementById('post-payment-modal');
            if (modal) {
                modal.style.setProperty('display', 'flex', 'important');
            }
        }
    },

    closePostPaymentModal: function() {
        const modal = document.getElementById('post-payment-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        // Limpiar parámetros de URL silenciosamente
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        localStorage.removeItem('pending_purchase_id');
    }
};

// Ejecución inmediata al cargar para capturar retornos exitosos de Stripe
window.app.payments.handleReturn();