// ============================================
// FINGERPRINT SERVER - VERSIÓN REAL
// Servidor para MultiGym con FingerprintApp.exe
// Puerto: 3001 (mismo que simulación)
// ============================================

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execPromise = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// CONFIGURACIÓN
// ============================================

// Middleware
app.use(cors());
app.use(express.json());

// Rutas de archivos
const FINGERPRINT_APP_PATH = path.join(__dirname, 'FingerprintApp.exe');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Crear directorio de templates si no existe
if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    console.log('📁 Directorio templates creado');
}

// Variable para controlar operaciones concurrentes
let isProcessing = false;

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Verificar si FingerprintApp.exe existe
 */
function checkFingerprintApp() {
    return fs.existsSync(FINGERPRINT_APP_PATH);
}

/**
 * Ejecutar FingerprintApp.exe con timeout
 */
async function executeFingerprintApp(command, templatePath, timeout = 15000) {
    return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Timeout: La operación tardó demasiado tiempo'));
        }, timeout);

        try {
            const fullCommand = `"${FINGERPRINT_APP_PATH}" ${command} "${templatePath}"`;
            console.log('🔧 Ejecutando:', fullCommand);

            const { stdout, stderr } = await execPromise(fullCommand);

            clearTimeout(timeoutId);

            if (stderr && !stderr.includes('Warning')) {
                console.error('⚠️  Error stderr:', stderr);
            }

            try {
                const result = JSON.parse(stdout.trim());
                resolve(result);
            } catch (parseError) {
                console.error('❌ Error parseando JSON:', stdout);
                reject(new Error('Respuesta inválida de FingerprintApp.exe'));
            }
        } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
        }
    });
}

/**
 * Leer template de archivo
 */
function readTemplate(socioId) {
    const templatePath = path.join(TEMPLATES_DIR, `socio_${socioId}.txt`);
    
    if (!fs.existsSync(templatePath)) {
        return null;
    }
    
    return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Guardar template en archivo
 */
function saveTemplate(socioId, template) {
    const templatePath = path.join(TEMPLATES_DIR, `socio_${socioId}.txt`);
    fs.writeFileSync(templatePath, template, 'utf8');
}

/**
 * Verificar si un socio tiene huella registrada
 */
function hasFingerprint(socioId) {
    const templatePath = path.join(TEMPLATES_DIR, `socio_${socioId}.txt`);
    return fs.existsSync(templatePath);
}

// ============================================
// ENDPOINTS
// ============================================

/**
 * Health Check - Compatible con React actual
 */
app.get('/api/health', (req, res) => {
    const appExists = checkFingerprintApp();
    
    res.json({
        success: true,
        status: 'ok', // React espera este campo
        message: 'Servidor de huellas funcionando',
        fingerprintAppExists: appExists,
        templatesDir: fs.existsSync(TEMPLATES_DIR),
        timestamp: new Date().toISOString()
    });
});

/**
 * Inicializar - Verificar que todo esté listo
 * React espera este endpoint
 */
app.get('/api/fingerprint/init', async (req, res) => {
    try {
        if (!checkFingerprintApp()) {
            return res.status(500).json({
                success: false,
                error: 'FingerprintApp.exe no encontrado'
            });
        }

        // Verificar que el directorio de templates exista
        if (!fs.existsSync(TEMPLATES_DIR)) {
            fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
        }

        res.json({
            success: true,
            message: 'Sistema de huellas inicializado correctamente',
            devices: [
                {
                    name: 'Digital Persona U.are.U 4500',
                    uid: 'default'
                }
            ]
        });
    } catch (error) {
        console.error('❌ Error en /init:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Estado del lector
 * React espera este endpoint
 */
app.get('/api/fingerprint/status', (req, res) => {
    const appExists = checkFingerprintApp();
    
    res.json({
        initialized: appExists,
        ready: appExists,
        timestamp: new Date().toISOString()
    });
});

/**
 * Capturar huella digital
 * React espera: GET /api/fingerprint/capture
 */
app.get('/api/fingerprint/capture', async (req, res) => {
    try {
        // Verificar si hay otra operación en curso
        if (isProcessing) {
            return res.status(409).json({
                success: false,
                error: 'Hay otra operación en curso. Por favor espere.'
            });
        }

        isProcessing = true;

        if (!checkFingerprintApp()) {
            isProcessing = false;
            return res.status(500).json({
                success: false,
                error: 'FingerprintApp.exe no encontrado'
            });
        }

        console.log('📸 Iniciando captura de huella...');

        // Usar un archivo temporal para la captura
        const tempPath = path.join(TEMPLATES_DIR, `temp_${Date.now()}.txt`);

        // Ejecutar captura
        const result = await executeFingerprintApp('capture', tempPath);

        if (!result.success) {
            isProcessing = false;
            // Limpiar archivo temporal si existe
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            return res.json({
                success: false,
                error: result.error || result.message
            });
        }

        // Leer el template capturado
        const template = fs.readFileSync(tempPath, 'utf8');

        // Limpiar archivo temporal
        fs.unlinkSync(tempPath);

        console.log('✅ Huella capturada correctamente');
        console.log(`   Muestras usadas: ${result.samplesUsed || 'N/A'}`);
        console.log(`   Template length: ${template.length}`);

        isProcessing = false;

        // Formato compatible con React
        res.json({
            success: true,
            data: {
                template: template,
                quality: 95, // FingerprintApp.exe no devuelve quality, asumimos buena calidad
                timestamp: new Date().toISOString()
            },
            message: result.message
        });

    } catch (error) {
        isProcessing = false;
        console.error('❌ Error capturando huella:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al capturar huella'
        });
    }
});

/**
 * Validar huella antes de guardar (enroll)
 * React espera: POST /api/fingerprint/enroll
 */
app.post('/api/fingerprint/enroll', async (req, res) => {
    try {
        const { memberId, template, quality } = req.body;

        if (!memberId || !template) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros: memberId y template son requeridos'
            });
        }

        // Guardar el template
        saveTemplate(memberId, template);

        console.log(`✅ Huella registrada para socio: ${memberId}`);
        console.log(`   Template length: ${template.length}`);

        res.json({
            success: true,
            message: `Huella registrada correctamente para socio ${memberId}`
        });

    } catch (error) {
        console.error('❌ Error en enroll:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Verificar huella contra base de datos
 * React espera: POST /api/fingerprint/verify
 */
app.post('/api/fingerprint/verify', async (req, res) => {
    try {
        // Verificar si hay otra operación en curso
        if (isProcessing) {
            return res.status(409).json({
                success: false,
                error: 'Hay otra operación en curso. Por favor espere.'
            });
        }

        isProcessing = true;

        const { capturedTemplate, enrolledFingerprints } = req.body;

        if (!capturedTemplate || !enrolledFingerprints || enrolledFingerprints.length === 0) {
            isProcessing = false;
            return res.status(400).json({
                success: false,
                error: 'Parámetros inválidos'
            });
        }

        if (!checkFingerprintApp()) {
            isProcessing = false;
            return res.status(500).json({
                success: false,
                error: 'FingerprintApp.exe no encontrado'
            });
        }

        console.log('🔍 Verificando huella...');
        console.log(`   Huellas en BD: ${enrolledFingerprints.length}`);

        // Guardar template capturado temporalmente
        const capturedPath = path.join(TEMPLATES_DIR, `verify_captured_${Date.now()}.txt`);
        fs.writeFileSync(capturedPath, capturedTemplate, 'utf8');

        let bestMatch = null;
        let attempts = 0;
        let skippedCorrupted = 0;

        // Comparar contra cada huella registrada
        for (const enrolled of enrolledFingerprints) {
            attempts++;
            
            // Validar que el template no esté corrupto (Base64 válido)
            if (!enrolled.template || enrolled.template.length < 100) {
                console.log(`   [${attempts}/${enrolledFingerprints.length}] ⚠️  Saltando ${enrolled.memberName} - template inválido`);
                skippedCorrupted++;
                continue;
            }

            // Verificar caracteres Base64 válidos
            const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(enrolled.template.trim());
            if (!isValidBase64) {
                console.log(`   [${attempts}/${enrolledFingerprints.length}] ⚠️  Saltando ${enrolled.memberName} - Base64 corrupto`);
                skippedCorrupted++;
                continue;
            }

            console.log(`   [${attempts}/${enrolledFingerprints.length}] Comparando con: ${enrolled.memberName}`);

            // Guardar template registrado temporalmente
            const enrolledPath = path.join(TEMPLATES_DIR, `verify_enrolled_${Date.now()}.txt`);
            
            try {
                fs.writeFileSync(enrolledPath, enrolled.template, 'utf8');
            } catch (writeError) {
                console.error(`   ⚠️  Error escribiendo template de ${enrolled.memberName}`);
                skippedCorrupted++;
                continue;
            }

            try {
                // Ejecutar verificación con FingerprintApp.exe
                // El comando verify compara el template capturado contra el registrado
                const result = await executeFingerprintApp('verify', enrolledPath);

                // Limpiar archivo temporal del enrolled
                fs.unlinkSync(enrolledPath);

                if (result.verified === true) {
                    console.log(`   ✅ ¡COINCIDENCIA! - ${enrolled.memberName}`);
                    bestMatch = {
                        memberId: enrolled.memberId,
                        memberName: enrolled.memberName,
                        confidence: result.score || 98
                    };
                    break;
                }
            } catch (verifyError) {
                console.error(`   ⚠️  Error comparando con ${enrolled.memberName}:`, verifyError.message);
                // Limpiar archivo temporal si existe
                if (fs.existsSync(enrolledPath)) {
                    fs.unlinkSync(enrolledPath);
                }
                continue;
            }
        }

        // Limpiar archivo temporal de captura
        if (fs.existsSync(capturedPath)) {
            fs.unlinkSync(capturedPath);
        }

        isProcessing = false;

        if (skippedCorrupted > 0) {
            console.log(`   ⚠️  Se saltaron ${skippedCorrupted} huellas corruptas`);
        }

        if (bestMatch) {
            console.log(`✅ Socio identificado: ${bestMatch.memberName}`);
            res.json({
                success: true,
                match: bestMatch
            });
        } else {
            console.log('❌ Huella no reconocida');
            res.json({
                success: false,
                message: 'Huella no reconocida'
            });
        }

    } catch (error) {
        isProcessing = false;
        console.error('❌ Error verificando huella:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Guardar template desde Firebase
 * Endpoint adicional para sincronización
 */
app.post('/api/fingerprint/save-template', async (req, res) => {
    try {
        const { socioId, template } = req.body;

        if (!socioId || !template) {
            return res.status(400).json({
                success: false,
                error: 'socioId y template son requeridos'
            });
        }

        saveTemplate(socioId, template);

        console.log(`💾 Template guardado para socio: ${socioId}`);

        res.json({
            success: true,
            message: 'Template guardado correctamente',
            socioId: socioId
        });
    } catch (error) {
        console.error('❌ Error guardando template:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Verificar si existe huella para un socio
 */
app.get('/api/fingerprint/:socioId/exists', (req, res) => {
    try {
        const { socioId } = req.params;
        const exists = hasFingerprint(socioId);

        res.json({
            success: true,
            exists: exists,
            socioId: socioId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Eliminar huella de un socio
 */
app.delete('/api/fingerprint/:socioId', async (req, res) => {
    try {
        const { socioId } = req.params;
        const templatePath = path.join(TEMPLATES_DIR, `socio_${socioId}.txt`);

        if (fs.existsSync(templatePath)) {
            fs.unlinkSync(templatePath);
            console.log(`🗑️  Huella eliminada para socio: ${socioId}`);
            res.json({
                success: true,
                message: 'Huella eliminada correctamente'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Huella no encontrada'
            });
        }
    } catch (error) {
        console.error('❌ Error eliminando huella:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.clear();
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   MULTIGYM - SERVIDOR DE HUELLAS REAL     ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║   Puerto: ${PORT}                             ║`);
    console.log(`║   FingerprintApp: ${checkFingerprintApp() ? '✅' : '❌'}                  ║`);
    console.log(`║   Templates Dir: ${fs.existsSync(TEMPLATES_DIR) ? '✅' : '❌'}                   ║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log('🔗 Endpoints disponibles:');
    console.log('   GET    /api/health');
    console.log('   GET    /api/fingerprint/init');
    console.log('   GET    /api/fingerprint/status');
    console.log('   GET    /api/fingerprint/capture');
    console.log('   POST   /api/fingerprint/enroll');
    console.log('   POST   /api/fingerprint/verify');
    console.log('   POST   /api/fingerprint/save-template');
    console.log('   GET    /api/fingerprint/:socioId/exists');
    console.log('   DELETE /api/fingerprint/:socioId');
    console.log('');
    console.log('✅ Servidor listo para recibir peticiones');
    console.log('');

    if (!checkFingerprintApp()) {
        console.log('⚠️  ADVERTENCIA: FingerprintApp.exe no encontrado');
        console.log('   Ubicación esperada:', FINGERPRINT_APP_PATH);
        console.log('');
    }
});

module.exports = app;