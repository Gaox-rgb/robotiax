/**
 * Protocolo Inteligencia - IA Module Control
 * Orbita Roja System
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log("Initializing Arsenal Tactico...");
    console.log("Access Level: 5 - CONCEDED");
    
    // Configurar botones de compra de módulos
    document.querySelectorAll('.btn-module-purchase').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const moduleData = {
                id: btn.dataset.productId,
                name: btn.dataset.productName,
                price: btn.dataset.productPrice,
                currency: btn.dataset.productCurrency
            };
            openIAModal(moduleData);
        });
    });

    // Cerrar modal
    document.querySelector('.modal-close-button')?.addEventListener('click', closeIAModal);
});

function openIAModal(moduleData) {
    document.getElementById('modal-template-name').textContent = moduleData.name;
    document.getElementById('payment-modal-overlay').classList.add('visible');
    initIAPaypal(moduleData);
}

function closeIAModal() {
    document.getElementById('payment-modal-overlay').classList.remove('visible');
}

function showProtocolStatus(message, isSuccess = true) {
    const notify = document.createElement('div');
    const color = isSuccess ? '#ff3333' : '#8b0000';
    notify.style = `position:fixed; top:20px; right:20px; background:rgba(0,0,0,0.9); color:#fff; padding:20px; font-family:'Orbitron',sans-serif; z-index:10000; border:1px solid ${color}; box-shadow:0 0 20px ${color}; clip-path:polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); animation:slideIn 0.5s forwards;`;
    notify.innerHTML = `<div style="font-weight:bold; color:${color}; font-size:0.8rem; margin-bottom:5px;">${isSuccess ? '>> ACOPLAMIENTO_OK' : '>> ERROR_SISTEMA'}</div><div>${message}</div>`;
    document.body.appendChild(notify);
    setTimeout(() => { notify.style.opacity = '0'; setTimeout(() => notify.remove(), 500); }, 4000);
}

function initIAPaypal(moduleData) {
    const container = document.getElementById('modal-paypal-container');
    container.innerHTML = '';

    paypal.Buttons({
        createOrder: (data, actions) => {
            return fetch('https://createpaypalorder-bh64qprvqa-uc.a.run.app', { 
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: moduleData.price, currency: moduleData.currency, productId: moduleData.id })
            })
            .then(res => res.json())
            .then(orderData => orderData.orderID);
        },
        onApprove: (data, actions) => {
            return fetch('https://capturepaypalorder-bh64qprvqa-uc.a.run.app', {
                method: 'post',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderID: data.orderID, productId: moduleData.id })
            }).then(res => res.json())
            .then(orderData => {
                if (orderData.status === 'success') {
                    showProtocolStatus('MÓDULO SINCRONIZADO. Protocolo de IA activo.');
                    closeIAModal();
                } else {
                    showProtocolStatus('Fallo en la secuencia de pago.', false);
                }
            });
        }
    }).render('#modal-paypal-container');
}