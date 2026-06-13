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
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayCallsTransform: false,
    stringArrayEncoding: [],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'variable',
    stringBorderDetect: false,
    transformObjectKeys: false,
    unicodeEscapeSequence: false
};

function deleteFolderRecursive(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach((file) => {
            const curPath = path.join(directoryPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(directoryPath);
    }
}

function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

async function processFile(srcPath, distPath) {
    const ext = path.extname(srcPath).toLowerCase();
    
    if (ext === '.js') {
        const content = fs.readFileSync(srcPath, 'utf8');
        try {
            const result = JavaScriptObfuscator.obfuscate(content, OBFUSCATOR_OPTIONS);
            fs.writeFileSync(distPath, result.getObfuscatedCode(), 'utf8');
            console.log(`[JS] Compilado y ofuscado: ${path.relative(SRC_DIR, srcPath)}`);
        } catch (err) {
            console.error(`[JS] Error al ofuscar ${srcPath}:`, err);
            fs.copyFileSync(srcPath, distPath);
        }
    } 
    else if (ext === '.css') {
        const content = fs.readFileSync(srcPath, 'utf8');
        const minified = new CleanCSS({}).minify(content);
        fs.writeFileSync(distPath, minified.styles, 'utf8');
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
            fs.writeFileSync(distPath, minified, 'utf8');
            console.log(`[HTML] Minificado: ${path.relative(SRC_DIR, srcPath)}`);
        } catch (err) {
            console.error(`[HTML] Error al minificar ${srcPath}:`, err);
            fs.copyFileSync(srcPath, distPath);
        }
    } 
    else if (ext === '.json') {
        const content = fs.readFileSync(srcPath, 'utf8');
        try {
            const minified = JSON.stringify(JSON.parse(content));
            fs.writeFileSync(distPath, minified, 'utf8');
            console.log(`[JSON] Comprimido: ${path.relative(SRC_DIR, srcPath)}`);
        } catch (err) {
            console.error(`[JSON] Error al parsear ${srcPath}:`, err);
            fs.copyFileSync(srcPath, distPath);
        }
    } 
    else {
        fs.copyFileSync(srcPath, distPath);
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
            buildRecursive(srcPath);
        } else {
            ensureDirectoryExistence(distPath);
            await processFile(srcPath, distPath);
        }
    }
}

async function run() {
    console.log('>>> [BUILD] Iniciando compilación de Robotiax...');
    console.log('>>> [BUILD] Limpiando directorio de distribución actual...');
    deleteFolderRecursive(DIST_DIR);
    fs.mkdirSync(DIST_DIR);
    
    if (!fs.existsSync(SRC_DIR)) {
        console.error(`>>> [ERROR] Directorio origen no encontrado: ${SRC_DIR}`);
        process.exit(1);
    }
    
    await buildRecursive(SRC_DIR);
    console.log('>>> [BUILD] Compilación finalizada exitosamente.');
}

run();