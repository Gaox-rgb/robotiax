/**
 * payments.js - Versión Corregida (Context Safe)
 */
window.app = window.app || {};
window.app.payments = {
    endpoints: {
        create: 'https://createpaypalorder-bh64qprvqa-uc.a.run.app',
        capture: 'https://capturepaypalorder-bh64qprvqa-uc.a.run.app'
    },

    initPaypalButton: function(templateId, containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        container.innerHTML = ''; 

        paypal.Buttons({
            createOrder: (data, actions) => {
                return fetch(window.app.payments.endpoints.create, { 
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: templateId, amount: "200.00" })
                })
                .then(res => res.json())
                .then(orderData => orderData.orderID);
            },
            onApprove: (data, actions) => {
                // Usamos la ruta completa para evitar errores de contexto 'this'
                return fetch(window.app.payments.endpoints.capture, {
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderID: data.orderID, productId: templateId })
                })
                .then(res => res.json())
                .then(orderData => {
                    console.log("Respuesta de Captura:", orderData);
                    if (orderData.status === 'success') {
                        // Guardar acceso y notificar
                        window.app.payments.saveAccess(templateId, orderData.accessToken);
                        
                        // Cierre imperativo del modal
                        window.app.ui.closeModal(); 
                        
                        document.dispatchEvent(new CustomEvent('payment-completed', { 
                            detail: { templateId: templateId } 
                        }));
                    }
                })
                .catch(err => {
                    console.error('Error Crítico en Captura:', err);
                    alert('El pago se realizó pero hubo un error al sincronizar. Recarga la página.');
                });
            }
        }).render(containerSelector);
    },

    saveAccess: function(templateId, token) {
        localStorage.setItem(`access_${templateId}`, token);
    },

    checkAccess: function(templateId) {
        return localStorage.getItem(`access_${templateId}`) !== null;
    }
};