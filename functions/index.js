const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require("fs").promises;
const path = require("path");
const handlebars = require("handlebars");
const {defineString} = require('firebase-functions/params');
const paypal = require("@paypal/checkout-server-sdk");
const cors = require("cors")({origin: true});
const nodemailer = require('nodemailer');

// BLINDAJE: Solo inicializa si no hay apps activas
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const { VertexAI } = require('@google-cloud/vertexai');

// Lazy Loading: Inicializamos solo cuando se necesita para evitar Timeouts de despliegue
let vertexAIInstance;
const getVertexAI = () => {
    if (!vertexAIInstance) {
        // Usamos process.env.GCLOUD_PROJECT para obtener el ID real automáticamente
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
const environment = () => {
    // Usamos .value() para obtener el valor del parámetro
    const clientId = paypalClientId.value();
    const clientSecret = paypalSecret.value();
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
};
const client = () => new paypal.core.PayPalHttpClient(environment());

// Forzamos el nombre del bucket de tu proyecto Robotiax
const bucket = admin.storage().bucket('robotiax.appspot.com');

// Importación de la v2 para HTTPS (Solo una vez)
const { onRequest } = require("firebase-functions/v2/https");

// Función auxiliar para carga segura de assets (Evita el Crash Global)
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
    const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        
        // Aseguramos la captura de datos del body para evitar errores de conexión
        const productId = req.body.productId;

        const returnPage = req.body.returnPage || 'index.html';

        if (!productId) {
            return res.status(400).send("Falta ID de producto.");
        }

        // VALIDACIÓN REAL CONTRA FIRESTORE
        const productDoc = await db.collection('products').doc(productId).get();
        
        if (!productDoc.exists) {
            return res.status(404).send("Producto no reconocido en el Arsenal.");
        }

        const productData = productDoc.data();

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
                return_url: `${BASE_URL}/${returnPage}?status=success`,
                cancel_url: `${BASE_URL}/${returnPage}?status=cancel`,
                landing_page: 'BILLING', // <--- ESTO OBLIGA A MOSTRAR TARJETAS PRIMERO
                user_action: 'PAY_NOW',
                shipping_preference: 'NO_SHIPPING'
            }
        });

        try {
            const order = await client().execute(request);
            console.log("Orden de PayPal creada:", order.result.id);
            const approveUrl = order.result.links.find(link => link.rel === 'approve').href;
            res.status(200).json({ orderID: order.result.id, approveUrl: approveUrl });
        } catch (error) {
            console.error("Error al crear la orden de PayPal:", error);
            res.status(500).send("Error al crear la orden de pago.");
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
        const capture = await client().execute(request);
        const captureStatus = capture.result.status;
        console.log("Estado de la captura:", captureStatus);

        if (captureStatus === 'COMPLETED') {
            console.log("¡PAGO COMPLETADO EXITOSAMENTE!");

            const accessToken = admin.firestore().collection('invoices').doc().id;
            const productId = req.body.productId;

            const orderRef = db.collection('pending_orders').doc();
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
    const file = bucket.file(fileName);

    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: contentType,
    };

    try {
        if (!bucket.name) throw new Error("Bucket no inicializado correctamente.");
        
        const [uploadUrl] = await file.getSignedUrl(options);
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        
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
            generationConfig: { maxOutputTokens: 1200, temperature: 0.3, topP: 0.8 }
        });

        const contents = chatHistory.length > 0 
            ? [...chatHistory, { role: 'user', parts: [{ text: userQuery }] }]
            : [{ role: 'user', parts: [{ text: userQuery }] }];

        const result = await model.generateContent({
            contents: contents,
            systemInstruction: { 
                parts: [{ text: `IDENTIDAD: Sales Architect de Robotiax.
                REGLAS: PROHIBIDO SALUDAR. Inicia con la solución. Precios WEB siempre 99 MXN. Precios IA/SECURITY en USD.
                CATÁLOGO WEB (99 MXN): Bienes Raíces 01, Cirujano Plástico 01, Clínica Médica 01, Consultoría 01/02/Elite 03, Contabilidad 01, E-Learning 01, Academy 02, Corporativo 01, Fitness 01, Power Gym 02, Industrial 01, Influencer 01, Creator 02, Legal Services 01, Médico Especialista 01, Cyber Security 01, Wellness Spa 01, Tech Global 01, Sales Landing 01, Yoga Studio 01.
                CATÁLOGO IA (USD): Contable(49), Legal(79), Proyección(89), Nómina(59), Costos(49), Gastos Voz(20), Motivador(20), Rentabilidad(69), Caja Chica(39), Inversión(99), Chronos(20), Rendimiento(59), Manuales(20), Calidad(79), Suministros(49), Correcciones(69), Post-Servicio(39), Rutas(89), Mantenimiento(59), Crisis(129), Sniper(20), Avatar(149), Identidad(69), Reseñas(20), Guerrilla(59), Expansión(199), Retención(89), Sentimiento(49), Ofertas(39), Influencia(129).
                CATÁLOGO SECURITY (USD): Fantasma(20), Herencia(49), Ing. Social(39), Phishing(20), Metadatos(20), Deepfake(149), Bóveda ID(20), Zero-Knowledge(59), IoT(79), Extorsión(99), POS(129), Lealtad(89), Auditor Red(49), Facturación(79), Backup(149), Privacidad(39), Web-Scan(69), Biométrico(199), Interna(59), Ransomware(299), SOC IA(499), Amenaza(249), Honey-Pot(179), Mando(399), APIs(159), Simulador(299), Gobernanza(189), Cloud(349), IAM(229), Resiliencia(149).
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
        const productSnap = await db.collection('products').doc(template).get();
        const pData = productSnap.exists ? productSnap.data() : { name: template, price: "99", currency: "MXN" };

        const now = new Date();
        const folio = `ORD-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

        const isWebProduct = !template.startsWith('ia-') && !template.startsWith('sec-');
        let vertexInstructions = "";

        // SOLO ACTIVAR IA SI NO ES WEB
        if (!isWebProduct) {
            try {
                const generativeModel = getVertexAI().getGenerativeModel({ model: modelAI });
                const aiResult = await generativeModel.generateContent(`Genera instrucciones de maquila para: ${pData.name}`);
                const aiResponse = await aiResult.response;
                vertexInstructions = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } catch (e) { vertexInstructions = "Error IA."; }
        }

        // REGISTRO EN BASE DE DATOS
        const orderRef = await db.collection('orders_to_fulfill').add({
            orderNumber: folio,
            productName: pData.name,
            isWeb: isWebProduct,
            ...details,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // EMAIL PARA EL CLIENTE (LIMPIO DE REQUERIMIENTOS SI ES WEB)
        const clientReceiptHtml = `
            <div style="font-family: Arial; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; color: #333;">
                <h2 style="color: #2ecc71; text-align: center;">¡TODO LISTO! TU WEB ESTÁ EN PROCESO</h2>
                <p>Hola <strong>${details.negocio}</strong>, hemos recibido tus datos correctamente.</p>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                    <p><strong>FOLIO:</strong> ${folio}</p>
                    <p><strong>PRODUCTO:</strong> ${pData.name}</p>
                    <p><strong>PAGO:</strong> $${pData.price} ${pData.currency}</p>
                </div>

                <p><strong>¿Qué sigue ahora?</strong> Nuestros ingenieros han iniciado la configuración de tu <strong>Hosting Premium y Dominio .info</strong> (Gratis por 30 días).</p>
                <p style="background: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6;">
                    No es necesario que hagas nada más. En un plazo de <strong>24 horas</strong> recibirás el link de tu página web ya activa.
                </p>
                <p style="font-size: 11px; color: #999; margin-top: 30px;">Robotiax Engine - Despliegue Automatizado</p>
            </div>
        `;

        // EMAIL PARA TI (CON TODOS LOS DATOS DEL FORMULARIO)
        const adminMailHtml = `
            <div style="font-family: sans-serif; background: #0a0a0a; color: white; padding: 30px; border: 3px solid #00f2ff;">
                <h2 style="color: #00f2ff;">🚨 NUEVA MAQUILA WEB: ${details.negocio}</h2>
                <div style="background: #111; padding: 20px; border: 1px solid #222; line-height: 1.8;">
                    <p><strong>Folio:</strong> ${folio}</p>
                    <p><strong>Plantilla:</strong> ${template}</p>
                    <hr>
                    <p><strong>Eslogan:</strong> ${details.tagline || 'N/A'}</p>
                    <p><strong>Headline:</strong> ${details.headline || 'N/A'}</p>
                    <p><strong>Servicios:</strong> ${details.servicios || 'N/A'}</p>
                    <p><strong>WhatsApp:</strong> ${details.telefono}</p>
                    <p><strong>Email:</strong> ${details.email}</p>
                    <p><strong>Dirección:</strong> ${details.direccion || 'N/A'}</p>
                    <p><strong>Horarios:</strong> ${details.horarios || 'N/A'}</p>
                    <p><strong>Costo Consulta:</strong> ${details.fee || 'N/A'}</p>
                </div>
                <p style="font-size: 10px; color: #444; margin-top:10px;">ID Firestore: ${orderRef.id}</p>
            </div>
        `;

        const mailer = getTransporter();

        // 1. Envío al Administrador (Tú)
        try {
            await mailer.sendMail({
                from: '"ROBOTIAX CENTRAL" <geniosdeltalento@gmail.com>',
                to: 'geniosdeltalento@gmail.com',
                replyTo: clientEmail,
                subject: `⚡ MAQUILA: ${details.negocio} (${folio})`,
                html: adminMailHtml
            });
            console.log("📧 Correo Admin enviado con éxito.");
        } catch (err) {
            console.error("❌ ERROR CORREO ADMIN:", err.message);
        }

        // 2. Envío al Cliente
        try {
            await mailer.sendMail({
                from: '"Robotiax Intelligence" <geniosdeltalento@gmail.com>',
                to: clientEmail,
                subject: `✅ Orden Confirmada: ${folio}`,
                html: clientReceiptHtml
            });
            console.log("📧 Correo Cliente enviado con éxito a:", clientEmail);
        } catch (err) {
            console.error("❌ ERROR CORREO CLIENTE:", err.message);
        }

        return res.status(200).json({ status: 'ok', folio: folio });

    } catch (error) {
        console.error("ERROR CRÍTICO EN PROCESO DE PEDIDO:", error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
});

// Bloque de activación Vertex (Última función del archivo)
exports.activateAgentWithVertex = onRequest({ cors: true, timeoutSeconds: 120, memory: "1GiB" }, async (req, res) => {
    const { productId, clientData } = req.body;
    
    try {
        const generativeModel = getVertexAI().getGenerativeModel({
            model: modelAI,
            generationConfig: { maxOutputTokens: 8192, temperature: 0.2 }
        });

        const prompt = `Eres el Ingeniero de Activación de Robotiax. Producto: ${productId}. Datos: ${JSON.stringify(clientData)}. Genera plan técnico en JSON.`;

        const result = await generativeModel.generateContent(prompt);
        const response = result.response.candidates[0].content.parts[0].text;
        
        await db.collection('activated_agents').add({
            productId,
            clientEmail: clientData.email,
            config: response,
            status: 'ready',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ status: "Agent Trained" });
    } catch (error) {
        console.error("Vertex Error:", error);
        res.status(500).send(error.message);
    }
});

