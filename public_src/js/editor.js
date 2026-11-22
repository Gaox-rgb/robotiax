/**
 * editor.js - Maestro de Personalización
 * Gestión de previsualización, subida de imágenes y sincronización de datos.
 */

window.app = window.app || {};

window.app.editor = {
    currentTemplateId: null,

// Inyección de Animaciones Tácticas
    injectStyles: function() {
        if (document.getElementById('editor-style-fix')) return;
        const style = document.createElement('style');
        style.id = 'editor-style-fix';
        style.innerHTML = `
            #toast-container { 
                position: fixed; top: 20%; left: 50%; transform: translateX(-50%); z-index: 2000001; width: 100%; max-width: 400px; display: flex; flex-direction: column; align-items: center; pointer-events: none;
            }
            @keyframes alertPop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        `;
        document.head.appendChild(style);
    },

    // Motor de Notificaciones (Fuera de endpoints para que this.notify funcione)
    notify: function(msg, type = 'error') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast-msg ${type}`;
        toast.innerHTML = `<span style="color:${type === 'error' ? '#ff003c' : '#2ecc71'}">[!]</span> ${msg}`;
        
        // Diseño Táctico en Amarillo Oro
        const brandColor = '#FFD700'; // Amarillo Oro para alertas
        Object.assign(toast.style, {
            background: 'rgba(0, 0, 0, 0.95)',
            color: brandColor,
            border: `1px solid ${brandColor}`,
            padding: '20px 30px',
            marginBottom: '15px',
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: '0.9rem',
            fontWeight: '700',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            textAlign: 'center',
            boxShadow: `0 0 30px rgba(255, 215, 0, 0.2)`,
            zIndex: '2000000',
            pointerEvents: 'auto',
            backdropFilter: 'blur(10px)',
            animation: 'alertPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
        });

        toast.innerHTML = `
            <div style="font-size: 0.7rem; opacity: 0.6; margin-bottom: 5px;">[ PROTOCOLO DE ALERTA ]</div>
            <div>${msg}</div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = '0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    },

    endpoints: {
        generate: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
            ? 'http://127.0.0.1:5001/robotiax/us-central1/generateDemo' 
            : 'https://us-central1-robotiax.cloudfunctions.net/generateDemo',
        upload: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://127.0.0.1:5001/robotiax/us-central1/getUploadUrl'
            : 'https://us-central1-robotiax.cloudfunctions.net/getUploadUrl',
        submitOrder: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://127.0.0.1:5001/robotiax/us-central1/submitFinalOrder'
            : 'https://us-central1-robotiax.cloudfunctions.net/submitFinalOrder'
    },

    /**
     * Inicializa el panel de edición para una plantilla específica.
     */
    init: function(templateId, templateName) {
        if (!window.app.editor.validateSession()) return;
        this.currentTemplateId = templateId || 'cfg-salud-bot-promo';
        this.currentProductName = templateName || 'Suite Digital Robotiax';
        const panel = document.getElementById('editor-panel');
        if (panel) {
            panel.style.removeProperty('display');
            panel.classList.add('active');
        }
        const titleEl = document.getElementById('display-suite-title');
        if (titleEl) {
            titleEl.textContent = String(this.currentProductName).toUpperCase();
        }

        // VINCULACIÓN EN TIEMPO REAL: El nombre del negocio será el título de la página web
        const nameInput = document.getElementById('edit-name');
        if (nameInput) {
            nameInput.oninput = (evt) => {
                const val = evt.target.value.trim();
                if (val) {
                    document.title = `${val} | Portal Oficial`;
                }
            };
        }

    this.updatePayButtonLabel();
    },
    updatePayButtonLabel: function() {
        const tag = localStorage.getItem('pending_plan_tag') || 'PLAN_100';
        const labels = {
            PLAN_100: '$255.00 MXN',
            PLAN_300: '$500.00 MXN',
            PLAN_UNLIMITED: '$599.00 MXN',
            PLAN_100_ERP: '$455.00 MXN (Con ERP)',
            PLAN_300_ERP: '$800.00 MXN (Con ERP)',
            PLAN_UNLIMITED_ERP: '$1,598.00 MXN (Con ERP)'
        };
        const priceLabel = labels[tag] || '$255.00 MXN';
        const btn = document.getElementById('editor-submit-pay-btn');
        if (btn) btn.textContent = 'CONTINUAR AL PAGO (' + priceLabel + ')';
    },

    validateSession: function() {
        let userJson = localStorage.getItem('robotiax_user');
        if (!userJson) {
            // Si el usuario no ha iniciado sesión, generamos una sesión temporal basada en el correo del formulario o por defecto
            const defaultEmail = document.getElementById('edit-email')?.value.trim() || 'cliente@robotiax.shop';
            const defaultName = document.getElementById('edit-name')?.value.trim() || 'Cliente Robotiax';
            const tempUser = { name: defaultName, email: defaultEmail };
            localStorage.setItem('robotiax_user', JSON.stringify(tempUser));
            return tempUser;
        }
        return JSON.parse(userJson);
    },

    /**
     * Cierra y limpia de forma segura el panel del editor liberando el viewport por completo.
     */
    close: function() {
        const panel = document.getElementById('editor-panel');
        if (panel) {
            panel.classList.remove('active');
            panel.style.removeProperty('display');
            panel.style.removeProperty('visibility');
            panel.style.removeProperty('opacity');
            panel.style.setProperty('display', 'none', 'important');
        }
        document.body.classList.remove('editor-open');
        if (window.app.payments && window.app.payments.closeModal) {
            window.app.payments.closeModal();
        }
    },

    /**
     * Función de seguridad para obtener valores de inputs sin romper el script.
     */
    val: function(id) {
        const el = document.getElementById(id);
        return el ? el.value : "";
    },

    /**
     * Construye la URL de previsualización con todos los parámetros del formulario.
     */
    getPreviewUrl: function() {
        const tid = window.app.editor.currentTemplateId || 'medico-01';
        const params = new URLSearchParams({
            template: `${tid}-template.html`,
            name: window.app.editor.val('edit-name'),
            tagline: window.app.editor.val('edit-tagline'),
            headline: window.app.editor.val('edit-headline'),
            services: window.app.editor.val('edit-services'),
            cta: window.app.editor.val('edit-cta'),
            phone: window.app.editor.val('edit-phone'),
            email: window.app.editor.val('edit-email'),
            address: window.app.editor.val('edit-address'),
            hours: window.app.editor.val('edit-hours'),
          fee: window.app.editor.val('edit-fee'),
            badge: window.app.editor.val('edit-badge'),
            specialty: window.app.editor.val('edit-specialty'),
            imageUrl: window.app.editor.val('edit-image-url')
        });

        return `${window.app.editor.endpoints.generate}?${params.toString()}`;
    },

    /**
     * Sincronización de datos (Solo captura, sin previsualización en vivo)
     */
    preview: function() {
        console.log("Datos de orden preparados para envío técnico.");
    },

    submitOrder: async function() {
        if (!window.app.editor.validateSession()) return;

        if (!this.currentTemplateId) {
            alert("❌ ERROR CRÍTICO: No se detectó ID de producto. Reinicie el proceso.");
            return;
        }

        // CAPTURA TOTAL DE CAMPOS PARA DESARROLLO WEB CON PARÁMETROS CORREGIDOS
        const details = {
            negocio: document.getElementById('edit-name')?.value || "",
            tagline: document.getElementById('edit-slogan')?.value || document.getElementById('edit-tagline')?.value || "",
            slogan: document.getElementById('edit-slogan')?.value || "",
            headline: document.getElementById('edit-headline')?.value || "",
            badge: document.getElementById('edit-badge')?.value || "ESPECIALISTA CERTIFICADO",
            specialty: document.getElementById('edit-specialty')?.value || document.getElementById('edit-services')?.value || "Giro Comercial",
            especialidades: document.getElementById('edit-services')?.value || this.currentProductName,
            servicios: document.getElementById('edit-services')?.value || this.currentProductName,
            cta: document.getElementById('edit-cta')?.value || "Activación Directa",
            fee: document.getElementById('edit-fee')?.value || "Pagado",
            telefono: document.getElementById('edit-phone')?.value || "",
            email: document.getElementById('edit-email')?.value || "",
            direccion: document.getElementById('edit-address')?.value || document.getElementById('edit-address-fiscal')?.value || "No proporcionada",
            horarios: document.getElementById('edit-hours')?.value || "No proporcionado",
            messageCount: 0,
            messageLimit: 100,
            subscriptionActive: true,
            expiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
            isDraft: true,
            timestamp: new Date().toISOString()
        };

        const inputs = document.querySelectorAll('#editor-panel input, #editor-panel textarea');
        for (let input of inputs) {
            if (!input.value.trim()) {
                input.value = "No especificado";
            }
        }

        const folio = `ORD-STRIPE-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        details.folio = folio;
        details.orderNumber = folio;

        const activeUser = {
            name: details.negocio || 'Cliente Robotiax',
            email: details.email || 'cliente@robotiax.shop',
            phone: details.telefono || ''
        };
        localStorage.setItem('robotiax_user', JSON.stringify(activeUser));
        localStorage.setItem('pending_draft_details', JSON.stringify(details));
        localStorage.setItem('pending_draft_folio', folio);
        localStorage.setItem('pending_purchase_id', this.currentTemplateId);

        const activePlanTag = localStorage.getItem('pending_plan_tag') || 'PLAN_100';
        localStorage.setItem('pending_product_name', this.currentProductName || 'Suite Digital Robotiax');
        localStorage.setItem('pending_plan_tag', activePlanTag);

        const clientReference = folio;

        const draftPayload = JSON.stringify({
            template: this.currentTemplateId,
            details: details
        });

        try {
            const saveRes = await fetch(this.endpoints.submitOrder, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-robotiax-token': 'RBX-PRT-99-MXN-SECURE-2025'
                },
                body: draftPayload
            });
            if (!saveRes.ok) {
                console.warn("Respuesta no satisfactoria guardando borrador, activando sendBeacon.");
                if (navigator.sendBeacon) {
                    const blob = new Blob([draftPayload], { type: 'application/json' });
                    navigator.sendBeacon(this.endpoints.submitOrder, blob);
                }
            }
        } catch (e) {
            console.warn("Error enviando borrador:", e.message);
            if (navigator.sendBeacon) {
                const blob = new Blob([draftPayload], { type: 'application/json' });
                navigator.sendBeacon(this.endpoints.submitOrder, blob);
            }
        }

        const planLinksMap = {
            PLAN_100: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u',
            PLAN_300: 'https://buy.stripe.com/dRmcN6gtuc4O6Q66t94gg0v',
            PLAN_UNLIMITED: 'https://buy.stripe.com/aFa00k2CEecWfmC5p54gg0x',
            PLAN_100_ERP: 'https://buy.stripe.com/cNi5kE2CEfh0deu9Fl4gg0y',
            PLAN_300_ERP: 'https://buy.stripe.com/9B628sa56d8S4HY3gX4gg0z',
            PLAN_UNLIMITED_ERP: 'https://buy.stripe.com/cNi14o4KM1qa3DU2cT4gg0A'
        };
        const stripeBaseLink = planLinksMap[activePlanTag] || planLinksMap.PLAN_100;
        const checkoutUrl = `${stripeBaseLink}?allow_promotion_codes=true&prefilled_email=${encodeURIComponent(details.email)}&client_reference_id=${encodeURIComponent(clientReference)}`;

        this.close();

        // Redirección nativa en la misma ventana para mantener compatibilidad total de pagos locales
        window.location.href = checkoutUrl;
    },

    /**
     * Gestiona la subida de imágenes a Google Cloud Storage vía URL firmada.
     */
    handleUpload: async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const tid = window.app.editor.currentTemplateId || 'default';
        const uploadStatus = document.createElement('div');
        uploadStatus.style = "font-size:12px; color:var(--brand-color); margin-top:5px;";
        uploadStatus.textContent = "Subiendo imagen al servidor...";
        event.target.parentNode.appendChild(uploadStatus);

        try {
            // 1. Obtener URL firmada del backend
            const response = await fetch(window.app.editor.endpoints.upload, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contentType: file.type, 
                    templateId: tid 
                })
            });

            if (!response.ok) throw new Error('No se pudo autorizar la subida.');

            const { uploadUrl, publicUrl } = await response.json();

            // 2. Subir archivo directamente a Storage
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file
            });

            if (!uploadResponse.ok) throw new Error('Error al transferir el archivo al bucket.');

            // 3. Actualizar campo oculto y refrescar demo
            const urlInput = document.getElementById('edit-image-url');
            if (urlInput) urlInput.value = publicUrl;

            uploadStatus.style.color = "green";
            uploadStatus.textContent = "Imagen sincronizada con éxito.";
            
            window.app.editor.preview();

            setTimeout(() => uploadStatus.remove(), 3000);

        } catch (error) {
            console.error('Error Crítico en Upload:', error);
            uploadStatus.style.color = "red";
            uploadStatus.textContent = "Error: " + error.message;
            this.notify("FALLO EN CARGA DE IMAGEN.", "error");
        }
    }
};