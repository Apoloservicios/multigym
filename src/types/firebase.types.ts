// src/types/firebase.types.ts

/**
 * Tipo para representar las diferentes formas de fecha que puede devolver Firebase
 */
export type FirebaseDate = {
    toDate: () => Date;
    seconds: number;
    nanoseconds: number;
  } | Date | string | number | null | undefined;