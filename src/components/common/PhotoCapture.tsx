import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, RotateCcw, Check } from 'lucide-react';

interface PhotoCaptureProps {
  onPhotoCapture: (file: File, preview: string) => void;
  currentPreview?: string | null;
  onRemove?: () => void;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({ 
  onPhotoCapture, 
  currentPreview,
  onRemove 
}) => {
  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Iniciar cámara
  const startCamera = async () => {
    setError('');
    setIsVideoReady(false);
    
    try {
      // Primero verificar si hay dispositivos de video
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        setError('No se encontró ninguna cámara en tu dispositivo.');
        return;
      }

      console.log('🎥 Solicitando acceso a la cámara...');
      
      const constraints = {
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Stream obtenido:', mediaStream);
      console.log('📹 Tracks de video:', mediaStream.getVideoTracks());
      
      setStream(mediaStream);
      setMode('camera');
      
      // Esperar un poco antes de asignar al video
      setTimeout(() => {
        if (videoRef.current && mediaStream) {
          console.log('🎬 Asignando stream al video...');
          videoRef.current.srcObject = mediaStream;
          
          // Forzar reproducción
          const playPromise = videoRef.current.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('✅ Video reproduciendo');
                setIsVideoReady(true);
              })
              .catch(err => {
                console.error('❌ Error al reproducir:', err);
                setError(`Error al iniciar video: ${err.message}`);
              });
          }
        }
      }, 100);
      
    } catch (err: any) {
      console.error('❌ Error al acceder a la cámara:', err);
      
      let errorMessage = 'No se pudo acceder a la cámara. ';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage += 'Debes permitir el acceso a la cámara en tu navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage += 'No se encontró ninguna cámara en tu dispositivo.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage += 'La cámara ya está siendo usada por otra aplicación.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'La configuración de cámara no es compatible con tu dispositivo.';
      } else if (err.name === 'SecurityError') {
        errorMessage += 'Error de seguridad. Asegúrate de estar usando HTTPS.';
      } else {
        errorMessage += `Error: ${err.message || 'Desconocido'}`;
      }
      
      setError(errorMessage);
      setMode('select');
    }
  };

  // Detener cámara
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoReady(false);
  }, [stream]);

  // Capturar foto
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isVideoReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Asegurar que el video tenga dimensiones válidas
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Error: La cámara aún no está lista');
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Voltear horizontalmente para que sea como un espejo
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageDataUrl);
    setMode('preview');
    stopCamera();
  };

  // Confirmar foto
  const confirmPhoto = () => {
    if (!capturedImage) return;

    // Convertir base64 a File
    fetch(capturedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onPhotoCapture(file, capturedImage);
        setMode('select');
        setCapturedImage(null);
      });
  };

  // Retomar foto
  const retakePhoto = () => {
    setCapturedImage(null);
    setIsVideoReady(false);
    startCamera();
  };

  // Manejar subida de archivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen');
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar los 5MB');
      return;
    }

    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      onPhotoCapture(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Limpiar al desmontar
  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Si ya hay una foto
  if (currentPreview && mode === 'select') {
    return (
      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={currentPreview}
            alt="Foto actual"
            className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={startCamera}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <Camera className="h-4 w-4" />
            Tomar nueva foto
          </button>
          <label className="cursor-pointer">
            <div className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm text-center">
              <Upload className="h-4 w-4" />
              Subir otra imagen
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    );
  }

  // Modo: Seleccionar opción inicial
  if (mode === 'select') {
    return (
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opción: Tomar foto */}
          <button
            type="button"
            onClick={startCamera}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <Camera className="h-12 w-12 text-gray-400 group-hover:text-blue-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
              Tomar Selfie
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Usa la cámara de tu dispositivo
            </p>
          </button>

          {/* Opción: Subir archivo */}
          <label className="cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 hover:bg-blue-50 transition-all group">
              <Upload className="h-12 w-12 text-gray-400 group-hover:text-blue-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                Subir Imagen
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG o GIF (máx. 5MB)
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    );
  }

  // Modo: Cámara activa
  if (mode === 'camera') {
    return (
      <div className="space-y-4">
        <div className="relative bg-black rounded-lg overflow-hidden min-h-[300px]">
          {!isVideoReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-3"></div>
                <p className="text-white text-sm">Iniciando cámara...</p>
                <p className="text-gray-400 text-xs mt-2">Asegúrate de permitir el acceso</p>
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-auto min-h-[300px] object-cover ${!isVideoReady ? 'opacity-0' : 'opacity-100'}`}
            style={{ transform: 'scaleX(-1)' }}
            onLoadedMetadata={(e) => {
              console.log('📹 Video metadata cargada');
              console.log('Dimensiones:', e.currentTarget.videoWidth, 'x', e.currentTarget.videoHeight);
            }}
            onCanPlay={() => {
              console.log('🎬 Video can play');
              setIsVideoReady(true);
            }}
            onError={(e) => {
              console.error('❌ Video error:', e);
              setError('Error al mostrar el video de la cámara');
            }}
          />
          {isVideoReady && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <p className="text-white text-center text-sm mb-3">
                Posiciónate frente a la cámara
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setMode('select');
              setIsVideoReady(false);
            }}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={capturePhoto}
            disabled={!isVideoReady}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:bg-blue-300 disabled:cursor-not-allowed font-medium"
          >
            <Camera className="h-5 w-5" />
            {isVideoReady ? 'Capturar' : 'Esperando...'}
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // Modo: Vista previa de foto capturada
  if (mode === 'preview' && capturedImage) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <img
            src={capturedImage}
            alt="Foto capturada"
            className="w-full h-auto max-h-96 object-cover rounded-lg border-2 border-gray-300"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={retakePhoto}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-5 w-5" />
            Retomar
          </button>
          <button
            type="button"
            onClick={confirmPhoto}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            <Check className="h-5 w-5" />
            Usar esta foto
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default PhotoCapture;