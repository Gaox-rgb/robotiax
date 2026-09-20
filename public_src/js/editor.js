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
            : 'https://generatedemo-bh64qprvqa-uc.a.run.app',
        upload: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://127.0.0.1:5001/robotiax/us-central1/getUploadUrl'
            : 'https://getuploadurl-bh64qprvqa-uc.a.run.app',
        submitOrder: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://127.0.0.1:5001/robotiax/us-central1/submitFinalOrder'
            : 'https://submitfinalorder-bh64qprvqa-uc.a.run.app'
    },

    /**
     * Inicializa el panel de edición para una plantilla específica.
     */
    init: function(templateId) {
        this.currentTemplateId = templateId;
        
        const product = window.app.catalog.ia.find(p => p.id === templateId) || 
                        window.app.catalog.security.find(p => p.id === templateId) ||
                        window.app.catalog.web.find(p => p.id === templateId);

        if(product) {
            const nameEl = document.getElementById('display-product-name');
            const priceEl = document.getElementById('display-product-price');
            if(nameEl) nameEl.textContent = product.name;
            if(priceEl) priceEl.textContent = `$${product.price} ${product.currency}`;
            
            // Guardamos la categoría para el submitOrder
            this.currentCategory = product.category;
            this.currentProductName = product.name;
        }

        const panel = document.getElementById('editor-panel');
        if (panel) {
            panel.style.setProperty('display', 'block', 'important');
            panel.style.visibility = 'visible';
            panel.style.opacity = '1';
            panel.classList.add('active');
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            window.app.editor.preview();
        }
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
            badge: document.getElementById('edit-badge')?.value || "Especialista Certificado",
            specialty: document.getElementById('edit-specialty')?.value || "Giro Comercial",
            especialidades: document.getElementById('edit-services')?.value || this.currentProductName,
            servicios: document.getElementById('edit-services')?.value || this.currentProductName,
            cta: document.getElementById('edit-cta')?.value || "Activación Directa",
            fee: document.getElementById('edit-fee')?.value || "Pagado",
            telefono: document.getElementById('edit-phone')?.value || "",
            email: document.getElementById('edit-email')?.value || "",
            direccion: document.getElementById('edit-address')?.value || document.getElementById('edit-address-fiscal')?.value || "No proporcionada",
            horarios: document.getElementById('edit-hours')?.value || "No proporcionado",
            isDraft: true,
            timestamp: new Date().toISOString()
        };

        const inputs = document.querySelectorAll('#editor-panel input, #editor-panel textarea');
        for (let input of inputs) {
            if (!input.value.trim()) {
                this.notify("CAMPOS INCOMPLETOS. Si no deseas incluir algún dato, escribe 'NO' en ese campo y será omitido automáticamente de tu web.", "error");
                input.style.borderColor = "#ff003c";
                input.focus();
                return;
            }
        }

        const folio = `ORD-STRIPE-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        details.folio = folio;
        details.orderNumber = folio;

        const activeUser = {
            name: details.negocio,
            email: details.email,
            phone: details.telefono
        };
        localStorage.setItem('robotiax_user', JSON.stringify(activeUser));
        localStorage.setItem('pending_draft_details', JSON.stringify(details));
        localStorage.setItem('pending_draft_folio', folio);
        localStorage.setItem('pending_purchase_id', this.currentTemplateId);

        const clientReference = `${folio}__${encodeURIComponent(details.email)}__${encodeURIComponent(details.negocio)}`;

        const draftPayload = JSON.stringify({
            template: this.currentTemplateId,
            details: details
        });

        // ESPERA SÍNCRONA GARANTIZADA: Se graba la Razón Social en Firestore antes de abrir Stripe
        try {
            await fetch(this.endpoints.submitOrder, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-robotiax-token': 'RBX-PRT-99-MXN-SECURE-2025'
                },
                body: draftPayload
            });
        } catch (e) {
            console.warn("Respaldo por sendBeacon activado:", e.message);
            if (navigator.sendBeacon) {
                const blob = new Blob([draftPayload], { type: 'application/json' });
                navigator.sendBeacon(this.endpoints.submitOrder, blob);
            }
        }

        // ENLACE DIRECTO A STRIPE CON TRIPLE PARÁMETRO EMBEBIDO
        const stripeBaseLink = 'https://buy.stripe.com/3cIcN6dhi9WG0rIdVB4gg0f';
        const checkoutUrl = `${stripeBaseLink}?allow_promotion_codes=true&prefilled_email=${encodeURIComponent(details.email)}&client_reference_id=${encodeURIComponent(clientReference)}`;

        // Apertura en pestaña nueva para conservar la ventana de control con X, Impresión y Volver en Robotiax
        const stripeTab = window.open(checkoutUrl, '_blank');

        if (!stripeTab || stripeTab.closed || typeof stripeTab.closed === 'undefined') {
            // Si el navegador bloqueó la ventana emergente, redirige en la misma pestaña
            window.location.href = checkoutUrl;
        } else {
            // En la pestaña de Robotiax, cerramos el formulario y activamos el modal con X, Impresión y Volver
            this.close();
            const oxxoModal = document.getElementById('oxxo-pending-modal');
            if (oxxoModal) {
                oxxoModal.style.display = 'flex';
            } else {
                window.location.href = 'desarrollo-web.html?status=pending_oxxo';
            }
        }
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