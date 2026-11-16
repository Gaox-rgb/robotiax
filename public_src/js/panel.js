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

    stripePlans: {
        PLAN_100: 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u',
        PLAN_300: 'https://buy.stripe.com/dRmcN6gtuc4O6Q66t94gg0v',
        PLAN_UNLIMITED: 'https://buy.stripe.com/aFa00k2CEecWfmC5p54gg0x',
        PLAN_100_ERP: 'https://buy.stripe.com/cNi5kE2CEfh0deu9Fl4gg0y',
        PLAN_300_ERP: 'https://buy.stripe.com/9B628sa56d8S4HY3gX4gg0z',
        PLAN_UNLIMITED_ERP: 'https://buy.stripe.com/cNi14o4KM1qa3DU2cT4gg0A'
    },

    panelErpMode: false,

    togglePanelErp: function(withErp) {
        this.panelErpMode = Boolean(withErp);
        const btnOff = document.getElementById('panel-btn-erp-off');
        const btnOn = document.getElementById('panel-btn-erp-on');
        if (btnOff) {
            btnOff.style.background = withErp ? 'transparent' : '#00f2ff';
            btnOff.style.color = withErp ? '#cbd5e1' : '#020617';
        }
        if (btnOn) {
            btnOn.style.background = withErp ? '#39ff14' : 'transparent';
            btnOn.style.color = withErp ? '#020617' : '#39ff14';
        }

        const setEl = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
        const showEl = (id, vis) => { const el = document.getElementById(id); if (el) el.style.display = vis ? 'list-item' : 'none'; };

        if (withErp) {
            setEl('p-price-100', '$455.00 <span style="font-size: 0.8rem; font-weight: 500; color: #94a3b8;">MXN/mes</span>');
            setEl('p-iva-100', 'Subtotal: $392.24 + IVA (16%): $62.76 MXN (Incluye ERP +$200)');
            setEl('p-btn-100', 'Renovar Básico + ERP ($455 MXN)');
            showEl('p-erp-100', true);

            setEl('p-price-300', '$800.00 <span style="font-size: 0.8rem; font-weight: 500; color: #94a3b8;">MXN/mes</span>');
            setEl('p-iva-300', 'Subtotal: $689.66 + IVA (16%): $110.34 MXN (Incluye ERP +$300)');
            setEl('p-btn-300', 'Subir a 300 + ERP ($800 MXN)');
            showEl('p-erp-300', true);

            setEl('p-price-unl', '$1,598.00 <span style="font-size: 0.8rem; font-weight: 500; color: #cbd5e1;">MXN/mes</span>');
            setEl('p-iva-unl', 'Subtotal: $1,377.59 + IVA (16%): $220.41 MXN (Incluye ERP +$999)');
            setEl('p-btn-unl', 'Activar Ilimitado + ERP ($1,598 MXN) ➔');
            showEl('p-erp-unl', true);
        } else {
            setEl('p-price-100', '$255.00 <span style="font-size: 0.8rem; font-weight: 500; color: #94a3b8;">MXN/mes</span>');
            setEl('p-iva-100', 'Subtotal: $219.83 + IVA (16%): $35.17 MXN');
            setEl('p-btn-100', 'Renovar Plan 100 ($255 MXN)');
            showEl('p-erp-100', false);

            setEl('p-price-300', '$500.00 <span style="font-size: 0.8rem; font-weight: 500; color: #94a3b8;">MXN/mes</span>');
            setEl('p-iva-300', 'Subtotal: $431.03 + IVA (16%): $68.97 MXN');
            setEl('p-btn-300', 'Subir a 300 Mensajes ($500 MXN)');
            showEl('p-erp-300', false);

            setEl('p-price-unl', '$599.00 <span style="font-size: 0.8rem; font-weight: 500; color: #cbd5e1;">MXN/mes</span>');
            setEl('p-iva-unl', 'Subtotal: $516.38 + IVA (16%): $82.62 MXN');
            setEl('p-btn-unl', 'Activar Plan Ilimitado ($599 MXN) ➔');
            showEl('p-erp-unl', false);
        }
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
        this.token = urlToken || savedCreds.token || '';

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
            if (!document.hidden && this.email && this.token) {
                this.syncStateAndChats(true);
            }
        });

        if (this.email && this.token) {
            this.enterDashboard();
        }
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
        this.enterDashboard();
    },

    enterDashboard: function() {
        const loginBox = document.getElementById('panel-login-box');
        const dash = document.getElementById('panel-dashboard');
        if (loginBox) loginBox.style.display = 'none';
        if (dash) dash.style.display = 'flex';

        if (window.app.state.summary) {
            this.renderSummary(window.app.state.summary);
            this.populateBotConfigForm(window.app.state.summary.botProfile);
        }
        if (window.app.state.chats.length > 0) {
            this.renderChatsList();
        }

        this.syncStateAndChats(true);
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            if (!document.hidden && this.activeTab === 'chats') {
                this.syncStateAndChats(false);
            }
        }, 20000);
    },

    refreshNow: function() {
        if (this.activeTab === 'citas') {
            this.loadAppointments(true);
        } else {
            this.syncStateAndChats(true);
        }
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
        const pCitas = document.getElementById('tab-panel-citas');
        const pConfig = document.getElementById('tab-panel-config');
        const bChats = document.getElementById('tab-btn-chats');
        const bCitas = document.getElementById('tab-btn-citas');
        const bConfig = document.getElementById('tab-btn-config');

        if (pChats) pChats.style.display = tab === 'chats' ? 'grid' : 'none';
        if (pCitas) pCitas.style.display = tab === 'citas' ? 'block' : 'none';
        if (pConfig) pConfig.style.display = tab === 'config' ? 'block' : 'none';

        if (bChats) bChats.className = 'rx-chip-btn' + (tab === 'chats' ? ' cyan' : '');
        if (bCitas) bCitas.className = 'rx-chip-btn' + (tab === 'citas' ? ' cyan' : '');
        if (bConfig) bConfig.className = 'rx-chip-btn' + (tab === 'config' ? ' cyan' : '');

        if (tab === 'citas' && !this.appointmentsLoaded) {
            this.loadAppointments(true);
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

        const container = document.getElementById('cfg-faqs-container');
        if (container && container.children.length === 0) {
            const faqs = Array.isArray(profile.faqs) && profile.faqs.length > 0
                ? profile.faqs
                : [{ keywords: '', answer: '' }];
            faqs.forEach(f => this.addFaqRow(f.keywords, f.answer));
        }
    },

    addFaqRow: function(keywords, answer) {
        const container = document.getElementById('cfg-faqs-container');
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'faq-rule-row';
        row.style = 'display: grid; grid-template-columns: 1fr 2fr auto; gap: 8px; align-items: center;';
        row.innerHTML = `
            <input type="text" class="rx-input faq-kw" placeholder="Palabras clave (ej: tarjeta, factura)" value="${this.escapeHtml(keywords || '')}">
            <input type="text" class="rx-input faq-ans" placeholder="Respuesta exacta del bot..." value="${this.escapeHtml(answer || '')}">
            <button type="button" onclick="this.parentElement.remove()" class="rx-chip-btn" style="color:#fda4af; border-color:#e11d48;">✕</button>
        `;
        container.appendChild(row);
    },

    saveBotConfig: async function(e) {
        if (e) e.preventDefault();
        const btn = document.getElementById('btn-save-bot-config');
        const statusEl = document.getElementById('cfg-save-status');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
        if (statusEl) statusEl.textContent = '';

        const faqs = [];
        document.querySelectorAll('.faq-rule-row').forEach(row => {
            const kw = (row.querySelector('.faq-kw')?.value || '').trim();
            const ans = (row.querySelector('.faq-ans')?.value || '').trim();
            if (kw && ans) faqs.push({ keywords: kw, answer: ans });
        });

        try {
            const res = await this.apiCall({
                action: 'save_bot_config',
                botConfig: {
                    horarios: document.getElementById('cfg-bot-hours')?.value || '',
                    fee: document.getElementById('cfg-bot-fee')?.value || '',
                    direccion: document.getElementById('cfg-bot-address')?.value || '',
                    telefono: document.getElementById('cfg-bot-phone')?.value || '',
                    servicios: document.getElementById('cfg-bot-services')?.value || '',
                    welcomeMessage: document.getElementById('cfg-bot-welcome')?.value || '',
                    extraInfo: document.getElementById('cfg-bot-extra')?.value || '',
                    faqs: faqs
                }
            });
            window.app.state.summary = res.summary;
            if (statusEl) statusEl.textContent = '✓ Información guardada. Tu Bot ya responde con estos datos.';
        } catch (err) {
            alert(err.message || 'No se pudo guardar la configuración.');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Guardar Información del Bot'; }
        }
    },

    loadAppointments: async function(force) {
        const listEl = document.getElementById('panel-appointments-list');
        if (!listEl) return;
        if (force) listEl.innerHTML = '<div style="padding:18px;text-align:center;font-size:0.76rem;color:#94a3b8;">Cargando citas...</div>';
        try {
            const res = await this.apiCall({ action: 'get_appointments' });
            this.appointmentsLoaded = true;
            const appts = res.appointments || [];
            if (appts.length === 0) {
                listEl.innerHTML = '<div style="padding:18px;text-align:center;font-size:0.76rem;color:#64748b;">No hay citas registradas aún. Cuando un cliente solicite cita por WhatsApp aparecerá aquí automáticamente.</div>';
                return;
            }
            listEl.innerHTML = appts.map(a => `
                <div style="background:#040914; border:1px solid rgba(148,163,184,0.2); border-radius:10px; padding:12px 14px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px;">
                    <div>
                        <div style="font-size:0.84rem; font-weight:700; color:#ffffff;">${this.escapeHtml(a.contactName || 'Cliente')} • <span style="color:#00f2ff;">${this.escapeHtml(a.phone || '')}</span></div>
                        <div style="font-size:0.72rem; color:#cbd5e1; margin-top:2px;">${a.dateText ? '📅 ' + this.escapeHtml(a.dateText) + ' — ' : ''}${this.escapeHtml(a.note || '')}</div>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <select onchange="window.app.panel.updateAppointmentStatus('${this.escapeHtml(a.id)}', this.value)" class="rx-input" style="padding:6px 8px; font-size:0.7rem; width:auto;">
                            <option value="pendiente" ${a.status === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="confirmada" ${a.status === 'confirmada' ? 'selected' : ''}>✅ Confirmada</option>
                            <option value="completada" ${a.status === 'completada' ? 'selected' : ''}>🏁 Completada</option>
                            <option value="cancelada" ${a.status === 'cancelada' ? 'selected' : ''}>✕ Cancelada</option>
                        </select>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            listEl.innerHTML = '<div style="padding:18px;text-align:center;font-size:0.76rem;color:#fda4af;">Error cargando citas.</div>';
        }
    },

    createManualAppointment: async function(e) {
        if (e) e.preventDefault();
        try {
            await this.apiCall({
                action: 'save_appointment',
                appointment: {
                    contactName: document.getElementById('appt-new-name')?.value || '',
                    phone: document.getElementById('appt-new-phone')?.value || '',
                    dateText: document.getElementById('appt-new-date')?.value || '',
                    note: document.getElementById('appt-new-note')?.value || '',
                    status: 'confirmada'
                }
            });
            document.getElementById('appt-new-name').value = '';
            document.getElementById('appt-new-phone').value = '';
            document.getElementById('appt-new-date').value = '';
            document.getElementById('appt-new-note').value = '';
            await this.loadAppointments(true);
        } catch (err) {
            alert(err.message || 'No se pudo guardar la cita.');
        }
    },

    updateAppointmentStatus: async function(apptId, status) {
        try {
            await this.apiCall({
                action: 'save_appointment',
                appointment: { id: apptId, status: status }
            });
        } catch (err) {
            alert('Error actualizando estado de la cita.');
        }
    },

    renderConnectionBadge: function(state) {
        const pill = document.getElementById('panel-wa-status-pill');
        if (!pill) return;
        if (state === 'open') {
            pill.textContent = '● WHATSAPP CONECTADO';
            pill.style.borderColor = '#25d366';
            pill.style.color = '#4ade80';
            pill.style.background = 'rgba(37, 211, 102, 0.14)';
        } else {
            pill.textContent = '○ WHATSAPP DESCONECTADO';
            pill.style.borderColor = '#e11d48';
            pill.style.color = '#fda4af';
            pill.style.background = 'rgba(225, 29, 72, 0.14)';
        }
    },

    renderSummary: function(s) {
        if (!s) return;
        const bizEl = document.getElementById('stat-biz-name');
        const folioEl = document.getElementById('stat-folio');
        const planEl = document.getElementById('stat-plan-name');
        const expEl = document.getElementById('stat-expires');
        const quotaEl = document.getElementById('stat-quota-text');
        const barEl = document.getElementById('stat-quota-bar');
        const myWebBtn = document.getElementById('panel-btn-myweb');
        const connectBtn = document.getElementById('panel-btn-conectar');
        const banner = document.getElementById('panel-quota-banner');
        const bannerText = document.getElementById('panel-quota-banner-text');

        if (bizEl) bizEl.textContent = s.negocio || '-';
        if (folioEl) folioEl.textContent = 'Folio: ' + (s.folio || '-');
        if (planEl) planEl.textContent = s.planName || '-';
        if (expEl) {
            expEl.textContent = s.expiresAt
                ? 'Vence: ' + new Date(s.expiresAt).toLocaleDateString('es-MX')
                : 'Vigencia: 30 días';
        }
        if (myWebBtn && s.siteUrl) {
            myWebBtn.href = s.siteUrl;
            myWebBtn.style.display = 'inline-block';
        }
        if (connectBtn) {
            connectBtn.href = 'conectar.html?token=' + encodeURIComponent(this.token) + '&email=' + encodeURIComponent(this.email);
        }

        const count = Number(s.messageCount || 0);
        const limit = Number(s.messageLimit || 100);
        const isUnlimited = Boolean(s.isUnlimited);
        const pct = isUnlimited ? 100 : Math.min(Math.round((count / limit) * 100), 100);

        if (quotaEl) {
            quotaEl.textContent = isUnlimited
                ? count + ' / ILIMITADO'
                : count + ' / ' + limit + ' (' + pct + '%)';
        }
        if (barEl) {
            barEl.style.width = pct + '%';
            barEl.style.background = isUnlimited ? '#25d366' : (pct >= 90 ? '#e11d48' : (pct >= 80 ? '#f59e0b' : '#00f2ff'));
        }

        if (banner && bannerText) {
            if (!s.subscriptionActive || s.status === 'suspended_limit') {
                banner.className = 'rx-alert-banner danger';
                bannerText.innerHTML = '<strong>⛔ SERVICIO SUSPENDIDO:</strong> Alcanzaste el límite de mensajes (' + count + '/' + limit + ') o venció tu ciclo. Renueva o sube al Plan Ilimitado para reactivar tu bot al instante.';
            } else if (!isUnlimited && pct >= 97) {
                banner.className = 'rx-alert-banner danger';
                bannerText.innerHTML = '<strong>🚨 ÚLTIMO AVISO (97%+):</strong> Llevas ' + count + ' de ' + limit + ' mensajes. En el mensaje ' + (limit + 1) + ' se suspenderá el servicio automáticamente.';
            } else if (!isUnlimited && pct >= 90) {
                banner.className = 'rx-alert-banner warn';
                bannerText.innerHTML = '<strong>⚠️ ALERTA 90%:</strong> Llevas ' + count + ' de ' + limit + ' mensajes consumidos. Sube a 300 o Ilimitado antes de quedarte sin bot.';
            } else if (!isUnlimited && pct >= 80) {
                banner.className = 'rx-alert-banner warn';
                bannerText.innerHTML = '<strong>📊 AVISO 80%:</strong> Has usado ' + count + ' de ' + limit + ' mensajes de tu plan mensual.';
            } else {
                banner.className = 'rx-alert-banner';
            }
        }
    },

    renderChatsList: function() {
        const listEl = document.getElementById('panel-chat-list');
        if (!listEl) return;

        const chats = window.app.state.chats || [];
        if (chats.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 0.76rem; color: #64748b;">Aún no hay conversaciones registradas. Cuando recibas mensajes en tu WhatsApp vinculado aparecerán aquí en vivo.</div>';
            return;
        }

        listEl.innerHTML = chats.map(c => {
            const isActive = window.app.state.activeChatId === c.chatId;
            const statusTag = c.manualBotPaused
                ? '<span style="color:#fda4af;font-size:0.6rem;">⏸ Pausado</span>'
                : (c.handoffRemainingSec > 0
                    ? '<span style="color:#fbbf24;font-size:0.6rem;">⏳ Silencio ' + c.handoffRemainingSec + 's</span>'
                    : '<span style="color:#4ade80;font-size:0.6rem;">🤖 Bot 24/7</span>');
            return `
                <div class="rx-chat-item ${isActive ? 'active' : ''}" onclick="window.app.panel.selectChat('${c.chatId}')">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                        <strong style="font-size:0.8rem; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(c.contactName)}</strong>
                        ${statusTag}
                    </div>
                    <div style="font-size:0.7rem; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:3px;">
                        ${this.escapeHtml(c.lastMessage)}
                    </div>
                </div>
            `;
        }).join('');
    },

    selectChat: async function(chatId) {
        window.app.state.activeChatId = chatId;
        this.renderChatsList();

        const chatObj = (window.app.state.chats || []).find(c => c.chatId === chatId);
        const nameEl = document.getElementById('active-chat-name');
        if (nameEl && chatObj) nameEl.textContent = chatObj.contactName;

        const inputEl = document.getElementById('panel-reply-input');
        const sendBtn = document.getElementById('panel-reply-send');
        const isSuspended = window.app.state.summary && !window.app.state.summary.subscriptionActive;
        if (inputEl) inputEl.disabled = Boolean(isSuspended);
        if (sendBtn) sendBtn.disabled = Boolean(isSuspended);

        if (window.app.state.messagesByChat[chatId]) {
            this.renderMessages(window.app.state.messagesByChat[chatId]);
        }
        await this.loadChatMessages(chatId, false);
    },

    loadChatMessages: async function(chatId, silent) {
        try {
            const data = await this.apiCall({ action: 'get_messages', chatId: chatId });
            window.app.state.messagesByChat[chatId] = data.messages || [];
            const msgs = data.messages || [];
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            if (lastMsg && lastMsg.timestampMs) {
                this.lastLoadedChatTs[chatId] = Number(lastMsg.timestampMs);
            }
            if (window.app.state.activeChatId === chatId) {
                this.renderMessages(msgs);
                this.renderChatHandoffHeader(data.chatMeta);
            }
        } catch (err) {
            if (!silent) console.warn('Error cargando mensajes:', err.message);
        }
    },

    renderChatHandoffHeader: function(meta) {
        const handoffEl = document.getElementById('active-chat-handoff');
        const toggleBtn = document.getElementById('btn-toggle-chat-bot');
        if (!meta) return;

        if (toggleBtn) {
            toggleBtn.style.display = 'inline-block';
            toggleBtn.dataset.paused = meta.manualBotPaused ? '1' : '0';
            toggleBtn.textContent = meta.manualBotPaused ? 'Reactivar Bot' : 'Pausar Bot';
        }
        if (handoffEl) {
            if (meta.manualBotPaused) {
                handoffEl.textContent = '⏸ Bot pausado manualmente en este chat.';
                handoffEl.style.color = '#fda4af';
            } else if (meta.handoffRemainingSec > 0) {
                handoffEl.textContent = '⏳ Modo Silencioso (Humano activo): Bot retomará si hay 2 min de pausa (' + meta.handoffRemainingSec + 's).';
                handoffEl.style.color = '#fbbf24';
            } else {
                handoffEl.textContent = '🤖 Bot activo 24/7 (contesta automáticamente si tú no respondes).';
                handoffEl.style.color = '#4ade80';
            }
        }
    },

    renderMessages: function(messages) {
        const bodyEl = document.getElementById('active-chat-messages');
        if (!bodyEl) return;

        if (!messages || messages.length === 0) {
            bodyEl.innerHTML = '<div style="margin:auto; color:#64748b; font-size:0.78rem;">Sin mensajes en este chat aún.</div>';
            return;
        }

        bodyEl.innerHTML = messages.map(m => {
            const cls = m.sender === 'bot' ? 'bot' : (m.sender === 'human' ? 'human' : 'customer');
            const label = m.sender === 'bot' ? '🤖 Bot Automático' : (m.sender === 'human' ? '👤 Tú (Dueño)' : 'Cliente');
            const timeStr = m.timestampMs ? new Date(m.timestampMs).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div class="rx-bubble ${cls}">
                    <div>${this.escapeHtml(m.text)}</div>
                    <span class="rx-bubble-meta">${label} • ${timeStr}</span>
                </div>
            `;
        }).join('');

        bodyEl.scrollTop = bodyEl.scrollHeight;
    },

    sendManualReply: async function(e) {
        if (e) e.preventDefault();
        const chatId = window.app.state.activeChatId;
        const inputEl = document.getElementById('panel-reply-input');
        const sendBtn = document.getElementById('panel-reply-send');
        if (!chatId || !inputEl) return;

        const text = inputEl.value.trim();
        if (!text) return;

        if (/\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(text)) {
            alert('El envío de videos está prohibido en este plan.');
            return;
        }

        inputEl.disabled = true;
        if (sendBtn) sendBtn.disabled = true;

        try {
            const res = await this.apiCall({
                action: 'send_manual_reply',
                chatId: chatId,
                text: text
            });
            inputEl.value = '';
            if (res.summary) {
                window.app.state.summary = res.summary;
                this.renderSummary(res.summary);
            }
            await this.loadChatMessages(chatId, false);
        } catch (err) {
            alert(err.message || 'No se pudo enviar tu mensaje.');
        } finally {
            const isSuspended = window.app.state.summary && !window.app.state.summary.subscriptionActive;
            inputEl.disabled = Boolean(isSuspended);
            if (sendBtn) sendBtn.disabled = Boolean(isSuspended);
            if (!isSuspended) inputEl.focus();
        }
    },

    toggleChatBot: async function() {
        const chatId = window.app.state.activeChatId;
        const toggleBtn = document.getElementById('btn-toggle-chat-bot');
        if (!chatId || !toggleBtn) return;

        const currentlyPaused = toggleBtn.dataset.paused === '1';
        try {
            await this.apiCall({
                action: 'toggle_chat_bot',
                chatId: chatId,
                paused: !currentlyPaused
            });
            await this.loadChatMessages(chatId, false);
            await this.syncStateAndChats();
        } catch (err) {
            alert('No se pudo cambiar el estado del bot.');
        }
    },

    openStripePlan: function(planTag) {
        const finalTag = this.panelErpMode ? (planTag + '_ERP') : planTag;
        const baseLink = this.stripePlans[finalTag] || this.stripePlans[planTag];
        const s = window.app.state.summary || {};
        const folio = s.folio || 'RENOVACION';
        const negocio = s.negocio || 'Cliente';
        const ref = folio + '__' + encodeURIComponent(this.email) + '__' + encodeURIComponent(negocio) + '__' + finalTag;
        const sep = baseLink.includes('?') ? '&' : '?';
        const finalUrl = baseLink + sep + 'prefilled_email=' + encodeURIComponent(this.email) + '&client_reference_id=' + encodeURIComponent(ref);
        window.open(finalUrl, '_blank');
    },

    logout: function() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        localStorage.removeItem('rx_wa_credentials');
        localStorage.removeItem('rx_panel_chats_cache');
        window.location.href = 'index.html';
    },

    escapeHtml: function(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.app.panel.init();
});