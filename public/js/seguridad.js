/**
 * Protocolo de Seguridad Web - ROBOTIAX
 * Manejo de alertas y nodos de red
 */

document.addEventListener("DOMContentLoaded", () => {
    console.warn("ALERTA: Accediendo a zona comprometida.");
    
    const simulateHacks = () => {
        const actions = ["Bloqueando IP intrusa", "Cifrando túnel VPN", "Neutralizando Ransomware"];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        console.log(`[ESCUDO]: ${randomAction}... OK`);
    };
    setInterval(simulateHacks, 3000);

    // Inicializar botones de compra de nodos
    document.querySelectorAll('.btn-node-purchase').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const product = {
                id: btn.dataset.productId,
                name: btn.dataset.productName,
                price: btn.dataset.productPrice,
                currency: btn.dataset.productCurrency
            };
            openPaymentModal(product);
        });
    });

    // Cerrar modal
    document.querySelector('.modal-close-button')?.addEventListener('click', closePaymentModal);
});

function openPaymentModal(product) {
    document.getElementById('modal-template-name').textContent = product.name;
    const modal = document.getElementById('payment-modal-overlay');
    modal.classList.add('visible');
    initPaypalButton(product);
}

function closePaymentModal() {
    document.getElementById('payment-modal-overlay').classList.remove('visible');
}

function showProtocolStatus(message, isSuccess = true) {
    const notify = document.createElement('div');
    notify.style = `position:fixed; top:20px; right:20px; background:${isSuccess ? '#00eaff' : '#ff003c'}; color:black; padding:20px; font-family:'VT323',monospace; z-index:10000; border:2px solid white; box-shadow:0 0 20px ${isSuccess ? '#00eaff' : '#ff003c'}; clip-path:polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%); animation:slideIn 0.5s forwards;`;
    notify.innerHTML = `<div style="font-weight:bold; font-size:1.2rem;">${isSuccess ? '[SISTEMA_OK]' : '[ERROR_CRÍTICO]'}</div><div>${message}</div>`;
    document.body.appendChild(notify);
    setTimeout(() => { notify.style.animation = 'slideOut 0.5s forwards'; setTimeout(() => notify.remove(), 500); }, 4000);
}

function initPaypalButton(product) {
    const container = document.getElementById('modal-paypal-container');
    container.innerHTML = ''; 

    paypal.Buttons({
        createOrder: (data, actions) => {
            return fetch('https://createpaypalorder-bh64qprvqa-uc.a.run.app', { 
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: product.price, currency: product.currency, productId: product.id })
            })
            .then(res => res.json())
            .then(orderData => orderData.orderID);
        },
        onApprove: (data, actions) => {
            return fetch('https://capturepaypalorder-bh64qprvqa-uc.a.run.app', {
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderID: data.orderID, productId: product.id })
            }).then(res => res.json())
            .then(orderData => {
                if (orderData.status === 'success') {
                    showProtocolStatus('ESCUDO ACTIVADO. Amenazas neutralizadas.');
                    closePaymentModal();
                } else {
                    showProtocolStatus('Fallo en la secuencia de pago.', false);
                }
            });
        }
    }).render('#modal-paypal-container');
}