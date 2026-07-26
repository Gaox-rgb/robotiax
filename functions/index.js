const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require("fs").promises;
const path = require("path");
const handlebars = require("handlebars");
const { defineString } = require('firebase-functions/params');
const { onRequest } = require("firebase-functions/v2/https");
const paypal = require("@paypal/checkout-server-sdk");
const BASE_URL = 'https://robotiax.mx'; // O la URL de tu entorno actual
const nodemailer = require('nodemailer');
const https = require("https");

if (!admin.apps.length) {
    admin.initializeApp();
}

// PROTOCOLO PORTERO: VALIDACIÓN DE IDENTIDAD DE APP
const validarAcceso = (req) => {
    const token = req.headers['x-robotiax-token'];
    const secret = 'RBX-PRT-99-MXN-SECURE-2025';
    // Si trae el token correcto, permitimos el acceso sin importar el header de origen (más seguro para InPrivate)
    return token === secret;
};

// Getters de Carga Perezosa (Lazy Loading) para evitar Timeouts de 10s
let _db;
const getDb = () => { if (!_db) _db = admin.firestore(); return _db; };

let _bucket;
const getBucket = () => { if (!_bucket) _bucket = admin.storage().bucket('robotiax.appspot.com'); return _bucket; };

const { VertexAI } = require('@google-cloud/vertexai');

let vertexAIInstance;
const getVertexAI = () => {
    if (!vertexAIInstance) {
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
            host: "smtp.gmail.com",
            port: 465,
            secure: true, // true para puerto 465
            auth: {
                user: 'geniosdeltalento@gmail.com',
                pass: 'bcnmvqwyvfkhxpxd' // Verifica que este código siga activo en Google
            },
            tls: {
                rejectUnauthorized: false // Evita bloqueos por certificados locales
            }
        });
    }
    return transporter;
};

// Definimos los parámetros de PayPal con valores fallback para desarrollo local
const paypalClientId = defineString('PAYPAL_CLIENT_ID', { default: 'SANDBOX_CLIENT_ID_FALLBACK' });
const paypalSecret = defineString('PAYPAL_SECRET', { default: 'SANDBOX_SECRET_FALLBACK' });

// --- Configuración del Entorno PayPal ---
const getPaypalClient = () => {
    const clientId = paypalClientId.value();
    const clientSecret = paypalSecret.value();
    const env = new paypal.core.SandboxEnvironment(clientId, clientSecret);
    return new paypal.core.PayPalHttpClient(env);
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

exports.generateDemo = onRequest({ 
    memory: "1GiB", 
    timeoutSeconds: 120, 
    cors: true 
}, async (req, res) => {
    try {
            const templateName = req.query.template || 'medico-01-template.html';
            
            const templatePath = path.join(__dirname, 'templates', templateName);
            const baseName = templateName.replace('-template.html', '');
            const dataName = `demo_${baseName}.json`;
            const dataPath = path.join(__dirname, 'demo-data', dataName);

            // Leemos los archivos de forma optimizada
            const [templateContent, dataContent, tailwindCss, fontAwesomeCss] = await Promise.all([
                fs.readFile(templatePath, 'utf8'),
                fs.readFile(dataPath, 'utf8').catch(() => '{}'), // Si falla, devuelve un JSON vacío
                loadAsset('assets/css/tailwind.css'),
                loadAsset('assets/css/fontawesome.css')
            ]);

            const demoData = JSON.parse(dataContent);

            // "Parcheo" de datos (asegurando que las propiedades existen)
            demoData.branding = { ...demoData.branding, 
                business_name: req.query.name || demoData.branding?.business_name,
                tagline: req.query.tagline || demoData.branding?.tagline
            };
            demoData.hero_section = { ...demoData.hero_section,
                headline: req.query.headline || demoData.hero_section?.headline,
                primary_cta_text: req.query.cta || demoData.hero_section?.primary_cta_text
            };

            // Mapeo de Servicios (asumiendo formato de texto o lista en plantilla)
            if (req.query.services) {
                demoData.services_section = { ...demoData.services_section,
                    description: req.query.services 
                };
            }
            demoData.contact_section = { ...demoData.contact_section,
                phone: req.query.phone || demoData.contact_section?.phone,
                email: req.query.email || demoData.contact_section?.email,
                address: req.query.address || demoData.contact_section?.address,
                business_hours: req.query.hours || demoData.contact_section?.business_hours,
                consultation_fee: req.query.fee || demoData.contact_section?.consultation_fee
            };

            if (req.query.imageUrl) {
                demoData.hero_section.image = { ...demoData.hero_section.image, value: req.query.imageUrl };
            }

            demoData.styles = { tailwind: tailwindCss, fontawesome: fontAwesomeCss };
            
            const template = handlebars.compile(templateContent);
            const finalHtml = template(demoData);

            const cssInject = `<style>footer, footer p, footer a, footer div {color: #e2e8f0 !important;} footer a:hover {color: #ffffff !important;}</style>`;
            const finalHtmlWithFix = finalHtml.replace('</head>', cssInject + '</head>');
            
            res.set('Content-Type', 'text/html').status(200).send(finalHtmlWithFix);

        } catch (error) {
            console.error("CRASH LOG:", error);
            res.status(500).send(`ERROR_INTERNO: ${error.message}`);
        }
});

// --- Funciones de Pago PayPal ---

// 1. Crea una orden en PayPal y devuelve el ID de la orden al cliente.
exports.createPaypalOrder = onRequest({ cors: true }, async (req, res) => {
    try {
        if (!validarAcceso(req)) return res.status(403).json({ error: "PROTOCOLO_BLOQUEADO" });

        const { productId, fundingType, returnUrl } = req.body;

        if (!productId) return res.status(400).send("Falta ID de producto.");

        // 1. Determinación de URL de Retorno (Local vs Producción)
        const isLocal = req.headers.host && req.headers.host.includes('localhost');
        const finalReturnUrl = returnUrl || (isLocal ? 'http://localhost:5000/desarrollo-web.html' : `${BASE_URL}/desarrollo-web.html`);

        // 2. Obtención de datos del producto (Soporte dinámico y fallback para E-commerce y Redes Sociales)
        const ecommerceProducts = {
            'nexus-drop': { name: 'Nexus Drop', price: 1999.00, currency: 'MXN' },
            'storefront-pro': { name: 'Storefront Pro', price: 3499.00, currency: 'MXN' },
            'omnicanal-elite': { name: 'Omnicanal Elite', price: 7499.00, currency: 'MXN' },
            'rs-basic': { name: 'Página Comercial FB/IG', price: 599.00, currency: 'MXN' },
            'rs-pro': { name: 'Campaña Crecimiento', price: 1749.00, currency: 'MXN' },
            'rs-elite': { name: 'Dominación Total Redes', price: 3999.00, currency: 'MXN' }
        };

        let productData = ecommerceProducts[productId];
        if (!productData) {
            // Reconocimiento dinámico para cualquier combinación del Configurador TOP 10
            if (productId && productId.startsWith('cfg-')) {
                const isAgent = productId.endsWith('-agente') || productId.endsWith('-agent');
                const isPromo = productId.endsWith('-promo');
                const giroName = productId.replace('cfg-', '').replace('-bot', '').replace('-agente', '').replace('-agent', '').replace('-promo', '').toUpperCase();
                
                // Si termina en -promo, forzamos el precio de lanzamiento de $200.00 MXN
                productData = {
                    name: isPromo ? `Bot de ${giroName} - Promo Lanzamiento` : (isAgent ? `Agente de ${giroName} IA - Setup` : `Bot de ${giroName} - Setup`),
                    price: isPromo ? 200.00 : (isAgent ? 2999.00 : 1499.00),
                    currency: 'MXN'
                };
            } else if (req.body.price && req.body.currency) {
                // Sincronización resiliente con el catálogo de cliente para evitar errores 404
                productData = {
                    name: productId.toUpperCase().replace(/-/g, ' '),
                    price: parseFloat(req.body.price),
                    currency: req.body.currency.toUpperCase()
                };
            } else {
                const productDoc = await getDb().collection('products').doc(productId).get();
                if (!productDoc.exists) return res.status(404).send("Producto no reconocido.");
                productData = productDoc.data();
            }
        }

        // 3. Configuración de la Solución de Pago (Fuerza Tarjeta si es necesario)
        // CÁLCULO DE IVA DEL 16% GENERALIZADO PARA TODAS LAS VENTAS
        const basePrice = parseFloat(productData.price);
        const priceWithIva = (basePrice * 1.16).toFixed(2);

        const landingSelection = (fundingType === 'card') ? 'BILLING' : 'LOGIN';
        const solutionSelection = (fundingType === 'card') ? 'SOLE' : 'MARK';

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                description: `ROBOTIAX PROTOCOL: ${productData.name} (Incluye 16% IVA)`,
                amount: {
                    currency_code: productData.currency,
                    value: priceWithIva
                }
            }],
            application_context: {
                return_url: `${finalReturnUrl}?status=success`,
                cancel_url: `${finalReturnUrl}?status=cancel`,
                landing_page: landingSelection,
                user_action: (fundingType === 'card') ? 'CONTINUE' : 'PAY_NOW',
                shipping_preference: 'NO_SHIPPING',
                brand_name: 'ROBOTIAX PROTOCOL',
                solution: solutionSelection
            }
        });

        const order = await getPaypalClient().execute(request);
        const approveUrl = order.result.links.find(link => link.rel === 'approve').href;
        
        return res.status(200).json({ orderID: order.result.id, approveUrl: approveUrl });

    } catch (error) {
        console.error(">>> [PAYPAL ERROR]:", error.message);
        return res.status(500).json({ error: "Fallo en Pasarela", details: error.message });
    }
});

// 2. Captura el pago después de que el usuario aprueba en el frontend.
exports.capturePaypalOrder = onRequest({ cors: true }, async (req, res) => {
    const { orderID } = req.body;
    if (!orderID) {
        return res.status(400).json({ status: "error", message: "El ID de la orden es requerido." });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    try {
        const client = getPaypalClient();
        const capture = await client.execute(request);
        const captureStatus = capture.result.status;
        console.log("Estado de la captura:", captureStatus);

        if (captureStatus === 'COMPLETED') {
            console.log("¡PAGO COMPLETADO EXITOSAMENTE!");

            const accessToken = admin.firestore().collection('invoices').doc().id;
            const productId = req.body.productId;

            const orderRef = getDb().collection('pending_orders').doc();
            await orderRef.set({
                paypalOrderId: orderID,
                customerData: req.body.customerData || {},
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'paid_pending'
            });

            res.status(200).json({ 
                status: "success", 
                accessToken: orderRef.id,
                message: "Pago completado y registrado"
            });
        } else {
            res.status(400).json({ status: "failed", message: `El pago no se completó. Estado: ${captureStatus}` });
        }
    } catch (error) {
        console.error("ERROR CRÍTICO AL CAPTURAR ORDEN PAYPAL:", error);
        let detailedMessage = error.message || "Error interno al comunicarse con PayPal.";
        res.status(500).json({ status: "error", message: `Fallo en el servidor: ${detailedMessage}` });
    }
});

// ... al final de todo el archivo

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
        const folio = `ORD-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

        const isConfigurator = template.startsWith('cfg-');
        const isWebProduct = !isConfigurator && !template.startsWith('ia-') && !template.startsWith('sec-') && template !== 'nexus-drop' && template !== 'storefront-pro' && template !== 'omnicanal-elite' && !template.startsWith('rs-');
        let vertexInstructions = "";

        // Solo ejecutar Vertex AI para Agentes de Inteligencia Artificial (ia-) o de Ciberseguridad (sec-)
        const shouldRunVertex = template.startsWith('ia-') || template.startsWith('sec-');

        if (shouldRunVertex) {
            try {
                const promptMaquila = `
                ACTÚA COMO INGENIERO DE DESPLIEGUE SENIOR DE ROBOTIAX. 
                Genera un REPORTE TÉCNICO DE ACTIVACIÓN para: ${pData.name}. CLIENTE: ${details.negocio || 'No proporcionado'}.

                ESTE REPORTE DEBE SER EXHAUSTIVO Y SECCIONADO:
                1. 🧠 NÚCLEO DE INTELIGENCIA (SYSTEM PROMPT): Instrucciones maestras y personalidad de la unidad.
                2. ⚙️ PARÁMETROS TÉCNICOS: Temperatura, TopP y estilo de respuesta.
                3. 📋 DOCUMENTACIÓN BÁSICA REQUERIDA: Qué pedirle al cliente HOY mismo para arrancar.
                4. ⚡ PROTOCOLO DE IMPLEMENTACIÓN BÁSICA (< 5 MIN): Pasos exactos para que el Admin deje operativa la unidad en 5 minutos con la info básica.
                5. 💎 PROTOCOLO DE INSTALACIÓN AVANZADA ($50 USD): Ingeniería de prompts profunda y carga masiva de conocimiento.
                6. ⏳ CRONOGRAMA AVANZADO (24H): Lapsos de tiempo (Análisis, Ingesta, Calibración, Test de Estrés y Entrega) y qué se ejecuta en cada fase.
                No omitas nada. Prioriza la operatividad inmediata del Admin.`;

                const aiResult = await getVertexAI().getGenerativeModel({ model: modelAI }).generateContent(promptMaquila);
                const aiResponse = await aiResult.response;
                vertexInstructions = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "Revisar manual interno.";
            } catch (e) { 
                console.error("Error Vertex:", e);
                vertexInstructions = "Error en generación de reporte Vertex."; 
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

        // Generación dinámica de credenciales de acceso para Makumoto
        const convenioCode = `MAK-AURA-${Math.floor(1000 + Math.random() * 9000)}`;
        const tempPassword = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Generación de slug apto para subdominio (ej: "Ojos Terribles" -> "ojos-terribles")
    const negocioSlug = (details.negocio || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

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

      // -------------------------------------------------------------------------
    // APROVISIONAMIENTO AUTOMÁTICO DE INSTANCIA DE WHATSAPP (GATEWAY SAAS)
    // -------------------------------------------------------------------------
    if (isConfigurator) {
        try {
            console.log(`📡 [GATEWAY]: Solicitando creación automática de instancia de WhatsApp para: ${negocioSlug}...`);
            
            const gatewayUrl = 'https://bot.ikai.info/instance/create';
            const gatewayToken = 'RBX-GATEWAY-MASTER-SECRET-2025'; // Token maestro de seguridad de tu servidor IONOS
            
            // Petición asíncrona no bloqueante (no retrasa la respuesta de éxito al cliente)
            fetch(gatewayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': gatewayToken
                },
                body: JSON.stringify({
                    instanceName: negocioSlug,
                    token: tempPassword, // Usamos la clave temporal como token de control de la instancia del médico
                    qrcode: true
                })
            })
            .then(async (gatewayRes) => {
                if (gatewayRes.ok) {
                    console.log(`✅ [GATEWAY_SUCCESS]: Instancia de WhatsApp "${negocioSlug}" aprovisionada en el servidor.`);
                } else {
                    const errTxt = await gatewayRes.text();
                    console.warn(`⚠️ [GATEWAY_WARN]: El Gateway de WhatsApp rechazó la creación de la instancia: ${errTxt}`);
                }
            })
            .catch((err) => {
                console.error("❌ [GATEWAY_ERROR]: No se pudo conectar al servidor de WhatsApp en IONOS:", err.message);
            });

        } catch (gatewayError) {
            console.error("❌ [GATEWAY_ERROR_FATAL]: Fallo crítico en el bloque de aprovisionamiento de WhatsApp:", gatewayError.message);
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
                    resSync.on("end", () => {
                        if (resSync.statusCode === 200) {
                            console.log("✅ [SYNC_SUCCESS]: Licencia sincronizada en Makumoto Core.", responseData);
                        } else {
                            console.warn(`⚠️ [SYNC_WARN]: Makumoto Core rechazó la sincronización (${resSync.statusCode}): ${responseData}`);
                        }
                        resolve();
                    });
                });

                reqSync.on("error", (errSync) => {
                    console.error("❌ [SYNC_ERROR]: Fallo de conexión al sincronizar con Makumoto:", errSync.message);
                    resolve();
                });

                reqSync.write(syncPayload);
                reqSync.end();
            });

            // Forzar timeout de seguridad de 5 segundos para evitar cuelgues del hilo de ejecución
            await Promise.race([
                syncPromise,
                new Promise((resolve) => setTimeout(resolve, 5000))
            ]);

        } catch (syncError) {
            console.error("❌ [SYNC_ERROR_FATAL]: Fallo en secuencia de sincronización nativa:", syncError.message);
        }

        // Cálculos precisos desglosados de cobro fiscal (Base + IVA)
        const basePriceNum = parseFloat(pData.price);
        const ivaNum = parseFloat((basePriceNum * 0.16).toFixed(2));
        const totalNum = parseFloat((basePriceNum * 1.16).toFixed(2));

        // 5. EMAIL DE CONFIRMACIÓN DEL CLIENTE (RECEPTOR) - OPTIMIZADO PARA ENTREGABILIDAD
        const clientReceiptHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; color: #333;">
                <h2 style="color: #16a34a; text-align: center; text-transform: uppercase; margin-bottom: 30px;">¡TODO LISTO! TU PROYECTO ESTÁ EN PROCESO</h2>
                <p>Hola <strong>${details.negocio || 'Cliente Robotiax'}</strong>, hemos recibido tus datos de configuración correctamente.</p>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; font-size: 13px; line-height: 1.5; color: #333;">
                    <p style="margin: 4px 0;"><strong>FOLIO DE ACTIVACIÓN:</strong> ${folio}</p>
                    <p style="margin: 4px 0;"><strong>PRODUCTO CONTRATADO:</strong> ${pData.name}</p>
                    <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 12px 0;">
                    <p style="margin: 4px 0; display: flex; justify-content: space-between;"><span>PRECIO BASE:</span> <strong>$${basePriceNum.toFixed(2)} ${pData.currency}</strong></p>
                    <p style="margin: 4px 0; display: flex; justify-content: space-between;"><span>IVA TRASLADADO (16%):</span> <strong>$${ivaNum.toFixed(2)} ${pData.currency}</strong></p>
                    <p style="margin: 4px 0; display: flex; justify-content: space-between; font-size: 15px; color: #16a34a; font-weight: bold; padding-top: 5px; border-top: 1px dashed #e2e8f0;"><span>TOTAL CON IVA:</span> <strong>$${totalNum.toFixed(2)} ${pData.currency}</strong></p>
                </div>

                <!-- REQUERIMIENTO DE PERSONALIZACIÓN VISUAL (FOTOS) -->

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
                            <li>Foto física de tu consultorio o clínica.</li>
                            <li>Foto profesional de tu perfil.</li>
                            <li>Foto tuya interactuando en consulta con un paciente.</li>
                        </ul>
                        <p style="font-size: 11px; color: #64748b; font-style: italic; margin: 0; line-height: 1.3;">* Nota: En caso de no contar con alguna de estas fotos, omitiremos la imagen respectiva en tu sitio; si no mandas ninguna, simplemente no colocaremos imágenes, manteniendo un diseño limpio y minimalista.</p>
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

        const mailer = getTransporter();

        // CONTROL RESILIENTE E INDEPENDIENTE DE ENVÍO DE CORREOS
        try {
            await mailer.sendMail({
                from: '"ROBOTIAX CENTRAL" <geniosdeltalento@gmail.com>',
                to: 'geniosdeltalento@gmail.com',
                replyTo: clientEmail,
                subject: `⚡ ACTIVACIÓN: ${details.negocio || 'SIN NOMBRE'} (${folio})`,
                html: adminMailHtml
            });
            console.log("✅ Correo al administrador enviado correctamente.");
        } catch (errAdmin) {
            console.error("❌ ERROR AL ENVIAR CORREO AL ADMINISTRADOR:", errAdmin.message);
        }

        if (clientEmail) {
            try {
                await mailer.sendMail({
                    from: '"Robotiax Intelligence" <geniosdeltalento@gmail.com>',
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

exports.activateAgentWithVertex = onRequest({ cors: true, timeoutSeconds: 120, memory: "1GiB" }, async (req, res) => {
    const { productId, clientData } = req.body;
    try {
        const vAI = getVertexAI();
        const model = vAI.getGenerativeModel({ model: modelAI });
        const prompt = `Eres el Ingeniero de Activación de Robotiax. Producto: ${productId}. Datos: ${JSON.stringify(clientData)}. Genera plan técnico en JSON.`;
        const result = await model.generateContent(prompt);
        const response = result.response.candidates[0].content.parts[0].text;
        
        await getDb().collection('activated_agents').add({
            productId, 
            clientEmail: clientData.email, 
            config: response, 
            status: 'ready', 
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.status(200).json({ status: "Agent Trained" });
    } catch (error) {
        console.error("Error activateAgent:", error.message);
        res.status(500).send(error.message);
    }
});

