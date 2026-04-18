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

if (!admin.apps.length) {
    admin.initializeApp();
}

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

// Definimos los parámetros de PayPal
const paypalClientId = defineString('PAYPAL_CLIENT_ID');
const paypalSecret = defineString('PAYPAL_SECRET');

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
        const { productId, fundingType, returnUrl } = req.body;

        if (!productId) return res.status(400).send("Falta ID de producto.");

        // 1. Determinación de URL de Retorno (Local vs Producción)
        const isLocal = req.headers.host && req.headers.host.includes('localhost');
        const finalReturnUrl = returnUrl || (isLocal ? 'http://localhost:5000/desarrollo-web.html' : `${BASE_URL}/desarrollo-web.html`);

        // 2. Obtención de datos del producto
        const productDoc = await getDb().collection('products').doc(productId).get();
        if (!productDoc.exists) return res.status(404).send("Producto no reconocido.");
        const productData = productDoc.data();

        // 3. Configuración de la Solución de Pago (Fuerza Tarjeta si es necesario)
        const landingSelection = (fundingType === 'card') ? 'BILLING' : 'LOGIN';
        const solutionSelection = (fundingType === 'card') ? 'SOLE' : 'MARK';

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                description: `ROBOTIAX PROTOCOL: ${productData.name}`,
                amount: {
                    currency_code: productData.currency,
                    value: productData.price.toString()
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
    const { template, details } = req.body;
    const clientEmail = details.email || details.correo; 

    try {
        const productSnap = await getDb().collection('products').doc(template).get();
        const pData = productSnap.exists ? productSnap.data() : { name: template, price: "99", currency: "MXN" };

        const now = new Date();
        const folio = `ORD-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

        const isWebProduct = !template.startsWith('ia-') && !template.startsWith('sec-');
        let vertexInstructions = "";

        // SOLO ACTIVAR IA SI NO ES WEB
        let customerRequirements = "";

        if (!isWebProduct) {
            try {
                const promptMaquila = `
                ACTÚA COMO INGENIERO DE DESPLIEGUE SENIOR DE ROBOTIAX. 
                Genera un REPORTE TÉCNICO DE ACTIVACIÓN para: ${pData.name}. CLIENTE: ${details.negocio}.

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
                vertexInstructions = "Error en generación técnica."; 
            }
        }

        // REGISTRO EN BASE DE DATOS
        const orderRef = await getDb().collection('orders_to_fulfill').add({
            orderNumber: folio,
            productName: pData.name,
            isWeb: isWebProduct,
            ...details,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // EMAIL DIFERENCIADO SEGÚN PRODUCTO (CLIENTE)
        const clientReceiptHtml = isWebProduct ? `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; color: #333;">
                <h2 style="color: #2ecc71; text-align: center;">¡TODO LISTO! TU PROYECTO ESTÁ EN PROCESO</h2>
                <p>Hola <strong>${details.negocio}</strong>, hemos recibido tus datos correctamente.</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                    <p><strong>FOLIO:</strong> ${folio}</p>
                    <p><strong>PRODUCTO:</strong> ${pData.name}</p>
                    <p><strong>PAGO:</strong> $${pData.price} ${pData.currency}</p>
                </div>
                <p><strong>¿Qué sigue ahora?</strong> Su proyecto ha ingresado a nuestra <strong>fase de implementación técnica de precisión</strong>.</p>
                <p style="background: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6;">
                    Recibirá su acceso y confirmación en su correo en un plazo no mayor a <strong>24 horas</strong>.
                </p>
                <p style="font-size: 13px; color: #555;">Hosting Premium y Dominio .info incluidos gratis por 30 días.</p>

                <div style="margin-top: 25px; padding: 15px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                    <strong>POLÍTICA DE FACTURACIÓN:</strong> Su factura le será enviada automáticamente los días 2 o 3 del mes inmediato posterior a su compra.
                </div>
                <p style="font-size: 11px; color: #999; margin-top: 30px;">Robotiax Engine - Despliegue Automatizado</p>
            </div>
        ` : `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; color: #333;">
                <h2 style="color: #ff3333; text-align: center;">🚀 PROTOCOLO DE ACTIVACIÓN INICIADO</h2>
                <p>Hola <strong>${details.negocio}</strong>, hemos recibido tus parámetros de configuración.</p>
                <div style="background: #fdf2f2; padding: 20px; border-radius: 8px; border: 1px solid #fee2e2; margin: 20px 0;">
                    <p><strong>FOLIO DE ACTIVACIÓN:</strong> ${folio}</p>
                    <p><strong>AGENTE IA:</strong> ${pData.name}</p>
                    <p><strong>INVERSIÓN:</strong> $${pData.price} ${pData.currency}</p>
                </div>
                
                <div style="background: #0f172a; color: #f8fafc; padding: 25px; border-radius: 8px; margin: 25px 0; border: 1px solid #334155;">
                    <h3 style="color: #ff3333; margin-top: 0; font-family: 'Orbitron', sans-serif;">🛡️ ESTATUS DE ACTIVACIÓN: SELECCIÓN DE PROTOCOLO</h3>
                    <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">Para proceder con la liberación de su unidad, es imperativo que responda a este correo seleccionando una de las siguientes tres vías de implementación:</p>
                    
                    <div style="margin-top: 20px; border-bottom: 1px solid #334155; padding-bottom: 15px;">
                        <p><strong>1. SOPORTE DE CORTESÍA: CONFIGURACIÓN BÁSICA (SIN COSTO)</strong></p>
                        <p style="font-size: 13px; color: #94a3b8;">Como beneficio de bienvenida, nuestra ingeniería diseñará su <em>System Instruction</em> inicial. Le solicitaremos datos básicos para configurar la lógica primaria de su agente.</p>
                    </div>

                    <div style="margin-top: 15px; border-bottom: 1px solid #334155; padding-bottom: 15px;">
                        <p><strong>2. AUTOGESTIÓN TÉCNICA (PRIVACIDAD TOTAL)</strong></p>
                        <p style="font-size: 13px; color: #94a3b8;">Entrega de unidad en estado base (limpia). Ideal para empresas con personal de sistemas que prefieren manejar su propia base de conocimientos por seguridad.</p>
                    </div>

                    <div style="margin-top: 15px;">
                        <p><strong style="color: #38bdf8;">3. IMPLEMENTACIÓN AVANZADA "PLUG & PLAY" (+50 USD)</strong></p>
                        <p style="font-size: 13px; color: #94a3b8;">Protocolo integral: nosotros realizamos la ingeniería de prompts, carga de conocimientos y calibración de respuesta. Reciba su Agente 100% operativo y listo para producción inmediata.</p>
                    </div>

                    <p style="margin-top: 20px; font-size: 13px; color: #ff3333; font-weight: bold;">⚠️ Una vez responda con su elección, recibirá su Link de Acceso y Manual Operativo en un plazo máximo de 24 horas.</p>
                </div>

                <div style="margin-top: 25px; padding: 15px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                    <strong>POLÍTICA DE FACTURACIÓN:</strong> Su factura le será enviada automáticamente los días 2 o 3 del mes inmediato posterior a su compra.
                </div>
                <p style="font-size: 11px; color: #999; margin-top: 30px;">Robotiax Engine - Despliegue Automatizado</p>
            </div>
        `;

        // 4. EMAIL PARA TI (ADMIN) - PRIORIDAD TOTAL A LA INSTRUCCIÓN IA
        const adminMailHtml = isWebProduct ? `
            <div style="font-family: sans-serif; background: #0a0a0a; color: white; padding: 30px; border: 2px solid #2ecc71;">
                <h2 style="color: #2ecc71;">🌐 NUEVA IMPLEMENTACIÓN WEB: ${details.negocio}</h2>
                <div style="background: #111; padding: 20px; border: 1px solid #222;">
                    <p><strong>Folio:</strong> ${folio} | <strong>ID:</strong> ${template}</p>
                    <hr style="border:0; border-top:1px solid #333;">
                    <p><strong>WhatsApp:</strong> ${details.telefono}</p>
                    <p><strong>Email:</strong> ${details.email}</p>
                    <p><strong>Eslogan:</strong> ${details.tagline}</p>
                    <p><strong>Headline:</strong> ${details.headline}</p>
                    <p><strong>Servicios:</strong> ${details.servicios}</p>
                    <p><strong>Dirección:</strong> ${details.direccion}</p>
                    <p><strong>Horarios:</strong> ${details.horarios}</p>
                    <p><strong>Costo/Fee:</strong> ${details.fee}</p>
                </div>
            </div>` : `
            <div style="font-family: 'Courier New', monospace; background: #000; color: #00f2ff; padding: 40px; border: 4px solid #ff003c;">
                <h1 style="color: #ff003c; text-align: center; border-bottom: 2px solid #ff003c; padding-bottom: 10px;">🚨 PROTOCOLO DE ACTIVACIÓN ESTRUCTURAL 🚨</h1>
                <div style="background: #000; padding: 30px; border: 2px dashed #ff003c; margin: 20px 0;">
                    <h2 style="color: #ff003c; font-family: 'Courier New', monospace; text-transform: uppercase;">📡 REPORTE TÉCNICO INTEGRAL DE INTELIGENCIA:</h2>
                    <div style="color: #ffffff; font-size: 15px; line-height: 1.7; white-space: pre-wrap; font-family: 'Courier New', monospace;">${vertexInstructions}</div>
                </div>          

                <div style="background: #0a0a0a; padding: 20px; border: 1px solid #333;">
                    <h3 style="color: #666; font-size: 12px; margin-top: 0;">DATOS DE IDENTIFICACIÓN DEL CLIENTE:</h3>
                    <p style="font-size: 13px; color: #999; margin: 5px 0;"><strong>CLIENTE:</strong> ${details.negocio}</p>
                    <p style="font-size: 13px; color: #999; margin: 5px 0;"><strong>PRODUCTO:</strong> ${pData.name}</p>
                    <p style="font-size: 13px; color: #999; margin: 5px 0;"><strong>FOLIO:</strong> ${folio}</p>
                    <p style="font-size: 13px; color: #999; margin: 5px 0;"><strong>CONTACTO:</strong> ${details.telefono} | ${details.email}</p>
                </div>
            </div>
        `;

        const mailer = getTransporter();

        try {
            await mailer.sendMail({
                from: '"ROBOTIAX CENTRAL" <geniosdeltalento@gmail.com>',
                to: 'geniosdeltalento@gmail.com',
                replyTo: clientEmail,
                subject: `⚡ ACTIVACIÓN: ${details.negocio} (${folio})`,
                html: adminMailHtml
            });

            await mailer.sendMail({
                from: '"Robotiax Intelligence" <geniosdeltalento@gmail.com>',
                to: clientEmail,
                subject: `✅ Orden Confirmada: ${folio}`,
                html: clientReceiptHtml
            });
        } catch (err) {
            console.error("Error envío correos:", err.message);
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