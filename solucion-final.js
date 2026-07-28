// solucion-final.js
const https = require('https');

// --- CONFIGURACIÓN ---
const PROJECT_ID = 'robotiax'; 
const TOKEN = process.env.GOOGLE_OAUTH_TOKEN;
const DOMAIN = '*.ikai.info';

const data = JSON.stringify({});

const options = {
  hostname: 'firebasehosting.googleapis.com',
  port: 443,
  path: `/v1beta1/projects/${PROJECT_ID}/sites/${PROJECT_ID}/customDomains?customDomainId=${encodeURIComponent(DOMAIN)}`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'X-Goog-User-Project': PROJECT_ID 
  }
};

console.log(`🚀 Enviando orden directa al servidor de Google para: ${DOMAIN}...`);

const req = https.request(options, (res) => {
  let responseBody = '';
  res.on('data', (d) => { responseBody += d; });
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('\n✅ [ÉXITO]: El comodín *.ikai.info ha sido registrado en el servidor.');
      console.log('👉 Ve a tu consola web de Firebase y ya debería aparecer en la lista.');
    } else {
      console.error(`\n❌ ERROR (${res.statusCode}):`, responseBody);
    }
  });
});

req.on('error', (error) => { console.error('\n❌ FALLO DE RED:', error); });
req.write(data);
req.end();