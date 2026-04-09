/**
 * Makumoto App Events Manager
 * Gestiona todos los eventos de usuario y la lógica de negocio del lado del cliente.
 */
app.events = {

    init: function() {
        // Delegación de eventos: un solo listener para toda la página
        document.body.addEventListener('click', this.handleGlobalClick.bind(this));
    },

    handleGlobalClick: function(event) {
        const target = event.target;

        // Botones de compra de Super-Apps
        const purchaseButton = target.closest('.action-button-purchase');
        if (purchaseButton) {
            event.preventDefault();
            this.initPurchaseFlow(purchaseButton);
        }

        // Botones para cerrar modales
        const closeModalButton = target.closest('.modal-close-button');
        if (closeModalButton) {
            event.preventDefault();
            app.ui.closeModal();
        }
    },
    
    initPurchaseFlow: function(button) {
        const { productId, productName, productPrice, productCurrency } = button.dataset;
        
        app.selectedItem.id = productId;
        app.selectedItem.name = productName;
        app.selectedItem.price = productPrice;
        app.selectedItem.currency = productCurrency || 'MXN'; // Default a MXN

        const accessToken = localStorage.getItem(`token_${productId}`);

        if (accessToken) {
            console.log(`El usuario ya posee acceso a ${productId}.`);
            app.ui.showSuccessFeedback(productId);
        } else {
            app.ui.showPaymentModal(productName);
            // Retraso para asegurar que el modal es visible antes de renderizar PayPal
            setTimeout(() => {
                this.initPaypalButton();
            }, 300);
        }
    },
    
    initPaypalButton: function() {
        paypal.Buttons({
            createOrder: (data, actions) => {
                return fetch('https://createpaypalorder-bh64qprvqa-uc.a.run.app', {
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: app.selectedItem.price,
                        currency: app.selectedItem.currency,
                        productId: app.selectedItem.id
                    })
                })
                .then(res => res.json())
                .then(orderData => orderData.orderID)
                .catch(err => console.error("Error en createOrder:", err));
            },
            onApprove: (data, actions) => {
                return fetch('https://capturepaypalorder-bh64qprvqa-uc.a.run.app', {
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderID: data.orderID,
                        productId: app.selectedItem.id
                    })
                }).then(res => {
                    if (!res.ok) {
                        return res.json().then(errData => { throw new Error(errData.message || 'Error del servidor') });
                    }
                    return res.json();
                }).then(orderData => {
                    if (orderData.status === 'success' && orderData.accessToken) {
                        localStorage.setItem(`token_${app.selectedItem.id}`, orderData.accessToken);
                        app.ui.closeModal();
                        app.ui.showSuccessFeedback(app.selectedItem.id);
                    } else {
                        alert(orderData.message || 'Hubo un problema al validar tu pago.');
                    }
                }).catch(error => {
                    console.error('Error durante la aprobación del pago:', error);
                    alert(`Error en el pago: ${error.message}`);
                });
            }
        }).render('#modal-paypal-container');
    }
};