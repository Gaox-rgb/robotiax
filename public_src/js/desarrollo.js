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

        const finalUrl = `demo_salud.html?id=${templateId}&originalHost=${window.location.host}`;
        
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            console.log("📱 [VISOR MÓVIL]: Redirigiendo a la demo limpia en la misma ventana:", finalUrl);
            window.location.href = finalUrl;
            return;
        }

        if (!overlay || !iframe) return;

        document.body.style.overflow = 'hidden';
        console.log("📡 [VISOR IFRAME DESKTOP]: Cargando en visor modal:", finalUrl);
        iframe.src = finalUrl;
        overlay.style.setProperty('display', 'flex', 'important');
        overlay.classList.add('visible');
    },

    closeDemoVisor: function() {
        const overlay = document.getElementById('demo-visor-overlay');
        const iframe = document.getElementById('demo-visor-iframe');

        document.body.style.overflow = '';

        if (overlay) {
            overlay.classList.remove('visible');
            overlay.style.setProperty('display', 'none', 'important');
        }
        if (iframe) {
            iframe.src = "about:blank";
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