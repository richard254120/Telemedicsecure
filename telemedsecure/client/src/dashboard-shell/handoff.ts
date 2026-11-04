/**
 * Standardised clinical handoff vocabulary.
 *
 * A record must "read the same" wherever it is handed off: an ISSUED
 * prescription shown to the doctor, the pharmacist, the billing officer, the
 * patient and the auditor uses one label and one colour, not five hand-written
 * JSX branches. Every status token in the domain model maps here once.
 */
import type { Tone } from './format';

export interface HandoffBadge {
  label: string;
  tone: Tone;
}

/**
 * Raw enum token -> presentation. Keyed across every role's status enums
 * (Prescription, Consultation, LabOrder, Radiology, Invoice, Claim, Triage,
 * CarePlan, Incident, Verification, Severity). Colliding tokens (e.g. COMPLETED)
 * intentionally share one presentation.
 */
const REGISTRY: Record<string, HandoffBadge> = {
  // Prescriptions
  ISSUED: { label: 'Issued', tone: 'info' },
  DISPENSED: { label: 'Dispensed', tone: 'success' },
  REVOKED: { label: 'Revoked', tone: 'danger' },
  // Consultations
  PENDING: { label: 'Pending', tone: 'warning' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  // Lab orders
  ORDERED: { label: 'Ordered', tone: 'info' },
  SAMPLE_COLLECTED: { label: 'Sample collected', tone: 'info' },
  PROCESSING: { label: 'Processing', tone: 'warning' },
  // Radiology studies
  IN_REVIEW: { label: 'In review', tone: 'warning' },
  FINALIZED: { label: 'Finalized', tone: 'success' },
  URGENT_FLAGGED: { label: 'Urgent flagged', tone: 'danger' },
  // Invoices
  PARTIALLY_PAID: { label: 'Partially paid', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  // Claims
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SCRUBBED: { label: 'Scrubbed', tone: 'info' },
  SUBMITTED: { label: 'Submitted', tone: 'info' },
  APPROVED: { label: 'Approved', tone: 'success' },
  DENIED: { label: 'Denied', tone: 'danger' },
  APPEALED: { label: 'Appealed', tone: 'warning' },
  SETTLED: { label: 'Settled', tone: 'success' },
  // Triage
  WAITING: { label: 'Waiting', tone: 'warning' },
  IN_TRIAGE: { label: 'In triage', tone: 'info' },
  TRIAGED: { label: 'Triaged', tone: 'info' },
  FAST_TRACKED: { label: 'Fast-tracked', tone: 'info' },
  SEEN: { label: 'Seen', tone: 'success' },
  // Care plans
  ACTIVE: { label: 'Active', tone: 'info' },
  ON_TRACK: { label: 'On track', tone: 'success' },
  NEEDS_ATTENTION: { label: 'Needs attention', tone: 'warning' },
  DISCHARGED: { label: 'Discharged', tone: 'neutral' },
  // Incidents
  OPEN: { label: 'Open', tone: 'danger' },
  INVESTIGATING: { label: 'Investigating', tone: 'warning' },
  CLOSED: { label: 'Closed', tone: 'success' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  // Verification
  UNVERIFIED: { label: 'Unverified', tone: 'neutral' },
  PENDING_REVIEW: { label: 'Pending review', tone: 'warning' },
  VERIFIED: { label: 'Verified', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  // Severity
  LOW: { label: 'Low', tone: 'neutral' },
  MEDIUM: { label: 'Medium', tone: 'info' },
  HIGH: { label: 'High', tone: 'warning' },
  CRITICAL: { label: 'Critical', tone: 'danger' },
};

/** Ordered clinical chains, for progress rails and stage comparison. */
export const HANDOFF_CHAINS = {
  prescription: ['ISSUED', 'DISPENSED'],
  consultation: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'],
  lab: ['ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED'],
  radiology: ['ORDERED', 'IN_REVIEW', 'FINALIZED'],
} as const;

/** Presentation for a raw status token, falling back to a humanised neutral chip. */
export function handoffBadge(status?: string | null): HandoffBadge {
  if (!status) return { label: '—', tone: 'neutral' };
  const known = REGISTRY[status];
  if (known) return known;
  const label = status
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return { label, tone: 'neutral' };
}

export function handoffTone(status?: string | null): Tone {
  return handoffBadge(status).tone;
}
