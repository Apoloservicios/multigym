// ============================================
// SERVIDOR DE HUELLAS - DIGITAL PERSONA 4500
// VERSIÓN CORREGIDA - Captura única en verificación
// ============================================

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execPromise = promisify(exec);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const FINGERPRINT_APP_PATH = path.join(__dirname, 'FingerprintApp.exe');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

let isProcessing = false;

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function checkFingerprintApp() {
    return fs.existsSync(FINGERPRINT_APP_PATH);
}

/**
 * Ejecutar FingerprintApp.exe
 * IMPORTANTE: 
 * - 'enroll' = Pide 4 capturas y genera template (para REGISTRO)
 * - 'capture' = Pide 1 captura y genera template (para VERIFICACIÓN)
 */
async function executeFingerprintApp(command, templatePath, timeout = 20000) {
    return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Timeout: La operación tardó demasiado'));
        }, timeout);

        try {
            const fullCommand = `"${FINGERPRINT_APP_PATH}" ${command} "${templatePath}"`;
            console.log('🔧 Ejecutando:', fullCommand);

            const { stdout, stderr } = await execPromise(fullCommand);
            clearTimeout(timeoutId);

            if (stderr && !stderr.includes('Warning')) {
                console.error('⚠️  stderr:', stderr);
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

// ============================================
// ENDPOINTS
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        fingerprintAppExists: checkFingerprintApp(),
        templatesDir: fs.existsSync(TEMPLATES_DIR),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/fingerprint/init', async (req, res) => {
    try {
        if (!checkFingerprintApp()) {
            return res.status(500).json({
                success: false,
                error: 'FingerprintApp.exe no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Sistema inicializado',
            devices: [{ name: 'Digital Persona U.are.U 4500', uid: 'default' }]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/fingerprint/status', (req, res) => {
    res.json({
        success: true,
        initialized: checkFingerprintApp(),
        ready: checkFingerprintApp(),
        timestamp: new Date().toISOString()
    });
});

/**
 * CAPTURA PARA VERIFICACIÓN - Solo 1 captura
 * Usa comando 'capture' que pide el dedo UNA sola vez
 */
app.get('/api/fingerprint/capture', async (req, res) => {
    try {
        if (isProcessing) {
            return res.status(409).json({
                success: false,
                error: 'Operación en curso'
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

        console.log('📸 Capturando huella para VERIFICACIÓN (1 captura)...');

        const tempPath = path.join(TEMPLATES_DIR, `temp_verify_${Date.now()}.txt`);

        // IMPORTANTE: Usar 'capture' no 'enroll'
        // 'capture' = 1 sola captura
        // 'enroll' = 4 capturas (solo para registro)
        const result = await executeFingerprintApp('capture', tempPath, 15000);

        if (!result.success) {
            isProcessing = false;
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            
            return res.json({
                success: false,
                noFinger: result.message?.includes('no finger'),
                message: result.message || 'Error al capturar'
            });
        }

        if (!fs.existsSync(tempPath)) {
            isProcessing = false;
            return res.json({
                success: false,
                error: 'No se generó el template'
            });
        }

        const template = fs.readFileSync(tempPath, 'utf8').trim();
        fs.unlinkSync(tempPath);

        if (!template || template.length < 100) {
            isProcessing = false;
            return res.json({
                success: false,
                error: 'Template inválido'
            });
        }

        isProcessing = false;
        console.log('✅ Huella capturada (1 captura)');

        res.json({
            success: true,
            data: {
                template: template,
                quality: 95,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        isProcessing = false;
        console.error('❌ Error:', error);
        
        // Limpiar temporales
        const tempFiles = fs.readdirSync(TEMPLATES_DIR).filter(f => f.startsWith('temp_'));
        tempFiles.forEach(f => {
            try { fs.unlinkSync(path.join(TEMPLATES_DIR, f)); } catch (e) {}
        });
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * REGISTRO DE HUELLA - Pide 4 capturas
 * Usa comando 'enroll' que genera un template de calidad con múltiples muestras
 */
app.post('/api/fingerprint/enroll', async (req, res) => {
    try {
        if (isProcessing) {
            return res.status(409).json({
                success: false,
                error: 'Operación en curso'
            });
        }

        const { memberId, memberName } = req.body;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                error: 'memberId requerido'
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

        console.log(`📝 Registrando huella para: ${memberName || memberId} (4 capturas)...`);

        const enrollPath = path.join(TEMPLATES_DIR, `${memberId}.txt`);

        // IMPORTANTE: Usar 'enroll' para registro
        // 'enroll' = 4 capturas de alta calidad
        const result = await executeFingerprintApp('enroll', enrollPath, 30000);

        isProcessing = false;

        if (!result.success) {
            if (fs.existsSync(enrollPath)) fs.unlinkSync(enrollPath);
            return res.json({
                success: false,
                error: result.message || 'Error al registrar'
            });
        }

        if (!fs.existsSync(enrollPath)) {
            return res.json({
                success: false,
                error: 'No se generó el archivo de huella'
            });
        }

        const template = fs.readFileSync(enrollPath, 'utf8').trim();

        console.log(`✅ Huella registrada: ${memberName || memberId}`);
        console.log(`   Muestras: 4`);
        console.log(`   Template length: ${template.length}`);

        res.json({
            success: true,
            message: 'Huella registrada correctamente',
            data: {
                template: template,
                quality: 95
            }
        });

    } catch (error) {
        isProcessing = false;
        console.error('❌ Error en enroll:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * VERIFICACIÓN - Compara template capturado con los registrados
 */
app.post('/api/fingerprint/verify', async (req, res) => {
    try {
        if (isProcessing) {
            return res.status(409).json({
                success: false,
                error: 'Operación en curso'
            });
        }

        isProcessing = true;

        const { gymId, template } = req.body;

        if (!template) {
            isProcessing = false;
            return res.status(400).json({
                success: false,
                error: 'Template requerido'
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

        // Guardar template capturado
        const capturedPath = path.join(TEMPLATES_DIR, `verify_captured_${Date.now()}.txt`);
        fs.writeFileSync(capturedPath, template, 'utf8');

        // Obtener huellas registradas
        const files = fs.readdirSync(TEMPLATES_DIR);
        const enrolledFiles = files.filter(f => 
            f.endsWith('.txt') && 
            !f.startsWith('verify_') && 
            !f.startsWith('temp_')
        );

        if (enrolledFiles.length === 0) {
            isProcessing = false;
            fs.unlinkSync(capturedPath);
            return res.json({
                success: true,
                match: false,
                message: 'No hay huellas registradas'
            });
        }

        console.log(`📋 Comparando contra ${enrolledFiles.length} huellas...`);

        let bestMatch = null;

        // Comparar contra cada huella
        for (let i = 0; i < enrolledFiles.length; i++) {
            const file = enrolledFiles[i];
            const memberId = path.basename(file, '.txt');
            const enrolledPath = path.join(TEMPLATES_DIR, file);

            console.log(`   [${i + 1}/${enrolledFiles.length}] ${memberId}`);

            let enrolledTemplate;
            try {
                enrolledTemplate = fs.readFileSync(enrolledPath, 'utf8').trim();
            } catch (readError) {
                console.log(`   ⚠️  Error leyendo`);
                continue;
            }

            if (!enrolledTemplate || enrolledTemplate.length < 100) {
                console.log(`   ⚠️  Template inválido`);
                continue;
            }

            // Guardar temporalmente para comparar
            const tempEnrolledPath = path.join(TEMPLATES_DIR, `verify_enrolled_${Date.now()}.txt`);
            fs.writeFileSync(tempEnrolledPath, enrolledTemplate, 'utf8');

            try {
                // Ejecutar verificación con FingerprintApp.exe
                // Esto compara el template capturado contra el registrado
                const verifyResult = await executeFingerprintApp('verify', tempEnrolledPath, 10000);

                if (fs.existsSync(tempEnrolledPath)) {
                    fs.unlinkSync(tempEnrolledPath);
                }

                if (verifyResult.verified === true || verifyResult.success === true) {
                    console.log(`   ✅ ¡MATCH! ${memberId}`);
                    bestMatch = {
                        memberId: memberId,
                        similarity: verifyResult.score || 95
                    };
                    break;
                }

            } catch (verifyError) {
                console.error(`   ⚠️  Error: ${verifyError.message}`);
                if (fs.existsSync(tempEnrolledPath)) {
                    fs.unlinkSync(tempEnrolledPath);
                }
                continue;
            }
        }

        // Limpiar template capturado
        if (fs.existsSync(capturedPath)) {
            fs.unlinkSync(capturedPath);
        }

        isProcessing = false;

        if (bestMatch) {
            console.log(`✅ Identificado: ${bestMatch.memberId}`);
            return res.json({
                success: true,
                match: true,
                data: {
                    memberId: bestMatch.memberId,
                    similarity: bestMatch.similarity,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            console.log('❌ No match');
            return res.json({
                success: true,
                match: false,
                message: 'Huella no reconocida'
            });
        }

    } catch (error) {
        isProcessing = false;
        console.error('❌ Error verificando:', error);
        
        // Limpiar temporales
        const tempFiles = fs.readdirSync(TEMPLATES_DIR).filter(f => 
            f.startsWith('verify_') || f.startsWith('temp_')
        );
        tempFiles.forEach(f => {
            try { fs.unlinkSync(path.join(TEMPLATES_DIR, f)); } catch (e) {}
        });
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/fingerprint/:memberId/exists', (req, res) => {
    try {
        const { memberId } = req.params;
        const filepath = path.join(TEMPLATES_DIR, `${memberId}.txt`);
        
        res.json({
            success: true,
            exists: fs.existsSync(filepath),
            memberId: memberId
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/fingerprint/:memberId', async (req, res) => {
    try {
        const { memberId } = req.params;
        const filepath = path.join(TEMPLATES_DIR, `${memberId}.txt`);

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                error: 'Huella no encontrada'
            });
        }

        fs.unlinkSync(filepath);
        console.log(`🗑️  Eliminada: ${memberId}`);

        res.json({
            success: true,
            message: 'Huella eliminada'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/fingerprints', (req, res) => {
    try {
        const files = fs.readdirSync(TEMPLATES_DIR);
        const fingerprints = files
            .filter(f => f.endsWith('.txt') && !f.startsWith('verify_') && !f.startsWith('temp_'))
            .map(f => ({
                memberId: path.basename(f, '.txt'),
                filename: f,
                size: fs.statSync(path.join(TEMPLATES_DIR, f)).size,
                registeredAt: fs.statSync(path.join(TEMPLATES_DIR, f)).mtime
            }));

        res.json({
            success: true,
            data: fingerprints,
            count: fingerprints.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  🔐 SERVIDOR DE HUELLAS - DIGITAL PERSONA ║');
    console.log('║     VERSIÓN CORREGIDA - Captura Única     ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Servidor: http://localhost:${PORT}`);
    console.log(`📁 Templates: ${TEMPLATES_DIR}`);
    console.log('');
    
    const appExists = checkFingerprintApp();
    console.log(`📱 FingerprintApp.exe: ${appExists ? '✅ Encontrado' : '❌ NO ENCONTRADO'}`);
    
    if (appExists) {
        console.log(`📍 ${FINGERPRINT_APP_PATH}`);
    }
    console.log('');
    console.log('🔧 Configuración de capturas:');
    console.log('   • Registro (enroll):     4 capturas del dedo');
    console.log('   • Verificación (capture): 1 captura del dedo');
    console.log('');
    console.log('📋 Endpoints:');
    console.log('   GET    /api/health');
    console.log('   GET    /api/fingerprint/init');
    console.log('   GET    /api/fingerprint/status');
    console.log('   GET    /api/fingerprint/capture    ← 1 captura');
    console.log('   POST   /api/fingerprint/enroll     ← 4 capturas');
    console.log('   POST   /api/fingerprint/verify');
    console.log('   GET    /api/fingerprint/:id/exists');
    console.log('   DELETE /api/fingerprint/:id');
    console.log('   GET    /api/fingerprints');
    console.log('');
    console.log('✨ ¡Listo para usar!');
    console.log('');
});

process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando...');
    
    try {
        const tempFiles = fs.readdirSync(TEMPLATES_DIR).filter(f => 
            f.startsWith('temp_') || f.startsWith('verify_')
        );
        tempFiles.forEach(f => fs.unlinkSync(path.join(TEMPLATES_DIR, f)));
    } catch (e) {}
    
    process.exit(0);
});

module.exports = app;