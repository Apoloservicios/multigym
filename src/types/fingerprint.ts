// src/types/fingerprint.ts

export interface FingerprintEvent {
  type: 'connected' 
    | 'fingerprint_verified' 
    | 'fingerprint_not_found'
    | 'enrollment_progress'
    | 'enrollment_complete'
    | 'enrollment_error';
  memberId?: string;
  confidence?: number;
  timestamp?: Date;
  status?: string;
  samplesNeeded?: number;
  template?: string;
  error?: string;
  message?: string;
}

export interface EnrollmentProgress {
  memberId: string;
  status: string;
  samplesNeeded: number;
}

export interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  membershipType?: string;
  fingerprintRegistered: boolean;
  fingerprintTemplate?: string; // Base64
  createdAt: Date;
}

export interface Attendance {
  id?: string;
  memberId: string;
  memberName: string;
  timestamp: Date;
  method: 'fingerprint' | 'manual' | 'card';
  confidence?: number;
}