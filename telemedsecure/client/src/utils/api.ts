import { API_BASE } from '../config';

export interface PrescriptionItem {
  id?: string;
  medication: string;
  dosage: string;
  instructions: string;
}

export interface PrescriptionData {
  id: string;
  consultationId: string;
  doctorId: string;
  status: 'ISSUED' | 'DISPENSED' | 'REVOKED';
  statusReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PrescriptionItem[];
  signature?: {
    id: string;
    signature: string;
    publicKey: string;
    canonicalHash?: string;
    algorithm: string;
    createdAt: string;
  };
  doctor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    doctorPublicKey?: string;
  };
  consultation?: {
    id: string;
    patient?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export interface VerificationResult {
  prescriptionId: string;
  isValid: boolean;
  status: 'VALID' | 'TAMPERED';
  lifecycleStatus: 'ISSUED' | 'DISPENSED' | 'REVOKED';
  statusReason?: string | null;
  canonicalHash?: string;
  computedHash: string;
  doctor: {
    id: string;
    name: string;
    email: string;
  };
  patient: {
    id: string;
    name: string;
    email: string;
  };
  items: PrescriptionItem[];
  signature: {
    id: string;
    algorithm: string;
    signature: string;
    publicKey: string;
    createdAt: string;
  };
  canonicalPayload: string;
  issuedAt: string;
  updatedAt: string;
}

// Token management
export const getToken = (): string | null => localStorage.getItem('telemed_token');
export const setToken = (token: string) => localStorage.setItem('telemed_token', token);
export const removeToken = () => localStorage.removeItem('telemed_token');

export async function login(email = 'doctor1@telemed.com', password = 'Password123!') {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }
  const data = await res.json();
  if (data.accessToken) {
    setToken(data.accessToken);
  }
  return data;
}

// Auto-authenticate as doctor if no token exists
export async function ensureDoctorAuth(): Promise<string> {
  let token = getToken();
  if (!token) {
    try {
      const auth = await login('doctor1@telemed.com', 'Password123!');
      token = auth.accessToken;
    } catch {
      // If seed doctor fails, register or handle
    }
  }
  return token || '';
}

export async function fetchContextMeta() {
  const token = await ensureDoctorAuth();
  const res = await fetch(`${API_BASE}/prescriptions/meta/context`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch context metadata');
  return res.json();
}

export async function listPrescriptions(): Promise<PrescriptionData[]> {
  const token = await ensureDoctorAuth();
  const res = await fetch(`${API_BASE}/prescriptions`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch prescriptions');
  return res.json();
}

export async function getPrescription(id: string): Promise<PrescriptionData> {
  const token = await ensureDoctorAuth();
  const res = await fetch(`${API_BASE}/prescriptions/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Failed to fetch prescription');
  return res.json();
}

export async function createPrescription(payload: {
  consultationId?: string;
  patientId?: string;
  items: { medication: string; dosage: string; instructions: string }[];
  password: string;
}) {
  const token = await ensureDoctorAuth();
  const res = await fetch(`${API_BASE}/prescriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to issue prescription');
  return data;
}

export async function verifyPrescription(id: string): Promise<VerificationResult> {
  // Verification is public/usable by patients & pharmacists
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/prescriptions/${id}/verify`, { headers });
  const data = await res.json();
  if (!res.ok && !data.status) throw new Error(data.error || 'Verification failed');
  return data;
}

export async function dispensePrescription(id: string, pharmacyNotes?: string) {
  const token = await ensureDoctorAuth();
  const res = await fetch(`${API_BASE}/prescriptions/${id}/dispense`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ pharmacyNotes })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to dispense prescription');
  return data;
}

export async function revokePrescription(id: string, reason: string) {
  const token = await ensureDoctorAuth();
  const res = await fetch(`${API_BASE}/prescriptions/${id}/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ reason })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to revoke prescription');
  return data;
}

export async function tamperPrescription(id: string) {
  const token = await ensureDoctorAuth();
  const res = await fetch(`${API_BASE}/prescriptions/${id}/tamper`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to simulate tamper');
  return data;
}

// --- Step 8: Audit Chain & Merkle Integrity APIs ---

export interface AuditVerificationReport {
  isValid: boolean;
  status: 'VALID' | 'TAMPERED';
  totalEvents: number;
  chainIntact: boolean;
  brokenEvent: {
    id: string;
    index: number;
    action: string;
    resource: string;
    reason: string;
    expectedHash: string;
    actualHash: string;
    expectedPrevHash: string;
    actualPrevHash: string;
  } | null;
  anchorsChecked: number;
  onChainVerified: boolean;
  merkleRootsMatch: boolean;
  anchorRecords: Array<{
    id: string;
    merkleRoot: string;
    txHash: string | null;
    blockNumber: number | null;
    eventCount: number;
    verifiedAt: string;
    onChainValid: boolean;
  }>;
  verifiedAt: string;
}

export interface ChainedAuditEventItem {
  id: string;
  action: string;
  resource: string;
  userId: string | null;
  ipAddress: string | null;
  timestamp: string;
  prevHash: string;
  hash: string;
}

export async function verifyAuditIntegrity(): Promise<AuditVerificationReport> {
  const res = await fetch(`${API_BASE}/integrity/verify`);
  if (!res.ok) throw new Error('Failed to verify audit integrity');
  return res.json();
}

export async function triggerOnChainAnchor() {
  const res = await fetch(`${API_BASE}/integrity/anchor`, {
    method: 'POST'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to anchor on-chain');
  return data;
}

export async function tamperAuditEvent() {
  const res = await fetch(`${API_BASE}/integrity/tamper`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to tamper audit event');
  return data;
}

export async function repairAuditChain() {
  const res = await fetch(`${API_BASE}/integrity/repair`, {
    method: 'POST'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to repair chain');
  return data;
}

export async function getChainedAuditEvents(): Promise<ChainedAuditEventItem[]> {
  const res = await fetch(`${API_BASE}/integrity/events?limit=25`);
  if (!res.ok) throw new Error('Failed to fetch audit events');
  return res.json();
}

