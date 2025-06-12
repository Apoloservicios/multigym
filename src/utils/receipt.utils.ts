// src/utils/receipt.utils.ts - MEJORADO CON DETALLES DE MEMBRESÍAS

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Transaction } from '../types/gym.types';
import { MembershipAssignment } from '../types/member.types';
import { formatDisplayDate, formatDisplayDateTime } from './date.utils';

/**
 * Generar PDF del comprobante con detalles de membresías
 */
export const generateReceiptPDF = async (
  transaction: Transaction,
  memberName: string,
  memberships: MembershipAssignment[] = [],
  gymName: string = 'MultiGym'
): Promise<void> => {
  try {
    // Crear nuevo documento PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Configurar fuentes
    pdf.setFont('helvetica');
    
    // Header - Logo y nombre del gimnasio
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(gymName, pageWidth / 2, 30, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Sistema de Gestión de Gimnasios', pageWidth / 2, 40, { align: 'center' });
    
    // Línea separadora
    pdf.setLineWidth(0.5);
    pdf.line(20, 50, pageWidth - 20, 50);
    
    // Título del comprobante
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('COMPROBANTE DE PAGO', pageWidth / 2, 65, { align: 'center' });
    
    // Información de la transacción
    let yPosition = 85;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    // ID de transacción
    pdf.text(`Nº Transacción: ${transaction.id?.slice(-8) || 'N/A'}`, 20, yPosition);
    yPosition += 10;
    
    // Fecha
    pdf.text(`Fecha: ${formatDisplayDateTime(transaction.date)}`, 20, yPosition);
    yPosition += 10;
    
    // Socio
    pdf.text(`Socio: ${memberName}`, 20, yPosition);
    yPosition += 10;
    
    // Método de pago
    pdf.text(`Método: ${formatPaymentMethod(transaction.paymentMethod || '')}`, 20, yPosition);
    yPosition += 20;
    
    // 🔧 NUEVA SECCIÓN: Detalle de servicios pagados
    if (memberships.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('SERVICIOS PAGADOS:', 20, yPosition);
      yPosition += 10;
      
      // Línea separadora
      pdf.setLineWidth(0.3);
      pdf.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      memberships.forEach(membership => {
        // Nombre del servicio
        pdf.text(membership.activityName, 25, yPosition);
        
        // Precio alineado a la derecha
        const priceText = `$${(membership.cost || 0).toLocaleString('es-AR')}`;
        pdf.text(priceText, pageWidth - 60, yPosition, { align: 'right' });
        
        yPosition += 8;
        
        // Si hay fechas de vigencia, agregarlas
        if (membership.startDate && membership.endDate) {
          // Manejar tanto objetos Timestamp como strings/dates
          let startDate: Date;
          let endDate: Date;
          
          try {
            startDate = (membership.startDate as any)?.toDate ? (membership.startDate as any).toDate() : new Date(membership.startDate as any);
            endDate = (membership.endDate as any)?.toDate ? (membership.endDate as any).toDate() : new Date(membership.endDate as any);
          } catch {
            startDate = new Date(membership.startDate as any);
            endDate = new Date(membership.endDate as any);
          }
          
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'italic');
          pdf.text(`   Vigencia: ${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`, 25, yPosition);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          yPosition += 6;
        }
        
        yPosition += 3;
      });
      
      // Línea separadora antes del total
      pdf.setLineWidth(0.3);
      pdf.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 10;
    } else {
      // 🔧 Si no hay membresías, extraer información de la descripción
      const extractedMemberships = extractMembershipsFromDescription(transaction.description || '');
      
      if (extractedMemberships.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SERVICIOS PAGADOS:', 20, yPosition);
        yPosition += 10;
        
        // Línea separadora
        pdf.setLineWidth(0.3);
        pdf.line(20, yPosition, pageWidth - 20, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        extractedMemberships.forEach(membership => {
          pdf.text(membership.name, 25, yPosition);
          const priceText = `$${membership.amount.toLocaleString('es-AR')}`;
          pdf.text(priceText, pageWidth - 60, yPosition, { align: 'right' });
          yPosition += 8;
        });
        
        // Línea separadora antes del total
        pdf.setLineWidth(0.3);
        pdf.line(20, yPosition, pageWidth - 20, yPosition);
        yPosition += 10;
      }
    }
    
    // Total pagado
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TOTAL PAGADO:', 20, yPosition);
    pdf.text(`$${transaction.amount.toLocaleString('es-AR')}`, pageWidth - 60, yPosition, { align: 'right' });
    yPosition += 20;
    
    // Estado del pago
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('✓ PAGO COMPLETADO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
    
    // Observaciones
    if (transaction.notes) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Observaciones:', 20, yPosition);
      yPosition += 8;
      
      pdf.setFont('helvetica', 'normal');
      const notesLines = pdf.splitTextToSize(transaction.notes, pageWidth - 40);
      pdf.text(notesLines, 20, yPosition);
      yPosition += notesLines.length * 5 + 10;
    }
    
    // Footer
    yPosition = pageHeight - 40;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Este comprobante es válido como constancia de pago', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    pdf.text('Generado automáticamente por MultiGym', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    pdf.text(`Generado el: ${formatDisplayDateTime(new Date())}`, pageWidth / 2, yPosition, { align: 'center' });
    
    // Descargar PDF
    const fileName = `comprobante-${memberName.replace(/\s+/g, '-')}-${transaction.id?.slice(-8) || 'pago'}.pdf`;
    pdf.save(fileName);
    
  } catch (error) {
    console.error('Error generando PDF:', error);
    throw new Error('Error al generar el comprobante PDF');
  }
};

/**
 * 🔧 CORREGIDA: Extraer información de membresías de la descripción
 */
const extractMembershipsFromDescription = (description: string): { name: string; amount: number }[] => {
  const membershipsInfo: { name: string; amount: number }[] = [];
  
  if (description.includes('Pago membresías:')) {
    // Para múltiples membresías: "Pago membresías: Musculación (12/05/2025 - 11/06/2025) - $13.500, Spinning - $16.000"
    const detailMatch = description.match(/Pago membresías: (.+?) \| Total:/);
    if (detailMatch) {
      const details = detailMatch[1];
      const membershipMatches = details.split(', ').map(item => {
        // 🔧 CORREGIR REGEX: Permitir espacios opcionales después del $
        const match = item.match(/(.+?) - \$\s*([\d,.]+)/);
        if (match) {
          const name = match[1].trim();
          // 🔧 CORREGIR: Remover puntos de miles y convertir comas a puntos decimales
          const cleanAmount = match[2].replace(/\./g, '').replace(/,/g, '.');
          const amount = parseFloat(cleanAmount);
          return { name, amount };
        }
        return null;
      }).filter(Boolean);
      
      membershipsInfo.push(...membershipMatches as { name: string; amount: number }[]);
    }
  } else if (description.includes('Pago membresía')) {
    // Para una sola membresía: "Pago membresía Musculación (12/05/2025 - 11/06/2025) - $ 13.500"
    // 🔧 CORREGIR REGEX: Permitir espacios opcionales después del $
    const match = description.match(/Pago membresía (.+?) - \$\s*([\d,.]+)/);
    if (match) {
      const name = match[1].trim();
      // 🔧 CORREGIR: Remover puntos de miles y convertir comas a puntos decimales  
      const cleanAmount = match[2].replace(/\./g, '').replace(/,/g, '.');
      const amount = parseFloat(cleanAmount);
      membershipsInfo.push({ name, amount });
    }
  }
  
  return membershipsInfo;
};

/**
 * 🔧 MEJORADA: Generar enlace para WhatsApp con detalles de membresías
 */
export const generateWhatsAppLink = (
  transaction: Transaction,
  memberName: string,
  memberships: MembershipAssignment[] = [],
  gymName: string = 'MultiGym',
  phoneNumber?: string
): string => {
  // Crear mensaje del comprobante
  let message = `🧾 *COMPROBANTE DE PAGO* 🧾\n\n`;
  message += `🏋️ *${gymName}*\n`;
  message += `📅 Fecha: ${formatDisplayDateTime(transaction.date)}\n`;
  message += `👤 Socio: ${memberName}\n`;
  message += `🆔 Transacción: #${transaction.id?.slice(-8) || 'N/A'}\n\n`;
  
  // 🔧 MEJORADO: Detalle de servicios con más información
  if (memberships.length > 0) {
    message += `📋 *SERVICIOS PAGADOS:*\n`;
    memberships.forEach(membership => {
      message += `• ${membership.activityName}: $${(membership.cost || 0).toLocaleString('es-AR')}\n`;
      
      // Agregar fechas de vigencia si están disponibles
      if (membership.startDate && membership.endDate) {
        // Manejar tanto objetos Timestamp como strings/dates
        let startDate: Date;
        let endDate: Date;
        
        try {
          startDate = (membership.startDate as any)?.toDate ? (membership.startDate as any).toDate() : new Date(membership.startDate as any);
          endDate = (membership.endDate as any)?.toDate ? (membership.endDate as any).toDate() : new Date(membership.endDate as any);
        } catch {
          startDate = new Date(membership.startDate as any);
          endDate = new Date(membership.endDate as any);
        }
        message += `  ⏰ Vigencia: ${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}\n`;
      }
    });
    message += `\n`;
  } else {
    // 🔧 Si no hay membresías, extraer de la descripción
    const extractedMemberships = extractMembershipsFromDescription(transaction.description || '');
    
    if (extractedMemberships.length > 0) {
      message += `📋 *SERVICIOS PAGADOS:*\n`;
      extractedMemberships.forEach(membership => {
        message += `• ${membership.name}: $${membership.amount.toLocaleString('es-AR')}\n`;
      });
      message += `\n`;
    }
  }
  
  // Total
  message += `💰 *TOTAL PAGADO: $${transaction.amount.toLocaleString('es-AR')}*\n`;
  message += `💳 Método: ${formatPaymentMethod(transaction.paymentMethod || '')}\n`;
  message += `✅ Estado: COMPLETADO\n\n`;
  
  // Observaciones
  if (transaction.notes) {
    message += `📝 Observaciones: ${transaction.notes}\n\n`;
  }
  
  message += `✨ ¡Gracias por elegirnos!\n`;
  message += `📱 Generado automáticamente por MultiGym`;
  
  // Codificar mensaje para URL
  const encodedMessage = encodeURIComponent(message);
  
  // Crear enlace de WhatsApp
  if (phoneNumber) {
    return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
  } else {
    return `https://wa.me/?text=${encodedMessage}`;
  }
};

/**
 * Capturar elemento HTML como imagen y generar PDF
 */
export const generatePDFFromHTML = async (elementId: string, fileName: string): Promise<void> => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Elemento no encontrado');
    }
    
    // Generar canvas del elemento
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true
    });
    
    // Crear PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Agregar imagen al PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    
    // Descargar
    pdf.save(fileName);
    
  } catch (error) {
    console.error('Error generando PDF desde HTML:', error);
    throw new Error('Error al generar PDF del comprobante');
  }
};

/**
 * Funciones auxiliares
 */
const formatPaymentMethod = (method: string): string => {
  switch (method?.toLowerCase()) {
    case 'cash': return 'Efectivo';
    case 'transfer': return 'Transferencia Bancaria';
    case 'card': return 'Tarjeta de Débito/Crédito';
    default: return method || 'No especificado';
  }
};

/**
 * Validar número de teléfono para WhatsApp
 */
export const validateWhatsAppNumber = (phone: string): string | null => {
  if (!phone) return null;
  
  // Limpiar número (solo dígitos)
  const cleanNumber = phone.replace(/\D/g, '');
  
  // Validar longitud mínima
  if (cleanNumber.length < 10) return null;
  
  // Si no tiene código de país, agregar Argentina (+54)
  if (cleanNumber.length === 10) {
    return `54${cleanNumber}`;
  }
  
  // Si ya tiene código de país
  if (cleanNumber.startsWith('54') && cleanNumber.length === 12) {
    return cleanNumber;
  }
  
  return cleanNumber;
};

/**
 * Generar texto plano del comprobante para copiar
 */
export const generateReceiptText = (
  transaction: Transaction,
  memberName: string,
  memberships: MembershipAssignment[] = [],
  gymName: string = 'MultiGym'
): string => {
  let text = `===============================\n`;
  text += `    COMPROBANTE DE PAGO\n`;
  text += `===============================\n\n`;
  text += `${gymName}\n`;
  text += `Sistema de Gestión de Gimnasios\n\n`;
  text += `Fecha: ${formatDisplayDateTime(transaction.date)}\n`;
  text += `Socio: ${memberName}\n`;
  text += `Transacción: #${transaction.id?.slice(-8) || 'N/A'}\n`;
  text += `Método: ${formatPaymentMethod(transaction.paymentMethod || '')}\n\n`;
  
  if (memberships.length > 0) {
    text += `SERVICIOS PAGADOS:\n`;
    text += `-------------------------------\n`;
    memberships.forEach(membership => {
      text += `${membership.activityName.padEnd(20)} $${(membership.cost || 0).toLocaleString('es-AR').padStart(8)}\n`;
    });
    text += `-------------------------------\n`;
  } else {
    // Extraer de la descripción si no hay membresías
    const extractedMemberships = extractMembershipsFromDescription(transaction.description || '');
    
    if (extractedMemberships.length > 0) {
      text += `SERVICIOS PAGADOS:\n`;
      text += `-------------------------------\n`;
      extractedMemberships.forEach(membership => {
        text += `${membership.name.padEnd(20)} $${membership.amount.toLocaleString('es-AR').padStart(8)}\n`;
      });
      text += `-------------------------------\n`;
    }
  }
  
  text += `TOTAL PAGADO: $${transaction.amount.toLocaleString('es-AR')}\n`;
  text += `ESTADO: COMPLETADO\n\n`;
  
  if (transaction.notes) {
    text += `Observaciones: ${transaction.notes}\n\n`;
  }
  
  text += `Este comprobante es válido como\n`;
  text += `constancia de pago.\n\n`;
  text += `Generado: ${formatDisplayDateTime(new Date())}\n`;
  text += `===============================`;
  
  return text;
};

export default {
  generateReceiptPDF,
  generateWhatsAppLink,
  generatePDFFromHTML,
  validateWhatsAppNumber,
  generateReceiptText
};