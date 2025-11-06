// src/components/members/ManageMobileUserModal.tsx
import React, { useState } from 'react';
import { X, Smartphone, Mail, Key, Trash2, Power, AlertCircle, CheckCircle } from 'lucide-react';
import { 
  sendPasswordResetEmailToMember,
  deactivateMobileUser,
  reactivateMobileUser
} from '../../services/mobileUserService';

interface ManageMobileUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  mobileUserInfo: {
    uid: string;
    email: string;
    isActive: boolean;
  };
  onUpdate: () => void;
}

const ManageMobileUserModal: React.FC<ManageMobileUserModalProps> = ({
  isOpen,
  onClose,
  member,
  mobileUserInfo,
  onUpdate
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendPasswordReset = async () => {
    if (!window.confirm(`¿Enviar email de recuperación de contraseña a ${mobileUserInfo.email}?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await sendPasswordResetEmailToMember(mobileUserInfo.email);
      setSuccess('Email de recuperación enviado exitosamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al enviar email');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    const action = mobileUserInfo.isActive ? 'desactivar' : 'reactivar';
    
    if (!window.confirm(`¿Estás seguro de ${action} el acceso móvil de ${member.firstName}?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mobileUserInfo.isActive) {
        await deactivateMobileUser(mobileUserInfo.uid);
        setSuccess('Acceso móvil desactivado');
      } else {
        await reactivateMobileUser(mobileUserInfo.uid);
        setSuccess('Acceso móvil reactivado');
      }
      
      setTimeout(() => {
        setSuccess('');
        onUpdate();
      }, 1500);
      
    } catch (err: any) {
      setError(err.message || `Error al ${action}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              mobileUserInfo.isActive ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Smartphone className={`w-5 h-5 ${
                mobileUserInfo.isActive ? 'text-green-600' : 'text-gray-400'
              }`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Gestionar Acceso Móvil
              </h2>
              <p className="text-sm text-gray-500">
                {member.firstName} {member.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Estado actual */}
          <div className={`p-4 rounded-lg border-2 ${
            mobileUserInfo.isActive 
              ? 'bg-green-50 border-green-200' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                mobileUserInfo.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <div>
                <p className="font-medium text-gray-900">
                  Estado: {mobileUserInfo.isActive ? 'Activo' : 'Desactivado'}
                </p>
                <p className="text-sm text-gray-600">
                  {mobileUserInfo.email}
                </p>
              </div>
            </div>
          </div>

          {/* Mensajes */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="space-y-3">
            {/* Resetear contraseña */}
            <button
              onClick={handleSendPasswordReset}
              disabled={loading || !mobileUserInfo.isActive}
              className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900">Enviar Email de Recuperación</p>
                <p className="text-sm text-gray-500">El socio recibirá un link para resetear su contraseña</p>
              </div>
            </button>

            {/* Desactivar/Reactivar */}
            <button
              onClick={handleToggleActive}
              disabled={loading}
              className={`w-full flex items-center gap-3 p-4 border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                mobileUserInfo.isActive
                  ? 'border-red-200 hover:bg-red-50'
                  : 'border-green-200 hover:bg-green-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                mobileUserInfo.isActive ? 'bg-red-100' : 'bg-green-100'
              }`}>
                <Power className={`w-5 h-5 ${
                  mobileUserInfo.isActive ? 'text-red-600' : 'text-green-600'
                }`} />
              </div>
              <div className="flex-1 text-left">
                <p className={`font-medium ${
                  mobileUserInfo.isActive ? 'text-red-900' : 'text-green-900'
                }`}>
                  {mobileUserInfo.isActive ? 'Desactivar Acceso' : 'Reactivar Acceso'}
                </p>
                <p className="text-sm text-gray-500">
                  {mobileUserInfo.isActive 
                    ? 'El socio no podrá usar la app móvil' 
                    : 'El socio podrá volver a usar la app móvil'}
                </p>
              </div>
            </button>
          </div>

          {/* Info adicional */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Nota:</strong> Los cambios se aplican inmediatamente. 
              Si desactivas el acceso, el socio será deslogueado automáticamente de la app.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageMobileUserModal;