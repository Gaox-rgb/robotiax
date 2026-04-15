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
// 1.5. Verificar Plantillas Compradas (Reforzado)
    const updateOwnedButtons = () => {
        const owned = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
        owned.forEach(templateId => {
            // Buscamos botones que contengan el ID en su atributo onclick
            const buttons = document.querySelectorAll(`button[onclick*="${templateId}"]`);
            buttons.forEach(btn => {
                btn.innerHTML = '✔️ ADQUIRIDA';
                btn.style.setProperty('background', '#2ecc71', 'important');
                btn.style.setProperty('color', '#ffffff', 'important');
                btn.style.setProperty('border-color', '#2ecc71', 'important');
                btn.style.cursor = 'default';
                btn.disabled = true;
                btn.onclick = null; 

                const card = btn.closest('.template-card');
                if (card) card.style.borderColor = '#2ecc71';
            });
        });
    };
    

    // 2. Escucha de Eventos Globales
    updateOwnedButtons();
    
    // Escuchador de cambios en localStorage (Para marcar como adquirido sin refrescar si es necesario)
    window.addEventListener('storage', (e) => {
        if (e.key === 'makumoto_owned') updateOwnedButtons();
    });
});

window.app = window.app || {};

window.app.ui = {
    selectedTemplate: { id: null, name: null },

    closeModal: function() {
        const modal = document.getElementById('payment-modal-overlay');
        if (modal) modal.classList.remove('visible');
    },

    openEditor: function(templateId, templateName) {
        this.closeModal(); 
        const panel = document.getElementById('editor-panel');
        if (panel) {
            document.body.classList.add('editor-open'); // Congela el fondo
            panel.classList.add('active'); 
            window.app.editor.init(templateId);
        }
    },

    closeEditor: function() {
        const panel = document.getElementById('editor-panel');
        if (panel) {
            document.body.classList.remove('editor-open'); // Libera el fondo
            panel.classList.remove('active');
        }
    },

    requestPurchase: function(templateId, templateName) {
        console.log("Iniciando compra de:", templateId);
        this.selectedTemplate.id = templateId;
        this.selectedTemplate.name = templateName;

        const payments = window.app.payments;
        if (!payments) return console.error("Error: payments.js no cargado.");

        if (payments.checkAccess(templateId)) {
            this.openEditor(templateId, templateName);
        } else {
            // El precio en MXN es fijo para desarrollo-web según briefing
            payments.openModal(templateId, templateName, 99, 'MXN');
        }
    },

    closeEditor: function() {
        const panel = document.getElementById('editor-panel');
        if (panel) {
            panel.classList.remove('active');
            const target = document.getElementById('tablas');
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        }
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
window.app.openFullPreview = () => window.app.editor.openFullPreview();
window.app.handleImageUpload = (e) => window.app.editor.handleUpload(e);
window.app.ui.requestPurchase = window.app.ui.requestPurchase.bind(window.app.ui);