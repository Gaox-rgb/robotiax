const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require("fs").promises;
const path = require("path");
const handlebars = require("handlebars");
const { defineString } = require('firebase-functions/params');
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const BASE_URL = 'https://robotiax.shop'; 

// Configuración Global para v2 con Techo Estricto Antidesbordamiento
setGlobalOptions({ 
    region: "us-central1",
    runtime: "nodejs22",
    maxInstances: 5,
    concurrency: 40,
    timeoutSeconds: 60
});

// Helper global para inyectar cabeceras CORS permisivas (incluyendo X-Robotiax-Token)
const setCorsHeaders = (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Robotiax-Token');
};

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

// Vertex AI eliminado: Dependencia innecesaria y costosa.

let transporter;
const mailUserParam = defineString('MAIL_USER', { default: 'geniosdeltalento@gmail.com' });
const mailPassParam = defineString('MAIL_PASS', { default: 'bcnmvqwyvfkhxpxd' });
const awsAccessKeyId = defineString('AWS_ACCESS_KEY_ID', { default: 'TUS_ACCESS_KEY_DE_AWS' });
const awsSecretAccessKey = defineString('AWS_SECRET_ACCESS_KEY', { default: 'TUS_SECRET_KEY_DE_AWS' });
const awsBucketName = defineString('AWS_BUCKET_NAME', { default: 'robotiax-sitios-web-2026' });
const stripeSecretKey = defineString('STRIPE_SECRET_KEY', { default: 'sk_live_51QS90fRtq7dI2nU3wM' });

const cleanVal = (v, def = "") => {
    if (!v || typeof v !== 'string' || v.trim().toLowerCase() === 'no') return def;
    return v.trim();
};

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: mailUserParam.value(),
                pass: mailPassParam.value()
            }
        });
    }
    return transporter;
};

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

let _bedrock;
const getBedrock = () => {
    if (!_bedrock) {
        _bedrock = new BedrockRuntimeClient({
            region: "us-east-1",
            credentials: {
                accessKeyId: (awsAccessKeyId.value() || "").trim(),
                secretAccessKey: (awsSecretAccessKey.value() || "").trim(),
            },
        });
    }
    return _bedrock;
};

let _s3;
const getS3 = () => {
   if (!_s3) {
        _s3 = new S3Client({
            region: "us-east-2",
            credentials: {
                accessKeyId: (awsAccessKeyId.value() || "").trim(),
                secretAccessKey: (awsSecretAccessKey.value() || "").trim(),
            },
        });
    }
    return _s3;
};

// Caché en memoria para eliminar lectura repetitiva de disco y ahorrar CPU/Bandwidth
const assetMemoryCache = new Map();
async function loadAsset(filePath) {
    if (assetMemoryCache.has(filePath)) {
        return assetMemoryCache.get(filePath);
    }
    try {
        const fullPath = path.resolve(__dirname, filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        assetMemoryCache.set(filePath, content);
        return content;
    } catch (e) {
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

            if (originalHost.includes('bot.ikai.info') || req.headers.host === 'bot.ikai.info') {
                return res.redirect(302, 'https://robotiax.shop/conectar.html');
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
                        const domainBase = 'https://robotiax.shop';

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

                        // Eliminación total de elementos de venta, tarjeta flotante amarilla y ajuste estricto de header en producción
                        finalHtmlWithFix = finalHtmlWithFix
                            .replace(/<button[^>]*>.*?COMPRAR WEB.*?<\/button>/gis, '')
                            .replace(/<button id="header-whatsapp-btn".*?<\/button>/gis, '')
                            .replace(/<button id="btn-return-catalog".*?<\/button>/gis, '')
                            .replace(/<div id="floating-benefits-card"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gis, '')
                            .replace(/<div id="floating-benefits-card"[\s\S]*?<\/div>/gis, '');
                        finalHtmlWithFix = finalHtmlWithFix
                            // Protocolo de Inyección de Assets Absolutos (Versión Reforzada Adaptativa)
                            .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, `$1="${domainBase}/assets/$2"`)
                            .replace(/(src|href)=['"]\/?css\/([^'"]+)['"]/g, `$1="${domainBase}/css/$2"`)
                            .replace(/(src|href)=['"]\/?js\/([^'"]+)['"]/g, `$1="${domainBase}/js/$2"`)
                            .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, `url('${domainBase}/assets/$1')`)
                            .replace(/['"]\/?assets\/([^'"]+?)['"]/g, `"${domainBase}/assets/$1"`)
                            .replace('</head>', clientDataScript + '</head>');

                        if (originalHost && originalHost.includes('.ikai.info') && !originalHost.startsWith('www.')) {
                            const slug = originalHost.split('.')[0].toLowerCase().trim();
                            const reservedSubdomains = ['metrics', 'deploy', 'testing', 'status', 'bot', 'api', 'admin', 'mail', 'store', 'test'];
                            const s3Client = getS3();

                            if (reservedSubdomains.includes(slug)) {
                                console.log(`🛑 [AUTO_MIGRATE_BYPASS]: Subdominio reservado detectado (${slug}). Auto-migración omitida.`);
                            } else if (!s3Client) {
                                console.warn(`⚠️ [AUTO_MIGRATE_ABORT]: Cliente S3/R2 no disponible. Subida a R2 omitida para: ${slug}.html`);
                            } else {
                                try {
                                    console.log(`📡 [AUTO_MIGRATE]: Migrando y compilando sitio estático para R2: ${slug}.html`);
                                    const putCommand = new PutObjectCommand({
                                        Bucket: awsBucketName.value(),
                                        Key: `sitios/${slug}.html`,
                                        Body: finalHtmlWithFix,
                                        ContentType: "text/html; charset=utf-8"
                                    });
                                    await s3Client.send(putCommand);
                                    console.log(`✅ [AUTO_MIGRATE_SUCCESS]: Compilación y subida completada en AWS S3 para ${slug}.html`);
                                } catch (r2Err) {
                                    console.error("❌ Error en auto-migración de R2:", r2Err.message);
                                }
                            }
                        }
                            
                        res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
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
                    image: { value: "https://robotiax.shop/assets/frenzy_1.webp" }
                },
                services_section: { title: "Nuestros Servicios", services: [
                    { name: "Calidad Premium", description: "Atención especializada con estándares internacionales.", icon_class: "fa-star" },
                    { name: "Soporte 24/7", description: "Estamos contigo en cada paso del proceso.", icon_class: "fa-headset" }
                ]},
                about_section: { doctor_name: "Equipo Robotiax", doctor_title: "Especialistas en Despliegue", bio: "Líderes en integración de inteligencia artificial y desarrollo web de élite.", image: { value: "https://robotiax.shop/assets/frenzy_2.webp" }, stats: [{value: "10y", label: "Experiencia"}] },
                contact_section: { headline: "Contacta con Nosotros", address: "Centro de Mando Digital", phone: "55 0000 0000", email: "contacto@robotiax.shop", copyright_text: "&copy; 2025 Robotiax Intelligence." },
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
                .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, '$1="https://robotiax.shop/assets/$2"')
                .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, "url('https://robotiax.shop/assets/$1')")
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

// Endpoint getSalesAgentResponse eliminado (Dependencia Vertex AI erradicada)

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
            'rs-elite': { name: 'Dominación Total Redes', price: 3999.00, currency: 'MXN' },
            'rs-hook-arsenal': { name: 'Hook Arsenal Pro', price: 100.00, currency: 'MXN' }
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

if (template === 'lead-diagnostico-pyme' || template === 'lead-red-legal-fiscal' || template === 'lead-gran-empresa' || template === 'lead-asesor-pyme') {
    const isCorp = template === 'lead-gran-empresa';
    const isLegal = template === 'lead-red-legal-fiscal';
    const isPymeDiag = template === 'lead-diagnostico-pyme';
    const mailerLead = getTransporter();

    let subject = `🚨 NUEVO LEAD PYME (${folio})`;
    let titleHeader = 'SOLICITUD RECIBIDA';
    let borderClr = '#00f2ff';

    if (isCorp) {
        subject = `🏛️ ESTUDIO CORPORATIVO: ${details.negocio} (${folio})`;
        titleHeader = '🏛️ SOLICITUD DE ESTUDIO TÉCNICO (GRAN EMPRESA)';
        borderClr = '#ffd700';
    } else if (isLegal) {
        subject = `⚖️ ASESORÍA ${details.legalMatter || 'LEGAL/FISCAL'}: ${details.contactName || details.negocio} (${folio})`;
        titleHeader = '⚖️ SOLICITUD DE CONEXIÓN CON ABOGADO / CONTADOR';
        borderClr = '#ffd700';
    } else if (isPymeDiag) {
        subject = `⚡ DIAGNÓSTICO AUTOMATIZACIÓN/VENTAS: ${details.negocio} (${folio})`;
        titleHeader = '⚡ SOLICITUD DE ACELERACIÓN COMERCIAL & AUTOMATIZACIÓN PYME';
        borderClr = '#00f2ff';
    }

    await mailerLead.sendMail({
        from: '"Robotiax B2B Leads" <contacto@robotiax.shop>',
        to: ['contacto@robotiax.shop', 'klvenoticias@gmail.com'],
        replyTo: clientEmail || 'contacto@robotiax.shop',
        subject: subject,
        html: `
            <div style="font-family: Arial, sans-serif; background: #020617; color: #e2e8f0; padding: 24px; border: 2px solid ${borderClr}; border-radius: 10px;">
                <h2 style="color: ${borderClr}; margin-top: 0; text-transform: uppercase;">${titleHeader}</h2>
                <p><strong>Folio:</strong> ${folio}</p>
                <p><strong>Empresa / Solicitante:</strong> ${details.negocio || '-'}</p>
                ${details.contactName ? `<p><strong>Contacto:</strong> ${details.contactName} (${details.role || 'Titular'})</p>` : ''}
                ${details.staffCount ? `<p><strong>Empleados:</strong> ${details.staffCount}</p>` : ''}
                ${details.legalMatter ? `<p><strong>Materia Legal/Fiscal:</strong> <strong style="color: #ff003c;">${details.legalMatter}</strong></p>` : ''}
                <p><strong>WhatsApp:</strong> <a href="https://wa.me/${String(details.telefono || '').replace(/\D/g, '')}" target="_blank" style="color: #25d366; font-weight: bold;">${details.telefono || '-'}</a></p>
                <p><strong>Correo:</strong> ${clientEmail || '-'}</p>
                <p><strong>Detalle del Problema / Dolor:</strong> ${details.servicios || '-'}</p>
                <p><strong>Presupuesto / Alcance:</strong> ${details.fee || '-'}</p>
                <hr style="border-color: #334155; margin: 16px 0;">
                <p style="font-size: 11px; color: #94a3b8; margin: 0;">Compromiso de respuesta al usuario: 24 a 72 horas hábiles.</p>
            </div>
        `
    }).catch(e => console.error('❌ Lead email falló:', e.message));
    return res.status(200).json({ status: 'lead_registered', folio: folio });
}

// BLOQUEO DE SEGURIDAD: Ningún producto web envía correos al cliente antes de pagar en Stripe
if (isWebProduct || template.startsWith('cfg-')) {
    return res.status(200).json({ status: 'awaiting_payment', folio: folio, negocioSlug: negocioSlug });
}

// --- FLUJO DE APROVISIONAMIENTO MODULAR ---

// 1. Aprovisionamiento de Hosting (Ejecución Pasiva vía Auxiliar)
await provisionFirebaseSubdomain(negocioSlug);

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
                    <td style="padding: 8px; color: #666; font-size: 12px;">CONSOLA WHATSAPP (QR):</td>
                    <td style="padding: 8px;"><a href="https://robotiax.shop/conectar.html?token=${tempPassword}&email=${encodeURIComponent(clientEmail || '')}" target="_blank" style="color: #2ecc71; font-weight: bold; text-decoration: none;">Instancia: ${negocioSlug} (Token: ${tempPassword})</a></td>
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
                .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, '$1="https://robotiax.shop/assets/$2"')
                .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, "url('https://robotiax.shop/assets/$1')")
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
                .replace(/css\/demo_salud\.css/g, `https://robotiax.shop/css/demo_salud.css?v=${cacheBuster}`)
                .replace(/js\/demo_salud\.js/g, `https://robotiax.shop/js/demo_salud.js?v=${cacheBuster}`)
                .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, '$1="https://robotiax.shop/assets/$2"')
                .replace(/(src|href)=['"]\/?css\/([^'"]+)['"]/g, '$1="https://robotiax.shop/css/$2"')
                .replace(/(src|href)=['"]\/?js\/([^'"]+)['"]/g, '$1="https://robotiax.shop/js/$2"')
                .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, "url('https://robotiax.shop/assets/$1')");
        }

       const putCommandStatic = new PutObjectCommand({
            Bucket: awsBucketName.value(),
            Key: `sitios/${negocioSlug}.html`,
            Body: htmlContent,
            ContentType: "text/html; charset=utf-8"
        });

        await getS3().send(putCommandStatic);
        console.log(`✅ [S3_STATIC_SUCCESS]: Archivo estático cargado exitosamente en sitios/${negocioSlug}.html`);
    } catch (errStatic) {
        console.error("❌ [S3_STATIC_ERROR]: Error compilando u hospedando sitio estático:", errStatic.message);
    }

    if (isConfigurator && !isWebProduct) {
        provisionWhatsAppGateway(negocioSlug, tempPassword).catch(async (err) => {
            await logFailedProvision(folio, 'AWS_WHATSAPP_GATEWAY', { instanceName: negocioSlug }, err.message);
        });
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

            // DELEGACIÓN ASÍNCRONA: Ya no usamos 'await' para bloquear la función.
            // La sincronización ocurre en segundo plano de forma independiente.
            new Promise((resolve) => {
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
                            console.log("✅ [SYNC_SUCCESS]: Licencia sincronizada en Makumoto Core.");
                        } else {
                            await logFailedProvision(folio, 'MAKUMOTO_CORE_LICENSE', syncPayload, `Core rechazó: ${resSync.statusCode}`);
                        }
                    });
                });

                reqSync.on("error", async (errSync) => {
                    await logFailedProvision(folio, 'MAKUMOTO_CORE_LICENSE', syncPayload, errSync.message);
                });

                reqSync.write(syncPayload);
                reqSync.end();
            }).catch(e => console.error("❌ [SYNC_ERROR_FATAL]: Fallo en secuencia de sincronización:", e.message));

            console.log(`🚀 [ASYNC_SYNC]: Proceso de sincronización delegado a background para ${folio}.`);
        } catch (syncError) {
            console.error("❌ [SYNC_ERROR_FATAL]: Fallo bloque Try/Catch Makumoto:", syncError.message);
        }

       // Cálculos precisos desglosados de cobro fiscal (Base + IVA)
        const basePriceNum = parseFloat(pData.price);
        const ivaNum = parseFloat((basePriceNum * 0.16).toFixed(2));
        const totalNum = parseFloat((basePriceNum * 1.16).toFixed(2));

        let clientReceiptHtml = "";

        if (isWebProduct) {
            clientReceiptHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; color: #334155;"><h2 style="color: #3b82f6; text-align: center; text-transform: uppercase; margin-bottom: 30px;">¡PEDIDO RECIBIDO! TU PLANTILLA ESTÁ EN PRODUCCIÓN</h2><p>Hola <strong>${details.negocio || 'Cliente Robotiax'}</strong>, hemos registrado la adquisición de tu plantilla web estática por <strong>$${totalNum.toFixed(2)} ${pData.currency}</strong> (Subtotal $${basePriceNum.toFixed(2)} + IVA $${ivaNum.toFixed(2)}).</p></div>`;
        } else {
            clientReceiptHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; color: #334155;"><h2 style="color: #16a34a; text-align: center; text-transform: uppercase; margin-bottom: 30px;">¡TODO LISTO! TU SUITE ESTÁ ACTIVADA</h2><p>Hola <strong>${details.negocio || 'Cliente Robotiax'}</strong>, confirmamos que tu orden de <strong>$255.00 MXN</strong> (Subtotal $219.83 MXN + IVA 16% $35.17 MXN) ha sido procesada.</p></div>`;
        }

        const mailer = getTransporter();

        Promise.all([
            mailer.sendMail({
                from: '"Robotiax Intelligence" <contacto@robotiax.shop>',
                to: 'contacto@robotiax.shop',
                replyTo: clientEmail || 'contacto@robotiax.shop',
                subject: `⚡ ACTIVACIÓN: ${details.negocio || 'SIN NOMBRE'} (${folio})`,
                html: adminMailHtml
            }).catch(e => console.error("❌ Correo Admin Falló:", e.message)),
            
            clientEmail ? mailer.sendMail({
                from: '"Robotiax Intelligence" <contacto@robotiax.shop>',
                to: clientEmail,
                subject: `✅ Orden Confirmada: ${folio}`,
                html: clientReceiptHtml
            }).catch(e => console.error("❌ Correo Cliente Falló:", e.message)) : Promise.resolve()
        ]);
        console.log(`🚀 [ASYNC_MAIL]: Procesos de correo disparados para ${folio}.`);

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
            Bucket: awsBucketName.value(),
            Key: `sitios/${negocioSlug}.html`,
            Body: htmlContent,
            ContentType: "text/html; charset=utf-8"
        });
        await getS3().send(putCommand);
        return true;
    } catch (e) { return false; }
}

const EVOLUTION_API_URL = 'https://bot.ikai.info';
const EVOLUTION_MASTER_KEY = 'RBX-GATEWAY-MASTER-SECRET-2025';
const WHATSAPP_WEBHOOK_URL = 'https://us-central1-robotiax.cloudfunctions.net/whatsappWebhook';
const HANDOFF_PAUSE_MS = 2 * 60 * 1000;

async function evolutionRequest(endpoint, method = 'GET', bodyObj = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_MASTER_KEY
        }
    };
    if (bodyObj) {
        options.body = JSON.stringify(bodyObj);
    }
    const resp = await fetch(`${EVOLUTION_API_URL}${endpoint}`, options);
    const rawText = await resp.text();
    let parsed = {};
    try { parsed = rawText ? JSON.parse(rawText) : {}; } catch (e) { parsed = { raw: rawText }; }
    return { ok: resp.ok, status: resp.status, data: parsed };
}

async function ensureInstanceWebhook(instanceName) {
    if (!instanceName) return false;
    try {
        const payload = {
            webhook: {
                enabled: true,
                url: WHATSAPP_WEBHOOK_URL,
                byEvents: false,
                base64: false,
                events: [
                    'MESSAGES_UPSERT',
                    'CONNECTION_UPDATE',
                    'QRCODE_UPDATED'
                ]
            }
        };
        const resSet = await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, 'POST', payload);
        return resSet.ok;
    } catch (e) {
        console.warn('⚠️ Error configurando webhook en Evolution:', e.message);
        return false;
    }
}

async function provisionWhatsAppGateway(negocioSlug, tempPassword) {
    if (!negocioSlug) return false;
    try {
        const createPayload = {
            instanceName: negocioSlug,
            token: tempPassword || '',
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
            webhook: {
                url: WHATSAPP_WEBHOOK_URL,
                byEvents: false,
                base64: false,
                events: [
                    'MESSAGES_UPSERT',
                    'CONNECTION_UPDATE',
                    'QRCODE_UPDATED'
                ]
            }
        };
        const resCreate = await evolutionRequest('/instance/create', 'POST', createPayload);
        if (!resCreate.ok) {
            await ensureInstanceWebhook(negocioSlug);
        }
        return true;
    } catch (e) {
        console.warn('⚠️ Error en provisionWhatsAppGateway:', e.message);
        return false;
    }
}

async function sendEvolutionText(instanceName, remoteJid, text) {
    const cleanNumber = String(remoteJid || '').replace('@s.whatsapp.net', '');
    const resSend = await evolutionRequest(`/message/sendText/${encodeURIComponent(instanceName)}`, 'POST', {
        number: cleanNumber,
        text: text
    });
    const sentId = resSend.data?.key?.id || resSend.data?.data?.key?.id || '';
    return { ok: resSend.ok, sentId: sentId, data: resSend.data };
}

async function invokeTrogoBedrock(orderData, customerMessage) {
    const bizName = cleanVal(orderData.negocio, 'Nuestro Negocio');
    const botCfg = orderData.botConfig || {};
    const fee = cleanVal(botCfg.fee || orderData.fee, 'Consulta personalizada');
    const hours = cleanVal(botCfg.horarios || orderData.horarios, 'Lunes a Viernes');
    const address = cleanVal(botCfg.direccion || orderData.direccion, 'Atención digital y presencial');
    const services = cleanVal(botCfg.servicios || orderData.servicios || orderData.specialty, 'Servicios profesionales');
    const extraInfo = cleanVal(botCfg.extraInfo, '');

    const systemPrompt = `Eres TROGO, un agente conversacional inteligente, empático y profesional que atiende a los clientes de "${bizName}". Respondes de forma natural, cálida y directa, casi humana, sin parecer un robot de menús rígidos.
Información oficial del negocio:
- Negocio: ${bizName}
- Servicios: ${services}
- Costo / Tarifa: ${fee}
- Horarios: ${hours}
- Dirección: ${address}
${extraInfo ? `- Información adicional: ${extraInfo}` : ''}

Reglas: Responde siempre en español, con claridad, ayudando al cliente a resolver sus dudas y motivándolo a agendar o contratar el servicio. No inventes precios ni datos que no estén en la información oficial.`;

    try {
        const client = getBedrock();
        const payload = {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 400,
            system: systemPrompt,
            messages: [
                { role: "user", content: customerMessage }
            ],
            temperature: 0.5
        };

        const command = new InvokeModelCommand({
            modelId: "anthropic.claude-haiku-4-5",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload)
        });

        const response = await client.send(command);
        const decodedBody = JSON.parse(new TextDecoder().decode(response.body));
        const aiText = decodedBody.content?.[0]?.text || '¡Hola! Con gusto te atendemos. ¿En qué podemos ayudarte hoy?';
        return aiText;
    } catch (err) {
        console.error("❌ Error invocando Bedrock Claude Haiku:", err.message);
        return `¡Hola! Gracias por comunicarte con ${bizName}. Recibimos tu mensaje y con gusto te atenderemos a la brevedad.`;
    }
}

function normalizeTextForIntent(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function detectAppointmentIntent(incomingText) {
    const q = normalizeTextForIntent(incomingText);
    const hasBookingWord = /\b(cita|agendar|agenda|reservar|reserva|apartar|programar|turno|consulta)\b/.test(q);
    const hasDayOrTime = /\b(manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(q)
        || /\b\d{1,2}(:\d{2})?\s?(am|pm|hrs|horas)\b/.test(q)
        || /\b\d{1,2}\/\d{1,2}\b/.test(q);
    return hasBookingWord || hasDayOrTime;
}

function generateFreeBotReply(orderData, incomingText, isVideo) {
    const bizName = cleanVal(orderData.negocio, 'Nuestro Negocio');
    if (isVideo) {
        return `Hola 👋 En *${bizName}* no procesamos archivos de video por este medio. Por favor escríbenos tu consulta en texto y con gusto te atendemos.`;
    }

    const botCfg = orderData.botConfig || {};
    const q = normalizeTextForIntent(incomingText);
    const fee = cleanVal(botCfg.fee || orderData.fee, 'Consulta personalizada según tu requerimiento');
    const hours = cleanVal(botCfg.horarios || orderData.horarios, 'Lunes a Viernes en horario comercial');
    const address = cleanVal(botCfg.direccion || orderData.direccion, 'Atención directa y digital');
    const phone = cleanVal(botCfg.telefono || orderData.telefono, '');
    const services = cleanVal(botCfg.servicios || orderData.servicios || orderData.specialty, 'Atención y asesoría especializada');
    const tagline = cleanVal(orderData.tagline || orderData.slogan, 'Gracias por contactarnos');
    const extraInfo = cleanVal(botCfg.extraInfo, '');
    const customWelcome = cleanVal(botCfg.welcomeMessage, '');

    const faqs = Array.isArray(botCfg.faqs) ? botCfg.faqs : [];
    for (const rule of faqs) {
        const rawKeys = String(rule?.keywords || '').split(/[,;|]+/).map(k => normalizeTextForIntent(k)).filter(Boolean);
        const answer = String(rule?.answer || '').trim();
        if (answer && rawKeys.some(k => q.includes(k))) {
            return answer;
        }
    }

    if (/^(1|precio|precios|costo|costos|cuanto|tarifa|cobra|vale|cotiz|presupuesto)/.test(q) || /\b(precio|costo|cuanto|tarifa|cotizacion|presupuesto|vale)\b/.test(q)) {
        return `💲 *Información de Costos — ${bizName}*\n\nEl costo base es: *${fee}*.\n*Servicios:* ${services}\n\nSi deseas apartar tu cita, indícanos tu nombre y el día/horario que prefieres.`;
    }

    if (/^(2|horario|horarios|hora|horas|abierto|abren|cierran|cuando)/.test(q) || /\b(horario|horarios|abierto|abren|cierran|atencion|sabado|domingo)\b/.test(q)) {
        return `🕒 *Horarios de Atención — ${bizName}*\n\nTe atendemos en: *${hours}*.\n${phone ? `Teléfono directo: ${phone}\n` : ''}\n¿Te gustaría agendar una cita o consulta?`;
    }

    if (/^(3|ubicacion|direccion|donde|mapa|llegar|sucursal)/.test(q) || /\b(ubicacion|direccion|donde|estan|domicilio|calle|llegar)\b/.test(q)) {
        return `📍 *Ubicación — ${bizName}*\n\nNos encontramos en: *${address}*.\nHorario: ${hours}.\n\n¿Deseas que te ayudemos a programar tu visita?`;
    }

    if (/^(4|cita|citas|agendar|reservar|servicio|servicios|especialidad|consulta)/.test(q) || /\b(cita|agendar|reservar|servicio|servicios|especialidades|informacion)\b/.test(q)) {
        return `📅 *Servicios y Citas — ${bizName}*\n\nServicios: *${services}*.\nCosto base: *${fee}*\nHorarios: *${hours}*\n\nTu solicitud quedó registrada para nuestro equipo. Por favor confírmanos tu *nombre completo*, *servicio* y *día/hora* deseados.`;
    }

    if (/^(5|humano|asesor|persona|agente|ayuda)/.test(q) || /\b(humano|asesor|persona|alguien|operador)\b/.test(q)) {
        return `👤 Entendido. He notificado a nuestro equipo de *${bizName}*. Un asesor humano revisará tu mensaje y te responderá por este mismo chat.`;
    }

    if (/^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hi|hello|menu|inicio|info)/.test(q)) {
        if (customWelcome) {
            return `${customWelcome}\n\n*1.* 💲 Precios\n*2.* 🕒 Horarios\n*3.* 📍 Ubicación\n*4.* 📅 Servicios / Agendar cita\n*5.* 👤 Hablar con asesor`;
        }
        return `¡Hola! 👋 Bienvenido a *${bizName}* (_${tagline}_).\n\nSoy tu asistente virtual 24/7. Escribe el número o tu pregunta sobre lo que necesitas:\n\n*1.* 💲 Precios y costos\n*2.* 🕒 Horarios de atención\n*3.* 📍 Ubicación\n*4.* 📅 Servicios o agendar cita\n*5.* 👤 Hablar con un asesor`;
    }

    return `Gracias por escribir a *${bizName}* 🙌\n\n• *Servicios:* ${services}\n• *Costo base:* ${fee}\n• *Horario:* ${hours}\n• *Dirección:* ${address}${extraInfo ? `\n• *Info adicional:* ${extraInfo}` : ''}\n\nResponde con *1* (Precios), *2* (Horarios), *3* (Ubicación), *4* (Agendar cita) o *5* (Asesor humano).`;
}

async function findOrderByTokenOrEmail(tokenInput, emailInput) {
    const cleanToken = String(tokenInput || '').trim().toUpperCase();
    const cleanEmail = String(emailInput || '').trim().toLowerCase();
    if (!cleanToken) return null;

    const snap = await getDb().collection('orders_to_fulfill')
        .where('provisionalPassword', '==', cleanToken)
        .limit(10)
        .get();

    if (snap.empty) return null;

    let selectedDoc = null;
    for (const docSnap of snap.docs) {
        const d = docSnap.data() || {};
        const docEmail = String(d.email || '').trim().toLowerCase();
        if (cleanEmail && docEmail === cleanEmail) {
            selectedDoc = docSnap;
            break;
        }
        if (!selectedDoc && d.status === 'paid_active') {
            selectedDoc = docSnap;
        }
    }
    if (!selectedDoc) {
        if (cleanEmail) return null;
        selectedDoc = snap.docs[0];
    }
    return selectedDoc;
}

async function checkAndTriggerQuotaMilestones(orderRef, orderData, newCount) {
    const isUnlimited = Boolean(orderData.isUnlimited || orderData.planTier === 'unlimited');
    if (isUnlimited) return;

    const limit = Number(orderData.messageLimit || 100);
    const alertsSent = orderData.alertsSent || {};
    const updates = {};
    const targetEmail = String(orderData.email || '').trim();
    const bizName = cleanVal(orderData.negocio, 'Tu Negocio');
    const folio = orderData.orderNumber || orderRef.id;
    const panelLink = 'https://robotiax.shop/panel.html';

    const pct = Math.round((newCount / limit) * 100);
    let subjectToSend = '';
    let bodyHighlight = '';

    if (newCount > limit) {
        updates.subscriptionActive = false;
        updates.status = 'suspended_limit';
        if (!alertsSent.suspended) {
            updates['alertsSent.suspended'] = true;
            subjectToSend = `⛔ SERVICIO SUSPENDIDO (${newCount > limit ? `${limit + 1}/${limit}` : `${newCount}/${limit}`}): Renueva tu Bot de WhatsApp (${bizName})`;
            bodyHighlight = `Has alcanzado el límite de <strong>${limit} mensajes mensuales</strong> (entrantes + salientes). A partir del mensaje <strong>${limit + 1}</strong> tu bot de WhatsApp ha sido suspendido temporalmente.`;
        }
    } else if (newCount >= Math.floor(limit * 0.97) && !alertsSent.p97) {
        updates['alertsSent.p97'] = true;
        subjectToSend = `🚨 ÚLTIMO AVISO (${newCount}/${limit} mensajes - 97%): Tu Bot está por suspenderse`;
        bodyHighlight = `Ya utilizaste <strong>${newCount} de ${limit} mensajes</strong> (${pct}%). Te quedan muy pocos mensajes antes de la suspensión automática en el mensaje ${limit + 1}.`;
    } else if (newCount >= Math.floor(limit * 0.90) && !alertsSent.p90) {
        updates['alertsSent.p90'] = true;
        subjectToSend = `⚠️ Alerta 90% de Cuota (${newCount}/${limit} mensajes): Renueva o sube a Ilimitado`;
        bodyHighlight = `Llevas <strong>${newCount} de ${limit} mensajes</strong> consumidos este mes (90%). Evita perder prospectos renovando a tiempo.`;
    } else if (newCount >= Math.floor(limit * 0.80) && !alertsSent.p80) {
        updates['alertsSent.p80'] = true;
        subjectToSend = `📊 Aviso 80% de Cuota (${newCount}/${limit} mensajes) — ${bizName}`;
        bodyHighlight = `Has alcanzado el <strong>80% de tu cuota mensual</strong> (${newCount} de ${limit} mensajes entre entrantes y salientes).`;
    }

    if (Object.keys(updates).length > 0) {
        await orderRef.update(updates);
    }

    if (subjectToSend && targetEmail) {
        try {
            const mailer = getTransporter();
            await mailer.sendMail({
                from: '"Robotiax Intelligence" <contacto@robotiax.shop>',
                to: targetEmail,
                subject: subjectToSend,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: auto; border: 1px solid #cbd5e1; border-radius: 10px; padding: 24px; color: #1e293b; background: #ffffff;">
                        <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">AVISO DE CUOTA — ${bizName}</h2>
                        <p style="font-size: 13px; line-height: 1.6; color: #334155;">${bodyHighlight}</p>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 12px;">
                            <p style="margin: 0 0 8px 0; font-weight: bold; color: #0f172a;">Opciones de Renovación / Ampliación (Precios Totales IVA Incluido):</p>
                            <ul style="margin: 0; padding-left: 18px; line-height: 1.7;">
                                <li><strong>Plan Básico (100 mensajes / 30 días):</strong> $255.00 MXN (Subtotal $219.83 + IVA $35.17)</li>
                                <li><strong>Plan Crecimiento (300 mensajes / 30 días):</strong> $500.00 MXN (Subtotal $431.03 + IVA $68.97)</li>
                                <li><strong>⭐ Plan Élite Ilimitado (Mensajes Ilimitados / 30 días):</strong> $599.00 MXN (Subtotal $516.38 + IVA $82.62)</li>
                            </ul>
                        </div>
                        <a href="${panelLink}" target="_blank" style="display: block; text-align: center; background: #00f2ff; color: #020617; font-weight: 800; padding: 12px 16px; border-radius: 8px; text-decoration: none; text-transform: uppercase; font-size: 12px;">
                            IR A MI PANEL PARA RENOVAR O SUBIR A ILIMITADO ➔
                        </a>
                        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 14px;">Folio: ${folio} • ROBOTIAX Engine</p>
                    </div>
                `
            });
        } catch (mailErr) {
            console.error('❌ Error enviando correo de alerta de cuota:', mailErr.message);
        }
    }
}

exports.whatsappWebhook = onRequest({
    cors: true,
    timeoutSeconds: 60,
    memory: "512MiB"
}, async (req, res) => {
    if (req.method === 'GET') {
        return res.status(200).json({ ok: true, service: 'robotiax-whatsapp-webhook' });
    }
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const body = req.body || {};
        const rawEvent = String(body.event || '').toUpperCase().replace(/\./g, '_');
        const instanceName = String(body.instance || body.instanceName || body.data?.instance || '').trim();

        if (!instanceName) {
            return res.status(200).json({ ignored: true, reason: 'missing_instance' });
        }

        const orderSnap = await getDb().collection('orders_to_fulfill')
            .where('negocio_slug', '==', instanceName)
            .limit(5)
            .get();

        if (orderSnap.empty) {
            return res.status(200).json({ ignored: true, reason: 'order_not_found' });
        }

        let orderDoc = orderSnap.docs.find(d => d.data()?.status === 'paid_active') || orderSnap.docs[0];
        const orderRef = orderDoc.ref;
        const orderData = orderDoc.data() || {};

        if (rawEvent === 'CONNECTION_UPDATE') {
            const state = body.data?.state || body.data?.status || '';
            if (state) {
                await orderRef.set({
                    whatsappStatus: state,
                    whatsappUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            return res.status(200).json({ ok: true, event: rawEvent, state });
        }

        if (rawEvent === 'QRCODE_UPDATED') {
            await orderRef.set({
                whatsappStatus: 'connecting',
                whatsappUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return res.status(200).json({ ok: true, event: rawEvent });
        }

        if (rawEvent !== 'MESSAGES_UPSERT') {
            return res.status(200).json({ ok: true, ignored: rawEvent });
        }

        const msgObj = Array.isArray(body.data) ? body.data[0] : (body.data?.messages?.[0] || body.data);
        if (!msgObj || !msgObj.key) {
            return res.status(200).json({ ignored: true, reason: 'no_message_key' });
        }

        const remoteJid = String(msgObj.key.remoteJid || '');
        if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) {
            return res.status(200).json({ ignored: true, reason: 'group_or_status' });
        }

        const fromMe = Boolean(msgObj.key.fromMe);
        const msgId = String(msgObj.key.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        const pushName = String(msgObj.pushName || remoteJid.split('@')[0]);
        const msgContent = msgObj.message || {};

        if (msgContent.protocolMessage || msgContent.senderKeyDistributionMessage) {
            return res.status(200).json({ ignored: true, reason: 'protocol_message' });
        }

        const isVideo = Boolean(msgContent.videoMessage || msgContent.ptvMessage);
        let text = '';
        if (isVideo) {
            text = '[Video recibido - formato no permitido por el plan]';
        } else {
            text = msgContent.conversation
                || msgContent.extendedTextMessage?.text
                || msgContent.imageMessage?.caption
                || msgContent.documentMessage?.caption
                || msgContent.buttonsResponseMessage?.selectedDisplayText
                || msgContent.listResponseMessage?.title
                || (msgContent.audioMessage ? '[Nota de voz recibida]' : '')
                || (msgContent.imageMessage ? '[Imagen recibida]' : '')
                || '[Mensaje recibido]';
        }

        const chatId = remoteJid.replace(/[^a-zA-Z0-9@._-]/g, '_');
        const chatRef = orderRef.collection('chats').doc(chatId);
        const msgDocRef = chatRef.collection('messages').doc(msgId);

        const existingMsgSnap = await msgDocRef.get();
        if (existingMsgSnap.exists) {
            return res.status(200).json({ ok: true, deduplicated: true });
        }

        const chatSnap = await chatRef.get();
        const chatData = chatSnap.exists ? (chatSnap.data() || {}) : {};
        const nowMs = Date.now();

        if (fromMe) {
            const botSentMarker = await orderRef.collection('bot_sent_ids').doc(msgId).get();
            const isRecentBotEcho = Boolean(
                chatData.lastBotReplyText
                && chatData.lastBotReplyAt
                && (nowMs - Number(chatData.lastBotReplyAt) < 15000)
                && chatData.lastBotReplyText === text
            );

            if (botSentMarker.exists || isRecentBotEcho) {
                return res.status(200).json({ ok: true, botEchoSkipped: true });
            }

            await msgDocRef.set({
                id: msgId,
                sender: 'human',
                text: text,
                fromMe: true,
                timestampMs: nowMs,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            await chatRef.set({
                chatId: chatId,
                remoteJid: remoteJid,
                contactName: chatData.contactName || remoteJid.split('@')[0],
                lastMessage: text,
                lastSender: 'human',
                lastMessageAt: nowMs,
                lastHumanReplyAt: nowMs,
                botPausedUntil: nowMs + HANDOFF_PAUSE_MS
            }, { merge: true });

            await orderRef.update({
                messageCount: admin.firestore.FieldValue.increment(1)
            });
            const nextHumanCount = Number(orderData.messageCount || 0) + 1;
            await checkAndTriggerQuotaMilestones(orderRef, orderData, nextHumanCount);

            return res.status(200).json({ ok: true, humanHandoffActivated: true });
        }

        const isUnlimited = Boolean(orderData.isUnlimited || orderData.planTier === 'unlimited');
        const limit = Number(orderData.messageLimit || 100);
        const currentCount = Number(orderData.messageCount || 0);
        const isExpired = Boolean(orderData.expiresAt && nowMs > Date.parse(orderData.expiresAt));
        const isAlreadySuspended = Boolean(orderData.subscriptionActive === false || orderData.status === 'suspended_limit');

        const writePromises = [
            msgDocRef.set({
                id: msgId,
                sender: 'customer',
                text: text,
                fromMe: false,
                isVideo: isVideo,
                timestampMs: nowMs,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }),
            chatRef.set({
                chatId: chatId,
                remoteJid: remoteJid,
                contactName: pushName,
                lastMessage: text,
                lastSender: 'customer',
                lastMessageAt: nowMs
            }, { merge: true }),
            orderRef.update({
                messageCount: admin.firestore.FieldValue.increment(1)
            })
        ];

        if (!isVideo && detectAppointmentIntent(text)) {
            const cleanPhone = remoteJid.replace('@s.whatsapp.net', '');
            writePromises.push(
                orderRef.collection('appointments').doc(chatId).set({
                    id: chatId,
                    contactName: pushName,
                    phone: cleanPhone,
                    note: text.slice(0, 300),
                    status: 'pendiente',
                    source: 'whatsapp_auto',
                    createdAtMs: nowMs,
                    updatedAtMs: nowMs
                }, { merge: true })
            );
        }

        await Promise.all(writePromises);
        const afterIncomingCount = currentCount + 1;

        await checkAndTriggerQuotaMilestones(orderRef, orderData, afterIncomingCount);

        if (isAlreadySuspended || isExpired || (!isUnlimited && afterIncomingCount >= limit)) {
            if (!isUnlimited && afterIncomingCount >= limit && !isAlreadySuspended) {
                await checkAndTriggerQuotaMilestones(orderRef, orderData, limit + 1);
            }
            return res.status(200).json({ ok: true, botSkipped: 'suspended_or_limit_reached' });
        }

        const isManualPaused = Boolean(chatData.manualBotPaused === true);
        const isHandoffActive = Boolean(chatData.botPausedUntil && nowMs < Number(chatData.botPausedUntil));

        if (isManualPaused || isHandoffActive) {
            return res.status(200).json({ ok: true, botSilent: true, reason: isManualPaused ? 'manual_pause' : 'handoff_2min' });
        }

        const replyText = generateFreeBotReply(orderData, text, isVideo);
        const replyTs = Date.now();

        await chatRef.set({
            lastBotReplyText: replyText,
            lastBotReplyAt: replyTs
        }, { merge: true });

        const sendResult = await sendEvolutionText(instanceName, remoteJid, replyText);
        if (sendResult.ok) {
            const botMsgId = sendResult.sentId || `bot_${replyTs}_${Math.random().toString(36).slice(2, 6)}`;
            await Promise.all([
                orderRef.collection('bot_sent_ids').doc(botMsgId).set({ createdAt: replyTs }),
                chatRef.collection('messages').doc(botMsgId).set({
                    id: botMsgId,
                    sender: 'bot',
                    text: replyText,
                    fromMe: true,
                    timestampMs: replyTs,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                }),
                chatRef.set({
                    lastMessage: replyText,
                    lastSender: 'bot',
                    lastMessageAt: replyTs
                }, { merge: true }),
                orderRef.update({
                    messageCount: admin.firestore.FieldValue.increment(1)
                })
            ]);
            const afterBotCount = afterIncomingCount + 1;
            await checkAndTriggerQuotaMilestones(orderRef, orderData, afterBotCount);
        }

        return res.status(200).json({ ok: true, replied: sendResult.ok });
    } catch (err) {
        console.error('❌ ERROR en whatsappWebhook:', err);
        return res.status(200).json({ error: err.message });
    }
});

exports.whatsappClientApi = onRequest({
    cors: true,
    timeoutSeconds: 60,
    memory: "512MiB"
}, async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action, token, email, chatId, text, paused } = req.body || {};
        if (!token) {
            return res.status(401).json({ error: 'Falta tu Token de Seguridad.' });
        }

        const orderDoc = await findOrderByTokenOrEmail(token, email);
        if (!orderDoc) {
            return res.status(403).json({ error: 'Token o correo no válidos. Revisa tu correo de bienvenida.' });
        }

        const orderRef = orderDoc.ref;
        const orderData = orderDoc.data() || {};
        const instanceName = orderData.negocio_slug;
        const limit = Number(orderData.messageLimit || 100);
        const count = Number(orderData.messageCount || 0);
        const isUnlimited = Boolean(orderData.isUnlimited || orderData.planTier === 'unlimited');
        const isExpired = Boolean(orderData.expiresAt && Date.now() > Date.parse(orderData.expiresAt));
        const isSuspended = Boolean(orderData.subscriptionActive === false || orderData.status === 'suspended_limit' || (!isUnlimited && count > limit) || isExpired);

        const botCfg = orderData.botConfig || {};
        const safeSummary = {
            folio: orderData.orderNumber || orderDoc.id,
            negocio: orderData.negocio || 'Mi Negocio',
            negocio_slug: instanceName,
            email: orderData.email || '',
            siteUrl: instanceName ? `https://${instanceName}.ikai.info` : 'https://robotiax.shop',
            whatsappStatus: orderData.whatsappStatus || 'close',
            planTier: orderData.planTier || (limit >= 1000 ? 'elite_1000' : (limit >= 300 ? 'pro_300' : 'basic_100')),
            planName: orderData.planName || (limit >= 1000 ? 'Plan Élite 1,000 Mensajes' : `Plan ${limit} Mensajes`),
            messageCount: count,
            messageLimit: limit,
            isUnlimited: false,
            erpActive: Boolean(orderData.erpActive),
            subscriptionActive: !isSuspended,
            status: isSuspended ? 'suspended_limit' : (orderData.status || 'paid_active'),
            expiresAt: orderData.expiresAt || null,
            botProfile: {
                horarios: botCfg.horarios || orderData.horarios || '',
                direccion: botCfg.direccion || orderData.direccion || '',
                telefono: botCfg.telefono || orderData.telefono || '',
                fee: botCfg.fee || orderData.fee || '',
                servicios: botCfg.servicios || orderData.servicios || orderData.specialty || '',
                welcomeMessage: botCfg.welcomeMessage || '',
                extraInfo: botCfg.extraInfo || '',
                faqs: Array.isArray(botCfg.faqs) ? botCfg.faqs : []
            }
        };

        if (action === 'verify_and_qr' || action === 'connection_state') {
            if (!instanceName) {
                return res.status(400).json({ error: 'Instancia no asignada a esta orden.' });
            }

            let connState = 'close';
            let qrBase64 = null;
            let qrCodeRaw = null;

            try {
                let stateRes = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(instanceName)}`, 'GET');
                if (!stateRes.ok && stateRes.status === 404) {
                    await provisionWhatsAppGateway(instanceName, orderData.provisionalPassword);
                    stateRes = await evolutionRequest(`/instance/connectionState/${encodeURIComponent(instanceName)}`, 'GET');
                } else {
                    await ensureInstanceWebhook(instanceName);
                }
                connState = stateRes.data?.instance?.state || stateRes.data?.state || 'close';

                if (action === 'verify_and_qr' && connState !== 'open') {
                    const qrRes = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`, 'GET');
                    qrBase64 = qrRes.data?.base64 || qrRes.data?.qrcode?.base64 || null;
                    qrCodeRaw = qrRes.data?.code || qrRes.data?.qrcode?.code || null;
                    if (qrBase64 && !qrBase64.startsWith('data:image')) {
                        qrBase64 = `data:image/png;base64,${qrBase64}`;
                    }
                }
            } catch (evoErr) {
                console.warn("⚠️ Advertencia conectando con Evolution Gateway (Tolerante a fallos):", evoErr.message);
            }

            return res.status(200).json({
                ok: true,
                state: connState,
                qrBase64: qrBase64,
                qrCode: qrCodeRaw,
                summary: safeSummary
            });
        }

        if (action === 'logout_instance') {
            await evolutionRequest(`/instance/logout/${encodeURIComponent(instanceName)}`, 'DELETE');
            return res.status(200).json({ ok: true, state: 'close', summary: safeSummary });
        }

        if (action === 'activate_trogo_mode') {
            const newLimit = 200;
            await orderRef.set({
                channel: 'trogo',
                trogoActive: true,
                messageLimit: newLimit,
                whatsappStatus: 'migrated_to_trogo',
                subscriptionActive: true,
                trogoActivatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            safeSummary.messageLimit = newLimit;
            safeSummary.subscriptionActive = true;
            safeSummary.channel = 'trogo';
            safeSummary.trogoActive = true;

            return res.status(200).json({
                ok: true,
                state: 'trogo_active',
                summary: safeSummary
            });
        }

        if (action === 'get_chats') {
            const chatsSnap = await orderRef.collection('chats')
                .orderBy('lastMessageAt', 'desc')
                .limit(50)
                .get();
            const nowMs = Date.now();
            const chats = chatsSnap.docs.map(d => {
                const c = d.data() || {};
                const handoffRemainingSec = (c.botPausedUntil && nowMs < Number(c.botPausedUntil))
                    ? Math.ceil((Number(c.botPausedUntil) - nowMs) / 1000)
                    : 0;
                return {
                    chatId: d.id,
                    remoteJid: c.remoteJid || d.id,
                    contactName: c.contactName || d.id.split('@')[0],
                    lastMessage: c.lastMessage || '',
                    lastSender: c.lastSender || 'customer',
                    lastMessageAt: c.lastMessageAt || 0,
                    manualBotPaused: Boolean(c.manualBotPaused),
                    handoffRemainingSec: handoffRemainingSec
                };
            });
            return res.status(200).json({ ok: true, state: safeSummary.whatsappStatus, chats: chats, summary: safeSummary });
        }

        if (action === 'get_messages') {
            if (!chatId) return res.status(400).json({ error: 'Falta chatId' });
            const msgsSnap = await orderRef.collection('chats').doc(chatId).collection('messages')
                .orderBy('timestampMs', 'asc')
                .limit(100)
                .get();
            const messages = msgsSnap.docs.map(d => d.data());
            const chatDoc = await orderRef.collection('chats').doc(chatId).get();
            const c = chatDoc.exists ? (chatDoc.data() || {}) : {};
            const nowMs = Date.now();
            const handoffRemainingSec = (c.botPausedUntil && nowMs < Number(c.botPausedUntil))
                ? Math.ceil((Number(c.botPausedUntil) - nowMs) / 1000)
                : 0;
            return res.status(200).json({
                ok: true,
                messages: messages,
                chatMeta: {
                    manualBotPaused: Boolean(c.manualBotPaused),
                    handoffRemainingSec: handoffRemainingSec
                },
                summary: safeSummary
            });
        }

        if (action === 'send_manual_reply') {
            const cleanText = String(text || '').trim();
            if (!cleanText) {
                return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
            }
            if (/\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(cleanText)) {
                return res.status(400).json({ error: 'El envío de videos está prohibido en este plan.' });
            }
            if (isSuspended || (!isUnlimited && count >= limit)) {
                return res.status(403).json({ error: 'Servicio suspendido por límite de mensajes o vigencia. Renueva o sube a Ilimitado.' });
            }

            const chatRef = orderRef.collection('chats').doc(chatId);
            const chatSnap = await chatRef.get();
            const remoteJid = chatSnap.exists ? (chatSnap.data().remoteJid || chatId) : chatId;
            const nowMs = Date.now();

            const sendRes = await sendEvolutionText(instanceName, remoteJid, cleanText);
            if (!sendRes.ok) {
                return res.status(502).json({ error: 'No se pudo enviar el mensaje. Verifica que tu WhatsApp esté conectado.' });
            }

            const msgId = sendRes.sentId || `human_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
            await orderRef.collection('bot_sent_ids').doc(msgId).set({ createdAt: nowMs });
            await chatRef.collection('messages').doc(msgId).set({
                id: msgId,
                sender: 'human',
                text: cleanText,
                fromMe: true,
                timestampMs: nowMs,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            await chatRef.set({
                chatId: chatId,
                remoteJid: remoteJid,
                lastMessage: cleanText,
                lastSender: 'human',
                lastMessageAt: nowMs,
                lastHumanReplyAt: nowMs,
                botPausedUntil: nowMs + HANDOFF_PAUSE_MS
            }, { merge: true });

            await orderRef.update({
                messageCount: admin.firestore.FieldValue.increment(1)
            });
            const updatedData = (await orderRef.get()).data() || {};
            const updatedCount = Number(updatedData.messageCount || (count + 1));
            await checkAndTriggerQuotaMilestones(orderRef, updatedData, updatedCount);

            safeSummary.messageCount = updatedCount;
            safeSummary.subscriptionActive = !(!isUnlimited && updatedCount > limit);

            return res.status(200).json({
                ok: true,
                msgId: msgId,
                handoffRemainingSec: 120,
                summary: safeSummary
            });
        }

        if (action === 'toggle_chat_bot') {
            if (!chatId) return res.status(400).json({ error: 'Falta chatId' });
            const shouldPause = Boolean(paused);
            await orderRef.collection('chats').doc(chatId).set({
                manualBotPaused: shouldPause,
                botPausedUntil: shouldPause ? (Date.now() + 24 * 60 * 60 * 1000) : 0
            }, { merge: true });
            return res.status(200).json({ ok: true, manualBotPaused: shouldPause, summary: safeSummary });
        }

        if (action === 'save_bot_config') {
            const cfg = req.body?.botConfig || {};
            const sanitizedFaqs = Array.isArray(cfg.faqs)
                ? cfg.faqs.slice(0, 30).map(item => ({
                    keywords: String(item?.keywords || '').trim().slice(0, 120),
                    answer: String(item?.answer || '').trim().slice(0, 800)
                })).filter(item => item.keywords && item.answer)
                : [];

            const cleanBotConfig = {
                horarios: String(cfg.horarios || '').trim().slice(0, 200),
                direccion: String(cfg.direccion || '').trim().slice(0, 300),
                telefono: String(cfg.telefono || '').trim().slice(0, 60),
                fee: String(cfg.fee || '').trim().slice(0, 120),
                servicios: String(cfg.servicios || '').trim().slice(0, 500),
                welcomeMessage: String(cfg.welcomeMessage || '').trim().slice(0, 500),
                extraInfo: String(cfg.extraInfo || '').trim().slice(0, 700),
                faqs: sanitizedFaqs,
                updatedAtMs: Date.now()
            };

            await orderRef.set({
                horarios: cleanBotConfig.horarios || orderData.horarios || '',
                direccion: cleanBotConfig.direccion || orderData.direccion || '',
                telefono: cleanBotConfig.telefono || orderData.telefono || '',
                fee: cleanBotConfig.fee || orderData.fee || '',
                servicios: cleanBotConfig.servicios || orderData.servicios || '',
                botConfig: cleanBotConfig
            }, { merge: true });

            safeSummary.botProfile = cleanBotConfig;
            return res.status(200).json({ ok: true, summary: safeSummary });
        }

        if (action === 'get_appointments') {
            const apptsSnap = await orderRef.collection('appointments')
                .orderBy('createdAtMs', 'desc')
                .limit(50)
                .get();
            const appointments = apptsSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
            return res.status(200).json({ ok: true, appointments: appointments, summary: safeSummary });
        }

        if (action === 'save_appointment') {
            const appt = req.body?.appointment || {};
            const nowMs = Date.now();
            const docId = String(appt.id || `appt_${nowMs}_${Math.random().toString(36).slice(2, 6)}`);
            const validStatuses = ['pendiente', 'confirmada', 'completada', 'cancelada'];
            const nextStatus = validStatuses.includes(appt.status) ? appt.status : 'pendiente';

            const payload = {
                id: docId,
                status: nextStatus,
                updatedAtMs: nowMs
            };
            if (appt.contactName) payload.contactName = String(appt.contactName).trim().slice(0, 120);
            if (appt.phone) payload.phone = String(appt.phone).trim().slice(0, 40);
            if (appt.dateText !== undefined) payload.dateText = String(appt.dateText).trim().slice(0, 120);
            if (appt.note !== undefined) payload.note = String(appt.note).trim().slice(0, 300);
            if (!appt.id) {
                payload.createdAtMs = nowMs;
                payload.source = 'manual';
            }

            await orderRef.collection('appointments').doc(docId).set(payload, { merge: true });
            return res.status(200).json({ ok: true, appointment: payload, summary: safeSummary });
        }

        return res.status(400).json({ error: 'Acción no reconocida.' });
    } catch (err) {
        console.error('❌ ERROR en whatsappClientApi:', err);
        return res.status(500).json({ error: err.message });
    }
});

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

        // Extracción directa desde el evento de Stripe sin llamadas externas
        const paymentIntent = event.data.object.payment_intent;
        if (paymentIntent && paymentIntent.next_action?.oxxo_display_details) {
            voucherUrl = paymentIntent.next_action.oxxo_display_details.hosted_voucher_url;
            voucherNumber = paymentIntent.next_action.oxxo_display_details.number;
        }

        const isPaid = isCheckout && session.payment_status === 'paid';
        const isOxxoPending = (isCheckout && session.payment_status === 'unpaid') || isPaymentAction;

        const clientEmail = (session.customer_details?.email || session.customer_email || '').trim();
        const clientName = (session.customer_details?.name || '').trim();
        const clientPhone = session.customer_details?.phone || 'No registrado';
         const rawAmountCents = Number(session.amount_total || 25500);
        const amountTotal = (rawAmountCents / 100).toFixed(2);
        const currency = (session.currency || 'mxn').toUpperCase();

        let rawRef = (session.client_reference_id || '').trim();
        try {
            while (rawRef.includes('%')) {
                const prev = rawRef;
                rawRef = decodeURIComponent(rawRef);
                if (rawRef === prev) break;
            }
        } catch (e) {}

        let clientRefFolio = rawRef;
        let embeddedEmail = '';
        let embeddedBusinessName = '';
        let embeddedPlanTag = '';

        if (rawRef.includes('__')) {
            const refParts = rawRef.split('__');
            clientRefFolio = (refParts[0] || '').trim();
            embeddedEmail = (refParts[1] || '').trim();
            embeddedBusinessName = (refParts[2] || '').trim();
            embeddedPlanTag = (refParts[3] || '').trim();
        }

        let planMeta = {
            type: 'subscription',
            planTier: 'basic_100',
            planName: 'Plan Básico (Web + Sala + Bot 100 Mensajes)',
            messageLimit: 100,
            isUnlimited: false,
            subtotal: '219.83',
            iva: '35.17',
            total: '255.00'
        };

        if (embeddedPlanTag === 'UPGRADE_89' || (rawAmountCents >= 8500 && rawAmountCents <= 9500)) {
            planMeta = {
                type: 'web_perfection',
                planTier: 'perfection_89',
                planName: 'Perfecciona Tu Web (3 Fotos + 5 Ajustes)',
                messageLimit: 100,
                isUnlimited: false,
                erpActive: false,
                subtotal: '76.72',
                iva: '12.28',
                total: '89.00'
            };
        } else if (embeddedPlanTag === 'PLAN_UNLIMITED_ERP' || (rawAmountCents >= 159000 && rawAmountCents <= 160500)) {
            planMeta = {
                type: 'subscription',
                planTier: 'elite_1000',
                planName: 'Plan Élite 1,000 Mensajes + ERP PyME (30 días)',
                messageLimit: 1000,
                isUnlimited: false,
                erpActive: true,
                subtotal: '1377.59',
                iva: '220.41',
                total: '1598.00'
            };
        } else if (embeddedPlanTag === 'PLAN_300_ERP' || (rawAmountCents >= 79500 && rawAmountCents <= 80500)) {
            planMeta = {
                type: 'subscription',
                planTier: 'pro_300',
                planName: 'Plan Crecimiento + ERP PyME (300 Mensajes / 30 días)',
                messageLimit: 300,
                isUnlimited: false,
                erpActive: true,
                subtotal: '689.66',
                iva: '110.34',
                total: '800.00'
            };
        } else if (embeddedPlanTag === 'PLAN_100_ERP' || (rawAmountCents >= 45000 && rawAmountCents <= 46000)) {
            planMeta = {
                type: 'subscription',
                planTier: 'basic_100',
                planName: 'Plan Básico + ERP PyME (100 Mensajes / 30 días)',
                messageLimit: 100,
                isUnlimited: false,
                erpActive: true,
                subtotal: '392.24',
                iva: '62.76',
                total: '455.00'
            };
        } else if (embeddedPlanTag === 'PLAN_UNLIMITED' || (rawAmountCents >= 59000 && rawAmountCents <= 60500)) {
            planMeta = {
                type: 'subscription',
                planTier: 'elite_1000',
                planName: 'Plan Élite 1,000 Mensajes (30 días)',
                messageLimit: 1000,
                isUnlimited: false,
                erpActive: false,
                subtotal: '516.38',
                iva: '82.62',
                total: '599.00'
            };
        } else if (embeddedPlanTag === 'PLAN_300' || (rawAmountCents >= 49500 && rawAmountCents <= 50500)) {
            planMeta = {
                type: 'subscription',
                planTier: 'pro_300',
                planName: 'Plan Crecimiento (300 Mensajes / 30 días)',
                messageLimit: 300,
                isUnlimited: false,
                erpActive: false,
                subtotal: '431.03',
                iva: '68.97',
                total: '500.00'
            };
        }

        const rawEmail = (
            session.customer_details?.email || 
            session.customer_email || 
            (typeof session.customer === 'object' ? session.customer?.email : null) || 
            ''
        ).trim();

        const searchEmail = (embeddedEmail || rawEmail || clientEmail).toLowerCase().trim();
        let draftData = {};

        if (clientRefFolio) {
            try {
                const draftDoc = await getDb().collection('orders_to_fulfill').doc(clientRefFolio).get();
                if (draftDoc.exists) {
                    draftData = draftDoc.data() || {};
                } else {
                    const snap = await getDb().collection('orders_to_fulfill')
                        .where('orderNumber', '==', clientRefFolio)
                        .limit(1)
                        .get();
                    if (!snap.empty) draftData = snap.docs[0].data() || {};
                }
            } catch (errDoc) {
                console.warn("Fallo leyendo borrador por folio:", errDoc.message);
            }
        }

        if (!draftData.negocio && searchEmail) {
            try {
                const snapEmail = await getDb().collection('orders_to_fulfill')
                    .where('email', '==', searchEmail)
                    .orderBy('timestamp', 'desc')
                    .limit(5)
                    .get();
                if (!snapEmail.empty) {
                    for (const doc of snapEmail.docs) {
                        const d = doc.data() || {};
                        if (d.negocio && d.negocio !== 'No especificado' && d.negocio !== 'Mi Negocio') {
                            draftData = d;
                            break;
                        }
                    }
                    if (!draftData.negocio) draftData = snapEmail.docs[0].data() || {};
                }
            } catch (errEmailSearch) {
                console.warn("Búsqueda por email con orden falló, intentando simple:", errEmailSearch.message);
                try {
                    const snapSimple = await getDb().collection('orders_to_fulfill')
                        .where('email', '==', searchEmail)
                        .limit(5)
                        .get();
                    if (!snapSimple.empty) {
                        for (const doc of snapSimple.docs) {
                            const d = doc.data() || {};
                            if (d.negocio && d.negocio !== 'No especificado') {
                                draftData = d;
                                break;
                            }
                        }
                    }
                } catch (e) {}
            }
        }

        const targetEmail = (
            draftData.email || 
            rawEmail || 
            clientEmail || 
            embeddedEmail || 
            ''
        ).trim();

        let cleanBizName = (draftData.negocio || embeddedBusinessName || '').trim();
        if (cleanBizName === 'No especificado' || cleanBizName.toLowerCase() === 'mi negocio') {
            cleanBizName = (draftData.negocio || '').trim();
        }

        const effectiveBusinessName = cleanBizName || 'Tu Negocio';

        const effectivePhone = (
            draftData.telefono || 
            session.customer_details?.phone || 
            'No registrado'
        ).trim();

        const now = new Date();
        const folio = draftData.orderNumber || clientRefFolio || `ORD-STRIPE-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const convenioCode = draftData.convenioCode || `MAK-AURA-${Math.floor(1000 + Math.random() * 9000)}`;
        const tempPassword = draftData.provisionalPassword || Math.random().toString(36).substring(2, 8).toUpperCase();
        const isRenewalOrUpgrade = Boolean(draftData.status === 'paid_active' || draftData.status === 'suspended_limit');

        let computedSlug = (draftData.negocio_slug || '')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");

        if (!computedSlug && cleanBizName) {
            computedSlug = cleanBizName
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)+/g, "");
        }

        if (!computedSlug) {
            computedSlug = folio.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        }

        const negocioSlug = computedSlug;

        const siteUrl = `https://${negocioSlug}.ikai.info`;
        const connectUrl = `https://robotiax.shop/conectar.html?token=${encodeURIComponent(tempPassword)}&email=${encodeURIComponent(targetEmail)}`;
        const panelUrl = `https://robotiax.shop/panel.html?token=${encodeURIComponent(tempPassword)}&email=${encodeURIComponent(targetEmail)}`;
        const mailer = getTransporter();

        try {
            await mailer.sendMail({
                from: '"Robotiax Intelligence" <contacto@robotiax.shop>',
                to: ['contacto@robotiax.shop', 'klvenoticias@gmail.com'],
                replyTo: targetEmail || 'contacto@robotiax.shop',
                subject: `🚨 PAGO STRIPE [${planMeta.total} MXN]: ${effectiveBusinessName} (${folio})`,
                html: `
                    <div style="font-family: Arial, sans-serif; background: #000; color: #00f2ff; padding: 30px; border: 2px solid #2ecc71;">
                        <h2 style="color: #2ecc71; margin-top: 0;">✅ PAGO CONFIRMADO EN STRIPE (${isRenewalOrUpgrade ? 'RENOVACIÓN / UPGRADE' : 'NUEVA ORDEN'})</h2>
                        <p><strong>Folio:</strong> ${folio}</p>
                        <p><strong>Plan Adquirido:</strong> ${planMeta.planName}</p>
                        <p><strong>Empresa / Razón Social:</strong> ${effectiveBusinessName}</p>
                        <p><strong>Cliente Stripe:</strong> ${clientName || 'No especificado'}</p>
                        <p><strong>Email Comprador:</strong> ${targetEmail || 'No registrado'}</p>
                        <p><strong>Teléfono:</strong> ${effectivePhone}</p>
                        <p><strong>Subtotal:</strong> $${planMeta.subtotal} MXN | <strong>IVA (16%):</strong> $${planMeta.iva} MXN | <strong>Total Cobrado:</strong> $${planMeta.total} ${currency}</p>
                        <hr style="border-color: #333;">
                        <p><strong>URL Web:</strong> <a href="${siteUrl}" style="color: #00f2ff;" target="_blank">${siteUrl}</a></p>
                        <p><strong>Consola QR:</strong> <a href="${connectUrl}" style="color: #2ecc71;" target="_blank">${connectUrl}</a></p>
                        <p><strong>Panel Chats:</strong> <a href="${panelUrl}" style="color: #2ecc71;" target="_blank">${panelUrl}</a></p>
                        <p><strong>Instancia:</strong> ${negocioSlug} | <strong>Token Bot:</strong> ${tempPassword}</p>
                    </div>
                `
            });
            console.log("✅ [CORREO ADMINISTRACIÓN]: Entregado.");
        } catch (mailAdminErr) {
            console.error("❌ ERROR AL ENVIAR CORREO A ADMINISTRACIÓN:", mailAdminErr.message);
        }

        if (isOxxoPending) {
            if (targetEmail) {
                try {
                    await mailer.sendMail({
                        from: '"Robotiax Intelligence" <contacto@robotiax.shop>',
                        to: targetEmail,
                        subject: `⏳ Vale OXXO Generado (${planMeta.total} MXN): Tu Suite se activará al pagar (${folio})`,
                        html: `
                            <div style="width: 100%; max-width: 540px; margin: 0 auto; box-sizing: border-box; padding: 18px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #1a1a1a; border: 1px solid #cbd5e1; border-radius: 8px;">
                                <div style="text-align: center; border-bottom: 2px solid #e11d48; padding-bottom: 12px; margin-bottom: 16px;">
                                    <h1 style="color: #e11d48; margin: 0; font-size: 17px; font-weight: 800; text-transform: uppercase;">VALE DE PAGO OXXO GENERADO</h1>
                                    <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0;">Esperando Confirmación de Caja</p>
                                </div>
                                <p style="font-size: 13px; line-height: 1.5; color: #334155; margin: 0 0 14px 0;">
                                    Hola <strong>${effectiveBusinessName}</strong>, hemos registrado tu vale para pagar en efectivo en OXXO por <strong>$${planMeta.total} MXN</strong> (IVA incluido).
                                </p>
                                <table style="width: 100%; font-size: 12px; line-height: 1.6; color: #334155; border-collapse: collapse; margin-bottom: 15px;">
                                    <tr><td><strong>Plan:</strong></td><td style="font-weight: bold;">${planMeta.planName}</td></tr>
                                    <tr><td><strong>Folio:</strong></td><td style="font-weight: bold; color: #2563eb;">${folio}</td></tr>
                                    <tr><td><strong>Subtotal:</strong></td><td>$${planMeta.subtotal} MXN</td></tr>
                                    <tr><td><strong>IVA (16%):</strong></td><td>$${planMeta.iva} MXN</td></tr>
                                    <tr><td><strong>Total a Pagar en Caja:</strong></td><td style="font-weight: bold; color: #16a34a;">$${planMeta.total} MXN</td></tr>
                                </table>
                                <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/66/Oxxo_Logo.svg" alt="OXXO" style="width: 70px; margin-bottom: 8px;">
                                    ${voucherNumber ? `
                                    <div style="margin: 10px 0;">
                                        <img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${voucherNumber.replace(/\s+/g, '')}&scale=2&height=12" alt="Código de Barras" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">
                                        <p style="font-family: monospace; font-size: 14px; font-weight: bold; color: #0f172a; letter-spacing: 2px; margin: 6px 0 0 0;">${voucherNumber}</p>
                                    </div>
                                    ` : `<p style="font-size: 12px; color: #64748b; margin: 8px 0;">Presenta el vale oficial generado en Stripe directamente en caja.</p>`}
                                </div>
                                <a href="${voucherUrl || 'https://buy.stripe.com/cNicN6dhi8SC5M27xd4gg0u'}" target="_blank" style="display: block; background: #00f2ff; color: #020617; padding: 12px; font-weight: 800; font-size: 12px; text-decoration: none; border-radius: 6px; text-transform: uppercase; text-align: center;">
                                    🖨️ VER E IMPRIMIR VALE OFICIAL EN STRIPE ➔
                                </a>
                            </div>
                        `
                    });
                } catch (oxxoMailErr) {
                    console.error("Error enviando correo de espera OXXO:", oxxoMailErr.message);
                }
            }

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

        if (targetEmail && isPaid) {
            try {
                const isHookArsenal = Boolean(draftData.template === 'rs-hook-arsenal' || (draftData.productName && draftData.productName.includes('Hook Arsenal')));
                // ASUNTO ESTRICTO UNIFICADO TAL COMO LO SOLICITASTE
                let emailSubject = `¡Tu Suite Digital y Bot están Activos! Accesos y Manual (${folio})`;
                let clientEmailHtml = "";

                if (planMeta.type === 'web_perfection') {
                    emailSubject = `⚡ Perfeccionamiento Confirmado ($89.00 MXN IVA inc.) — ${folio}`;
                    clientEmailHtml = `
                        <div style="max-width: 540px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 8px;">
                            <h2 style="color: #0f172a; margin-top: 0;">⚡ PERFECCIONAMIENTO DE WEB CONFIRMADO</h2>
                            <p>Hola <strong>${effectiveBusinessName}</strong>, recibimos tu pago por <strong>$${planMeta.total} MXN</strong> (Subtotal $${planMeta.subtotal} + IVA 16% $${planMeta.iva}).</p>
                            <p>Ingresa a tu panel para enviar tus 3 fotografías y hasta 5 modificaciones:</p>
                            <a href="https://robotiax.shop/desarrollo-web.html?upgrade=success" target="_blank" style="display: block; text-align: center; background: #00f2ff; color: #020617; font-weight: 800; padding: 12px; border-radius: 6px; text-decoration: none;">SUBIR MIS 3 FOTOS Y CAMBIOS ➔</a>
                        </div>
                    `;
                } else if (isHookArsenal) {
                    emailSubject = `⚡ Acceso Inmediato: Software Hook Arsenal Pro (${folio})`;
                    clientEmailHtml = `
                        <div style="width: 100%; max-width: 540px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; background: #000000; color: #ffffff; border: 2px solid #00f2ff; border-radius: 12px;">
                            <h1 style="color: #00f2ff; font-size: 18px; text-align: center;">HOOK ARSENAL PRO ACTIVADO</h1>
                            <p style="font-size: 13px;">Hola <strong>${effectiveBusinessName}</strong>, confirmamos tu pago de <strong>$${amountTotal} ${currency}</strong>.</p>
                            <a href="https://robotiax.shop/downloads/hook-arsenal.html" target="_blank" style="display: block; background: #39ff14; color: #000000; padding: 14px; font-weight: 900; text-align: center; text-decoration: none; border-radius: 6px;">ABRIR Y DESCARGAR SOFTWARE AHORA ➔</a>
                        </div>
                    `;
                } else {
                    const onboardingPdfText = `======================================================================
MANUAL TECNICO DE PUESTA EN MARCHA — SUITE DIGITAL ROBOTIAX
======================================================================
Cliente / Negocio : ${effectiveBusinessName}
Folio de Orden    : ${folio}
Subdominio Oficial: https://${negocioSlug}.ikai.info
Token de Seguridad: ${tempPassword}
Consola QR        : ${connectUrl}
Panel de Control  : ${panelUrl}
Vigencia Inicial  : 30 dias naturales (renovable)
----------------------------------------------------------------------
PASO 1: VINCULAR TU WHATSAPP CON QR
1. Abre desde tu computadora o tablet: ${connectUrl}
2. Abre WhatsApp en tu celular principal.
3. Ve a 'Ajustes' o 'Configuracion' > 'Dispositivos vinculados'.
4. Pulsa 'Vincular un dispositivo' y escanea el codigo QR en pantalla.
5. El estado cambiara inmediatamente a 'WHATSAPP CONECTADO'.

PASO 2: GESTION DE CHATS EN VIVO
1. Ingresa a tu Panel: ${panelUrl}
2. En la pestaña 'Chats en Vivo' observaras todas las conversaciones.
3. Si contestas manualmente, el bot entrara en modo silencioso durante
   2 minutos para no interrumpir tu conversacion humana.

PASO 3: CONFIGURAR RESPUESTAS Y ENTRENAR AL ASISTENTE
1. En el panel ve a 'Configurar Info'.
2. Define costos de consulta, horarios, direccion fisica y servicios.
3. Agrega preguntas frecuentes (FAQs); tu bot respondera al instante.

PASO 4: CALENDARIO DE CITAS
1. Las citas solicitadas por clientes quedan registradas en 'Mis Citas'.
2. Puedes marcar cada cita como Confirmada, Completada o Cancelada.

GARANTIA DE SERVICIO:
Tu subdominio (${negocioSlug}.ikai.info) y hosting cloud de alta velocidad
quedan completamente cubiertos y activos sin cargos sorpresa durante tu plan.
Soporte Tecnico Directo: contacto@robotiax.shop | clientes@robotiax.com
======================================================================`;

                    clientEmailHtml = `
                        <div style="width: 100%; max-width: 560px; margin: 0 auto; box-sizing: border-box; padding: 18px 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #1a1a1a; border: 1px solid #cbd5e1; border-radius: 10px;">
                            <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 16px;">
                                <h1 style="color: #0f172a; margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">${isRenewalOrUpgrade ? '¡PLAN RENOVADO Y ACTIVO!' : '¡SUITE DIGITAL Y BOT ACTIVADOS!'}</h1>
                                <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0;">Comprobante Oficial, Garantía de Servicio y Manual de Usuario</p>
                            </div>

                            <p style="font-size: 13px; line-height: 1.5; margin: 0 0 14px 0; color: #334155;">Hola <strong>${effectiveBusinessName}</strong>, confirmamos que tu orden por <strong>$${planMeta.total} MXN</strong> (IVA incluido) ha sido procesada con éxito.</p>

                            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin: 14px 0;">
                                <h3 style="margin: 0 0 6px 0; color: #1e3a8a; font-size: 11px; font-weight: 700; text-transform: uppercase;">🧾 DETALLE FISCAL DE TU COMPRA</h3>
                                <table style="width: 100%; font-size: 11px; line-height: 1.6; color: #1e3a8a; border-collapse: collapse;">
                                    <tr><td><strong>Folio:</strong></td><td style="font-weight: bold;">${folio}</td></tr>
                                    <tr><td><strong>Producto / Plan:</strong></td><td style="font-weight: bold;">${planMeta.planName}</td></tr>
                                    <tr><td><strong>Subtotal:</strong></td><td>$${planMeta.subtotal} MXN</td></tr>
                                    <tr><td><strong>IVA (16%):</strong></td><td>$${planMeta.iva} MXN</td></tr>
                                    <tr><td><strong>Total Pagado:</strong></td><td style="color: #16a34a; font-weight: bold;">$${planMeta.total} MXN</td></tr>
                                </table>
                            </div>

                            <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 14px; margin: 16px 0;">
                                <p style="margin: 0; font-weight: 800; font-size: 12px; color: #15803d; text-transform: uppercase;">🌟 BENEFICIO EXCLUSIVO DE TU MEMBRESÍA: HOSTING Y SUBDOMINIO INCLUIDOS</p>
                                <p style="font-size: 12px; color: #166534; line-height: 1.5; margin: 6px 0 8px 0;">
                                    Tu plan incluye <strong>30 días de Hosting Cloud de alta velocidad</strong> y tu <strong>Subdominio Comercial propio</strong> asignado bajo el nombre de tu negocio, activo durante la vigencia de tu plan.
                                </p>
                                <p style="margin: 0; font-size: 13px; word-break: break-all;">
                                    <strong>Tu Sitio Web en Línea:</strong> <a href="${siteUrl}" target="_blank" style="color: #15803d; font-weight: 800; text-decoration: underline;">${siteUrl}</a>
                                </p>
                            </div>

                            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 12px; margin: 16px 0;">
                                <h3 style="color: #065f46; font-size: 13px; font-weight: 700; margin: 0 0 8px 0; text-transform: uppercase;">🤖 CONEXIÓN DE TU ASISTENTE DE WHATSAPP</h3>
                                <p style="font-size: 12px; color: #047857; margin: 0 0 8px 0;">Instancia Asignada: <strong>${negocioSlug}</strong> | Token de Seguridad: <strong style="background: #ffffff; border: 1px solid #059669; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${tempPassword}</strong></p>
                                <ol style="font-size: 12px; line-height: 1.6; color: #065f46; margin: 0 0 12px 0; padding-left: 18px;">
                                    <li>Abre tu pantalla de enlace QR: <a href="${connectUrl}" target="_blank" style="color: #059669; font-weight: bold;">Conectar WhatsApp</a></li>
                                    <li>En tu celular abre WhatsApp ➔ <strong>Dispositivos vinculados</strong> y escanea el código en pantalla.</li>
                                    <li>Monitorea tus chats en vivo y citas desde tu <a href="${panelUrl}" target="_blank" style="color: #059669; font-weight: bold;">Panel de Control</a>.</li>
                                </ol>
                                <a href="${connectUrl}" target="_blank" style="display: block; text-align: center; background: #16a34a; color: #ffffff; padding: 11px; border-radius: 6px; font-weight: 800; font-size: 12px; text-decoration: none; text-transform: uppercase;">ESCANEAR CÓDIGO QR AHORA ➔</a>
                            </div>

                            <div style="background: #0f172a; color: #ffffff; border-radius: 8px; padding: 16px 14px; margin: 16px 0; border: 1px solid #38bdf8;">
                                <h3 style="color: #38bdf8; font-size: 13px; font-weight: 800; margin: 0 0 8px 0; text-transform: uppercase;">📘 MANUAL TÉCNICO Y PUESTA EN MARCHA</h3>
                                <p style="font-size: 12px; color: #cbd5e1; line-height: 1.5; margin: 0 0 10px 0;">
                                    Hemos adjuntado tu manual operativo completo en este correo (<strong>Manual_Puesta_en_Marcha.txt</strong>). Puedes consultar la guía en cualquier momento y compartirla con tu equipo de trabajo.
                                </p>
                                <a href="${panelUrl}" target="_blank" style="display: block; text-align: center; background: #0284c7; color: #ffffff; padding: 10px; border-radius: 6px; font-weight: 800; font-size: 12px; text-decoration: none; text-transform: uppercase;">ENTRAR AL PANEL DE CONTROL ➔</a>
                            </div>

                            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin: 14px 0; font-size: 11px; color: #334155;">
                                <strong>📌 Vigencia y Cuotas:</strong> Cobertura de 30 días naturales. El plan básico incluye 100 mensajes (entrantes + salientes) con notificaciones preventivas al 80%, 90% y 97%. Puedes ampliar o renovar tu cuota en cualquier momento desde tu <a href="${panelUrl}" target="_blank" style="color: #2563eb; font-weight: bold;">Panel de Control</a>.
                            </div>

                            <div style="background: #ffffff; color: #0f172a; border-radius: 8px; padding: 14px; margin: 16px 0; text-align: center; border: 1px solid #e2e8f0;">
                                <h4 style="color: #0f172a; font-size: 12px; font-weight: 800; margin: 0 0 6px 0; text-transform: uppercase;">⚡ OPCIONAL: PERFECCIONA TU WEB ($89.00 MXN)</h4>
                                <p style="font-size: 11px; color: #64748b; margin: 0 0 10px 0;">Sube 3 fotografías personalizadas y solicita hasta 5 cambios de contenido.</p>
                                <a href="https://buy.stripe.com/bJe8wQ9128SC7UacRx4gg0g?prefilled_email=${encodeURIComponent(targetEmail)}&client_reference_id=${encodeURIComponent(`${folio}__${targetEmail}__${effectiveBusinessName}__UPGRADE_89`)}" target="_blank" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 9px 16px; font-weight: 700; font-size: 11px; text-decoration: none; border-radius: 6px; text-transform: uppercase;">MEJORAR MI WEB ➔</a>
                            </div>
                        </div>
                    `;
                }

                await mailer.sendMail({
                    from: '"Robotiax Intelligence" <geniosdeltalento@gmail.com>',
                    to: targetEmail,
                    subject: emailSubject,
                    html: clientEmailHtml,
                    attachments: [
                        {
                            filename: `Manual_Puesta_en_Marcha_${negocioSlug}.txt`,
                            content: `======================================================================\nMANUAL TECNICO DE PUESTA EN MARCHA — SUITE DIGITAL ROBOTIAX\n======================================================================\nNegocio: ${effectiveBusinessName}\nFolio: ${folio}\nWeb: ${siteUrl}\nToken de Seguridad: ${tempPassword}\nConsola QR: ${connectUrl}\nPanel de Control: ${panelUrl}\n\n1. CONECTAR WHATSAPP:\n   Ingresa a ${connectUrl} y escanea el QR desde WhatsApp > Dispositivos Vinculados.\n\n2. PANEL DE CONTROL:\n   Entra a ${panelUrl} para monitorear conversaciones, modificar precios, horarios y responder mensajes.\n\n3. GARANTIA DE SERVICIO:\n   Hosting de alta velocidad y subdominio ${negocioSlug}.ikai.info incluidos durante tu plan.\n======================================================================`,
                            contentType: 'text/plain'
                        }
                    ]
                });
            } catch (mailClientErr) {
                console.error(`❌ ERROR AL ENVIAR AL CLIENTE (${targetEmail}):`, mailClientErr.message);
            }
        }

        if (planMeta.type === 'web_perfection') {
            await getDb().collection('orders_to_fulfill').doc(folio).set({
                perfectionPaid: true,
                perfectionPaidAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return res.status(200).json({ received: true, folio: folio, upgrade: 'perfection_89' });
        }

        const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        try {
            await getDb().collection('orders_to_fulfill').doc(folio).set({
                ...draftData,
                orderNumber: folio,
                productName: draftData.productName || planMeta.planName,
                isWeb: true,
                negocio: effectiveBusinessName,
                negocio_slug: negocioSlug,
                email: targetEmail,
                telefono: effectivePhone,
                fee: cleanVal(draftData.fee, "$800 MXN"),
                convenioCode: convenioCode,
                provisionalPassword: tempPassword,
                stripeSessionId: session.id,
                planTier: planMeta.planTier,
                planName: planMeta.planName,
                messageLimit: planMeta.messageLimit,
                isUnlimited: planMeta.isUnlimited,
                erpActive: Boolean(planMeta.erpActive),
                messageCount: 0,
                alertsSent: { p80: false, p90: false, p97: false, suspended: false },
                subscriptionActive: true,
                expiresAt: newExpiresAt,
                status: 'paid_active',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (dbErr) {
            console.error("⚠️ Error guardando en Firestore:", dbErr.message);
        }

        if (!isRenewalOrUpgrade) {
            provisionFirebaseSubdomain(negocioSlug).catch(err => console.warn("Subdominio error:", err.message));

            try {
                const templatePath = path.join(__dirname, 'templates', 'demo_salud.html');
                const rawTemplate = await fs.readFile(templatePath, 'utf8');
                const cacheBuster = Date.now();
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
                    .replace('</head>', `${clientDataScript}</head>`)
                    .replace(/<title>.*?<\/title>/g, `<title>${effectiveBusinessName} | Portal Oficial</title>`)
                    .replace(/<span id="header-brand-title".*?<\/span>/gs, `<span id="header-brand-title" class="font-['Inter'] text-[9px] font-black text-slate-800 uppercase tracking-tight">${effectiveBusinessName}</span>`)
                    .replace(/<div id="header-theme-picker".*?<\/div>/gs, '')
                    .replace(/<button[^>]*onclick="[^"]*openCloserModal[^"]*"[^>]*>.*?<\/button>/gis, '')
                    .replace(/<button[^>]*>.*?COMPRAR WEB.*?<\/button>/gis, '')
                    .replace(/<button[^>]*id="btn-return-catalog"[^>]*>.*?<\/button>/gis, '')
                    .replace(/<!-- MODAL DE CIERRE DE VENTA -->.*?<!-- SCRIPTS CORE -->/gs, '<!-- SCRIPTS CORE -->')
                    .replace(/Dr\. Alejandro Morales/g, effectiveBusinessName)
                    .replace(/ESPECIALISTA CERTIFICADO/g, clientData.badge)
                    .replace(/Nutrición Estética & Neurología Preventiva/g, clientData.specialty)
                    .replace(/"Tu bienestar es nuestra ciencia"/g, `"${clientData.tagline}"`)
                    .replace(/Torre Médica, Cons\. 402/g, clientData.direccion)
                    .replace(/Lun - Vie 9am a 6pm/g, clientData.horarios)
                    .replace(/\+52 55 1234 5678/g, clientData.telefono)
                    .replace(/\$800 MXN/g, clientData.fee)
                    .replace(/<section[^>]*id="upsell-ads-section"[^>]*>.*?<\/section>/gis, '')
                    .replace(/src="[^"]*assets\/webs\/salud1\.webp"/g, resolvedNiche === 'contable' ? 'src="https://robotiax.shop/assets/webs/contador1.webp"' : `src="https://robotiax.shop/assets/webs/${resolvedNiche}1.webp"`)
                    .replace(/src="assets\/webs\/salud1\.webp"/g, resolvedNiche === 'contable' ? 'src="https://robotiax.shop/assets/webs/contador1.webp"' : `src="https://robotiax.shop/assets/webs/${resolvedNiche}1.webp"`)
                    .replace(/css\/demo_salud\.css/g, `https://robotiax.shop/css/demo_salud.css?v=${cacheBuster}`)
                    .replace(/js\/demo_salud\.js/g, `https://robotiax.shop/js/demo_salud.js?v=${cacheBuster}`)
                    .replace(/(src|href)=['"]\/?assets\/([^'"]+)['"]/g, '$1="https://robotiax.shop/assets/$2"')
                    .replace(/(src|href)=['"]\/?css\/([^'"]+)['"]/g, '$1="https://robotiax.shop/css/$2"')
                    .replace(/(src|href)=['"]\/?js\/([^'"]+)['"]/g, '$1="https://robotiax.shop/js/$2"')
                    .replace(/url\(['"]?\/?assets\/([^'")]+)['"]?\)/g, "url('https://robotiax.shop/assets/$1')");

                const waModalHtml = `
                <div id="wa-setup-alert-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.85); backdrop-filter:blur(6px); z-index:999999; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;">
                    <div style="background:#ffffff; border-radius:20px; max-width:380px; width:100%; padding:22px 20px; text-align:left; box-shadow:0 20px 40px rgba(0,0,0,0.35); font-family:'Poppins', sans-serif; box-sizing:border-box;">
                        <h3 style="font-size:13px; font-weight:800; color:#0f172a; margin:0 0 10px 0; text-transform:uppercase;">VINCULAR ASISTENTE</h3>
                        <p style="font-size:11px; color:#334155; margin:0 0 14px 0;">Ingresa a <strong>robotiax.shop/conectar.html</strong> con tu token enviado por correo para escanear tu código QR.</p>
                        <button type="button" onclick="window.open('https://robotiax.shop/conectar.html', '_blank')" style="width:100%; background:#25d366; color:#ffffff; border:none; padding:12px; font-size:11px; font-weight:800; border-radius:10px; cursor:pointer; text-transform:uppercase;">IR A CONECTAR QR</button>
                    </div>
                </div>`;
                if (compiledHtml.includes('<div id="wa-setup-alert-modal"')) {
                    compiledHtml = compiledHtml.replace(/<div id="wa-setup-alert-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, waModalHtml);
                } else {
                    compiledHtml = compiledHtml.replace('</body>', `${waModalHtml}</body>`);
                }

                await deployStaticToR2(negocioSlug, compiledHtml, awsBucketName.value());
                console.log(`✅ [S3]: Sitio limpio compilado y desplegado para: ${negocioSlug}.html`);
            } catch (s3Err) {
                console.warn("⚠️ Advertencia S3:", s3Err.message);
            }

            await provisionWhatsAppGateway(negocioSlug, tempPassword).catch(err => console.warn("Gateway error:", err.message));
        } else {
            await ensureInstanceWebhook(negocioSlug).catch(err => console.warn("Webhook refresh error:", err.message));
        }

        return res.status(200).json({ received: true, folio: folio });

    } catch (globalErr) {
        console.error("❌ ERROR CRÍTICO EN STRIPE WEBHOOK:", globalErr);
        return res.status(200).json({ error: globalErr.message });
    }
});
