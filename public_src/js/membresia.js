/**
 * Membresía Black - Acceso Controlado
 * Robotiax Partner Agency
 */

window.onload = function() {
    setTimeout(() => { 
        document.getElementById('body').classList.add('gate-open'); 
        
        // ELIMINACIÓN FÍSICA DE GATES PARA LIBERAR ESPACIO
        setTimeout(() => {
            const elements = document.querySelectorAll('.gate, .gate-text');
            elements.forEach(el => el.remove());
        }, 1500);
    }, 500);
};