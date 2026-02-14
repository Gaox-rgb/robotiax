/**
 * Protocolo de Seguridad Web - ROBOTIAX
 * Manejo de alertas y nodos de red
 */

document.addEventListener("DOMContentLoaded", () => {
    console.warn("ALERTA: Accediendo a zona comprometida.");
    
    // Podemos simular un log de "ataques detenidos" en consola para el usuario curioso
    const simulateHacks = () => {
        const actions = ["Bloqueando IP intrusa", "Cifrando túnel VPN", "Neutralizando Ransomware"];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        console.log(`[ESCUDO]: ${randomAction}... OK`);
    };

    setInterval(simulateHacks, 3000);
});

// Lógica para el botón de compra agresivo
function activarBunker() {
    alert("INICIANDO PROTOCOLO DE DEFENSA... Redirigiendo a pasarela segura.");
}