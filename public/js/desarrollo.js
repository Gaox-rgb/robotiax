/**
 * Lógica de la página de Desarrollo Web (Makumoto).
 */

// Se establece el namespace global para la aplicación
window.app = {
    selectedTemplate: {
        id: null,
        name: null
    },

    openEditor: function(templateId, templateName) {
        this.selectedTemplate.id = templateId;
        this.selectedTemplate.name = templateName;

        const accessToken = localStorage.getItem(`token_${templateId}`);

        if (accessToken) {
            console.log(`Acceso concedido para ${templateId} con token: ${accessToken}`);
            this.showSuccessAndEdit(templateId);
        } else {
            document.getElementById('modal-template-name').textContent = templateName;
            document.getElementById('payment-modal-overlay').classList.add('visible');
            this.initPaypalButton(templateId);
        }
    },

    closeModal: function() {
        document.getElementById('payment-modal-overlay').classList.remove('visible');
    },

    showSuccessAndEdit: function(templateId) {
        const editor = document.getElementById('editor-panel');
        const card = document.getElementById('card-' + templateId);

        editor.style.display = 'block';
        editor.style.opacity = '0';
        card.style.border = '2px solid var(--brand-color)';

        editor.scrollIntoView({ behavior: 'smooth' });

        setTimeout(function() {
            editor.style.transition = 'opacity 0.5s';
            editor.style.opacity = '1';
        }, 300);
    },

    initPaypalButton: function(templateId) {
        const container = document.getElementById('modal-paypal-container');
        container.innerHTML = ''; // Limpiamos el contenedor para evitar textos confusos

        setTimeout(() => {
            paypal.Buttons({
                createOrder: (data, actions) => {
                    return fetch('https://createpaypalorder-bh64qprvqa-uc.a.run.app', { method: 'post' })
                        .then(res => res.json())
                        .then(orderData => orderData.orderID);
                },
                onApprove: (data, actions) => {
                    return fetch('https://capturepaypalorder-bh64qprvqa-uc.a.run.app', {
                        method: 'post',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderID: data.orderID,
                            templateId: templateId
                        })
                    }).then(res => {
                        return res.json().then(data => {
                            if (!res.ok) {
                                const error = new Error(data.message || 'Error desconocido');
                                error.response = data;
                                throw error;
                            }
                            return data;
                        });
                    }).then(orderData => {
                        if (orderData.status === 'success' && orderData.accessToken) {
                            localStorage.setItem(`token_${templateId}`, orderData.accessToken);
                            this.closeModal();
                            this.showSuccessAndEdit(templateId);
                        } else {
                            alert(orderData.message || 'Hubo un problema al validar tu pago.');
                        }
                    }).catch(error => {
                        console.error('Error durante la aprobación del pago:', error);
                        alert(`Error en el pago: ${error.message}`);
                    });
                }
            }).render('#modal-paypal-container');
        }, 300);
    },

    previewChanges: function() {
        const iframe = document.getElementById('iframe-' + this.selectedTemplate.id);
        const templateUrl = this.getPreviewUrl();

        iframe.srcdoc = "<p style='font-family: sans-serif; text-align: center; margin-top: 50px;'>Generando previsualización...</p>";

        fetch(templateUrl)
            .then(response => {
                if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
                return response.text();
            })
            .then(html => {
                iframe.srcdoc = html;
            })
            .catch(err => {
                console.error("Error en la llamada:", err);
                iframe.srcdoc = `<p style='font-family: sans-serif; color: red; text-align: center; margin-top: 50px;'>Error al generar la demo. ${err.message}</p>`;
            });
    },

    getPreviewUrl: function() {
        const data = {
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
        };

        const baseUrl = 'https://generatedemo-bh64qprvqa-uc.a.run.app';
        const queryParams = new URLSearchParams({
            template: `${this.selectedTemplate.id}-template.html`
        });
        for (const key in data) {
            if (data[key]) {
                queryParams.append(key, data[key]);
            }
        }
        return `${baseUrl}?${queryParams.toString()}`;
    },

    openFullPreview: function() {
        const url = this.getPreviewUrl();
        window.open(url, '_blank');
    },

    handleImageUpload: async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const getUrlFunctionUrl = 'https://getuploadurl-bh64qprvqa-uc.a.run.app';
            const response = await fetch(getUrlFunctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentType: file.type, templateId: this.selectedTemplate.id })
            });

            if (!response.ok) throw new Error('No se pudo obtener la URL de carga.');
            
            const { uploadUrl, publicUrl } = await response.json();

            await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file
            });

            document.getElementById('edit-image-url').value = publicUrl;
            alert('Imagen subida con éxito. Actualizando previsualización...');
            this.previewChanges();

        } catch (error) {
            console.error('Error al subir la imagen:', error);
            alert(`Error al subir la imagen: ${error.message}`);
        }
    }
};

function scrollToTables() {
    const target = document.getElementById('tablas');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
    }
}