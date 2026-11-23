window.app = window.app || {};
window.app.state = window.app.state || {
    summary: null,
    chats: [],
    activeChatId: null,
    messagesByChat: {}
};

window.app.panel = {
    endpoint: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:5001/robotiax/us-central1/whatsappClientApi'
        : 'https://us-central1-robotiax.cloudfunctions.net/whatsappClientApi',

    erpEndpoint: 'https://c2weabqkje5ssmfg4xlw7rhgsi0zstvy.lambda-url.us-east-2.on.aws/',

    stripePlans: {
        PLAN_100: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u',
        PLAN_300: 'https://buy.stripe.com/dRmcN6gtuc4O6Q66t94gg0v',
        PLAN_UNLIMITED: 'https://buy.stripe.com/aFa00k2CEecWfmC5p54gg0x',
        PLAN_100_ERP: 'https://buy.stripe.com/cNi5kE2CEfh0deu9Fl4gg0y',
        PLAN_300_ERP: 'https://buy.stripe.com/9B628sa56d8S4HY3gX4gg0z',
        PLAN_UNLIMITED_ERP: 'https://buy.stripe.com/cNi14o4KM1qa3DU2cT4gg0A'
    },

    email: '',
    token: '',
    syncInterval: null,
    activeTab: 'chats',
    lastLoadedChatTs: {},
    appointmentsLoaded: false,

    init: function() {
        const params = new URLSearchParams(window.location.search);
        const urlToken = (params.get('token') || '').trim().toUpperCase();
        const urlEmail = (params.get('email') || '').trim();

        let savedCreds = {};
        try {
            savedCreds = JSON.parse(localStorage.getItem('rx_wa_credentials') || '{}');
        } catch (e) {}

        let savedUser = {};
        try {
            savedUser = JSON.parse(localStorage.getItem('robotiax_user') || '{}');
        } catch (e) {}

        this.email = urlEmail || savedCreds.email || savedUser.email || '';
        this.token = urlToken || savedCreds.token || savedUser.token || '';

        const loginBox = document.getElementById('panel-login-box');

        if (this.email && this.token) {
            localStorage.setItem('rx_wa_credentials', JSON.stringify({ email: this.email, token: this.token }));
            localStorage.setItem('robotiax_user', JSON.stringify({ email: this.email, token: this.token, authenticated: true }));
            
            if (loginBox) loginBox.style.setProperty('display', 'none', 'important');
            
            setTimeout(() => {
                this.login();
            }, 20);
        } else {
            if (loginBox) loginBox.style.setProperty('display', 'block', 'important');
        }

        const emailField = document.getElementById('panel-login-email');
        const tokenField = document.getElementById('panel-login-token');
        if (emailField && this.email) emailField.value = this.email;
        if (tokenField && this.token) tokenField.value = this.token;

        try {
            const cachedChats = JSON.parse(localStorage.getItem('rx_panel_chats_cache') || '[]');
            if (Array.isArray(cachedChats)) window.app.state.chats = cachedChats;
            if (savedCreds.summary) window.app.state.summary = savedCreds.summary;
        } catch (e) {}

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.email && this.token && window.app.state.isLoggedIn) {
                this.syncStateAndChats(true);
            }
        });
    },

    login: async function(e) {
        if (e) e.preventDefault();
        const emailVal = (document.getElementById('panel-login-email')?.value || '').trim();
        const tokenVal = (document.getElementById('panel-login-token')?.value || '').trim().toUpperCase();
        const errBox = document.getElementById('panel-login-error');

        if (!emailVal || !tokenVal) return;
        if (errBox) errBox.style.display = 'none';

        this.email = emailVal;
        this.token = tokenVal;

        const ok = await this.syncStateAndChats(true);
        if (!ok) {
            if (errBox) {
                errBox.textContent = 'Correo o Token no válidos. Revisa tu correo de confirmación.';
                errBox.style.display = 'block';
            }
            return;
        }

        window.app.state.isLoggedIn = true;
        this.enterDashboard();
    },

    enterDashboard: function() {
        const loginBox = document.getElementById('panel-login-box');
        const dash = document.getElementById('panel-dashboard');
        
        if (loginBox) loginBox.style.setProperty('display', 'none', 'important');
        if (dash) dash.style.setProperty('display', 'flex', 'important');

        const topActions = document.getElementById('panel-top-actions');
        const topInner = document.querySelector('.rx-top-inner');
        if (topActions) topActions.style.setProperty('display', 'flex', 'important');
        if (topInner) {
            topInner.style.justifyContent = 'space-between';
            topInner.style.textAlign = 'left';
        }

        if (window.app.state.summary) {
            this.renderSummary(window.app.state.summary);
            this.populateBotConfigForm(window.app.state.summary.botProfile);
        }
        if (window.app.state.chats.length > 0) {
            this.renderChatsList();
        }

        this.initTrogoHologram();
        this.syncStateAndChats(true);

        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            if (!document.hidden && this.activeTab === 'chats') {
                this.syncStateAndChats(false);
            }
        }, 20000);
    },

    refreshNow: function() {
        this.syncStateAndChats(true);
    },

    handleGlobalBack: function() {
        if (this.activeTab !== 'chats') {
            this.switchTab('chats');
        } else {
            window.location.href = 'index.html';
        }
    },

    toggleTopHeaderCollapse: function() {
        const cards = document.getElementById('top-collapsible-cards');
        const btn = document.getElementById('top-collapse-btn');
        if (!cards || !btn) return;
        const isHidden = cards.style.display === 'none';
        cards.style.display = isHidden ? 'grid' : 'none';
        btn.textContent = isHidden ? '▲' : '▼';
    },

    toggleTopHeaderCollapse: function() {
        const cards = document.getElementById('top-collapsible-cards');
        const btn = document.getElementById('top-collapse-btn');
        if (!cards || !btn) return;
        const isHidden = cards.style.display === 'none';
        cards.style.display = isHidden ? 'grid' : 'none';
        btn.textContent = isHidden ? '▲' : '▼';
    },

    apiCall: async function(payload) {
        const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...payload,
                email: this.email,
                token: this.token
            })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
            throw new Error(data.error || 'Error de comunicación');
        }
        return data;
    },

    syncStateAndChats: async function(forceMessages) {
        try {
            const chatsData = await this.apiCall({ action: 'get_chats' });

            window.app.state.summary = chatsData.summary;
            window.app.state.chats = chatsData.chats || [];

            localStorage.setItem('rx_wa_credentials', JSON.stringify({
                email: this.email,
                token: this.token,
                summary: chatsData.summary
            }));
            localStorage.setItem('rx_panel_chats_cache', JSON.stringify(window.app.state.chats));

            this.renderConnectionBadge(chatsData.state);
            this.renderSummary(chatsData.summary);
            this.renderChatsList();
            if (forceMessages && chatsData.summary?.botProfile) {
                this.populateBotConfigForm(chatsData.summary.botProfile);
            }

            if (window.app.state.activeChatId) {
                const activeObj = window.app.state.chats.find(c => c.chatId === window.app.state.activeChatId);
                const latestTs = activeObj ? Number(activeObj.lastMessageAt || 0) : 0;
                const prevTs = Number(this.lastLoadedChatTs[window.app.state.activeChatId] || 0);
                if (forceMessages || latestTs > prevTs) {
                    await this.loadChatMessages(window.app.state.activeChatId, true);
                }
            }
            return true;
        } catch (err) {
            console.warn('Sync panel:', err.message);
            return false;
        }
    },

    switchTab: function(tab) {
        this.activeTab = tab;
        const pChats = document.getElementById('tab-panel-chats');
        const pErp = document.getElementById('tab-panel-erp');
        const pTrogo = document.getElementById('tab-panel-trogo');
        const pWeb = document.getElementById('tab-panel-web');
        const pPlanes = document.getElementById('tab-panel-planes');

        const bChats = document.getElementById('tab-btn-chats');
        const bErp = document.getElementById('tab-btn-erp');
        const bTrogo = document.getElementById('tab-btn-trogo');
        const bWeb = document.getElementById('tab-btn-web');
        const bPlanes = document.getElementById('tab-btn-planes');

        // Ocultar o mostrar el bloque superior de negocio/plan según la pestaña (Solo visible en 'chats')
        const topCards = document.getElementById('top-collapsible-cards');
        const topCollapseBtn = document.getElementById('top-collapse-btn');
        if (topCards) {
            topCards.style.display = (tab === 'chats') ? 'grid' : 'none';
        }
        if (topCollapseBtn) {
            topCollapseBtn.style.display = (tab === 'chats') ? 'flex' : 'none';
        }
        if (topCards) {
            topCards.style.display = (tab === 'chats') ? 'grid' : 'none';
        }
        if (topCollapseBtn) {
            topCollapseBtn.style.display = (tab === 'chats') ? 'flex' : 'none';
        }

        if (pChats) pChats.style.display = tab === 'chats' ? 'flex' : 'none';
        if (pErp) {
            pErp.style.setProperty('display', tab === 'erp' ? 'block' : 'none', 'important');
        }
        if (pTrogo) pTrogo.style.display = tab === 'trogo' ? 'block' : 'none';
        if (pWeb) pWeb.style.display = tab === 'web' ? 'block' : 'none';
        if (pPlanes) pPlanes.style.display = tab === 'planes' ? 'block' : 'none';

        if (bChats) bChats.className = 'rx-nav-link-tab' + (tab === 'chats' ? ' active' : '');
        if (bErp) bErp.className = 'rx-nav-link-tab' + (tab === 'erp' ? ' active' : '');
        if (bTrogo) bTrogo.className = 'rx-nav-link-tab' + (tab === 'trogo' ? ' active' : '');
        if (bWeb) bWeb.className = 'rx-nav-link-tab' + (tab === 'web' ? ' active' : '');
        if (bPlanes) bPlanes.className = 'rx-nav-link-tab' + (tab === 'planes' ? ' active' : '');

        if (tab === 'trogo') {
            this.startTrogoMatrixRain();
        }
        if (tab === 'web' && window.app.state.summary) {
            const siteUrl = window.app.state.summary.siteUrl || '#';
            const previewLink = document.getElementById('myweb-preview-link');
            const openBtn = document.getElementById('myweb-btn-open');
            if (previewLink) { previewLink.textContent = siteUrl; previewLink.href = siteUrl; }
            if (openBtn) { openBtn.href = siteUrl; }
        }
        if (tab === 'erp') {
            const isErpActive = Boolean(window.app.state.summary?.erpActive);
            const gate = document.getElementById('erp-locked-gate');
            const content = document.getElementById('erp-unlocked-content');
            if (gate) gate.style.display = isErpActive ? 'none' : 'block';
            if (content) content.style.display = isErpActive ? 'block' : 'none';

            if (isErpActive) {
                this.refreshErpData();
            }
        }
    },

    populateBotConfigForm: function(profile) {
        if (!profile) return;
        const setVal = (id, v) => {
            const el = document.getElementById(id);
            if (el && document.activeElement !== el) el.value = v || '';
        };
        setVal('cfg-bot-hours', profile.horarios);
        setVal('cfg-bot-fee', profile.fee);
        setVal('cfg-bot-address', profile.direccion);
        setVal('cfg-bot-phone', profile.telefono);
        setVal('cfg-bot-services', profile.servicios);
        setVal('cfg-bot-welcome', profile.welcomeMessage);
        setVal('cfg-bot-extra', profile.extraInfo);
    },

    renderConnectionBadge: function(state) {
        const statusText = document.getElementById('panel-wa-status-text');
        const avatarBox = document.getElementById('panel-wa-avatar-box');
        const avatarIcon = document.getElementById('panel-wa-avatar-icon');
        const s = window.app.state.summary || {};
        const activeEngine = s.activeEngine || 'whatsapp';

        if (activeEngine === 'trogo') {
            if (statusText) statusText.textContent = 'AGENTE IA TROGO ACTIVO';
            if (avatarBox) avatarBox.style.borderColor = '#00f2ff';
            if (avatarIcon) {
                avatarBox.innerHTML = `<img src="assets/Trogo.webp" alt="Trogo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            }
        } else {
            if (state === 'open') {
                if (statusText) statusText.textContent = 'WHATSAPP CONECTADO 24/7';
                if (avatarBox) {
                    avatarBox.style.borderColor = '#25d366';
                    avatarBox.innerHTML = `<i class="fa-brands fa-whatsapp" id="panel-wa-avatar-icon" style="color:#25d366;"></i>`;
                }
            } else {
                if (statusText) statusText.textContent = 'WHATSAPP DESCONECTADO (REQUIERE QR)';
                if (avatarBox) {
                    avatarBox.style.borderColor = '#e11d48';
                    avatarBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation" id="panel-wa-avatar-icon" style="color:#e11d48;"></i>`;
                }
            }
        }
    },

    toggleEngineMode: async function(checkbox) {
        const targetEngine = checkbox.checked ? 'trogo' : 'whatsapp';
        const s = window.app.state.summary || {};
        const lastSwitch = Number(s.lastChannelSwitchAt || 0);
        const cooldownMs = 24 * 60 * 60 * 1000;

        if (lastSwitch && (Date.now() - lastSwitch < cooldownMs)) {
            alert('Por seguridad y estabilidad, solo se permite alternar de motor 1 vez al día.');
            checkbox.checked = !checkbox.checked;
            return;
        }

        try {
            const res = await this.apiCall({ action: 'switch_engine_mode', engine: targetEngine });
            window.app.state.summary = res.summary;
            this.renderConnectionBadge(res.summary.whatsappStatus || 'open');
            alert(`✓ Motor cambiado a: ${targetEngine === 'trogo' ? 'Agente IA Trogo' : 'WhatsApp Tradicional'}.`);
        } catch (err) {
            alert(err.message || 'No se pudo cambiar el motor.');
            checkbox.checked = !checkbox.checked;
        }
    },

    renderSummary: function(s) {
        if (!s) return;
        const bizEl = document.getElementById('stat-biz-name');
        const folioEl = document.getElementById('stat-folio');
        const planEl = document.getElementById('stat-plan-name');
        const expEl = document.getElementById('stat-expires');
        const quotaEl = document.getElementById('stat-quota-text');
        const simpleQuota = document.getElementById('stat-simple-quota');
        const barEl = document.getElementById('stat-quota-bar');
        const myWebBtn = document.getElementById('panel-btn-myweb');
        const connectBtn = document.getElementById('panel-btn-conectar-qr');

        if (bizEl) bizEl.textContent = s.negocio || '-';
        if (folioEl) folioEl.textContent = 'Folio: ' + (s.folio || '-');
        if (planEl) planEl.textContent = s.planName || '-';
        if (expEl) {
            expEl.textContent = s.expiresAt ? 'Vence: ' + new Date(s.expiresAt).toLocaleDateString('es-MX') : 'Vigencia: 30 días';
        }
        if (connectBtn) {
            connectBtn.href = 'conectar.html?token=' + encodeURIComponent(this.token) + '&email=' + encodeURIComponent(this.email);
        }

        const count = Number(s.messageCount || 0);
        let limit = Number(s.messageLimit || 100);
        const isUnlimited = Boolean(s.isUnlimited || false);
        const planNameStr = String(s.planName || '').toLowerCase();
        if (planNameStr.includes('básico') || planNameStr.includes('basico')) {
            limit = 100;
        } else if (planNameStr.includes('crecimiento')) {
            limit = 300;
        } else if (planNameStr.includes('élite') || planNameStr.includes('elite')) {
            limit = 1000;
        }

        const pct = isUnlimited ? 100 : Math.min(Math.round((count / limit) * 100), 100);

        if (quotaEl) quotaEl.textContent = isUnlimited ? count + ' / ILIMITADO' : count + ' / ' + limit + ' (' + pct + '%)';
        if (simpleQuota) simpleQuota.textContent = isUnlimited ? count + ' / ILIMITADO' : count + ' / ' + limit;
        if (barEl) {
            barEl.style.width = pct + '%';
            barEl.style.background = isUnlimited ? '#25d366' : (pct >= 90 ? '#e11d48' : '#00f2ff');
        }
    },

    renderChatsList: function() {
        const listEl = document.getElementById('panel-chat-list');
        if (!listEl) return;
        const chats = window.app.state.chats || [];
        if (chats.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 0.76rem; color: #64748b;">Aún no hay conversaciones registradas.</div>';
            return;
        }
        listEl.innerHTML = chats.map(c => `
            <div class="rx-chat-item ${window.app.state.activeChatId === c.chatId ? 'active' : ''}" onclick="window.app.panel.selectChat('${c.chatId}')">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                    <strong style="font-size:0.8rem; color:#ffffff;">${this.escapeHtml(c.contactName)}</strong>
                </div>
                <div style="font-size:0.7rem; color:#94a3b8; margin-top:3px;">${this.escapeHtml(c.lastMessage)}</div>
            </div>
        `).join('');
    },

    selectChat: async function(chatId) {
        window.app.state.activeChatId = chatId;
        this.renderChatsList();
        await this.loadChatMessages(chatId, false);
    },

    loadChatMessages: async function(chatId, silent) {
        try {
            const data = await this.apiCall({ action: 'get_messages', chatId: chatId });
            window.app.state.messagesByChat[chatId] = data.messages || [];
            if (window.app.state.activeChatId === chatId) {
                this.renderMessages(data.messages || []);
            }
        } catch (err) {
            if (!silent) console.warn('Error mensajes:', err.message);
        }
    },

    renderMessages: function(messages) {
        const bodyEl = document.getElementById('active-chat-messages');
        if (!bodyEl) return;
        if (!messages || messages.length === 0) {
            bodyEl.innerHTML = '<div style="margin:auto; color:#64748b; font-size:0.78rem;">Sin mensajes en este chat aún.</div>';
            return;
        }
        bodyEl.innerHTML = messages.map(m => `
            <div class="rx-bubble ${m.sender === 'bot' ? 'bot' : (m.sender === 'human' ? 'human' : 'customer')}">
                <div>${this.escapeHtml(m.text)}</div>
            </div>
        `).join('');
        bodyEl.scrollTop = bodyEl.scrollHeight;
    },

    sendManualReply: async function(e) {
        if (e) e.preventDefault();
        const chatId = window.app.state.activeChatId;
        const inputEl = document.getElementById('panel-reply-input');
        if (!chatId || !inputEl) return;
        const text = inputEl.value.trim();
        if (!text) return;
        try {
            await this.apiCall({ action: 'send_manual_reply', chatId: chatId, text: text });
            inputEl.value = '';
            await this.loadChatMessages(chatId, false);
        } catch (err) {
            alert(err.message || 'No se pudo enviar.');
        }
    },

    // ================= ERP PYME =================
    activeErpSubTab: 'citas',
    switchErpSubTab: function(subTab) {
        this.activeErpSubTab = subTab;
        const tabs = ['citas', 'ventas', 'clientes', 'servicios', 'inventario', 'cortes'];
        tabs.forEach(t => {
            const p = document.getElementById(`erp-sub-panel-${t}`);
            if (p) p.style.display = t === subTab ? 'block' : 'none';
        });
        this.loadErpEntity(subTab);
    },

    erpApiCall: async function(entity, action, payload = {}) {
        const bizSlug = window.app.state.summary?.negocio_slug;
        if (!bizSlug) throw new Error('No se detectó el negocio.');
        const res = await fetch(this.erpEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bizSlug, entity, action, payload })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Error ERP');
        return data;
    },

    loadErpEntity: async function(subTab) {
        try {
            if (subTab === 'citas') {
                const res = await this.erpApiCall('appointments', 'list');
                const listEl = document.getElementById('erp-list-citas');
                if (listEl) listEl.innerHTML = (res.data || []).map(a => `<div style="background:#040914;padding:10px;border-radius:8px;margin-bottom:8px;color:#fff;">${a.clientName} - ${a.date} (${a.status})</div>`).join('') || 'Sin citas';
            }
        } catch (e) {}
    },

    refreshErpData: function() { this.loadErpEntity(this.activeErpSubTab); },

    startTrogoMatrixRain: function() {
        const canvas = document.getElementById('trogo-matrix-canvas');
        const hero = document.getElementById('trogo-hero-stage');
        if (!canvas || !hero) return;

        // Reiniciar estado visual
        canvas.style.display = 'block';
        canvas.style.opacity = '1';
        hero.style.opacity = '0';

        const ctx = canvas.getContext('2d');
        const container = document.getElementById('tab-panel-trogo');
        canvas.width = container ? container.offsetWidth : window.innerWidth;
        canvas.height = container ? container.offsetHeight : 460;

        const letters = 'TROGO01AIQUANTUMROBOTIAXMAKUMOTO';
        const fontSize = 14;
        const columns = Math.floor(canvas.width / fontSize);
        const drops = Array(columns).fill(1);

        const matrixInterval = setInterval(() => {
            ctx.fillStyle = 'rgba(2, 6, 23, 0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#00f2ff'; // AZUL MATRIX CUÁNTICO
            ctx.font = fontSize + 'px monospace';

            for (let i = 0; i < drops.length; i++) {
                const text = letters.charAt(Math.floor(Math.random() * letters.length));
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        }, 40);

        // Detener la lluvia exactamente a los 2 segundos y revelar a Trogo Evolution
        setTimeout(() => {
            canvas.style.opacity = '0';
            hero.style.opacity = '1';
            setTimeout(() => {
                clearInterval(matrixInterval);
                canvas.style.display = 'none';
            }, 600);
        }, 2000);
    },

    revealTrogoFuture: function() {
        const futureDiv = document.getElementById('trogo-future-content');
        const btn = document.getElementById('btn-trogo-enter-future');
        if (futureDiv) {
            futureDiv.style.display = 'block';
            futureDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (btn) btn.style.display = 'none';
    },

    showPlanCategory: function(cat) {
        const cats = ['wa', 'erp', 'trogo'];
        cats.forEach(c => {
            const panel = document.getElementById(`plan-cat-${c}`);
            const btn = document.getElementById(`btn-cat-${c}`);
            if (panel) panel.style.display = (c === cat) ? 'grid' : 'none';
            if (btn) btn.className = 'rx-chip-btn' + (c === cat ? ' cyan' : '');
        });
    },

    openStripeCheckout: function(planTag) {
        const baseLink = this.stripePlans[planTag] || this.stripePlans.PLAN_100;
        const s = window.app.state.summary || {};
        const ref = (s.folio || 'RENOVACION') + '__' + encodeURIComponent(this.email) + '__' + encodeURIComponent(s.negocio || 'Cliente') + '__' + planTag;
        window.location.href = baseLink + (baseLink.includes('?') ? '&' : '?') + 'prefilled_email=' + encodeURIComponent(this.email) + '&client_reference_id=' + encodeURIComponent(ref);
    },

    // =========================================================================
    // BURBUJAS PROACTIVAS DE TROGO (NOTIFICACIONES COMERCIALES SIN CHAT)
    // =========================================================================
    // =========================================================================
    // BURBUJAS PROACTIVAS DE TROGO (CÁLIDAS, SIMPÁTICAS Y LLENAS DE EMOJIS)
    // =========================================================================
    trogoPhrases: [
        "👋 ¡Hola! Solo pasaba a recordarte que hoy puedes vender más mientras duermes 💤. ¡Deja atrás el viejo WhatsApp!",
        "☕ Tómate un café tranquilo. Yo me encargo de responderle al 100% a tus clientes en menos de 1 segundo ⚡.",
        "📊 ¿Sabías que hoy a las 8:00 PM recibirás tu corte de caja automático en tu WhatsApp? ¡Cero estrés 🛡️!",
        "💡 Tip del día: Los clientes compran donde les atienden rápido. ¿Y si me dejas acelerar tu negocio? 🚀",
        "🎯 ¿Cansado de perder prospectos por contestar tarde? Da el salto al nivel corporativo con IA pura ✨."
    ],
    trogoPhraseIndex: 0,
    trogoBubbleTimer: null,

    initTrogoHologram: function() {
        // Primera aparición tras 2 minutos reales (120,000 ms)
        if (this.trogoInitialTimer) clearTimeout(this.trogoInitialTimer);
        this.trogoInitialTimer = setTimeout(() => {
            this.showNextTrogoPhrase();
        }, 2 * 60 * 1000);

        if (this.trogoBubbleTimer) clearInterval(this.trogoBubbleTimer);
        this.trogoBubbleTimer = setInterval(() => {
            this.showNextTrogoPhrase();
        }, 15 * 60 * 1000);
    },

    showNextTrogoPhrase: function() {
        const bubbleBox = document.getElementById('trogo-bubble-box');
        const bubbleText = document.getElementById('trogo-bubble-text');
        if (!bubbleBox || !bubbleText) return;

        const phrase = this.trogoPhrases[this.trogoPhraseIndex];
        this.trogoPhraseIndex = (this.trogoPhraseIndex + 1) % this.trogoPhrases.length;

        bubbleText.textContent = phrase;
        bubbleBox.style.display = 'block';
        setTimeout(() => {
            bubbleBox.style.opacity = '1';
            bubbleBox.style.transform = 'translateY(0)';
        }, 50);

        if (this.trogoAutoHideTimer) clearTimeout(this.trogoAutoHideTimer);
        this.trogoAutoHideTimer = setTimeout(() => {
            this.closeTrogoBubble();
        }, 12000);
    },

    closeTrogoBubble: function() {
        const bubbleBox = document.getElementById('trogo-bubble-box');
        if (!bubbleBox) return;
        bubbleBox.style.opacity = '0';
        bubbleBox.style.transform = 'translateY(10px)';
        setTimeout(() => {
            bubbleBox.style.display = 'none';
        }, 400);

        // Al cerrar con la X, reiniciar el conteo completo de 15 minutos reales
        if (this.trogoBubbleTimer) clearInterval(this.trogoBubbleTimer);
        this.trogoBubbleTimer = setInterval(() => {
            this.showNextTrogoPhrase();
        }, 15 * 60 * 1000);
    },

    logout: function() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        localStorage.removeItem('rx_wa_credentials');
        localStorage.removeItem('rx_panel_chats_cache');
        window.location.href = 'index.html';
    },

    escapeHtml: function(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.app.panel.init();
});