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
                position: fixed; 
                top: 20%; 
                left: 50%; 
                transform: translateX(-50%); 
                z-index: 2000001; 
                width: 100%; 
                max-width: 400px; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                pointer-events: none;
            }
            @keyframes alertPop { 
                from { transform: scale(0.9); opacity: 0; } 
                to { transform: scale(1); opacity: 1; } 
            }
        `;
        document.head.appendChild(style);
    },
    currentTemplateId: null,

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
        generate: 'https://generatedemo-bh64qprvqa-uc.a.run.app',
        upload: 'https://getuploadurl-bh64qprvqa-uc.a.run.app'
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

        // CAPTURA TOTAL DE CAMPOS PARA DESARROLLO WEB
        const details = {
            negocio: document.getElementById('edit-name')?.value || "",
            tagline: document.getElementById('edit-tagline')?.value || "",
            headline: document.getElementById('edit-headline')?.value || "",
            servicios: document.getElementById('edit-services')?.value || this.currentProductName,
            cta: document.getElementById('edit-cta')?.value || "Activación Directa",
            fee: document.getElementById('edit-fee')?.value || "Pagado",
            telefono: document.getElementById('edit-phone')?.value || "",
            email: document.getElementById('edit-email')?.value || "",
            direccion: document.getElementById('edit-address')?.value || document.getElementById('edit-address-fiscal')?.value || "No proporcionada",
            horarios: document.getElementById('edit-hours')?.value || "No proporcionado",
            timestamp: new Date().toISOString()
        };

        const inputs = document.querySelectorAll('#editor-panel input, #editor-panel textarea');
        for (let input of inputs) {
            if (!input.value.trim()) {
                this.notify("CAMPOS INCOMPLETOS. REVISE EL FORMULARIO.", "error");
                input.style.borderColor = "#ff003c";
                input.focus();
                return;
            }
        }

        const btn = document.querySelector('#editor-panel button[onclick*="submitOrder"]');
        if(btn) {
            btn.disabled = true;
            btn.textContent = "REGISTRANDO PEDIDO...";
        }

        try {
            const response = await fetch('https://submitfinalorder-bh64qprvqa-uc.a.run.app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template: this.currentTemplateId, details })
            });

            if (response.ok) {
                // SINCRONIZACIÓN CON GALERÍA: Guardar en makumoto_owned
                const purchased = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
                if (!purchased.includes(this.currentTemplateId)) {
                    purchased.push(this.currentTemplateId);
                    localStorage.setItem('makumoto_owned', JSON.stringify(purchased));
                }
                
                // Ocultar formulario y mostrar ventana de éxito final
                document.getElementById('editor-panel').style.setProperty('display', 'none', 'important');
                const notif = document.getElementById('success-notif');
                if (notif) {
                    console.log("✅ [EDITOR]: Orden completada. Mostrando éxito.");
                    notif.style.setProperty('display', 'flex', 'important');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    
                    const okBtn = notif.querySelector('button') || notif.querySelector('.action-button');
                    if(okBtn) {
                        okBtn.onclick = () => {
                            localStorage.removeItem('pending_purchase_id');
                            location.reload();
                        };
                    }
                }
            }

        } catch (e) {
            console.error("Fallo de red o timeout:", e);
            this.notify("ERROR DE CONEXIÓN. REINTENTANDO...", "error");
            if(btn) {
                btn.disabled = false;
                btn.textContent = "REINTENTAR ACTIVACIÓN";
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