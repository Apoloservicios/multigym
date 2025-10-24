// ============================================
// TIPOS PARA SISTEMA DE HUELLAS DIGITALES
// Archivo: src/types/fingerprint.types.ts
// ============================================

export interface FingerprintData {
  template: string;           // Template de la huella en base64
  quality: number;            // Calidad de 0-100
  registeredAt: any;          // Timestamp de Firebase
  lastUsed?: any;             // Última vez que se usó
  finger?: string;            // Qué dedo se registró (opcional)
}

export interface FingerprintCaptureResult {
  success: boolean;
  data?: {
    template: string;
    quality: number;
    timestamp: string;
  };
  message?: string;
  error?: string;
}

export interface FingerprintVerifyResult {
  success: boolean;
  match?: {
    memberId: string;
    memberName: string;
    confidence: number;
  };
  message?: string;
  error?: string;
}

export interface FingerprintEnrollRequest {
  memberId: string;
  template: string;
  quality: number;
}

export interface FingerprintVerifyRequest {
  capturedTemplate: string;
  enrolledFingerprints: Array<{
    memberId: string;
    memberName: string;
    template: string;
  }>;
}

export interface FingerprintReaderStatus {
  initialized: boolean;
  ready: boolean;
  timestamp: string;
}

export interface FingerprintDevice {
  name: string;
  uid: string;
}

export interface FingerprintInitResult {
  success: boolean;
  message?: string;
  devices?: FingerprintDevice[];
  error?: string;
}