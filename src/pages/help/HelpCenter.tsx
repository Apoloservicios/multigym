import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronRight,
  Calendar, 
  CreditCard, 
  Users, 
  DollarSign,
  Clock,
  XCircle,
  CheckCircle,
  Search,
  Book,
  MessageCircle,
  AlertCircle
} from 'lucide-react';

export default function HelpCenter() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('pagos');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const sections = [
    {
      id: 'pagos',
      title: 'Sistema de Pagos Mensuales',
      icon: CreditCard,
      color: 'blue',
      faqs: [
        {
          id: 'como-funciona',
          question: '¿Cómo funciona el sistema de pagos mensuales?',
          answer: (
            <div className="space-y-4">
              <p className="text-gray-700">
                El sistema de pagos mensuales es <strong>automático y permanente</strong>. 
                Cuando asignás una actividad a un socio, se crea una membresía permanente 
                que genera pagos automáticamente cada mes.
              </p>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="font-semibold text-blue-900 mb-2">🔑 Conceptos clave:</p>
                <ul className="text-sm text-blue-800 space-y-1 ml-4">
                  <li>• <strong>Membresía:</strong> Relación permanente socio-actividad</li>
                  <li>• <strong>Pago mensual:</strong> Cargo generado cada mes</li>
                  <li>• <strong>Sin vencimiento:</strong> La membresía no se vence, solo el pago</li>
                </ul>
              </div>
            </div>
          )
        },
        {
          id: 'cuando-genera',
          question: '¿Cuándo se generan los pagos automáticamente?',
          answer: (
            <div className="space-y-4">
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <p className="font-semibold text-green-900 mb-2">📅 El día 1 de cada mes</p>
                <p className="text-sm text-green-800">
                  Cuando un administrador abre la aplicación, se generan automáticamente 
                  los pagos para TODAS las membresías activas del gimnasio.
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-800 mb-3">Ejemplo del 1 de Noviembre:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Juan - Musculación → Se crea pago Nov: $20,000</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>María - Pilates → Se crea pago Nov: $24,000</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>Pedro - Yoga (suspendida) → NO se crea pago</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> La generación se ejecuta automáticamente UNA SOLA VEZ por mes.
                </p>
              </div>
            </div>
          )
        },
        {
          id: 'alta-antes-15',
          question: 'Doy de alta un socio ANTES del día 15, ¿cuándo paga?',
          answer: (
            <div className="space-y-4">
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <p className="font-semibold text-green-900 mb-2">✅ Paga el mes actual</p>
                <p className="text-sm text-green-800">
                  Si asignás una membresía entre el día 1 y el 15, se crea automáticamente 
                  el pago del mes actual que vence el día 15.
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-800 mb-3">Ejemplo:</p>
                <div className="space-y-3">
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Fecha: <strong>7 de Octubre 2025</strong></p>
                    <p className="text-sm text-gray-600">Acción: Asignar Musculación a Carlos</p>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white">↓</span>
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Se crea:</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Pago: Octubre 2025</li>
                      <li>• Monto: $20,000</li>
                      <li>• Vence: 15/10/2025</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          id: 'alta-despues-15',
          question: 'Doy de alta un socio DESPUÉS del día 15, ¿cuándo paga?',
          answer: (
            <div className="space-y-4">
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                <p className="font-semibold text-orange-900 mb-2">⏰ Paga el mes SIGUIENTE</p>
                <p className="text-sm text-orange-800">
                  Si asignás una membresía después del día 15, se crea el pago del mes 
                  siguiente (no del mes actual que ya venció).
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-800 mb-3">Ejemplo:</p>
                <div className="space-y-3">
                  <div className="bg-blue-50 p-3 rounded">
                    <p className="text-sm text-gray-600">Fecha: <strong>20 de Octubre 2025</strong></p>
                    <p className="text-sm text-gray-600">Acción: Asignar Pilates a Ana</p>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white">↓</span>
                    </div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Se crea:</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Pago: Noviembre 2025</li>
                      <li>• Monto: $24,000</li>
                      <li>• Vence: 15/11/2025</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-300 rounded p-3">
                <p className="text-sm text-blue-800">
                  <strong>¿Por qué?</strong> Porque el plazo de pago del mes actual (día 15) 
                  ya pasó. Sería injusto cobrar un mes completo cuando solo quedan pocos días.
                </p>
              </div>
            </div>
          )
        },
        {
          id: 'vencimiento',
          question: '¿Cuándo vencen los pagos?',
          answer: (
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="font-semibold text-blue-900 mb-2">📅 Siempre el día 15</p>
                <p className="text-sm text-blue-800">
                  Todos los pagos mensuales vencen el día 15 del mes correspondiente, 
                  sin excepciones.
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-800 mb-3">Estados del pago:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-2 bg-yellow-50 rounded">
                    <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Pendiente (pending)</p>
                      <p className="text-xs text-gray-600">Del día 1 al 15: esperando pago</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 bg-red-50 rounded">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Vencido (overdue)</p>
                      <p className="text-xs text-gray-600">Después del día 15: pago atrasado</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 bg-green-50 rounded">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Pagado (paid)</p>
                      <p className="text-xs text-gray-600">Cuando registrás el cobro</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'membresias',
      title: 'Membresías',
      icon: Users,
      color: 'purple',
      faqs: [
        {
          id: 'que-es-membresia',
          question: '¿Qué es una membresía?',
          answer: (
            <div className="space-y-4">
              <p className="text-gray-700">
                Una membresía es la <strong>relación permanente</strong> entre un socio 
                y una actividad del gimnasio. No tiene fecha de vencimiento.
              </p>

              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                <p className="font-semibold text-purple-900 mb-2">🎯 Características:</p>
                <ul className="text-sm text-purple-800 space-y-1 ml-4">
                  <li>• Es permanente (no se vence)</li>
                  <li>• Solo puede estar activa o suspendida</li>
                  <li>• Genera pagos mensuales automáticamente</li>
                  <li>• Se mantiene hasta que la suspendas</li>
                </ul>
              </div>
            </div>
          )
        },
        {
          id: 'suspender-membresia',
          question: '¿Qué pasa cuando suspendo una membresía?',
          answer: (
            <div className="space-y-4">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="font-semibold text-red-900 mb-2">⏸️ Efectos de suspender:</p>
                <ul className="text-sm text-red-800 space-y-1 ml-4">
                  <li>• El sistema DEJA de generar pagos futuros</li>
                  <li>• Los pagos anteriores NO se eliminan</li>
                  <li>• El socio mantiene su deuda (si la tenía)</li>
                  <li>• La membresía queda inactiva</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Importante:</strong> Suspender NO devuelve dinero. Los pagos ya 
                  generados quedan como deuda.
                </p>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'cobros',
      title: 'Cobros y Pagos',
      icon: DollarSign,
      color: 'green',
      faqs: [
        {
          id: 'registrar-pago',
          question: '¿Cómo registro un pago de un socio?',
          answer: (
            <div className="space-y-4">
              <p className="text-gray-700">
                Hay dos formas de registrar el pago de un socio:
              </p>

              <div className="space-y-3">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="font-semibold text-blue-900 mb-2">📍 Opción 1: Desde "Pagos Mensuales"</p>
                  <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                    <li>Ir a la sección "Pagos Mensuales"</li>
                    <li>Buscar al socio en la lista de pendientes</li>
                    <li>Hacer clic en "Registrar pago"</li>
                    <li>Seleccionar método de pago</li>
                    <li>Confirmar</li>
                  </ol>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="font-semibold text-purple-900 mb-2">📍 Opción 2: Desde la ficha del socio</p>
                  <ol className="text-sm text-purple-800 space-y-1 ml-4 list-decimal">
                    <li>Abrir la ficha del socio</li>
                    <li>Ir a la pestaña "Cuenta"</li>
                    <li>Ver los pagos pendientes</li>
                    <li>Registrar el pago</li>
                  </ol>
                </div>
              </div>
            </div>
          )
        }
      ]
    }
  ];

  const filteredSections = sections.map(section => ({
    ...section,
    faqs: section.faqs.filter(faq =>
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(section => section.faqs.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Centro de Ayuda</h1>
              <p className="text-gray-600">Preguntas frecuentes sobre MultiGym</p>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative mt-6">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar en la ayuda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Secciones */}
        {filteredSections.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron resultados para "{searchTerm}"</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSections.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSection === section.id;
              
              return (
                <div key={section.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  {/* Header de Sección */}
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                    className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        section.color === 'blue' ? 'bg-blue-100' :
                        section.color === 'purple' ? 'bg-purple-100' :
                        'bg-green-100'
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          section.color === 'blue' ? 'text-blue-600' :
                          section.color === 'purple' ? 'text-purple-600' :
                          'text-green-600'
                        }`} />
                      </div>
                      <div className="text-left">
                        <h2 className="text-xl font-bold text-gray-800">{section.title}</h2>
                        <p className="text-sm text-gray-500">{section.faqs.length} preguntas</p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-6 h-6 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-6 h-6 text-gray-400" />
                    )}
                  </button>

                  {/* FAQs */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      {section.faqs.map((faq, index) => {
                        const isFaqExpanded = expandedFaq === faq.id;
                        
                        return (
                          <div
                            key={faq.id}
                            className={`border-b border-gray-100 last:border-b-0 ${
                              index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                            }`}
                          >
                            <button
                              onClick={() => setExpandedFaq(isFaqExpanded ? null : faq.id)}
                              className="w-full p-6 flex items-start justify-between hover:bg-gray-100 transition-colors text-left"
                            >
                              <div className="flex items-start gap-3 flex-1">
                                <Book className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                <p className="font-semibold text-gray-800">{faq.question}</p>
                              </div>
                              {isFaqExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-3" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-3" />
                              )}
                            </button>

                            {isFaqExpanded && (
                              <div className="px-6 pb-6 pl-14">
                                {faq.answer}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-white text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3" />
          <h3 className="text-2xl font-bold mb-2">¿No encontraste lo que buscabas?</h3>
          <p className="mb-4 opacity-90">
            Contactá a soporte técnico para obtener ayuda personalizada
          </p>
          <button className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            Contactar Soporte
          </button>
        </div>
      </div>
    </div>
  );
}