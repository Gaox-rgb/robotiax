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
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.8,
    transformObjectKeys: false,
    unicodeEscapeSequence: true
};

function deleteFolderRecursive(directoryPath) {
    try {
        if (fs.existsSync(directoryPath)) {
            const files = fs.readdirSync(directoryPath);
            files.forEach((file) => {
                const curPath = path.join(directoryPath, file);
                try {
                    const stat = fs.lstatSync(curPath);
                    if (stat.isDirectory()) {
                        deleteFolderRecursive(curPath);
                    } else {
                        fs.unlinkSync(curPath);
                    }
                } catch (err) {
                    // Silenciar bloqueos de archivos en uso por Windows/Chrome
                }
            });
            try {
                fs.rmdirSync(directoryPath);
            } catch (err) {
                // Silenciar bloqueo de carpetas
            }
        }
    } catch (globalErr) {
        // Silenciar cualquier error general de E/S
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
        // Silenciar conflictos de creación
    }
}

// Helpers de escritura e intercambio de archivos seguros
function safeWriteFile(distPath, content) {
    try {
        fs.writeFileSync(distPath, content, 'utf8');
        return true;
    } catch (err) {
        console.warn(`[AVISO DE BLOQUEO] Windows impidió reescribir: ${path.basename(distPath)}. Se conserva la versión activa.`);
        return false;
    }
}

function safeCopyFile(srcPath, distPath) {
    try {
        fs.copyFileSync(srcPath, distPath);
        return true;
    } catch (err) {
        console.warn(`[AVISO DE BLOQUEO] Windows impidió copiar: ${path.basename(distPath)}. Se conserva la versión activa.`);
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
            console.error(`[JS] Fallo al ofuscar ${path.basename(srcPath)}:`, err);
            safeCopyFile(srcPath, distPath);
        }
    } 
    else if (ext === '.css') {
        try {
            const content = fs.readFileSync(srcPath, 'utf8');
            const minified = new CleanCSS({}).minify(content);
            safeWriteFile(distPath, minified.styles);
            console.log(`[CSS] Minificado: ${path.relative(SRC_DIR, srcPath)}`);
        } catch (err) {
            console.error(`[CSS] Fallo al minificar ${path.basename(srcPath)}:`, err);
            safeCopyFile(srcPath, distPath);
        }
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
            console.error(`[HTML] Fallo al minificar ${path.basename(srcPath)}:`, err);
            safeCopyFile(srcPath, distPath);
        }
    } 
    else if (ext === '.json') {
        const content = fs.readFileSync(srcPath, 'utf8');
        try {
            const minified = JSON.stringify(JSON.parse(content));
            safeWriteFile(distPath, minified);
            console.log(`[JSON] Comprimido: ${path.relative(SRC_DIR, srcPath)}`);
        } catch (err) {
            console.error(`[JSON] Fallo al parsear ${path.basename(srcPath)}:`, err);
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
            await buildRecursive(srcPath); // FIXED: Espera obligatoriamente la resolución de subcarpetas
        } else {
            ensureDirectoryExistence(distPath);
            await processFile(srcPath, distPath);
        }
    }
}

async function run() {
    console.log('>>> [BUILD] Iniciando compilación de Robotiax...');
    console.log('>>> [BUILD] Limpiando directorio de distribución actual...');
    
    // Intento de borrado silencioso
    deleteFolderRecursive(DIST_DIR);
    
    // Crear el directorio final si no existe
    try {
        if (!fs.existsSync(DIST_DIR)) {
            fs.mkdirSync(DIST_DIR);
        }
    } catch (err) {
        // Silenciar conflictos
    }
    
    if (!fs.existsSync(SRC_DIR)) {
        console.error(`>>> [ERROR] Directorio origen no encontrado: ${SRC_DIR}`);
        process.exit(1);
    }
    
    await buildRecursive(SRC_DIR);
    
    // Generación automática de sitemap.xml para robotiax.shop
    generateSitemap();

    console.log('>>> [BUILD] Compilación finalizada exitosamente.');
}

function generateSitemap() {
    const DOMAIN = 'https://robotiax.shop';
    if (!fs.existsSync(DIST_DIR)) return;

    const files = fs.readdirSync(DIST_DIR);
    const htmlFiles = files.filter(file => file.endsWith('.html'));

    let urls = '';
    htmlFiles.forEach(file => {
        if (file === '404.html') return;

        const pageUrl = file === 'index.html' ? `${DOMAIN}/` : `${DOMAIN}/${file}`;
        urls += `
  <url>
    <loc>${pageUrl}</loc>
    <changefreq>weekly</changefreq>
    <priority>${file === 'index.html' ? '1.0' : '0.8'}</priority>
  </url>`;
    });

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    safeWriteFile(path.join(DIST_DIR, 'sitemap.xml'), sitemapContent.trim());
    console.log(`[SEO] Sitemap.xml generado automáticamente (${htmlFiles.length} páginas indexadas).`);
}

run();