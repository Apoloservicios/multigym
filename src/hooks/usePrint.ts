// src/hooks/usePrint.ts - Actualizado con mejores estilos para impresión
import { useRef } from 'react';

export const usePrint = () => {
  const componentRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = () => {
    if (componentRef.current) {
      const printWindow = window.open('', '_blank');
      
      if (printWindow) {
        // Crear el HTML para la ventana de impresión con estilos mejorados
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Rutina de Entrenamiento</title>
              <style>
                @page {
                  size: A4;
                  margin: 10mm;
                }
                
                body {
                  margin: 0;
                  padding: 0;
                  font-family: Arial, sans-serif;
                  font-size: 9px;
                  color: black !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                
                /* Colores específicos para cada día */
                .bg-yellow-400 {
                  background-color: #fbbf24 !important;
                  color: black !important;
                }
                
                .bg-cyan-400 {
                  background-color: #22d3ee !important;
                  color: black !important;
                }
                
                .bg-orange-400 {
                  background-color: #fb923c !important;
                  color: black !important;
                }
                
                .bg-green-500 {
                  background-color: #22c55e !important;
                  color: black !important;
                }
                
                .bg-purple-400 {
                  background-color: #c084fc !important;
                  color: black !important;
                }
                
                .bg-red-400 {
                  background-color: #f87171 !important;
                  color: black !important;
                }
                
                .bg-blue-400 {
                  background-color: #60a5fa !important;
                  color: black !important;
                }
                
                .bg-gray-100 {
                  background-color: #f3f4f6 !important;
                }
                
                .bg-gray-50 {
                  background-color: #f9fafb !important;
                }
                
                .border {
                  border: 1px solid #000 !important;
                }
                
                .border-2 {
                  border: 2px solid #000 !important;
                }
                
                .border-b-2 {
                  border-bottom: 2px solid #000 !important;
                }
                
                .border-black {
                  border-color: #000 !important;
                }
                
                .border-gray-300 {
                  border-color: #d1d5db !important;
                }
                
                .text-red-500 {
                  color: #ef4444 !important;
                }
                
                .text-green-600 {
                  color: #16a34a !important;
                }
                
                table {
                  border-collapse: collapse;
                  width: 100%;
                }
                
                .text-center {
                  text-align: center;
                }
                
                .text-right {
                  text-align: right;
                }
                
                .text-left {
                  text-align: left;
                }
                
                .grid {
                  display: grid;
                }
                
                .grid-cols-2 {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                
                .grid-cols-3 {
                  grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                
                .gap-4 {
                  gap: 1rem;
                }
                
                .flex {
                  display: flex;
                }
                
                .items-center {
                  align-items: center;
                }
                
                .font-bold {
                  font-weight: bold;
                }
                
                .text-xs {
                  font-size: 0.75rem;
                }
                
                .text-sm {
                  font-size: 0.875rem;
                }
                
                .text-base {
                  font-size: 1rem;
                }
                
                .text-lg {
                  font-size: 1.125rem;
                }
                
                .p-1 {
                  padding: 0.25rem;
                }
                
                .p-2 {
                  padding: 0.5rem;
                }
                
                .p-4 {
                  padding: 1rem;
                }
                
                .px-1 {
                  padding-left: 0.25rem;
                  padding-right: 0.25rem;
                }
                
                .px-2 {
                  padding-left: 0.5rem;
                  padding-right: 0.5rem;
                }
                
                .py-1 {
                  padding-top: 0.25rem;
                  padding-bottom: 0.25rem;
                }
                
                .mb-2 {
                  margin-bottom: 0.5rem;
                }
                
                .mb-3 {
                  margin-bottom: 0.75rem;
                }
                
                .mb-4 {
                  margin-bottom: 1rem;
                }
                
                .mr-3 {
                  margin-right: 0.75rem;
                }
                
                .rounded {
                  border-radius: 0.375rem;
                }
                
                .rounded-full {
                  border-radius: 9999px;
                }
                
                .h-6 {
                  height: 1.5rem;
                }
                
                .h-16 {
                  height: 4rem;
                }
                
                .w-8 {
                  width: 2rem;
                }
                
                .w-12 {
                  width: 3rem;
                }
                
                .w-16 {
                  width: 4rem;
                }
                
                .w-full {
                  width: 100%;
                }
                
                .border-r {
                  border-right: 1px solid #d1d5db;
                }
                
                .border-b {
                  border-bottom: 1px solid #d1d5db;
                }
                
                @media print {
                  body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  
                  * {
                    box-shadow: none !important;
                  }
                }
              </style>
            </head>
            <body>
              ${componentRef.current.innerHTML}
            </body>
          </html>
        `;
        
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Esperar un momento para que se cargue completamente antes de imprimir
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 1000);
      }
    }
  };
  
  return { componentRef, handlePrint };
};