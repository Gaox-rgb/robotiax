const paypal = require("@paypal/checkout-server-sdk");
const { db } = require("./util");
const admin = require("firebase-admin");

const getPaypalClient = (clientId, clientSecret) => {
    const env = new paypal.core.SandboxEnvironment(clientId, clientSecret);
    return new paypal.core.PayPalHttpClient(env);
};

exports.createPaypalOrder = async (req, res, clientId, clientSecret) => {
    const client = getPaypalClient(clientId, clientSecret);
    const { productId, returnUrl } = req.body; // Recibimos la URL completa del frontend
    const DEFAULT_RETURN = 'https://robotiax.mx/desarrollo-web.html';

    if (!productId) return res.status(400).send("Falta ID de producto.");

    const productDoc = await db.collection('products').doc(productId).get();
    if (!productDoc.exists) return res.status(404).send("Producto no reconocido.");
    const productData = productDoc.data();

    // Limpiamos la URL de retorno para evitar duplicidad de params
    const cleanReturnUrl = (returnUrl || DEFAULT_RETURN).split('?')[0];

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            description: `ROBOTIAX PROTOCOL: ${productData.name}`,
            amount: { currency_code: productData.currency, value: productData.price.toString() }
        }],
        application_context: {
            return_url: `${cleanReturnUrl}?status=success`,
            cancel_url: `${cleanReturnUrl}?status=cancel`,
            landing_page: 'BILLING',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING'
        }
    });

    try {
        const order = await client.execute(request);
        const approveUrl = order.result.links.find(link => link.rel === 'approve').href;
        res.status(200).json({ orderID: order.result.id, approveUrl });
    } catch (error) {
        res.status(500).send("Error PayPal.");
    }
};

exports.capturePaypalOrder = async (req, res, clientId, clientSecret) => {
    // ... (Se mantiene igual, la lógica de captura es sólida)
    const client = getPaypalClient(clientId, clientSecret);
    const { orderID, productId } = req.body;
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    try {
        const capture = await client.execute(request);
        if (capture.result.status === 'COMPLETED') {
            await db.collection('pending_orders').add({
                paypalOrderId: orderID, productId, customerData: req.body.customerData || {},
                createdAt: admin.firestore.FieldValue.serverTimestamp(), status: 'paid_pending'
            });
            res.status(200).json({ status: "success" });
        } else { res.status(400).send("No completado"); }
    } catch (e) { res.status(500).send(e.message); }
};