// public_src/js/demo_salud.js

window.app = window.app || {};

window.app.demo = {
    chatHistory: [],
    currentStep: 0,
    userXp: 0,
    currentTriviaQuestion: 0,
    coachStep: 0,
    
    // Configuración del Loop Arcade "Va y Ven"
    notifLoopInterval: null,
    currentNicheId: 'salud',
    activeActState: 1, // 1 = Acto I (Standby/Blur/Red), 2 = Acto II (Aclarado/ENTRAR)
    notifIndex: 0,

    // Diccionario de los 22 Loops Humorísticos de Marca Blanca
    humorPool: {
        "salud": [
            { "title": "🚨 ALERTA DE DIETA", "desc": "El paciente Juan intentó saltarse la dieta con 3 tacos de pastor. El Bot lo detectó y le restó 50 XP. 🌮" },
            { "title": "🩺 RECETA DEL DOCTOR", "desc": "El Dr. Morales te recetó dormir 8 horas... o ver memes de gatitos en silencio. Tu decisión. 🛌" },
            { "title": "📉 RADAR DE CORTISOL", "desc": "Advertencia: Tu nivel de estrés bajará un 99% si pulsas esta pantalla ahora mismo. Promesa de bot. 📊" },
            { "title": "🏆 DESAFÍO DE SALA", "desc": "Un paciente en la sala de espera acaba de romper el récord de trivia. No te dejes ganar. 🎮" },
            { "title": "💧 HIDRATACIÓN PRO", "desc": "¡Felicidades! Ganaste +100 XP solo por recordar tomar un vaso de agua. Pulsa para cobrarlos. 🎟️" }
        ],
        "gym": [
            { "title": "🏋️ ALERTA DE RACK", "desc": "El socio Carlos lleva 20 minutos en el celular y solo 1 serie de bíceps. Enviando bot motivador. 📱" },
            { "title": "🥤 PRE-ENTRENO CHECK", "desc": "Tu entrenador te recuerda que el agua de Jamaica no cuenta como pre-entreno. Toma agua real. 💧" },
            { "title": "🔥 MÁXIMA POTENCIA", "desc": "Gana +150 XP levantando esa barra olímpica con técnica perfecta. ¡No la avientes! 🏋️" },
            { "title": "🥑 RADAR DE DIETA", "desc": "Tu bot detectó que cenaste pizza el domingo. Requiere 10 minutos extras de escaladora. 🍕" }
        ],
        "legal": [
            { "title": "⚖️ LETRAS CHIQUITAS", "desc": "Tu contrato tiene 90% de probabilidad de tener cláusulas abusivas que ni tú entiendes. Usa el lector IA. 🔍" },
            { "title": "📂 ALERTA DE EXPEDIENTE", "desc": "El pasante de derecho acaba de ganar un amparo contra el aburrimiento en la sala de espera. 📜" },
            { "title": "💔 RADAR DE DIVORCIOS", "desc": "Alerta: Tu bot de recepción detectó una pregunta de divorcio express. Asignando abogado en 3s. ⚖️" },
            { "title": "📝 CONVENIO EXPRESS", "desc": "Generando convenio de confidencialidad automático para tu nueva idea millonaria. Pulsa para ver. 💡" }
        ],
        "contable": [
            { "title": "📊 ALERTA DEL SAT", "desc": "Detectamos una factura de tacos registrada como 'material de oficina'. Te estamos vigilando. 🌮" },
            { "title": "💵 SALDO A FAVOR", "desc": "Tu bot de cálculo fiscal acaba de encontrar una deducción sorpresa. ¡Cobra tu saldo antes que expire! 💸" },
            { "title": "📑 CONSTANCIA CSF", "desc": "Cliente envió CSF borrosa tomada en la mesa de un restaurante. Extrayendo RFC con IA. 🔍" },
            { "title": "🧾 ARCHIVO TOTAL", "desc": "Se han clasificado 142 facturas de WhatsApp directo a Drive. Tus contadores están de fiesta. 🎉" }
        ],
        "boutique": [
            { "title": "👗 PROBADOR VIRTUAL", "desc": "La cliente Sofía se probó el vestido rojo. La IA calculó que le queda increíble. ¡Reserva el tuyo! 💃" },
            { "title": "🛍️ APARTADO EXPRESS", "desc": "Alerta: Solo queda 1 vestido negro en talla M. Apartado por 24 horas para entrega rápida. ⏳" },
            { "title": "👠 OUTFIT COMPLETO", "desc": "Tu asistente sugirió combinar las zapatillas de plataforma con la bolsa negra. +50 puntos de estilo. 👜" },
            { "title": "📦 ENVÍO DE MARCA", "desc": "Tu paquete de temporada va en ruta. Prepárate para lucir espectacular en la pasarela. ✨" }
        ],
        "ferreteria": [
            { "title": "🔧 ¿DÓNDE QUEDÓ?", "desc": "Alerta: Volviste a perder el martillo. El bot te aconseja comprar uno inalámbrico con localizador. 🔨" },
            { "title": "🩹 CINTA CANELA PRO", "desc": "Científicamente comprobado que el 90% de las fugas de tu casa se solucionan con cinta de seguridad. 💧" },
            { "title": "💡 APAGADOR INTELIGENTE", "desc": "El bot te calculó que instalar apagadores de cobre te ahorrará un 15% de luz. Existencias listas. ⚡" },
            { "title": "📐 MEDIDAS EXACTAS", "desc": "El cliente pidió 'un tornillo de este tamaño' mostrando una foto borrosa. Interpretando medida con IA. 🔍" }
        ],
        "gourmet": [
            { "title": "🍷 SOMMELIER CONFUNDIDO", "desc": "Intentaste maridar tacos de suadero con vino espumoso. Tu bot gourmet te sugiere cambiar a tinto. 🍇" },
            { "title": "🍰 POSTRE DE REGALO", "desc": "Sintonizaste la trivia del restaurante con éxito. Reclama tu rebanada de pastel gratis en caja. 🍰" },
            { "title": "🍳 CHEF VIRTUAL", "desc": "El bot acaba de diseñar un menú de 3 tiempos para tu cena romántica de aniversario. Pulsa para ver. ✨" },
            { "title": "🍽️ RESERVA DE GALA", "desc": "Tu mesa privada para 4 personas con mixología de autor está confirmada. Sin filas de espera. 🥂" }
        ],
        "abarrotes": [
            { "title": "🏪 CLICKS EXPRESS", "desc": "Vecino mandó lista de súper por audio: 'Traeme cereal del tigre y un refresco frío'. Empacando... 🛒" },
            { "title": "🥔 FRUTAS DE HOY", "desc": "Alerta de frescura: Acaba de llegar el cargamento de aguacates perfectos. No te los vayas a perder. 🥑" },
            { "title": "🍫 PASILLO IMPULSIVO", "desc": "Tu bot detectó que agregaste papas. Te sugiere chocolates para equilibrar los antojos. 🍫" },
            { "title": " vecina chismosa", "desc": "Alerta: Doña Tere está comprando provisiones para la junta vecinal. Prepárate para el chisme. 🗣️" }
        ],
        "cafeteria": [
            { "title": "☕ CAFEÍNA AL 99%", "desc": "Tu nivel de energía está bajo. El espresso doble ya está en la barra esperando tu llegada. 🔋" },
            { "title": "❤️ CORAZÓN EN TAZA", "desc": "El barista intentó hacer un cisne de arte latte, pero le salió un tlacuache. Disfrútalo igual. 🦡" },
            { "title": "🥐 CROISSANT VOLADOR", "desc": "Acaban de salir los panecillos de chocolate calientes del horno. Pide el tuyo antes que vuelen. 🥐" },
            { "title": "🧪 MÉTODOS MISTERIOSOS", "desc": "La Chemex de especialidad está goteando. Tu taza de café de altura está casi lista para sintonizar. 🧪" }
        ],
        "floreria": [
            { "title": "🌹 RECONCILIACIÓN PRO", "desc": "Alerta: El bot detectó que te olvidaste del aniversario. Enviando ramo de rosas de emergencia. 🚨" },
            { "title": "🌵 CACTUS GUERRERO", "desc": "Este cactus de escritorio sobrevive sin agua y con tus quejas diarias. Adopta un compañero verde. 🌵" },
            { "title": "🌷 TULIPANES ESPÍAS", "desc": "Diseñando bouquet moderno para enviar de forma anónima con dedicatoria oculta. Pulsa para ver. 🌷" },
            { "title": "🌸 BUCHÓN CONFIRMADO", "desc": "Confirmando arreglo de 100 girasoles gigantes para entrega express. Tu sorpresa está en camino. 🌻" }
        ],
        "talleres": [
            { "title": "🚗 CHECK ENGINE", "desc": "Ese testigo encendido en tu tablero no es una luz navideña. Agenda diagnóstico con escáner. 🚨" },
            { "title": "🔊 RUIDITO EXTRAÑO", "desc": "El cliente dice que su motor hace 'piki-piki-clac'. El bot mecánico está traduciendo el ruido. ⚙️" },
            { "title": "🍳 ACEITE AL PUNTO", "desc": "Tu coche necesita cambio de aceite sintético. No esperes a que tu motor parezca sartén de cocina. 🍳" },
            { "title": "🛑 BALATAS CHILLONAS", "desc": "Si tus frenos suenan como flauta desafinada, es momento de cambiarlos. Balatas listas en rampa. 🛑" }
        ],
        "eventos": [
            { "title": "💃 PAYASO DE RODEO", "desc": "Alerta: Tu tía ya se apoderó de la pista de baile. Coordinando catering de hidratación urgente. 🥂" },
            { "title": "🎂 DESBORDE DE PASTEL", "desc": "El pastel de bodas de 4 pisos está firme. El bot de montaje reporta zona segura sin colapsos. 🎂" },
            { "title": "🍬 MESA DE DULCES", "desc": "Alerta de rapiña: Los invitados ya vaciaron la mesa de postres antes de la cena. Reposición en marcha. 🍬" },
            { "title": "🚗 VALET DE CONFIANZA", "desc": "Tu coche está resguardado en el estacionamiento privado con seguro activo. Disfruta la fiesta. 🎉" }
        ],
        "idiomas": [
            { "title": "🇬🇧 VERBO TO BE", "desc": "Llevas 10 años estudiándolo y sigues dudando si eres o estás. El bot te reta a la lección express. 🧠" },
            { "title": "🦉 DUOLINGO ENOJADO", "desc": "Alerta: El búho verde está en la puerta de tu casa esperando que hagas tu racha diaria de inglés. 🦉" },
            { "title": "🗣️ ACENTO BRITÁNICO", "desc": "Tu bot de nivelación te sugiere pronunciar 'Water' como profesional de la corona. +50 puntos de clase. 👑" },
            { "title": "📱 TRADUCTOR EXPULSADO", "desc": "Es hora de dejar de usar el traductor de Google. Tu tutor de conversación IA te asignó grupo hoy. 🇬🇧" }
        ],
        "fumigacion": [
            { "title": "🪳 CUCARACHA VOLADORA", "desc": "Alerta de pánico: Se detectó un insecto con alas en la sala. Activando termonebulizador. 🚨" },
            { "title": "🐜 HORMIGAS DULCES", "desc": "Tu bot detectó una mudanza masiva de insectos hacia el bote de azúcar de la cocina. Desvío activo. 🐜" },
            { "title": "🛡️ CERTIFICADO LISTO", "desc": "Tu constancia oficial para salubridad COFEPRIS ha sido emitida. Negocio 100% blindado. ✔️" },
            { "title": "🐭 INSPECCIÓN DIGITAL", "desc": "Trampas de seguridad colocadas en perímetro de bodega sin novedades. Zona libre de roedores. 🛡️" }
        ],
        "limpieza": [
            { "title": "🍛 MANCHA DE MOLE", "desc": "Tu sala sufrió un accidente gastronómico. Nuestro sistema de inyección-succión lo borrará. 🧼" },
            { "title": "🕷️ ÁCAROS MUDÁNDOSE", "desc": "Los microorganismos de tu colchón están empacando maletas. Vapor de alta temperatura en camino. 🌬️" },
            { "title": "🛋️ SALA REGENERADA", "desc": "Tu sillón favorito pasó de 'gris misterio' a su color original. +100 puntos de higiene en casa. ✨" },
            { "title": "🧺 PROTECCIÓN DE TEFLÓN", "desc": "Capa protectora repelente de líquidos activa para tus sillones contra accidentes de niños. 🛡️" }
        ],
        "viajes": [
            { "title": "🧳 MALETA PESADA", "desc": "Llevas 15 cambios de ropa para un viaje de 3 días. El bot te aconseja sacar 2 pares de zapatos. ✈️" },
            { "title": "🛂 PASAPORTE AL CORREO", "desc": "Alerta: Tu pasaporte vence en 3 meses. Asistente agendando cita de renovación express en cancillería. 🛂" },
            { "title": "🏖️ PLAYA DE ENSUEÑO", "desc": "Confirmando reservación todo incluido con camastro frente al mar de aguas turquesas. Sin filas. 🌊" },
            { "title": "🥥 SOUVENIR SEGURO", "desc": "Compraste un imán de refrigerador de $200 pesos. Tu bot te sugiere mejores opciones locales. 🗺️" }
        ],
        "prospeccion": [
            { "title": "🎯 LEADS CONGELADOS", "desc": "Tienes 500 contactos de Maps guardados en Excel que no te compran nada. Activando bot de reactivación. 📞" },
            { "title": "📨 SCRAPER ACTIVO", "desc": "Consiguiendo 100 teléfonos de constructoras de tu zona en segundo plano. Campaña lista. 📦" },
            { "title": "🧹 FILTRO DE SPAM", "desc": "Eliminando correos inexistentes de tu base de datos para asegurar un 98% de entregas exitosas. 📨" },
            { "title": "📈 VENTAS EN PILOTO", "desc": "Tus mensajes comerciales automatizados están cayendo en las bandejas correctas. Prepárate. 💸" }
        ],
        "webs": [
            { "title": "🖥️ SERVIDOR ACTIVO", "desc": "Tu landing de $99 MXN está respondiendo en 0.2 segundos. Tus clientes cargan la web al instante. ⚡" },
            { "title": "☕ MÁS CAFEÍNA", "desc": "Tu programador de cabecera acaba de rellenar su taza. El código de tu página vuela libre de errores. 💻" },
            { "title": "🎨 DISEÑO IMPECABLE", "desc": "Adaptando layouts y CSS responsivo de forma automática para la carga perfecta en móviles. 📱" },
            { "title": "🔒 SSL CANDADO VERDE", "desc": "Certificado de seguridad instalado en tu dominio. Tus clientes compran bajo protección criptográfica. 🔐" }
        ],
        "rh": [
            { "title": "📝 CURRÍCULUM LOCO", "desc": "Candidato asegura dominar 8 idiomas y tener 3 licenciaturas a sus 18 años. El bot inició pre-entrevista. 🔍" },
            { "title": "📊 PSICOMETRÍA ACTIVA", "desc": "Candidato completó examen Cleaver. Los resultados de honestidad y empuje están listos en tu portal. 📊" },
            { "title": "👷 VACANTE CRÍTICA", "desc": "Se han pre-calificado 5 candidatos idóneos para tu puesto de supervisor. Agenda entrevistas. 👷" },
            { "title": "👔 ONBOARDING PRO", "desc": "Manual de inducción y bienvenida enviado de forma automática al WhatsApp de tu nuevo empleado. ✔️" }
        ],
        "instagram": [
            { "title": "🎬 REEL VIRALIZADO", "desc": "Tu video con gancho psicológico alcanzó las 10,000 reproducciones en tiempo récord. Revisa el feed. 📈" },
            { "title": "🕶️ SHADOWBAN EVITADO", "desc": "Tu bot de contenidos detectó hashtags prohibidos y los eliminó para proteger tu alcance orgánico. 🛡️" },
            { "title": "💬 DM AUTO-RESPUESTA", "desc": "Cliente escribió 'PRECIO' en un Reel. Tu bot le envió el catálogo completo por mensaje privado en 0.5s. 💬" },
            { "title": "🐶 FILTRO DE PERRITO", "desc": "Tu creador de contenidos IA te aconseja no abusar del filtro de orejas en las historias corporativas. 🐶" }
        ],
        "facebook": [
            { "title": "💬 EL FAMOSO 'INFO'", "desc": "Cliente comentó tu post de ventas preguntando 'precio'. Bot respondiendo directo en Messenger en 1s. 💬" },
            { "title": "👵 MENSAJE DE TÍA", "desc": "Tu tía Tere comentó tu foto de campaña diciendo 'Qué guapo mi sobrino, saludos'. Bot respondiendo con emoji. ❤️" },
            { "title": "📣 META ADS SHIELD", "desc": "Campaña de adquisición optimizada con un costo por lead de $2 pesos. Tráfico fluyendo al bot. 📣" },
            { "title": "👥 GRUPO VECINAL", "desc": "Alerta: Tu post comercial fue compartido en 'Vecinos Unidos'. Prepárate para solicitudes masivas. 👥" }
        ],
        "youtube": [
            { "title": "🎭 MINIATURA CLICKBAIT", "desc": "Tu bot de diseño generó una miniatura con cara de sorpresa y fondo neón. El CTR subió un 12%. 📈" },
            { "title": "🎬 SHORT SIN FIN", "desc": "Tu video vertical tiene una retención del 95%. El algoritmo de YouTube lo recomendó masivamente. 🎬" },
            { "title": "🏅 PLACA DE ORO", "desc": "Tus canales automatizados de nicho sin rostro reportaron ingresos pasivos de Google AdSense hoy. 💸" },
            { "title": "🧹 LIMPIEZA DE SPAM", "desc": "Eliminando comentarios de bots con enlaces extraños en tus videos musicales para mantener tu canal limpio. 🧹" }
        ],
        "ciber": [
            { "title": "👾 HACKERS EN STANDBY", "desc": "Se detectó intento de escaneo de puertos desde Moscú. Firewall neón bloqueando IP de inmediato. 🛡️" },
            { "title": "🧾 PHISHING RECHAZADO", "desc": "Tu bot detectó que te enviaron una factura falsa de la luz. Correo marcado y destruido con éxito. 🧼" },
            { "title": "🔐 CONTRASEÑA DEBIL", "desc": "Detectamos que usas 'password123' en tu panel de control. El bot te asignó una clave militar. 🔐" },
            { "title": "🛡️ WEB SCAN COMPLETO", "desc": "Cero inyecciones de código malicioso encontradas en tu base de datos. Servidor en estado inmune. 🧱" }
        ]
    },

    // Motor Hidratador Universal: Morphing dinámico basado en ?id=... (Salud, Gym, etc.)
    hydrateUniversalEngine: function() {
        const params = new URLSearchParams(window.location.search);
        let id = params.get('id');
        
        if (window.app && window.app.clientData && window.app.clientData.nicheId) {
            id = window.app.clientData.nicheId;
        }

        if (!id || !window.app.catalog || !window.app.catalog.demoTemplates || !window.app.catalog.demoTemplates[id]) {
            id = "salud";
        }

        this.currentNicheId = id;
        const template = window.app.catalog.demoTemplates[id];
        console.log(`🌐 [UNIVERSAL ENGINE]: Hidratando plantilla dinámica para el giro: "${id.toUpperCase()}"`);

        // 1. Hidratación de Colores (Propiedades CSS Custom en Raíz)
        const root = document.documentElement;
        if (template && template.colors) {
            root.style.setProperty('--bg-page', template.colors.page);
            root.style.setProperty('--bg-container', template.colors.container);
            root.style.setProperty('--bg-subcard', template.colors.subcard);
            root.style.setProperty('--color-text', template.colors.text);
            root.style.setProperty('--color-text-secondary', template.colors.text_sec);
            root.style.setProperty('--border-container', template.colors.border);
            root.style.setProperty('--crt-bg', template.colors.crt_bg);
            root.style.setProperty('--crt-text', template.colors.crt_text);
            root.style.setProperty('--crt-border', template.colors.crt_border);
        }

        // 2. Hidratación de Identidad / Branding del Hero Card y Título de la Pestaña
        const brand = { ...template.branding };
        if (window.app && window.app.clientData) {
            if (window.app.clientData.negocio) brand.title = window.app.clientData.negocio;
            if (window.app.clientData.tagline) brand.slogan = window.app.clientData.tagline;
            if (window.app.clientData.headline) brand.desc = window.app.clientData.headline;
            if (window.app.clientData.direccion) brand.val_1 = window.app.clientData.direccion;
            if (window.app.clientData.horarios) brand.val_2 = window.app.clientData.horarios;
            if (window.app.clientData.telefono) brand.val_3 = window.app.clientData.telefono;
            if (window.app.clientData.fee) brand.val_4 = window.app.clientData.fee;
        }
        if (window.app && window.app.clientData) {
            if (window.app.clientData.badge) brand.badge = window.app.clientData.badge;
            if (window.app.clientData.specialty) brand.specialty = window.app.clientData.specialty;
        }
        if (brand) {
            const titleEl = document.getElementById('clinic-title');
            const badgeEl = document.getElementById('clinic-badge');
            
            if (brand.tab_title) {
                document.title = brand.tab_title;
            }
            const specialtyEl = document.getElementById('clinic-specialty');
            const sloganEl = document.getElementById('clinic-slogan');
            const descEl = document.getElementById('clinic-desc');
            const val1El = document.getElementById('meta-val-1');
            const val2El = document.getElementById('meta-val-2');
            const val3El = document.getElementById('meta-val-3');
            const val4El = document.getElementById('meta-val-4');
            const reserveBtn = document.querySelector('#clinic-hero-card button[onclick*="toggleWhatsAppWidget"]');

            if (titleEl) titleEl.textContent = brand.title;
            if (badgeEl) badgeEl.textContent = brand.badge;
            if (specialtyEl) specialtyEl.textContent = brand.specialty;
            if (sloganEl) sloganEl.textContent = `"${brand.slogan}"`;
            if (descEl) descEl.textContent = brand.desc;
            if (val1El) val1El.textContent = brand.val_1;
            if (val2El) val2El.textContent = brand.val_2;
            if (val3El) val3El.textContent = brand.val_3;
            if (val4El) val4El.textContent = brand.val_4;
            if (reserveBtn) reserveBtn.textContent = brand.button_text;
        }

        if (window.app && window.app.clientData) {
            const buyBtn = document.querySelector('.flashing-buy-btn');
            if (buyBtn) buyBtn.style.setProperty('display', 'none', 'important');
        }

        // 3. Hidratación de Especialidades / Servicios
        if (template.services && template.services.length >= 2) {
            const t1 = document.getElementById('service-title-1');
            const d1 = document.getElementById('service-desc-1');
            const t2 = document.getElementById('service-title-2');
            const d2 = document.getElementById('service-desc-2');

            if (t1) t1.textContent = template.services[0].title;
            if (d1) d1.textContent = template.services[0].desc;
            if (t2) t2.textContent = template.services[1].title;
            if (d2) d2.textContent = template.services[1].desc;
        }

        // RE-INICIALIZACIÓN DE CARRUSEL CON IMÁGENES DEL NICHO
        if (template && template.images && template.images.length > 0) {
            this.cinematicPhotos = template.images.map(img => ({ ...img }));
            this.currentIndex = 0;
            this.initCinematicViewer();
        }

        if (template.trivia) {
            this.mainTriviaPool = template.trivia;
            this.mainTriviaIndex = 0; 
        }

        const upsells = template.upsells;
        if (upsells) {
            const trackerTitle = document.getElementById('tracker-locked-title');
            const trackerDesc = document.querySelector('#upsell-tracker-section p');
            const shopTitle = document.getElementById('shop-locked-title');
            const shopDesc = document.querySelector('#upsell-shop-section p');

            const recordTitle = document.querySelector('#upsell-record-section h4');
            const recordDesc = document.querySelector('#upsell-record-section p');

            if (trackerTitle) trackerTitle.textContent = upsells.tracker_title;
            if (trackerDesc) trackerDesc.textContent = upsells.tracker_desc;
            if (shopTitle) shopTitle.textContent = upsells.shop_title;
            if (shopDesc) shopDesc.textContent = upsells.shop_desc;
            if (recordTitle && upsells.record_title) recordTitle.textContent = upsells.record_title;
            if (recordDesc && upsells.record_desc) recordDesc.textContent = upsells.record_desc;
        }

        // Relanzar el Bucle de Atracción con el nuevo nicho configurado
        this.startAttractModeLoop();
    },

    // CONTROLADOR DE ATRACT MODE (LOOP "VA Y VEN" EN 2 ACTOS)
    startAttractModeLoop: function() {
        if (this.notifLoopInterval) {
            clearInterval(this.notifLoopInterval);
        }

        this.activeActState = 2; // ENTRAR DIRECTO A ACTO II (ACTIVO)
        this.notifIndex = 0;
        
        // Forzar Pilar 3 a estar activo SIEMPRE
        this.startLiveStreamInteractions(); 
        this.setPhoneVisualState(2); 

        const runCycleStep = () => {
            if (this.activeActState === 1) {
                // ACTO I: Mostrar notificaciones simpáticas de forma sucesiva
                const pool = this.humorPool[this.currentNicheId] || this.humorPool['salud'];
                const notifData = pool[this.notifIndex % pool.length];

                this.showPhonePushNotification(notifData.title, notifData.desc);
                this.notifIndex++;

                // Si ya pasamos por 4 notificaciones, hacemos la transición al Acto II
                if (this.notifIndex >= 4) {
                    this.notifIndex = 0;
                    this.activeActState = 2; // Pasar a Acto II
                }
            } else {
                // ACTO II: Despejar y aclarar la pantalla con llamado ENTRAR
                this.hidePhonePushNotification();
                this.setPhoneVisualState(2); // Quitar Blur y Rojo, mostrar letrero de Entrada

                // Esperar 5 segundos en Acto II y luego regresar suavemente a Acto I
                setTimeout(() => {
                    if (this.activeActState === 2) {
                        this.setPhoneVisualState(1); // Regresa a Blur y Rojo
                        this.activeActState = 1; // Regresa al Acto I
                    }
                }, 5000);
            }
        };

        // Correr inmediatamente el primer paso
        runCycleStep();
        // Ciclar el motor cada 3.5 segundos para refrescar alertas o cambiar de Acto
        this.notifLoopInterval = setInterval(runCycleStep, 3500);
    },

    setPhoneVisualState: function(act) {
        const img1 = document.getElementById('phone-img-1');
        const img2 = document.getElementById('phone-img-2');
        const red1 = document.getElementById('phone-red-overlay-1');
        const enter1 = document.getElementById('phone-entrar-1');
        const enter2 = document.getElementById('phone-entrar-2');

        // El Pilar 3 (img2 y enter2) ahora es independiente y siempre está en Acto II
        if (img2) img2.className = 'phone-screen-img state-active';
        if (enter2) enter2.className = 'phone-entrar-overlay show-cta';

        if (act === 1) {
            // ACTO I: Solo afecta al Pilar 2 (Standby)
            if (img1) img1.className = 'phone-screen-img state-standby';
            if (red1) red1.className = 'phone-red-overlay';
            if (enter1) enter1.className = 'phone-entrar-overlay';
        } else {
            // ACTO II: Solo afecta al Pilar 2 (Activo)
            if (img1) img1.className = 'phone-screen-img state-active';
            if (red1) red1.className = 'phone-red-overlay state-active';
            if (enter1) enter1.className = 'phone-entrar-overlay show-cta';
        }
    },

    // MOTOR DE INTERACCIÓN LIVE (PILAR 3)
    liveStreamInterval: null,
    startLiveStreamInteractions: function() {
        if (this.liveStreamInterval) return;
        
        const emojis = ['❤️', '👏', '🔥', '🙌', '⭐', '❤️', '👏'];
        const target = document.getElementById('live-particles-target');
        const viewerCountEl = document.getElementById('live-viewer-count');

        this.liveStreamInterval = setInterval(() => {
            // 1. Generar Partícula Social
            const particle = document.createElement('span');
            particle.className = 'social-particle';
            particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            particle.style.right = (10 + Math.random() * 20) + 'px'; // Variación horizontal
            if (target) {
                target.appendChild(particle);
                setTimeout(() => particle.remove(), 2500); // Auto-destrucción
            }

            // 2. Oscilar Espectadores
            if (viewerCountEl) {
                let current = parseInt(viewerCountEl.textContent);
                current += Math.random() > 0.5 ? 1 : -1;
                viewerCountEl.textContent = current;
            }
        }, 400);
    },

    stopLiveStreamInteractions: function() {
        clearInterval(this.liveStreamInterval);
        this.liveStreamInterval = null;
    },

    showPhonePushNotification: function(title, desc) {
        const box1 = document.getElementById('phone-notif-box-1');
        const title1 = document.getElementById('notif-title-1');
        const desc1 = document.getElementById('notif-desc-1');

        if (title1) title1.textContent = title;
        if (desc1) desc1.textContent = desc;

        const step = (this.notifIndex - 1) % 2;
        let posStyles = step === 0 
            ? { top: '16px', bottom: 'auto', startTransform: 'translate(-50%, -20px)' }
            : { top: 'auto', bottom: '16px', startTransform: 'translate(-50%, 20px)' };

        if (box1) {
            box1.style.top = posStyles.top;
            box1.style.bottom = posStyles.bottom;
            box1.style.left = '50%';
            box1.style.transform = posStyles.startTransform;
            box1.style.opacity = '0';
            
            void box1.offsetHeight;

            box1.style.setProperty('opacity', '1', 'important');
            box1.style.setProperty('transform', 'translate(-50%, 0)', 'important');
        }

        setTimeout(() => this.hidePhonePushNotification(step), 3000);
    },

    hidePhonePushNotification: function(step = 0) {
        const box1 = document.getElementById('phone-notif-box-1');
        const exitTransform = (step === 0) ? 'translate(-50%, -20px)' : 'translate(-50%, 20px)';
        if (box1) {
            box1.style.setProperty('opacity', '0', 'important');
            box1.style.setProperty('transform', exitTransform, 'important');
        }
    },

    // RETORNO INTELIGENTE AL CATÁLOGO DE SUITES
    returnToCatalog: function() {
        if (window.parent && window.parent !== window && window.parent.app && window.parent.app.ui && window.parent.app.ui.closeDemoVisor) {
            window.parent.app.ui.closeDemoVisor();
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const originalHost = params.get('originalHost');
        const protocol = window.location.protocol || 'https:';

        if (originalHost) {
            window.location.href = `${protocol}//${originalHost}/desarrollo-web.html#tablas`;
            return;
        }

        if (window.history.length > 1 && document.referrer && document.referrer.includes('desarrollo-web')) {
            window.history.back();
            return;
        }

        window.location.href = `${protocol}//${window.location.host}/desarrollo-web.html#tablas`;
    },

    // REDIRECCIÓN SEGURA E INMUNE DE COLISEO (Abre pestañas nuevas limpias de forma asíncrona)
    triggerAffiliateDemo: function() {
        console.log("🚀 [ORBE_EXTRACTION]: Redirigiendo al Orbe de Sintonía Profesional...");
        window.open('https://makumoto.com/?view=home&sintonia=profesional', '_blank');
    },

    triggerVideoDemo: function() {
        console.log("🚀 [TV_EXTRACTION]: Redirigiendo a Makumoto TV Stream...");
        window.open('https://makumoto.com/?view=tv', '_blank');
    },

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

    cinematicPhotos: [],
    currentIndex: 0,
    slideshowInterval: null,

    initCinematicViewer: function() {
        if (this.slideshowInterval) {
            clearInterval(this.slideshowInterval);
            this.slideshowInterval = null;
        }

        const params = new URLSearchParams(window.location.search);
        const originalHost = params.get('originalHost');
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        let baseUrl = 'https://robotiax.mx/';
        if (originalHost) {
            baseUrl = `${window.location.protocol}//${originalHost}/`;
        } else if (isLocal) {
            baseUrl = `${window.location.protocol}//${window.location.host}/`;
        }

        this.cinematicPhotos = this.cinematicPhotos.map(p => {
            let fullUrl = p.url || '';
            if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
                fullUrl = baseUrl + fullUrl.replace(/^\/+/, '');
            }
            return { ...p, url: fullUrl };
        });

        this.currentIndex = 0;
        if (this.cinematicPhotos && this.cinematicPhotos.length > 0) {
            this.changeCinematicPhoto(0, true);
        }

        // ROTACIÓN AUTOMÁTICA CADA 3 SEGUNDOS
        if (this.cinematicPhotos && this.cinematicPhotos.length > 1) {
            this.slideshowInterval = setInterval(() => {
                this.currentIndex = (this.currentIndex + 1) % this.cinematicPhotos.length;
                this.changeCinematicPhoto(this.currentIndex, false);
            }, 3000);
        }
    },

    mainTriviaPool: [
        { q: "¿Cada cuánto tiempo se aconseja agendar una consulta clínica de control preventivo?", a: "6 meses", b: "5 años", correct: 'a' },
        { q: "¿Qué hábito reduce de forma más rápida el cortisol y el estrés en el sistema nervioso?", a: "Dormir 8 horas", b: "Tomar café", correct: 'a' },
        { q: "¿Qué tipo de ácidos grasos protegen tu corazón y limpian tus arterias?", a: "Omega 3", b: "Grasas Trans", correct: 'a' }
    ],

    mainTriviaIndex: 0,
    typewriterTimeout: null,

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

    loadMainTriviaQuestion: function(immediate = false) {
        const textEl = document.getElementById('type-text-main');
        const btnContainer = document.getElementById('btn-container-main');
        const scoreEl = document.getElementById('score-counter-main');

        if (!textEl || !btnContainer || !scoreEl) return;

        if (!this.mainTriviaPool || this.mainTriviaPool.length === 0) {
            this.mainTriviaPool = [
                { q: "¿Cada cuánto tiempo se aconseja agendar una consulta clínica de control preventivo?", a: "6 meses", b: "5 años", correct: 'a' },
                { q: "¿Qué hábito reduce de forma más rápida el cortisol y el estrés en el sistema nervioso?", a: "Dormir 8 horas", b: "Tomar café", correct: 'a' },
                { q: "¿Qué tipo de ácidos grasos protegen tu corazón y limpian tus arterias?", a: "Omega 3", b: "Grasas Trans", correct: 'a' }
            ];
        }

        scoreEl.textContent = `${this.mainTriviaIndex}/3 RETOS`;

        if (this.mainTriviaIndex >= 3) {
            textEl.innerHTML = "RETOS COMPLETADOS ✓";
            btnContainer.innerHTML = `<button onclick="window.app.demo.openSuccessPopup()" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black py-2 rounded-xl uppercase tracking-wider animate-bounce">⚡ VER PREMIO</button>`;
            return;
        }

        const currentData = this.mainTriviaPool[this.mainTriviaIndex];
        btnContainer.innerHTML = ""; 

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
            <button onclick="window.app.demo.checkMainTriviaAnswer('a')" class="w-full bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/80 py-2 px-3 rounded-xl text-[10px] font-bold text-slate-700 hover:text-emerald-700 transition-all duration-300 uppercase tracking-wide shadow-sm hover:scale-[1.01] active:scale-[0.99] font-['Poppins']">
                A: ${currentData.a}
            </button>
            <button onclick="window.app.demo.checkMainTriviaAnswer('b')" class="w-full bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300/80 py-2 px-3 rounded-xl text-[10px] font-bold text-slate-700 hover:text-emerald-700 transition-all duration-300 uppercase tracking-wide shadow-sm hover:scale-[1.01] active:scale-[0.99] font-['Poppins']">
                B: ${currentData.b}
            </button>
        `;
    },

    checkMainTriviaAnswer: function(chosen) {
        const currentData = this.mainTriviaPool[this.mainTriviaIndex];
        const textEl = document.getElementById('type-text-main');
        const btnContainer = document.getElementById('btn-container-main');

        if (chosen === currentData.correct) {
            this.mainTriviaIndex++; 
            
            if (this.mainTriviaIndex >= 3) {
                textEl.innerHTML = "¡EXCELENTE! RETOS COMPLETADOS ✓";
                btnContainer.innerHTML = "";
                
                const scoreEl = document.getElementById('score-counter-main');
                if (scoreEl) scoreEl.textContent = "3/3 RETOS";

                setTimeout(() => {
                    this.openSuccessPopup();
                    this.loadMainTriviaQuestion(true); 
                }, 1500);
                return;
            }

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
            window.open('https://makumoto.com/?view=arcade', '_blank');
        }
    },

    closeSuccessPopup: function() {
        const overlay = document.getElementById('success-popup-overlay');
        if (overlay) {
            overlay.style.setProperty('display', 'none', 'important');
        }
    },

    triggerPipokoRedirection: function() {
        const overlay = document.getElementById('success-popup-overlay');
        if (overlay) overlay.style.setProperty('display', 'none', 'important');
        this.closeSuccessPopup();

        const params = new URLSearchParams(window.location.search);
        let id = params.get('id');
        if (window.app && window.app.clientData && window.app.clientData.nicheId) {
            id = window.app.clientData.nicheId;
        }
        if (!id || !id.trim()) id = "salud";
        
        const cleanId = id.toLowerCase().trim();

        const linkMap = {
            "boutique": "https://makumoto.com/?view=arcade&trivia=boutique",
            "cafeteria": "https://makumoto.com/?view=arcade&trivia=cafeteria",
            "ciber": "https://makumoto.com/?view=arcade&trivia=ciber",
            "contable": "https://makumoto.com/?view=arcade&trivia=contable",
            "eventos": "https://makumoto.com/?view=arcade&trivia=eventos",
            "facebook": "https://makumoto.com/?view=arcade&trivia=facebook",
            "ferreteria": "https://makumoto.com/?view=arcade&trivia=ferreteria",
            "floreria": "https://makumoto.com/?view=arcade&trivia=floreria",
            "fumigacion": "https://makumoto.com/?view=arcade&trivia=fumigacion",
            "gourmet": "https://makumoto.com/?view=arcade&trivia=gourmet",
            "gym": "https://makumoto.com/?view=arcade&trivia=gym",
            "idiomas": "https://makumoto.com/?view=arcade&trivia=idiomas",
            "instagram": "https://makumoto.com/?view=arcade&trivia=instagram",
            "legal": "https://makumoto.com/?view=arcade&trivia=legal",
            "prospeccion": "https://makumoto.com/?view=arcade&trivia=prospeccion",
            "youtube": "https://makumoto.com/?view=arcade&trivia=youtube",
            "abarrotes": "https://makumoto.com/?view=arcade&trivia=abarrotes",
            "limpieza": "https://makumoto.com/?view=arcade&trivia=limpieza",
            "webs": "https://makumoto.com/?view=arcade&trivia=webs",
            "rh": "https://makumoto.com/?view=arcade&trivia=rh",
            "talleres": "https://makumoto.com/?view=arcade&trivia=talleres",
            "salud": "https://makumoto.com/?view=arcade&trivia=salud"
        };

        const targetLink = linkMap[cleanId] || "https://makumoto.com/?view=arcade";
        window.open(targetLink, '_blank');
    },

    changeCinematicPhoto: function(index, immediate = false) {
        const mainPhoto = document.getElementById('cinematic-main-photo');

        if (!mainPhoto || !this.cinematicPhotos[index]) return;

       
        let photoUrl = this.cinematicPhotos[index].url || '';
        if (photoUrl && !photoUrl.startsWith('http://') && !photoUrl.startsWith('https://')) {
            const params = new URLSearchParams(window.location.search);
            const originalHost = params.get('originalHost');
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            let baseUrl = 'https://robotiax.mx/';
            if (originalHost) {
                baseUrl = `${window.location.protocol}//${originalHost}/`;
            } else if (isLocal) {
                baseUrl = `${window.location.protocol}//${window.location.host}/`;
            }
            photoUrl = baseUrl + photoUrl.replace(/^\/+/, '');
        }

        if (immediate) {
            mainPhoto.src = photoUrl;
            return;
        }

        mainPhoto.classList.add('lens-blur-active');

        const phoneImg2 = document.getElementById('phone-img-2');
        const liveDesc = document.getElementById('live-description-text');

        setTimeout(() => {
            mainPhoto.src = photoUrl;
            
            if (liveDesc) liveDesc.textContent = "Sintonía biológica activa #LiveSintonía #Robotiax";

            setTimeout(() => {
                mainPhoto.classList.remove('lens-blur-active');
            }, 100);
        }, 250);
    },

    initMultiTenant: async function() {
        const hostname = window.location.hostname;
        
        if (hostname.endsWith('ikai.info') && hostname !== 'ikai.info') {
            const parts = hostname.split('.');
            const clientSlug = parts[0].toLowerCase().trim();
            console.log(`📡 [MULTI-TENANT]: Sincronizando subdominio '${clientSlug}'...`);
            
            const coach = document.getElementById('interactive-coach-bar');
            if (coach) coach.style.setProperty('display', 'none', 'important');

            if (window.app && window.app.clientData) {
                this.applyClientBranding(window.app.clientData);
                return;
            }

            try {
                const url = `https://firestore.googleapis.com/v1/projects/robotiax/databases/(default)/documents:runQuery`;
                const queryBody = {
                    structuredQuery: {
                        from: [{ collectionId: 'orders_to_fulfill' }],
                        where: {
                            fieldFilter: {
                                field: { fieldPath: 'negocio_slug' },
                                op: 'EQUAL',
                                value: { stringValue: clientSlug }
                            }
                        },
                        limit: 1
                    }
                };

                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(queryBody)
                });

                const resData = await res.json();

                if (resData && resData[0] && resData[0].document) {
                    const fields = resData[0].document.fields;
                    
                    const clientData = {
                        negocio: fields.negocio?.stringValue || "",
                        tagline: fields.tagline?.stringValue || fields.slogan?.stringValue || "",
                        headline: fields.headline?.stringValue || "",
                        direccion: fields.direccion?.stringValue || "",
                        horarios: fields.horarios?.stringValue || "",
                        telefono: fields.telefono?.stringValue || "",
                        fee: fields.fee?.stringValue || ""
                    };

                    this.applyClientBranding(clientData);
                }
            } catch (error) {
                console.error("❌ Error de comunicación con la base de datos REST:", error.message);
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
        const badgeEl = document.getElementById('clinic-badge');
        const specialtyEl = document.getElementById('clinic-specialty');

        if (titleEl && data.negocio) titleEl.innerHTML = `${data.negocio} <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500 italic font-light">${data.tagline || 'Evolución'}</span>`;
        if (descEl && data.headline) descEl.textContent = data.headline;
        if (addressEl && data.direccion) addressEl.textContent = data.direccion;
        if (hoursEl && data.horarios) hoursEl.textContent = data.horarios;
        if (phoneEl && data.telefono) phoneEl.textContent = data.telefono;
        if (feeEl && data.fee) feeEl.textContent = data.fee;
        if (badgeEl && data.badge) badgeEl.textContent = data.badge;
        if (specialtyEl && data.specialty) specialtyEl.textContent = data.specialty;

        if (data.negocio) {
            document.title = `${data.negocio} | Portal Digital`;
        }

        const headerWaBtn = document.getElementById('header-whatsapp-btn');
        if (headerWaBtn) {
            headerWaBtn.onclick = (e) => {
                e.preventDefault();
                window.app.demo.toggleWhatsAppWidget();
            };
        }
    },

    coachStepsData: [
        { title: "Pilar 1: Tus Datos Clínicos", desc: "Tus pacientes verán tu información oficial unificada en un solo lugar: consultorios físicos, horarios activos, costo de consulta y número directo de WhatsApp sincronizados.", targetId: "clinic-metadata-strip" },
        { title: "Pilar 2: Captura en Piloto Automático", desc: "Pruébalo ahora mismo pulsando el **botón de WhatsApp flotante abajo a la derecha**. Tu bot agendará citas directamente sin requerir personal de secretaría.", targetId: "btn-wa-floating" },
        { title: "Pilar 3: Fidelización QR de Sala de Espera", desc: "El paciente escanea este código desde la sala de espera física para jugar trivias, disminuyendo un 80% su ansiedad y ganando puntos de lealtad en tu consultorio.", targetId: "qr-promo-section" },
        { title: "Pilar 4: Módulos de Conversión Premium", desc: "E-Shop, Bio-Tracker y Campañas de Anuncios están integrados de forma orgánica. Puedes activarlos o escalarlos respondiendo a nuestro correo de bienvenida en cualquier momento.", targetId: "upsell-tracker-section" }
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

    showRealWhatsAppConfig: function() {
        const introModal = document.getElementById('whatsapp-simulation-intro-modal');
        if (!introModal) return;

        const data = window.app.clientData || {};
        const cleanPhone = data.telefono ? data.telefono.replace(/\D/g, '') : '';
        const waUrl = `https://wa.me/${cleanPhone}?text=Hola!%20Me%20interesa%20agendar%20un%20servicio.`;

        introModal.innerHTML = `
            <div class="bg-white border border-slate-200 p-6 sm:p-8 max-w-md w-full text-center rounded-3xl relative shadow-2xl font-['Poppins']">
                <button onclick="window.app.demo.closeWhatsAppIntro()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
                <div class="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-[#25d366] text-xl mx-auto mb-4">
                    <i class="fa-brands fa-whatsapp"></i>
                </div>
                <span class="text-[9px] font-['Inter'] text-emerald-600 tracking-widest font-bold mb-1.5 block">VINCULACIÓN DEL ASISTENTE</span>
                <h3 class="text-base sm:text-lg font-black text-slate-900 mb-2">Vincular Asistente de WhatsApp</h3>
                <p class="text-xs text-slate-500 leading-relaxed mb-4 text-left">
                    Tu bot de agendamiento automatizado está aprovisionado en tu VPS privado. Sigue estos pasos para activarlo en tu teléfono:
                </p>
                <div class="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-left text-[11px] text-slate-600 space-y-2 mb-6">
                    <div><strong>1.</strong> Ve a la consola de control: <a href="https://bot.ikai.info" target="_blank" class="text-blue-600 font-bold underline">bot.ikai.info</a>.</div>
                    <div><strong>2.</strong> Inicia sesión con el token enviado a tu correo de confirmación.</div>
                    <div><strong>3.</strong> Escanea el código QR desde Dispositivos Vinculados en tu app de WhatsApp.</div>
                </div>
                <div class="flex flex-col gap-3">
                    <button onclick="window.open('${waUrl}', '_blank')" class="bg-[#25d366] hover:bg-[#20ba56] text-white font-['Inter'] font-black text-xs py-3.5 rounded-xl transition-all shadow-md shadow-[#25d366]/10 uppercase tracking-wider">
                        💬 CHATEAR CON TU BOT ACTIVO
                    </button>
                    <button onclick="window.open('https://bot.ikai.info', '_blank')" class="text-xs text-blue-600 font-bold hover:text-blue-800 hover:underline">
                        Ir a Consola de Vinculación (bot.ikai.info)
                    </button>
                </div>
            </div>
        `;
        introModal.style.setProperty('display', 'flex', 'important');
    },

    toggleWhatsAppWidget: function() {
        const widget = document.getElementById('whatsapp-chat-widget');
        const introModal = document.getElementById('whatsapp-simulation-intro-modal');
        if (!widget) return;

        if (window.app && window.app.clientData) {
            this.showRealWhatsAppConfig();
            return;
        }

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
                    <span class="text-[10px] font-['Inter'] text-emerald-600 tracking-widest font-bold block">[ DESAFÍO COMPLETADO ]</span>
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
                <span class="text-[10px] font-['Inter'] text-blue-600 tracking-widest font-bold block">RETO DE PREVENCIÓN ACTIVO</span>
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

    mockTrackerHydration: 2.2,
    mockCartCount: 0,
    mockCampaignBudget: 2000,

    triggerUpsell: function(moduleName) {
        const modal = document.getElementById('upsell-modal-overlay');
        if (!modal) return;
        modal.style.setProperty('display', 'flex', 'important');

        if (moduleName.includes('Bio-Tracker')) {
            this.renderBioTrackerDemo();
        } else if (moduleName.includes('E-Shop')) {
            this.renderEShopDemo();
        } else if (moduleName.includes('Campaña')) {
            this.renderCampaignDemo();
        } else if (moduleName.includes('Expediente')) {
            this.renderExpedienteDemo();
        }
    },

    closeUpsellModal: function() {
        const modal = document.getElementById('upsell-modal-overlay');
        if (modal) modal.style.setProperty('display', 'none', 'important');
    },

    submitUpsellRequest: function(moduleText) {
        this.closeUpsellModal();
        alert(`🚀 SOLICITUD REGISTRADA CON ÉXITO\nHemos guardado tu petición de integración técnica para el módulo: "${moduleText}".\nUn ingeniero de soporte de Robotiax te enviará la cotización y accesos finales a tu buzón.`);
    },

    downloadMockPrescription: function() {
        alert("📄 [EXPEDIENTE DIGITAL]\nGenerando receta médica digital oficial con Sello de Certificación QR y Firma Electrónica Criptográfica...\n¡Descarga de receta_sofia_alatorre_VIT_D3.pdf completada!");
    },

    addNewMockPrescription: function() {
        const box = document.getElementById('expediente-recetas-box');
        if (!box) return;
        if (box.innerHTML.includes('Ashwagandha')) {
            this._showToast("ESTA RECOMENDACIÓN YA HA SIDO AGREGADA");
            return;
        }
        box.innerHTML += `<div>• Ashwagandha KSM-66 600 mg - 1 cap c/comida principal (30 días).</div>`;
        this._showToast("💊 SUPLEMENTO AGREGADO AL EXPEDIENTE DE SOFIA");
    },

    renderBioTrackerDemo: function() {
        const body = document.getElementById('upsell-dynamic-body');
        if (!body) return;
        const pct = Math.min(Math.round((this.mockTrackerHydration / 2.5) * 100), 100);
        body.innerHTML = `
            <div class="text-left space-y-4">
                <span class="text-[9px] font-['Inter'] text-blue-600 tracking-widest font-bold block">[ TELEMETRÍA DE EXPEDIENTE: PORTAL DE HÁBITOS ]</span>
                <h3 class="text-base font-black text-slate-900">📊 Ficha de Hábitos: Juan Pérez (Paciente)</h3>
                <p class="text-xs text-slate-500 leading-relaxed">Esta es la visualización clínica que tendrás de cada paciente. Puedes experimentar registrando más hidratación simulada en caliente:</p>
                
                <div class="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3.5">
                    <div>
                        <div class="flex justify-between text-[11px] mb-1">
                            <span class="font-bold text-slate-700">💧 Hidratación Diaria</span>
                            <span class="text-blue-600 font-bold">${this.mockTrackerHydration.toFixed(1)} L / 2.5 L (${pct}%)</span>
                        </div>
                        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div class="bg-blue-500 h-full transition-all duration-300" style="width: ${pct}%"></div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-[10px] pt-1">
                        <div class="p-3 bg-white border border-slate-100 rounded-xl">
                            <span class="text-slate-400 block uppercase font-bold text-[8px] mb-0.5">🚶 PASOS RECORRIDOS</span>
                            <span class="font-bold text-slate-800 text-xs">8,400 pasos (84%)</span>
                        </div>
                        <div class="p-3 bg-white border border-slate-100 rounded-xl">
                            <span class="text-slate-400 block uppercase font-bold text-[8px] mb-0.5">😴 HORAS SUEÑO</span>
                            <span class="font-bold text-slate-800 text-xs">7.5 hrs (93%)</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <button onclick="window.app.demo.addMockHydration()" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-['Inter'] font-black text-[10px] py-3 rounded-xl uppercase transition-all">
                        ➕ Simular Registro de Hidratación (+300 ml)
                    </button>
                    <button onclick="window.app.demo.submitUpsellRequest('Bio-Tracker de Hábitos')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-4 rounded-xl">
                        Solicitar Activación Real
                    </button>
                </div>
            </div>
        `;
    },

    addMockHydration: function() {
        this.mockTrackerHydration = Math.min(this.mockTrackerHydration + 0.3, 3.0);
        this.renderBioTrackerDemo();
        this._showToast("💧 REGISTRO DE AGUA EXÍTOSO (+300ml)");
    },

    renderEShopDemo: function() {
        const body = document.getElementById('upsell-dynamic-body');
        if (!body) return;
        body.innerHTML = `
            <div class="text-left space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-['Inter'] text-emerald-600 tracking-widest font-bold block">[ TIENDA EN LINEA DE PRECISIÓN ]</span>
                    <span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">🛒 Carrito: ${this.mockCartCount} items</span>
                </div>
                <h3 class="text-base font-black text-slate-900">🛒 E-Shop: Suplementación & Productos Clínicos</h3>
                <p class="text-xs text-slate-500 leading-relaxed">Tus pacientes compran tus recomendaciones médicas directamente desde tu web en tu propia pasarela bancaria segura:</p>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl flex flex-col justify-between">
                        <div>
                            <span class="font-bold text-slate-800 text-xs block">Omega-3 Premium (90 Cápsulas)</span>
                            <span class="text-[10px] text-slate-400">Cardioprotección y antinflamatorio</span>
                        </div>
                        <div class="flex items-center justify-between mt-3">
                            <span class="text-xs font-black text-emerald-600">$350 MXN</span>
                            <button onclick="window.app.demo.addToMockCart()" class="bg-emerald-600 text-white font-bold text-[9px] px-3 py-1 rounded-lg hover:bg-emerald-700 transition-all uppercase">Añadir</button>
                        </div>
                    </div>
                    <div class="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl flex flex-col justify-between">
                        <div>
                            <span class="font-bold text-slate-800 text-xs block">Cepillo Clínico Sonic Pro</span>
                            <span class="text-[10px] text-slate-400">Higiene dental avanzada</span>
                        </div>
                        <div class="flex items-center justify-between mt-3">
                            <span class="text-xs font-black text-emerald-600">$420 MXN</span>
                            <button onclick="window.app.demo.addToMockCart()" class="bg-emerald-600 text-white font-bold text-[9px] px-3 py-1 rounded-lg hover:bg-emerald-700 transition-all uppercase">Añadir</button>
                        </div>
                    </div>
                </div>
                
                <div class="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <button onclick="window.app.demo.checkoutMockCart()" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-['Inter'] font-black text-[10px] py-3 rounded-xl uppercase transition-all">
                        💳 Simular Compra de Carrito
                    </button>
                    <button onclick="window.app.demo.submitUpsellRequest('E-Shop de Especialidad')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-4 rounded-xl">
                        Solicitar Activación Real
                    </button>
                </div>
            </div>
        `;
    },

    addToMockCart: function() {
        this.mockCartCount++;
        this.renderEShopDemo();
        this._showToast("🛒 PRODUCTO AÑADIDO AL CARRITO");
    },

    checkoutMockCart: function() {
        if (this.mockCartCount === 0) {
            alert("Por favor, añade al menos un producto al carrito para simular el pago.");
            return;
        }
        alert(`💳 [PASARELA DE PAGO SIMULADA ROBOTIAX]\nProcesando cobro cifrado con comisiones del 0%...\n¡Transacción simulada por ${this.mockCartCount} productos exitosa!`);
        this.mockCartCount = 0;
        this.renderEShopDemo();
    },

    renderCampaignDemo: function() {
        const body = document.getElementById('upsell-dynamic-body');
        if (!body) return;
        const clicks = Math.round((this.mockCampaignBudget / 2000) * 1280);
        const conversions = Math.round(clicks * 0.065); 
        const estimatedIncome = conversions * 800; 
        const roi = Math.round(((estimatedIncome - this.mockCampaignBudget) / this.mockCampaignBudget) * 100);

        body.innerHTML = `
            <div class="text-left space-y-4">
                <span class="text-[9px] font-['Inter'] text-rose-500 tracking-widest font-bold block">[ TELEMETRÍA DE EMBUDO DE TRÁFICO ADS ]</span>
                <h3 class="text-base font-black text-slate-900">🎯 Campaña Ads Conectada a tu WhatsApp Bot</h3>
                <p class="text-xs text-slate-500 leading-relaxed">Monitorea el costo y retorno de tus campañas de adquisición de pacientes:</p>
                
                <div class="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3.5 text-xs text-slate-700">
                    <div class="flex justify-between border-b border-slate-200/50 pb-2">
                        <span class="text-slate-500 font-medium">Inversión Mensual Ads:</span>
                        <span class="font-extrabold text-slate-900">$${this.mockCampaignBudget.toLocaleString()} MXN</span>
                    </div>
                    <div class="grid grid-cols-2 gap-3 text-center">
                        <div class="p-3 bg-white border border-slate-100 rounded-xl">
                            <span class="text-slate-400 block text-[8px] font-bold uppercase mb-0.5">CLICS AL WHATSAPP</span>
                            <span class="font-black text-slate-800 text-xs">${clicks.toLocaleString()}</span>
                        </div>
                        <div class="p-3 bg-white border border-slate-100 rounded-xl">
                            <span class="text-slate-400 block text-[8px] font-bold uppercase mb-0.5">PACIENTES AGENDADOS</span>
                            <span class="font-black text-emerald-600 text-xs">${conversions.toLocaleString()} consultas</span>
                        </div>
                    </div>
                    <div class="flex justify-between border-t border-slate-200/50 pt-2 font-bold text-[11px]">
                        <span class="text-slate-500">Retorno Neto Estimado (ROI):</span>
                        <span class="text-emerald-600 font-black">+${roi}% (+$${estimatedIncome.toLocaleString()} MXN)</span>
                    </div>
                </div>
                
                <div class="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <button onclick="window.app.demo.adjustCampaignBudget()" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-['Inter'] font-black text-[10px] py-3 rounded-xl uppercase transition-all">
                        ⚡ ${this.mockCampaignBudget === 2000 ? 'Simular Duplicar Presupuesto ($4,000 MXN)' : 'Restablecer Presupuesto ($2,000 MXN)'}
                    </button>
                    <button onclick="window.app.demo.submitUpsellRequest('Plan Ads de Pacientes')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-4 rounded-xl">
                        Solicitar Plan Ads Real
                    </button>
                </div>
            </div>
        `;
    },

    adjustCampaignBudget: function() {
        this.mockCampaignBudget = this.mockCampaignBudget === 2000 ? 4000 : 2000;
        this.renderCampaignDemo();
        this._showToast(`⚡ PRESUPUESTO ACTUALIZADO ($${this.mockCampaignBudget} MXN)`);
    },

    renderExpedienteDemo: function() {
        const body = document.getElementById('upsell-dynamic-body');
        if (!body) return;
        body.innerHTML = `
            <div class="text-left space-y-4">
                <span class="text-[9px] font-['Inter'] text-blue-600 tracking-widest font-bold block">[ INTEGRACIÓN DE PORTAL CLÍNICO PREMIUM ]</span>
                <h3 class="text-base font-black text-slate-900">📂 Expediente Sofia Alatorre (ID: #SOF-289)</h3>
                <p class="text-xs text-slate-500 leading-relaxed">Este es el panel que visualiza el paciente. Permite consultar recetas, diagnósticos y citas sin saturar tu línea telefónica:</p>
                
                <div class="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-4 text-[11px] text-slate-700 max-h-[260px] overflow-y-auto">
                    <div class="flex items-center justify-between border-b border-slate-200/50 pb-2">
                        <span class="font-bold text-slate-800">Ficha General</span>
                        <span class="text-slate-400">Sofia Alatorre, 28 años | Sangre: O+</span>
                    </div>

                    <div class="space-y-1">
                        <span class="font-bold text-slate-800 block">🩺 Diagnósticos Activos</span>
                        <div class="flex flex-wrap gap-1.5">
                            <span class="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-2 py-0.5 rounded-full">Déficit de Vitamina D3</span>
                            <span class="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold px-2 py-0.5 rounded-full">Estrés metabólico leve</span>
                        </div>
                    </div>

                    <div class="space-y-1.5 border-t border-slate-200/50 pt-2">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-slate-800 block">💊 Receta Médica Emitida</span>
                            <button onclick="window.app.demo.downloadMockPrescription()" class="text-blue-600 hover:text-blue-800 font-bold text-[9px] flex items-center gap-1"><i class="fa-solid fa-download"></i> Descargar PDF</button>
                        </div>
                        <div class="bg-white border border-slate-150 p-2.5 rounded-xl space-y-1 shadow-sm font-mono text-[10px]" id="expediente-recetas-box">
                            <div>• Vitamina D3 5000 UI - 1 cap c/24 hrs (30 días).</div>
                            <div>• Bisglicinato de Magnesio 400 mg - 1 cap por las noches (60 días).</div>
                        </div>
                    </div>

                    <div class="space-y-1.5 border-t border-slate-200/50 pt-2">
                        <span class="font-bold text-slate-800 block">📅 Próximas Citas</span>
                        <div class="space-y-1 text-[10px]">
                            <div class="flex justify-between bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200/50">
                                <span>🩺 Consulta de Control (Presencial)</span>
                                <span class="font-bold">Mañana - 11:00 AM</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <button onclick="window.app.demo.addNewMockPrescription()" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-['Inter'] font-black text-[10px] py-3 rounded-xl uppercase transition-all">
                        ➕ Simular Recetar Suplemento Adicional
                    </button>
                    <button onclick="window.app.demo.submitUpsellRequest('Expediente Clínico Digital')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-4 rounded-xl">
                        Solicitar Activación Real
                    </button>
                </div>
            </div>
        `;
    },

    openCloserModal: function() {
        const closer = document.getElementById('closer-modal-overlay');
        if (closer) closer.style.setProperty('display', 'flex', 'important');
    },

    closeCloserModal: function() {
        const closer = document.getElementById('closer-modal-overlay');
        if (closer) closer.style.setProperty('display', 'none', 'important');
    },

    startCloserAutoTrigger: function() {
        if (window.app && window.app.clientData) return; 
        setInterval(() => {
            const closer = document.getElementById('closer-modal-overlay');
            const introModal = document.getElementById('whatsapp-simulation-intro-modal');
            const paymentModal = document.getElementById('payment-modal-overlay');
            const successNotif = document.getElementById('success-notif');
            const makuPanel = document.getElementById('makumoto-interactive-panel');

            const isAnyModalActive = 
                (closer && closer.style.display === 'flex') ||
                (introModal && introModal.style.display === 'flex') ||
                (paymentModal && paymentModal.style.display === 'flex') ||
                (successNotif && successNotif.style.display === 'flex') ||
                (makuPanel && !makuPanel.classList.contains('hidden'));

            if (!isAnyModalActive) {
                this.openCloserModal();
                this._showToast("💡 SIMULACIÓN COMPLETA: ¿Listo para activar tu suite?");
            }
        }, 60000); 
    },

    triggerPaymentFlow: function() {
        this.closeCloserModal();
        window.app = window.app || {};
        window.app.vault = 'RBX-PRT-99-MXN-SECURE-2025';

        const params = new URLSearchParams(window.location.search);
        const activeId = params.get('id') || 'salud';
        const productId = `cfg-${activeId}-bot-promo`;
        const productName = `Suite de ${activeId.toUpperCase()} - Promo Lanzamiento`;

        const proceed = () => {
            if (window.app.payments && window.app.payments.openModal) {
                window.app.payments.openModal(productId, productName, 200, 'MXN');
            } else {
                this._showToast("CONECTANDO DIRECTAMENTE CON PAYPAL...");

                fetch('https://createpaypalorder-bh64qprvqa-uc.a.run.app', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Robotiax-Token': 'RBX-PRT-99-MXN-SECURE-2025'
                    },
                    body: JSON.stringify({
                        productId: productId,
                        fundingType: 'paypal',
                        price: 200,
                        currency: 'MXN',
                        returnUrl: window.location.origin + window.location.pathname
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.approveUrl) {
                        localStorage.setItem('pending_purchase_id', productId);
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
            btn.className = "w-full font-bold py-2 rounded-lg text-center hover:scale-[1.01] transition-all text-[10px]";
            btn.style = "background: var(--crt-text, #128c7e); color: var(--crt-bg, #ffffff); border: 1px dashed var(--crt-border); cursor: pointer;";
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
    if (window.app && window.app.clientData) {
        window.app.demo.initMultiTenant();
    } else {
        const hostname = window.location.hostname;
        if (hostname.endsWith('ikai.info') && hostname !== 'ikai.info') {
            window.app.demo.initMultiTenant();
        }
    }
    if (window.app.demo && typeof window.app.demo.hydrateUniversalEngine === 'function') {
        window.app.demo.hydrateUniversalEngine();
    }
    if (window.app.demo && typeof window.app.demo.loadMainTriviaQuestion === 'function') {
        window.app.demo.loadMainTriviaQuestion(false);
    }
});