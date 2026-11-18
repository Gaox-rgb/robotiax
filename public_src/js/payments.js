/**
 * payments.js - Motor Maestro de Pagos
 * Versión Certificada - Lógica de Pasarela
 */
window.app = window.app || {};
window.app.payments = {
    // ENLACES OFICIALES DE STRIPE: MAKUMOTO & ROBOTIAX PAY
    stripeLinks: {
        PLAN_100: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u?allow_promotion_codes=true',
        PLAN_300: 'https://buy.stripe.com/dRmcN6gtuc4O6Q66t94gg0v?allow_promotion_codes=true',
        PLAN_UNLIMITED: 'https://buy.stripe.com/aFa00k2CEecWfmC5p54gg0x?allow_promotion_codes=true',
        PLAN_100_ERP: 'https://buy.stripe.com/cNi5kE2CEfh0deu9Fl4gg0y?allow_promotion_codes=true',
        PLAN_300_ERP: 'https://buy.stripe.com/9B628sa56d8S4HY3gX4gg0z?allow_promotion_codes=true',
        PLAN_UNLIMITED_ERP: 'https://buy.stripe.com/cNi14o4KM1qa3DU2cT4gg0A?allow_promotion_codes=true',
        web_suite: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u?allow_promotion_codes=true',
        upgrade_perfecciona: 'https://buy.stripe.com/bJe8wQ9128SC7UacRx4gg0g',
        ecommerce: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u?allow_promotion_codes=true',
        social: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u?allow_promotion_codes=true',
        arsenal_ia: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u?allow_promotion_codes=true',
        arsenal_sec: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u?allow_promotion_codes=true',
        default: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u?allow_promotion_codes=true'
    },

    executePurchase: function(productId, price, currency) {
        const planTag = localStorage.getItem('pending_plan_tag') || 'PLAN_100';
        const targetLink = this.stripeLinks[planTag] || this.stripeLinks.PLAN_100;
        
        localStorage.setItem('pending_purchase_id', productId);
        
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

            const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
            if (!owned.includes(pendingId)) {
                owned.push(pendingId);
                localStorage.setItem('makumoto_owned', JSON.stringify(owned));
            }
            localStorage.setItem('robotiax_subscription_active', 'true');
            localStorage.setItem('robotiax_renewal_deadline', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

            const draftDetails = JSON.parse(localStorage.getItem('pending_draft_details') || '{}');
            const buyerName = draftDetails.negocio || localStorage.getItem('pending_buyer_name') || 'Cliente';
            const buyerEmail = draftDetails.email || localStorage.getItem('pending_buyer_email') || '';
            const folio = localStorage.getItem('pending_draft_folio') || draftDetails.folio || 'ORD-CONFIRMADA';
            const savedProdName = localStorage.getItem('pending_product_name') || ('Suite Digital (' + pendingId.replace('cfg-', '').replace('-bot-promo', '').toUpperCase() + ')');
            const planTag = (params.get('plan') || localStorage.getItem('pending_plan_tag') || 'PLAN_100').toUpperCase();

            let breakdown = {
                name: savedProdName + ' — Plan Básico (100 Mensajes / 30 días)',
                subtotal: '$219.83 MXN',
                iva: '$35.17 MXN',
                total: '$255.00 MXN'
            };
            if (planTag === 'PLAN_300') {
                breakdown = {
                    name: savedProdName + ' — Plan Crecimiento (300 Mensajes / 30 días)',
                    subtotal: '$431.03 MXN',
                    iva: '$68.97 MXN',
                    total: '$500.00 MXN'
                };
            } else if (planTag === 'PLAN_UNLIMITED') {
                breakdown = {
                    name: savedProdName + ' — Plan Élite Ilimitado (Mensajes Ilimitados / 30 días)',
                    subtotal: '$516.38 MXN',
                    iva: '$82.62 MXN',
                    total: '$599.00 MXN'
                };
            }

            } else if (planTag === 'PLAN_100_ERP') {
                breakdown = {
                    name: savedProdName + ' — Plan Básico + ERP PyME (100 Mensajes / 30 días)',
                    subtotal: '$392.24 MXN',
                    iva: '$62.76 MXN',
                    total: '$455.00 MXN'
                };
            } else if (planTag === 'PLAN_300_ERP') {
                breakdown = {
                    name: savedProdName + ' — Plan Crecimiento + ERP PyME (300 Mensajes / 30 días)',
                    subtotal: '$689.66 MXN',
                    iva: '$110.34 MXN',
                    total: '$800.00 MXN'
                };
            } else if (planTag === 'PLAN_UNLIMITED_ERP') {
                breakdown = {
                    name: savedProdName + ' — Plan Élite Ilimitado + ERP (Ilimitado / 30 días)',
                    subtotal: '$1,377.59 MXN',
                    iva: '$220.41 MXN',
                    total: '$1,598.00 MXN'
                };
            }

            localStorage.setItem('robotiax_user', JSON.stringify({
                name: buyerName,
                email: buyerEmail,
                authenticated: true
            }));

            const prodEl = document.getElementById('success-product-name');
            const folioEl = document.getElementById('success-folio');
            const subEl = document.getElementById('success-subtotal');
            const ivaEl = document.getElementById('success-iva');
            const totEl = document.getElementById('success-total');

            if (prodEl) prodEl.textContent = breakdown.name;
            if (folioEl) folioEl.textContent = folio;
            if (subEl) subEl.textContent = breakdown.subtotal;
            if (ivaEl) ivaEl.textContent = breakdown.iva;
            if (totEl) totEl.textContent = breakdown.total;

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