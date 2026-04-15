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
            }]
        });

        try {
            const order = await client().execute(request);
            console.log("Orden de PayPal creada:", order.result.id);
            res.status(200).json({ orderID: order.result.id });
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
  
exports.submitFinalOrder = onRequest({ 
    cors: true, 
    timeoutSeconds: 120, 
    memory: "1GiB"     
}, async (req, res) => {
    const { template, details } = req.body;
    const clientEmail = details.email || details.correo; // Soporte para ambos nombres de campo

    try {
        const productSnap = await db.collection('products').doc(template).get();
        const pData = productSnap.exists ? productSnap.data() : { name: template, price: "20", currency: "USD" };

        const now = new Date();
        const folio = `ORD-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

        let vertexAnalysis = "";
        
        try {
            const generativeModel = getVertexAI().getGenerativeModel({ 
                model: modelAI,
                generationConfig: { temperature: 0.2, maxOutputTokens: 2500 }
            }); 

            const promptMaestro = `Eres el Arquitecto Senior de Robotiax. 
            MÓDULO: ${pData.name}. CLIENTE: ${details.negocio}.
            INSTRUCCIÓN: Sé técnico y directo. No saludes.
            ESTRUCTURA: 1. System Prompt. 2. Herramientas Vertex. 3. Plan de Maquila.`;

            const aiResult = await generativeModel.generateContent(promptMaestro);
            const aiResponse = await aiResult.response;
            vertexAnalysis = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "Revisión manual requerida.";

        } catch (aiErr) {
            console.error("ERROR VERTEX:", aiErr.message);
            vertexAnalysis = `MAQUILA MANUAL: Error en Vertex AI.`;
        }

        // LÓGICA DE REQUERIMIENTOS ROBOTIAX v2.0
        const reqLibrary = {
            'BIZ': "• Lista de Servicios y Precios detallados\n• Horarios de atención al público\n• Logo del negocio o marca (adjuntar a este correo)\n• Resumen breve de la visión del negocio",
            'MKT': "• Enlaces a Redes Sociales activas\n• Enlace a perfil de Google Maps / Reseñas\n• Descripción de tu público objetivo principal",
            'SEC_P': "• PROTECCIÓN DE DATOS ACTIVA: No solicitamos información técnica ni sensible por este medio.\n• Instrucciones de Activación: Junto con tu enlace de acceso, recibirás un instructivo privado para configurar tu protocolo de forma autónoma y segura.",
            'SEC_B': "• PROTOCOLO EMPRESARIAL ACTIVADO.\n• No se requiere envío de datos sensibles por correo electrónico.\n• Recibirás un Manual de Configuración Cifrado junto con tu acceso para la implementación en tu servidor o red local."
        };

        // BLINDAJE ABSOLUTO: Si el ID empieza con 'sec-', forzamos la respuesta de privacidad.
        let requirements = "";
        if (template.startsWith('sec-')) {
            requirements = reqLibrary['SEC_P'];
        } else {
            requirements = reqLibrary[pData.reqId] || reqLibrary['BIZ'];
        }

        const orderRef = await db.collection('orders_to_fulfill').add({
            orderNumber: folio,
            productName: pData.name,
            pricePaid: pData.price,
            currency: pData.currency,
            ...details,
            ai_instructions: vertexAnalysis,
            processed: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        const clientReceiptHtml = `
            <div style="font-family: Arial; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 40px; color: #333; line-height: 1.6;">
                <h2 style="color: #ff3333; text-align: center;">ORDEN DE ACTIVACIÓN CONFIRMADA</h2>
                <p>Hola <strong>${details.negocio}</strong>, el pago por tu agente inteligente ha sido procesado con éxito.</p>
                
                <div style="background: #f4f4f4; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #ddd;">
                    <p style="margin: 5px 0;"><strong>FOLIO DE PEDIDO:</strong> ${folio}</p>
                    <p style="margin: 5px 0;"><strong>PRODUCTO:</strong> ${pData.name}</p>
                    <p style="margin: 5px 0;"><strong>TOTAL PAGADO:</strong> $${pData.price} ${pData.currency}</p>
                    <p style="margin: 5px 0; color: #ff3333; font-weight:bold;">ESTATUS: ESPERANDO TU INFORMACIÓN</p>
                </div>

                <h3 style="color: #ff3333; border-bottom: 2px solid #ff3333; padding-bottom: 5px;">⚠️ ACCIÓN REQUERIDA PARA LA ENTREGA:</h3>
                <p>Para activar tu servicio en menos de 24 horas, es <strong>INDISPENSABLE</strong> que respondas a este correo adjuntando o escribiendo la siguiente información:</p>
                
                <div style="background: #fffafa; border: 1px dashed #ff3333; padding: 20px; margin: 20px 0; font-family: 'Courier New', monospace; font-size: 15px; color: #1a1a1a; white-space: pre-wrap; font-weight: bold;">${requirements}</div>

                <p style="font-size: 14px; color: #333;"><em>Nota: El plazo de activación de 24 horas inicia en el momento que recibamos tu respuesta con estos datos técnicos.</em></p>
                
                <p style="font-size: 13px; color: #666; margin-top: 20px;">
                    Nuestro equipo de ingeniería iniciará la <strong>configuración técnica</strong> de tu protocolo inteligente en cuanto los datos sean validados.
                </p>
                <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; font-size: 11px; color: #999; text-align: center;">
                    <p>Promoción: Los primeros 30 días de hosting y dominio son cortesía de Robotiax.</p>
                    <p>Facturación: Tu CFDI será enviado a este correo entre los días 2 y 3 del mes entrante.</p>
                </div>
            </div>
        `;

        const adminMailHtml = `
            <div style="font-family: sans-serif; background: #0a0a0a; color: white; padding: 30px; border: 3px solid #ff3333;">
                <h2 style="color: #ff3333;">🚨 NUEVA ORDEN: ${folio}</h2>
                <p><strong>CLIENTE:</strong> ${details.negocio}</p>
                <p><strong>WHATSAPP:</strong> ${details.telefono}</p>
                <hr style="border: 0; border-top: 1px solid #333;">
                <h3 style="color: #00eaff;">INSTRUCCIONES DE MAQUILA (IA):</h3>
                <div style="background: #111; padding: 15px; border: 1px solid #222; color: #ccc; font-family: monospace;">
                    ${vertexAnalysis}
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">ID Firestore: ${orderRef.id}</p>
            </div>
        `;

        await Promise.all([
            getTransporter().sendMail({
                from: '"Robotiax Intelligence" <geniosdeltalento@gmail.com>',
                to: clientEmail,
                subject: `✅ Confirmación de Pedido: ${folio}`,
                html: clientReceiptHtml
            }),
            getTransporter().sendMail({
                from: '"CENTRAL ROBOTIAX" <geniosdeltalento@gmail.com>',
                to: 'geniosdeltalento@gmail.com',
                replyTo: clientEmail,
                subject: `⚡ NUEVA MAQUILA: ${details.negocio} (${folio})`,
                html: adminMailHtml
            })
        ]);

        return res.status(200).json({ status: 'ok', folio: folio });

    } catch (error) {
        console.error("ERROR EN PROCESO DE PEDIDO:", error);
        return res.status(200).json({ status: 'error', message: 'Orden recibida con retraso en IA. Procesando manualmente.' });
    }
});

// Bloque de activación Vertex
exports.activateAgentWithVertex = onRequest({ cors: true }, async (req, res) => {
    const { productId, clientData } = req.body;
    
    // Usamos los helpers globales para consistencia y evitar fallos de conexión
    const generativeModel = getVertexAI().getGenerativeModel({
        model: modelAI,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
    });

    const prompt = `
        Eres el Ingeniero de Activación de Robotiax. 
        Se ha comprado el producto: ${productId}.
        Datos del cliente: ${JSON.stringify(clientData)}.
        
        Misión: Genera un plan de configuración técnica y un mensaje de bienvenida 
        personalizado que mencione los beneficios específicos para su negocio.
        Responde en formato JSON para ser procesado por el sistema de entrega.
    `;

    try {
        const result = await generativeModel.generateContent(prompt);
        const response = result.response.candidates[0].content.parts[0].text;
        
        // Guardar la "mente" del agente personalizada en Firestore
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

