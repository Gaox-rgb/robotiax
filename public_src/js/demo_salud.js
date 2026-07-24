// public_src/js/demo_salud.js

window.app = window.app || {};

window.app.demo = {
    chatHistory: [],
    currentStep: 0,
    userXp: 0,
    currentTriviaQuestion: 0,
    coachStep: 0,

    // IMÁGENES ANIMADAS Y QUIRKY PARA LA DEMO INTERACTIVA (16:9)
    // Controlador de Combinaciones de Paleta de Colores en Caliente
    setTheme: function(themeName) {
        const root = document.documentElement;
        if (themeName === 'blue') {
            root.style.setProperty('--bg-page', '#abc8e2');
            root.style.setProperty('--bg-container', '#d6e6f2');
            root.style.setProperty('--bg-subcard', '#f7fbfe');
            root.style.setProperty('--color-text', '#0a1128');
            root.style.setProperty('--color-text-secondary', '#334155');
            root.style.setProperty('--border-container', 'rgba(15, 23, 42, 0.08)');
            root.style.setProperty('--crt-bg', '#09141f');
            root.style.setProperty('--crt-text', '#38bdf8');
            root.style.setProperty('--crt-border', 'rgba(56, 189, 248, 0.2)');
        } else if (themeName === 'green') {
            root.style.setProperty('--bg-page', '#a7f3d0');
            root.style.setProperty('--bg-container', '#d1fae5');
            root.style.setProperty('--bg-subcard', '#f0fdf4');
            root.style.setProperty('--color-text', '#064e3b');
            root.style.setProperty('--color-text-secondary', '#047857');
            root.style.setProperty('--border-container', 'rgba(6, 78, 59, 0.08)');
            root.style.setProperty('--crt-bg', '#062f21');
            root.style.setProperty('--crt-text', '#34d399');
            root.style.setProperty('--crt-border', 'rgba(52, 211, 153, 0.2)');
        } else if (themeName === 'pink') {
            root.style.setProperty('--bg-page', '#fecdd3');
            root.style.setProperty('--bg-container', '#ffe4e6');
            root.style.setProperty('--bg-subcard', '#fff1f2');
            root.style.setProperty('--color-text', '#881337');
            root.style.setProperty('--color-text-secondary', '#be123c');
            root.style.setProperty('--border-container', 'rgba(136, 19, 55, 0.08)');
            root.style.setProperty('--crt-bg', '#4c0519');
            root.style.setProperty('--crt-text', '#fda4af');
            root.style.setProperty('--crt-border', 'rgba(253, 164, 175, 0.2)');
        } else if (themeName === 'purple') {
            root.style.setProperty('--bg-page', '#e9d5ff');
            root.style.setProperty('--bg-container', '#f3e8ff');
            root.style.setProperty('--bg-subcard', '#faf5ff');
            root.style.setProperty('--color-text', '#581c87');
            root.style.setProperty('--color-text-secondary', '#7e22ce');
            root.style.setProperty('--border-container', 'rgba(88, 28, 135, 0.08)');
            root.style.setProperty('--crt-bg', '#2e1065');
            root.style.setProperty('--crt-text', '#d8b4fe');
            root.style.setProperty('--crt-border', 'rgba(216, 180, 254, 0.2)');
        }
    },

    cinematicPhotos: [
        {
            url: "assets/frenzy_1.webp",
            caption: "Conoce nuestras instalaciones"
        },
        {
            url: "assets/frenzy_2.webp",
            caption: "Los pacientes satisfechos son nuestra prioridad"
        },
        {
            url: "assets/frenzy_3.webp",
            caption: "Un profesional no teme a la tecnología: la usa"
        }
    ],

    currentIndex: 0,
    slideshowInterval: null,

    // Inicialización con automatización secuencial cada 3 segundos (3000ms)
    initCinematicViewer: function() {
        this.changeCinematicPhoto(0, true);
        
        if (this.slideshowInterval) {
            clearInterval(this.slideshowInterval);
        }
        
        this.slideshowInterval = setInterval(() => {
            this.currentIndex = (this.currentIndex + 1) % this.cinematicPhotos.length;
            this.changeCinematicPhoto(this.currentIndex, false);
        }, 3000);
    },

    // Pool de Preguntas de la Consola de la Sala de Espera de Aura-Clinic
    mainTriviaPool: [
        { q: "¿Cada cuánto tiempo se aconseja agendar una consulta clínica de control preventivo?", a: "6 meses", b: "5 años", correct: 'a' },
        { q: "¿Qué hábito reduce de forma más rápida el cortisol y el estrés en el sistema nervioso?", a: "Dormir 8 horas", b: "Tomar café", correct: 'a' },
        { q: "¿Qué tipo de ácidos grasos protegen tu corazón y limpian tus arterias?", a: "Omega 3", b: "Grasas Trans", correct: 'a' }
    ],

    mainTriviaIndex: 0,

    typewriterTimeout: null,

    // Motor Máquina de Escribir (Typewriter) Saneado con Limpieza de Desborde
    typeWriter: function(element, text, callback, speed = 25) {
        if (this.typewriterTimeout) {
            clearTimeout(this.typewriterTimeout);
        }
        element.textContent = "";
        let i = 0;
        const type = () => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                this.typewriterTimeout = setTimeout(type, speed);
            } else if (callback) {
                callback();
            }
        };
        type();
    },

    // Carga de la Pregunta Activa en el Monitor CRT Principal
    loadMainTriviaQuestion: function(immediate = false) {
        const textEl = document.getElementById('type-text-main');
        const btnContainer = document.getElementById('btn-container-main');
        const scoreEl = document.getElementById('score-counter-main');

        if (!textEl || !btnContainer || !scoreEl) return;

        scoreEl.textContent = `${this.mainTriviaIndex}/3 RETOS`;

        // Si se completaron las 3 preguntas
        if (this.mainTriviaIndex >= 3) {
            textEl.innerHTML = "RETOS COMPLETADOS ✓";
            btnContainer.innerHTML = `<button onclick="window.app.demo.openSuccessPopup()" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black py-2 rounded-xl uppercase tracking-wider animate-bounce">⚡ VER PREMIO</button>`;
            return;
        }

        const currentData = this.mainTriviaPool[this.mainTriviaIndex];
        btnContainer.innerHTML = ""; // Vaciar botones durante el efecto de tipografía

        if (immediate) {
            textEl.textContent = currentData.q;
            this.renderMainTriviaButtons(currentData);
        } else {
            this.typeWriter(textEl, currentData.q, () => {
                this.renderMainTriviaButtons(currentData);
            });
        }
    },

    renderMainTriviaButtons: function(currentData) {
        const btnContainer = document.getElementById('btn-container-main');
        if (!btnContainer) return;
        btnContainer.innerHTML = `
            <button onclick="window.app.demo.checkMainTriviaAnswer('a')" class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 py-1.5 px-3 rounded-xl text-[9px] font-bold text-slate-200 transition-all uppercase">A: ${currentData.a}</button>
            <button onclick="window.app.demo.checkMainTriviaAnswer('b')" class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 py-1.5 px-3 rounded-xl text-[9px] font-bold text-slate-200 transition-all uppercase">B: ${currentData.b}</button>
        `;
    },

    checkMainTriviaAnswer: function(chosen) {
        const currentData = this.mainTriviaPool[this.mainTriviaIndex];
        const textEl = document.getElementById('type-text-main');
        const btnContainer = document.getElementById('btn-container-main');

        if (chosen === currentData.correct) {
            this.mainTriviaIndex++; // Se incrementa para apuntar a la siguiente pregunta
            
            // Si se acaba de responder correctamente el tercer reto (Index ahora es 3)
            if (this.mainTriviaIndex >= 3) {
                textEl.innerHTML = "¡EXCELENTE! RETOS COMPLETADOS ✓";
                btnContainer.innerHTML = "";
                
                // Actualizar marcador de retos antes de abrir la modal
                const scoreEl = document.getElementById('score-counter-main');
                if (scoreEl) scoreEl.textContent = "3/3 RETOS";

                setTimeout(() => {
                    this.openSuccessPopup();
                    this.loadMainTriviaQuestion(true); // Carga estado final limpio
                }, 1500);
                return;
            }

            // Transición intermedia suave para preguntas 1 y 2
            textEl.innerHTML = "¡CORRECTO! +50 XP";
            btnContainer.innerHTML = "";
            setTimeout(() => {
                this.loadMainTriviaQuestion(false);
            }, 1200);
        } else {
            textEl.innerHTML = "INCORRECTO. RE-INTENTANDO...";
            btnContainer.innerHTML = "";
            setTimeout(() => {
                this.loadMainTriviaQuestion(true);
            }, 1500);
        }
    },

    openSuccessPopup: function() {
        const overlay = document.getElementById('success-popup-overlay');
        if (overlay) {
            overlay.style.setProperty('display', 'flex', 'important');
        } else {
            // Redirección directa al flujo de conversión si el overlay dedicado no está en el DOM
            this.openCloserModal();
        }
    },

    closeSuccessPopup: function() {
        const overlay = document.getElementById('success-popup-overlay');
        if (overlay) {
            overlay.style.setProperty('display', 'none', 'important');
        } else {
            this.closeCloserModal();
        }
    },

    triggerAffiliateDemo: function() {
        alert("👥 ORBE DE AFILIADOS INCRUSTADO:\nInyectando el Orbe de Redes de Afiliados de Makumoto a través de un Iframe seguro en la página.\nTu paciente invita contactos y genera comisiones de consulta sin salir del sitio web.");
    },

    triggerVideoDemo: function() {
        window.open('https://makumoto.com/videos-salud', '_blank');
    },

    // Lógica del visualizador con Autofoco dinámico integrado
    changeCinematicPhoto: function(index, immediate = false) {
        const mainPhoto = document.getElementById('cinematic-main-photo');
        const caption = document.getElementById('cinematic-caption-text');

        if (!mainPhoto || !caption || !this.cinematicPhotos[index]) return;

        if (immediate) {
            mainPhoto.src = this.cinematicPhotos[index].url;
            caption.textContent = this.cinematicPhotos[index].caption;
            return;
        }

        // Desenfoque de lente de cámara (Autofoco dinámico)
        mainPhoto.classList.add('lens-blur-active');

        setTimeout(() => {
            mainPhoto.src = this.cinematicPhotos[index].url;
            caption.textContent = this.cinematicPhotos[index].caption;
            
            setTimeout(() => {
                mainPhoto.classList.remove('lens-blur-active');
            }, 100);
        }, 250);
    },

    // COOPERA CON MULTI-TENANT PARA SUBDOMINIOS DE IKAI.INFO
    initMultiTenant: async function() {
        const hostname = window.location.hostname;
        
        if (hostname.endsWith('ikai.info') && hostname !== 'ikai.info') {
            const parts = hostname.split('.');
            const clientSlug = parts[0].toLowerCase().trim();
            console.log(`📡 [MULTI-TENANT]: Sincronizando subdominio '${clientSlug}'...`);
            
            const coach = document.getElementById('interactive-coach-bar');
            if (coach) coach.style.setProperty('display', 'none', 'important');

            try {
                const querySnapshot = await db.collection('orders_to_fulfill')
                    .where('negocio_slug', '==', clientSlug)
                    .limit(1).get();

                if (!querySnapshot.empty) {
                    const clientData = querySnapshot.docs[0].data();
                    this.applyClientBranding(clientData);
                }
            } catch (error) {
                console.error("❌ Error en expediente de Firestore:", error.message);
            }
        }
    },

    applyClientBranding: function(data) {
        const titleEl = document.getElementById('clinic-title');
        const descEl = document.getElementById('clinic-desc');
        const addressEl = document.getElementById('meta-val-1');
        const hoursEl = document.getElementById('meta-val-2');
        const phoneEl = document.getElementById('meta-val-3');
        const feeEl = document.getElementById('meta-val-4');

        if (titleEl && data.negocio) titleEl.innerHTML = `${data.negocio} <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500 italic font-light">${data.tagline || 'Evolución'}</span>`;
    if (descEl && data.headline) descEl.textContent = data.headline;
    if (addressEl && data.direccion) addressEl.textContent = data.direccion;
    if (hoursEl && data.horarios) hoursEl.textContent = data.horarios;
    if (phoneEl && data.telefono) phoneEl.textContent = data.telefono;
    if (feeEl && data.fee) feeEl.textContent = data.fee;

    // Vinculación dinámica del botón de reservas de cabecera con el teléfono del inquilino
    const headerWaBtn = document.getElementById('header-whatsapp-btn');
    if (headerWaBtn && data.telefono) {
        const cleanPhone = data.telefono.replace(/\D/g, '');
        const textMsg = encodeURIComponent(`Hola ${data.negocio || 'Doctor'}. Me interesa agendar una consulta médica.`);
        headerWaBtn.setAttribute('onclick', `window.open('https://wa.me/${cleanPhone}?text=${textMsg}', '_blank')`);
    }
},

    // PASOS DEL TUTORIAL DE DISECCIÓN Y ENFOQUE GLOBAL
    coachStepsData: [
        {
            title: "Pilar 1: Tus Datos Clínicos",
            desc: "Tus pacientes verán tu información oficial unificada en un solo lugar: consultorios físicos, horarios activos, costo de consulta y número directo de WhatsApp sincronizados.",
            targetId: "clinic-metadata-strip"
        },
        {
            title: "Pilar 2: Captura en Piloto Automático",
            desc: "Pruébalo ahora mismo pulsando el **botón de WhatsApp flotante abajo a la derecha**. Tu bot agendará citas directamente sin requerir personal de secretaría.",
            targetId: "btn-wa-floating"
        },
        {
            title: "Pilar 3: Fidelización QR de Sala de Espera",
            desc: "El paciente escanea este código desde la sala de espera física para jugar trivias, disminuyendo un 80% su ansiedad y ganando puntos de lealtad en tu consultorio.",
            targetId: "qr-promo-section"
        },
        {
            title: "Pilar 4: Módulos de Conversión Premium",
            desc: "E-Shop, Bio-Tracker y Campañas de Anuncios están integrados de forma orgánica. Puedes activarlos o escalarlos respondiendo a nuestro correo de bienvenida en cualquier momento.",
            targetId: "upsell-tracker-section"
        }
    ],

    startGuidedTour: function() {
        this.coachStep = 0;
        const coach = document.getElementById('interactive-coach-bar');
        const backdrop = document.getElementById('tutorial-backdrop-overlay');
        
        if (coach) coach.classList.remove('hidden');
        if (backdrop) backdrop.classList.remove('hidden');
        
        this.loadCoachStep(1);
    },

    loadCoachStep: function(stepNum) {
        this.coachStep = stepNum;
        this.clearHighlights();

        const data = this.coachStepsData[stepNum - 1];
        if (!data) return;

        const stepTag = document.getElementById('coach-step-tag');
        const stepTitle = document.getElementById('coach-step-title');
        const stepDesc = document.getElementById('coach-step-desc');
        const nextBtn = document.getElementById('btn-coach-next');

        if (stepTag) stepTag.textContent = `PASO ${stepNum} / 4`;
        if (stepTitle) stepTitle.textContent = data.title;
        if (stepDesc) stepDesc.innerHTML = data.desc;

        if (nextBtn) {
            nextBtn.textContent = (stepNum === 4) ? "FINALIZAR RUTA ✓" : "ENTENDIDO, SIGUIENTE";
        }

        const dotsContainer = document.getElementById('coach-progress-dots');
        if (dotsContainer) {
            dotsContainer.innerHTML = '';
            for (let i = 1; i <= 4; i++) {
                const dot = document.createElement('span');
                dot.className = `w-2 h-2 rounded-full ${i === stepNum ? 'bg-white' : 'bg-white/40'}`;
                dotsContainer.appendChild(dot);
            }
        }

        // AISLAMIENTO VISUAL POR DISECCIÓN
        const targetElement = document.getElementById(data.targetId);
        if (targetElement) {
            targetElement.classList.add('tutorial-focus-highlight');
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    nextCoachStep: function() {
        if (this.coachStep < 4) {
            this.loadCoachStep(this.coachStep + 1);
        } else {
            this.skipCoaching();
        }
    },

    skipCoaching: function() {
        this.clearHighlights();
        const coachBar = document.getElementById('interactive-coach-bar');
        const backdrop = document.getElementById('tutorial-backdrop-overlay');
        if (coachBar) coachBar.classList.add('hidden');
        if (backdrop) backdrop.classList.add('hidden');
        this._showToast("EXPLORACIÓN DEL SITIO DISPONIBLE.");
    },

    clearHighlights: function() {
        this.coachStepsData.forEach(step => {
            const el = document.getElementById(step.targetId);
            if (el) {
                el.classList.remove('tutorial-focus-highlight');
            }
        });
    },

    // CONTROL DEL CHAT FLOTANTE DE WHATSAPP (SISTEMA DE INTERACCIÓN REAL)
toggleWhatsAppWidget: function() {
    const widget = document.getElementById('whatsapp-chat-widget');
    const introModal = document.getElementById('whatsapp-simulation-intro-modal');
    if (!widget) return;

    if (!widget.classList.contains('hidden')) {
        widget.classList.add('hidden');
    } else {
        if (introModal) {
            introModal.style.setProperty('display', 'flex', 'important');
        } else {
            this.openWhatsAppDirectly();
        }
    }
},

closeWhatsAppIntro: function() {
    const introModal = document.getElementById('whatsapp-simulation-intro-modal');
    if (introModal) {
        introModal.style.setProperty('display', 'none', 'important');
    }
},

confirmStartWhatsAppSimulation: function() {
    this.closeWhatsAppIntro();
    this.openWhatsAppDirectly();
},

openWhatsAppDirectly: function() {
    const widget = document.getElementById('whatsapp-chat-widget');
    if (!widget) return;
    widget.classList.remove('hidden');
    const historyEl = document.getElementById('whatsapp-chat-history');
    if (historyEl && historyEl.children.length === 0) {
        this.startChatFlow('init');
    }
},

    startChatFlow: function(startingMode = 'init') {
        const historyEl = document.getElementById('whatsapp-chat-history');
        const actionsEl = document.getElementById('chat-button-container');
        if (!historyEl || !actionsEl) return;

        historyEl.innerHTML = '';
        actionsEl.innerHTML = '';

        if(startingMode === 'init') {
            this.chatHistory = [
                { sender: 'bot', text: '¡Hola! Bienvenido al asistente de Aura-Clinic del Dr. Alejandro Morales. 🩺' },
                { sender: 'bot', text: 'Soy tu Bot automatizado en WhatsApp. ¿Qué te gustaría hacer hoy?' }
            ];
            this._renderHistory();
            this._renderActions([
                { text: '📅 Agendar una Cita', action: () => this.startChatFlow('agendar') },
                { text: '💲 Precios de Consulta', action: () => this.simulateInfo('precios') },
                { text: '📍 Ubicación del Consultorio', action: () => this.simulateInfo('ubicacion') }
            ]);
        } else if (startingMode === 'agendar') {
            this.chatHistory = [
                { sender: 'bot', text: 'Excelente. Reservaremos tu cita médica en tiempo real.' },
                { sender: 'bot', text: 'Por favor, selecciona qué tipo de consulta requieres:' }
            ];
            this._renderHistory();
            this._renderActions([
                { text: '🩺 Cita Nutrición Estética ($800 MXN)', action: () => this.processScheduling('Nutrición Estética') },
                { text: '🧠 Cita Ansiedad y Estrés ($800 MXN)', action: () => this.processScheduling('Terapia Ansiedad y Estrés') }
            ]);
        }
    },

    simulateInfo: function(type) {
        this._showTypingIndicator();
        setTimeout(() => {
            this._removeTypingIndicator();
            if (type === 'precios') {
                this.chatHistory.push({ sender: 'bot', text: 'La consulta médica presencial o en línea con el especialista tiene un precio base de $800 MXN.' });
            } else if (type === 'ubicacion') {
                this.chatHistory.push({ sender: 'bot', text: 'Nos ubicamos en el Corporativo de Especialidades Médicas, Consultorio 402, CDMX.' });
            }
            this._renderHistory();
            this._renderActions([
                { text: '📅 Agendar Cita ahora', action: () => this.startChatFlow('agendar') },
                { text: '↩️ Volver al Inicio', action: () => this.startChatFlow('init') }
            ]);
        }, 800);
    },

    processScheduling: function(serviceName) {
        this.chatHistory.push({ sender: 'user', text: `Solicitud: ${serviceName}` });
        this._renderHistory();
        this._showTypingIndicator();

        setTimeout(() => {
            this._removeTypingIndicator();
            this.chatHistory.push({ sender: 'bot', text: `¡Tu cita para ${serviceName} ha sido agendada con éxito para mañana a las 11:00 AM!` });
            this.chatHistory.push({ sender: 'bot', text: 'Hemos guardado tu cita directamente en la base de datos de la clínica. ⚡' });
            this.chatHistory.push({ sender: 'bot', text: 'Para reducir tu espera en sala, puedes sintonizar las trivias de nuestra clínica y acumular puntos de descuento:' });
            this._renderHistory();

            // Sincronización en tiempo real de métrica clínica en el Dashboard
        const kpi = document.getElementById('kpi-citas-agendadas');
        if (kpi) kpi.textContent = "13 Exitosas";

        this._renderActions([
            { text: 'Terminación de la simulación básica, seguir explorando', action: () => {
                this.toggleWhatsAppWidget();
                this._showToast("SIMULACIÓN BÁSICA FINALIZADA.");
            }}
        ]);
    }, 1000);
},

    // SECCIÓN DE JUEGOS TRIVIA QR (SALA DE ESPERA DE MAKUMOTO)
    startMakumotoFlow: function() {
        const makuPanel = document.getElementById('makumoto-interactive-panel');
        if (makuPanel) {
            makuPanel.classList.remove('hidden');
            this.loadTriviaQuestion(0);
        }
    },

    closeMakumotoFlow: function() {
        const makuPanel = document.getElementById('makumoto-interactive-panel');
        if (makuPanel) makuPanel.classList.add('hidden');
    },

    triviaPool: [
        {
            q: "¿Cada cuánto tiempo se recomienda visitar al dentista o nutriólogo para un control preventivo?",
            options: [
                { t: "Cada 6 meses", correct: true },
                { t: "Una vez al año", correct: false },
                { t: "Sólo cuando sienta dolor o molestia", correct: false }
            ]
        },
        {
            q: "¿Cuál de estos hábitos reduce de forma más efectiva la hormona del estrés (cortisol)?",
            options: [
                { t: "Tener una rutina de sueño constante de 8 horas", correct: true },
                { t: "Tomar tres tazas de café al día", correct: false },
                { t: "Revisar redes sociales antes de acostarse", correct: false }
            ]
        }
    ],

    loadTriviaQuestion: function(index) {
        this.currentTriviaQuestion = index;
        const qArea = document.getElementById('makumoto-game-area');
        if (!qArea) return;
        
        if (index >= this.triviaPool.length) {
            qArea.innerHTML = `
                <div class="text-center space-y-3">
                    <span class="text-[10px] font-['Orbitron'] text-emerald-600 tracking-widest font-bold block">[ DESAFÍO COMPLETADO ]</span>
                    <h3 class="font-extrabold text-slate-900 text-sm">¡Excelente desempeño preventivo!</h3>
                    <p class="text-xs text-slate-500">Has acumulado puntos para tu expediente médico. Abriendo propuesta de servicio...</p>
                </div>
            `;
            
            setTimeout(() => {
                this.closeMakumotoFlow();
                this.openCloserModal();
            }, 1800);
            return;
        }

        const data = this.triviaPool[index];
        qArea.innerHTML = `
            <div class="space-y-4">
                <span class="text-[10px] font-['Orbitron'] text-blue-600 tracking-widest font-bold block">RETO DE PREVENCIÓN ACTIVO</span>
                <p class="text-xs font-bold text-slate-800 leading-snug" id="trivia-question-title">${data.q}</p>
                <div class="space-y-2" id="trivia-options-wrapper"></div>
            </div>
        `;

        const wrapper = document.getElementById('trivia-options-wrapper');
        data.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = "w-full text-left bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-all text-xs font-medium";
            btn.textContent = opt.t;
            btn.onclick = () => this.checkTriviaAnswer(opt.correct);
            wrapper.appendChild(btn);
        });
    },

    checkTriviaAnswer: function(isCorrect) {
        if(isCorrect) {
            this.userXp += 50;
            const xpCounter = document.getElementById('maku-xp-counter');
            if (xpCounter) xpCounter.textContent = `${this.userXp} XP`;
            this._showToast("¡RESPUESTA CORRECTA! +50 XP");
            this.loadTriviaQuestion(this.currentTriviaQuestion + 1);
        } else {
            this._showToast("RESPUESTA INCORRECTA. INTENTA DE NUEVO.");
        }
    },

    completeWaterMission: function() {
        const fillBar = document.getElementById('mission-water-bar');
        const btn = document.getElementById('btn-water-mission');
        const xpCounter = document.getElementById('maku-xp-counter');
        
        if (fillBar) fillBar.style.width = '100%';
        if (btn) {
            btn.textContent = "COMPLETADO ✓";
            btn.disabled = true;
            btn.style.background = "#10b981";
        }

        this.userXp += 100;
        if (xpCounter) xpCounter.textContent = `${this.userXp} XP`;
        this._showToast("¡MISIÓN COMPLETADA! +100 XP");
    },

    // GESTIÓN DE UP-SELLS DULCIFICADOS (MÓDULOS OPCIONALES)
    triggerUpsell: function(moduleName) {
        const modNameEl = document.getElementById('upsell-module-name');
        const modal = document.getElementById('upsell-modal-overlay');
        
        if (modNameEl) modNameEl.textContent = moduleName;
        if (modal) modal.style.setProperty('display', 'flex', 'important');
    },

    closeUpsellModal: function() {
        const modal = document.getElementById('upsell-modal-overlay');
        if (modal) modal.style.setProperty('display', 'none', 'important');
    },

    submitUpsellRequest: function() {
        const modNameEl = document.getElementById('upsell-module-name');
        const mod = modNameEl ? modNameEl.textContent : "Módulo Especializado";
        this.closeUpsellModal();
        alert(`🚀 SOLICITUD ENVIADA CON ÉXITO.\nHemos registrado tu interés de integración de cortesía para el módulo: ${mod}.\nUn Ingeniero de Robotiax se pondrá en contacto contigo en tu correo.`);
    },

    // GESTIÓN DEL MODAL DE CIERRE COMERCIAL
    openCloserModal: function() {
        const closer = document.getElementById('closer-modal-overlay');
        if (closer) closer.style.setProperty('display', 'flex', 'important');
    },

    closeCloserModal: function() {
        const closer = document.getElementById('closer-modal-overlay');
        if (closer) closer.style.setProperty('display', 'none', 'important');
    },

    // DISPARADOR TRANSACCIONAL DE ROBOTIAX
    triggerPaymentFlow: function() {
        this.closeCloserModal();
        window.app = window.app || {};
        window.app.vault = 'RBX-PRT-99-MXN-SECURE-2025';

        const proceed = () => {
            if (window.app.payments && window.app.payments.openModal) {
                window.app.payments.openModal('cfg-salud-bot-promo', 'Bot de Salud - Promo Lanzamiento', 200, 'MXN');
            } else {
                this._showToast("CONECTANDO DIRECTAMENTE CON PAYPAL...");

                fetch('https://createpaypalorder-bh64qprvqa-uc.a.run.app', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Robotiax-Token': 'RBX-PRT-99-MXN-SECURE-2025'
                    },
                    body: JSON.stringify({
                        productId: 'cfg-salud-bot-promo',
                        fundingType: 'paypal',
                        price: 200,
                        currency: 'MXN',
                        returnUrl: window.location.origin + window.location.pathname
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.approveUrl) {
                        localStorage.setItem('pending_purchase_id', 'cfg-salud-bot-promo');
                        window.location.href = data.approveUrl;
                    } else {
                        throw new Error("ID de orden ausente.");
                    }
                })
                .catch(err => {
                    console.error("Fallo crítico en pasarela:", err);
                    alert("Error en conexión con PayPal. Intenta de nuevo.");
                });
            }
        };

        if (!window.app.payments) {
            const script = document.createElement('script');
            script.src = 'js/payments.js';
            script.onload = () => { setTimeout(proceed, 200); };
            script.onerror = () => { proceed(); };
            document.head.appendChild(script);
        } else {
            proceed();
        }
    },

    // AUXILIARES
    _renderHistory: function() {
        const historyEl = document.getElementById('whatsapp-chat-history');
        if (!historyEl) return;
        historyEl.innerHTML = '';
        this.chatHistory.forEach(msg => {
            const row = document.createElement('div');
            row.className = msg.sender === 'bot' 
                ? 'self-start bg-white text-slate-800 p-2.5 rounded-r-xl rounded-bl-xl max-w-[85%] leading-normal shadow-sm border border-slate-100'
                : 'self-end bg-[#d9fdd3] text-slate-800 p-2.5 rounded-l-xl rounded-tr-xl max-w-[85%] leading-normal shadow-sm';
            row.textContent = msg.text;
            historyEl.appendChild(row);
        });
        historyEl.scrollTop = historyEl.scrollHeight;
    },

    _renderActions: function(actions) {
        const container = document.getElementById('chat-button-container');
        if (!container) return;
        container.innerHTML = '';
        actions.forEach(act => {
            const btn = document.createElement('button');
            btn.className = "w-full bg-[#128c7e] text-white font-bold py-2 rounded-lg text-center hover:scale-[1.01] transition-all text-[10px]";
            btn.textContent = act.text;
            btn.onclick = () => act.action();
            container.appendChild(btn);
        });
    },

    _showTypingIndicator: function() {
        const historyEl = document.getElementById('whatsapp-chat-history');
        if (!historyEl) return;
        const row = document.createElement('div');
        row.id = 'typing-indicator-node';
        row.className = 'self-start bg-white text-[#075e54] p-2.5 rounded-r-xl rounded-bl-xl max-w-[85%] typing-dots font-bold border border-slate-100';
        row.textContent = 'Escribiendo';
        historyEl.appendChild(row);
        historyEl.scrollTop = historyEl.scrollHeight;
    },

    _removeTypingIndicator: function() {
        const indicator = document.getElementById('typing-indicator-node');
        if (indicator) indicator.remove();
    },

    _showToast: function(msg) {
        const toast = document.createElement('div');
        toast.className = 'simulator-toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }
};

// Autoejecución al cargar
document.addEventListener('DOMContentLoaded', () => {
    const hostname = window.location.hostname;
    if (hostname.endsWith('ikai.info') && hostname !== 'ikai.info') {
        window.app.demo.initMultiTenant();
    }
// Inicializar el monitor de la trivia secuencial de la sala de espera
    if (window.app.demo && typeof window.app.demo.loadMainTriviaQuestion === 'function') {
        window.app.demo.loadMainTriviaQuestion(false);
    }
    // Inicializar el carrusel de imágenes cinemático en bucle automático
    if (window.app.demo && typeof window.app.demo.initCinematicViewer === 'function') {
        window.app.demo.initCinematicViewer();
    }
});