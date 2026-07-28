// force-wildcard.js
const { google } = require('googleapis');
const path = require('path');

// 1. Configuración de identidad (Usamos tu llave de cuenta de servicio)
const KEY_PATH = path.join(__dirname, 'gcp-key.json');
const PROJECT_ID = 'robotiax'; // Tu ID de proyecto de Firebase
const SITE_ID = 'robotiax';    // Tu ID de sitio de Firebase Hosting
const WILDCARD_DOMAIN = '*.ikai.info';

async function registerWildcard() {
    console.log(`🚀 Iniciando registro forzado de dominio comodín: ${WILDCARD_DOMAIN}`);

    try {
        // Autenticación con Google
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_PATH,
            scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']
        });

        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const accessToken = tokenResponse.token;

        // Llamada directa a la API de Firebase Hosting (v1beta1)
        const url = `https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${SITE_ID}/domains?domainName=${encodeURIComponent(WILDCARD_DOMAIN)}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log("\n✅ [ÉXITO TOTAL]: El dominio comodín *.ikai.info ha sido registrado en Firebase.");
            console.log("--------------------------------------------------------------------------");
            console.log("👉 IMPORTANTE: Ahora solo ve a tu consola de Firebase en la web, actualiza");
            console.log("la página y verás que el dominio ya aparece en la lista.");
            console.log("Solo te pedirá agregar un registro TXT en IONOS una única vez para verificar.");
        } else {
            console.error("\n❌ ERROR AL REGISTRAR:", data.error.message);
        }

    } catch (error) {
        console.error("\n❌ FALLO CRÍTICO DEL SCRIPT:", error.message);
    }
}

registerWildcard();