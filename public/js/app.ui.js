/**
 * Makumoto App UI Controller
 * Centraliza toda la manipulación del DOM.
 */
app.ui = {

    init: function() {
        // Podríamos pre-cachear elementos comunes del DOM aquí si es necesario
    },

    showPaymentModal: function(itemName) {
        document.getElementById('modal-template-name').textContent = itemName;
        document.getElementById('payment-modal-overlay').classList.add('visible');
        app.state.isModalOpen = true;

        // Preparamos el contenedor de PayPal
        const container = document.getElementById('modal-paypal-container');
        container.innerHTML = '<p>Cargando pasarela de pago segura...</p>';
    },

    closeModal: function() {
        document.getElementById('payment-modal-overlay').classList.remove('visible');
        app.state.isModalOpen = false;
    },
    
    showSuccessFeedback: function(itemId) {
        // Esta función puede ser expandida para dar feedback visual de compra exitosa
        console.log(`Acceso concedido para el producto: ${itemId}.`);
        alert(`¡Activación Exitosa! El acceso a ${app.selectedItem.name} ha sido concedido.`);
        // Aquí iría la lógica para redirigir al Hub o mostrar el panel de control.
    }
};