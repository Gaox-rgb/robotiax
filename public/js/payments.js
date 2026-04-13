/**
 * payments.js - Versión Corregida (Context Safe)
 */
window.app.payments = {
    endpoints: {
        create: 'https://createpaypalorder-bh64qprvqa-uc.a.run.app',
        capture: 'https://capturepaypalorder-bh64qprvqa-uc.a.run.app'
    },

    openModal: function(id, name, price, currency) {
        const modal = document.getElementById('payment-modal-overlay');
        const title = document.getElementById('modal-template-name');
        
        window.app.editor.currentTemplateId = id;
        window.app.editor.currentName = name;
        window.app.editor.currentPrice = price;
        window.app.editor.currentCurrency = currency;

        if(title) title.textContent = `${name} ($${price} ${currency})`;
        if(modal) modal.style.setProperty('display', 'flex', 'important');
        
        this.initPaypalButton(id, '#modal-paypal-container');
    },

    closeModal: function() {
        const modal = document.getElementById('payment-modal-overlay');
        if (modal) modal.style.setProperty('display', 'none', 'important');
    },

    initPaypalButton: function(templateId, containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        container.innerHTML = ''; 

        console.log("🚀 Cargando pasarela para ID:", templateId);
        // BUSQUEDA DINÁMICA EN EL CATÁLOGO MAESTRO
        const allProducts = [...window.app.catalog.web, ...window.app.catalog.ia, ...window.app.catalog.security];
        const product = allProducts.find(p => p.id === templateId);

        if (!product) {
            console.error("ERROR CRÍTICO: Producto no encontrado en catálogo:", templateId);
            return;
        }

        paypal.Buttons({
            createOrder: (data, actions) => {
                return fetch(window.app.payments.endpoints.create, { 
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        productId: product.id, 
                        amount: product.price, 
                        currency: product.currency 
                    })
                })
                .then(async res => {
                    if (!res.ok) {
                        const errorText = await res.text();
                        alert("🚨 ERROR DEL ARSENAL: " + errorText);
                        throw new Error(errorText);
                    }
                    return res.json();
                })
                .then(orderData => orderData.orderID);
            },
            onApprove: (data, actions) => {
                // Usamos la ruta completa para evitar errores de contexto 'this'
                return fetch(window.app.payments.endpoints.capture, {
                    method: 'post',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        orderID: data.orderID, 
                        productId: templateId,
                        customerData: {} // Enviamos objeto vacío, los datos vendrán después
                    })
                })
                .then(res => res.json())
                .then(orderData => {
                    console.log("Respuesta de Captura exitosa para:", templateId);
                    if (orderData.status === 'success') {
                        // 1. Ocultar Modal de Pago
                        document.getElementById('payment-modal-overlay').style.setProperty('display', 'none', 'important');
                        
                        // 2. Preparar el Editor/Formulario con el ID del producto comprado
                        window.app.editor = window.app.editor || {}; 
                        window.app.editor.currentTemplateId = templateId;
                        
                        const templateName = window.app.catalog.ia.find(p => p.id === templateId)?.name || 
                                           window.app.catalog.security.find(p => p.id === templateId)?.name || "Servicio";
                        
                        // 3. Inyectar Datos Reales en el Formulario (FIX PRECIO)
                        const product = [...window.app.catalog.ia, ...window.app.catalog.security].find(p => p.id === templateId);
                        if (product) {
                            document.getElementById('display-product-name').textContent = product.name;
                            document.getElementById('display-product-price').textContent = `$${product.price} ${product.currency}`;
                        }

                        // 4. Abrir el Panel de Activación
                        const editorPanel = document.getElementById('editor-panel');
                        if(editorPanel) {
                            editorPanel.style.setProperty('display', 'block', 'important');
                            editorPanel.scrollTop = 0;
                        }
                        
                        console.log("Pago exitoso. Protocolo de Captura de Datos activado.");
                    } else {
                        throw new Error("Respuesta de servidor incompleta");
                    }
                })
                .catch(err => {
                    console.error('Error Crítico en Captura:', err);
                    alert('El pago se realizó pero hubo un error al sincronizar. Recarga la página.');
                });
            }
        }).render(containerSelector);
    },

    saveAccess: function(templateId, token) {
        localStorage.setItem(`access_${templateId}`, token);
    },

    checkAccess: function(templateId) {
        return localStorage.getItem(`access_${templateId}`) !== null;
    }
};