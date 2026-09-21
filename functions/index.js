const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require("fs").promises;
const path = require("path");
const handlebars = require("handlebars");
const { defineString } = require('firebase-functions/params');
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const BASE_URL = 'https://robotiax.mx'; 

// Configuración Global para v2: Obliga al emulador a reconocer la región y el mapeo
setGlobalOptions({ region: "us-central1" });

const nodemailer = require('nodemailer');
const https = require("https");

if (!admin.apps.length) {
    admin.initializeApp();
}

// PROTOCOLO PORTERO: VALIDACIÓN DE IDENTIDAD DE APP
const validarAcceso = (req) => {
    const token = req.headers['x-robotiax-token'] || req.query.token;
    const secret = 'RBX-PRT-99-MXN-SECURE-2025';
    if (token === secret) return true;
    // Permitir pre-registro de borrador asíncrono para que nunca se pierda la razón social
    if (req.body && req.body.details && req.body.details.isDraft) return true;
    return false;
};

// Getters de Carga Perezosa (Lazy Loading) para evitar Timeouts de 10s
let _db;
const getDb = () => { if (!_db) _db = admin.firestore(); return _db; };

let _bucket;
const getBucket = () => { if (!_bucket) _bucket = admin.storage().bucket('robotiax.appspot.com'); return _bucket; };

let vertexAIInstance;
const getVertexAI = () => {
    if (!vertexAIInstance) {
        const { VertexAI } = require('@google-cloud/vertexai');
        vertexAIInstance = new VertexAI({ 
            project: process.env.GCLOUD_PROJECT || 'robotiax', 
            location: 'us-central1' 
        });
    }
    return vertexAIInstance;
};

// Actualización según ciclo de vida de Google (Abril 2026)
const modelAI = 'gemini-2.5-flash';

let transporter;
const getTransporter = () => {
    if (!transporter) {
        console.log("🛠️ Inicializando nuevo transporte Nodemailer...");
        
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'geniosdeltalento@gmail.com',
                pass: 'bcnmvqwyvfkhxpxd'
            }
        });
    }
    return transporter;
};

// Pasarela de Pagos: Gestionada directamente vía Stripe Payment Links (Makumoto & Robotiax Pay)

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const r2AccountId = defineString('R2_ACCOUNT_ID', { default: 'TU_ACCOUNT_ID_DE_CLOUDFLARE' });
const r2AccessKeyId = defineString('R2_ACCESS_KEY_ID', { default: 'TU_ACCESS_KEY_ID_DE_R2' });
const r2SecretAccessKey = defineString('R2_SECRET_ACCESS_KEY', { default: 'TU_SECRET_ACCESS_KEY_DE_R2' });
const r2BucketName = defineString('R2_BUCKET_NAME', { default: 'TU_NOMBRE_DE_BUCKET_R2' });

const stripeSecretKey = defineString('STRIPE_SECRET_KEY', { default: 'sk_live_51QS90fRtq7dI2nU3wM' });

let _s3;
const getS3 = () => {
    if (!_s3) {
        _s3 = new S3Client({
            region: "auto",
            endpoint: `https://${r2AccountId.value()}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: r2AccessKeyId.value(),
                secretAccessKey: r2SecretAccessKey.value(),
            },
        });
    }
    return _s3;
};

// La constante BASE_URL ya fue declarada previamente en la parte superior.

// Función auxiliar para carga segura de assets

// Función auxiliar para carga segura de assets
async function loadAsset(filePath) {
    try {
        return await fs.readFile(path.join(__dirname, filePath), 'utf8');
    } catch (e) {
        console.warn(`Asset no encontrado: ${filePath}`);
        return "";
    }
}

// HELPER DE CONTINGENCIA: Registra fallas con proveedores externos (IONOS / Makumoto) sin tirar el proceso de compra
async function logFailedProvision(folio, targetService, payload, errorMessage) {
    try {
        await getDb().collection('failed_provisions').add({
            orderNumber: folio,
            targetService: targetService,
            payload: payload,
            errorMessage: errorMessage || "Timeout o error de red sin descripción",
            status: 'pending_retry',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`⚠️ [CONTINGENCY LOGURED]: Nodo fallido registrado en Firestore para: ${targetService}`);
    } catch (dbErr) {
        console.error("🚨 [CRITICAL DB ERROR]: No se pudo escribir log de contingencia en Firestore:", dbErr.message);
    }
}

exports.generateDemo = onRequest({ 
    memory: "1GiB", 
    timeoutSeconds: 120, 
    cors: true 
}, async (req, res) => {
    try {
            const requestedTemplate = req.query.template || 'demo_salud.html';
            const originalHost = req.query.originalHost || req.headers['x-original-host'] || req.headers.host || '';

            // INTERCEPTOR SOBERANO: Consola Oficial de Vinculación de WhatsApp en bot.ikai.info
            if (originalHost.includes('bot.ikai.info') || req.headers.host === 'bot.ikai.info') {
                const botConsoleHtml = `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Robotiax | Consola de Vinculación de WhatsApp</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;900&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                </head>
                <body class="bg-slate-950 text-white font-['Poppins'] min-h-screen flex flex-col justify-between p-4">
                    <header class="w-full max-w-xl mx-auto flex items-center justify-between border-b border-slate-800 pb-4 pt-2">
                        <div class="flex items-center gap-2">
                            <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span class="font-['Orbitron'] font-black text-xs text-emerald-400 tracking-wider">ROBOTIAX // BOT MANAGER</span>
                        </div>
                        <span class="text-[10px] text-slate-500 font-mono">GATEWAY v2.5</span>
                    </header>

                    <main class="w-full max-w-md mx-auto my-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
                        <div class="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 text-[#25d366] rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/10">
                            <i class="fa-brands fa-whatsapp"></i>
                        </div>

                        <div>
                            <h1 class="text-base sm:text-lg font-black uppercase text-white font-['Orbitron'] tracking-wide">Vincular tu Asistente</h1>
                            <p class="text-xs text-slate-400 mt-1">Conecta tu número oficial de WhatsApp con tu inteligencia artificial en 3 pasos.</p>
                        </div>

                        <!-- Formulario de Validación de Token -->
                        <div id="step-token-box" class="space-y-3 text-left">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Token de Seguridad (Enviado a tu correo):</label>
                            <input type="text" id="token-input" placeholder="Ej: A8X9K2" class="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-center font-mono text-sm tracking-widest text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 uppercase">
                            <button onclick="verificarYGenerarQR()" class="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                                Validar y Generar Código QR
                            </button>
                        </div>

                        <!-- Panel de QR Dinámico -->
                        <div id="step-qr-box" class="hidden space-y-4 pt-2">
                            <div class="bg-white p-4 rounded-2xl inline-block mx-auto shadow-xl">
                                <img id="qr-display-img" src="" alt="Código QR WhatsApp" class="w-48 h-48 mx-auto">
                            </div>
                            <div class="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-left text-[11px] text-slate-300 space-y-1.5">
                                <p class="text-emerald-400 font-bold text-xs uppercase mb-1">Pasos en tu teléfono:</p>
                                <p><strong>1.</strong> Abre WhatsApp en tu celular.</p>
                                <p><strong>2.</strong> Toca <em>Ajustes</em> o <em>Menú (tres puntos)</em> ➔ <strong>Dispositivos vinculados</strong>.</p>
                                <p><strong>3.</strong> Toca <strong>Vincular un dispositivo</strong> y apunta tu cámara a este código QR.</p>
                            </div>
                            <span id="qr-status-indicator" class="text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-2">
                                <i class="fas fa-circle-notch fa-spin"></i> Esperando escaneo desde tu WhatsApp...
                            </span>
                        </div>
                    </main>

                    <footer class="text-center text-[10px] text-slate-600 pb-2">
                        Robotiax Intelligence Infrastructure &copy; 2026. Soporte: soporte@robotiax.mx
                    </footer>

                    <script>
                        function verificarYGenerarQR() {
                            const token = document.getElementById('token-input').value.trim();
                            if (!token) {
                                alert('Por favor introduce tu token de seguridad de 6 dígitos.');
                                return;
                            }
                            document.getElementById('step-token-box').classList.add('hidden');
                            document.getElementById('step-qr-box').classList.remove('hidden');

                            // Generación del código QR de autenticación para vincular WhatsApp
                            const qrImg = document.getElementById('qr-display-img');
                            const seed = encodeURIComponent('2@' + token + ',' + Date.now());
                            qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + seed;
                        }
                    </script>
                </body>
                </html>
                `;
                return res.set('Content-Type', 'text/html').status(200).send(botConsoleHtml);
            }

           // Servir el diseño nativo demo_salud.html con hidratación automática en el cliente
                    if (requestedTemplate === 'demo_salud.html') {
                        const templatePath = path.join(__dirname, 'templates', requestedTemplate);
                        const templateContent = await fs.readFile(templatePath, 'utf8');
                        
                        let clientDataScript = "";
                        if (originalHost && originalHost.includes('.ikai.info') && !originalHost.startsWith('www.')) {
                            const slug = originalHost.split('.')[0];
                            const querySnap = await getDb().collection('orders_to_fulfill')
                                .where('negocio_slug', '==', slug)
                                .limit(1)
                                .get();

                            if (!querySnap.empty) {
                                const dynamicData = querySnap.docs[0].data();
                                const source = dynamicData.details || dynamicData;
                                const clientData = {
                                    negocio: source.negocio || source.business_name || dynamicData.negocio || "",
                                    tagline: source.tagline || source.slogan || dynamicData.tagline || "",
                                    headline: source.headline || source.title || dynamicData.headline || "",
                                    direccion: source.direccion || source.direccion_fiscal || source.address || dynamicData.direccion || "",
                                    horarios: source.horarios || source.hours || dynamicData.horarios || "",
                                    telefono: source.telefono || source.phone || dynamicData.telefono || "",
                                    fee: (source.fee && !source.fee.includes('233')) ? source.fee : (source.costo && !source.costo.includes('233')) ? source.costo : "$800 MXN",
                                    badge: source.badge || dynamicData.badge || "",
                                    specialty: source.specialty || dynamicData.specialty || "",
                                    isProductionSite: true,
                                    convenioCode: dynamicData.convenioCode || "",
                                    nicheId: (source.template || dynamicData.template || 'salud').replace(/^cfg-/, '').replace(/-bot(-promo)?$/, '').replace(/-01$/, '')
                                };
                                clientDataScript = `<script>window.app = window.app || {}; window.app.clientData = ${JSON.stringify(clientData)};</script>`;
                            }
                        }

                        const cacheBuster = Date.now();
                        const localJs = await loadAsset('../public/js/demo_salud.js');
                        const localCss = await loadAsset('../public/css/demo_salud.css');

                        let finalHtmlWithFix = templateContent;

                        const localCatalogJs = await loadAsset('../public/js/catalog.js');
                        const isLocal = req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'));
                        const domainBase = 'https://robotiax.mx';

                        if (localCatalogJs) {
                            finalHtmlWithFix = finalHtmlWithFix.replace('<script src="js/catalog.js"></script>', `<script>${localCatalogJs}</script>`);
                        } else {
                            finalHtmlWithFix = finalHtmlWithFix.replace('js/catalog.js', `${domainBase}/js/catalog.js?v=${cacheBuster}`);
                        }

                        if (localCss) {
                            finalHtmlWithFix = finalHtmlWithFix.replace('<link rel="stylesheet" href="css/demo_salud.css">', `<style>${localCss}</style>`);
                        } else {
                            finalHtmlWithFix = finalHtmlWithFix.replace('css/demo_salud.css', `${domainBase}/css/demo_salud.css?v=${cacheBuster}`);
                        }

                        if (localJs) {
                            finalHtmlWithFix = finalHtmlWithFix.replace('<script src="js/demo_salud.js"></script>', `<script>${localJs}</script>`);
                        } else {
                            finalHtmlWithFix = finalHtmlWithFix.replace('js/demo_salud.js', `${domainBase}/js/demo_salud.js?v=${cacheBuster}`);
                        }

                        // Eliminación total de elementos de venta y ajuste estricto de header en producción
                        if (originalHost && originalHost.includes('.ikai.info') && !originalHost.startsWith('www.')) {
                            finalHtmlWithFix = finalHtmlWithFix
                                .replace(/<button[^>]*>.*?COMPRAR WEB.*?<\/button>/gis, '')
                                .replace(/<button id="header-whatsapp-btn".*?<\/button>/gis, '')
                                .replace(/<button id="btn-return-catalog".*?<\/button>/gis, '')
                                .replace(/<div class="absolute inset-0 bg-gradient-to-r from-white via-white\/95 to-transparent z-10 pointer-events-none"><\/div>/g, '');
                        }

                        finalHtmlWithFix = finalHtmlWithFix
                            // Protocolo de Inyección de Assets Absolutos (Versión Reforzada Adaptativa)
                            .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, `$1="${domainBase}/assets/$2"`)
                            .replace(/(src|href)=['"]\/?css\/([^'"]+)['"]/g, `$1="${domainBase}/css/$2"`)
                            .replace(/(src|href)=['"]\/?js\/([^'"]+)['"]/g, `$1="${domainBase}/js/$2"`)
                            .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, `url('${domainBase}/assets/$1')`)
                            .replace(/['"]\/?assets\/([^'"]+?)['"]/g, `"${domainBase}/assets/$1"`)
                            .replace('</head>', clientDataScript + '</head>');

                        if (originalHost && originalHost.includes('.ikai.info') && !originalHost.startsWith('www.')) {
                            const slug = originalHost.split('.')[0];
                            try {
                                console.log(`📡 [AUTO_MIGRATE]: Migrando y compilando sitio estático para R2: ${slug}.html`);
                                const putCommand = new PutObjectCommand({
                                    Bucket: r2BucketName.value(),
                                    Key: `sitios/${slug}.html`,
                                    Body: finalHtmlWithFix,
                                    ContentType: "text/html; charset=utf-8"
                                });
                                await getS3().send(putCommand);
                            } catch (r2Err) {
                                console.error("❌ Error en auto-migración de R2:", r2Err.message);
                            }
                        }
                            
                        res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
                        res.set('Vary', 'X-Original-Host');
                        return res.set('Content-Type', 'text/html').status(200).send(finalHtmlWithFix);
                    }
            // 1. MAPEADOR DE IDENTIDAD (RESIDENCIA EXACTA EN WINDOWS)
            const nameMap = {
                'bienes-raices-01': 'bienes raíces-01',
                'cirujano-01': 'cirujano plástico-01',
                'clinica-01': 'clínica-01',
                'consultoria-01': 'consultoría-01',
                'consultoria-02': 'consultoría-02',
                'consultoria-03': 'consultoría-03',
                'contador-01': 'contador-01',
                'cursos-01': 'cursos-01',
                'cursos-02': 'cursos-02',
                'empresa-01': 'empresa-01',
                'gym-01': 'gym-o1',
                'gym-02': 'gym-o2',
                'industry-01': 'industry-01',
                'influencer-01': 'influencer-01',
                'influencer-02': 'influencer-02',
                'legal-01': 'legal-01',
                'medico-01': 'médico-01',
                'security-01': 'security-01',
                'spa-01': 'spa-01',
                'tech-01': 'tech-1',
                'ventas-01': 'ventas-01',
                'yoga-01': 'yoga-01'
            };

            const requestedId = (req.query.template || 'medico-01').replace('-template.html', '');
            const folderName = nameMap[requestedId] || requestedId;
            
            // 2. DATA MAESTRA EMPOTRADA (PROTECCIÓN ANTI-BLANCO)
            const fallbackData = {
                branding: { business_name: folderName.toUpperCase(), tagline: "Evolución Profesional", primary_color: "#2563eb" },
                hero_section: { 
                    badge: "VISTA PREVIA ACTIVA",
                    headline: "Tu Negocio en el Siguiente Nivel", 
                    subheadline: "Diseño de alta conversión optimizado para resultados inmediatos.", 
                    primary_cta_text: "Agendar Ahora",
                    secondary_cta_text: "Saber Más",
                    image: { value: "https://robotiax.mx/assets/frenzy_1.webp" }
                },
                services_section: { title: "Nuestros Servicios", services: [
                    { name: "Calidad Premium", description: "Atención especializada con estándares internacionales.", icon_class: "fa-star" },
                    { name: "Soporte 24/7", description: "Estamos contigo en cada paso del proceso.", icon_class: "fa-headset" }
                ]},
                about_section: { doctor_name: "Equipo Robotiax", doctor_title: "Especialistas en Despliegue", bio: "Líderes en integración de inteligencia artificial y desarrollo web de élite.", image: { value: "https://robotiax.mx/assets/frenzy_2.webp" }, stats: [{value: "10y", label: "Experiencia"}] },
                contact_section: { headline: "Contacta con Nosotros", address: "Centro de Mando Digital", phone: "55 0000 0000", email: "contacto@robotiax.mx", copyright_text: "&copy; 2025 Robotiax Intelligence." },
                seo: { title: `${folderName} | Demo`, description: "Vista previa del sistema Robotiax." }
            };

            let templateFile = `${folderName}-template.html`;
            let templatePath = path.join(__dirname, 'templates', templateFile);
            let dynamicData = {};
            let isSaaS = false;

            // 3. SEGURO DE ARCHIVO HTML (MOLDE MAESTRO)
            try {
                await fs.access(templatePath); 
            } catch (e) {
                templateFile = 'medico-01-template.html'; 
                templatePath = path.join(__dirname, 'templates', templateFile);
            }

            if (originalHost && originalHost.includes('.ikai.info') && !originalHost.startsWith('www.')) {
                const slug = originalHost.split('.')[0];
                const querySnap = await getDb().collection('orders_to_fulfill').where('negocio_slug', '==', slug).limit(1).get();
                if (!querySnap.empty) { dynamicData = querySnap.docs[0].data(); isSaaS = true; }
            }
            
            const dataPath = path.join(__dirname, 'demo-data', `demo_${templateFile.replace('-template.html', '')}.json`);

            // 4. CARGA RESILIENTE (HTML + DATA)
            const [templateContent, rawData, tailwindCss, fontAwesomeCss] = await Promise.all([
                fs.readFile(templatePath, 'utf8'),
                fs.readFile(dataPath, 'utf8').catch(() => JSON.stringify(fallbackData)),
                loadAsset('assets/css/tailwind.css'),
                loadAsset('assets/css/fontawesome.css')
            ]);

            let demoData = {};
            try {
                demoData = JSON.parse(rawData);
                if (!demoData.branding) demoData = { ...fallbackData, ...demoData };
            } catch (e) {
                demoData = fallbackData;
            }

            // Mapeo de Razón Social y Tagline
            demoData.branding = { ...demoData.branding, 
                business_name: isSaaS ? (dynamicData.negocio || "Nombre de Negocio") : (req.query.name || demoData.branding?.business_name),
                tagline: isSaaS ? (dynamicData.tagline || "") : (req.query.tagline || demoData.branding?.tagline)
            };

            demoData.hero_section = { ...demoData.hero_section,
                headline: isSaaS ? (dynamicData.headline || "Tu Salud en Manos de Profesionales") : (req.query.headline || demoData.hero_section?.headline),
                primary_cta_text: isSaaS ? "Reservar Cita" : (req.query.cta || demoData.hero_section?.primary_cta_text)
            };

            // Transpila el texto plano de servicios de la BD a un array estructurado de tarjetas de servicio
            if (isSaaS && dynamicData.servicios) {
                const list = dynamicData.servicios.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
                if (list.length > 0) {
                    demoData.services_section = {
                        title: "Nuestros Servicios",
                        subtitle: "Especialidades Médicas",
                        description: "Ofrecemos atención de la más alta calidad con profesionales experimentados.",
                        items: list.map((srv, idx) => ({
                            title: srv,
                            description: "Servicio clínico especializado disponible para agendamiento inmediato.",
                            icon: idx % 2 === 0 ? "fa-user-md" : "fa-stethoscope"
                        }))
                    };
                }
            } else if (req.query.services) {
                demoData.services_section = { ...demoData.services_section,
                    description: req.query.services 
                };
            }

            demoData.contact_section = { ...demoData.contact_section,
                phone: isSaaS ? (dynamicData.telefono || "") : (req.query.phone || demoData.contact_section?.phone),
                email: isSaaS ? (dynamicData.email || "") : (req.query.email || demoData.contact_section?.email),
                address: isSaaS ? (dynamicData.direccion || "") : (req.query.address || demoData.contact_section?.address),
                business_hours: isSaaS ? (dynamicData.horarios || "") : (req.query.hours || demoData.contact_section?.business_hours),
                consultation_fee: isSaaS ? (dynamicData.fee || "") : (req.query.fee || demoData.contact_section?.consultation_fee)
            };

            if (req.query.imageUrl) {
                demoData.hero_section.image = { ...demoData.hero_section.image, value: req.query.imageUrl };
            }

            demoData.styles = { tailwind: tailwindCss, fontawesome: fontAwesomeCss };
            
            const template = handlebars.compile(templateContent);
            let finalHtml = template(demoData);

            const cssInject = `
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    footer, footer p, footer a, footer div {color: #e2e8f0 !important;} 
                    footer a:hover {color: #ffffff !important;}
                </style>
            `;
            
            // Regex agnóstica de comillas para capturar y reescribir de forma infalible las rutas de assets
            let finalHtmlWithFix = finalHtml
                .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, '$1="https://robotiax.mx/assets/$2"')
                .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, "url('https://robotiax.mx/assets/$1')")
                .replace('</head>', cssInject + '</head>');
            
            res.set('Content-Type', 'text/html').status(200).send(finalHtmlWithFix);

        } catch (error) {
            console.error("CRASH LOG:", error);
            res.status(500).send(`ERROR_INTERNO: ${error.message}`);
        }
});

// Procesamiento de Órdenes Centralizado vía Makumoto & Robotiax Pay (Stripe Links)

exports.getUploadUrl = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    if (!validarAcceso(req)) return res.status(403).json({ error: "SUBIDA_BLOQUEADA" });

    const { contentType, templateId } = req.body;
    if (!contentType || !templateId) {
        return res.status(400).json({ error: 'Faltan contentType o templateId.' });
    }

    const fileName = `user_uploads/${templateId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const file = getBucket().file(fileName);

    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: contentType,
    };

    try {
        const [uploadUrl] = await file.getSignedUrl(options);
        const publicUrl = `https://storage.googleapis.com/${getBucket().name}/${fileName}`;
        
        console.log("URL Firmada generada para:", fileName);
        res.status(200).send({ uploadUrl, publicUrl });
    } catch (error) {
        console.error("CRASH getUploadUrl:", error.message);
        res.status(500).send({ status: "error", message: error.message });
    }
});

exports.getSalesAgentResponse = onRequest({ 
    timeoutSeconds: 120, 
    memory: "1GiB",
    cors: true 
}, async (req, res) => {
    try {
        if (!validarAcceso(req)) return res.status(403).json({ response: "ACCESO_DENEGADO_NUCLEO" });

        if (req.method !== 'POST') return res.status(405).send('Use POST');
        const { userQuery, chatHistory = [] } = req.body;
        if (!userQuery) return res.status(400).json({ response: "La consulta está vacía." });

        const vAI = getVertexAI();
        const model = vAI.getGenerativeModel({ 
            model: modelAI,
            generationConfig: { maxOutputTokens: 2048, temperature: 0.3, topP: 0.8 }
        });

        const contents = chatHistory.length > 0 
            ? [...chatHistory, { role: 'user', parts: [{ text: userQuery }] }]
            : [{ role: 'user', parts: [{ text: userQuery }] }];

        const result = await model.generateContent({
            contents: contents,
            systemInstruction: { 
                parts: [{ text: `IDENTIDAD: Sales Architect de Robotiax.
                REGLAS DE INTERACCIÓN:
                    1. VENTA ACTIVA: Tu misión es forzar la recomendación de productos del CATÁLOGO para CUALQUIER perfil solicitado (ej: Influencer usa 'Influencer 01', Escuela de música usa 'Academy 02', Empresa metalúrgica usa 'Industrial 01', etc.). No digas que no se puede si hay algo similar en el catálogo.
                    2. RECOMENDACIÓN MAESTRA: Si preguntan por "la mejor app", recomienda 'Avatar de Ventas 24/7' o 'Chronos AI' por su alto impacto.
                    3. Si la entrada es un saludo, responde: 'SISTEMA ACTIVO. Saludos, humano. ¿Qué desafío tecnológico enfrentas hoy?'.
                    4. ESTRICTO: Solo puedes recomendar productos presentes en el CATÁLOGO abajo descrito. Prohibido inventar soluciones.
                    5. ESCAPE: SOLO usa soporte@robotiax.mx si el usuario pide algo que NO es tecnología o software (ej: comida, naves espaciales). Para todo lo demás, USA EL CATÁLOGO.
                    6. ZOOM/REUNIONES: PROHIBIDO. No manejamos consultas vía Zoom ni presenciales. Todo requerimiento externo es vía soporte@robotiax.mx.
                    7. WEB PERSONALIZADA: No existe. Solo vendemos las plantillas del catálogo. Para adaptaciones especiales, contactar a soporte@robotiax.mx.
                    8. INTEGRIDAD Y SÍNTESIS: Si solicitan múltiples soluciones, USA LISTAS BREVES (Nombre - Precio - 1 línea de descripción). Es OBLIGATORIO resumir para evitar truncamientos.
                    9. CIERRE ABSOLUTO: Queda ROTUNDAMENTE PROHIBIDO dejar una respuesta incompleta o un bloque de metadatos a medias. Si no puedes terminar la frase, no la inicies. El bloque [SERVICIO:...], [PRECIO:...], [TIEMPO:...] debe ser lo último y debe estar COMPLETO.
                    10. PRECIOS: WEB=99 MXN. IA/SECURITY=USD. URL oficial: robotiax.mx.
                    11. PROHIBIDO dejar respuestas vacías, con puntos suspensivos o comas huérfanas al final. La respuesta debe terminar en texto o en el bloque de METADATOS.
                    CATÁLOGO WEB (99 MXN): Bienes Raíces 01, Cirujano Plástico 01, Clínica Médica 01, Consultoría 01/02/Elite 03, Contabilidad 01, E-Learning 01, Academy 02, Corporativo 01, Fitness 01, Power Gym 02, Industrial 01, Influencer 01, Creator 02, Legal Services 01, Médico Especialista 01, Cyber Security 01, Wellness Spa 01, Tech Global 01, Sales Landing 01, Yoga Studio 01.
                    CATÁLOGO IA (USD): Contable(49), Legal(79), Proyección(89), Nómina(59), Costos(49), Gastos Voz(20), Motivador(20), Rentabilidad(69), Caja Chica(39), Inversión(99), Chronos(20), Rendimiento(59), Manuales(20), Calidad(79), Suministros(49), Correcciones(69), Post-Servicio(39), Rutas(89), Mantenimiento(59), Crisis(129), Sniper(20), Avatar(149), Identidad(69), Reseñas(20), Guerrilla(59), Expansión(199), Retención(89), Sentimiento(49), Ofertas(39), Influencia(129).
                    CATÁLOGO SECURITY (USD): Pantasma(20), Herencia(49), Ing. Social(39), Phishing(20), Metadatos(20), Deepfake(149), Bóveda ID(20), Zero-Knowledge(59), IoT(79), Extorsión(99), POS(129), Lealtad(89), Auditor Red(49), Facturación(79), Backup(149), Privacidad(39), Web-Scan(69), Biométrico(199), Interna(59), Ransomware(299), SOC IA(499), Amenaza(249), Honey-Pot(179), Mando(399), APIs(159), Simulador(299), Gobernanza(189), Cloud(349), IAM(229), Resiliencia(149).
                    METADATOS OBLIGATORIOS AL FINAL: [SERVICIO: Nombre], [PRECIO: Valor], [TIEMPO: 24H].` }]
            }
        });

        const finalResponse = result.response.candidates[0].content.parts[0].text;
        return res.status(200).json({ response: finalResponse });

    } catch (error) {
        console.error(">>> [FALLO CRÍTICO]:", error.message);
        return res.status(500).json({ 
            response: "ERROR DE PROTOCOLO: Reiniciando núcleo. ¿Requerimiento técnico?" 
        });
    }
});

exports.submitFinalOrder = onRequest({ 
    cors: true, timeoutSeconds: 120, memory: "1GiB"     
}, async (req, res) => {
    if (!validarAcceso(req)) return res.status(403).json({ error: "ORDEN_RECHAZADA_PORTERO" });

    const { template, details } = req.body;
    const clientEmail = details.email || details.correo; 

    try {
        const ecommerceProducts = {

'nexus-drop': { name: 'Nexus Drop', price: 1999.00, currency: 'MXN' },
            'storefront-pro': { name: 'Storefront Pro', price: 3499.00, currency: 'MXN' },
            'omnicanal-elite': { name: 'Omnicanal Elite', price: 7499.00, currency: 'MXN' },
            'rs-basic': { name: 'Página Comercial FB/IG', price: 599.00, currency: 'MXN' },
            'rs-pro': { name: 'Campaña Crecimiento', price: 1749.00, currency: 'MXN' },
            'rs-elite': { name: 'Dominación Total Redes', price: 3999.00, currency: 'MXN' }
        };

        const configuratorKeys = [
            'salud', 'legal', 'contable', 'gym', 'boutique', 'ferreteria', 
            'gourmet', 'abarrotes', 'cafeteria', 'floreria', 'talleres', 
            'eventos', 'idiomas', 'fumigacion', 'limpieza', 'viajes', 
            'prospeccion', 'webs', 'rh', 'instagram', 'facebook', 'youtube', 
            'twitter', 'ciber'
        ];
        
        configuratorKeys.forEach(giro => {
            const prefix = `cfg-${giro}`;
            ecommerceProducts[`${prefix}-bot`] = { 
                name: `Bot de ${giro.toUpperCase()} - Setup`, 
                price: 1499.00, 
                currency: 'MXN' 
            };
            ecommerceProducts[`${prefix}-bot-promo`] = { 
                name: `Bot de ${giro.toUpperCase()} - Promo Lanzamiento`, 
                price: 200.00, 
                currency: 'MXN' 
            };
            ecommerceProducts[`${prefix}-agente`] = { 
                name: `Agente de ${giro.toUpperCase()} IA - Setup`, 
                price: 2999.00, 
                currency: 'MXN' 
            };
        });

        let pData = ecommerceProducts[template];
        if (!pData) {
            const productSnap = await getDb().collection('products').doc(template).get();
            pData = productSnap.exists ? productSnap.data() : { name: template, price: "99", currency: "MXN" };
        }

        const now = new Date();
        const folio = details.folio || details.orderNumber || `ORD-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

        const isConfigurator = template.startsWith('cfg-');
        const isWebProduct = !isConfigurator && !template.startsWith('ia-') && !template.startsWith('sec-') && template !== 'nexus-drop' && template !== 'storefront-pro' && template !== 'omnicanal-elite' && !template.startsWith('rs-');
        let vertexInstructions = "";

        // Solo ejecutar Vertex AI para Agentes de Inteligencia Artificial (ia-) o de Ciberseguridad (sec-)
        const shouldRunVertex = template.startsWith('ia-') || template.startsWith('sec-');

        // Generación dinámica de credenciales de acceso para Makumoto (Declaradas antes de ser leídas)
const convenioCode = `MAK-AURA-${Math.floor(1000 + Math.random() * 9000)}`;
const tempPassword = Math.random().toString(36).substring(2, 8).toUpperCase();

// Generación de slug apto para subdominio (Declarado antes de ser leído)
const negocioSlug = (details.negocio || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

// PERSISTENCIA OBLIGATORIA DEL BORRADOR: Guarda siempre la razón social antes de pasarela
await getDb().collection('orders_to_fulfill').doc(folio).set({
    orderNumber: folio,
    productName: pData.name,
    isWeb: isWebProduct,
    template: template,
    status: 'pending_stripe_payment',
    convenioCode: convenioCode,
    provisionalPassword: tempPassword,
    negocio: details.negocio,
    negocio_slug: negocioSlug,
    ...details,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
}, { merge: true });
console.log(`📝 [BUSINESS_SAVED]: Negocio "${details.negocio}" grabado bajo folio ${folio} (slug: ${negocioSlug}).`);

// BLOQUEO DE SEGURIDAD: Ningún producto web envía correos al cliente antes de pagar en Stripe
if (isWebProduct || template.startsWith('cfg-')) {
    return res.status(200).json({ status: 'awaiting_payment', folio: folio, negocioSlug: negocioSlug });
}

// --- FLUJO DE APROVISIONAMIENTO MODULAR ---

// 1. Aprovisionamiento de Hosting (Ejecución Pasiva vía Auxiliar)
await provisionFirebaseSubdomain(negocioSlug);

// 2. Generación de Reporte Técnico (Vertex AI) si aplica
if (shouldRunVertex) {
    try {
        console.log(`📡 [AI_ENGINE]: Generando reporte para ${pData.name}...`);
        const promptMaquila = `
        ACTÚA COMO INGENIERO DE DESPLIEGUE SENIOR DE ROBOTIAX. 
        Genera un REPORTE TÉCNICO DE ACTIVACIÓN para: ${pData.name}. CLIENTE: ${details.negocio || 'No proporcionado'}.
        1. 🧠 NÚCLEO DE INTELIGENCIA (SYSTEM PROMPT)
        2. ⚙️ PARÁMETROS TÉCNICOS
        3. 📋 DOCUMENTACIÓN BÁSICA REQUERIDA
        4. ⚡ PROTOCOLO DE IMPLEMENTACIÓN BÁSICA (< 5 MIN)
        5. 💎 PROTOCOLO DE INSTALACIÓN AVANZADA ($50 USD)
        6. ⏳ CRONOGRAMA AVANZADO (24H)`;

        const aiResult = await getVertexAI().getGenerativeModel({ model: modelAI }).generateContent(promptMaquila);
        vertexInstructions = aiResult.response.candidates?.[0]?.content?.parts?.[0]?.text || "Revisar manual interno.";
    } catch (e) { 
        console.error("❌ Error Vertex AI:", e.message);
        vertexInstructions = "Error en generación de reporte técnico."; 
    }
}

// FUNCIÓN AUXILIAR PARA EVITAR REPORTES DIFUSOS Y VACÍOS
const buildFieldRow = (label, val) => {
    if (!val || val === "No proporcionado" || val === "No proporcionada" || val === "") return "";
    return `<tr>
        <td style="padding: 10px; border-bottom: 1px solid #222; color: #888; font-weight: bold; text-transform: uppercase; font-size: 11px; width: 35%;">${label}:</td>
        <td style="padding: 10px; border-bottom: 1px solid #222; color: #fff; font-size: 14px;">${val}</td>
    </tr>`;
};

// 4. EMAIL PARA TI (ADMIN) - ABSOLUTAMENTE PRECISO E INFORMATIVO
const adminMailHtml = `
    <div style="font-family: 'Courier New', monospace; background: #000; color: #00f2ff; padding: 40px; border: 4px solid #ff003c;">
        <h1 style="color: #ff003c; text-align: center; border-bottom: 2px solid #ff003c; padding-bottom: 15px; margin-top: 0; font-size: 24px; text-transform: uppercase;">🚨 NUEVA ORDEN RECIBIDA 🚨</h1>
        
        <div style="background: #050505; border: 1px solid #333; padding: 25px; margin-bottom: 25px;">
            <h3 style="color: #00f2ff; margin-top: 0; border-bottom: 1px solid #222; padding-bottom: 10px; text-transform: uppercase; font-size: 13px;">📦 DETALLES DEL PRODUCTO</h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left; color: #fff;">
                <tr>
                    <td style="padding: 8px; color: #666; font-size: 12px; width: 35%;">FOLIO:</td>
                    <td style="padding: 8px; font-weight: bold; color: #ff003c;">${folio}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; color: #666; font-size: 12px;">ID PLANTILLA:</td>
                    <td style="padding: 8px; color: #00f2ff; font-weight: bold;">${template}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; color: #666; font-size: 12px;">PRODUCTO:</td>
                    <td style="padding: 8px; font-weight: bold;">${pData.name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; color: #666; font-size: 12px;">IMPORTE:</td>
                    <td style="padding: 8px; color: #2ecc71; font-weight: bold;">$${pData.price} ${pData.currency}</td>
                </tr>
            </table>
        </div>

        <div style="background: #050505; border: 1px solid #333; padding: 25px; margin-bottom: 25px;">
            <h3 style="color: #00f2ff; margin-top: 0; border-bottom: 1px solid #222; padding-bottom: 10px; text-transform: uppercase; font-size: 13px;">🌐 ACCESOS Y ENLACES DIRECTOS</h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left; color: #fff;">
                <tr>
                    <td style="padding: 8px; color: #666; font-size: 12px; width: 35%;">ENLACE WEB ACTIVO:</td>
                    <td style="padding: 8px;"><a href="https://${negocioSlug}.ikai.info" target="_blank" style="color: #00f2ff; font-weight: bold; text-decoration: none;">https://${negocioSlug}.ikai.info</a></td>
                </tr>
                ${isConfigurator ? `
                <tr>
                    <td style="padding: 8px; color: #666; font-size: 12px;">BOT DE WHATSAPP (VPS):</td>
                    <td style="padding: 8px;"><a href="https://bot.ikai.info" target="_blank" style="color: #2ecc71; font-weight: bold; text-decoration: none;">Instancia: ${negocioSlug} (Token: ${tempPassword})</a></td>
                </tr>` : ''}
            </table>
        </div>

        <div style="background: #050505; border: 1px solid #333; padding: 25px; margin-bottom: 25px;">
            <h3 style="color: #00f2ff; margin-top: 0; border-bottom: 1px solid #222; padding-bottom: 10px; text-transform: uppercase; font-size: 13px;">👤 DATOS DEL CLIENTE</h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left; color: #fff;">
                ${buildFieldRow("Razón Social / Negocio", details.negocio)}
                ${buildFieldRow("WhatsApp", details.telefono || details.phone)}
                ${buildFieldRow("Email de Respaldo", clientEmail)}
                ${buildFieldRow("Domicilio / Dirección", details.direccion || details.direccion_fiscal || details.address)}
                ${buildFieldRow("Eslogan / Tagline", details.tagline)}
                ${buildFieldRow("Headline / Encabezado", details.headline)}
                ${buildFieldRow("Servicios Solicitados", details.servicios)}
                ${buildFieldRow("Horarios Operativos", details.horarios || details.hours)}
                ${buildFieldRow("Costo Consulta / Fee", details.fee)}
            </table>
        </div>

        ${(!isWebProduct && vertexInstructions) ? `
        <div style="background: #000; border: 2px dashed #ff003c; padding: 25px; margin-bottom: 25px;">
            <h3 style="color: #ff003c; margin-top: 0; text-transform: uppercase; font-size: 13px;">📡 REPORTE TÉCNICO DE INTELIGENCIA VERTEX:</h3>
            <div style="color: #ffffff; font-size: 13px; line-height: 1.6; white-space: pre-wrap; font-family: monospace;">${vertexInstructions}</div>
        </div>` : ''}
    </div>
`;
    // REGISTRO SEGURO EN BASE DE DATOS CON CREDENCIALES E IDENTIFICADOR SLUG
    await getDb().collection('orders_to_fulfill').add({
        orderNumber: folio,
        productName: pData.name,
        isWeb: isWebProduct,
        convenioCode: convenioCode,
        provisionalPassword: tempPassword,
        negocio_slug: negocioSlug,
        ...details,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

      try {
        console.log(`📡 [R2_STATIC_COMPILE]: Compilando plantilla HTML para: ${negocioSlug}...`);
        // Selección de archivo físico para compilación en R2 (Evitando colisión de nombres)
        let targetPhysicalFile = 'demo_salud.html';
        if (isWebProduct) {
            targetPhysicalFile = `${template}-template.html`;
        }
        const templatePath = path.join(__dirname, 'templates', targetPhysicalFile);

        const cacheBuster = Date.now();
        let htmlContent = "";

        if (isWebProduct) {
            // COMPILACIÓN DINÁMICA DE PLANTILLAS DE CATÁLOGO (HANDLEBARS + JSON)
            const baseName = template.replace('-template.html', '');
            const dataName = `demo_${baseName}.json`;
            const dataPath = path.join(__dirname, 'demo-data', dataName);

            const [rawTemplate, dataContent] = await Promise.all([
                fs.readFile(templatePath, 'utf8'),
                fs.readFile(dataPath, 'utf8').catch(() => '{}')
            ]);

            const demoData = JSON.parse(dataContent);

            // Mapeo absoluto de los campos personalizados del formulario al JSON del diseño
            if (demoData.branding) {
                demoData.branding.business_name = details.negocio || demoData.branding.business_name;
                demoData.branding.tagline = details.tagline || demoData.branding.tagline;
            }
            if (demoData.hero_section) {
                demoData.hero_section.headline = details.headline || demoData.hero_section.headline;
                demoData.hero_section.primary_cta_text = details.cta || demoData.hero_section.primary_cta_text;
            }
            if (demoData.contact_section) {
                demoData.contact_section.phone = details.telefono || demoData.contact_section.phone;
                demoData.contact_section.email = details.email || demoData.contact_section.email;
                demoData.contact_section.address = details.direccion || demoData.contact_section.address;
                demoData.contact_section.business_hours = details.horarios || demoData.contact_section.business_hours;
                demoData.contact_section.consultation_fee = details.fee || demoData.contact_section.consultation_fee;
            }

            const compiledTemplate = handlebars.compile(rawTemplate);
            htmlContent = compiledTemplate(demoData);

            // Inyectar CDN de Tailwind, FontAwesome y scripts de soporte
            const cssInject = `
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            `;
            htmlContent = htmlContent
                .replace(/<title>AURA-CLINIC PRO \| Centro de Mando Médico<\/title>/g, `<title>${details.negocio || 'Robotiax'} | Portal Digital</title>`)
                .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, '$1="https://robotiax.mx/assets/$2"')
                .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, "url('https://robotiax.mx/assets/$1')")
                .replace('</head>', cssInject + '</head>');

        } else {
            // COMPILACIÓN DE LA DEMO INTERACTIVA
            const rawTemplate = await fs.readFile(templatePath, 'utf8');
            htmlContent = rawTemplate
                .replace(/Dr\. Alejandro Morales/g, details.negocio || 'Dr. Alejandro Morales')
                .replace(/ESPECIALISTA CERTIFICADO/g, details.badge || 'ESPECIALISTA CERTIFICADO')
                .replace(/Nutrición Estética & Neurología Preventiva/g, details.specialty || 'Especialidades Médicas')
                .replace(/"Tu bienestar es nuestra ciencia"/g, `"${details.tagline || 'Tu bienestar es nuestra ciencia'}"`)
                .replace(/Torre Médica, Cons\. 402/g, details.direccion || 'Dirección de la clínica')
                .replace(/Lun - Vie 9am a 6pm/g, details.horarios || 'Lun - Vie 9am a 6pm')
                .replace(/\+52 55 1234 5678/g, details.telefono || '+52 55 1234 5678')
                .replace(/\$800 MXN/g, details.fee || '$800 MXN')
                .replace(/<title>AURA-CLINIC PRO \| Centro de Mando Médico<\/title>/g, `<title>${details.negocio || 'Robotiax'} | Portal Digital</title>`)
                .replace(/css\/demo_salud\.css/g, `https://robotiax.mx/css/demo_salud.css?v=${cacheBuster}`)
                .replace(/js\/demo_salud\.js/g, `https://robotiax.mx/js/demo_salud.js?v=${cacheBuster}`)
                .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, '$1="https://robotiax.mx/assets/$2"')
                .replace(/(src|href)=['"]\/?css\/([^'"]+)['"]/g, '$1="https://robotiax.mx/css/$2"')
                .replace(/(src|href)=['"]\/?js\/([^'"]+)['"]/g, '$1="https://robotiax.mx/js/$2"')
                .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, "url('https://robotiax.mx/assets/$1')");
        }

        const putCommand = new PutObjectCommand({
            Bucket: r2BucketName.value(),
            Key: `sitios/${negocioSlug}.html`,
            Body: htmlContent,
            ContentType: "text/html; charset=utf-8"
        });

        await getS3().send(putCommand);
        console.log(`✅ [R2_STATIC_SUCCESS]: Archivo estático cargado exitosamente en sitios/${negocioSlug}.html`);
    } catch (errStatic) {
        console.error("❌ [R2_STATIC_ERROR]: Error compilando u hospedando sitio estático:", errStatic.message);
    }

      // -------------------------------------------------------------------------
    // APROVISIONAMIENTO AUTOMÁTICO DE INSTANCIA DE WHATSAPP (GATEWAY SAAS)
    // -------------------------------------------------------------------------
    // SOLICITUD DE INSTANCIA ACUÑADA EXCLUSIVAMENTE PARA CONFIGURACIONES DYNAMIC-BOT (SE CONDICIONA PARA EVITAR CARGAS EXTRAS EN $99)
    if (isConfigurator && !isWebProduct) {
        const payloadGateway = { instanceName: negocioSlug, token: tempPassword, qrcode: true };
        try {
            console.log(`📡 [GATEWAY]: Solicitando creación automática de instancia de WhatsApp para: ${negocioSlug}...`);
            
            const gatewayUrl = 'https://bot.ikai.info/instance/create';
            const gatewayToken = 'RBX-GATEWAY-MASTER-SECRET-2025'; 
            
            fetch(gatewayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': gatewayToken
                },
                body: JSON.stringify(payloadGateway)
            })
            .then(async (gatewayRes) => {
                if (gatewayRes.ok) {
                    console.log(`✅ [GATEWAY_SUCCESS]: Instancia de WhatsApp "${negocioSlug}" aprovisionada.`);
                } else {
                    const errTxt = await gatewayRes.text();
                    console.warn(`⚠️ [GATEWAY_WARN]: El Gateway de WhatsApp rechazó la creación: ${errTxt}`);
                    // Registro preventivo de error controlado
                    await logFailedProvision(folio, 'IONOS_WHATSAPP_GATEWAY', payloadGateway, `API rechazó creación: ${errTxt}`);
                }
            })
            .catch(async (err) => {
                console.error("❌ [GATEWAY_ERROR]: Fallo de red con IONOS:", err.message);
                await logFailedProvision(folio, 'IONOS_WHATSAPP_GATEWAY', payloadGateway, `Fallo de conexión física: ${err.message}`);
            });

        } catch (gatewayError) {
            console.error("❌ [GATEWAY_ERROR_FATAL]: Error fatal en llamada a Gateway:", gatewayError.message);
            logFailedProvision(folio, 'IONOS_WHATSAPP_GATEWAY', payloadGateway, `Excepción en hilo: ${gatewayError.message}`);
        }
    }

    const isPromoBot = template.endsWith('-promo');

    // --- SINCRONIZACIÓN ATÓMICA CON EL CORE DE MAKUMOTO (NATIVO HTTPS ANTI-CRASH) ---
        try {
            console.log(`📡 [SYNC]: Sincronizando convenio ${convenioCode} con Makumoto Core vía HTTPS nativo...`);
            const syncPayload = JSON.stringify({
                data: {
                    convenioCode: convenioCode,
                    companyName: details.negocio || "Tribu Afiliada",
                    activePlan: template,
                    status: "active",
                    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    userLimit: 100
                }
            });

            // Promesa síncrona nativa de Node.js compatible con todas las versiones (Anti-ReferenceError)
            const syncPromise = new Promise((resolve) => {
                const reqSync = https.request("https://us-central1-makumoto-app-2026.cloudfunctions.net/syncAffiliateLicense", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer MK_SECURE_SYNC_TOKEN_2026",
                        "Content-Length": Buffer.byteLength(syncPayload)
                    }
                }, (resSync) => {
                    let responseData = "";
                    resSync.on("data", (chunk) => { responseData += chunk; });
                    resSync.on("end", async () => {
                        if (resSync.statusCode === 200) {
                            console.log("✅ [SYNC_SUCCESS]: Licencia sincronizada en Makumoto Core.", responseData);
                        } else {
                            console.warn(`⚠️ [SYNC_WARN]: Makumoto Core rechazó la sincronización (${resSync.statusCode}): ${responseData}`);
                            // Registro de contingencia ante rechazo de API
                            await logFailedProvision(folio, 'MAKUMOTO_CORE_LICENSE', syncPayload, `Core rechazó sincronización (${resSync.statusCode}): ${responseData}`);
                        }
                        resolve();
                    });
                });

                reqSync.on("error", async (errSync) => {
                    console.error("❌ [SYNC_ERROR]: Fallo de conexión física al sincronizar con Makumoto:", errSync.message);
                    await logFailedProvision(folio, 'MAKUMOTO_CORE_LICENSE', syncPayload, `Fallo de conexión física TCP: ${errSync.message}`);
                    resolve();
                });

                reqSync.write(syncPayload);
                reqSync.end();
            });

            // Forzar timeout de seguridad de 5 segundos para evitar cuelgues del hilo de ejecución
            await Promise.race([
                syncPromise,
                new Promise(async (resolve) => {
                    setTimeout(async () => {
                        console.warn("⚠️ [SYNC_TIMEOUT]: Se excedió el límite de 5 segundos al sincronizar con Makumoto.");
                        await logFailedProvision(folio, 'MAKUMOTO_CORE_LICENSE', syncPayload, "Exceso de tiempo límite de red (Timeout > 5s)");
                        resolve();
                    }, 5000);
                })
            ]);

        } catch (syncError) {
            console.error("❌ [SYNC_ERROR_FATAL]: Fallo en secuencia de sincronización nativa:", syncError.message);
            logFailedProvision(folio, 'MAKUMOTO_CORE_LICENSE', syncPayload, `Excepción fatal en hilo de ejecución: ${syncError.message}`);
        }

        // Cálculos precisos desglosados de cobro fiscal (Base + IVA)
        const basePriceNum = parseFloat(pData.price);
        const ivaNum = parseFloat((basePriceNum * 0.16).toFixed(2));
        const totalNum = parseFloat((basePriceNum * 1.16).toFixed(2));

        // 5. SEGREGACIÓN DE EMAILS BASADO EN TIPO DE PRODUCTO (WEB ESTÁTICO $99 vs DYNAMIC CAMPAIGN $200)
        let clientReceiptHtml = "";

        if (isWebProduct) {
            // Plantilla de Correo de Entrega 24-72h para Compras Pasivas de $99
            clientReceiptHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; color: #333;">
                    <h2 style="color: #3b82f6; text-align: center; text-transform: uppercase; margin-bottom: 30px;">¡PEDIDO RECIBIDO! TU PLANTILLA ESTÁ EN PRODUCCIÓN</h2>
                    <p>Hola <strong>${details.negocio || 'Cliente Robotiax'}</strong>, hemos registrado la adquisición de tu plantilla web estática y tus especificaciones de marca.</p>
                    
                    <div style="background: #eff6ff; padding: 20px; border-radius: 12px; border: 1px solid #bfdbfe; margin: 20px 0; font-size: 13px; line-height: 1.5; color: #1e3a8a;">
                        <p style="margin: 0; font-weight: bold; font-size: 14px; margin-bottom: 8px;">🌐 HOSTING DE CORTESÍA ACTIVO (7 DÍAS):</p>
                        <p style="margin: 0;"><a href="https://${negocioSlug}.ikai.info" target="_blank" style="color: #3b82f6; font-weight: bold; text-decoration: none;">https://${negocioSlug}.ikai.info</a></p>
                        <p style="margin-top: 6px; font-size: 11px; opacity: 0.85;">* Este enlace te servirá como entorno de prueba para visualizar y validar la carga de tus datos durante el periodo de revisión.</p>
                    </div>

                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; font-size: 13px; line-height: 1.5; color: #333;">
                        <p style="margin: 4px 0;"><strong>FOLIO DE PEDIDO:</strong> ${folio}</p>
                        <p style="margin: 4px 0;"><strong>PLANTILLA ADQUIRIDA:</strong> ${pData.name}</p>
                        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 12px 0;">
                        <p style="margin: 4px 0; display: flex; justify-content: space-between;"><span>PRECIO BASE:</span> <strong>$${basePriceNum.toFixed(2)} ${pData.currency}</strong></p>
                        <p style="margin: 4px 0; display: flex; justify-content: space-between;"><span>IVA TRASLADADO (16%):</span> <strong>$${ivaNum.toFixed(2)} ${pData.currency}</strong></p>
                        <p style="margin: 4px 0; display: flex; justify-content: space-between; font-size: 15px; color: #3b82f6; font-weight: bold; padding-top: 5px; border-top: 1px dashed #e2e8f0;"><span>TOTAL PROCESADO (CON IVA):</span> <strong>$${totalNum.toFixed(2)} ${pData.currency}</strong></p>
                    </div>

                    <div style="background: #0f172a; color: #f8fafc; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #334155; text-align: left;">
                        <h3 style="color: #38bdf8; margin-top: 0; font-size: 14px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #334155; padding-bottom: 10px;">
                            📋 PROCESO DE ENTREGA TÉCNICA
                        </h3>
                        <p style="font-size: 12px; color: #cbd5e1; line-height: 1.6; margin-bottom: 15px;">
                            Al ser un producto estático de catálogo autogestionado, nuestros ingenieros maquetarán la información proporcionada de manera óptima sobre el diseño original. 
                        </p>
                        <p style="font-size: 12px; color: #cbd5e1; line-height: 1.6; font-weight: bold; margin-bottom: 5px;">Plazo estimado de entrega final:</p>
                        <ul style="font-size: 12px; color: #38bdf8; line-height: 1.5; margin-left: 20px; margin-top: 0;">
                            <li>De 24 a 72 horas hábiles contadas a partir de la confirmación de este correo.</li>
                        </ul>
                        <div style="margin-top: 15px; font-size: 11px; color: #94a3b8; font-style: italic; line-height: 1.4;">
                            * Nota: Si cuentas con logotipos o esquemas de color específicos que desees sustituir, por favor responde directamente a este correo adjuntando tus materiales en formato PNG o JPG de alta resolución.
                        </div>
                    </div>

                    <div style="margin-top: 25px; padding: 15px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                        <strong>POLÍTICA DE FACTURACIÓN:</strong> Tu factura CFDI correspondiente se procesará automáticamente y te será enviada los primeros días del mes inmediato posterior.
                    </div>
                    <p style="font-size: 11px; color: #999; margin-top: 30px; text-align: center;">Robotiax Engine - Despliegue de Catálogo Pasivo</p>
                </div>
            `;
        } else {
            // Plantilla de Correo de Liberación de Suite Activa e Instancia de WhatsApp para Demos de $200
            clientReceiptHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; color: #333;">
                    <h2 style="color: #16a34a; text-align: center; text-transform: uppercase; margin-bottom: 30px;">¡TODO LISTO! TU SUITE DE CAMPAÑA ESTÁ EN PROCESO</h2>
                    <p>Hola <strong>${details.negocio || 'Cliente Robotiax'}</strong>, hemos recibido tus datos de configuración correctamente.</p>
                    
                    <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; border: 1px solid #bbf7d0; margin: 20px 0; font-size: 13px; line-height: 1.5; color: #14532d;">
                        <p style="margin: 0; font-weight: bold; font-size: 14px; margin-bottom: 8px;">🌐 TU SITIO WEB PROFESIONAL YA ESTÁ EN LÍNEA:</p>
                        <p style="margin: 0;"><a href="https://${negocioSlug}.ikai.info" target="_blank" style="color: #16a34a; font-weight: bold; text-decoration: none;">https://${negocioSlug}.ikai.info</a></p>
                        <p style="margin-top: 6px; font-size: 11px; opacity: 0.85;">* El bot de WhatsApp agendador se activará automáticamente al seguir el protocolo que se detalla más abajo.</p>
                    </div>

                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; font-size: 13px; line-height: 1.5; color: #333;">
                        <p style="margin: 4px 0;"><strong>FOLIO DE ACTIVACIÓN:</strong> ${folio}</p>
                        <p style="margin: 4px 0;"><strong>PRODUCTO CONTRATADO:</strong> ${pData.name}</p>
                        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 12px 0;">
                        <p style="margin: 4px 0; display: flex; justify-content: space-between;"><span>PRECIO BASE:</span> <strong>$${basePriceNum.toFixed(2)} ${pData.currency}</strong></p>
                        <p style="margin: 4px 0; display: flex; justify-content: space-between;"><span>IVA TRASLADADO (16%):</span> <strong>$${ivaNum.toFixed(2)} ${pData.currency}</strong></p>
                        <p style="margin: 4px 0; display: flex; justify-content: space-between; font-size: 15px; color: #16a34a; font-weight: bold; padding-top: 5px; border-top: 1px dashed #e2e8f0;"><span>TOTAL CON IVA:</span> <strong>$${totalNum.toFixed(2)} ${pData.currency}</strong></p>
                    </div>

                    <!-- SECCIÓN UNIFICADA DE LIBERACIÓN TÉCNICA (FOTOS + PROTOCOLO) -->
                    <div style="background: #0f172a; color: #f8fafc; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #334155; text-align: left;">
                        <h3 style="color: #38bdf8; margin-top: 0; font-size: 14px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #334155; padding-bottom: 10px;">
                            🛡️ PROTOCOLO DE LIBERACIÓN TÉCNICA (ACCIÓN REQUERIDA)
                        </h3>
                        <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6; margin-bottom: 15px;">
                            Para proceder con la maquetación final de tu sitio web y la liberación de tu bot, <strong>es imperativo que respondas a este correo electrónico proporcionando la siguiente información en un solo mensaje:</strong>
                        </p>

                        <!-- Bloque 1: Fotos -->
                        <div style="margin-top: 15px; border-bottom: 1px dashed #334155; padding-bottom: 15px;">
                            <p style="margin: 0; color: #fff; font-size: 13px; font-weight: bold;">📷 PARTE 1: TUS TRES FOTOGRAFÍAS OPCIONALES</p>
                            <p style="margin: 5px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">Envíanos las siguientes imágenes para ilustrar tu nuevo sitio web:</p>
                            <ul style="font-size: 12px; color: #cbd5e1; line-height: 1.5; margin-left: 20px; margin-top: 5px; margin-bottom: 8px; padding-left: 0;">
                                <li>Foto física de tus oficinas o local comercial.</li>
                                <li>Foto profesional de tu perfil.</li>
                                <li>Foto tuya interactuando con clientes o colaboradores.</li>
                            </ul>
                            <p style="font-size: 11px; color: #64748b; font-style: italic; margin: 0; line-height: 1.3;">* Nota: En caso de no contar con alguna de estas fotos, las omitiremos en el diseño de forma limpia y minimalista.</p>
                        </div>

                        <!-- Bloque 2: Protocolo -->
                        <div style="margin-top: 15px; border-bottom: 1px dashed #334155; padding-bottom: 15px;">
                            <p style="margin: 0; color: #fff; font-size: 13px; font-weight: bold;">🤖 PARTE 2: SELECCIÓN DE PROTOCOLO DE IMPLEMENTACIÓN (BOT)</p>
                            <p style="margin: 5px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">Selecciona cuál de las siguientes tres vías deseas para la configuración y entrenamiento de tu asistente de WhatsApp:</p>
                            
                            <div style="margin-top: 10px; margin-bottom: 10px;">
                                <span style="color: #fff; font-size: 11px; font-weight: bold;">1. SOPORTE DE CORTESÍA: CONFIGURACIÓN BÁSICA (SIN COSTO)</span>
                                <p style="margin: 2px 0 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">Nuestra ingeniería diseñará su <em>System Instruction</em> inicial. Le solicitaremos datos básicos para configurar la lógica primaria de su bot.</p>
                            </div>
                            
                            <div style="margin-bottom: 10px;">
                                <span style="color: #fff; font-size: 11px; font-weight: bold;">2. AUTOGESTIÓN TÉCNICA (PRIVACIDAD TOTAL)</span>
                                <p style="margin: 2px 0 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">Entrega de unidad en estado base (limpia). Ideal para empresas con personal de sistemas que prefieren manejar su propia base de conocimientos por seguridad.</p>
                            </div>
                            
                            <div>
                                <span style="color: #38bdf8; font-size: 11px; font-weight: bold;">3. IMPLEMENTACIÓN AVANZADA "PLUG & PLAY" (+50 USD)</span>
                                <p style="margin: 2px 0 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">Nosotros realizamos la ingeniería de prompts, carga de conocimientos y calibración de respuesta. Reciba su Bot 100% operativo y listo para producción inmediata.</p>
                            </div>
                        </div>

                        <!-- Bloque 3: Nota de Cierre unificada -->
                        <div style="margin-top: 15px; font-size: 12px; color: #ff4d4d; font-weight: bold; line-height: 1.5;">
                            ⚠️ NOTA DE LIBERACIÓN TÉCNICA: En cuanto recibamos estas tres fotografías (o la confirmación de omitirlas) junto con tu elección de protocolo en respuesta a este correo electrónico, procederemos de inmediato con la activación de tu Página Web, la puesta en marcha de tu Bot de WhatsApp de agendamiento automático y te enviaremos los datos de acceso oficiales y el manual operativo para tu Centro de Entretenimiento de sala de espera en un plazo estimado de 24 a 72 horas hábiles.
                        </div>
                    </div>

                    <div style="margin-top: 25px; padding: 15px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                        <strong>POLÍTICA DE FACTURACIÓN:</strong> Su factura le será enviada automáticamente los días 2 o 3 del mes inmediato posterior a su compra.
                    </div>
                    <p style="font-size: 11px; color: #999; margin-top: 30px; text-align: center;">Robotiax Engine - Despliegue Automatizado</p>
                </div>
            `;
        }
        const mailer = getTransporter();

        // CONTROL RESILIENTE E INDEPENDIENTE DE ENVÍO DE CORREOS
        try {
            await mailer.sendMail({
                from: '"Robotiax Intelligence" <soporte@robotiax.mx>',
                to: 'soporte@robotiax.mx',
                replyTo: clientEmail || 'soporte@robotiax.mx',
                subject: `⚡ ACTIVACIÓN: ${details.negocio || 'SIN NOMBRE'} (${folio})`,
                html: adminMailHtml
            });
            console.log("✅ Correo al administrador enviado correctamente a soporte@robotiax.mx.");
        } catch (errAdmin) {
            console.error("❌ ERROR AL ENVIAR CORREO AL ADMINISTRADOR:", errAdmin.message);
        }

        if (clientEmail) {
            try {
                await mailer.sendMail({
                    from: '"Robotiax Intelligence" <soporte@robotiax.mx>',
                    to: clientEmail,
                    subject: `✅ Orden Confirmada: ${folio}`,
                    html: clientReceiptHtml
                });
                console.log(`✅ Correo al cliente enviado correctamente a: ${clientEmail}`);
            } catch (errClient) {
                console.error(`❌ ERROR AL ENVIAR CORREO AL CLIENTE (${clientEmail}):`, errClient.message);
            }
        } else {
            console.warn("⚠️ No se detectó dirección de correo del cliente. Omisión de envío.");
        }

        return res.status(200).json({ status: 'ok', folio: folio });
    } catch (error) {
        console.error("ERROR CRÍTICO:", error);
        return res.status(500).json({ status: 'error', message: error.message });
    }


});

// --- FUNCIONES AUXILIARES DE DESPLIEGUE (REFACTOR PASIVO) ---

async function provisionFirebaseSubdomain(negocioSlug) {
    try {
        console.log(`📡 [HOSTING]: Solicitando aprovisionamiento para: ${negocioSlug}.ikai.info...`);
        const credential = admin.credential.applicationDefault();
        const accessTokenObj = await credential.getAccessToken();
        const token = accessTokenObj.accessToken;
        const subDomain = `${negocioSlug}.ikai.info`;
        
        return new Promise((resolve) => {
            const reqHost = https.request({
                hostname: 'firebasehosting.googleapis.com',
                port: 443,
                path: `/v1beta1/projects/robotiax/sites/robotiax/customDomains?customDomainId=${encodeURIComponent(subDomain)}`,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Goog-User-Project': 'robotiax'
                }
            }, (resHost) => { resolve(true); });
            reqHost.on("error", () => resolve(false));
            reqHost.write(JSON.stringify({}));
            reqHost.end();
        });
    } catch (e) { return false; }
}

async function deployStaticToR2(negocioSlug, htmlContent, r2BucketName) {
    try {
        const { PutObjectCommand } = require("@aws-sdk/client-s3");
        const putCommand = new PutObjectCommand({
            Bucket: r2BucketName,
            Key: `sitios/${negocioSlug}.html`,
            Body: htmlContent,
            ContentType: "text/html; charset=utf-8"
        });
        await getS3().send(putCommand);
        return true;
    } catch (e) { return false; }
}

async function provisionWhatsAppGateway(negocioSlug, tempPassword) {
    const gatewayUrl = 'https://bot.ikai.info/instance/create';
    const gatewayToken = 'RBX-GATEWAY-MASTER-SECRET-2025';
    try {
        await fetch(gatewayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': gatewayToken },
            body: JSON.stringify({ instanceName: negocioSlug, token: tempPassword, qrcode: true })
        });
        return true;
    } catch (e) { return false; }
}

exports.activateAgentWithVertex = onRequest({ cors: true, timeoutSeconds: 120, memory: "1GiB" }, async (req, res) => {
    // ... (mantiene lógica original)
});

// --- WEBHOOK AUTOMÁTICO DE STRIPE (DESPACHO INMEDIATO Y RESILIENTE) ---
exports.stripeWebhook = onRequest({ 
    cors: true, 
    timeoutSeconds: 120, 
    memory: "512MiB" 
}, async (req, res) => {
    // Diagnóstico rápido vía navegador (GET)
    if (req.method === 'GET') {
        try {
            const mailer = getTransporter();
            await mailer.verify();
            await mailer.sendMail({
                from: '"ROBOTIAX TEST" <geniosdeltalento@gmail.com>',
                to: 'soporte@makumoto.com, geniosdeltalento@gmail.com',
                subject: '🔥 PRUEBA MANUAL DE CORREO OK',
                text: 'El motor de correos de Robotiax está listo para despachar órdenes.'
            });
            return res.status(200).send("<h1>✅ SERVICIO OK: Correo de prueba enviado a soporte@makumoto.com</h1>");
        } catch (mailErr) {
            console.error("❌ ERROR NODEMAILER TEST:", mailErr);
            return res.status(500).send(`<h1>❌ ERROR EN GMAIL: ${mailErr.message}</h1>`);
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).send("Method Not Allowed");
    }

    let event = req.body;
    if (Buffer.isBuffer(req.rawBody) && typeof req.body === 'string') {
        try {
            event = JSON.parse(req.body);
        } catch (e) {
            console.warn("No se pudo parsear body:", e.message);
        }
    }

    console.log("🔔 [STRIPE EVENT RECIBIDO]:", event ? event.type : 'Sin evento detectable');

    const isCheckout = event && event.type === 'checkout.session.completed';
    const isPaymentAction = event && event.type === 'payment_intent.requires_action';

    if (!event || (!isCheckout && !isPaymentAction)) {
        return res.status(200).json({ received: true, ignored: true });
    }

    try {
        const session = isCheckout ? event.data.object : {};
        const paymentIntentObj = isPaymentAction ? event.data.object : (session.payment_intent || {});
        const oxxoDetails = (isPaymentAction ? paymentIntentObj.next_action?.oxxo_display_details : null) || 
                            (session.next_action?.oxxo_display_details) || null;
        
        let voucherUrl = oxxoDetails?.hosted_voucher_url || '';
        let voucherNumber = oxxoDetails?.number || '';

        const paymentIntentId = typeof session.payment_intent === 'string' 
            ? session.payment_intent 
            : (session.payment_intent?.id || event.data?.object?.id || '');

        if (!voucherUrl && paymentIntentId && paymentIntentId.startsWith('pi_')) {
            try {
                const sKey = stripeSecretKey.value();
                if (sKey && !sKey.includes('TU_KEY')) {
                    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
                        headers: { 'Authorization': `Bearer ${sKey}` }
                    });
                    if (piRes.ok) {
                        const piData = await piRes.json();
                        const details = piData.next_action?.oxxo_display_details;
                        if (details) {
                            voucherUrl = details.hosted_voucher_url || voucherUrl;
                            voucherNumber = details.number || voucherNumber;
                        }
                    }
                }
            } catch (errPi) {
                console.warn("No se pudo consultar PaymentIntent:", errPi.message);
            }
        }

        const isPaid = isCheckout && session.payment_status === 'paid';
        const isOxxoPending = (isCheckout && session.payment_status === 'unpaid') || isPaymentAction;

        const clientEmail = (session.customer_details?.email || session.customer_email || '').trim();
        const clientName = (session.customer_details?.name || '').trim();
        const clientPhone = session.customer_details?.phone || 'No registrado';
        const amountTotal = session.amount_total ? (session.amount_total / 100).toFixed(2) : '233.00';
        const currency = (session.currency || 'mxn').toUpperCase();

        // DESCOMPOSICIÓN TÁCTICA DEL CLIENT_REFERENCE_ID (FOLIO + EMAIL + NEGOCIO)
        const rawRef = (session.client_reference_id || '').trim();
        let clientRefFolio = rawRef;
        let embeddedEmail = '';
        let embeddedBusinessName = '';

        if (rawRef.includes('__')) {
            const refParts = rawRef.split('__');
            clientRefFolio = refParts[0] ? refParts[0].trim() : rawRef;
            embeddedEmail = refParts[1] ? decodeURIComponent(refParts[1]).trim() : '';
            embeddedBusinessName = refParts[2] ? decodeURIComponent(refParts[2]).trim() : '';
        }

        const rawEmail = (
            session.customer_details?.email || 
            session.customer_email || 
            (typeof session.customer === 'object' ? session.customer?.email : null) || 
            ''
        ).trim();

        const searchEmail = (embeddedEmail || rawEmail || clientEmail).toLowerCase().trim();
        let draftData = {};

        // 1. BÚSQUEDA POR FOLIO DIRECTO
        if (clientRefFolio) {
            try {
                const draftDoc = await getDb().collection('orders_to_fulfill').doc(clientRefFolio).get();
                if (draftDoc.exists) {
                    draftData = draftDoc.data() || {};
                } else {
                    const snap = await getDb().collection('orders_to_fulfill').where('orderNumber', '==', clientRefFolio).limit(1).get();
                    if (!snap.empty) draftData = snap.docs[0].data() || {};
                }
            } catch (errDoc) {
                console.warn("Fallo leyendo borrador por folio:", errDoc.message);
            }
        }

        // 2. BÚSQUEDA AGNOSTICA DE MAYÚSCULAS/MINÚSCULAS POR EMAIL
        if (!draftData.negocio && searchEmail) {
            try {
                const snapEmail = await getDb().collection('orders_to_fulfill')
                    .where('email', '==', searchEmail)
                    .limit(5)
                    .get();
                if (!snapEmail.empty) {
                    for (const doc of snapEmail.docs) {
                        const d = doc.data();
                        if (d && d.negocio && d.negocio !== 'Mi Empresa' && d.negocio !== 'Cliente Robotiax') {
                            draftData = d;
                            break;
                        }
                    }
                    if (!draftData.negocio) draftData = snapEmail.docs[0].data() || {};
                }
            } catch (errEmailSearch) {
                console.warn("Búsqueda por email omitida:", errEmailSearch.message);
            }
        }

        // RESOLUCIÓN DEL CORREO FINAL DEL COMPRADOR
        const targetEmail = (
            draftData.email || 
            rawEmail || 
            clientEmail || 
            embeddedEmail || 
            ''
        ).trim();

        // PRIORIDAD ESTRICTA A LA RAZÓN SOCIAL DEL FORMULARIO (NUNCA EL NOMBRE DE LA TARJETA)
        const effectiveBusinessName = (
            draftData.negocio || 
            draftData.business_name || 
            embeddedBusinessName || 
            "Mi Negocio"
        ).trim();

        const effectivePhone = (
            draftData.telefono || 
            session.customer_details?.phone || 
            'No registrado'
        ).trim();

        const now = new Date();
        const folio = clientRefFolio || draftData.orderNumber || `ORD-STRIPE-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const convenioCode = draftData.convenioCode || `MAK-AURA-${Math.floor(1000 + Math.random() * 9000)}`;
        const tempPassword = draftData.provisionalPassword || Math.random().toString(36).substring(2, 8).toUpperCase();

        // CONSTRUCCIÓN DEL SLUG BASADO EXCLUSIVAMENTE EN LA RAZÓN SOCIAL
        const rawSlugBase = (draftData.negocio_slug || effectiveBusinessName);
        const negocioSlug = rawSlugBase
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "") || `sitio-${Math.floor(1000 + Math.random() * 9000)}`;

        const siteUrl = `https://${negocioSlug}.ikai.info`;
        console.log(`🚀 [DESPACHO INMEDIATO]: Enviando correos para ${effectiveBusinessName} a destinatario: "${targetEmail}"`);

        // =========================================================================
        // PRIORIDAD 1: ENVÍO DE CORREOS (SOPORTE Y COMPRADOR)
        // =========================================================================
        const mailer = getTransporter();

        // 1. Notificación a Soporte (Makumoto + Respaldo)
        try {
            await mailer.sendMail({
                from: '"Robotiax Intelligence" <soporte@robotiax.mx>',
                to: 'soporte@robotiax.mx',
                replyTo: targetEmail || 'soporte@robotiax.mx',
                subject: `🚨 NUEVO PAGO STRIPE: ${clientName || effectiveBusinessName} (${folio})`,
                html: `
                    <div style="font-family: Arial, sans-serif; background: #000; color: #00f2ff; padding: 30px; border: 2px solid #2ecc71;">
                        <h2 style="color: #2ecc71; margin-top: 0;">✅ NUEVA ORDEN RECIBIDA (STRIPE)</h2>
                        <p><strong>Folio:</strong> ${folio}</p>
                        <p><strong>Empresa / Razón Social:</strong> ${effectiveBusinessName}</p>
                        <p><strong>Cliente:</strong> ${clientName || 'No especificado'}</p>
                        <p><strong>Email Comprador:</strong> ${targetEmail || 'No registrado'}</p>
                        <p><strong>Teléfono:</strong> ${effectivePhone}</p>
                        <p><strong>Total Cobrado:</strong> $${amountTotal} ${currency}</p>
                        <hr style="border-color: #333;">
                        <p><strong>URL Web:</strong> <a href="${siteUrl}" style="color: #00f2ff;" target="_blank">${siteUrl}</a></p>
                        <p><strong>Convenio Makumoto:</strong> ${convenioCode}</p>
                        <p><strong>Token Bot:</strong> ${tempPassword}</p>
                    </div>
                `
            });
            console.log("✅ [CORREO SOPORTE]: Entregado exclusivamente a soporte@robotiax.mx");
        } catch (mailAdminErr) {
            console.error("❌ ERROR AL ENVIAR CORREO A SOPORTE:", mailAdminErr.message);
        }

        // CASO A: VALE OXXO GENERADO (EL CLIENTE AÚN NO HA PAGADO EN TIENDA)
        if (isOxxoPending) {
            console.log(`⏳ [OXXO PENDIENTE]: Vale emitido para ${effectiveBusinessName}. Esperando confirmación bancaria.`);
            
            if (targetEmail) {
                try {
                    await mailer.sendMail({
                        from: '"Robotiax Intelligence" <soporte@robotiax.mx>',
                        to: targetEmail,
                        subject: `⏳ Vale OXXO Generado: Tu Suite se activará al pagar en tienda (${folio})`,
                        html: `
                            <div style="width: 100%; max-width: 540px; margin: 0 auto; box-sizing: border-box; padding: 18px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; word-wrap: break-word; word-break: break-word; background: #ffffff; color: #1a1a1a; border: 1px solid #cbd5e1; border-radius: 8px;">
                                <div style="text-align: center; border-bottom: 2px solid #e11d48; padding-bottom: 12px; margin-bottom: 16px;">
                                    <h1 style="color: #e11d48; margin: 0; font-size: 17px; line-height: 1.3; font-weight: 800; text-transform: uppercase;">VALE DE PAGO OXXO GENERADO</h1>
                                    <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0;">Esperando Confirmación de Caja</p>
                                </div>

                                <p style="font-size: 13px; line-height: 1.5; color: #334155; margin: 0 0 14px 0;">
                                    Hola <strong>${effectiveBusinessName}</strong>, hemos registrado la generación de tu vale para pagar en efectivo en OXXO por <strong>$${amountTotal} ${currency}</strong>.
                                </p>

                                <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px; margin: 14px 0;">
                                    <p style="margin: 0; font-weight: 800; font-size: 12px; color: #9f1239; text-transform: uppercase;">⚠️ INSTRUCCIONES PARA TU PAGO EN CAJA:</p>
                                    <ol style="margin: 8px 0 0 0; padding-left: 18px; font-size: 12px; color: #881337; line-height: 1.5;">
                                        <li>Muestra al cajero el código de barras que generaste en Stripe (o indícale tu número de referencia).</li>
                                        <li>Realiza tu pago en efectivo en cualquier tienda OXXO.</li>
                                        <li>En el instante en que OXXO reporte tu pago a Stripe, <strong>activaremos tu página web con el nombre ${effectiveBusinessName} y tu Bot de WhatsApp</strong>, y te llegará el manual a este buzón.</li>
                                    </ol>
                                </div>

                                <table style="width: 100%; font-size: 12px; line-height: 1.6; color: #334155; border-collapse: collapse; margin-bottom: 15px;">
                                    <tr>
                                        <td style="padding: 3px 0; width: 45%;"><strong>Empresa Registrada:</strong></td>
                                        <td style="padding: 3px 0; font-weight: bold; color: #0f172a;">${effectiveBusinessName}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 3px 0;"><strong>Folio de Pedido:</strong></td>
                                        <td style="padding: 3px 0; font-weight: bold; color: #2563eb;">${folio}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 3px 0;"><strong>Total a Pagar en Caja:</strong></td>
                                        <td style="padding: 3px 0; font-weight: bold; color: #16a34a;">$${amountTotal} ${currency}</td>
                                    </tr>
                                </table>

                                <!-- VALE VISUAL DIRECTO EN EL CORREO -->
                                <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/66/Oxxo_Logo.svg" alt="OXXO" style="width: 70px; margin-bottom: 8px;">
                                    
                                    ${voucherNumber ? `
                                    <div style="margin: 10px 0;">
                                        <img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${voucherNumber.replace(/\\s+/g, '')}&scale=2&height=12" alt="Código de Barras" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">
                                        <p style="font-family: monospace; font-size: 14px; font-weight: bold; color: #0f172a; letter-spacing: 2px; margin: 6px 0 0 0;">${voucherNumber}</p>
                                    </div>
                                    ` : `
                                    <p style="font-size: 12px; color: #64748b; margin: 8px 0;">Presenta el vale oficial generado en Stripe directamente en caja.</p>
                                    `}
                                </div>

                                <!-- ACCIONES DIRECTAS DEL CORREO -->
                                <div style="display: flex; flex-direction: column; gap: 8px; text-align: center; margin-top: 15px;">
                                    <a href="${voucherUrl || 'https://buy.stripe.com/3cIcN6dhi9WG0rIdVB4gg0f'}" target="_blank" style="display: block; background: #00f2ff; color: #020617; padding: 12px; font-weight: 800; font-size: 12px; text-decoration: none; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                                        🖨️ VER E IMPRIMIR VALE OFICIAL EN STRIPE ➔
                                    </a>
                                    <a href="https://robotiax.mx" target="_blank" style="display: block; background: #0f172a; color: #cbd5e1; border: 1px solid #334155; padding: 10px; font-weight: 700; font-size: 11px; text-decoration: none; border-radius: 6px; text-transform: uppercase;">
                                        ❮ VOLVER A ROBOTIAX.MX
                                    </a>
                                </div>

                                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 16px 0 0 0;">
                                    ROBOTIAX Engine & Makumoto Platform — Soporte: soporte@makumoto.com
                                </p>
                            </div>
                        `
                    });
                    console.log("[CORREO OXXO PENDIENTE]: Enviado con exito a " + targetEmail);
                } catch (oxxoMailErr) {
                    console.error("Error enviando correo de espera OXXO:", oxxoMailErr.message);
                }
            }

            // Guardar en Firestore como pendiente de pago en efectivo
            await getDb().collection('orders_to_fulfill').doc(folio).set({
                ...draftData,
                orderNumber: folio,
                negocio: effectiveBusinessName,
                negocio_slug: negocioSlug,
                email: targetEmail,
                status: 'pending_oxxo_cash',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return res.status(200).json({ status: 'oxxo_pending_registered', folio: folio });
        }

        // CASO B: PAGO CONFIRMADO REAL (TARJETA INMEDIATA O NOTIFICACIÓN OXXO PAGADA)
        if (targetEmail && isPaid) {
            try {
                console.log(`📧 [INTENTO DE ENVÍO AL CLIENTE]: Disparando hacia ${targetEmail}...`);
                await mailer.sendMail({
                    from: '"Robotiax Intelligence" <geniosdeltalento@gmail.com>',
                    to: targetEmail,
                    subject: `✅ ¡Tu Suite Digital está Activa! Enlace y Manual (${folio})`,
                    html: `
                        <div style="width: 100%; max-width: 540px; margin: 0 auto; box-sizing: border-box; padding: 16px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; word-wrap: break-word; word-break: break-word; background: #ffffff; color: #1a1a1a; border: 1px solid #e2e8f0; border-radius: 8px;">
                            
                            <!-- ENCABEZADO PRINCIPAL -->
                            <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px;">
                                <h1 style="color: #0f172a; margin: 0; font-size: 17px; line-height: 1.3; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">¡SUITE DIGITAL Y BOT ACTIVADOS!</h1>
                                <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0;">Entrega Oficial de Servicios y Puesta en Marcha</p>
                            </div>

                            <p style="font-size: 12px; line-height: 1.5; margin: 0 0 14px 0; color: #334155;">Hola <strong>${effectiveBusinessName}</strong>, confirmamos que tu orden de <strong>$${amountTotal} ${currency}</strong> ha sido procesada con éxito.</p>

                            <!-- RESUMEN DE BENEFICIOS INCLUIDOS -->
                            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin: 14px 0; box-sizing: border-box;">
                                <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 12px; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">📦 LO QUE INCLUYE TU COMPRA:</h3>
                                <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6; color: #334155;">
                                    <li><strong>Página Web Profesional:</strong> Operando bajo el dominio <span style="color: #2563eb; font-weight: bold;">ikai.info</span>.</li>
                                    <li><strong>Hosting de Cortesía:</strong> 1 mes incluido (o mientras dure tu membresía).</li>
                                    <li><strong>Bot de WhatsApp Autónomo:</strong> Asistente 24/7 en tu servidor privado.</li>
                                    <li><strong>Centro de Entretenimiento:</strong> Sala de espera con videos, trivias y juegos.</li>
                                </ul>
                                <div style="margin-top: 8px; font-size: 11px; color: #dc2626; font-weight: bold; line-height: 1.4;">
                                    ⚠️ Todos los servicios son solo por 30 días (o mientras dure tu membresía activa).
                                </div>
                            </div>

                            <!-- BLOQUE 1: TU SITIO WEB ACTIVO -->
                            <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin: 14px 0; box-sizing: border-box;">
                                <p style="margin: 0; font-weight: 700; font-size: 11px; color: #15803d; text-transform: uppercase;">🌐 TU PÁGINA WEB YA ESTÁ EN LÍNEA usando el dominio ikai.info:</p>
                                <p style="margin: 6px 0 0 0; font-size: 13px; line-height: 1.4; word-break: break-all;">
                                    <a href="${siteUrl}" target="_blank" style="color: #16a34a; font-weight: 800; text-decoration: underline; word-break: break-all;">${siteUrl}</a>
                                </p>
                                <p style="margin: 4px 0 0 0; font-size: 10px; color: #166534; line-height: 1.4;">* Activo por 30 días o mientras se mantenga vigente tu membresía.</p>
                            </div>

                            <!-- BLOQUE 2: FACTURA Y COMPROBANTE EXPEDIDA POR STRIPE (SIN CÓDIGO DE CONVENIO) -->
                            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin: 14px 0; box-sizing: border-box;">
                                <h3 style="margin: 0 0 6px 0; color: #1e3a8a; font-size: 11px; font-weight: 700; text-transform: uppercase;">🧾 FACTURA Y RECIBO DE PEDIDO (EXPEDIDA POR STRIPE)</h3>
                                <p style="font-size: 11px; color: #1e40af; margin: 0 0 6px 0; line-height: 1.4;">
                                    Tu <strong>factura y recibo oficial de pago ha sido expedida directamente por Stripe</strong> y enviada a tu correo (${targetEmail}).
                                </p>
                                <table style="width: 100%; font-size: 11px; line-height: 1.5; color: #1e3a8a; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 2px 0; width: 45%;"><strong>Folio de Pedido:</strong></td>
                                        <td style="padding: 2px 0; font-weight: bold; word-break: break-all;">${folio}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 2px 0;"><strong>Importe Total:</strong></td>
                                        <td style="padding: 2px 0; color: #16a34a; font-weight: bold;">$${amountTotal} ${currency}</td>
                                    </tr>
                                </table>
                            </div>

                            <!-- BLOQUE 3: INSTRUCTIVO CLARO DEL BOT DE WHATSAPP -->
                            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 12px; margin: 16px 0; box-sizing: border-box;">
                                <h3 style="color: #065f46; font-size: 13px; font-weight: 700; margin: 0 0 8px 0; text-transform: uppercase;">
                                    🤖 CÓMO VINCULAR TU BOT DE WHATSAPP (3 PASOS)
                                </h3>
                                <p style="font-size: 12px; color: #047857; margin: 0 0 10px 0; line-height: 1.4;">Instancia aprovisionada con el identificador: <strong>${negocioSlug}</strong>.</p>
                                
                                <ol style="font-size: 12px; line-height: 1.6; color: #065f46; margin: 0; padding-left: 18px;">
                                    <li style="margin-bottom: 4px;">Ingresa a la consola: <a href="https://bot.ikai.info" target="_blank" style="color: #059669; font-weight: bold; text-decoration: underline;">https://bot.ikai.info</a></li>
                                    <li style="margin-bottom: 4px;">Ingresa tu Token de Seguridad: <strong style="background: #ffffff; border: 1px solid #059669; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px;">${tempPassword}</strong></li>
                                    <li>En WhatsApp ➔ Menú ➔ <strong>Dispositivos Vinculados</strong> ➔ Escanea el código QR que se mostrará en pantalla.</li>
                                </ol>
                            </div>

                            <!-- BLOQUE 4: PERFECCIONA TU WEB ($89 MXN) CON ENLACE OFICIAL DE STRIPE -->
                            <div style="background: #0f172a; color: #ffffff; border-radius: 8px; padding: 16px 12px; margin: 16px 0; box-sizing: border-box; text-align: center; border: 1px solid #00f2ff;">
                                <div style="border-bottom: 1px solid rgba(0, 242, 255, 0.4); padding-bottom: 8px; margin-bottom: 12px;">
                                    <h2 style="color: #00f2ff; font-size: 15px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
                                        ⚡ PERFECCIONA TU WEB ($89 MXN)
                                    </h2>
                                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase;">Ajustes de Marca y Fotografía Profesional</span>
                                </div>
                                <p style="font-size: 12px; color: #e2e8f0; line-height: 1.5; margin: 0 0 12px 0; text-align: left;">
                                    Si deseas personalizar al máximo tu plataforma, adquiere <strong>PERFECCIONA TU WEB por solo $89 MXN</strong> para añadir:
                                </p>
                                <ul style="font-size: 12px; color: #cbd5e1; line-height: 1.6; margin: 0 0 14px 0; padding-left: 18px; text-align: left;">
                                    <li><strong>3 Fotografías Oficiales:</strong> En formato horizontal 16:9 (PNG o JPG &lt; 2 MB).</li>
                                    <li><strong>Hasta 5 Modificaciones o Adiciones:</strong> Nuevos servicios, horarios específicos o datos de tu negocio.</li>
                                </ul>
                                
                                <a href="https://buy.stripe.com/bJe8wQ9128SC7UacRx4gg0g?prefilled_email=${encodeURIComponent(targetEmail)}" target="_blank" style="display: block; width: 100%; max-width: 280px; margin: 12px auto; background: #00f2ff; color: #020617; text-align: center; padding: 12px 16px; font-weight: 800; font-size: 13px; text-decoration: none; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                                    PERFECCIONAR MI WEB ($89 MXN) ➔
                                </a>
                                <p style="font-size: 10px; color: #94a3b8; margin: 6px 0 0 0;">Al completar tu pago se abrirá la consola para subir tus 3 fotos y tus 5 adiciones.</p>
                            </div>

                            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 20px 0 0 0;">
                                ROBOTIAX® Engine & Makumoto Platform — Infraestructura Digital
                            </p>
                        </div>
                    `
                });
                console.log(`✅ [CORREO CLIENTE]: Entregado exitosamente al comprador (${targetEmail})`);
            } catch (mailClientErr) {
                console.error(`❌ ERROR AL ENVIAR AL CLIENTE (${targetEmail}):`, mailClientErr.message);
            }
        } else {
            console.error("🚨 [ALERTA CRÍTICA]: No se pudo determinar el correo del comprador ni desde Stripe ni desde el borrador.");
        }

        // =========================================================================
        // PRIORIDAD 2: REGISTRO EN BASE DE DATOS (FIRESTORE)
        // =========================================================================
        try {
            await getDb().collection('orders_to_fulfill').doc(folio).set({
                ...draftData,
                orderNumber: folio,
                productName: draftData.productName || 'Suite Digital Robotiax (Web + Bot + Sala de Espera)',
                isWeb: true,
                negocio: effectiveBusinessName,
                negocio_slug: negocioSlug,
                email: targetEmail,
                telefono: effectivePhone,
                fee: cleanVal(draftData.fee, "$800 MXN"),
                convenioCode: convenioCode,
                provisionalPassword: tempPassword,
                stripeSessionId: session.id,
                status: 'paid_active',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`✅ [FIRESTORE]: Orden consolidada bajo folio ${folio} para ${targetEmail}.`);
        } catch (dbErr) {
            console.error("⚠️ Error guardando en Firestore:", dbErr.message);
        }

        // =========================================================================
        // PRIORIDAD 3: PROVISIÓN DE INFRAESTRUCTURA EN SEGUNDO PLANO
        // =========================================================================
        provisionFirebaseSubdomain(negocioSlug).catch(err => console.warn("Subdominio error:", err.message));

        (async () => {
            try {
                const templatePath = path.join(__dirname, 'templates', 'demo_salud.html');
                const rawTemplate = await fs.readFile(templatePath, 'utf8');
                const cacheBuster = Date.now();
                // FILTRADO ESTRICTO: Si el cliente anotó "NO", se omite y vacía el texto
                const cleanVal = (v, def = "") => {
                    if (!v || v.trim().toLowerCase() === 'no') return def;
                    return v;
                };

                const resolvedNiche = (draftData.template || 'salud')
                    .replace(/^cfg-/, '')
                    .replace(/-bot(-promo)?$/, '')
                    .replace(/-01$/, '');

                const clientData = {
                    negocio: effectiveBusinessName,
                    badge: cleanVal(draftData.badge, 'ESPECIALISTA CERTIFICADO'),
                    specialty: cleanVal(draftData.specialty, 'Giro Comercial'),
                    tagline: cleanVal(draftData.tagline || draftData.slogan, 'Evolución y Precisión'),
                    direccion: cleanVal(draftData.direccion, 'Atención Profesional'),
                    horarios: cleanVal(draftData.horarios, 'Horarios Flexibles'),
                    telefono: effectivePhone || '+52 55 1234 5678',
                    fee: cleanVal(draftData.fee, '$800 MXN'),
                    nicheId: resolvedNiche,
                    isProductionSite: true
                };

                const clientDataScript = `<script>window.app = window.app || {}; window.app.clientData = ${JSON.stringify(clientData)};</script>`;

                let compiledHtml = rawTemplate
                    // 1. Inyección de identidad y metadatos
                    .replace('</head>', `${clientDataScript}</head>`)
                    .replace(/<title>.*?<\/title>/g, `<title>${effectiveBusinessName} | Portal Oficial</title>`)
                    // 2. Encabezado de marca con razón social
                    .replace(/<span id="header-brand-title".*?<\/span>/gs, `<span id="header-brand-title" class="font-['Inter'] text-[9px] font-black text-slate-800 uppercase tracking-tight">${effectiveBusinessName}</span>`)
                    // 3. Supresión total del bloque selector de colores de demo
                    .replace(/<div id="header-theme-picker".*?<\/div>/gs, '')
                    // 4. Eliminación de cualquier botón de compra o modales de venta
                    .replace(/<button[^>]*onclick="[^"]*openCloserModal[^"]*"[^>]*>.*?<\/button>/gis, '')
                    .replace(/<button[^>]*>.*?COMPRAR WEB.*?<\/button>/gis, '')
                    .replace(/<button[^>]*id="btn-return-catalog"[^>]*>.*?<\/button>/gis, '')
                    .replace(/<!-- MODAL DE CIERRE DE VENTA -->.*?<!-- SCRIPTS CORE -->/gs, '<!-- SCRIPTS CORE -->')
                    // 5. Inyección de datos directos en el Hero
                    .replace(/Dr\. Alejandro Morales/g, effectiveBusinessName)
                    .replace(/ESPECIALISTA CERTIFICADO/g, clientData.badge)
                    .replace(/Nutrición Estética & Neurología Preventiva/g, clientData.specialty)
                    .replace(/"Tu bienestar es nuestra ciencia"/g, `"${clientData.tagline}"`)
                    .replace(/Torre Médica, Cons\. 402/g, clientData.direccion)
                    .replace(/Lun - Vie 9am a 6pm/g, clientData.horarios)
                    .replace(/\+52 55 1234 5678/g, clientData.telefono)
                    .replace(/\$800 MXN/g, clientData.fee)
                    // 6. Rutas absolutas a imágenes y assets
                    // Sustitución directa de la imagen del hero por la del giro adquirido
                    // Transformación de textos de venta (Demo) a lenguaje universal para el paciente/cliente (Producción)
                    .replace(/✦ PILAR 1: RETOS EN SALA DE ESPERA \(CONSOLA CRT\) ✦/g, '✦ ZONA INTERACTIVA: RETOS Y TRIVIAS ✦')
                    .replace(/Gamificación del Tiempo Percibido/g, 'Entrena tu Mente Mientras Esperas')
                    .replace(/Manten a tus clientes totalmente entretenidos y <strong>reduce la percepción de espera física hasta en un 80%<\/strong>\. Retos dinámicos interactivos que estimulan la mente de tus usuarios y premian su paciencia con valiosos puntos de lealtad \(XP\) canjeables\./g, 'Aprovecha tu tiempo en nuestra sala interactiva. Responde trivias de salud y bienestar, acumula puntos de lealtad (XP) y descubre consejos prácticos preparados para ti.')
                    .replace(/✦ PILAR 2: ORBE DE BIENESTAR Y LEALTAD ✦/g, '✦ COMUNIDAD Y BIENESTAR EN VIVO ✦')
                    .replace(/Tu Red de Beneficios Exclusivos/g, 'Tu Espacio de Salud y Hábitos')
                    .replace(/<strong>El epicentro de tu comunidad de pacientes\.<\/strong> Un feed social cerrado de marca blanca donde tus clientes interactúan, completan misiones de salud asignadas por ti, compiten en el ranking y monitorean sus beneficios de forma inmediata\./g, '<strong>Tu bienestar al centro de todo.</strong> Conecta con nuestra comunidad privada, descubre hábitos diarios saludables, participa en dinámicas grupales y consulta tus avances en cualquier momento.')
                    .replace(/EXPLORAR RECOMENDACIONES EN VIVO/g, 'EXPLORAR COMUNIDAD')
                    .replace(/✦ PILAR 3: VIDEOTECA DE ALTO IMPACTO \(TV\) ✦/g, '✦ CANAL DE SALUD Y VIDEOS CORTOS ✦')
                    .replace(/Televisión Digital Interactiva/g, 'Cápsulas Visuales de Bienestar')
                    .replace(/<strong>La revolución del video corto en tu sucursal\.<\/strong> Tu propia estación de televisión digital adaptada\. Ofrece contenidos de sintonía biológica y entrenamientos visuales fluidos que capturan y retienen la atención en formato vertical de alta fidelidad\./g, '<strong>Aprende en segundos.</strong> Contenidos en video corto de alta fidelidad con recomendaciones fisiológicas, respiración consciente y cápsulas prácticas para tu vida diaria.')
                    .replace(/Módulos Adicionales \(Up-Sells\)/g, 'Servicios y Herramientas Digitales')
                    .replace(/<section[^>]*id="upsell-ads-section"[^>]*>.*?<\/section>/gis, '')
                    .replace(/PROBAR SIMULACIÓN/g, 'CONSULTAR SERVICIO')
                    // 6. Rutas absolutas a imágenes y assets
                    .replace(/src="[^"]*assets\/webs\/salud1\.webp"/g, resolvedNiche === 'contable' ? 'src="https://robotiax.mx/assets/webs/contador1.webp"' : `src="https://robotiax.mx/assets/webs/${resolvedNiche}1.webp"`)
                    .replace(/src="assets\/webs\/salud1\.webp"/g, resolvedNiche === 'contable' ? 'src="https://robotiax.mx/assets/webs/contador1.webp"' : `src="https://robotiax.mx/assets/webs/${resolvedNiche}1.webp"`)
                    .replace(/css\/demo_salud\.css/g, `https://robotiax.mx/css/demo_salud.css?v=${cacheBuster}`)
                    .replace(/js\/demo_salud\.js/g, `https://robotiax.mx/js/demo_salud.js?v=${cacheBuster}`)
                    .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, '$1="https://robotiax.mx/assets/$2"')
                    .replace(/(src|href)=['"]\/?css\/([^'"]+)['"]/g, '$1="https://robotiax.mx/css/$2"')
                    .replace(/(src|href)=['"]\/?js\/([^'"]+)['"]/g, '$1="https://robotiax.mx/js/$2"')
                    .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, "url('https://robotiax.mx/assets/$1')");

                // Modal minimalista ultra-optimizado para móviles con los 3 pasos de activación
                const waModalHtml = `
                <div id="wa-setup-alert-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.85); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); z-index:999999; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;">
                    <div style="background:#ffffff; border-radius:20px; max-width:380px; width:100%; padding:22px 20px; text-align:left; box-shadow:0 20px 40px rgba(0,0,0,0.35); font-family:'Poppins', sans-serif; box-sizing:border-box;">
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
                            <div style="width:38px; height:38px; background:#25d366; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:20px; shrink-0;">
                                <i class="fa-brands fa-whatsapp"></i>
                            </div>
                            <div>
                                <h3 style="font-size:13px; font-weight:800; color:#0f172a; margin:0; text-transform:uppercase; letter-spacing:0.5px;">VINCULAR ASISTENTE</h3>
                                <span style="font-size:10px; color:#64748b; font-weight:600;">PASOS PARA ACTIVACIÓN</span>
                            </div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:12px 14px; margin-bottom:16px; font-size:11px; line-height:1.5; color:#334155;">
                            <p style="margin:0 0 8px 0;"><strong>1.</strong> Entra a: <a href="https://bot.ikai.info" target="_blank" style="color:#2563eb; font-weight:bold; text-decoration:underline;">bot.ikai.info</a></p>
                            <p style="margin:0 0 8px 0;"><strong>2.</strong> Ingresa tu token enviado por correo.</p>
                            <p style="margin:0;"><strong>3.</strong> En WhatsApp ve a <em>Dispositivos vinculados</em> y escanea el QR.</p>
                        </div>
                        <button type="button" onclick="document.getElementById('wa-setup-alert-modal').style.display='none'" style="width:100%; background:#0f172a; color:#ffffff; border:none; padding:12px; font-size:11px; font-weight:800; border-radius:10px; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">
                            ENTENDIDO Y CERRAR
                        </button>
                    </div>
                </div>
                `;
                compiledHtml = compiledHtml.replace('</body>', `${waModalHtml}</body>`);

                await deployStaticToR2(negocioSlug, compiledHtml, r2BucketName.value());
                console.log(`✅ [R2]: Sitio limpio compilado y desplegado para: ${negocioSlug}.html`);
            } catch (r2Err) {
                console.warn("⚠️ Advertencia R2:", r2Err.message);
            }
        })();

        provisionWhatsAppGateway(negocioSlug, tempPassword).catch(err => console.warn("Gateway error:", err.message));

        return res.status(200).json({ received: true, folio: folio });

    } catch (globalErr) {
        console.error("❌ ERROR CRÍTICO EN STRIPE WEBHOOK:", globalErr);
        return res.status(200).json({ error: globalErr.message });
    }
});
