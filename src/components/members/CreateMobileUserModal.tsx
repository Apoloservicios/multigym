// src/components/members/CreateMobileUserModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Smartphone, Mail, Lock, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { 
  createMobileUser, 
  checkMobileUserExists,
  MobileUserCredentials,
   findUserByEmail,
     findMobileUserByEmail,
  transferMobileUser, 
} from '../../services/mobileUserService';

interface CreateMobileUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  gymId: string;
}


const CreateMobileUserModal: React.FC<CreateMobileUserModalProps> = ({
  isOpen,
  onClose,
  member,
  gymId
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [credentials, setCredentials] = useState<MobileUserCredentials | null>(null);
  const [copied, setCopied] = useState<'email' | 'password' | 'all' | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [existingUser, setExistingUser] = useState<{ exists: boolean; email?: string } | null>(null);

useEffect(() => {
  if (isOpen) {
    checkExistingUser();
    checkEmailInOtherGyms();
  }
}, [isOpen]);

const checkEmailInOtherGyms = async () => {
  try {
    const result = await findMobileUserByEmail(member.email);
    
    if (result && result.gymId !== gymId) {
      // Usuario existe en OTRO gimnasio
      setExistingUserInOtherGym(result);
    } else {
      setExistingUserInOtherGym(null);
    }
  } catch (error) {
    console.error('Error verificando email en otros gyms:', error);
  }
};

const handleTransferUser = async () => {
  if (!existingUserInOtherGym) return;
  
  setLoading(true);
  setError('');
  
  try {
    await transferMobileUser(
      existingUserInOtherGym.uid,
      gymId,
      member.id
    );
    
    setSuccess(true);
    setCredentials({
      email: member.email,
      password: '(Contraseña existente - sin cambios)',
      uid: existingUserInOtherGym.uid
    });
    
  } catch (err: any) {
    setError(err.message || 'Error al transferir usuario móvil');
  } finally {
    setLoading(false);
  }
};


  const [existingUserInOtherGym, setExistingUserInOtherGym] = useState<any>(null);

  // Agregar este estado
const [emailConflict, setEmailConflict] = useState<any>(null);

// Agregar esta función
const checkEmailAvailability = async () => {
  try {
    const result = await findUserByEmail(member.email);
    setEmailConflict(result);
  } catch (error) {
    console.error('Error verificando email:', error);
  }
};

useEffect(() => {
  if (isOpen) {
    checkExistingUser();
    checkEmailAvailability();
  }
}, [isOpen]);

  const checkExistingUser = async () => {
    try {
      const result = await checkMobileUserExists(gymId, member.id);
      setExistingUser(result);
    } catch (error) {
      console.error('Error verificando usuario:', error);
    }
  };

  const handleCreateUser = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await createMobileUser({
        gymId,
        memberId: member.id,
        memberEmail: member.email,
        memberName: `${member.firstName} ${member.lastName}`,
        generatePassword: useCustomPassword ? customPassword : undefined
      });
      
      setCredentials(result);
      setSuccess(true);
      
    } catch (err: any) {
      setError(err.message || 'Error al crear usuario móvil');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'email' | 'password' | 'all') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClose = () => {
    setCredentials(null);
    setSuccess(false);
    setError('');
    setCustomPassword('');
    setUseCustomPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Crear Acceso Móvil
              </h2>
              <p className="text-sm text-gray-500">
                {member.firstName} {member.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Usuario existente */}
          {existingUser?.exists && !success && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">
                    Ya tiene acceso móvil
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Email: {existingUser.email}
                  </p>
                </div>
              </div>
            </div>
          )}

              {emailConflict?.exists && !existingUser?.exists && (
              <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">
                      Email ya registrado en otro gimnasio
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      Este email ya está siendo usado en otro gimnasio. El socio debe:
                      <br />• Solicitar la baja del acceso móvil en su gimnasio anterior, o
                      <br />• Usar un email diferente
                    </p>
                  </div>
                </div>
              </div>
            )}

     
          {/* Usuario existente en otro gimnasio */}
          {existingUserInOtherGym && !success && (
            <div className={`mb-4 p-4 border-2 rounded-lg ${
              existingUserInOtherGym.isActive 
                ? 'bg-red-50 border-red-200' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`w-6 h-6 mt-0.5 flex-shrink-0 ${
                  existingUserInOtherGym.isActive ? 'text-red-600' : 'text-blue-600'
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-semibold mb-2 ${
                    existingUserInOtherGym.isActive ? 'text-red-900' : 'text-blue-900'
                  }`}>
                    Este socio ya tiene acceso móvil en otro gimnasio
                  </p>
                  
                  <div className={`text-sm space-y-1 mb-3 ${
                    existingUserInOtherGym.isActive ? 'text-red-800' : 'text-blue-800'
                  }`}>
                    <p>• Email: {existingUserInOtherGym.email}</p>
                    <p className="flex items-center gap-2">
                      • Estado: 
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        existingUserInOtherGym.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {existingUserInOtherGym.isActive ? (
                          <>
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Activo
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                            Desactivado
                          </>
                        )}
                      </span>
                    </p>
                  </div>
                  
                  {existingUserInOtherGym.isActive ? (
                    // Usuario ACTIVO - No permitir transferencia
                    <div className="space-y-3">
                      <div className="p-3 bg-red-100 rounded-lg border border-red-300">
                        <p className="text-sm text-red-900 font-medium mb-2">
                          ⚠️ No se puede transferir
                        </p>
                        <p className="text-sm text-red-800">
                          El acceso móvil de este socio está <strong>activo en otro gimnasio</strong>.
                        </p>
                      </div>
                      
                      <div className="p-3 bg-white rounded-lg border border-red-200">
                        <p className="text-sm text-red-900 font-medium mb-2">
                          📋 Para transferir este socio:
                        </p>
                        <ol className="text-sm text-red-800 space-y-1 list-decimal list-inside">
                          <li>El gimnasio anterior debe <strong>desactivar</strong> su acceso móvil</li>
                          <li>Una vez desactivado, podrás transferirlo a tu gimnasio</li>
                        </ol>
                      </div>
                      
                      <button
                        disabled
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                      >
                        <X className="w-4 h-4" />
                        <span>Transferencia No Disponible</span>
                      </button>
                    </div>
                  ) : (
                    // Usuario DESACTIVADO - Permitir transferencia
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-100 rounded-lg border border-blue-300">
                        <p className="text-sm text-blue-900 font-medium mb-2">
                          ✅ Transferencia disponible
                        </p>
                        <p className="text-sm text-blue-800">
                          El acceso móvil está <strong>desactivado</strong> en el otro gimnasio. 
                          Puedes transferirlo a tu gimnasio.
                        </p>
                      </div>
                      
                      <button
                        onClick={handleTransferUser}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Transfiriendo...</span>
                          </>
                        ) : (
                          <>
                            <Smartphone className="w-4 h-4" />
                            <span>Transferir a Este Gimnasio</span>
                          </>
                        )}
                      </button>
                      
                      <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                        <strong>Nota:</strong> La contraseña del socio se mantendrá igual. Solo cambiará el gimnasio al que tiene acceso.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Formulario */}
        {!success && !existingUser?.exists && !existingUserInOtherGym && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email del socio
                </label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">{member.email}</span>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={useCustomPassword}
                    onChange={(e) => setUseCustomPassword(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Usar contraseña personalizada
                  </span>
                </label>
                
                {useCustomPassword && (
                  <input
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Ingresa contraseña (mín. 6 caracteres)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
                
                {!useCustomPassword && (
                  <p className="text-sm text-gray-500 mt-2">
                    Se generará una contraseña segura automáticamente
                  </p>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          )}
        
          {/* Credenciales generadas */}
          {success && credentials && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      ¡Usuario móvil creado exitosamente!
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Comparte estas credenciales con el socio
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 bg-gray-50 rounded-lg font-mono text-sm">
                      {credentials.email}
                    </div>
                    <button
                      onClick={() => copyToClipboard(credentials.email, 'email')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Copiar email"
                    >
                      {copied === 'email' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Contraseña */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-3 bg-gray-50 rounded-lg font-mono text-sm">
                      {credentials.password}
                    </div>
                    <button
                      onClick={() => copyToClipboard(credentials.password, 'password')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Copiar contraseña"
                    >
                      {copied === 'password' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Copiar todo */}
                <button
                  onClick={() => copyToClipboard(
                    `Email: ${credentials.email}\nContraseña: ${credentials.password}`,
                    'all'
                  )}
                  className="w-full py-2 px-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                  {copied === 'all' ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar ambas credenciales</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Importante:</strong> Guarda estas credenciales en un lugar seguro.
                  El socio las necesitará para acceder a la app móvil.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          {!success ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
                  <button
                    onClick={handleCreateUser}
                    disabled={loading || existingUser?.exists || existingUserInOtherGym}  // ← AGREGAR existingUserInOtherGym
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creando...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>Crear Usuario Móvil</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateMobileUserModal;