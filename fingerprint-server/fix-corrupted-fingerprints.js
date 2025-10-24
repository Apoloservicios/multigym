// ============================================
// SCRIPT DE LIMPIEZA - Huellas Corruptas
// Ejecutar: node fix-corrupted-fingerprints.js
// ============================================

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, 'templates');

console.log('🔍 VERIFICADOR DE HUELLAS CORRUPTAS');
console.log('═══════════════════════════════════════════');
console.log('');

// Verificar si existe el directorio
if (!fs.existsSync(TEMPLATES_DIR)) {
    console.log('❌ No se encontró el directorio templates/');
    process.exit(1);
}

// Leer todos los archivos
const files = fs.readdirSync(TEMPLATES_DIR);

if (files.length === 0) {
    console.log('📁 No hay archivos en templates/');
    process.exit(0);
}

console.log(`📋 Se encontraron ${files.length} archivos:\n`);

let corruptedCount = 0;
let validCount = 0;

files.forEach(file => {
    if (!file.endsWith('.txt')) {
        return;
    }

    const filePath = path.join(TEMPLATES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Verificar si es Base64 válido
    const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(content.trim());
    
    if (!isValidBase64) {
        console.log(`❌ CORRUPTO: ${file}`);
        console.log(`   Tamaño: ${content.length} caracteres`);
        console.log(`   Primeros 50 caracteres: ${content.substring(0, 50)}...`);
        console.log('');
        corruptedCount++;
    } else {
        console.log(`✅ VÁLIDO: ${file} (${content.length} caracteres)`);
        validCount++;
    }
});

console.log('');
console.log('═══════════════════════════════════════════');
console.log(`Archivos válidos: ${validCount}`);
console.log(`Archivos corruptos: ${corruptedCount}`);
console.log('═══════════════════════════════════════════');
console.log('');

if (corruptedCount > 0) {
    console.log('⚠️  ACCIÓN REQUERIDA:');
    console.log('');
    console.log('Las huellas corruptas deben ser RE-REGISTRADAS.');
    console.log('Para cada socio con huella corrupta:');
    console.log('  1. Ve a "Socios" en MultiGym');
    console.log('  2. Busca al socio');
    console.log('  3. Click en "Eliminar Huella"');
    console.log('  4. Click en "Registrar Huella"');
    console.log('  5. Vuelve a capturar la huella');
    console.log('');
    console.log('Esto solucionará los errores de Base64.');
    console.log('');
}