/**
 * Lógica del Sistema de Diagnóstico Triage
 * Robotiax v.4.0
 */

// Cambiar entre preguntas
function nextStep(step) {
    document.querySelectorAll('.question-box').forEach(el => el.classList.remove('active'));
    document.getElementById('step' + step).classList.add('active');
}

function showProtocolStatus(message, isSuccess = true) {
    const notify = document.createElement('div');
    notify.style = `position:fixed; bottom:20px; left:20px; background:black; color:#0f0; padding:15px; font-family:'Fira Code',monospace; z-index:10000; border:1px solid #0f0; box-shadow:0 0 15px #004400;`;
    notify.innerHTML = `[${isSuccess ? 'INFO' : 'ALERT'}]: ${message}`;
    document.body.appendChild(notify);
    setTimeout(() => notify.remove(), 3000);
}

// Finalizar diagnóstico y preparar transición
function finalize(type) {
    showProtocolStatus('TRAYECTORIA CALCULADA. INICIANDO WARP...');
    // 1. Mostrar pantalla de carga
    document.querySelectorAll('.question-box').forEach(el => el.classList.remove('active'));
    document.getElementById('loading').classList.add('active');

    // 2. Animar la barra de carga
    let bar = document.getElementById('bar');
    let width = 0;
    let interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
            triggerWarp(type); // Disparar efecto de salida
        } else {
            width++;
            bar.style.width = width + '%';
        }
    }, 20); 
}

// Efecto visual de salto e hiperespacio y redirección
function triggerWarp(type) {
    const routes = {
        'web': 'desarrollo-web.html',
        'ia': 'soluciones-ia.html',
        'sec': 'seguridad-web.html'
    };

    const destination = routes[type];

    // Activar animación warp
    let warp = document.getElementById('warp');
    let text = document.querySelector('.warp-speed');
    
    warp.style.opacity = 1;
    text.style.animation = "warpOut 1.5s forwards";

    // Redirigir al terminar la animación
    setTimeout(() => {
        window.location.href = destination;
    }, 1400);
}