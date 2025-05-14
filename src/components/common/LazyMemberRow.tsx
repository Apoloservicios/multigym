// src/components/common/LazyMemberRow.tsx

import React, { memo, useState, useEffect } from 'react';
import { Eye, Edit, Trash, CreditCard, BanknoteIcon } from 'lucide-react';
import { Member } from '../../types/member.types';
import { formatCurrency } from '../../utils/formatting.utils';

interface LazyMemberRowProps {
  member: Member;
  onView: (member: Member) => void;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  onGenerateQr: (member: Member) => void;
  onRegisterPayment: (member: Member) => void;
  formatDate: (date: any) => string;
  index: number;
  isVisible: boolean;
}

const LazyMemberRow: React.FC<LazyMemberRowProps> = memo(({
  member,
  onView,
  onEdit,
  onDelete,
  onGenerateQr,
  onRegisterPayment,
  formatDate,
  index,
  isVisible
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset image states when member changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [member.id]);

  // Lazy load images only when row is visible
  useEffect(() => {
    if (isVisible && member.photo && !imageLoaded && !imageError) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.onerror = () => setImageError(true);
      img.src = member.photo;
    }
  }, [isVisible, member.photo, imageLoaded, imageError]);

  const renderPhoto = () => {
    if (member.photo && !imageError && imageLoaded) {
      return (
        <img 
          src={member.photo} 
          alt={`${member.firstName} ${member.lastName}`} 
          className="h-10 w-10 rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      );
    }
    
    return (
      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
        {member.firstName.charAt(0)}{member.lastName.charAt(0)}
      </div>
    );
  };

  return (
    <tr 
      className="hover:bg-gray-50 transition-colors duration-150"
      style={{ 
        transform: isVisible ? 'none' : 'translateY(10px)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s ease-in-out'
      }}
    >
      <td className="px-3 py-4 whitespace-nowrap">
        {renderPhoto()}
      </td>
      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
        {member.lastName}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-gray-900">
        {member.firstName}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-gray-600">
        {member.phone || 'N/A'}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
          member.status === 'active' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {member.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(member.lastAttendance)}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`font-medium transition-colors ${
          member.totalDebt > 0 ? 'text-red-600' : 'text-green-600'
        }`}>
          {formatCurrency(member.totalDebt)}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <button 
            className="text-blue-600 hover:text-blue-800 p-1 rounded-md hover:bg-blue-50 transition-colors" 
            title="Ver detalles"
            onClick={() => onView(member)}
          >
            <Eye size={18} />
          </button>
          <button 
            className="text-green-600 hover:text-green-800 p-1 rounded-md hover:bg-green-50 transition-colors" 
            title="Editar"
            onClick={() => onEdit(member)}
          >
            <Edit size={18} />
          </button>
          <button 
            className="text-red-600 hover:text-red-800 p-1 rounded-md hover:bg-red-50 transition-colors" 
            title="Eliminar"
            onClick={() => onDelete(member)}
          >
            <Trash size={18} />
          </button>
          <button 
            className="text-purple-600 hover:text-purple-800 p-1 rounded-md hover:bg-purple-50 transition-colors" 
            title="Generar QR"
            onClick={() => onGenerateQr(member)}
          >
            <CreditCard size={18} />
          </button>
          <button 
            className="text-yellow-600 hover:text-yellow-800 p-1 rounded-md hover:bg-yellow-50 transition-colors" 
            title="Registrar pago"
            onClick={() => onRegisterPayment(member)}
          >
            <BanknoteIcon size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
});

LazyMemberRow.displayName = 'LazyMemberRow';

export default LazyMemberRow;