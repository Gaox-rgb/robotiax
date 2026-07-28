// bypass-wildcard.js
const WILDCARD_DOMAIN = '*.ikai.info';
const PROJECT_ID = 'robotiax'; 
const SITE_ID = 'robotiax';
const TOKEN = 'AQUÍ_PEGA_TU_TOKEN_DE_FIREBASE'; // <--- PEGA TU TOKEN AQUÍ

async function runBypass() {
    console.log(`🚀 Forzando registro de comodín para el proyecto: ${PROJECT_ID}`);
    
    const url = `https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${SITE_ID}/domains?domainName=${encodeURIComponent(WILDCARD_DOMAIN)}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log("\n✅ [ÉXITO TOTAL]: Dominio *.ikai.info registrado.");
            console.log("👉 Ve a tu consola de Firebase, actualiza y verás que ya aparece.");
        } else {
            console.error("\n❌ ERROR:", data.error ? data.error.message : JSON.stringify(data));
        }
    } catch (e) {
        console.error("\n❌ FALLO DE RED:", e.message);
    }
}

runBypass();