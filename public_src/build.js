const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const HtmlMinifier = require('html-minifier-terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC_DIR = path.join(__dirname, 'public_src');
const DIST_DIR = path.join(__dirname, 'public');

const OBFUSCATOR_OPTIONS = {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false, // Obligatorio para preservar compatibilidad con window.app
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'], // Cifra endpoints y variables de texto a Base64
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.8,
    transformObjectKeys: false,
    unicodeEscapeSequence: true // Convierte strings a secuencias unicode indescifrables (\x61\x62)
};

function safeDeleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        // Silenciar fallos en archivos individuales bloqueados por el emulador
    }
}

function deleteFolderRecursive(directoryPath, removeSelf = false) {
    try {
        if (fs.existsSync(directoryPath)) {
            fs.readdirSync(directoryPath).forEach((file) => {
                const curPath = path.join(directoryPath, file);
                try {
                    const stat = fs.lstatSync(curPath);
                    if (stat.isDirectory()) {
                        deleteFolderRecursive(curPath, true);
                    } else {
                        safeDeleteFile(curPath);
                    }
                } catch (err) {
                    // Resiliencia ante lectura fallida
                }
            });
            if (removeSelf && directoryPath !== DIST_DIR) {
                try {
                    fs.rmdirSync(directoryPath);
                } catch (err) {
                    // Silenciar bloqueo de borrado de directorios intermedios
                }
            }
        }
    } catch (globalErr) {
        // Ignorar fallas globales de lstat en directorios bloqueados
    }
}

function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    try {
        fs.mkdirSync(dirname);
    } catch (e) {
        // Evitar colisiones si ya fue creado por un hilo paralelo
    }
}

function cleanDirectoryContents(directoryPath) {
    deleteFolderRecursive(directoryPath, false);
}

function safeWriteFile(distPath, content) {
    try {
        ensureDirectoryExistence(distPath);
        if (fs.existsSync(distPath)) {
            try { fs.unlinkSync(distPath); } catch (e) {}
        }
        fs.writeFileSync(distPath, content, 'utf8');
        return true;
    } catch (err) {
        console.warn(`[AVISO] Archivo bloqueado por Windows (no se pudo reescribir): ${path.basename(distPath)}. Se conserva la versión previa.`);
        return false;
    }
}

function safeCopyFile(srcPath, distPath) {
    try {
        ensureDirectoryExistence(distPath);
        if (fs.existsSync(distPath)) {
            try { fs.unlinkSync(distPath); } catch (e) {}
        }
        fs.copyFileSync(srcPath, distPath);
        return true;
    } catch (err) {
        console.warn(`[AVISO] Archivo bloqueado por Windows (no se pudo copiar): ${path.basename(distPath)}. Se conserva la versión previa.`);
        return false;
    }
}

async function processFile(srcPath, distPath) {
    const ext = path.extname(srcPath).toLowerCase();
    
    if (ext === '.js') {
        const content = fs.readFileSync(srcPath, 'utf8');
        try {
            const result = JavaScriptObfuscator.obfuscate(content, OBFUSCATOR_OPTIONS);
            safeWriteFile(distPath, result.getObfuscatedCode());
            console.log(`[JS] Compilado y ofuscado: ${path.relative(SRC_DIR, srcPath)}`);
        } catch (err) {
            console.error(`[JS] Error al ofuscar ${srcPath}:`, err);
            safeCopyFile(srcPath, distPath);
        }
    } 
    else if (ext === '.css') {
        const content = fs.readFileSync(srcPath, 'utf8');
        const minified = new CleanCSS({}).minify(content);
        safeWriteFile(distPath, minified.styles);
        console.log(`[CSS] Minificado: ${path.relative(SRC_DIR, srcPath)}`);
    } 
    else if (ext === '.html') {
        const content = fs.readFileSync(srcPath, 'utf8');
        try {
            const minified = await HtmlMinifier.minify(content, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true,
                ignoreCustomComments: [/^\s*#/]
            });
            safeWriteFile(distPath, minified);
            console.log(`[HTML] Minificado: ${path.relative(SRC_DIR, srcPath)}`);
        } catch (err) {
            console.warn(`[AVISO] Fallo en minificación avanzada de HTML para ${path.basename(srcPath)} (posible error de sintaxis JS). Reintentando sin minificar JS...`);
            try {
                const fallbackMinified = await HtmlMinifier.minify(content, {
                    collapseWhitespace: true,
                    removeComments: true,
                    minifyCSS: true,
                    minifyJS: false,
                    ignoreCustomComments: [/^\s*#/]
                });
                safeWriteFile(distPath, fallbackMinified);
                console.log(`[HTML] Minificado (Fallback sin ofuscar JS interno): ${path.relative(SRC_DIR, srcPath)}`);
            } catch (fallbackErr) {
                console.error(`[HTML] Error absoluto al procesar HTML ${srcPath}:`, fallbackErr);
                safeCopyFile(srcPath, distPath);
            }
        }
    } 
    else if (ext === '.json') {
        const content = fs.readFileSync(srcPath, 'utf8');
        try {
            const minified = JSON.stringify(JSON.parse(content));
            safeWriteFile(distPath, minified);
            console.log(`[JSON] Comprimido: ${path.relative(SRC_DIR, srcPath)}`);
        } catch (err) {
            console.error(`[JSON] Error al parsear ${srcPath}:`, err);
            safeCopyFile(srcPath, distPath);
        }
    } 
    else {
        safeCopyFile(srcPath, distPath);
        console.log(`[RECURSO] Copiado directo: ${path.relative(SRC_DIR, srcPath)}`);
    }
}

async function buildRecursive(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const srcPath = path.join(dir, file);
        const distPath = path.join(DIST_DIR, path.relative(SRC_DIR, srcPath));
        
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            await buildRecursive(srcPath); // ¡CORREGIDO! Espera obligatoriamente a procesar las subcarpetas js/ y css/
        } else {
            ensureDirectoryExistence(distPath);
            await processFile(srcPath, distPath);
        }
    }
}

async function run() {
    console.log('>>> [BUILD] Iniciando compilación de Robotiax...');
    console.log('>>> [BUILD] Ejecutando limpieza segura de distribución...');
    
    // Ejecutar limpieza no bloqueante de archivos antiguos
    try {
        cleanDirectoryContents(DIST_DIR);
    } catch (e) {
        // Silenciar fallos de borrado inicial en directorios activos
    }
    
    // Asegurar la existencia de la carpeta de salida
    try {
        if (!fs.existsSync(DIST_DIR)) {
            fs.mkdirSync(DIST_DIR);
        }
    } catch (err) {
        // Directorio existente o bloqueado temporalmente
    }
    
    if (!fs.existsSync(SRC_DIR)) {
        console.error(`>>> [ERROR] Directorio origen no encontrado: ${SRC_DIR}`);
        process.exit(1);
    }
    
    await buildRecursive(SRC_DIR);
    console.log('>>> [BUILD] Compilación finalizada exitosamente.');
}

run();