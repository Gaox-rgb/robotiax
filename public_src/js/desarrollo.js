/**
 * desarrollo.js - Controlador de Interfaz (Orquestador)
 * Coordina la UI, los Modales y los Eventos entre Payments y Editor.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Gestión del Overlay de Entrada
    window.onscroll = function() {
        const btn = window.app.ui.selectors.get('btn-up');
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

    selectors: {
        get: (id) => document.getElementById(id),
        title: () => document.getElementById('clinic-title'),
        desc: () => document.getElementById('clinic-desc'),
        fee: () => document.getElementById('meta-val-4')
    },

    closeModal: function() {
        const modal = document.getElementById('payment-modal-overlay');
        if (modal) modal.classList.remove('visible');
    },

    erpModeEnabled: false,

    switchSegment: function(segment) {
        const pymeView = document.getElementById('segment-pyme');
        const entView = document.getElementById('segment-enterprise');
        const btnPyme = document.getElementById('btn-seg-pyme');
        const btnEnt = document.getElementById('btn-seg-enterprise');

        const isEnt = segment === 'enterprise';
        if (pymeView) pymeView.style.display = isEnt ? 'none' : 'block';
        if (entView) entView.style.display = isEnt ? 'block' : 'none';

        if (btnPyme) {
            btnPyme.style.background = isEnt ? 'rgba(15,23,42,0.85)' : '#00f2ff';
            btnPyme.style.color = isEnt ? '#cbd5e1' : '#020617';
        }
        if (btnEnt) {
            btnEnt.style.background = isEnt ? '#ffd700' : 'rgba(15,23,42,0.85)';
            btnEnt.style.color = isEnt ? '#020617' : '#ffd700';
        }
    },

    toggleErpPricing: function(withErp) {
        this.erpModeEnabled = Boolean(withErp);
        const btnNo = document.getElementById('btn-erp-off');
        const btnYes = document.getElementById('btn-erp-on');
        if (btnNo) {
            btnNo.style.background = withErp ? 'transparent' : '#00f2ff';
            btnNo.style.color = withErp ? '#cbd5e1' : '#020617';
        }
        if (btnYes) {
            btnYes.style.background = withErp ? '#39ff14' : 'transparent';
            btnYes.style.color = withErp ? '#020617' : '#39ff14';
        }

        const p100Price = document.getElementById('dw-price-100');
        const p100Iva = document.getElementById('dw-iva-100');
        const p100ErpRow = document.getElementById('dw-erp-feat-100');
        const p100Btn = document.getElementById('dw-btn-100');

        const p300Price = document.getElementById('dw-price-300');
        const p300Iva = document.getElementById('dw-iva-300');
        const p300ErpRow = document.getElementById('dw-erp-feat-300');
        const p300Btn = document.getElementById('dw-btn-300');

        const pUnlPrice = document.getElementById('dw-price-unl');
        const pUnlIva = document.getElementById('dw-iva-unl');
        const pUnlErpRow = document.getElementById('dw-erp-feat-unl');
        const pUnlBtn = document.getElementById('dw-btn-unl');

        if (withErp) {
            if (p100Price) p100Price.innerHTML = '$455.00 <span style="font-size: 0.78rem; color: #94a3b8;">MXN/mes</span>';
            if (p100Iva) p100Iva.textContent = 'Subtotal: $392.24 + IVA (16%): $62.76 MXN (Incluye ERP +$200)';
            if (p100ErpRow) p100ErpRow.style.display = 'block';
            if (p100Btn) p100Btn.textContent = 'ELEGIR BÁSICO + ERP ($455 MXN)';

            if (p300Price) p300Price.innerHTML = '$800.00 <span style="font-size: 0.78rem; color: #94a3b8;">MXN/mes</span>';
            if (p300Iva) p300Iva.textContent = 'Subtotal: $689.66 + IVA (16%): $110.34 MXN (Incluye ERP +$300)';
            if (p300ErpRow) p300ErpRow.style.display = 'block';
            if (p300Btn) p300Btn.textContent = 'ELEGIR 300 + ERP ($800 MXN)';

            if (pUnlPrice) pUnlPrice.innerHTML = '$1,598.00 <span style="font-size: 0.78rem; color: #cbd5e1;">MXN/mes</span>';
            if (pUnlIva) pUnlIva.textContent = 'Subtotal: $1,377.59 + IVA (16%): $220.41 MXN (Incluye ERP +$999)';
            if (pUnlErpRow) pUnlErpRow.style.display = 'block';
            if (pUnlBtn) pUnlBtn.textContent = 'ELEGIR ILIMITADO + ERP ($1,598 MXN) ➔';
        } else {
            if (p100Price) p100Price.innerHTML = '$255.00 <span style="font-size: 0.78rem; color: #94a3b8;">MXN/mes</span>';
            if (p100Iva) p100Iva.textContent = 'Subtotal: $219.83 + IVA (16%): $35.17 MXN';
            if (p100ErpRow) p100ErpRow.style.display = 'none';
            if (p100Btn) p100Btn.textContent = 'ELEGIR PLAN BÁSICO ($255 MXN)';

            if (p300Price) p300Price.innerHTML = '$500.00 <span style="font-size: 0.78rem; color: #94a3b8;">MXN/mes</span>';
            if (p300Iva) p300Iva.textContent = 'Subtotal: $431.03 + IVA (16%): $68.97 MXN';
            if (p300ErpRow) p300ErpRow.style.display = 'none';
            if (p300Btn) p300Btn.textContent = 'ELEGIR PLAN 300 ($500 MXN)';

            if (pUnlPrice) pUnlPrice.innerHTML = '$599.00 <span style="font-size: 0.78rem; color: #cbd5e1;">MXN/mes</span>';
            if (pUnlIva) pUnlIva.textContent = 'Subtotal: $516.38 + IVA (16%): $82.62 MXN';
            if (pUnlErpRow) pUnlErpRow.style.display = 'none';
            if (pUnlBtn) pUnlBtn.textContent = 'ELEGIR PLAN ILIMITADO ($599 MXN) ➔';
        }
    },

    selectPlan: function(baseTag) {
        const validTags = ['PLAN_100', 'PLAN_300', 'PLAN_UNLIMITED', 'PLAN_100_ERP', 'PLAN_300_ERP', 'PLAN_UNLIMITED_ERP'];
        const finalTag = validTags.includes(baseTag) ? baseTag : 'PLAN_100';
        localStorage.setItem('pending_plan_tag', finalTag);

        document.querySelectorAll('.rx-dw-plan-card').forEach(card => {
            card.classList.remove('rx-dw-selected');
        });
        const selectedCard = document.getElementById('dw-card-' + finalTag);
        if (selectedCard) selectedCard.classList.add('rx-dw-selected');

        const badgeEl = document.getElementById('dw-selected-plan-banner');
        const names = {
            PLAN_100: 'Plan Básico (100 Mensajes — $255.00 MXN IVA incl.)',
            PLAN_300: 'Plan Crecimiento (300 Mensajes — $500.00 MXN IVA incl.)',
            PLAN_UNLIMITED: 'Plan Élite Ilimitado (Mensajes Ilimitados — $599.00 MXN IVA incl.)',
            PLAN_100_ERP: 'Plan Básico + ERP PyME (100 Mensajes — $455.00 MXN IVA incl.)',
            PLAN_300_ERP: 'Plan Crecimiento + ERP PyME (300 Mensajes — $800.00 MXN IVA incl.)',
            PLAN_UNLIMITED_ERP: 'Plan Élite Ilimitado + ERP (Mensajes Ilimitados — $1,598.00 MXN IVA incl.)'
        };
        if (badgeEl) {
            badgeEl.textContent = '✓ Plan seleccionado: ' + names[finalTag] + ' — Ahora elige tu plantilla abajo:';
            badgeEl.style.display = 'block';
        }
        const tables = document.getElementById('tablas');
        if (tables) tables.scrollIntoView({ behavior: 'smooth' });
    },

    togglePymeDiagnosisForm: function() {
        const formDiv = document.getElementById('form-pyme-diagnosis');
        if (formDiv) {
            formDiv.style.display = formDiv.style.display === 'none' ? 'block' : 'none';
            if (formDiv.style.display === 'block') {
                formDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    },

    toggleLegalAdvisorForm: function() {
        const formDiv = document.getElementById('form-legal-advisor');
        if (formDiv) {
            formDiv.style.display = formDiv.style.display === 'none' ? 'block' : 'none';
            if (formDiv.style.display === 'block') {
                formDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    },

    submitPymeDiagnosis: async function(e) {
        if (e) e.preventDefault();
        const biz = (document.getElementById('pyme-diag-biz')?.value || '').trim();
        const staff = (document.getElementById('pyme-diag-staff')?.value || '').trim();
        const name = (document.getElementById('pyme-diag-name')?.value || '').trim();
        const role = (document.getElementById('pyme-diag-role')?.value || '').trim();
        const phone = (document.getElementById('pyme-diag-phone')?.value || '').trim();
        const email = (document.getElementById('pyme-diag-email')?.value || '').trim();
        const pain = (document.getElementById('pyme-diag-pain')?.value || '').trim();
        const statusEl = document.getElementById('pyme-diag-status');

        if (!biz || !phone || !email || !pain) {
            alert('Por favor completa todos los campos requeridos.');
            return;
        }

        if (statusEl) {
            statusEl.textContent = 'Enviando diagnóstico a ingeniería...';
            statusEl.style.color = '#00f2ff';
            statusEl.style.display = 'block';
        }

        const endpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://127.0.0.1:5001/robotiax/us-central1/submitFinalOrder'
            : 'https://us-central1-robotiax.cloudfunctions.net/submitFinalOrder';

        const folio = 'DIAG-PYME-' + Date.now().toString().slice(-6);
        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-robotiax-token': 'RBX-PRT-99-MXN-SECURE-2025' },
                body: JSON.stringify({
                    template: 'lead-diagnostico-pyme',
                    details: {
                        folio: folio,
                        negocio: biz,
                        staffCount: staff,
                        contactName: name,
                        role: role,
                        telefono: phone,
                        email: email,
                        servicios: pain,
                        fee: 'Diagnóstico Automatización y Ventas',
                        isDraft: true,
                        leadType: 'pyme_automation_pain',
                        timestamp: new Date().toISOString()
                    }
                })
            });
            if (statusEl) {
                statusEl.textContent = '✓ Diagnóstico recibido (' + folio + '). Nuestro equipo analizará tu caso y te responderá con una propuesta en un plazo de 24 a 72 horas hábiles.';
                statusEl.style.color = '#4ade80';
            }
            e.target.reset();
        } catch (err) {
            if (statusEl) {
                statusEl.textContent = 'Error enviando diagnóstico. Escríbenos a contacto@robotiax.shop.';
                statusEl.style.color = '#fda4af';
            }
        }
    },

    submitLegalAdvisorRequest: async function(e) {
        if (e) e.preventDefault();
        const name = (document.getElementById('legal-req-name')?.value || '').trim();
        const biz = (document.getElementById('legal-req-biz')?.value || '').trim();
        const matter = (document.getElementById('legal-req-matter')?.value || '').trim();
        const phone = (document.getElementById('legal-req-phone')?.value || '').trim();
        const email = (document.getElementById('legal-req-email')?.value || '').trim();
        const budget = (document.getElementById('legal-req-budget')?.value || '').trim();
        const details = (document.getElementById('legal-req-details')?.value || '').trim();
        const statusEl = document.getElementById('legal-req-status');

        if (!name || !phone || !email || !details) {
            alert('Por favor completa los datos obligatorios de tu solicitud.');
            return;
        }

        if (statusEl) {
            statusEl.textContent = 'Conectando con la red de aliados...';
            statusEl.style.color = '#ffd700';
            statusEl.style.display = 'block';
        }

        const endpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://127.0.0.1:5001/robotiax/us-central1/submitFinalOrder'
            : 'https://us-central1-robotiax.cloudfunctions.net/submitFinalOrder';

        const folio = 'LEGAL-' + matter.split('_')[0] + '-' + Date.now().toString().slice(-6);
        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-robotiax-token': 'RBX-PRT-99-MXN-SECURE-2025' },
                body: JSON.stringify({
                    template: 'lead-red-legal-fiscal',
                    details: {
                        folio: folio,
                        negocio: biz || name,
                        contactName: name,
                        legalMatter: matter,
                        telefono: phone,
                        email: email,
                        servicios: details,
                        fee: budget,
                        isDraft: true,
                        leadType: 'legal_fiscal_network',
                        timestamp: new Date().toISOString()
                    }
                })
            });
            if (statusEl) {
                statusEl.textContent = '✓ Solicitud canalizada (' + folio + '). Un profesionista afín a tu presupuesto te contactará en un plazo de 24 a 72 horas hábiles.';
                statusEl.style.color = '#4ade80';
            }
            e.target.reset();
        } catch (err) {
            if (statusEl) {
                statusEl.textContent = 'Error enviando solicitud. Escríbenos a contacto@robotiax.shop.';
                statusEl.style.color = '#fda4af';
            }
        }
    },

    submitB2BLead: async function(e, leadType) {
        if (e) e.preventDefault();
        const biz = (document.getElementById('ent-company')?.value || '').trim();
        const phone = (document.getElementById('ent-phone')?.value || '').trim();
        const email = (document.getElementById('ent-email')?.value || '').trim();
        const need = (document.getElementById('ent-need')?.value || '').trim();
        const budget = (document.getElementById('ent-budget')?.value || '').trim();
        const statusEl = document.getElementById('ent-status');

        if (!biz || !phone || !email) {
            alert('Por favor completa empresa, WhatsApp y correo.');
            return;
        }

        if (statusEl) {
            statusEl.textContent = 'Enviando solicitud de estudio corporativo...';
            statusEl.style.color = '#ffd700';
            statusEl.style.display = 'block';
        }

        const endpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://127.0.0.1:5001/robotiax/us-central1/submitFinalOrder'
            : 'https://us-central1-robotiax.cloudfunctions.net/submitFinalOrder';

        const folio = 'CORP-ESTUDIO-' + Date.now().toString().slice(-6);
        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-robotiax-token': 'RBX-PRT-99-MXN-SECURE-2025' },
                body: JSON.stringify({
                    template: 'lead-gran-empresa',
                    details: {
                        folio: folio,
                        negocio: biz,
                        telefono: phone,
                        email: email,
                        servicios: need,
                        fee: budget || 'Previo Estudio',
                        isDraft: true,
                        leadType: 'enterprise_evaluation',
                        timestamp: new Date().toISOString()
                    }
                })
            });
            if (statusEl) {
                statusEl.textContent = '✓ Solicitud corporativa registrada (' + folio + '). Nuestro equipo de arquitectura te presentará propuesta técnica en menos de 24h hábiles.';
                statusEl.style.color = '#4ade80';
            }
            e.target.reset();
        } catch (err) {
            if (statusEl) {
                statusEl.textContent = 'Error enviando solicitud. Escríbenos a contacto@robotiax.shop.';
                statusEl.style.color = '#fda4af';
            }
        }
    },

    requestPurchase: function(templateId, templateName) {
        console.log("Abriendo panel de personalización para:", templateId);
        this.selectedTemplate.id = templateId;

        let resolvedTitle = templateName;
        const btn = document.querySelector(`button[onclick*="'${templateId}'"]`);
        if (btn) {
            const card = btn.closest('.glow-card-cyber');
            const h4 = card ? card.querySelector('h4') : null;
            if (h4 && h4.textContent.trim()) {
                resolvedTitle = h4.textContent.trim();
            }
        }

        this.selectedTemplate.name = resolvedTitle;
        const titleEl = document.getElementById('display-suite-title');
        if (titleEl && resolvedTitle) {
            titleEl.textContent = resolvedTitle.toUpperCase();
        }

        if (window.app.editor && typeof window.app.editor.init === 'function') {
            window.app.editor.init(templateId, resolvedTitle);
        } else if (window.app.payments) {
            window.app.payments.openModal(templateId, resolvedTitle, 200, 'MXN');
        }
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