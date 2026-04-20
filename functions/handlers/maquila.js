const { db, bucket, getTransporter, loadAsset, getVertexAI, modelAI } = require("./util");
const admin = require("firebase-admin");
const handlebars = require("handlebars");
const fs = require("fs").promises;
const path = require("path");

exports.generateDemo = async (req, res) => {
    try {
        const templateName = req.query.template || 'medico-01-template.html';
        const templatePath = path.join(__dirname, '..', 'templates', templateName);
        const baseName = templateName.replace('-template.html', '');
        const dataPath = path.join(__dirname, '..', 'demo-data', `demo_${baseName}.json`);

        const [templateContent, dataContent, tailwindCss, fontAwesomeCss] = await Promise.all([
            fs.readFile(templatePath, 'utf8'),
            fs.readFile(dataPath, 'utf8').catch(() => '{}'),
            loadAsset('assets/css/tailwind.css'),
            loadAsset('assets/css/fontawesome.css')
        ]);

        const demoData = JSON.parse(dataContent);
        demoData.branding = { ...demoData.branding, business_name: req.query.name || demoData.branding?.business_name, tagline: req.query.tagline || demoData.branding?.tagline };
        demoData.hero_section = { ...demoData.hero_section, headline: req.query.headline || demoData.hero_section?.headline, primary_cta_text: req.query.cta || demoData.hero_section?.primary_cta_text };
        if (req.query.services) demoData.services_section = { ...demoData.services_section, description: req.query.services };
        demoData.contact_section = { ...demoData.contact_section, phone: req.query.phone || demoData.contact_section?.phone, email: req.query.email || demoData.contact_section?.email, address: req.query.address || demoData.contact_section?.address, business_hours: req.query.hours || demoData.contact_section?.business_hours, consultation_fee: req.query.fee || demoData.contact_section?.consultation_fee };
        if (req.query.imageUrl) demoData.hero_section.image = { ...demoData.hero_section.image, value: req.query.imageUrl };

        demoData.styles = { tailwind: tailwindCss, fontawesome: fontAwesomeCss };
        const template = handlebars.compile(templateContent);
        const finalHtml = template(demoData).replace('</head>', `<style>footer, footer p, footer a, footer div {color: #e2e8f0 !important;} footer a:hover {color: #ffffff !important;}</style></head>`);
        res.set('Content-Type', 'text/html').status(200).send(finalHtml);
    } catch (error) {
        res.status(500).send(`ERROR_INTERNO: ${error.message}`);
    }
};

exports.submitFinalOrder = async (req, res) => {
    const { template, details } = req.body;
    const clientEmail = details.email || details.correo;
    try {
        const productSnap = await db.collection('products').doc(template).get();
        const pData = productSnap.exists ? productSnap.data() : { name: template, price: "99", currency: "MXN" };
        const now = new Date();
        const folio = `ORD-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        const isWebProduct = !template.startsWith('ia-') && !template.startsWith('sec-');
        let vertexInstructions = "";
        const isSpecial = template === 'SOLICITUD-ESPECIAL';

        if (!isWebProduct && !isSpecial) {
            try {
                const generativeModel = getVertexAI().getGenerativeModel({ model: modelAI });
                const aiResult = await generativeModel.generateContent(`Genera instrucciones de maquila para: ${pData.name}`);
                const aiResponse = await aiResult.response;
                vertexInstructions = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } catch (e) { vertexInstructions = "Error IA."; }
        }

        const orderRef = await db.collection('orders_to_fulfill').add({
            orderNumber: folio, productName: pData.name, isWeb: isWebProduct, ...details, timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

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
            </div>`;

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
                    ${!isWebProduct ? `<hr><p><strong>MAQUILA IA:</strong> ${vertexInstructions}</p>` : ''}
                </div>
            </div>`;

        const mailer = getTransporter();
        await mailer.sendMail({ from: '"ROBOTIAX CENTRAL" <geniosdeltalento@gmail.com>', to: 'geniosdeltalento@gmail.com', replyTo: clientEmail, subject: `⚡ MAQUILA: ${details.negocio} (${folio})`, html: adminMailHtml });
        await mailer.sendMail({ from: '"Robotiax Intelligence" <geniosdeltalento@gmail.com>', to: clientEmail, subject: `✅ Orden Confirmada: ${folio}`, html: clientReceiptHtml });

        return res.status(200).json({ status: 'ok', folio: folio });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getUploadUrl = async (req, res) => {
    const { contentType, templateId } = req.body;
    if (!contentType || !templateId) return res.status(400).json({ error: 'Faltan datos.' });
    const fileName = `user_uploads/${templateId}_${Date.now()}`;
    const file = bucket.file(fileName);
    try {
        const [uploadUrl] = await file.getSignedUrl({ version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType });
        res.status(200).send({ uploadUrl, publicUrl: `https://storage.googleapis.com/${bucket.name}/${fileName}` });
    } catch (error) {
        res.status(500).send({ status: "error", message: error.message });
    }
};