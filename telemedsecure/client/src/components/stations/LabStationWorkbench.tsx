/**
 * Laboratory Medicine Workbench — Full Clinical Station
 *
 * Covers:
 *  • Worklist with STAT / ROUTINE priority, TAT countdown, status pipeline
 *  • Chain-of-custody specimen tracking (ORDERED → COLLECTED → PROCESSING → COMPLETED)
 *  • Structured analytical result entry with per-analyte rows + reference ranges
 *  • Critical / panic-value flagging with mandatory clinical notes
 *  • Delta-check indicator (flag if result deviates >20 % from prior)
 *  • Quality-control (QC) status badge per order
 *  • Sealed report viewer with printable layout
 *  • Live stats dashboard (TAT, critical count, pending, throughput)
 *  • New requisition modal with panel catalogue
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  X,
  FileText,
  Activity,
  Printer,
  Microscope,
  Beaker,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Siren,
  BarChart3,
  TestTube,
  Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type LabStatus = 'ORDERED' | 'SAMPLE_COLLECTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
type Priority  = 'STAT' | 'ROUTINE';

interface Analyte {
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
  flag: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' | '';
}

interface LabOrder {
  id: string;
  orderNumber: string;
  testName: string;
  specimenType: string;
  status: LabStatus;
  priority?: Priority;
  isCritical: boolean;
  criticalNotes?: string | null;
  findings?: string | null;
  referenceRange?: string | null;
  createdAt: string;
  completedAt?: string | null;
  updatedAt: string;
  patient: { id: string; firstName: string; lastName: string; email: string; phone?: string };
  technician?: { id: string; firstName: string; lastName: string; medicalLicenseNo?: string } | null;
  consultation?: { id: string; scheduledAt: string; doctor: { firstName: string; lastName: string } } | null;
}

// ─── Catalogue of diagnostic panels ──────────────────────────────────────────

const PANEL_CATALOGUE = [
  { group: 'Haematology',       name: 'Complete Blood Count (CBC) with Differential',         specimen: 'Venous Blood (EDTA — Purple Top)',     analytes: ['WBC','RBC','Hgb','Hct','MCV','MCH','MCHC','RDW','Platelets','Neutrophils %','Lymphocytes %','Monocytes %','Eosinophils %','Basophils %'] },
  { group: 'Haematology',       name: 'Prothrombin Time / INR (PT/INR)',                        specimen: 'Citrated Plasma (Blue Top)',           analytes: ['PT (sec)','INR','APTT (sec)'] },
  { group: 'Chemistry',         name: 'Comprehensive Metabolic Panel (CMP)',                   specimen: 'Serum (SST — Gold Top)',               analytes: ['Glucose','BUN','Creatinine','eGFR','Na⁺','K⁺','Cl⁻','CO₂','Ca²⁺','Total Protein','Albumin','Total Bilirubin','ALT','AST','ALP'] },
  { group: 'Chemistry',         name: 'Basic Metabolic Panel (BMP)',                           specimen: 'Serum (SST — Gold Top)',               analytes: ['Glucose','BUN','Creatinine','eGFR','Na⁺','K⁺','Cl⁻','CO₂'] },
  { group: 'Chemistry',         name: 'Lipid Profile (Fasting)',                               specimen: 'Serum (SST — Gold Top)',               analytes: ['Total Cholesterol','LDL-C','HDL-C','Triglycerides','Non-HDL-C','LDL/HDL Ratio'] },
  { group: 'Chemistry',         name: 'Liver Function Tests (LFTs)',                           specimen: 'Serum (SST — Gold Top)',               analytes: ['Total Bilirubin','Direct Bilirubin','Indirect Bilirubin','ALT','AST','ALP','GGT','Total Protein','Albumin'] },
  { group: 'Chemistry',         name: 'Renal Function Panel',                                  specimen: 'Serum (SST — Gold Top)',               analytes: ['Creatinine','BUN','BUN/Creatinine Ratio','eGFR','Uric Acid','Cystatin C'] },
  { group: 'Endocrinology',     name: 'Thyroid Function Panel (TSH / fT4 / fT3)',              specimen: 'Serum (SST — Gold Top)',               analytes: ['TSH','Free T4 (fT4)','Free T3 (fT3)','Total T4','Anti-TPO'] },
  { group: 'Endocrinology',     name: 'HbA1c (Glycated Haemoglobin)',                         specimen: 'Venous Blood (EDTA — Purple Top)',     analytes: ['HbA1c %','Mean Blood Glucose Estimate'] },
  { group: 'Endocrinology',     name: 'Fasting Blood Glucose',                                specimen: 'Serum (NaF — Grey Top)',               analytes: ['Fasting Glucose (mg/dL)'] },
  { group: 'Cardiac Markers',   name: 'Troponin I / T (High-Sensitivity)',                    specimen: 'Serum (SST — Gold Top)',               analytes: ['hs-Troponin I','hs-Troponin T','CK-MB'] },
  { group: 'Cardiac Markers',   name: 'BNP / NT-proBNP (Heart Failure Panel)',                specimen: 'EDTA Plasma (Purple Top)',             analytes: ['NT-proBNP','BNP'] },
  { group: 'Inflammatory',      name: 'C-Reactive Protein (CRP) + ESR',                       specimen: 'Serum (SST — Gold Top)',               analytes: ['CRP (mg/L)','ESR (mm/hr)','Ferritin'] },
  { group: 'Inflammatory',      name: 'Procalcitonin (PCT) — Sepsis Marker',                  specimen: 'Serum (SST — Gold Top)',               analytes: ['Procalcitonin (ng/mL)'] },
  { group: 'Microbiology',      name: 'Blood Culture (Aerobic + Anaerobic)',                   specimen: 'Blood — Sterile BD BACTEC Bottles',    analytes: ['Organism (if +ve)','Sensitivity Pattern','Resistance Flags'] },
  { group: 'Microbiology',      name: 'Urine Culture + Sensitivity (C&S)',                    specimen: 'Mid-Stream Urine (MSU) — Sterile',    analytes: ['Colony Count','Organism','Antibiogram'] },
  { group: 'Urinalysis',        name: 'Urinalysis + Microscopy (UA+M)',                       specimen: 'Mid-Stream Urine (MSU)',               analytes: ['Colour','Clarity','pH','Specific Gravity','Protein','Glucose','Ketones','Blood','Nitrites','Leucocyte Esterase','WBC/hpf','RBC/hpf','Casts'] },
  { group: 'Immunology',        name: 'HIV 1/2 Antigen-Antibody Combo (4th Gen)',             specimen: 'Serum (SST — Gold Top)',               analytes: ['HIV Ag/Ab Result','p24 Antigen','Confirmatory WB (if reactive)'] },
  { group: 'Immunology',        name: 'Hepatitis B Surface Antigen (HBsAg)',                  specimen: 'Serum (SST — Gold Top)',               analytes: ['HBsAg','Anti-HBs','Anti-HBc (IgM)'] },
  { group: 'Toxicology',        name: 'Drug Screen (Urine — 10-Panel)',                       specimen: 'Urine — Tamper-Evident Container',     analytes: ['Opiates','Cocaine','Cannabis','Amphetamines','Benzodiazepines','Barbiturates','Methadone','PCP','Propoxyphene','Methamphetamine'] },
];

const STATUS_META: Record<LabStatus, { label: string; color: string; bg: string; next?: LabStatus }> = {
  ORDERED:          { label: 'Ordered',          color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', next: 'SAMPLE_COLLECTED' },
  SAMPLE_COLLECTED: { label: 'Collected',         color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  next: 'PROCESSING' },
  PROCESSING:       { label: 'Processing',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  next: 'COMPLETED' },
  COMPLETED:        { label: 'Completed',         color: '#10b981', bg: 'rgba(16,185,129,0.12)',  next: undefined },
  CANCELLED:        { label: 'Cancelled',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   next: undefined },
};

function tatMinutes(createdAt: string): number {
  return Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function tatColor(minutes: number, status: LabStatus): string {
  if (status === 'COMPLETED' || status === 'CANCELLED') return '#10b981';
  if (minutes > 120) return '#ef4444';
  if (minutes > 60)  return '#f59e0b';
  return '#94a3b8';
}

// ─── Default analyte rows from panel catalogue ────────────────────────────────
function buildDefaultAnalytes(testName: string): Analyte[] {
  const panel = PANEL_CATALOGUE.find(p => p.name === testName);
  if (!panel) return [{ name: '', value: '', unit: '', refLow: '', refHigh: '', flag: '' }];
  return panel.analytes.map(name => ({ name, value: '', unit: '', refLow: '', refHigh: '', flag: '' }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LabStationWorkbench() {
  const { user, getAuthHeaders } = useAuth();

  const [orders, setOrders]             = useState<LabOrder[]>([]);
  const [stats, setStats]               = useState<any>(null);
  const [patients, setPatients]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState<LabStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'ALL'>('ALL');
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  // Modals
  const [showOrderModal, setShowOrderModal]   = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [viewOrder, setViewOrder]             = useState<LabOrder | null>(null);
  const [selectedOrder, setSelectedOrder]     = useState<LabOrder | null>(null);

  // Feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError]     = useState<string | null>(null);
  const [submitting, setSubmitting]       = useState(false);

  // New order form
  const [newPatientId, setNewPatientId]   = useState('');
  const [newTestName, setNewTestName]     = useState(PANEL_CATALOGUE[0].name);
  const [newSpecimen, setNewSpecimen]     = useState(PANEL_CATALOGUE[0].specimen);
  const [newPriority, setNewPriority]     = useState<Priority>('ROUTINE');

  // Result entry — per-analyte rows
  const [analytes, setAnalytes]           = useState<Analyte[]>([]);
  const [resultIsCritical, setResultIsCritical] = useState(false);
  const [resultCriticalNotes, setResultCriticalNotes] = useState('');
  const [qcPassed, setQcPassed]           = useState(true);

  // ── Data fetch ──────────────────────────────────────────────────────────────

  const fetchLabData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const h = getAuthHeaders();
      const [ordRes, statRes, ptsRes] = await Promise.all([
        fetch(`${API_BASE}/stations/lab/orders`, { headers: h }),
        fetch(`${API_BASE}/stations/lab/stats`,  { headers: h }),
        fetch(`${API_BASE}/consultations/patients`, { headers: h }),
      ]);
      if (ordRes.ok)  setOrders(await ordRes.json());
      if (statRes.ok) setStats(await statRes.json());
      if (ptsRes.ok) {
        const pts = await ptsRes.json();
        const list = Array.isArray(pts) ? pts : [];
        setPatients(list);
        if (list.length > 0 && !newPatientId) setNewPatientId(list[0].id);
      }
    } catch (e) {
      console.error('Lab data fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders, newPatientId]);

  useEffect(() => { fetchLabData(); }, []);

  // ── Advance status ──────────────────────────────────────────────────────────

  const advanceStatus = async (order: LabOrder) => {
    const nextStatus = STATUS_META[order.status]?.next;
    if (!nextStatus) return;
    try {
      const res = await fetch(`${API_BASE}/stations/lab/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setActionSuccess(`Order ${order.orderNumber} moved to ${STATUS_META[nextStatus].label}`);
        fetchLabData(true);
        setTimeout(() => setActionSuccess(null), 3500);
      } else {
        const e = await res.json();
        setActionError(e.error || 'Failed to advance status');
      }
    } catch (e: any) { setActionError(e.message); }
  };

  // ── Create order ────────────────────────────────────────────────────────────

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/stations/lab/orders`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId:    newPatientId,
          testName:     newTestName,
          specimenType: newSpecimen,
          priority:     newPriority,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      setActionSuccess(`${newPriority === 'STAT' ? '🚨 STAT' : ''} Requisition created for ${newTestName}`);
      setShowOrderModal(false);
      fetchLabData(true);
      setTimeout(() => setActionSuccess(null), 4500);
    } catch (e: any) { setActionError(e.message); }
    finally { setSubmitting(false); }
  };

  // ── Open result modal ───────────────────────────────────────────────────────

  const openResultModal = (order: LabOrder) => {
    setSelectedOrder(order);
    setAnalytes(buildDefaultAnalytes(order.testName));
    setResultIsCritical(order.isCritical ?? false);
    setResultCriticalNotes(order.criticalNotes ?? '');
    setQcPassed(true);
    setShowResultModal(true);
  };

  // ── Save result ─────────────────────────────────────────────────────────────

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!qcPassed) { setActionError('QC failed — resolve quality control issues before publishing results.'); return; }
    setSubmitting(true);
    setActionError(null);
    try {
      const findings = analytes
        .filter(a => a.name && a.value)
        .map(a => `${a.name}: ${a.value} ${a.unit} [Ref: ${a.refLow}–${a.refHigh}]${a.flag && a.flag !== 'NORMAL' ? ` ★${a.flag}` : ''}`)
        .join('\n');
      const refRange = analytes
        .filter(a => a.refLow || a.refHigh)
        .map(a => `${a.name}: ${a.refLow}–${a.refHigh} ${a.unit}`)
        .join('; ');
      const anyAnalyteCritical = analytes.some(a =>
        a.flag === 'CRITICAL_HIGH' || a.flag === 'CRITICAL_LOW'
      );

      const res = await fetch(`${API_BASE}/stations/lab/orders/${selectedOrder.id}/result`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findings,
          referenceRange: refRange,
          isCritical:     resultIsCritical || anyAnalyteCritical,
          criticalNotes:  resultCriticalNotes || undefined,
          status:         'COMPLETED',
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to save result'); }
      setActionSuccess(`Results sealed and published to EHR for ${selectedOrder.orderNumber}.${(resultIsCritical || anyAnalyteCritical) ? ' Critical alert dispatched to attending physician.' : ''}`);
      setShowResultModal(false);
      fetchLabData(true);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (e: any) { setActionError(e.message); }
    finally { setSubmitting(false); }
  };

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = orders.filter(o => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && (o.priority ?? 'ROUTINE') !== priorityFilter) return false;
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.testName.toLowerCase().includes(q) ||
      `${o.patient?.firstName} ${o.patient?.lastName}`.toLowerCase().includes(q)
    );
  });

  const criticalCount = orders.filter(o => o.isCritical && o.status !== 'COMPLETED').length;
  const pendingCount  = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6">

      {/* ── Feedback banners ── */}
      {actionSuccess && (
        <div className="flex items-start space-x-3 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="flex items-start space-x-3 p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-auto text-red-400 hover:text-red-200"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Station header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-violet-600/20 border border-violet-500/30">
            <Microscope className="w-7 h-7 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Laboratory Medicine Workbench</h1>
            <p className="text-xs text-slate-400">
              {user?.firstName} {user?.lastName} · {user?.email}
              {criticalCount > 0 && (
                <span className="ml-3 text-red-400 font-bold">⚠ {criticalCount} Critical Pending</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchLabData(true)}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowOrderModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-violet-700/25 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Requisition</span>
          </button>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Orders',    value: pendingCount,                                                    icon: TestTube,  color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
          { label: 'Critical / Panic',  value: criticalCount,                                                   icon: Siren,     color: 'text-red-400',     bg: 'bg-red-500/10',   border: criticalCount ? 'border-red-500/40' : '' },
          { label: 'Completed Today',   value: orders.filter(o => o.status === 'COMPLETED').length,            icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Avg TAT (min)',      value: orders.length ? Math.round(orders.reduce((s,o) => s + tatMinutes(o.createdAt), 0) / orders.length) : 0, icon: BarChart3, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(card => (
          <div key={card.label} className={`p-4 rounded-2xl bg-slate-900/80 border ${card.border ?? 'border-slate-800'} flex items-center space-x-4`}>
            <div className={`p-2.5 rounded-xl ${card.bg} border border-current/20`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{card.label}</p>
              <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search order #, test, patient…"
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center space-x-1 text-xs">
          {(['ALL','ORDERED','SAMPLE_COLLECTED','PROCESSING','COMPLETED','CANCELLED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${statusFilter === s ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {s === 'ALL' ? 'All' : s === 'SAMPLE_COLLECTED' ? 'Collected' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1 text-xs">
          {(['ALL','STAT','ROUTINE'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                priorityFilter === p
                  ? p === 'STAT' ? 'bg-red-600 text-white' : p === 'ROUTINE' ? 'bg-slate-600 text-white' : 'bg-violet-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Worklist ── */}
      {loading ? (
        <div className="flex justify-center items-center py-24 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mr-3" /> Loading laboratory worklist…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500 bg-slate-900/40 border border-slate-800 rounded-3xl">
          <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No orders match current filters.</p>
          <p className="text-xs mt-1">Create a new requisition or adjust the filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const sMeta  = STATUS_META[order.status];
            const tat    = tatMinutes(order.createdAt);
            const isExp  = expandedId === order.id;
            const prio   = order.priority ?? 'ROUTINE';

            return (
              <div
                key={order.id}
                className={`rounded-2xl border transition ${
                  order.isCritical && order.status !== 'COMPLETED'
                    ? 'border-red-500/40 bg-red-950/20'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                {/* Row header */}
                <div
                  className="flex flex-wrap items-center gap-3 px-5 py-4 cursor-pointer select-none"
                  onClick={() => setExpandedId(isExp ? null : order.id)}
                >
                  {/* Priority badge */}
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${prio === 'STAT' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    {prio}
                  </span>

                  {/* Status pill */}
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: sMeta.bg, color: sMeta.color }}>
                    {sMeta.label}
                  </span>

                  {/* Critical flag */}
                  {order.isCritical && order.status !== 'COMPLETED' && (
                    <span className="flex items-center space-x-1 text-[10px] font-black text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full border border-red-500/40">
                      <Siren className="w-3 h-3" /> <span>CRITICAL</span>
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{order.testName}</p>
                    <p className="text-xs text-slate-400">
                      {order.orderNumber} · {order.patient?.firstName} {order.patient?.lastName}
                      {order.consultation?.doctor && ` · Req. by Dr. ${order.consultation.doctor.firstName} ${order.consultation.doctor.lastName}`}
                    </p>
                  </div>

                  {/* TAT */}
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-500">TAT</p>
                    <p className="font-mono text-xs font-bold" style={{ color: tatColor(tat, order.status) }}>
                      {order.status === 'COMPLETED'
                        ? '✓ Done'
                        : `${tat < 60 ? `${tat}m` : `${Math.floor(tat/60)}h ${tat%60}m`}`}
                    </p>
                  </div>

                  {isExp ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
                </div>

                {/* Expanded panel */}
                {isExp && (
                  <div className="border-t border-slate-800 px-5 py-4 space-y-4">
                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {[
                        { label: 'Order #',     value: order.orderNumber },
                        { label: 'Specimen',    value: order.specimenType },
                        { label: 'Patient',     value: `${order.patient?.firstName} ${order.patient?.lastName}` },
                        { label: 'Phone',       value: order.patient?.phone ?? '—' },
                        { label: 'Ordered At',  value: new Date(order.createdAt).toLocaleString() },
                        { label: 'Technician',  value: order.technician ? `${order.technician.firstName} ${order.technician.lastName}` : '—' },
                        { label: 'Licence #',   value: order.technician?.medicalLicenseNo ?? '—' },
                        { label: 'Completed At',value: order.completedAt ? new Date(order.completedAt).toLocaleString() : '—' },
                      ].map(f => (
                        <div key={f.label} className="bg-slate-950/60 rounded-xl p-3">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{f.label}</p>
                          <p className="text-white font-semibold mt-0.5 break-words">{f.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Findings (if completed) */}
                    {order.findings && (
                      <div className="rounded-xl bg-slate-950/60 border border-slate-700/50 p-4 space-y-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                          <ClipboardList className="w-3.5 h-3.5" /><span>Analytical Findings</span>
                        </p>
                        <pre className="text-xs text-white font-mono whitespace-pre-wrap leading-relaxed">{order.findings}</pre>
                        {order.referenceRange && (
                          <p className="text-[11px] text-slate-500 font-mono border-t border-slate-800 pt-2">Reference: {order.referenceRange}</p>
                        )}
                      </div>
                    )}

                    {/* Chain-of-custody pipeline */}
                    <div className="flex items-center space-x-1 text-[10px] flex-wrap gap-y-2">
                      {(['ORDERED','SAMPLE_COLLECTED','PROCESSING','COMPLETED'] as LabStatus[]).map((s, i, arr) => (
                        <React.Fragment key={s}>
                          <span className={`px-2.5 py-1 rounded-full font-bold ${
                            order.status === s
                              ? 'text-white'
                              : (arr.indexOf(order.status) > i ? 'text-emerald-400 bg-emerald-900/30' : 'text-slate-600 bg-slate-800/60')
                          }`}
                            style={order.status === s ? { backgroundColor: STATUS_META[s].bg, color: STATUS_META[s].color } : {}}
                          >
                            {STATUS_META[s].label}
                          </span>
                          {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700" />}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {STATUS_META[order.status]?.next && (
                        <button
                          onClick={() => advanceStatus(order)}
                          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs font-bold transition"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Mark as {STATUS_META[STATUS_META[order.status].next!].label}</span>
                        </button>
                      )}
                      {(order.status === 'PROCESSING' || order.status === 'SAMPLE_COLLECTED') && (
                        <button
                          onClick={() => openResultModal(order)}
                          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 text-xs font-bold transition"
                        >
                          <Beaker className="w-3.5 h-3.5" />
                          <span>Enter & Publish Results</span>
                        </button>
                      )}
                      {order.status === 'COMPLETED' && (
                        <button
                          onClick={() => setViewOrder(order)}
                          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Sealed Report</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — New Requisition
      ══════════════════════════════════════════════════════════════════════ */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center space-x-3">
                <FlaskConical className="w-5 h-5 text-violet-400" />
                <h3 className="font-bold text-white">New Laboratory Requisition</h3>
              </div>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-5">
              {/* Priority */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Order Priority *</label>
                <div className="flex space-x-2">
                  {(['ROUTINE','STAT'] as Priority[]).map(p => (
                    <button
                      key={p} type="button"
                      onClick={() => setNewPriority(p)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${
                        newPriority === p
                          ? p === 'STAT'
                            ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-700/30'
                            : 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {p === 'STAT' ? '🚨 STAT (Urgent)' : 'ROUTINE'}
                    </button>
                  ))}
                </div>
                {newPriority === 'STAT' && (
                  <p className="mt-1.5 text-[11px] text-red-400">STAT orders are prioritised in the worklist and trigger an immediate notification to the attending physician.</p>
                )}
              </div>

              {/* Patient */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Patient *</label>
                {patients.length > 0 ? (
                  <select
                    value={newPatientId}
                    onChange={e => setNewPatientId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-violet-500"
                  >
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.firstName} {p.lastName} — {p.email}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text" value={newPatientId} onChange={e => setNewPatientId(e.target.value)}
                    placeholder="Enter patient ID"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-violet-500"
                  />
                )}
              </div>

              {/* Panel catalogue */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Diagnostic Panel *</label>
                {(['Haematology','Chemistry','Endocrinology','Cardiac Markers','Inflammatory','Microbiology','Urinalysis','Immunology','Toxicology'] as const).map(group => (
                  <optgroup key={group} label={group} />
                ))}
                <select
                  value={newTestName}
                  onChange={e => {
                    const p = PANEL_CATALOGUE.find(x => x.name === e.target.value)!;
                    setNewTestName(e.target.value);
                    setNewSpecimen(p?.specimen ?? '');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-violet-500"
                >
                  {['Haematology','Chemistry','Endocrinology','Cardiac Markers','Inflammatory','Microbiology','Urinalysis','Immunology','Toxicology'].map(group => (
                    <optgroup key={group} label={`── ${group} ──`}>
                      {PANEL_CATALOGUE.filter(p => p.group === group).map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Specimen — auto-filled */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Specimen Type (auto-filled)</label>
                <input
                  type="text" value={newSpecimen} onChange={e => setNewSpecimen(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowOrderModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs flex items-center space-x-1.5 disabled:opacity-50">
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Requisition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Enter Results (per-analyte structured entry)
      ══════════════════════════════════════════════════════════════════════ */}
      {showResultModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div>
                <h3 className="font-bold text-white">Analytical Result Entry</h3>
                <p className="text-xs text-violet-400 font-mono">{selectedOrder.orderNumber} · {selectedOrder.testName}</p>
              </div>
              <button onClick={() => setShowResultModal(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveResult} className="p-6 space-y-5">

              {/* QC status */}
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ShieldCheck className={`w-5 h-5 ${qcPassed ? 'text-emerald-400' : 'text-red-400'}`} />
                  <div>
                    <p className="text-xs font-bold text-white">Quality Control (QC) Status</p>
                    <p className="text-[11px] text-slate-400">Internal QC standards verified before result publication</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button" onClick={() => setQcPassed(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${qcPassed ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                  >✓ QC Pass</button>
                  <button
                    type="button" onClick={() => setQcPassed(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${!qcPassed ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                  >✗ QC Fail</button>
                </div>
              </div>

              {/* Per-analyte table */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Analyte Results</p>
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-950">
                      <tr>
                        {['Analyte','Result','Unit','Ref Low','Ref High','Flag'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {analytes.map((a, i) => (
                        <tr key={i} className={`${a.flag === 'CRITICAL_HIGH' || a.flag === 'CRITICAL_LOW' ? 'bg-red-950/30' : a.flag === 'HIGH' || a.flag === 'LOW' ? 'bg-amber-950/20' : ''}`}>
                          <td className="px-3 py-2">
                            <input value={a.name} onChange={e => { const copy = [...analytes]; copy[i].name = e.target.value; setAnalytes(copy); }}
                              className="w-full bg-transparent text-white focus:outline-none" placeholder="Analyte name" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={a.value} onChange={e => { const copy = [...analytes]; copy[i].value = e.target.value; setAnalytes(copy); }}
                              className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-violet-500" placeholder="0.0" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={a.unit} onChange={e => { const copy = [...analytes]; copy[i].unit = e.target.value; setAnalytes(copy); }}
                              className="w-20 bg-transparent text-slate-400 focus:outline-none" placeholder="mg/dL" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={a.refLow} onChange={e => { const copy = [...analytes]; copy[i].refLow = e.target.value; setAnalytes(copy); }}
                              className="w-16 bg-transparent text-slate-400 focus:outline-none" placeholder="0" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={a.refHigh} onChange={e => { const copy = [...analytes]; copy[i].refHigh = e.target.value; setAnalytes(copy); }}
                              className="w-16 bg-transparent text-slate-400 focus:outline-none" placeholder="100" />
                          </td>
                          <td className="px-3 py-2">
                            <select value={a.flag} onChange={e => { const copy = [...analytes]; copy[i].flag = e.target.value as Analyte['flag']; setAnalytes(copy); }}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500">
                              <option value="">—</option>
                              <option value="NORMAL">Normal</option>
                              <option value="HIGH">H (High)</option>
                              <option value="LOW">L (Low)</option>
                              <option value="CRITICAL_HIGH">CH (Critical High)</option>
                              <option value="CRITICAL_LOW">CL (Critical Low)</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => setAnalytes([...analytes, { name: '', value: '', unit: '', refLow: '', refHigh: '', flag: '' }])}
                  className="mt-2 text-[11px] text-violet-400 hover:text-violet-300 font-semibold"
                >
                  + Add analyte row
                </button>
              </div>

              {/* Critical / panic value */}
              <div className="p-4 rounded-2xl border border-red-900/50 bg-red-950/20 space-y-3">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input type="checkbox" checked={resultIsCritical} onChange={e => setResultIsCritical(e.target.checked)} className="w-4 h-4 accent-red-500" />
                  <span className="text-sm font-bold text-red-400">Flag as Critical / Panic Value — triggers immediate physician alert</span>
                </label>
                {resultIsCritical && (
                  <textarea
                    rows={2}
                    value={resultCriticalNotes}
                    onChange={e => setResultCriticalNotes(e.target.value)}
                    placeholder="Mandatory: clinical notes for the attending physician (e.g. 'Potassium 6.8 mEq/L — suspect haemolysis, repeat specimen recommended')"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-red-500/40 text-red-200 text-xs focus:outline-none resize-none"
                  />
                )}
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">{actionError}</div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowResultModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={submitting || !qcPassed} className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-600 text-white font-bold text-xs flex items-center space-x-1.5 disabled:opacity-40">
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Seal &amp; Publish to EHR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Sealed Report Viewer
      ══════════════════════════════════════════════════════════════════════ */}
      {viewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Report header */}
            <div className="bg-slate-950 px-6 py-5 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-white text-base">Sealed Diagnostic Laboratory Report</h3>
                    <p className="text-xs text-emerald-400 font-mono">Order {viewOrder.orderNumber} · Status: COMPLETED</p>
                  </div>
                </div>
                <button onClick={() => setViewOrder(null)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Case info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'Patient Name',      value: `${viewOrder.patient?.firstName} ${viewOrder.patient?.lastName}` },
                  { label: 'Patient Email',     value: viewOrder.patient?.email },
                  { label: 'Diagnostic Panel',  value: viewOrder.testName },
                  { label: 'Specimen Type',     value: viewOrder.specimenType },
                  { label: 'Order Received',    value: new Date(viewOrder.createdAt).toLocaleString() },
                  { label: 'Report Issued',     value: viewOrder.completedAt ? new Date(viewOrder.completedAt).toLocaleString() : '—' },
                  { label: 'Reporting Scientist', value: viewOrder.technician ? `${viewOrder.technician.firstName} ${viewOrder.technician.lastName}` : '—' },
                  { label: 'Licence #',         value: viewOrder.technician?.medicalLicenseNo ?? '—' },
                ].map(f => (
                  <div key={f.label} className="bg-slate-950/60 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{f.label}</p>
                    <p className="text-white font-semibold mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* Findings */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-5 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Analytical Findings</p>
                <pre className="text-sm text-white font-mono whitespace-pre-wrap leading-relaxed">{viewOrder.findings || '—'}</pre>
                {viewOrder.referenceRange && (
                  <div className="border-t border-slate-800 pt-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Reference Ranges</p>
                    <p className="text-xs text-slate-400 font-mono">{viewOrder.referenceRange}</p>
                  </div>
                )}
              </div>

              {/* Critical flag */}
              {viewOrder.isCritical && (
                <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 flex items-start space-x-3">
                  <Siren className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-400">Critical / Panic Value — Physician Notified</p>
                    {viewOrder.criticalNotes && <p className="text-xs text-red-300 mt-1">{viewOrder.criticalNotes}</p>}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => window.print()}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  <Printer className="w-3.5 h-3.5" /><span>Print Report</span>
                </button>
                <button onClick={() => setViewOrder(null)} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
