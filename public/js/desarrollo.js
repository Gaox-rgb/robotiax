/**
 * desarrollo.js - Controlador de Interfaz (Orquestador)
 * Coordina la UI, los Modales y los Eventos entre Payments y Editor.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Gestión del Overlay de Entrada
    const overlay = document.getElementById('explosion-overlay');
    if (overlay) {
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 600);
        }, 1500);
    }

    // 2. Escucha de Eventos Globales
    document.addEventListener('payment-completed', (e) => {
        const { templateId } = e.detail;
        window.app.ui.closeModal();
        window.app.ui.showSuccessMessage(templateId);
        window.app.editor.init(templateId);
    });
});

window.app = window.app || {};

window.app.ui = {
    selectedTemplate: { id: null, name: null },

    openEditor: function(templateId, templateName) {
        this.selectedTemplate.id = templateId;
        this.selectedTemplate.name = templateName;

        // Verificamos acceso usando el especialista en pagos
        if (window.app.payments.checkAccess(templateId)) {
            console.log(`Acceso verificado para: ${templateId}`);
            window.app.editor.init(templateId);
        } else {
            // Abrir flujo de compra
            document.getElementById('modal-template-name').textContent = templateName;
            document.getElementById('payment-modal-overlay').classList.add('visible');
            window.app.payments.initPaypalButton(templateId, '#modal-paypal-container');
        }
    },

    closeModal: function() {
        document.getElementById('payment-modal-overlay').classList.remove('visible');
    },

    showSuccessMessage: function(templateId) {
        this.showProtocolStatus('PAGO CONFIRMADO: Acceso al editor activado.');
        const card = document.getElementById('card-' + templateId);
        if (card) card.style.border = '2px solid var(--brand-color)';
    },

    showProtocolStatus: function(message, isSuccess = true) {
        const notify = document.createElement('div');
        const color = isSuccess ? '#6C5CE7' : '#FF5A5F';
        notify.style = `position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:#fff; color:#000; padding:20px 40px; font-family:'Poppins',sans-serif; z-index:10000; border-left:10px solid ${color}; box-shadow:0 15px 50px rgba(0,0,0,0.3); border-radius:8px; animation:slideUp 0.5s forwards;`;
        notify.innerHTML = `<div style="font-weight:800; color:${color}; margin-bottom:5px;">${isSuccess ? 'SISTEMA' : 'ALERTA'}</div><div>${message}</div>`;
        document.body.appendChild(notify);
        
        setTimeout(() => { 
            notify.style.animation = 'slideDown 0.5s forwards'; 
            setTimeout(() => notify.remove(), 500); 
        }, 4000);
    }
};

// Utilidades Globales de Navegación
function scrollToTables() {
    const target = document.getElementById('tablas');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
}

// Vinculación con el HTML (Punto de entrada único)
window.app.openEditor = (id, name) => window.app.ui.openEditor(id, name);
window.app.closeModal = () => window.app.ui.closeModal();
window.app.previewChanges = () => window.app.editor.preview();
window.app.openFullPreview = () => window.app.editor.preview(); // Opcional: window.open en editor.js
window.app.handleImageUpload = (e) => window.app.editor.handleUpload(e);