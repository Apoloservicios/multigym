// src/utils/receipt.utils.ts - UTILIDADES PARA GENERAR COMPROBANTES

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Transaction } from '../types/gym.types';
import { MembershipAssignment } from '../types/member.types';
import { formatDisplayDate, formatDisplayDateTime } from './date.utils';

/**
 * Generar PDF del comprobante
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
    const paymentMethod = formatPaymentMethod(transaction.paymentMethod || '');
    pdf.text(`Método de Pago: ${paymentMethod}`, 20, yPosition);
    yPosition += 20;
    
    // Detalle de servicios
    if (memberships.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('DETALLE DE SERVICIOS:', 20, yPosition);
      yPosition += 15;
      
      pdf.setFont('helvetica', 'normal');
      
      // Encabezados de tabla
      pdf.text('Servicio', 20, yPosition);
      pdf.text('Importe', pageWidth - 60, yPosition, { align: 'right' });
      yPosition += 5;
      
      // Línea de encabezado
      pdf.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 10;
      
      // Items
      let subtotal = 0;
      memberships.forEach(membership => {
        const cost = membership.cost || 0;
        subtotal += cost;
        
        pdf.text(membership.activityName, 20, yPosition);
        pdf.text(`${cost.toLocaleString('es-AR')}`, pageWidth - 60, yPosition, { align: 'right' });
        yPosition += 8;
      });
      
      // Línea de subtotal
      yPosition += 5;
      pdf.line(20, yPosition, pageWidth - 20, yPosition);
      yPosition += 10;
      
      // Subtotal
      pdf.setFont('helvetica', 'bold');
      pdf.text('Subtotal:', 20, yPosition);
      pdf.text(`${subtotal.toLocaleString('es-AR')}`, pageWidth - 60, yPosition, { align: 'right' });
      yPosition += 15;
    }
    
    // Total
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TOTAL PAGADO:', 20, yPosition);
    pdf.text(`${transaction.amount.toLocaleString('es-AR')}`, pageWidth - 60, yPosition, { align: 'right' });
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
 * Generar enlace para WhatsApp con el comprobante
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
  
  // Detalle de servicios
  if (memberships.length > 0) {
    message += `📋 *SERVICIOS PAGADOS:*\n`;
    memberships.forEach(membership => {
      message += `• ${membership.activityName}: ${(membership.cost || 0).toLocaleString('es-AR')}\n`;
    });
    message += `\n`;
  }
  
  // Total
  message += `💰 *TOTAL PAGADO: ${transaction.amount.toLocaleString('es-AR')}*\n`;
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
      text += `${membership.activityName.padEnd(20)} ${(membership.cost || 0).toLocaleString('es-AR').padStart(8)}\n`;
    });
    text += `-------------------------------\n`;
  }
  
  text += `TOTAL PAGADO: ${transaction.amount.toLocaleString('es-AR')}\n`;
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