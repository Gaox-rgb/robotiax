/**
 * editor.js - Maestro de Personalización
 * Gestión de previsualización, subida de imágenes y sincronización de datos.
 */

window.app = window.app || {};

window.app.editor = {
    currentTemplateId: null,

    endpoints: {
        generate: 'https://generatedemo-bh64qprvqa-uc.a.run.app',
        upload: 'https://getuploadurl-bh64qprvqa-uc.a.run.app'
    },

    /**
     * Inicializa el panel de edición para una plantilla específica.
     */
    init: function(templateId) {
        this.currentTemplateId = templateId;
        if (window.app.ui && window.app.ui.selectedTemplate) {
            window.app.ui.selectedTemplate.id = templateId;
        }
        console.log("Editor inicializado para:", templateId);

        const panel = document.getElementById('editor-panel');
        
        if (panel) {
            panel.style.display = 'block';
            panel.classList.add('active');
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Carga inicial de datos
            window.app.editor.preview();
        } else {
            console.error("Error Crítico: No se encontró el contenedor #editor-panel");
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
        // 1. LISTA DE CAMPOS A VALIDAR
        const requiredFields = [
            { id: 'edit-name', label: 'Nombre del Negocio' },
            { id: 'edit-tagline', label: 'Eslogan' },
            { id: 'edit-headline', label: 'Encabezado Principal' },
            { id: 'edit-services', label: 'Servicios' },
            { id: 'edit-cta', label: 'Texto del Botón' },
            { id: 'edit-fee', label: 'Costo de Consulta' },
            { id: 'edit-phone', label: 'WhatsApp de Contacto' },
            { id: 'edit-email', label: 'Email de Respaldo' },
            { id: 'edit-address', label: 'Dirección Física' },
            { id: 'edit-hours', label: 'Horarios' }
        ];

        // 2. CICLO DE VALIDACIÓN OBLIGATORIA
        for (let field of requiredFields) {
            const input = document.getElementById(field.id);
            if (!input || !input.value.trim()) {
                const errorBox = document.getElementById('form-error-msg');
                if (errorBox) {
                    errorBox.textContent = `[ ALERTA: ${field.label} VACÍO ] - Escribe "NO" si prefieres omitir.`;
                    errorBox.style.display = 'block';
                    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                input?.focus();
                return; 
            }
        }
        // Limpiar error si todo está bien
        document.getElementById('form-error-msg').style.display = 'none';

        const data = {
            emailDestino: 'geniosdeltalento@gmail.com',
            template: this.currentTemplateId,
            details: {
                negocio: document.getElementById('edit-name')?.value || '',
                eslogan: document.getElementById('edit-tagline')?.value || '',
                headline: document.getElementById('edit-headline')?.value || '',
                servicios: document.getElementById('edit-services')?.value || '',
                cta: document.getElementById('edit-cta')?.value || '',
                costo: document.getElementById('edit-fee')?.value || '',
                telefono: document.getElementById('edit-phone')?.value || '',
                email: document.getElementById('edit-email')?.value || '',
                direccion: document.getElementById('edit-address')?.value || '',
                horarios: document.getElementById('edit-hours')?.value || ''
            }
        };

        try {
            // Llamada a la función de Firebase para guardar y avisar
            const response = await fetch('https://submitfinalorder-bh64qprvqa-uc.a.run.app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                console.log("Servidor confirmó recepción. Disparando protocolos de email...");
                
                // 1. Persistencia local de la compra
                const purchased = JSON.parse(localStorage.getItem('makumoto_owned') || '[]');
                if (!purchased.includes(this.currentTemplateId)) {
                    purchased.push(this.currentTemplateId);
                    localStorage.setItem('makumoto_owned', JSON.stringify(purchased));
                }

                // 2. Scroll al inicio
                const panel = document.getElementById('editor-panel');
                if (panel) panel.scrollTop = 0;

                // 3. Datos dinámicos en la notificación
                const templateName = window.app.ui?.selectedTemplate?.name || 'Plantilla Profesional';
                const nameDisplay = document.getElementById('notif-template-name');
                if (nameDisplay) nameDisplay.textContent = templateName;

                // 4. Mostrar consola de éxito
                const notif = document.getElementById('success-notif');
                if (notif) notif.style.display = 'flex';
            }
        } catch (e) {
            console.error("Error en envío:", e);
            alert("Error al enviar. Intenta de nuevo.");
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
            alert('Fallo al subir imagen. Revisa tu conexión.');
        }
    }
};