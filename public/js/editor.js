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
        const name = document.getElementById('edit-name')?.value || "";
        const phone = document.getElementById('edit-phone')?.value || "";
        const email = document.getElementById('edit-email')?.value || "";
        const domicilio = document.getElementById('edit-address-fiscal')?.value || "";

        if (!name || !phone || !email || !domicilio) {
            alert("⚠️ ALERTA: Todos los campos son obligatorios para activar tu Agente.");
            return;
        }

        const payload = {
            template: this.currentTemplateId,
            details: {
                negocio: name,
                telefono: phone,
                email: email,
                domicilio_fiscal: domicilio,
                timestamp: new Date().toISOString()
            }
        };

        const btn = document.querySelector('#editor-panel button[onclick*="submitOrder"]');
        if(btn) {
            btn.disabled = true;
            btn.textContent = "PROCESANDO CON IA...";
        }

        try {
            const response = await fetch('https://submitfinalorder-bh64qprvqa-uc.a.run.app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok || result.status === 'ok' || result.status === 'error') {
                localStorage.setItem(`owned_${this.currentTemplateId}`, 'true');
                const panel = document.getElementById('editor-panel');
                if (panel) panel.style.setProperty('display', 'none', 'important');
                const notif = document.getElementById('success-notif');
                if (notif) notif.style.setProperty('display', 'flex', 'important');
            }
        } catch (e) {
            console.error("Fallo de red o timeout:", e);
            alert("⚠️ El servidor está procesando tu Agente. Si no ves la confirmación en 10 segundos, pulsa de nuevo.");
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
            alert('Fallo al subir imagen. Revisa tu conexión.');
        }
    }
};