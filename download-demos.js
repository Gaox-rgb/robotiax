const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// 1. Configuración (Asegúrate de tener tu archivo de credenciales .json)
const serviceAccount = require("./service-account-key.json"); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "robotiax.firebasestorage.app" // Tu bucket
});

const bucket = admin.storage().bucket();
const localDemosPath = path.join(__dirname, "public", "demos");

async function syncDemos() {
  console.log("Refreshing local demos from Firebase Storage...");

  try {
    // Listar archivos en la carpeta 'demos/' del Storage
    const [files] = await bucket.getFiles({ prefix: "demos/" });

    for (const file of files) {
      if (file.name.endsWith("/")) continue; // Ignorar carpetas

      const fileName = path.basename(file.name);
      const destination = path.join(localDemosPath, fileName);

      // Descargar el archivo
      await file.download({ destination });
      console.log(`✅ Descargado: ${fileName}`);
    }

    console.log("\n🚀 Sincronización completada. Tus archivos están en public/demos/");
  } catch (error) {
    console.error("Error al sincronizar:", error);
  }
}

syncDemos();