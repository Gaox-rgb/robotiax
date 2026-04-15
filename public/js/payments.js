/**
 * payments.js - Versión Corregida (Context Safe)
 */
window.app.payments = {
    endpoints: {
        create: 'https://createpaypalorder-bh64qprvqa-uc.a.run.app',
        capture: 'https://capturepaypalorder-bh64qprvqa-uc.a.run.app'
    },

openModal: function(id, name, price, currency) {
        const modal = document.getElementById('payment-modal-overlay');
        const title = document.getElementById('modal-template-name');
        
        window.app.activePurchase = { id, name, price, currency };

        if(title) title.textContent = name;
        if(modal) modal.classList.add('visible');
        
        this.renderOfficialButtons();
    },

    renderOfficialButtons: function() {
        const btnBox = document.getElementById('paypal-actual-button');
        if (!btnBox) return;
        
        btnBox.innerHTML = '<div id="sdk-loading" style="color:#00f2ff; text-align:center; padding:20px; font-family:Rajdhani;">INICIANDO TERMINAL SEGURA...</div>';

        const { id, price, currency } = window.app.activePurchase;

        paypal.Buttons({
            style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
            createOrder: (data, actions) => {
                return fetch(this.endpoints.create, { 
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: id, amount: price, currency: currency })
                }).then(res => res.json()).then(d => d.orderID);
            },
            onApprove: (data, actions) => {
                return fetch(this.endpoints.capture, {
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderID: data.orderID, productId: id })
                }).then(res => res.json()).then(res => {
                    if (res.status === 'success') {
                        this.closeModal();
                        window.app.editor.init(id);
                    }
                });
            }
        }).render('#paypal-actual-button').then(() => {
            const loading = document.getElementById('sdk-loading');
            if (loading) loading.remove();
        });
    },

    resetUI: function() {
        const btn = document.getElementById('paypal-actual-button');
        if (btn) btn.innerHTML = '';
    },

    closeModal: function() {
        const modal = document.getElementById('payment-modal-overlay');
        if (modal) modal.classList.remove('visible');
        this.resetUI();
    },

    // Bridge para compatibilidad con desarrollo.js
    initPaypalButton: function() {
        this.resetUI();
    },

    saveAccess: function(templateId, token) {
        localStorage.setItem(`access_${templateId}`, token);
    },

    checkAccess: function(templateId) {
        return localStorage.getItem(`access_${templateId}`) !== null;
    }
};