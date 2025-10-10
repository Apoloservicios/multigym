// src/pages/admin/QRCodeGenerator.tsx
// 📱 GENERADOR DE CÓDIGO QR - VERSIÓN ÚNICA SIMPLIFICADA

import React, { useState, useEffect } from 'react';
import { QrCode, Download, Copy, CheckCircle, Printer } from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const QRCodeGenerator: React.FC = () => {
  const { gymData } = useAuth();
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [registrationUrl, setRegistrationUrl] = useState('');

  useEffect(() => {
    if (gymData?.id) {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/register/${gymData.id}`;
      setRegistrationUrl(url);

      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
      setQrCodeUrl(qrApiUrl);
    }
  }, [gymData?.id]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('Error al copiar. Por favor, copia manualmente el link.');
    }
  };

  const downloadQR = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `QR_Registro_${gymData?.name || 'Gym'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${gymData?.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 40px;
            }
            h1 {
              color: #1e40af;
              margin-bottom: 20px;
            }
            img {
              max-width: 400px;
              margin: 30px auto;
              border: 2px solid #e5e7eb;
              padding: 20px;
            }
            .instructions {
              margin-top: 30px;
              font-size: 18px;
              color: #374151;
            }
            .url {
              margin-top: 20px;
              padding: 15px;
              background: #f3f4f6;
              border-radius: 8px;
              font-family: monospace;
              word-break: break-all;
            }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${gymData?.name}</h1>
          <h2>Registro y Actualización de Socios</h2>
          <img src="${qrCodeUrl}" alt="QR Code" />
          <div class="instructions">
            <p><strong>Escanea este código QR</strong></p>
            <p>O ingresa a:</p>
            <div class="url">${registrationUrl}</div>
            <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
              • Nuevos socios: completan formulario de registro<br/>
              • Socios existentes: actualizan sus datos con verificación
            </p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!gymData?.id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          Cargando información del gimnasio...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
          <QrCode className="h-8 w-8 mr-3 text-blue-600" />
          Código QR de Registro
        </h1>
        <p className="text-gray-600">
          Código unificado para registro de nuevos socios y actualización de datos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vista previa del QR */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Vista Previa
          </h2>
          
          <div className="bg-gray-50 rounded-lg p-8 flex flex-col items-center">
            {qrCodeUrl && (
              <>
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code" 
                  className="w-64 h-64 border-4 border-white shadow-lg rounded-lg"
                />
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600 mb-2">Escanea para registrarte o actualizar datos en</p>
                  <p className="font-bold text-lg text-blue-600">{gymData.name}</p>
                </div>
              </>
            )}
          </div>

          {/* Botones de acción */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={downloadQR}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center"
            >
              <Download className="h-5 w-5 mr-2" />
              Descargar QR
            </button>

            <button
              onClick={printQR}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center"
            >
              <Printer className="h-5 w-5 mr-2" />
              Imprimir QR
            </button>
          </div>
        </div>

        {/* Información y link */}
        <div className="space-y-6">
          {/* Link directo */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Link Directo
            </h2>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">URL de registro:</p>
              <p className="font-mono text-sm break-all text-blue-600">
                {registrationUrl}
              </p>
            </div>

            <button
              onClick={copyToClipboard}
              className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 flex items-center justify-center"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5 mr-2" />
                  Copiar Link
                </>
              )}
            </button>
          </div>

          {/* Instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">
              📋 Cómo Funciona
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="mr-2">1.</span>
                <span>El socio escanea el QR o ingresa al link</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">2.</span>
                <span>Ingresa su DNI o Email</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">3.</span>
                <span><strong>Si es nuevo:</strong> Completa el formulario de registro</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">4.</span>
                <span><strong>Si ya existe:</strong> Verifica su identidad (últimos 4 dígitos del DNI/teléfono) y actualiza sus datos</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">5.</span>
                <span>Tú recibes la solicitud y la apruebas desde el panel</span>
              </li>
            </ul>
          </div>

          {/* Consejos */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-semibold text-green-900 mb-3">
              💡 Consejos
            </h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Coloca el QR en un lugar visible de la recepción</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Comparte el link por WhatsApp o redes sociales</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Revisa los registros pendientes regularmente</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Las actualizaciones requieren verificación de seguridad</span>
              </li>
            </ul>
          </div>

          {/* Ventajas */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h3 className="font-semibold text-purple-900 mb-3">
              ⭐ Ventajas
            </h3>
            <ul className="space-y-2 text-sm text-purple-800">
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>Un solo QR para registro Y actualización</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>Detección automática de socios existentes</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>Verificación de seguridad para actualizaciones</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>Control total con aprobación manual</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>Ahorra tiempo en carga de datos</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;