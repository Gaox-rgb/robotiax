window.app = window.app || {};

window.app.catalog = {
    // --- SECCIÓN: DESARROLLO WEB ($99 MXN) ---
    web: [
        { id: 'bienes-raices-01', name: 'Bienes Raíces 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'cirujano-01', name: 'Cirujano Plástico 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'clinica-01', name: 'Clínica Médica 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'consultoria-01', name: 'Consultoría 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'consultoria-02', name: 'Consultoría 02', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'consultoria-03', name: 'Consultoría Elite 03', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'contador-01', name: 'Contabilidad 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'cursos-01', name: 'E-Learning 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'cursos-02', name: 'Academy 02', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'empresa-01', name: 'Corporativo 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'gym-01', name: 'Fitness 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'gym-02', name: 'Power Gym 02', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'industry-01', name: 'Industrial 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'influencer-01', name: 'Influencer 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'influencer-02', name: 'Creator 02', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'legal-01', name: 'Legal Services 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'medico-01', name: 'Médico Especialista 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'security-01', name: 'Cyber Security 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'spa-01', name: 'Wellness Spa 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'tech-01', name: 'Tech Global 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'ventas-01', name: 'Sales Landing 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true },
        { id: 'yoga-01', name: 'Yoga Studio 01', price: 99.00, currency: 'MXN', category: 'WEB', top: true }
    ],

    // --- SECCIÓN: ARSENAL IA (30 Agentes) ---
    ia: [
        // ADMINISTRATIVAS (10)
        { id: 'ia-contable', name: 'Asistente Contable IA', price: 49.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '📊', top: false, desc: 'Clasificación de facturas y pre-auditoría contable multimodal.' },
        { id: 'ia-legal-pocket', name: 'Asistente Legal de Bolsillo', price: 79.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '⚖️', top: false, desc: 'Análisis de contratos y detección de cláusulas de riesgo.' },
        { id: 'ia-proyeccion', name: 'Arquitecto de Proyección', price: 89.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '📈', top: false, desc: 'Modelos predictivos de flujo de caja y alertas de liquidez.' },
        { id: 'ia-nomina', name: 'Sintetizador de Nómina', price: 59.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '💵', top: false, desc: 'Cálculo automático de bonos por desempeño y transparencia salarial.' },
        { id: 'ia-costos-ocultos', name: 'Radar de Costos Ocultos', price: 49.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '🔍', top: false, desc: 'Identifica fugas de capital en suscripciones y cargos bancarios.' },
        { id: 'ia-gastos-voz', name: 'Gestor de Gastos por Voz', price: 20.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '🎙️', top: true, desc: 'Registra tus egresos dictándole a la IA. Control financiero instantáneo.' },
        { id: 'ia-motivador', name: 'Inspirador Táctico', price: 20.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '🧠', top: true, desc: 'Reconocimiento de logros y mensajes de disciplina para tu personal.' },
        { id: 'ia-rentabilidad', name: 'Analista de Rentabilidad', price: 69.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '💰', top: false, desc: 'Determina el margen real de cada producto o servicio que vendes.' },
        { id: 'ia-caja-chica', name: 'Interventor de Caja Chica', price: 39.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '🎟️', top: false, desc: 'Control de flujos menores mediante digitalización de tickets.' },
        { id: 'ia-inversion', name: 'Consultor de Inversión', price: 99.00, currency: 'USD', category: 'ADMINISTRATIVA', icon: '🏛️', top: false, desc: 'Evalúa el momento exacto para adquirir equipo o expansión.' },

        // OPERATIVAS (10)
        { id: 'ia-chronos', name: 'Chronos AI: Agenda Autónoma', price: 20.00, currency: 'USD', category: 'OPERATIVA', icon: '⏳', top: true, desc: 'Gestión inteligente de citas y confirmaciones vía WhatsApp 24/7.' },
        { id: 'ia-rendimiento', name: 'Monitor de Rendimiento', price: 59.00, currency: 'USD', category: 'OPERATIVA', icon: '📉', top: false, desc: 'Tablero de eficiencia y detección de cuellos de botella operativos.' },
        { id: 'ia-manual-vivo', name: 'Sintetizador de Instrucciones', price: 20.00, currency: 'USD', category: 'OPERATIVA', icon: '📜', top: true, desc: 'Convierte tus audios en manuales operativos paso a paso para personal.' },
        { id: 'ia-calidad', name: 'Vigía de Calidad', price: 79.00, currency: 'USD', category: 'OPERATIVA', icon: '🎯', top: false, desc: 'Escanea la atención de empleados y lanza alertas ante quejas.' },
        { id: 'ia-suministros', name: 'Coordinador de Suministros', price: 49.00, currency: 'USD', category: 'OPERATIVA', icon: '📦', top: false, desc: 'Predice el agotamiento de insumos y genera listas de pedido.' },
        { id: 'ia-correcciones', name: 'Gestor de Correcciones', price: 69.00, currency: 'USD', category: 'OPERATIVA', icon: '✔️', top: false, desc: 'Supervisor virtual que revisa el trabajo final antes de entrega.' },
        { id: 'ia-post-servicio', name: 'Seguimiento Post-Servicio', price: 39.00, currency: 'USD', category: 'OPERATIVA', icon: '✉️', top: false, desc: 'Recaba testimonios y abre tickets de soporte automáticamente.' },
        { id: 'ia-rutas', name: 'Optimizador de Logística', price: 89.00, currency: 'USD', category: 'OPERATIVA', icon: '🚚', top: false, desc: 'Cálculo de rutas rápidas para visitas técnicas y entregas.' },
        { id: 'ia-mantenimiento', name: 'Radar de Mantenimiento', price: 59.00, currency: 'USD', category: 'OPERATIVA', icon: '🔧', top: false, desc: 'Programa alertas preventivas antes de averías costosas en equipos.' },
        { id: 'ia-crisis', name: 'Mando de Crisis Operativa', price: 129.00, currency: 'USD', category: 'OPERATIVA', icon: '🆘', top: false, desc: 'Plan de contingencia automático ante falta de personal o fallos.' },

        // MARKETING (10)
        { id: 'ia-sales-sniper', name: 'Cazador de Prospectos', price: 20.00, currency: 'USD', category: 'MARKETING', icon: '🎯', top: true, desc: 'Identifica y califica leads calientes en tu zona geográfica.' },
        { id: 'ia-avatar-ventas', name: 'Avatar de Ventas 24/7', price: 149.00, currency: 'USD', category: 'MARKETING', icon: '🤖', top: false, desc: 'Cerrador maestro que maneja objeciones y envía links de pago.' },
        { id: 'ia-identidad-viral', name: 'Arquitecto de Identidad', price: 69.00, currency: 'USD', category: 'MARKETING', icon: '🎨', top: false, desc: 'Genera anuncios y copies psicológicos optimizados para redes.' },
        { id: 'ia-radar-reputacion', name: 'Radar de Reseñas', price: 20.00, currency: 'USD', category: 'MARKETING', icon: '⭐', top: true, desc: 'Responde reseñas de Google y neutraliza ataques de bots.' },
        { id: 'ia-guerrilla', name: 'Campañas de Guerrilla', price: 59.00, currency: 'USD', category: 'MARKETING', icon: '🧨', top: false, desc: 'Estrategias de bajo costo y alto impacto para expansión local.' },
        { id: 'ia-expansion', name: 'Socio de Expansión', price: 199.00, currency: 'USD', category: 'MARKETING', icon: '🗺️', top: false, desc: 'Análisis de mercado para apertura de nuevas sucursales.' },
        { id: 'ia-retencion', name: 'Máquina de Retención', price: 89.00, currency: 'USD', category: 'MARKETING', icon: '🧲', top: false, desc: 'Recupera clientes inactivos con ofertas personalizadas.' },
        { id: 'ia-sentimiento', name: 'Analista de Sentimiento', price: 49.00, currency: 'USD', category: 'MARKETING', icon: '👂', top: false, desc: 'Detecta debilidades de tu competencia analizando quejas externas.' },
        { id: 'ia-ofertas-flash', name: 'Lanzador de Ofertas', price: 39.00, currency: 'USD', category: 'MARKETING', icon: '⚡', top: false, desc: 'Crea promociones relámpago en horas bajas de venta.' },
        { id: 'ia-influencia', name: 'Portal de Influencia', price: 129.00, currency: 'USD', category: 'MARKETING', icon: '📱', top: false, desc: 'Identifica micro-influencers locales y gestiona colaboraciones.' }
    ],

    // --- SECCIÓN: PROTOCOLO SEGURIDAD (30 Agentes) ---
    security: [
        // PERSONAL (10)
        { id: 'sec-fantasma', name: 'Protocolo Fantasma', price: 20.00, currency: 'USD', category: 'PERSONAL', icon: '👤', top: true, desc: 'Invisibilidad total ante trackers y algoritmos de vigilancia.' },
        { id: 'sec-herencia', name: 'Bóveda de Herencia Digital', price: 49.00, currency: 'USD', category: 'PERSONAL', icon: '🧬', top: true, desc: 'Transferencia de activos encriptados en caso de inactividad prolongada.' },
        { id: 'sec-social', name: 'Analista de Ing. Social', price: 39.00, currency: 'USD', category: 'PERSONAL', icon: '💬', top: false, desc: 'Detecta patrones de manipulación en chats y llamadas.' },
        { id: 'sec-phishing', name: 'Escudo Anti-Phishing', price: 20.00, currency: 'USD', category: 'PERSONAL', icon: '🎣', top: true, desc: 'Neutraliza links fraudulentos mediante análisis de lenguaje.' },
        { id: 'sec-limpiador-meta', name: 'Limpiador de Metadatos', price: 20.00, currency: 'USD', category: 'PERSONAL', icon: '🧼', top: true, desc: 'Elimina rastro de GPS y dispositivo de tus fotos y archivos.' },
        { id: 'sec-deepfake', name: 'Escudo de Deepfake', price: 149.00, currency: 'USD', category: 'PERSONAL', icon: '🎭', top: false, desc: 'Protección de identidad visual/voz contra suplantación sintética.' },
        { id: 'sec-boveda-id', name: 'Bóveda de Identidad AI', price: 20.00, currency: 'USD', category: 'PERSONAL', icon: '🔐', top: true, desc: 'Gestión de claves dinámicas y alertas en la Dark Web.' },
        { id: 'sec-zero', name: 'Caja Fuerte Zero-Knowledge', price: 59.00, currency: 'USD', category: 'PERSONAL', icon: '🧱', top: false, desc: 'Almacenamiento encriptado donde solo tú tienes la llave maestra.' },
        { id: 'sec-iot', name: 'Monitor Perímetro IoT', price: 79.00, currency: 'USD', category: 'PERSONAL', icon: '🏠', top: false, desc: 'Bloquea el espionaje de cámaras y bocinas inteligentes.' },
        { id: 'sec-extorsion', name: 'Bot Anti-Extorsión', price: 99.00, currency: 'USD', category: 'PERSONAL', icon: '🛑', top: false, desc: 'Respuesta técnica agresiva ante correos de chantaje.' },

        // PYME (10)
        { id: 'sec-pos', name: 'Inmunizador POS', price: 129.00, currency: 'USD', category: 'PYME', icon: '💳', top: true, desc: 'Protege terminales de cobro contra el robo de datos de clientes.' },
        { id: 'sec-lealtad', name: 'Vigía de Lealtad', price: 89.00, currency: 'USD', category: 'PYME', icon: '👮', top: false, desc: 'Detecta descargas masivas de bases de datos por empleados.' },
        { id: 'sec-auditor-red', name: 'Auditor de Red Local', price: 49.00, currency: 'USD', category: 'PYME', icon: '📡', top: true, desc: 'Escaneo táctico de intrusos y puertas traseras en el router.' },
        { id: 'sec-facturacion', name: 'Escudo de Facturación', price: 79.00, currency: 'USD', category: 'PYME', icon: '🧾', top: false, desc: 'Evita el fraude por cambio de cuentas en correos interceptados.' },
        { id: 'sec-backup', name: 'Backup Táctico', price: 149.00, currency: 'USD', category: 'PYME', icon: '🔄', top: false, desc: 'Clonación de sistemas para continuidad ante robos físicos.' },
        { id: 'sec-privacidad', name: 'Asistente de Privacidad', price: 39.00, currency: 'USD', category: 'PYME', icon: '📋', top: false, desc: 'Automatiza el cumplimiento legal de manejo de datos personales.' },
        { id: 'sec-web-scan', name: 'Escáner Vulnerabilidad Web', price: 69.00, currency: 'USD', category: 'PYME', icon: '🌐', top: false, desc: 'Revisión diaria contra inyección de malware en tu sitio.' },
        { id: 'sec-biometrico', name: 'Acceso Biométrico IA', price: 199.00, currency: 'USD', category: 'PYME', icon: '👁️', top: false, desc: 'Sustituye llaves físicas por reconocimiento facial de élite.' },
        { id: 'sec-empleados', name: 'Filtro de Seguridad Interna', price: 59.00, currency: 'USD', category: 'PYME', icon: '🚧', top: false, desc: 'Control de acceso a sitios peligrosos durante jornada laboral.' },
        { id: 'sec-crisis', name: 'Asesor de Crisis Ransomware', price: 299.00, currency: 'USD', category: 'PYME', icon: '🚨', top: false, desc: 'Aislamiento de red y protocolos de recuperación ante secuestro.' },

        // MEDIANA EMPRESA (10)
        { id: 'sec-soc', name: 'SOC IA Central', price: 499.00, currency: 'USD', category: 'MEDIANA', icon: '🖥️', top: true, desc: 'Tablero de guerra con decisiones de bloqueo en milisegundos.' },
        { id: 'sec-amenaza-int', name: 'Cazador Amenaza Interna', price: 249.00, currency: 'USD', category: 'MEDIANA', icon: '🕵️', top: false, desc: 'Monitorea comportamientos anómalos en usuarios con privilegios.' },
        { id: 'sec-honeypot', name: 'Honey-Pot (Trampa)', price: 179.00, currency: 'USD', category: 'MEDIANA', icon: '🍯', top: false, desc: 'Crea señuelos para atrapar y registrar técnicas de atacantes.' },
        { id: 'sec-mando', name: 'Cifrado de Mando', price: 399.00, currency: 'USD', category: 'MEDIANA', icon: '📱', top: false, desc: 'Mensajería exclusiva para directivos con encriptación dual.' },
        { id: 'sec-api-audit', name: 'Auditor de APIs', price: 159.00, currency: 'USD', category: 'MEDIANA', icon: '🔌', top: false, desc: 'Supervisa conexiones críticas con bancos y apps externas.' },
        { id: 'sec-simulador', name: 'Simulador de Desastres', price: 299.00, currency: 'USD', category: 'MEDIANA', icon: '🔥', top: false, desc: 'Ataques controlados para encontrar grietas en la armadura.' },
        { id: 'sec-gobernanza', name: 'Gobernanza de Archivos', price: 189.00, currency: 'USD', category: 'MEDIANA', icon: '🗄️', top: false, desc: 'Impide la salida de documentos marcados como confidenciales.' },
        { id: 'sec-cloud-shield', name: 'Protector Cloud', price: 349.00, currency: 'USD', category: 'MEDIANA', icon: '☁️', top: false, desc: 'Blindaje específico para infraestructura en Google/Firebase.' },
        { id: 'sec-iam', name: 'Identidad Unificada (IAM)', price: 229.00, currency: 'USD', category: 'MEDIANA', icon: '🆔', top: false, desc: 'Control total de accesos y permisos según cargo y horario.' },
        { id: 'sec-resiliencia', name: 'Reporte de Resiliencia', price: 149.00, currency: 'USD', category: 'MEDIANA', icon: '📈', top: false, desc: 'Informe ejecutivo de ataques detenidos y riesgos evitados.' }
    ]
};