/**
 * Single source of truth for every station's sidebar navigation.
 *
 * Each role gets: a "This Station" anchor, the shared clinical worklists it is
 * authorised to open (from the route guards in App.tsx), and the verification
 * tools. Keeping this in one place is what makes the stations "communicate in a
 * standard way": the same records and handoff tools are reachable, named, and
 * coloured identically everywhere, and no station links to a route it cannot
 * actually open (which the ProtectedRoute guards would bounce).
 */
import {
  Activity,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileSearch,
  FileText,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Lock,
  Pill,
  PlusCircle,
  Scan,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';
import type { UserRole } from '../context/AuthContext';
import type { AccentToken, NavGroup, NavTab, IconType } from './types';

/* ------------------------------------------------------------------ *
 * Admin: in-page section tabs (no `to`) — the reference console.
 * ------------------------------------------------------------------ */

export type AdminSectionId =
  | 'overview'
  | 'compliance'
  | 'investigation'
  | 'prescriptions'
  | 'users'
  | 'patients'
  | 'consultations'
  | 'finance'
  | 'privacy'
  | 'sms';

const ADMIN_SECTIONS: AdminSectionId[] = [
  'overview', 'compliance', 'investigation', 'prescriptions', 'users', 'patients', 'consultations', 'finance', 'privacy', 'sms',
];

export function isAdminSectionId(value: string | null | undefined): value is AdminSectionId {
  return !!value && ADMIN_SECTIONS.includes(value as AdminSectionId);
}

const ADMIN_NAV: NavGroup[] = [
  { name: 'Command', tabs: [
    { id: 'overview', label: 'Platform Overview', caption: 'Live telemetry & KPIs', group: 'Command', icon: Activity },
  ] },
  { name: 'Integrity', tabs: [
    { id: 'compliance', label: 'Compliance & Alerts', caption: 'Violations, audit chain', group: 'Integrity', icon: ShieldCheck },
    { id: 'investigation', label: 'Incident Casework', caption: 'Open forensic probes', group: 'Integrity', icon: FileSearch },
    { id: 'prescriptions', label: 'EPCS Audit', caption: 'Rx signature ledger', group: 'Integrity', icon: FileCheck2 },
    { id: 'privacy', label: 'Privacy & DSAR', caption: 'Exports, right to erasure', group: 'Integrity', icon: Lock },
  ] },
  { name: 'Identity', tabs: [
    { id: 'users', label: 'Workforce & RBAC', caption: 'Staff, roles, provisioning', group: 'Identity', icon: Users },
    { id: 'patients', label: 'Patient Registry', caption: 'Enrollment & account state', group: 'Identity', icon: User },
  ] },
  { name: 'Operations', tabs: [
    { id: 'consultations', label: 'Consultation Oversight', caption: 'Bookings across all clinicians', group: 'Operations', icon: Calendar },
    { id: 'finance', label: 'Finance & Revenue', caption: 'Invoices, claims, aging', group: 'Operations', icon: CreditCard },
    { id: 'sms', label: 'SMS Gateway', caption: 'Dispatch ledger', group: 'Operations', icon: Smartphone },
  ] },
];

/* ------------------------------------------------------------------ *
 * Shared link building blocks (cross-station records & handoff tools).
 * ------------------------------------------------------------------ */

const link = (
  id: string, label: string, to: string, icon: IconType, group: string, caption: string,
): NavTab => ({ id, label, to, icon, group, caption });

const WORKLISTS: Record<string, NavTab> = {
  prescriptions: link('rx', 'Prescriptions', '/prescriptions', FileText, 'Clinical Workflow', 'Rx ledger for your patients'),
  issueRx: link('rx-new', 'Issue Prescription', '/prescriptions/new', PlusCircle, 'Clinical Workflow', 'Create a signed e-prescription'),
  calendar: link('calendar', 'Appointment Calendar', '/calendar', Calendar, 'Clinical Workflow', 'Consultation schedule'),
  verifyRx: link('verify-rx', 'Verify Prescription', '/prescriptions/verify', CheckCircle2, 'Verification', 'Cryptographic Rx signature check'),
  verifyReport: link('verify-report', 'Verify Report', '/investigation/verify', FileCheck2, 'Verification', 'Audit report integrity check'),
};

/** Shared verification group, reusable by stations that already render their own
 *  prescriptions/records section in-page (e.g. Patient) and only need the
 *  cross-station cryptographic checks appended. */
export const VERIFICATION_GROUP: NavGroup = {
  name: 'Verification',
  tabs: [WORKLISTS.verifyRx, WORKLISTS.verifyReport],
};

/* ------------------------------------------------------------------ *
 * Per-role accent, brand subtitle and station home.
 * ------------------------------------------------------------------ */

interface RoleMeta { accent: AccentToken; subtitle: string; homeLabel: string; homeIcon: IconType; }

const ROLE_META: Record<UserRole, RoleMeta> = {
  PATIENT: { accent: 'cyan', subtitle: 'Patient Portal', homeLabel: 'My Health Record', homeIcon: User },
  DOCTOR: { accent: 'blue', subtitle: 'Physician Station', homeLabel: 'Doctor Station', homeIcon: Stethoscope },
  NURSE: { accent: 'emerald', subtitle: 'Nursing & Triage', homeLabel: 'Nursing Station', homeIcon: HeartPulse },
  PHARMACIST: { accent: 'teal', subtitle: 'Pharmacy Station', homeLabel: 'Pharmacy Workbench', homeIcon: Pill },
  LAB_TECHNICIAN: { accent: 'amber', subtitle: 'Laboratory Station', homeLabel: 'Lab Workbench', homeIcon: FlaskConical },
  RADIOLOGIST: { accent: 'teal', subtitle: 'Radiology Station', homeLabel: 'Radiology Workbench', homeIcon: Scan },
  BILLING_OFFICER: { accent: 'amber', subtitle: 'Billing Office', homeLabel: 'Billing Workbench', homeIcon: CreditCard },
  TRIAGE_OFFICER: { accent: 'cyan', subtitle: 'Triage Desk', homeLabel: 'Triage Workbench', homeIcon: Activity },
  CARE_COORDINATOR: { accent: 'emerald', subtitle: 'Care Coordination', homeLabel: 'Care Coordinator Workbench', homeIcon: ClipboardList },
  RECEPTIONIST: { accent: 'cyan', subtitle: 'Front Desk', homeLabel: 'Reception Workbench', homeIcon: LayoutDashboard },
  ADMIN: { accent: 'purple', subtitle: 'Admin Console', homeLabel: 'Admin Console', homeIcon: ShieldCheck },
};

export function accentForRole(role: UserRole | undefined): AccentToken {
  return ROLE_META[role ?? 'PATIENT'].accent;
}

export function brandSubtitleForRole(role: UserRole | undefined): string {
  return ROLE_META[role ?? 'PATIENT'].subtitle;
}

/**
 * The navigation groups for a signed-in role. Admin gets its in-page section
 * rail; every other station gets its home + the worklists and verification
 * tools it is actually permitted to open.
 */
export function buildNav(role: UserRole): NavGroup[] {
  if (role === 'ADMIN') return ADMIN_NAV;

  const meta = ROLE_META[role];
  const home: NavTab = {
    id: 'station-home',
    label: meta.homeLabel,
    caption: 'Your station home',
    group: 'This Station',
    icon: meta.homeIcon,
    to: `/${role.toLowerCase()}`,
  };

  return [{ name: 'This Station', tabs: [home] }, ...sharedGroups(role)];
}

/**
 * Same standard tail (Clinical Workflow + Verification) for a station that owns
 * its own in-page section tabs (Nurse, Doctor, Patient). The caller supplies the
 * section tabs — which switch content in place via `onSelectTab` (no `to`) — and
 * they are grouped under the station's own name, so every role still gets the
 * identical cross-station links and colours around its bespoke sections.
 */
export function buildStationNav(role: UserRole, inPageTabs: NavTab[]): NavGroup[] {
  const meta = ROLE_META[role];
  return [{ name: meta.homeLabel, tabs: inPageTabs }, ...sharedGroups(role)];
}

/** The cross-station links every role is authorised to open (route-based). */
function sharedGroups(role: UserRole): NavGroup[] {
  // Which shared tools each role may open, mirroring App.tsx route guards.
  const canIssueRx = role === 'DOCTOR';
  const canCalendar = role === 'DOCTOR' || role === 'NURSE';
  const clinicalTabs = [
    WORKLISTS.prescriptions,
    ...(canIssueRx ? [WORKLISTS.issueRx] : []),
    ...(canCalendar ? [WORKLISTS.calendar] : []),
  ];

  return [
    { name: 'Clinical Workflow', tabs: clinicalTabs },
    { name: 'Verification', tabs: [WORKLISTS.verifyRx, WORKLISTS.verifyReport] },
  ];
}

export { ADMIN_NAV };
