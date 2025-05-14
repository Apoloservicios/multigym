// src/components/common/VirtualizedMemberList.tsx

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Member } from '../../types/member.types';
import LazyMemberRow from './LazyMemberRow';

interface VirtualizedMemberListProps {
  members: Member[];
  hasNextPage: boolean;
  isNextPageLoading: boolean;
  loadNextPage: () => Promise<void>;
  onView: (member: Member) => void;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  onGenerateQr: (member: Member) => void;
  onRegisterPayment: (member: Member) => void;
  formatDate: (date: any) => string;
  height?: number;
}

const ITEM_HEIGHT = 72; // Altura de cada fila en píxeles

const VirtualizedMemberList: React.FC<VirtualizedMemberListProps> = ({
  members,
  hasNextPage,
  isNextPageLoading,
  loadNextPage,
  onView,
  onEdit,
  onDelete,
  onGenerateQr,
  onRegisterPayment,
  formatDate,
  height = 500
}) => {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const listRef = useRef<List>(null);

  // Calcular cuántos items necesitamos cargar
  const itemCount = hasNextPage ? members.length + 1 : members.length;

  // Verificar si un item está cargado
  const isItemLoaded = (index: number) => {
    return !!members[index];
  };

  // Componente para renderizar cada fila
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const member = members[index];
    const isVisible = visibleItems.has(index);

    // Si no hay member (estamos cargando)
    if (!member) {
      return (
        <div style={style} className="flex items-center justify-center">
          <div className="inline-block h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600">Cargando...</span>
        </div>
      );
    }

    return (
      <div style={style}>
        <table className="w-full">
          <tbody>
            <LazyMemberRow
              member={member}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onGenerateQr={onGenerateQr}
              onRegisterPayment={onRegisterPayment}
              formatDate={formatDate}
              index={index}
              isVisible={isVisible}
            />
          </tbody>
        </table>
      </div>
    );
  };

  // Manejar cambios en los items visibles
  const handleItemsRendered = ({ visibleStartIndex, visibleStopIndex }: {
    visibleStartIndex: number;
    visibleStopIndex: number;
  }) => {
    const newVisibleItems = new Set<number>();
    for (let i = visibleStartIndex; i <= visibleStopIndex; i++) {
      newVisibleItems.add(i);
    }
    setVisibleItems(newVisibleItems);
  };

  return (
    <div className="w-full">
      {/* Header de la tabla */}
      <div className="bg-gray-50 border-b border-gray-200">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Foto
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Apellido
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teléfono
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Última Asistencia
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deuda Total
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Lista virtualizada */}
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={itemCount}
        loadMoreItems={loadNextPage}
      >
        {({ onItemsRendered, ref }: any) => (
         <List
            ref={(list) => {
                ref(list);
                listRef.current = list;
            }}
            height={height}
            width="100%" // <- AGREGAR ESTA LÍNEA
            itemCount={itemCount}
            itemSize={ITEM_HEIGHT}
            onItemsRendered={(props) => {
                onItemsRendered(props);
                handleItemsRendered(props);
            }}
            className="border border-gray-200"
            >
            {Row}
            </List>
        )}
      </InfiniteLoader>

      {/* Loading indicator para próximas páginas */}
      {isNextPageLoading && (
        <div className="p-4 text-center border-t border-gray-200">
          <div className="inline-block h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600">Cargando más socios...</span>
        </div>
      )}
    </div>
  );
};

export default VirtualizedMemberList;