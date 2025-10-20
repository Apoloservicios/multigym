// src/components/cashier/ProductSaleForm.tsx
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  DollarSign, 
  CreditCard, 
  Save, 
  X, 
  AlertCircle,
  Search,
  Minus,
  Plus
} from 'lucide-react';
import { collection, getDocs, query, where, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { registerExtraIncome } from '../../services/dailyCash.service';
import useAuth from '../../hooks/useAuth';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  code?: string;
  active: boolean;
}

interface SaleItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

interface ProductSaleFormProps {
  selectedDate: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ProductSaleForm: React.FC<ProductSaleFormProps> = ({ 
  selectedDate, 
  onSuccess, 
  onCancel 
}) => {
  const { gymData, userData } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState('');

  // Cargar productos disponibles
  useEffect(() => {
    if (gymData?.id) {
      loadProducts();
    }
  }, [gymData?.id]);

  const loadProducts = async () => {
    if (!gymData?.id) return;

    setLoadingProducts(true);
    try {
      const productsRef = collection(db, `gyms/${gymData.id}/products`);
      const q = query(productsRef, where('active', '==', true));
      const snapshot = await getDocs(q);

      const productsList: Product[] = [];
      snapshot.forEach((doc) => {
        productsList.push({ id: doc.id, ...doc.data() } as Product);
      });

      setProducts(productsList);
    } catch (error) {
      console.error('Error cargando productos:', error);
      setError('Error al cargar los productos');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Filtrar productos por búsqueda
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agregar producto a la venta
  const addProduct = (product: Product) => {
    const existingItem = saleItems.find(item => item.product.id === product.id);

    if (existingItem) {
      // Si ya existe, aumentar cantidad
      if (existingItem.quantity >= product.stock) {
        setError(`No hay suficiente stock de ${product.name}`);
        return;
      }
      updateQuantity(product.id, existingItem.quantity + 1);
    } else {
      // Agregar nuevo item
      if (product.stock < 1) {
        setError(`${product.name} no tiene stock disponible`);
        return;
      }
      setSaleItems([...saleItems, {
        product,
        quantity: 1,
        subtotal: product.price
      }]);
    }
    setSearchTerm('');
    setError('');
  };

  // Actualizar cantidad
  const updateQuantity = (productId: string, newQuantity: number) => {
    setSaleItems(saleItems.map(item => {
      if (item.product.id === productId) {
        if (newQuantity > item.product.stock) {
          setError(`Stock máximo: ${item.product.stock}`);
          return item;
        }
        if (newQuantity < 1) {
          return item;
        }
        return {
          ...item,
          quantity: newQuantity,
          subtotal: item.product.price * newQuantity
        };
      }
      return item;
    }));
  };

  // Eliminar producto
  const removeProduct = (productId: string) => {
    setSaleItems(saleItems.filter(item => item.product.id !== productId));
  };

  // Calcular total
  const calculateTotal = () => {
    return saleItems.reduce((total, item) => total + item.subtotal, 0);
  };

  // Procesar venta
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saleItems.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }

    if (!gymData?.id || !userData) {
      setError('Error de autenticación');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Actualizar stock de productos
        for (const item of saleItems) {
          const productRef = doc(db, `gyms/${gymData.id}/products`, item.product.id);
          const productSnap = await transaction.get(productRef);
          
          if (!productSnap.exists()) {
            throw new Error(`Producto ${item.product.name} no encontrado`);
          }

          const currentStock = productSnap.data().stock;
          if (currentStock < item.quantity) {
            throw new Error(`Stock insuficiente para ${item.product.name}`);
          }

          transaction.update(productRef, {
            stock: currentStock - item.quantity
          });
        }

        // 2. Registrar la venta en caja diaria
        const description = `Venta de productos: ${saleItems.map(item => 
          `${item.product.name} x${item.quantity}`
        ).join(', ')}`;

        const result = await registerExtraIncome(gymData.id, {
          amount: calculateTotal(),
          description,
          paymentMethod,
          date: selectedDate,
          userId: userData.id,
          userName: userData.name,
          category: 'product',
          notes: notes || `Productos vendidos: ${saleItems.length}`
        });

        if (!result.success) {
          throw new Error(result.error || 'Error al registrar la venta');
        }
      });

      alert('Venta registrada correctamente');
      onSuccess();
    } catch (err: any) {
      console.error('Error procesando venta:', err);
      setError(err.message || 'Error al procesar la venta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-semibold">Venta de Productos</h2>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <X size={24} />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Buscador de productos */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar Producto
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o código..."
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Lista de productos filtrados */}
          {searchTerm && (
            <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
              {loadingProducts ? (
                <div className="p-4 text-center text-gray-500">Cargando...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No se encontraron productos</div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        ${product.price.toLocaleString('es-AR')} - Stock: {product.stock}
                      </p>
                    </div>
                    <Plus className="w-5 h-5 text-purple-600" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Items de venta */}
        {saleItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Productos a Vender</h3>
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio Unit.</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {saleItems.map((item) => (
                    <tr key={item.product.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.product.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-12 text-center font-medium">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        ${item.product.price.toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        ${item.subtotal.toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeProduct(item.product.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <X size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="mt-4 flex justify-end">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total a cobrar:</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${calculateTotal().toLocaleString('es-AR')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Método de pago */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Método de Pago
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>
        </div>

        {/* Notas */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Observaciones adicionales..."
          />
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || saleItems.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            ) : (
              <Save size={18} className="mr-2" />
            )}
            {loading ? 'Procesando...' : 'Registrar Venta'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductSaleForm;