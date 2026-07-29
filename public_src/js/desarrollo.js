/**
 * desarrollo.js - Controlador de Interfaz (Orquestador)
 * Coordina la UI, los Modales y los Eventos entre Payments y Editor.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Gestión del Overlay de Entrada
    window.onscroll = function() {
        const btn = document.getElementById('btn-up');
        if (btn) {
            btn.style.display = (document.body.scrollTop > 500 || document.documentElement.scrollTop > 500) ? "flex" : "none";
        }
    };

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

    requestPurchase: function(templateId, templateName) {
        console.log("Iniciando compra de Suite:", templateId);
        this.selectedTemplate.id = templateId;
        this.selectedTemplate.name = templateName;

        if (!window.app.payments) return console.error("Error: payments.js no cargado.");

        // Flujo transaccional directo sin formularios pesados: Abre la pasarela para cobro con IVA ($232 MXN Final)
        window.app.payments.openModal(templateId, templateName, 200, 'MXN');
    },

    openDemoVisor: function(templateId) {
        const overlay = document.getElementById('demo-visor-overlay');
        const iframe = document.getElementById('demo-visor-iframe');
        if (!overlay || !iframe) return;

        // Resolvedor Dinámico de Entorno para evitar fallos de emulador de puerto
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const functionsBase = isLocal 
            ? 'http://127.0.0.1:5001/robotiax/us-central1/generateDemo' 
            : 'https://generatedemo-bh64qprvqa-uc.a.run.app';

        // Corrección de enrutamiento: Apunta siempre al molde maestro de simulación demo_salud.html y le pasa el ID del giro de catálogo
        const finalUrl = `${functionsBase}?template=demo_salud.html&id=${templateId}&originalHost=${window.location.host}`;
        
        console.log("📡 [VISOR]: Resolviendo carga dinámica en:", finalUrl);
        iframe.src = finalUrl;
        overlay.style.setProperty('display', 'flex', 'important');
        overlay.classList.add('visible');
    },

    closeDemoVisor: function() {
        const overlay = document.getElementById('demo-visor-overlay');
        const iframe = document.getElementById('demo-visor-iframe');
        if (overlay && iframe) {
            overlay.classList.remove('visible');
            overlay.style.setProperty('display', 'none', 'important');
            iframe.src = "";
        }
    },

    resizeDemoVisor: function(viewMode) {
        const container = document.getElementById('demo-visor-container');
        if (!container) return;

        if (viewMode === 'desktop') {
            container.style.width = '100%';
            container.style.height = '100%';
        } else if (viewMode === 'tablet') {
            container.style.width = '768px';
            container.style.height = '95%';
        } else if (viewMode === 'mobile') {
            container.style.width = '375px';
            container.style.height = '90%';
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
window.app.ui.openDemoVisor = window.app.ui.openDemoVisor.bind(window.app.ui);
window.app.ui.closeDemoVisor = window.app.ui.closeDemoVisor.bind(window.app.ui);
window.app.ui.resizeDemoVisor = window.app.ui.resizeDemoVisor.bind(window.app.ui);