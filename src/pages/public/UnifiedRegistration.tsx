// src/pages/public/UnifiedRegistration.tsx
// 📋 FORMULARIO UNIFICADO COMPLETO
// ✅ Búsqueda por nombre, DNI, email o teléfono
// ✅ Sistema de verificación
// ✅ Foto, contacto emergencia y cuestionario de salud

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  User, CheckCircle, AlertCircle, Loader, Home, Camera, UserPlus, Heart
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

import { db,  } from '../../config/firebase';

import { uploadToCloudinary } from '../../utils/cloudinary.utils';

// Interfaz para los datos del socio
interface MemberData {
  id: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  photo?: string | null; // ✅ CAMBIO
  
  // ✅ TODOS estos campos ahora aceptan null
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  hasExercisedBefore?: 'yes' | 'no' | null;
  fitnessGoal?: string[] | null;
  fitnessGoalOther?: string | null;
  medicalConditions?: string | null;
  injuries?: string | null;
  allergies?: string | null;
  hasMedicalCertificate?: 'yes' | 'no' | null;
  
  [key: string]: any;
}

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
  photoURL?: string | null; // ✅ CAMBIO
  
  // ✅ TODOS estos campos ahora aceptan null
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  hasExercisedBefore?: 'yes' | 'no' | null;
  fitnessGoal?: string[] | null;
  fitnessGoalOther?: string | null;
  medicalConditions?: string | null;
  injuries?: string | null;
  allergies?: string | null;
  hasMedicalCertificate?: 'yes' | 'no' | null;
  
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
  const [existingMember, setExistingMember] = useState<MemberData | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  
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
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    hasExercisedBefore: '' as 'yes' | 'no' | '',
    fitnessGoal: [] as string[], // ✅ Array vacío por defecto
    fitnessGoalOther: '',
    medicalConditions: '',
    injuries: '',
    allergies: '',
    hasMedicalCertificate: '' as 'yes' | 'no' | ''
  });

  // Cargar nombre del gym al inicio
  useEffect(() => {
    const loadGym = async () => {
      if (!gymId) return;
      
      try {
        const gymRef = doc(db, 'gyms', gymId);
        const gymSnap = await getDoc(gymRef);
        
        if (gymSnap.exists()) {
          setGymName(gymSnap.data().name || 'Gimnasio');
        }
      } catch (error) {
        console.error('Error cargando gym:', error);
      }
    };
    
    loadGym();
  }, [gymId]);

  // Manejar carga de foto
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('La foto no puede superar los 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setError('Solo se permiten imágenes');
        return;
      }
      
      setPhotoFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Generar preguntas de verificación
  const generateVerificationQuestions = (member: any, searchedByField: string): Array<any> => {
    const questions: Array<any> = [];
    const usedFields = [searchedByField];
    
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

      const searchTerm = identifier.trim();
      const membersRef = collection(db, `gyms/${gymId}/members`);
      
      // Determinar tipo de búsqueda
      const isDNI = /^\d{7,8}$/.test(searchTerm);
      const isEmail = /\S+@\S+\.\S+/.test(searchTerm);
      const isPhone = /^\d{10}$/.test(searchTerm);
      const isName = !isDNI && !isEmail && !isPhone && searchTerm.includes(' ');
      
      let foundMember: MemberData | null = null;
      let searchedByField = '';

      // Búsqueda por DNI
      if (isDNI) {
        const q = query(membersRef, where('dni', '==', searchTerm));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          foundMember = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as MemberData;
          searchedByField = 'dni';
        }
      }
      
      // Búsqueda por Email
      if (!foundMember && isEmail) {
        const q = query(membersRef, where('email', '==', searchTerm.toLowerCase()));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          foundMember = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as MemberData;
          searchedByField = 'email';
        }
      }
      
      // Búsqueda por Teléfono
      if (!foundMember && isPhone) {
        const q = query(membersRef, where('phone', '==', searchTerm));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          foundMember = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as MemberData;
          searchedByField = 'phone';
        }
      }
      
      // Búsqueda por Nombre completo
      if (!foundMember && isName) {
        const [firstName, ...lastNameParts] = searchTerm.split(' ');
        const lastName = lastNameParts.join(' ');
        
        const allMembers = await getDocs(membersRef);
        const matchingMember = allMembers.docs.find(doc => {
          const data = doc.data();
          const fullName = `${data.firstName} ${data.lastName}`.toLowerCase();
          return fullName === searchTerm.toLowerCase();
        });
        
        if (matchingMember) {
          foundMember = { id: matchingMember.id, ...matchingMember.data() } as MemberData;
          searchedByField = 'name';
        }
      }

      if (foundMember) {
        setExistingMember(foundMember);
        
        const questions = generateVerificationQuestions(foundMember, searchedByField);
        
        if (questions.length >= 1) {
          setVerificationQuestions(questions);
          setStep('verify');
        } else {
          // Si no hay preguntas suficientes, ir directo al form
          setFormData({
            firstName: foundMember.firstName || '',
            lastName: foundMember.lastName || '',
            dni: foundMember.dni || '',
            email: foundMember.email || '',
            phone: foundMember.phone || '',
            birthDate: foundMember.birthDate || '',
            address: foundMember.address || '',
            emergencyContactName: foundMember.emergencyContactName || '',
            emergencyContactPhone: foundMember.emergencyContactPhone || '',
            hasExercisedBefore: foundMember.hasExercisedBefore || '',
            fitnessGoal: (Array.isArray(foundMember.fitnessGoal) ? foundMember.fitnessGoal : (foundMember.fitnessGoal ? [foundMember.fitnessGoal as string] : [])) as string[],
            fitnessGoalOther: foundMember.fitnessGoalOther || '',
            medicalConditions: foundMember.medicalConditions || '',
            injuries: foundMember.injuries || '',
            allergies: foundMember.allergies || '',
            hasMedicalCertificate: foundMember.hasMedicalCertificate || ''
          });
          
          if (foundMember.photo) {
            setPhotoPreview(foundMember.photo);
          }
          
          setStep('form');
        }
        
        setLoading(false);
      } else {
        // No se encontró, crear nuevo
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

  // PASO 2: Verificar
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
        address: existingMember.address || '',
        emergencyContactName: existingMember.emergencyContactName || '',
        emergencyContactPhone: existingMember.emergencyContactPhone || '',
        hasExercisedBefore: existingMember.hasExercisedBefore || '',
        fitnessGoal: Array.isArray(existingMember.fitnessGoal) ? existingMember.fitnessGoal : [],
        fitnessGoalOther: existingMember.fitnessGoalOther || '',
        medicalConditions: existingMember.medicalConditions || '',
        injuries: existingMember.injuries || '',
        allergies: existingMember.allergies || '',
        hasMedicalCertificate: existingMember.hasMedicalCertificate || ''
      });
      
      if (existingMember.photo) {
        setPhotoPreview(existingMember.photo);
      }
      
      setStep('form');
    } else {
      setError('Verificación fallida. Debes responder correctamente al menos 1 pregunta.');
    }
  };

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Manejar checkboxes para fitnessGoal (múltiples objetivos)
    if (name === 'fitnessGoal' && type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        fitnessGoal: checked
          ? [...prev.fitnessGoal, value]
          : prev.fitnessGoal.filter(goal => goal !== value)
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

// ✅ Subir foto a Cloudinary
const uploadPhoto = async (): Promise<string | null> => {
  if (!photoFile || !gymId) return null;

  try {
    console.log('📸 Subiendo foto a Cloudinary...');
    const photoURL = await uploadToCloudinary(photoFile, `gym_${gymId}_members`);
    console.log('✅ Foto subida:', photoURL);
    return photoURL;
  } catch (error) {
    console.error('❌ Error uploading photo:', error);
    return null;
  }
};

  // PASO 3: Enviar formulario
 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  try {
    // Subir foto si existe
    let photoURL: string | null = null;
    if (photoFile) {
      const uploadedURL = await uploadPhoto();
      if (uploadedURL) {
        photoURL = uploadedURL;
      }
    }

    const registrationData: Omit<PendingRegistration, 'id'> = {
      gymId: gymId!,
      gymName: gymName,
      status: 'pending',
      createdAt: serverTimestamp()
    };

    if (existingMember) {
      // 🔧 ACTUALIZACIÓN: usar null en lugar de undefined
      registrationData.isUpdate = true;
      registrationData.memberId = existingMember.id;
      registrationData.previousData = existingMember;
      registrationData.newData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        birthDate: formData.birthDate,
        address: formData.address.trim(),
        // ✅ CAMBIAR || undefined POR || null
        photoURL: photoURL || null,
        emergencyContactName: formData.emergencyContactName.trim() || null,
        emergencyContactPhone: formData.emergencyContactPhone.trim() || null,
        hasExercisedBefore: formData.hasExercisedBefore || null,
        fitnessGoal: formData.fitnessGoal && formData.fitnessGoal.length > 0 ? formData.fitnessGoal : null,
        fitnessGoalOther: formData.fitnessGoalOther.trim() || null,
        medicalConditions: formData.medicalConditions.trim() || null,
        injuries: formData.injuries.trim() || null,
        allergies: formData.allergies.trim() || null,
        hasMedicalCertificate: formData.hasMedicalCertificate || null
      };
    } else {
      // 🔧 NUEVO REGISTRO: usar null en lugar de undefined
      registrationData.isUpdate = false;
      registrationData.firstName = formData.firstName.trim();
      registrationData.lastName = formData.lastName.trim();
      registrationData.dni = formData.dni.trim();
      registrationData.email = formData.email.trim().toLowerCase();
      registrationData.phone = formData.phone.trim();
      registrationData.birthDate = formData.birthDate;
      registrationData.address = formData.address.trim();
      // ✅ CAMBIAR || undefined POR || null
      registrationData.photoURL = photoURL || null;
      registrationData.emergencyContactName = formData.emergencyContactName.trim() || null;
      registrationData.emergencyContactPhone = formData.emergencyContactPhone.trim() || null;
      registrationData.hasExercisedBefore = formData.hasExercisedBefore || null;
      registrationData.fitnessGoal = formData.fitnessGoal && formData.fitnessGoal.length > 0 ? formData.fitnessGoal : null;
      registrationData.fitnessGoalOther = formData.fitnessGoalOther.trim() || null;
      registrationData.medicalConditions = formData.medicalConditions.trim() || null;
      registrationData.injuries = formData.injuries.trim() || null;
      registrationData.allergies = formData.allergies.trim() || null;
      registrationData.hasMedicalCertificate = formData.hasMedicalCertificate || null;
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

  // PANTALLA: Éxito
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {existingMember ? '¡Actualización Enviada!' : '¡Registro Enviado!'}
          </h2>
          <p className="text-gray-600 mb-6">
            {existingMember 
              ? 'Tu solicitud de actualización está siendo revisada.'
              : 'Tu solicitud está siendo revisada. Te contactaremos pronto.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Home className="h-5 w-5 mr-2" />
            {existingMember ? 'Hacer otra actualización' : 'Enviar otro registro'}
          </button>
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
                <span className="text-sm">{error}</span>
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
                        onChange={(e) => setVerificationAnswers(prev => ({
                          ...prev,
                          [q.field]: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    ) : (
                      <input
                        type="text"
                        maxLength={q.mask?.length}
                        onChange={(e) => setVerificationAnswers(prev => ({
                          ...prev,
                          [q.field]: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder={q.hint || 'Ingresa tu respuesta'}
                        required
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('identify');
                    setError('');
                    setVerificationAnswers({});
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700"
                >
                  Verificar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // PANTALLA: Formulario completo
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
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
              Completa todos los campos obligatorios (*)
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* SECCIÓN: FOTO */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Camera className="h-5 w-5 mr-2 text-blue-600" />
                Foto del Socio
              </h3>
              <div className="flex items-center space-x-6">
                {photoPreview && (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                      <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-1">
                        {photoPreview ? 'Cambiar foto' : 'Subir foto'}
                      </p>
                      <p className="text-xs text-gray-500">
                        JPG, PNG o GIF (máx. 5MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* SECCIÓN: DATOS PERSONALES */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Datos Personales
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* SECCIÓN: CONTACTO DE EMERGENCIA */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <UserPlus className="h-5 w-5 mr-2 text-red-600" />
                Contacto de Emergencia
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Contacto
                  </label>
                  <input
                    type="text"
                    name="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: María González"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Celular del Contacto
                  </label>
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 261 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN: CUESTIONARIO DE SALUD Y FITNESS */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Heart className="h-5 w-5 mr-2 text-pink-600" />
                Información de Salud y Fitness
              </h3>
              
              <div className="space-y-6">
                {/* Pregunta 1 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Practicaste ejercicio con regularidad antes?
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="hasExercisedBefore"
                        value="yes"
                        checked={formData.hasExercisedBefore === 'yes'}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      <span className="text-gray-700">Sí</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="hasExercisedBefore"
                        value="no"
                        checked={formData.hasExercisedBefore === 'no'}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      <span className="text-gray-700">No</span>
                    </label>
                  </div>
                </div>

                {/* Pregunta 2 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Cuál es tu objetivo principal? (puedes elegir varios)
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="fitnessGoal"
                        value="lose_weight"
                        checked={formData.fitnessGoal.includes('lose_weight')}
                        onChange={handleChange}
                        className="mr-2 h-4 w-4 text-blue-600"
                      />
                      <span className="text-gray-700">Bajar de peso</span>
                    </label>
                    
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="fitnessGoal"
                        value="gain_muscle"
                        checked={formData.fitnessGoal.includes('gain_muscle')}
                        onChange={handleChange}
                        className="mr-2 h-4 w-4 text-blue-600"
                      />
                      <span className="text-gray-700">Ganar masa muscular</span>
                    </label>
                    
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="fitnessGoal"
                        value="cardiovascular"
                        checked={formData.fitnessGoal.includes('cardiovascular')}
                        onChange={handleChange}
                        className="mr-2 h-4 w-4 text-blue-600"
                      />
                      <span className="text-gray-700">Mejorar salud cardiovascular</span>
                    </label>
                    
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="fitnessGoal"
                        value="flexibility"
                        checked={formData.fitnessGoal.includes('flexibility')}
                        onChange={handleChange}
                        className="mr-2 h-4 w-4 text-blue-600"
                      />
                      <span className="text-gray-700">Mejorar flexibilidad</span>
                    </label>
                    
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="fitnessGoal"
                        value="general_health"
                        checked={formData.fitnessGoal.includes('general_health')}
                        onChange={handleChange}
                        className="mr-2 h-4 w-4 text-blue-600"
                      />
                      <span className="text-gray-700">Salud general y bienestar</span>
                    </label>
                    
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="fitnessGoal"
                        value="other"
                        checked={formData.fitnessGoal.includes('other')}
                        onChange={handleChange}
                        className="mr-2 h-4 w-4 text-blue-600"
                      />
                      <span className="text-gray-700">Otro</span>
                    </label>
                  </div>
                  
                  {formData.fitnessGoal.includes('other') && (
                    <input
                      type="text"
                      name="fitnessGoalOther"
                      value={formData.fitnessGoalOther}
                      onChange={handleChange}
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Especifica tu objetivo..."
                    />
                  )}
                </div>

                {/* Pregunta 3 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Padeces alguna enfermedad o condición médica?
                  </label>
                  <textarea
                    name="medicalConditions"
                    value={formData.medicalConditions}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: presión arterial alta, diabetes, problemas cardíacos, etc."
                  />
                </div>

                {/* Pregunta 4 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Tienes alguna lesión o limitación física?
                  </label>
                  <textarea
                    name="injuries"
                    value={formData.injuries}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: problemas de espalda, rodilla, etc."
                  />
                </div>

                {/* Pregunta 5 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Tienes alguna alergia que debamos conocer?
                  </label>
                  <textarea
                    name="allergies"
                    value={formData.allergies}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: medicamentos, alimentos, etc."
                  />
                </div>

                {/* Pregunta 6 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Tienes un certificado médico que acredite tu aptitud física?
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="hasMedicalCertificate"
                        value="yes"
                        checked={formData.hasMedicalCertificate === 'yes'}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      <span className="text-gray-700">Sí</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="hasMedicalCertificate"
                        value="no"
                        checked={formData.hasMedicalCertificate === 'no'}
                        onChange={handleChange}
                        className="mr-2"
                      />
                      <span className="text-gray-700">No</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('identify');
                  setExistingMember(null);
                  setIdentifier('');
                  setPhotoFile(null);
                  setPhotoPreview('');
                  setFormData({
                    firstName: '',
                    lastName: '',
                    dni: '',
                    email: '',
                    phone: '',
                    birthDate: '',
                    address: '',
                    emergencyContactName: '',
                    emergencyContactPhone: '',
                    hasExercisedBefore: '',
                    fitnessGoal: [],
                    fitnessGoalOther: '',
                    medicalConditions: '',
                    injuries: '',
                    allergies: '',
                    hasMedicalCertificate: ''
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