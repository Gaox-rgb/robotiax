window.app = window.app || {};

window.app.conectar = {
    endpoint: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:5001/robotiax/us-central1/whatsappClientApi'
        : 'https://us-central1-robotiax.cloudfunctions.net/whatsappClientApi',

    pollTimer: null,
    currentEmail: '',
    currentToken: '',

    init: function() {
        const params = new URLSearchParams(window.location.search);
        const urlToken = (params.get('token') || '').trim().toUpperCase();
        const urlEmail = (params.get('email') || '').trim();

        if (urlToken && urlEmail) {
            localStorage.setItem('rx_wa_credentials', JSON.stringify({
                email: urlEmail,
                token: urlToken
            }));
            localStorage.setItem('robotiax_user', JSON.stringify({
                email: urlEmail,
                token: urlToken,
                authenticated: true
            }));
        }

        let savedCreds = {};
        try {
            savedCreds = JSON.parse(localStorage.getItem('rx_wa_credentials') || '{}');
        } catch (e) {}

        let savedUser = {};
        try {
            savedUser = JSON.parse(localStorage.getItem('robotiax_user') || '{}');
        } catch (e) {}

        const emailToFill = urlEmail || savedCreds.email || savedUser.email || '';
        const tokenToFill = urlToken || savedCreds.token || '';

        const emailInput = document.getElementById('conectar-email');
        const tokenInput = document.getElementById('conectar-token');

        if (emailInput && emailToFill) emailInput.value = emailToFill;
        if (tokenInput && tokenToFill) tokenInput.value = tokenToFill;

        if (tokenToFill && emailToFill) {
            this.currentEmail = emailToFill;
            this.currentToken = tokenToFill;
            const formEl = document.getElementById('conectar-form');
            if (formEl) formEl.style.display = 'none';
            this.fetchQrAndState(true);
        }
    },

    showMsg: function(text, type) {
        const box = document.getElementById('conectar-alert');
        if (!box) return;
        if (!text) {
            box.style.display = 'none';
            box.className = 'rx-msg';
            box.textContent = '';
            return;
        }
        box.textContent = text;
        box.className = 'rx-msg ' + (type || 'info');
        box.style.display = 'block';
    },

    submitCredentials: function(e) {
        if (e) e.preventDefault();
        const emailVal = (document.getElementById('conectar-email')?.value || '').trim();
        const tokenVal = (document.getElementById('conectar-token')?.value || '').trim().toUpperCase();

        if (!emailVal || !tokenVal) {
            this.showMsg('Por favor ingresa tu correo de compra y tu Token de Seguridad.', 'error');
            return;
        }

        this.currentEmail = emailVal;
        this.currentToken = tokenVal;
        this.fetchQrAndState(true);
    },

    fetchQrAndState: async function(isInitial) {
        const btn = document.getElementById('btn-generar-qr');
        if (isInitial && btn) {
            btn.disabled = true;
            btn.textContent = 'Conectando con servidor...';
        }
        this.showMsg('', '');

        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify_and_qr',
                    email: this.currentEmail,
                    token: this.currentToken
                })
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'No se pudo validar tu acceso.');
            }

            localStorage.setItem('rx_wa_credentials', JSON.stringify({
                email: this.currentEmail,
                token: this.currentToken,
                summary: data.summary || {}
            }));

            if (data.summary && data.summary.negocio) {
                localStorage.setItem('robotiax_user', JSON.stringify({
                    name: data.summary.negocio,
                    email: this.currentEmail,
                    authenticated: true
                }));
                const lbl = document.getElementById('conectar-biz-label');
                if (lbl) lbl.textContent = 'Negocio: ' + data.summary.negocio;
            }

            if (data.state === 'open') {
                this.showConnectedState(data.summary);
                return;
            }

            this.showQrState(data.qrBase64, data.qrCode);
            this.startPollingState();
        } catch (err) {
            this.showMsg(err.message || 'Error conectando con el motor de WhatsApp.', 'error');
            this.stopPolling();
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Validar y Obtener Código QR';
            }
        }
    },

    showQrState: function(qrBase64, qrCode) {
        const form = document.getElementById('conectar-form');
        const qrBox = document.getElementById('conectar-qr-box');
        const connBox = document.getElementById('conectar-connected-box');
        const qrImg = document.getElementById('conectar-qr-img');

        if (form) form.style.display = 'none';
        if (connBox) connBox.style.display = 'none';
        if (qrBox) qrBox.style.display = 'flex';

        if (qrImg) {
            if (qrBase64) {
                qrImg.src = qrBase64;
            } else if (qrCode) {
                qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(qrCode);
            } else {
                this.showMsg('Generando nuevo QR, espera un segundo y pulsa Actualizar QR.', 'info');
            }
        }
    },

    showConnectedState: function(summary) {
        this.stopPolling();
        const form = document.getElementById('conectar-form');
        const qrBox = document.getElementById('conectar-qr-box');
        const connBox = document.getElementById('conectar-connected-box');

        if (form) form.style.display = 'none';
        if (qrBox) qrBox.style.display = 'none';
        if (connBox) connBox.style.display = 'flex';

        if (summary) {
            const nameEl = document.getElementById('connected-biz-name');
            const slugEl = document.getElementById('connected-slug');
            const planEl = document.getElementById('connected-plan');
            if (nameEl) nameEl.textContent = summary.negocio || '-';
            if (slugEl) slugEl.textContent = summary.negocio_slug || '-';
            if (planEl) planEl.textContent = summary.planName || 'Plan Activo';
        }
    },

    startPollingState: function() {
        this.stopPolling();
        this.pollTimer = setInterval(async () => {
            try {
                const res = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'connection_state',
                        email: this.currentEmail,
                        token: this.currentToken
                    })
                });
                const data = await res.json();
                if (res.ok && data.ok && data.state === 'open') {
                    this.showConnectedState(data.summary);
                }
            } catch (e) {}
        }, 5000);
    },

    stopPolling: function() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    },

    refreshQrNow: function() {
        this.fetchQrAndState(false);
    },

    activateTrogoMode: async function() {
        this.stopPolling();
        const btn = document.getElementById('btn-activate-trogo') || document.querySelector('button[onclick*="activateTrogoMode"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⚡ ACTIVANDO AGENTE TROGO...</span>';
        }
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⚡ ACTIVANDO AGENTE TROGO...</span>';
        }

        if (!this.currentEmail || !this.currentToken) {
            const emailInput = document.getElementById('conectar-email');
            const tokenInput = document.getElementById('conectar-token');
            this.currentEmail = emailInput ? emailInput.value.trim() : '';
            this.currentToken = tokenInput ? tokenInput.value.trim().toUpperCase() : '';
        }

        if (!this.currentEmail || !this.currentToken) {
            this.showMsg('Por favor ingresa primero tu correo y tu token arriba.', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>⚡ ACTIVAR A TROGO (PROMOCIÓN 2x1: 200 MENSAJES)</span> <i class="fa-solid fa-arrow-right"></i>';
            }
            return;
        }

        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'activate_trogo_mode',
                    email: this.currentEmail,
                    token: this.currentToken
                })
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'No se pudo activar TROGO.');
            }

            localStorage.setItem('rx_wa_credentials', JSON.stringify({
                email: this.currentEmail,
                token: this.currentToken,
                summary: data.summary || {}
            }));

            localStorage.setItem('rx_wa_credentials', JSON.stringify({
                email: this.currentEmail,
                token: this.currentToken,
                summary: data.summary || {}
            }));

            localStorage.setItem('robotiax_user', JSON.stringify({
                email: this.currentEmail,
                token: this.currentToken,
                authenticated: true,
                channel: 'trogo'
            }));

            window.location.href = `panel.html?token=${encodeURIComponent(this.currentToken)}&email=${encodeURIComponent(this.currentEmail)}`;
        localStorage.setItem('rx_wa_credentials', JSON.stringify({
                email: this.currentEmail,
                token: this.currentToken,
                summary: data.summary || {}
            }));

            localStorage.setItem('robotiax_user', JSON.stringify({
                email: this.currentEmail,
                token: this.currentToken,
                authenticated: true,
                channel: 'trogo'
            }));

            window.location.replace(`panel.html?token=${encodeURIComponent(this.currentToken)}&email=${encodeURIComponent(this.currentEmail)}`);
        } catch (err) {
            this.showRxModalAlert('ERROR DE ACTIVACIÓN', err.message || 'Error activando a TROGO. Intenta de nuevo.');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>⚡ ACTIVAR A TROGO (PROMOCIÓN 2x1: 200 MENSAJES)</span> <i class="fa-solid fa-arrow-right"></i>';
            }
        }
    },

    showRxModalAlert: function(title, desc) {
        const overlay = document.getElementById('rx-custom-modal-overlay');
        const titleEl = document.getElementById('rx-modal-title');
        const descEl = document.getElementById('rx-modal-desc');
        const btnOk = document.getElementById('rx-modal-btn-ok');
        const btnCancel = document.getElementById('rx-modal-btn-cancel');

        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;
        if (btnCancel) btnCancel.style.display = 'none';
        if (overlay) overlay.style.setProperty('display', 'flex', 'important');

        if (btnOk) {
            btnOk.textContent = 'ACEPTAR';
            btnOk.onclick = () => {
                if (overlay) overlay.style.setProperty('display', 'none', 'important');
            };
        }
    },

    showRxModalConfirm: function(title, desc, onConfirm) {
        const overlay = document.getElementById('rx-custom-modal-overlay');
        const titleEl = document.getElementById('rx-modal-title');
        const descEl = document.getElementById('rx-modal-desc');
        const btnOk = document.getElementById('rx-modal-btn-ok');
        const btnCancel = document.getElementById('rx-modal-btn-cancel');

        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;
        if (btnCancel) {
            btnCancel.style.display = 'block';
            btnCancel.onclick = () => {
                if (overlay) overlay.style.setProperty('display', 'none', 'important');
                const btn = document.querySelector('button[onclick*="activateTrogoMode"]');
                if (btn) { btn.disabled = false; btn.textContent = 'ACTIVAR A TROGO EN MI SITIO WEB (2X MENSAJES) ➔'; }
            };
        }
        if (overlay) overlay.style.setProperty('display', 'flex', 'important');

        if (btnOk) {
            btnOk.textContent = 'SÍ, ACTIVAR A TROGO';
            btnOk.onclick = () => {
                if (overlay) overlay.style.setProperty('display', 'none', 'important');
                if (typeof onConfirm === 'function') onConfirm();
            };
        }
    },

    resetCredentials: function() {
        this.stopPolling();
        localStorage.removeItem('rx_wa_credentials');
        const form = document.getElementById('conectar-form');
        const qrBox = document.getElementById('conectar-qr-box');
        const connBox = document.getElementById('conectar-connected-box');
        if (form) form.style.display = 'flex';
        if (qrBox) qrBox.style.display = 'none';
        if (connBox) connBox.style.display = 'none';
        this.showMsg('', '');
    },

    disconnectInstance: async function() {
        if (!confirm('¿Seguro que deseas desvincular tu número de WhatsApp actual?')) return;
        try {
            await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'logout_instance',
                    email: this.currentEmail,
                    token: this.currentToken
                })
            });
            this.fetchQrAndState(false);
        } catch (e) {
            this.showMsg('Error intentando desvincular la instancia.', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.app.conectar.init();
});