// ============================================
// TEST DEL SERVIDOR - Verificación rápida
// Ejecutar con: node test-server.js
// ============================================

const http = require('http');

const BASE_URL = 'http://localhost:3001';

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

// Hacer petición HTTP
function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: data
                    });
                }
            });
        });
        
        req.on('error', reject);
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

// Tests
async function runTests() {
    console.clear();
    log('╔════════════════════════════════════════════╗', 'cyan');
    log('║   TEST DEL SERVIDOR DE HUELLAS            ║', 'cyan');
    log('╚════════════════════════════════════════════╝', 'cyan');
    console.log('');

    let passed = 0;
    let failed = 0;

    // Test 1: Health Check
    console.log('Test 1: Health Check');
    try {
        const result = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/health',
            method: 'GET'
        });
        
        if (result.statusCode === 200 && result.data.success) {
            log('  ✅ PASS - Servidor respondiendo', 'green');
            log(`     Status: ${result.data.status}`, 'blue');
            log(`     FingerprintApp: ${result.data.fingerprintAppExists ? 'Encontrado' : 'No encontrado'}`, 
                result.data.fingerprintAppExists ? 'green' : 'yellow');
            passed++;
        } else {
            log('  ❌ FAIL - Respuesta inesperada', 'red');
            failed++;
        }
    } catch (error) {
        log('  ❌ FAIL - No se pudo conectar al servidor', 'red');
        log(`     Error: ${error.message}`, 'red');
        log('', 'reset');
        log('  ⚠️  Asegúrate de que el servidor esté corriendo:', 'yellow');
        log('     node fingerprint-server.js', 'yellow');
        failed++;
        return;
    }
    console.log('');

    // Test 2: Init
    console.log('Test 2: Inicialización');
    try {
        const result = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/fingerprint/init',
            method: 'GET'
        });
        
        if (result.statusCode === 200 && result.data.success) {
            log('  ✅ PASS - Sistema inicializado', 'green');
            passed++;
        } else {
            log('  ❌ FAIL - Error al inicializar', 'red');
            log(`     ${result.data.error || 'Error desconocido'}`, 'red');
            failed++;
        }
    } catch (error) {
        log('  ❌ FAIL - Error en la petición', 'red');
        failed++;
    }
    console.log('');

    // Test 3: Status
    console.log('Test 3: Estado del lector');
    try {
        const result = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/fingerprint/status',
            method: 'GET'
        });
        
        if (result.statusCode === 200) {
            log('  ✅ PASS - Estado obtenido', 'green');
            log(`     Inicializado: ${result.data.initialized ? 'Sí' : 'No'}`, 'blue');
            log(`     Listo: ${result.data.ready ? 'Sí' : 'No'}`, 'blue');
            passed++;
        } else {
            log('  ❌ FAIL - Error al obtener estado', 'red');
            failed++;
        }
    } catch (error) {
        log('  ❌ FAIL - Error en la petición', 'red');
        failed++;
    }
    console.log('');

    // Test 4: Verificar endpoint de enroll (sin capturar realmente)
    console.log('Test 4: Endpoint de registro (enroll)');
    try {
        const result = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/fingerprint/enroll',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                memberId: 'test_123',
                template: 'TEST_TEMPLATE_STRING',
                quality: 95
            }
        });
        
        if (result.statusCode === 200 && result.data.success) {
            log('  ✅ PASS - Endpoint de registro funcionando', 'green');
            passed++;
        } else {
            log('  ❌ FAIL - Error en endpoint de registro', 'red');
            failed++;
        }
    } catch (error) {
        log('  ❌ FAIL - Error en la petición', 'red');
        failed++;
    }
    console.log('');

    // Test 5: Verificar existencia de huella
    console.log('Test 5: Verificar existencia de huella');
    try {
        const result = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/fingerprint/test_123/exists',
            method: 'GET'
        });
        
        if (result.statusCode === 200 && result.data.success) {
            log('  ✅ PASS - Endpoint de verificación funcionando', 'green');
            log(`     Huella existe: ${result.data.exists ? 'Sí' : 'No'}`, 'blue');
            passed++;
        } else {
            log('  ❌ FAIL - Error en verificación', 'red');
            failed++;
        }
    } catch (error) {
        log('  ❌ FAIL - Error en la petición', 'red');
        failed++;
    }
    console.log('');

    // Resumen
    log('═══════════════════════════════════════════', 'cyan');
    log('  RESUMEN DE TESTS', 'cyan');
    log('═══════════════════════════════════════════', 'cyan');
    log(`  Tests exitosos: ${passed}`, passed > 0 ? 'green' : 'reset');
    log(`  Tests fallidos: ${failed}`, failed > 0 ? 'red' : 'reset');
    console.log('');

    if (failed === 0) {
        log('🎉 ¡TODOS LOS TESTS PASARON!', 'green');
        console.log('');
        log('El servidor está listo para usar con React.', 'green');
        console.log('');
        log('Próximos pasos:', 'cyan');
        log('  1. Mantén este servidor corriendo', 'blue');
        log('  2. Inicia tu aplicación React', 'blue');
        log('  3. Prueba registrar y verificar huellas desde la UI', 'blue');
    } else {
        log('⚠️  ALGUNOS TESTS FALLARON', 'yellow');
        console.log('');
        log('Revisa los errores arriba y:', 'yellow');
        log('  1. Verifica que FingerprintApp.exe esté en la carpeta', 'blue');
        log('  2. Verifica que el servidor esté corriendo en puerto 3001', 'blue');
        log('  3. Verifica que no haya otro proceso usando el puerto', 'blue');
    }
    console.log('');
}

// Ejecutar tests
runTests().catch(error => {
    log('❌ Error fatal ejecutando tests:', 'red');
    console.error(error);
});