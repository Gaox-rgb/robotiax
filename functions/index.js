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

// Configuración ÚNICA del transporte de correo
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'geniosdeltalento@gmail.com',
        pass: 'bcnmvqwyvfkhxpxd' 
    }
});

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
        const amount = req.body.amount || "200.00"; 
        const currency = req.body.currency || "USD";
        const productId = req.body.productId || "default-service";

        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                description: `Activación de Super-App: ${productId}`, // Mejor trazabilidad
                amount: {
                    currency_code: 'MXN',
                    value: '99.00'
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
  
exports.submitFinalOrder = onRequest({ cors: true }, async (req, res) => {
    const { template, details } = req.body;
    const clientEmail = details.email;

    try {
        // 1. GUARDAR EN FIRESTORE (Respaldo técnico)
        const orderRef = await db.collection('orders_to_fulfill').add({
            template,
            ...details,
            processed: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. CONFIGURAR EMAIL PARA TI (ADMIN)
        const adminMailOptions = {
            from: 'MAKUMOTO SYSTEM <geniosdeltalento@gmail.com>',
            to: 'geniosdeltalento@gmail.com',
            subject: `🚨 NUEVA VENTA: ${template} - ${details.negocio}`,
            html: `
                <div style="font-family:sans-serif; border:2px solid #00f2ff; padding:20px; background:#fafafa;">
                    <h2 style="color: #0f172a;">Nueva Orden de Despliegue</h2>
                    <p><strong>ID Firestore:</strong> ${orderRef.id}</p>
                    <p><strong>Plantilla Elegida:</strong> ${template}</p>
                    <hr>
                    <p><strong>Negocio:</strong> ${details.negocio}</p>
                    <p><strong>Eslogan:</strong> ${details.eslogan}</p>
                    <p><strong>Encabezado (Headline):</strong> ${details.headline}</p>
                    <p><strong>Servicios:</strong> ${details.servicios}</p>
                    <p><strong>Texto Botón (CTA):</strong> ${details.cta}</p>
                    <p><strong>Costo Consulta:</strong> ${details.costo}</p>
                    <hr>
                    <p><strong>WhatsApp Contacto:</strong> ${details.telefono}</p>
                    <p><strong>Email Cliente:</strong> ${details.email}</p>
                    <p><strong>Dirección:</strong> ${details.direccion}</p>
                    <p><strong>Horarios:</strong> ${details.horarios}</p>
                </div>
            `
        };

        // 3. CONFIGURAR EMAIL PARA EL CLIENTE (RECIBO)
        const clientMailOptions = {
            from: 'Robotiax & Makumoto <geniosdeltalento@gmail.com>',
            to: clientEmail,
            subject: `🚀 ¡Gracias! Tu sitio web ${details.negocio} está en proceso`,
            html: `
                <div style="font-family: Arial; padding: 25px; color: #333; line-height: 1.6;">
                    <h2 style="color: #2ecc71;">¡Pago y Datos Confirmados!</h2>
                    <p>Hola, hemos recibido correctamente la información para activar tu sitio web profesional.</p>
                    
                    <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; border-left: 5px solid #2ecc71; margin: 20px 0;">
                        <strong>¿Qué sigue ahora?</strong><br>
                        Nuestros ingenieros están configurando tu <strong>Hosting Premium y Dominio .info</strong>.<br>
                        Este beneficio es <strong>totalmente GRATIS POR 30 DÍAS</strong>.
                    </div>

                    <p><strong>Enviaremos</strong> el link de acceso final tanto a este correo como a tu WhatsApp en un plazo menor a 24 horas.</p>
                    
                    <p style="font-size: 0.9rem; color: #64748b;">Gracias por elegir la tecnología de Robotiax.</p>
                </div>
            `
        };

        // 4. DISPARAR ENVÍOS SIMULTÁNEOS (Aquí se usa Nodemailer con tu Gmail)
        await Promise.all([
            transporter.sendMail(adminMailOptions),
            transporter.sendMail(clientMailOptions)
        ]);

        res.status(200).json({ status: 'ok', message: 'Correos enviados y orden registrada' });

    } catch (error) {
        console.error("ERROR CRÍTICO EN SUBMIT_ORDER:", error);
        res.status(500).send({ status: 'error', message: error.message });
    }
});