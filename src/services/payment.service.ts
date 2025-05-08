// src/services/payment.service.ts

import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc, 
    runTransaction,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp
  } from 'firebase/firestore';
  import { db } from '../config/firebase';
  import { Transaction, DailyCash } from '../types/gym.types';
  import { MembershipAssignment } from '../types/member.types';
  
  interface PaymentRequest {
    gymId: string;
    memberId: string;
    memberName: string;
    membershipIds: string[];
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    notes?: string;
    userId: string;
    userName: string;
  }
  
  interface PaymentResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
  }
  
  // Obtener membresías pendientes de pago de un socio
  // Asegúrate de que esta función esté definida y exportada
export const getPendingMemberships = async (gymId: string, memberId: string): Promise<MembershipAssignment[]> => {
  try {
    // Referencia a la colección de membresías del socio
    const membershipsRef = collection(db, `gyms/${gymId}/members/${memberId}/memberships`);
    
    // Consultar membresías con estado de pago 'pending'
    const q = query(
      membershipsRef,
      where('paymentStatus', '==', 'pending'),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    
    const pendingMemberships: MembershipAssignment[] = [];
    querySnapshot.forEach(doc => {
      pendingMemberships.push({
        id: doc.id,
        ...doc.data()
      } as MembershipAssignment);
    });
    
    console.log("Membresías pendientes encontradas:", pendingMemberships.length);
    return pendingMemberships;
  } catch (error) {
    console.error('Error getting pending memberships:', error);
    throw error;
  }
};
  
  // Registrar un pago de membresía y actualizar la caja diaria
  export const registerMembershipPayment = async (payment: PaymentRequest): Promise<PaymentResponse> => {
    try {
      // Referencias a documentos y colecciones
      const memberRef = doc(db, `gyms/${payment.gymId}/members`, payment.memberId);
      const dailyCashRef = doc(db, `gyms/${payment.gymId}/dailyCash`, payment.paymentDate);
  
      // Iniciar una transacción para garantizar la consistencia de datos
      return await runTransaction(db, async (transaction) => {
        // 1. LECTURAS - Primero realizamos todas las lecturas
        
        // Leer datos del miembro
        const memberSnap = await transaction.get(memberRef);
        if (!memberSnap.exists()) {
          throw new Error('El socio no existe');
        }
        const memberData = memberSnap.data();
        const currentDebt = memberData.totalDebt || 0;
        
        // Leer datos de caja diaria
        const dailyCashSnap = await transaction.get(dailyCashRef);
        
        // Leer datos de las membresías
        const memberships: MembershipAssignment[] = [];
        for (const membershipId of payment.membershipIds) {
          const membershipRef = doc(db, `gyms/${payment.gymId}/members/${payment.memberId}/memberships`, membershipId);
          const membershipSnap = await transaction.get(membershipRef);
          
          if (membershipSnap.exists()) {
            memberships.push({
              id: membershipId,
              ...membershipSnap.data()
            } as MembershipAssignment);
          }
        }
        
        // 2. ESCRITURAS - Después realizamos todas las escrituras
        
        // Actualizar el estado de las membresías a 'paid'
        for (const membership of memberships) {
          const membershipRef = doc(db, `gyms/${payment.gymId}/members/${payment.memberId}/memberships`, membership.id || '');
          transaction.update(membershipRef, {
            paymentStatus: 'paid',
            updatedAt: serverTimestamp()
          });
        }
        
        // Actualizar la deuda total del socio
        const newDebt = Math.max(0, currentDebt - payment.amount); // Asegurar que no sea negativo
        transaction.update(memberRef, {
          totalDebt: newDebt,
          updatedAt: serverTimestamp()
        });
        
        // Crear un registro de transacción (preparamos los datos pero no lo creamos aún)
        const transactionData: Partial<Transaction> = {
          type: 'income',
          category: 'membership',
          amount: payment.amount,
          description: `Pago de membresías de ${payment.memberName}`,
          memberId: payment.memberId,
          membershipId: payment.membershipIds.join(', '),
          date: Timestamp.fromDate(new Date(payment.paymentDate)),
          userId: payment.userId,
          userName: payment.userName,
          paymentMethod: payment.paymentMethod,
          status: 'completed',
          notes: payment.notes,
          createdAt: serverTimestamp()
        };
        
        // Actualizar o crear el registro de caja diaria
        if (dailyCashSnap.exists()) {
          // Actualizar registro existente
          const cashData = dailyCashSnap.data() as DailyCash;
          
          transaction.update(dailyCashRef, {
            totalIncome: (cashData.totalIncome || 0) + payment.amount,
            membershipIncome: (cashData.membershipIncome || 0) + payment.amount,
            updatedAt: serverTimestamp()
          });
        } else {
          // Crear nuevo registro de caja diaria
          transaction.set(dailyCashRef, {
            date: payment.paymentDate,
            openingTime: Timestamp.now(),
            openingAmount: 0,
            totalIncome: payment.amount,
            totalExpense: 0,
            membershipIncome: payment.amount,
            otherIncome: 0,
            status: 'open',
            openedBy: payment.userId,
            notes: 'Creado automáticamente al registrar un pago',
            createdAt: serverTimestamp()
          });
        }
        
        // En lugar de crear la transacción dentro de la transacción,
        // vamos a preparar los datos y devolverlos
        return {
          success: true,
          transactionData
        };
      }).then(async (result) => {
        // Después de la transacción, creamos el documento de transacción
        const transactionsRef = collection(db, `gyms/${payment.gymId}/transactions`);
        const docRef = await addDoc(transactionsRef, result.transactionData);
        
        return {
          success: true,
          transactionId: docRef.id
        };
      });
    } catch (error: any) {
      console.error('Error registering payment:', error);
      return {
        success: false,
        error: error.message || 'Error al registrar el pago'
      };
    }
  };
  
  // Obtener historial de pagos del socio
  export const getMemberPaymentHistory = async (gymId: string, memberId: string): Promise<Transaction[]> => {
    try {
      const transactionsRef = collection(db, `gyms/${gymId}/transactions`);
      
      // Consultar transacciones de tipo 'income' y categoría 'membership' de este socio
      const q = query(
        transactionsRef,
        where('memberId', '==', memberId),
        where('type', '==', 'income'),
        where('category', '==', 'membership'),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      const transactions: Transaction[] = [];
      querySnapshot.forEach(doc => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        } as Transaction);
      });
      
      return transactions;
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw error;
    }
  };
  
  export default {
    getPendingMemberships,
    registerMembershipPayment,
    getMemberPaymentHistory
  };