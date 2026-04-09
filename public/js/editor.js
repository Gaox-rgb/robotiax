/**
 * editor.js - Maestro de Personalización
 * Gestiona la previsualización y subida de archivos.
 */

window.app = window.app || {};

window.app.editor = {
    currentTemplateId: null,
    endpoints: {
        generate: 'https://generatedemo-bh64qprvqa-uc.a.run.app',
        upload: 'https://getuploadurl-bh64qprvqa-uc.a.run.app'
    },

    init: function(templateId) {
        this.currentTemplateId = templateId;
        const panel = document.getElementById('editor-panel');
        if (panel) {
            panel.style.display = 'block';
            panel.scrollIntoView({ behavior: 'smooth' });
        }
    },

    preview: function() {
        const iframe = document.getElementById('iframe-' + this.currentTemplateId);
        if (!iframe) return;

        iframe.srcdoc = "<p style='text-align:center; padding-top:50px;'>Generando previsualización técnica...</p>";

        const params = new URLSearchParams({
            template: `${this.currentTemplateId}-template.html`,
            name: document.getElementById('edit-name').value,
            tagline: document.getElementById('edit-tagline').value,
            headline: document.getElementById('edit-headline').value,
            cta: document.getElementById('edit-cta').value,
            phone: document.getElementById('edit-phone').value,
            email: document.getElementById('edit-email').value,
            address: document.getElementById('edit-address').value,
            hours: document.getElementById('edit-hours').value,
            fee: document.getElementById('edit-fee').value,
            imageUrl: document.getElementById('edit-image-url').value
        });

        fetch(`${this.endpoints.generate}?${params.toString()}`)
            .then(res => res.text())
            .then(html => { iframe.srcdoc = html; })
            .catch(err => {
                console.error("Error Demo:", err);
                iframe.srcdoc = "<p style='color:red;'>Error al conectar con el motor de renderizado.</p>";
            });
    },

    handleUpload: async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const response = await fetch(this.endpoints.upload, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentType: file.type, templateId: this.currentTemplateId })
            });

            const { uploadUrl, publicUrl } = await response.json();

            await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file
            });

            document.getElementById('edit-image-url').value = publicUrl;
            this.preview(); // Actualizar automáticamente al subir
        } catch (error) {
            console.error('Error Upload:', error);
            alert('Fallo al subir imagen al servidor.');
        }
    }
};