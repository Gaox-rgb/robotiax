/**
 * Lógica de Modales y Navegación para Desarrollo Web
 * Basado en
 */

// Abrir un modal específico
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Cerrar un modal específico
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Cerrar modal al hacer clic fuera del contenido (en el overlay)
window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.style.display = 'none';
    }
}

// Scroll suave hacia la sección de tablas de precios
function scrollToTables() {
    const target = document.getElementById('tablas');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
    }
}