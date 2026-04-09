/**
 * Makumoto App Core
 * Inicializa el namespace global y la configuración central.
 */
window.app = {
    // Almacena información sobre el ítem seleccionado (Super-App, Template, etc.)
    selectedItem: {
        id: null,
        name: null,
        price: null,
        currency: null
    },

    // Estado de la aplicación
    state: {
        isModalOpen: false,
    },

    // Punto de entrada principal llamado desde el HTML
    init: function() {
        console.log("Robotiax Core Online. Iniciando subsistemas...");
        app.ui.init();
        app.events.init();
        console.log("Todos los sistemas listos. Esperando directivas del usuario.");
    }
};

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', window.app.init);