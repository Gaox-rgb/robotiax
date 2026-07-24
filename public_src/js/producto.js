window.app = window.app || {};

window.app.productPage = {
    currentProduct: null,

    // Mapeo dinámico de iconos temáticos por giro
    icons: {
        salud: "🩺", legal: "⚖️", contable: "📊", gym: "🏋️", boutique: "🛍️",
        ferreteria: "🔧", gourmet: "🥩", abarrotes: "🛒", cafeteria: "☕",
        floreria: "🌸", talleres: "🚗", eventos: "🏰", idiomas: "🏫",
        fumigacion: "🐜", limpieza: "🧼", viajes: "✈️", prospeccion: "🎯",
        webs: "🌐", rh: "👥", instagram: "📸", facebook: "👥", youtube: "🎥",
        twitter: "🐦", ciber: "🛡️"
    },

    init: function() {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get('id');

        if (!productId) {
            console.warn("No se especificó ID de producto. Redirigiendo al catálogo...");
            window.location.href = 'top10.html';
            return;
        }

        // Buscar el producto de forma unificada en todo el catálogo
        let product = null;
        if (window.app.catalog) {
            // 1. Buscar en configurador directo
            if (window.app.catalog.configurator && window.app.catalog.configurator[productId]) {
                product = window.app.catalog.configurator[productId];
            }
            // 2. Buscar en el array de Inteligencia Artificial (IA)
            if (!product && window.app.catalog.ia) {
                product = window.app.catalog.ia.find(p => p.id === productId);
            }
            // 3. Buscar en el array de Seguridad (Protocolo Fortaleza)
            if (!product && window.app.catalog.security) {
                product = window.app.catalog.security.find(p => p.id === productId);
            }
            // 4. Buscar en el array de Plantillas Web
            if (!product && window.app.catalog.web) {
                product = window.app.catalog.web.find(p => p.id === productId);
            }
        }

        if (!product) {
            console.error("ID de producto no reconocido en ninguna categoría de catalog.js.");
            alert("El protocolo solicitado no existe o se encuentra inactivo.");
            window.location.href = 'top10.html';
            return;
        }

        this.currentProduct = product;
        this.render(productId, product);
    },

    render: function(id, product) {
        // 1. Extraer tipo de asistencia y giro desde el ID
        const isAgent = id.endsWith('-agente') || id.endsWith('-agent');
        const parts = id.split('-');
        const giro = parts[1] || 'salud';

        // 2. Elementos DOM
        document.title = `${product.name} | ROBOTIAX®`;
        
        const catEl = document.getElementById('display-category');
        const titleEl = document.getElementById('display-title');
        const headQueEsEl = document.getElementById('heading-que-es');
        const queEsEl = document.getElementById('display-que-es');
        const beneficiosEl = document.getElementById('display-beneficios');
        const proyeccionEl = document.getElementById('display-proyeccion');
        const instalacionEl = document.getElementById('display-instalacion');
        const priceEl = document.getElementById('display-price');
        const recEl = document.getElementById('display-recurring');
        const iconEl = document.getElementById('display-icon');
        const badgeEl = document.getElementById('display-tech-badge');

        // 3. Inyección dinámica
        if (catEl) catEl.textContent = isAgent ? "AGENTE INTELIGENCIA ARTIFICIAL" : "BOT DE FLUJO CONTROLADO";
        if (titleEl) titleEl.textContent = product.name;
        
        // Dinamismo del Encabezado con el Nombre de la App
        if (headQueEsEl) {
            headQueEsEl.textContent = `⚙️ ¿Qué es ${product.name}?`;
        }

        // Motor de Redacción Dinámica para las 4 Premisas
        if (queEsEl) {
            queEsEl.textContent = `${product.desc} Se trata de una solución digital inteligente parametrizada a la medida de tu negocio para operar directamente en tu canal de WhatsApp oficial, eliminando por completo la carga de trabajo manual repetitivo.`;
        }

        if (beneficiosEl) {
            beneficiosEl.textContent = isAgent 
                ? "Comprensión del lenguaje natural de tus clientes, autonomía completa para resolver objeciones de venta, disponibilidad ininterrumpida 24 horas al día y eliminación del abandono de prospectos por demora en responder."
                : "Navegación veloz mediante botones interactivos estructurados, captura impecable de datos de prospectos exportables a Google Sheets en tiempo real y transferencia ágil de casos críticos a asesores de carne y hueso.";
        }

        if (proyeccionEl) {
            proyeccionEl.textContent = isAgent
                ? "Preparado para su integración futura con bases de conocimientos complejas corporativas (RAG), vinculación directa con el CRM que ya uses y capacidad de expansión multicanal hacia Instagram Direct y Messenger."
                : "Escalabilidad nativa hacia integraciones con sistemas de cobro, inventarios físicos (ERP) y una transición sumamente sencilla hacia un agente cognitivo de Inteligencia Artificial cuando tu flujo comercial madure.";
        }

        if (instalacionEl) {
            instalacionEl.textContent = "1. Realizas el pago seguro con tu cuenta de PayPal o Tarjeta bancaria. 2. Se abrirá automáticamente un formulario para ingresar tus accesos y datos oficiales de marca. 3. Nuestra ingeniería realiza la conexión de servidores en un plazo garantizado menor a 24 horas.";
        }
        
        if (priceEl) {
            priceEl.innerHTML = `$${product.price.toLocaleString('es-MX')} <span class="price-currency">MXN</span>`;
        }

        if (recEl) {
            const rent = isAgent ? '499' : '299';
            recEl.textContent = `+ $${rent} MXN de mantenimiento mensual`;
        }

        if (badgeEl) {
            badgeEl.textContent = isAgent ? "Nivel de Mando IA" : "Nivel Operativo Bot";
        }

        // Asignación de icono según mapeo
        if (iconEl) {
            iconEl.textContent = this.icons[giro] || "⚙️";
        }
    },

    buy: function() {
        if (this.currentProduct && window.app.payments) {
            console.log("Iniciando compra para:", this.currentProduct.id);
            window.app.payments.openModal(
                this.currentProduct.id, 
                this.currentProduct.name, 
                this.currentProduct.price, 
                this.currentProduct.currency
            );
        } else {
            alert("Error temporal con el motor de pagos. Por favor, recarga.");
        }
    }
};

// Autoejecución al cargar el DOM de la página
document.addEventListener('DOMContentLoaded', () => {
    window.app.productPage.init();
});