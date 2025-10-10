// src/pages/public/UnifiedRegistration.tsx
// 📋 FORMULARIO UNIFICADO CON VERIFICACIÓN DE 1 FACTOR

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  User, CheckCircle, AlertCircle, Loader, Home
} from 'lucide-react';
import { 
  collection, 
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../config/firebase';

interface PendingRegistration {
  gymId: string;
  gymName: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  isUpdate?: boolean;
  memberId?: string;
  previousData?: any;
  newData?: any;
  status: 'pending';
  createdAt: any;
}

const UnifiedRegistration: React.FC = () => {
  const { gymId } = useParams<{ gymId: string }>();
  
  const [step, setStep] = useState<'identify' | 'verify' | 'form' | 'success'>('identify');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gymName, setGymName] = useState('');
  const [existingMember, setExistingMember] = useState<any>(null);
  const [identifier, setIdentifier] = useState('');
  
  const [verificationQuestions, setVerificationQuestions] = useState<Array<{
    field: string;
    label: string;
    value: string;
    hint?: string;
    type?: string;
    mask?: string;
  }>>([]);
  const [verificationAnswers, setVerificationAnswers] = useState<{[key: string]: string}>({});
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dni: '',
    email: '',
    phone: '',
    birthDate: '',
    address: ''
  });

  // Generar preguntas de verificación
  const generateVerificationQuestions = (member: any, searchedBy: string): Array<any> => {
    const questions: Array<any> = [];
    const usedFields = [searchedBy];
    
    const availableFields = [
      { field: 'dni', label: 'DNI', value: member.dni },
      { field: 'email', label: 'Email', value: member.email },
      { field: 'phone', label: 'Teléfono', value: member.phone },
      { field: 'birthDate', label: 'Fecha de Nacimiento', value: member.birthDate }
    ].filter(f => f.value && !usedFields.includes(f.field));

    const selectedFields = availableFields.slice(0, 2);
    
    selectedFields.forEach(field => {
      if (field.field === 'dni' && field.value) {
        const dni = field.value.toString();
        questions.push({
          field: 'dni',
          label: 'Completa tu DNI',
          value: dni,
          hint: `${dni.slice(0, 2)}••••${dni.slice(-2)}`,
          type: 'input',
          mask: '########'
        });
      } else if (field.field === 'email' && field.value) {
        const email = field.value;
        const [user, domain] = email.split('@');
        questions.push({
          field: 'email',
          label: 'Completa tu Email',
          value: email,
          hint: `${user.slice(0, 2)}••••@${domain}`,
          type: 'input'
        });
      } else if (field.field === 'phone' && field.value) {
        const phone = field.value.toString();
        questions.push({
          field: 'phone',
          label: 'Últimos 4 dígitos de tu teléfono',
          value: phone.slice(-4),
          hint: `${phone.slice(0, 3)}••••••${phone.slice(-1)}`,
          type: 'input',
          mask: '####'
        });
      } else if (field.field === 'birthDate' && field.value) {
        questions.push({
          field: 'birthDate',
          label: 'Tu fecha de nacimiento',
          value: field.value,
          type: 'date'
        });
      }
    });

    return questions;
  };

  // PASO 1: Identificar
  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const gymRef = doc(db, 'gyms', gymId!);
      const gymSnap = await getDoc(gymRef);
      
      if (!gymSnap.exists()) {
        setError('Gimnasio no encontrado.');
        setLoading(false);
        return;
      }
      
      setGymName(gymSnap.data().name);

      const membersRef = collection(db, `gyms/${gymId}/members`);
      const searchTerm = identifier.trim().toLowerCase();
      
      const isDNI = /^\d{7,8}$/.test(searchTerm);
      const isPhone = /^\d{10}$/.test(searchTerm);
      const isEmail = searchTerm.includes('@');
      
      let foundMember = null;
      let searchedByField = '';

      if (isDNI) {
        const q = query(membersRef, where('dni', '==', searchTerm));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          foundMember = { id: snapshot.docs[0].id, ...docData } as any;
          searchedByField = 'dni';
        }
      } else if (isEmail) {
        const q = query(membersRef, where('email', '==', searchTerm));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          foundMember = { id: snapshot.docs[0].id, ...docData } as any;
          searchedByField = 'email';
        }
      } else if (isPhone) {
        const q = query(membersRef, where('phone', '==', searchTerm));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          foundMember = { id: snapshot.docs[0].id, ...docData } as any;
          searchedByField = 'phone';
        }
      } else {
        const allMembers = await getDocs(membersRef);
        const searchWords = searchTerm.split(' ').filter(w => w.length > 0);
        
        allMembers.forEach(doc => {
          const data = doc.data();
          const fullName = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase();
          
          const matchesAll = searchWords.every(word => fullName.includes(word));
          
          if (matchesAll) {
            foundMember = { id: doc.id, ...data } as any;
            searchedByField = 'name';
            return;
          }
        });
      }

      if (foundMember) {
        setExistingMember(foundMember);
        
        const questions = generateVerificationQuestions(foundMember, searchedByField);
        
        if (questions.length >= 1) {
          setVerificationQuestions(questions);
          setStep('verify');
        } else {
          setFormData({
            firstName: foundMember.firstName || '',
            lastName: foundMember.lastName || '',
            dni: foundMember.dni || '',
            email: foundMember.email || '',
            phone: foundMember.phone || '',
            birthDate: foundMember.birthDate || '',
            address: foundMember.address || ''
          });
          setStep('form');
        }
        
        setLoading(false);
      } else {
        setExistingMember(null);
        
        if (isDNI) {
          setFormData(prev => ({ ...prev, dni: searchTerm }));
        } else if (isEmail) {
          setFormData(prev => ({ ...prev, email: searchTerm }));
        } else if (isPhone) {
          setFormData(prev => ({ ...prev, phone: searchTerm }));
        }
        
        setStep('form');
        setLoading(false);
      }

    } catch (err) {
      console.error('Error:', err);
      setError('Error al buscar. Intenta nuevamente.');
      setLoading(false);
    }
  };

  // PASO 2: Verificar (SOLO 1 CORRECTA)
  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!existingMember) return;

    let correctAnswers = 0;

    verificationQuestions.forEach(q => {
      const userAnswer = verificationAnswers[q.field]?.toLowerCase().trim();
      const correctAnswer = q.value.toLowerCase().trim();

      if (userAnswer === correctAnswer) {
        correctAnswers++;
      }
    });

    if (correctAnswers >= 1) {
      setFormData({
        firstName: existingMember.firstName || '',
        lastName: existingMember.lastName || '',
        dni: existingMember.dni || '',
        email: existingMember.email || '',
        phone: existingMember.phone || '',
        birthDate: existingMember.birthDate || '',
        address: existingMember.address || ''
      });
      setStep('form');
    } else {
      setError('Verificación fallida. Debes responder correctamente al menos 1 pregunta.');
    }
  };

  // PASO 3: Enviar
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.firstName.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('El apellido es obligatorio');
      return;
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Email inválido');
      return;
    }
    if (!formData.phone.trim()) {
      setError('El teléfono es obligatorio');
      return;
    }
    if (!formData.birthDate) {
      setError('La fecha de nacimiento es obligatoria');
      return;
    }
    if (!formData.address.trim()) {
      setError('La dirección es obligatoria');
      return;
    }

    setLoading(true);

    try {
      const registrationData: Omit<PendingRegistration, 'id'> = {
        gymId: gymId!,
        gymName: gymName,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      if (existingMember) {
        registrationData.isUpdate = true;
        registrationData.memberId = existingMember.id;
        registrationData.previousData = {
          firstName: existingMember.firstName || '',
          lastName: existingMember.lastName || '',
          email: existingMember.email || '',
          phone: existingMember.phone || '',
          address: existingMember.address || '',
          birthDate: existingMember.birthDate || ''
        };
        registrationData.newData = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          birthDate: formData.birthDate,
          address: formData.address.trim()
        };
      } else {
        registrationData.isUpdate = false;
        registrationData.firstName = formData.firstName.trim();
        registrationData.lastName = formData.lastName.trim();
        registrationData.dni = formData.dni.trim();
        registrationData.email = formData.email.trim().toLowerCase();
        registrationData.phone = formData.phone.trim();
        registrationData.birthDate = formData.birthDate;
        registrationData.address = formData.address.trim();
      }

      await addDoc(collection(db, 'pendingRegistrations'), registrationData);

      setStep('success');
      setLoading(false);

    } catch (err) {
      console.error('Error:', err);
      setError('Error al enviar. Intenta nuevamente.');
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // PANTALLA: Éxito
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {existingMember ? '¡Actualización Enviada!' : '¡Registro Enviado!'}
          </h2>
          <p className="text-gray-600 mb-4">
            Tu solicitud ha sido enviada a <strong>{gymName}</strong>
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              📧 {existingMember 
                ? 'El gimnasio revisará tus cambios y los aplicará pronto.'
                : 'Te contactaremos cuando tu registro sea aprobado.'}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {existingMember ? 'Hacer otra actualización' : 'Enviar otro registro'}
          </button>
        </div>
      </div>
    );
  }

  // PANTALLA: Verificación
  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-8 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-6">
              <div className="h-16 w-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-purple-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">
                Verificación de Identidad
              </h1>
              <p className="text-gray-600 mt-2">
                Encontramos tu cuenta
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800">
                ✅ <strong>{existingMember?.firstName} {existingMember?.lastName}</strong>
              </p>
              <p className="text-xs text-green-600 mt-1">
                Por seguridad, verifica tu identidad respondiendo al menos 1 pregunta
              </p>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleVerify}>
              <div className="space-y-4 mb-6">
                {verificationQuestions.map((q, index) => (
                  <div key={q.field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {index + 1}. {q.label}
                    </label>
                    {q.hint && (
                      <p className="text-xs text-gray-500 mb-2">
                        Pista: {q.hint}
                      </p>
                    )}
                    {q.type === 'date' ? (
                      <input
                        type="date"
                        value={verificationAnswers[q.field] || ''}
                        onChange={(e) => setVerificationAnswers(prev => ({
                          ...prev,
                          [q.field]: e.target.value
                        }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    ) : (
                      <input
                        type="text"
                        value={verificationAnswers[q.field] || ''}
                        onChange={(e) => setVerificationAnswers(prev => ({
                          ...prev,
                          [q.field]: e.target.value
                        }))}
                        maxLength={q.mask?.length || undefined}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder={q.mask ? q.mask.replace(/#/g, '•') : ''}
                        required
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <p className="text-xs text-blue-800">
                  🔒 Debes responder correctamente al menos 1 pregunta para continuar
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Verificar
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('identify');
                  setExistingMember(null);
                  setVerificationQuestions([]);
                  setVerificationAnswers({});
                  setIdentifier('');
                  setError('');
                }}
                className="w-full mt-3 text-gray-600 py-2 hover:text-gray-800"
              >
                Volver a buscar
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // PANTALLA: Identificación
  if (step === 'identify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-6">
              <Home className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-gray-800">
                {gymName || 'Cargando...'}
              </h1>
              <p className="text-gray-600 mt-2">
                Registro de Socios
              </p>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleIdentify}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar Socio
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Pérez, DNI, Email o Teléfono"
                  required
                />
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-gray-600 font-medium">Puedes buscar por:</p>
                  <p className="text-xs text-gray-500">• <strong>Nombre y Apellido:</strong> Juan Pérez</p>
                  <p className="text-xs text-gray-500">• <strong>DNI:</strong> 12345678 (7 u 8 dígitos)</p>
                  <p className="text-xs text-gray-500">• <strong>Email:</strong> juan@ejemplo.com</p>
                  <p className="text-xs text-gray-500">• <strong>Teléfono:</strong> 2612345678 (10 dígitos)</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin h-5 w-5 mr-2" />
                    Buscando...
                  </>
                ) : (
                  'Buscar'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // PANTALLA: Formulario
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="mb-6">
            {existingMember && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-green-800">
                  ✅ <strong>Encontramos tu cuenta</strong>
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Puedes modificar los campos que necesites actualizar
                </p>
              </div>
            )}
            
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {existingMember ? 'Actualizar Mis Datos' : 'Registro de Nuevo Socio'}
            </h1>
            <p className="text-gray-600">
              Completa todos los campos obligatorios
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellido *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DNI {!existingMember && <span className="text-gray-400 text-xs">(opcional)</span>}
                </label>
                <input
                  type="text"
                  name="dni"
                  value={formData.dni}
                  onChange={handleChange}
                  maxLength={8}
                  disabled={existingMember !== null}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Nacimiento *
                </label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('identify');
                  setExistingMember(null);
                  setIdentifier('');
                  setFormData({
                    firstName: '',
                    lastName: '',
                    dni: '',
                    email: '',
                    phone: '',
                    birthDate: '',
                    address: ''
                  });
                }}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                Volver
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin h-5 w-5 mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    {existingMember ? 'Enviar Actualización' : 'Enviar Registro'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UnifiedRegistration;