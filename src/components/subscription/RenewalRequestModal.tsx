// src/components/subscription/RenewalRequestModal.tsx
// Modal para solicitar renovación de suscripción

import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Loader, DollarSign, Calendar } from 'lucide-react';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuth from '../../hooks/useAuth';
import { SubscriptionPlan } from '../../types/superadmin.types';
import { RenewalRequest } from '../../types/renewal.types';
import { uploadToCloudinary } from '../../utils/cloudinary.utils';

interface RenewalRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const RenewalRequestModal: React.FC<RenewalRequestModalProps> = ({ 
  isOpen, 
  onClose,
  onSuccess 
}) => {
  const { currentUser, gymData } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Planes disponibles
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  
  // Datos del formulario
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'deposit' | 'other'>('transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Archivo de comprobante
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Cargar planes disponibles
  useEffect(() => {
    if (isOpen) {
      loadPlans();
    }
  }, [isOpen]);

  const loadPlans = async () => {
    setLoadingPlans(true);
    try {
      const plansRef = collection(db, 'subscriptionPlans');
      const snapshot = await getDocs(plansRef);
      
      const activePlans = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SubscriptionPlan))
        .filter(plan => plan.isActive)
        .sort((a, b) => a.duration - b.duration);
      
      setPlans(activePlans);
      
      if (activePlans.length > 0) {
        setSelectedPlan(activePlans[0]);
      }
    } catch (err) {
      console.error('Error loading plans:', err);
      setError('Error al cargar los planes disponibles');
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes');
      return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar los 5MB');
      return;
    }

    setProofFile(file);
    setError(null);

    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Usar la utilidad existente de Cloudinary
  const uploadProofToCloudinary = async (file: File): Promise<string> => {
    try {
      const url = await uploadToCloudinary(file, 'payment_proofs');
      return url;
    } catch (err) {
      console.error('Error uploading to Cloudinary:', err);
      throw new Error('No se pudo subir la imagen. Intenta nuevamente.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!selectedPlan) {
      setError('Debes seleccionar un plan');
      return;
    }

    if (!proofFile) {
      setError('Debes subir el comprobante de pago');
      return;
    }

    if (!paymentDate) {
      setError('Debes ingresar la fecha de pago');
      return;
    }

    if (!gymData || !currentUser) {
      setError('Error: No se pudo obtener la información del gimnasio');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      // 1. Subir imagen a Cloudinary
      setUploadProgress(30);
      const imageUrl = await uploadProofToCloudinary(proofFile);
      
      setUploadProgress(60);

      // 2. Crear solicitud en Firebase
      const renewalRequest: any = {
        gymId: gymData.id,
        gymName: gymData.name,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        planDuration: selectedPlan.duration,
        planPrice: selectedPlan.price,
        paymentProofUrl: imageUrl,
        paymentProofPublicId: '', // Lo dejamos vacío ya que Cloudinary lo maneja internamente
        paymentMethod: paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        paymentDate: new Date(paymentDate),
        status: 'pending',
        requestedBy: currentUser.uid,
        requestedByName: gymData.owner,
        requestedByEmail: gymData.email,
        notes: notes.trim() || undefined,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'renewalRequests'), renewalRequest);
      
      setUploadProgress(100);
      setSuccess(true);

      setTimeout(() => {
        if (onSuccess) onSuccess();
        handleClose();
      }, 2000);

    } catch (err: any) {
      console.error('Error submitting renewal request:', err);
      setError(err.message || 'Error al enviar la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    
    setSelectedPlan(null);
    setPaymentMethod('transfer');
    setPaymentReference('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setProofFile(null);
    setProofPreview(null);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Solicitar Renovación de Suscripción</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
              <CheckCircle className="text-green-600 mr-3 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-green-800 font-medium">¡Solicitud enviada correctamente!</p>
                <p className="text-green-700 text-sm mt-1">
                  Tu solicitud será revisada por el administrador. Recibirás una notificación cuando sea aprobada.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="text-red-600 mr-3 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {loadingPlans ? (
            <div className="flex justify-center items-center py-8">
              <Loader className="animate-spin text-blue-600" size={32} />
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Selección de Plan */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Selecciona un Plan
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map(plan => (
                    <div
                      key={plan.id}
                      onClick={() => !loading && setSelectedPlan(plan)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPlan?.id === plan.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-800">{plan.name}</h3>
                        <input
                          type="radio"
                          checked={selectedPlan?.id === plan.id}
                          onChange={() => {}}
                          className="mt-1"
                          disabled={loading}
                        />
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <Calendar size={14} className="mr-1" />
                        {plan.duration} días
                      </div>
                      <div className="flex items-center text-lg font-bold text-blue-600">
                        <DollarSign size={18} />
                        {plan.price.toLocaleString('es-AR')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Método de Pago */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="transfer">Transferencia Bancaria</option>
                  <option value="deposit">Depósito</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              {/* Referencia de Pago */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Referencia / Operación (Opcional)
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  disabled={loading}
                  placeholder="Ej: 123456789"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                />
              </div>

              {/* Fecha de Pago */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Pago *
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  disabled={loading}
                  max={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                />
              </div>

              {/* Comprobante */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comprobante de Pago *
                </label>
                
                {!proofPreview ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload size={40} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 mb-2">Arrastra una imagen o haz clic para seleccionar</p>
                    <p className="text-xs text-gray-500 mb-3">PNG, JPG o JPEG - Máximo 5MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={loading}
                      className="hidden"
                      id="proof-upload"
                    />
                    <label
                      htmlFor="proof-upload"
                      className={`inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      Seleccionar Archivo
                    </label>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={proofPreview}
                      alt="Comprobante"
                      className="w-full h-64 object-contain bg-gray-50 rounded-lg border"
                    />
                    {!loading && (
                      <button
                        type="button"
                        onClick={() => {
                          setProofFile(null);
                          setProofPreview(null);
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Notas Adicionales */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas Adicionales (Opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  rows={3}
                  placeholder="Agrega cualquier información adicional..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
                />
              </div>

              {/* Progress Bar */}
              {loading && uploadProgress > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Procesando solicitud...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedPlan || !proofFile}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin mr-2" size={16} />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Solicitud'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RenewalRequestModal;