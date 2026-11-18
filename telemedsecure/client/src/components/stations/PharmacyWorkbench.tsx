/**
 * Pharmacy Station Workbench — Full Clinical Standard
 *
 * Covers:
 *  • Prescriptions Queue with status filter, expand-row detail, dispense confirmation
 *  • Drug Inventory with colour-coded rows (expired/low stock), sort, Restock modal
 *  • Add Drug modal — full validated form
 *  • Dispensing Log — filtered DISPENSED view
 *  • Stats bar — pending, dispensed today, low-stock alerts, restricted count
 *  • Search across all tabs
 *  • Lucide icons only — no emojis
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  Pill,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  RefreshCw,
  Search,
  X,
  PackageCheck,
  Boxes,
  TrendingDown,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Filter,
  ArrowUpDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PrescriptionStatus = 'ISSUED' | 'DISPENSED' | 'REVOKED';
type DosageForm = 'TABLET' | 'CAPSULE' | 'LIQUID' | 'INJECTION' | 'INHALER' | 'PATCH' | 'CREAM' | 'DROPS';
type SortKey = 'name' | 'stock' | 'expiry';
type ActiveTab = 'prescriptions' | 'inventory' | 'log';

interface PrescriptionItem {
  medication: string;
  dosage: string;
  instructions: string;
  isRestricted?: boolean;
}

interface Prescription {
  id: string;
  consultationId: string;
  doctorId: string;
  status: PrescriptionStatus;
  statusReason?: string | null;
  createdAt: string;
  items: PrescriptionItem[];
  doctor: { firstName: string; lastName: string };
  consultation: {
    scheduledAt: string;
    patient: { firstName: string; lastName: string; email: string; phone?: string };
  };
}

interface MedicationInventory {
  id: string;
  ndc: string;
  name: string;
  genericName?: string | null;
  dosageForm: DosageForm;
  strength: string;
  stockQuantity: number;
  reorderLevel: number;
  unitPrice: number;
  manufacturer?: string | null;
  expiryDate: string;
  isRestricted: boolean;
  createdAt: string;
}

interface PharmacyStats {
  pendingDispense?: number;
  dispensedToday?: number;
  lowStockAlerts?: number;
  restrictedOnHand?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<PrescriptionStatus, { label: string; color: string; bg: string; border: string }> = {
  ISSUED:    { label: 'Issued',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' },
  DISPENSED: { label: 'Dispensed', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  REVOKED:   { label: 'Revoked',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'  },
};

const DOSAGE_FORMS: DosageForm[] = ['TABLET', 'CAPSULE', 'LIQUID', 'INJECTION', 'INHALER', 'PATCH', 'CREAM', 'DROPS'];

function isExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date();
}

function isLowStock(med: MedicationInventory): boolean {
  return med.stockQuantity < med.reorderLevel;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PharmacyWorkbench() {
  const { user, getAuthHeaders } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState<ActiveTab>('prescriptions');
  const [prescriptions, setPrescriptions]   = useState<Prescription[]>([]);
  const [inventory, setInventory]           = useState<MedicationInventory[]>([]);
  const [stats, setStats]                   = useState<PharmacyStats | null>(null);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [searchTerm, setSearchTerm]         = useState('');
  const [statusFilter, setStatusFilter]     = useState<PrescriptionStatus | 'ALL'>('ALL');
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [sortKey, setSortKey]               = useState<SortKey>('name');

  // Modals
  const [showAddDrugModal, setShowAddDrugModal]     = useState(false);
  const [restockTarget, setRestockTarget]           = useState<MedicationInventory | null>(null);
  const [dispenseTarget, setDispenseTarget]         = useState<Prescription | null>(null);

  // Feedback
  const [actionSuccess, setActionSuccess]   = useState<string | null>(null);
  const [actionError, setActionError]       = useState<string | null>(null);
  const [submitting, setSubmitting]         = useState(false);

  // Add Drug form
  const [drugNdc, setDrugNdc]               = useState('');
  const [drugName, setDrugName]             = useState('');
  const [drugGeneric, setDrugGeneric]       = useState('');
  const [drugForm, setDrugForm]             = useState<DosageForm>('TABLET');
  const [drugStrength, setDrugStrength]     = useState('');
  const [drugStock, setDrugStock]           = useState('100');
  const [drugReorder, setDrugReorder]       = useState('20');
  const [drugPrice, setDrugPrice]           = useState('');
  const [drugMfr, setDrugMfr]               = useState('');
  const [drugExpiry, setDrugExpiry]         = useState('');
  const [drugRestricted, setDrugRestricted] = useState(false);

  // Restock form
  const [restockQty, setRestockQty]         = useState('50');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const h = getAuthHeaders();
      const [rxRes, invRes, statRes] = await Promise.all([
        fetch(`${API_BASE}/prescriptions`, { headers: h }),
        fetch(`${API_BASE}/stations/pharmacy/inventory`, { headers: h }),
        fetch(`${API_BASE}/stations/pharmacy/stats`, { headers: h }),
      ]);
      if (rxRes.ok)   setPrescriptions(await rxRes.json());
      if (invRes.ok)  setInventory(await invRes.json());
      if (statRes.ok) setStats(await statRes.json());
    } catch (e) {
      console.error('Pharmacy fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => { fetchAll(); }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const confirmDispense = async () => {
    if (!dispenseTarget) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/prescriptions/${dispenseTarget.id}/dispense`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to dispense prescription');
      }
      setActionSuccess(`Prescription RX-${dispenseTarget.id.slice(0, 8).toUpperCase()} dispensed successfully.`);
      setDispenseTarget(null);
      fetchAll(true);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestock = async () => {
    if (!restockTarget) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/stations/pharmacy/inventory/${restockTarget.id}/stock`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(restockQty) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to restock');
      }
      setActionSuccess(`${restockTarget.name} restocked by ${restockQty} units.`);
      setRestockTarget(null);
      fetchAll(true);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDrug = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/stations/pharmacy/inventory`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ndc: drugNdc,
          name: drugName,
          genericName: drugGeneric || undefined,
          dosageForm: drugForm,
          strength: drugStrength,
          stockQuantity: Number(drugStock),
          reorderLevel: Number(drugReorder),
          unitPrice: Number(drugPrice),
          manufacturer: drugMfr || undefined,
          expiryDate: drugExpiry,
          isRestricted: drugRestricted,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to add drug');
      }
      setActionSuccess(`${drugName} added to formulary.`);
      setShowAddDrugModal(false);
      resetAddDrugForm();
      fetchAll(true);
      setTimeout(() => setActionSuccess(null), 4500);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAddDrugForm = () => {
    setDrugNdc(''); setDrugName(''); setDrugGeneric(''); setDrugForm('TABLET');
    setDrugStrength(''); setDrugStock('100'); setDrugReorder('20'); setDrugPrice('');
    setDrugMfr(''); setDrugExpiry(''); setDrugRestricted(false);
  };

  // ── Derived / filtered data ────────────────────────────────────────────────

  const filteredPrescriptions = prescriptions.filter(rx => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      rx.id.toLowerCase().includes(q) ||
      `${rx.consultation?.patient?.firstName} ${rx.consultation?.patient?.lastName}`.toLowerCase().includes(q) ||
      rx.items.some(i => i.medication.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'ALL' || rx.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sortedInventory = [...inventory]
    .filter(med => {
      const q = searchTerm.toLowerCase();
      return (
        !q ||
        med.name.toLowerCase().includes(q) ||
        (med.genericName ?? '').toLowerCase().includes(q) ||
        med.ndc.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortKey === 'stock')  return a.stockQuantity - b.stockQuantity;
      if (sortKey === 'expiry') return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      return a.name.localeCompare(b.name);
    });

  const dispensedLog = prescriptions.filter(rx => {
    const q = searchTerm.toLowerCase();
    return (
      rx.status === 'DISPENSED' &&
      (!q ||
        `${rx.consultation?.patient?.firstName} ${rx.consultation?.patient?.lastName}`.toLowerCase().includes(q) ||
        rx.items.some(i => i.medication.toLowerCase().includes(q)))
    );
  });

  // Computed stats fallbacks
  const statPending    = stats?.pendingDispense  ?? prescriptions.filter(r => r.status === 'ISSUED').length;
  const statDispensed  = stats?.dispensedToday   ?? prescriptions.filter(r => r.status === 'DISPENSED').length;
  const statLowStock   = stats?.lowStockAlerts   ?? inventory.filter(isLowStock).length;
  const statRestricted = stats?.restrictedOnHand ?? inventory.filter(m => m.isRestricted).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="ml-3 text-slate-400 text-sm">Loading Pharmacy Workbench…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Banners ── */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Dispensation</span>
          <div className="text-2xl font-black text-amber-400 tracking-tight">{statPending}</div>
          <p className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" /> Awaiting pickup
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dispensed Today</span>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">{statDispensed}</div>
          <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <PackageCheck className="w-3 h-3" /> Patient pickups cleared
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Low-Stock Alerts</span>
          <div className="text-2xl font-black text-rose-400 tracking-tight">{statLowStock}</div>
          <p className="text-[11px] text-rose-400 font-mono flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Below reorder threshold
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Restricted Drugs</span>
          <div className="text-2xl font-black text-violet-400 tracking-tight">{statRestricted}</div>
          <p className="text-[11px] text-violet-400 font-mono flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Controlled substances on hand
          </p>
        </div>
      </div>

      {/* ── Main Workbench Panel ── */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Pharmacy Dispensing &amp; Drug Safety Station</h3>
              <p className="text-xs text-slate-400">Prescription queue, inventory management, and dispensing log</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, drug…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48"
              />
            </div>
            {/* Refresh */}
            <button
              onClick={() => fetchAll(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {/* Tab Switcher */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('prescriptions')}
                className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'prescriptions' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Rx Queue ({prescriptions.filter(r => r.status === 'ISSUED').length})
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'inventory' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Inventory ({inventory.length})
              </button>
              <button
                onClick={() => setActiveTab('log')}
                className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'log' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Dispensing Log
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab: Prescriptions Queue ── */}
        {activeTab === 'prescriptions' && (
          <div>
            {/* Status filter */}
            <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              {(['ALL', 'ISSUED', 'DISPENSED', 'REVOKED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition border ${
                    statusFilter === s
                      ? 'bg-cyan-600 border-cyan-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {filteredPrescriptions.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Pill className="w-10 h-10 mx-auto mb-2 opacity-30 text-cyan-400" />
                <p className="text-sm font-semibold text-slate-400">No prescriptions match the current filter</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredPrescriptions.map(rx => {
                  const meta = STATUS_META[rx.status];
                  const hasRestricted = rx.items.some(i => i.isRestricted);
                  const isExpanded = expandedId === rx.id;
                  return (
                    <div key={rx.id} className="hover:bg-slate-800/30 transition">
                      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Left */}
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Status badge */}
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
                              style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
                            >
                              {meta.label}
                            </span>
                            <span className="text-xs font-mono text-cyan-400 font-bold">
                              RX-{rx.id.slice(0, 8).toUpperCase()}
                            </span>
                            {hasRestricted && (
                              <span className="flex items-center gap-1 text-[11px] text-violet-400 font-bold">
                                <ShieldAlert className="w-3.5 h-3.5" /> Controlled Substance
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatDate(rx.createdAt)}
                            </span>
                          </div>

                          <div>
                            <span className="text-sm font-bold text-white">
                              {rx.consultation?.patient
                                ? `${rx.consultation.patient.firstName} ${rx.consultation.patient.lastName}`
                                : 'Unknown Patient'}
                            </span>
                            <span className="text-xs text-slate-400 ml-2">
                              via Dr. {rx.doctor?.firstName} {rx.doctor?.lastName}
                            </span>
                          </div>

                          {/* Drug summary pills */}
                          <div className="flex flex-wrap gap-1.5">
                            {rx.items.slice(0, 3).map((item, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-300">
                                <strong className="text-white">{item.medication}</strong> {item.dosage}
                                {item.isRestricted && <ShieldAlert className="inline w-3 h-3 text-violet-400 ml-1" />}
                              </span>
                            ))}
                            {rx.items.length > 3 && (
                              <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-400">
                                +{rx.items.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : rx.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                            title="Expand details"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          {rx.status === 'ISSUED' && (
                            <button
                              onClick={() => setDispenseTarget(rx)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              Dispense
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expand row */}
                      {isExpanded && (
                        <div className="px-5 pb-5">
                          <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Prescription Items</p>
                            {rx.items.map((item, i) => (
                              <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                                <Pill className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white">{item.medication}</span>
                                    <span className="text-[11px] text-slate-400 font-mono">{item.dosage}</span>
                                    {item.isRestricted && (
                                      <span className="flex items-center gap-1 text-[10px] text-violet-400 font-bold">
                                        <ShieldAlert className="w-3 h-3" /> Controlled
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5">{item.instructions}</p>
                                </div>
                              </div>
                            ))}
                            {rx.consultation?.patient && (
                              <div className="mt-2 text-[11px] text-slate-400 flex gap-4">
                                <span>Patient email: <span className="text-white">{rx.consultation.patient.email}</span></span>
                                {rx.consultation.patient.phone && (
                                  <span>Phone: <span className="text-white">{rx.consultation.patient.phone}</span></span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Drug Inventory ── */}
        {activeTab === 'inventory' && (
          <div>
            <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Sort by:</span>
                {(['name', 'stock', 'expiry'] as SortKey[]).map(k => (
                  <button
                    key={k}
                    onClick={() => setSortKey(k)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition capitalize ${
                      sortKey === k
                        ? 'bg-cyan-600 border-cyan-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAddDrugModal(true)}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Drug
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">NDC</th>
                    <th className="px-4 py-3">Drug Name (Generic)</th>
                    <th className="px-4 py-3">Form</th>
                    <th className="px-4 py-3">Strength</th>
                    <th className="px-4 py-3">Manufacturer</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Reorder Lvl</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3">Flags</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedInventory.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                        <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30 text-cyan-400" />
                        <p>No drugs in formulary</p>
                      </td>
                    </tr>
                  ) : sortedInventory.map(med => {
                    const expired = isExpired(med.expiryDate);
                    const lowStock = isLowStock(med);
                    const rowClass = expired
                      ? 'bg-rose-950/20 hover:bg-rose-950/30'
                      : lowStock
                      ? 'bg-amber-950/20 hover:bg-amber-950/30'
                      : 'hover:bg-slate-800/30';
                    return (
                      <tr key={med.id} className={`transition ${rowClass}`}>
                        <td className="px-4 py-3 font-mono text-cyan-400 text-[11px]">{med.ndc}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-white">{med.name}</span>
                          {med.genericName && (
                            <span className="text-[10px] text-slate-400 block">{med.genericName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono">
                            {med.dosageForm}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">{med.strength}</td>
                        <td className="px-4 py-3 text-slate-400">{med.manufacturer ?? '—'}</td>
                        <td className="px-4 py-3 font-mono">
                          <span className={`font-bold ${lowStock ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {med.stockQuantity}
                          </span>
                          {lowStock && (
                            <span className="flex items-center gap-0.5 text-[10px] text-rose-500 mt-0.5">
                              <TrendingDown className="w-3 h-3" /> Low
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400">{med.reorderLevel}</td>
                        <td className="px-4 py-3 font-mono">${med.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-[11px] ${expired ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                            {formatDate(med.expiryDate)}
                            {expired && <span className="block text-[10px] text-rose-500">EXPIRED</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {med.isRestricted && (
                            <span className="flex items-center gap-1 text-[10px] text-violet-400 font-bold">
                              <ShieldAlert className="w-3 h-3" /> CII
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { setRestockTarget(med); setRestockQty('50'); }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-900 text-cyan-400 border border-slate-700 hover:border-cyan-600 text-[11px] font-semibold transition"
                          >
                            Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab: Dispensing Log ── */}
        {activeTab === 'log' && (
          <div>
            <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">
                {dispensedLog.length} dispensed prescription{dispensedLog.length !== 1 ? 's' : ''} on record
              </span>
            </div>

            {dispensedLog.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-400" />
                <p className="text-sm font-semibold text-slate-400">No dispensed prescriptions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Rx #</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Prescribing Doctor</th>
                      <th className="px-4 py-3">Drugs Dispensed</th>
                      <th className="px-4 py-3">Issued At</th>
                      <th className="px-4 py-3">Pharmacist</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {dispensedLog.map(rx => (
                      <tr key={rx.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3.5 font-mono text-emerald-400 font-bold">
                          RX-{rx.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-white">
                          {rx.consultation?.patient
                            ? `${rx.consultation.patient.firstName} ${rx.consultation.patient.lastName}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">
                          Dr. {rx.doctor?.firstName} {rx.doctor?.lastName}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {rx.items.map((item, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono">
                                {item.medication} {item.dosage}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                          {formatDateTime(rx.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">
                          {user ? `${user.firstName} ${user.lastName}` : 'Pharmacy Staff'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Dispense Confirmation ── */}
      {dispenseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-400" />
                Confirm Dispense
              </h3>
              <button onClick={() => setDispenseTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-slate-300 space-y-2">
              <p>
                Dispense prescription{' '}
                <span className="font-mono text-cyan-400 font-bold">RX-{dispenseTarget.id.slice(0, 8).toUpperCase()}</span> for{' '}
                <span className="font-bold text-white">
                  {dispenseTarget.consultation?.patient?.firstName} {dispenseTarget.consultation?.patient?.lastName}
                </span>
                ?
              </p>
              <div className="rounded-xl bg-slate-800/60 p-3 space-y-1.5 text-xs">
                {dispenseTarget.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Pill className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <span className="text-white font-semibold">{item.medication}</span>
                    <span className="text-slate-400">{item.dosage}</span>
                    {item.isRestricted && <ShieldAlert className="w-3.5 h-3.5 text-violet-400" />}
                  </div>
                ))}
              </div>
              {dispenseTarget.items.some(i => i.isRestricted) && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-violet-950/40 border border-violet-500/30 text-[11px] text-violet-300">
                  <ShieldAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-violet-400" />
                  This prescription contains controlled substances. Ensure DEA compliance before dispensing.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDispenseTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDispense}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
                Dispense Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Restock ── */}
      {restockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-cyan-400" />
                Restock Medication
              </h3>
              <button onClick={() => setRestockTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Drug</p>
                <p className="font-bold text-white">{restockTarget.name}</p>
                {restockTarget.genericName && (
                  <p className="text-[11px] text-slate-400">{restockTarget.genericName}</p>
                )}
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Current Stock</p>
                  <p className={`text-lg font-black ${isLowStock(restockTarget) ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {restockTarget.stockQuantity} units
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Reorder Level</p>
                  <p className="text-lg font-black text-slate-300">{restockTarget.reorderLevel} units</p>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Quantity to Add
                </label>
                <input
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={e => setRestockQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  New stock will be: <span className="text-emerald-400 font-bold">{restockTarget.stockQuantity + Number(restockQty || 0)} units</span>
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setRestockTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRestock}
                disabled={submitting || !restockQty || Number(restockQty) <= 0}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Boxes className="w-3.5 h-3.5" />}
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Drug ── */}
      {showAddDrugModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pill className="w-5 h-5 text-cyan-400" />
                Add Drug to Formulary
              </h3>
              <button onClick={() => { setShowAddDrugModal(false); resetAddDrugForm(); }} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDrug} className="space-y-3">
              {/* NDC */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">NDC Code *</label>
                <input
                  type="text"
                  value={drugNdc}
                  onChange={e => setDrugNdc(e.target.value)}
                  required
                  placeholder="e.g. 12345-6789-01"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Brand Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Brand Name *</label>
                <input
                  type="text"
                  value={drugName}
                  onChange={e => setDrugName(e.target.value)}
                  required
                  placeholder="e.g. Amoxil"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Generic Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Generic Name</label>
                <input
                  type="text"
                  value={drugGeneric}
                  onChange={e => setDrugGeneric(e.target.value)}
                  placeholder="e.g. Amoxicillin"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Form + Strength */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dosage Form *</label>
                  <select
                    value={drugForm}
                    onChange={e => setDrugForm(e.target.value as DosageForm)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  >
                    {DOSAGE_FORMS.map(f => (
                      <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Strength *</label>
                  <input
                    type="text"
                    value={drugStrength}
                    onChange={e => setDrugStrength(e.target.value)}
                    required
                    placeholder="e.g. 500mg"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Stock + Reorder */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Initial Stock Qty *</label>
                  <input
                    type="number"
                    min="0"
                    value={drugStock}
                    onChange={e => setDrugStock(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reorder Level *</label>
                  <input
                    type="number"
                    min="0"
                    value={drugReorder}
                    onChange={e => setDrugReorder(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Price + Manufacturer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={drugPrice}
                    onChange={e => setDrugPrice(e.target.value)}
                    required
                    placeholder="e.g. 12.50"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={drugMfr}
                    onChange={e => setDrugMfr(e.target.value)}
                    placeholder="e.g. GSK"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry Date *</label>
                <input
                  type="date"
                  value={drugExpiry}
                  onChange={e => setDrugExpiry(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Restricted checkbox */}
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700 cursor-pointer hover:border-violet-500/50 transition">
                <input
                  type="checkbox"
                  checked={drugRestricted}
                  onChange={e => setDrugRestricted(e.target.checked)}
                  className="w-4 h-4 accent-violet-500"
                />
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-violet-400" />
                  <div>
                    <span className="font-bold text-white text-xs">Controlled Substance (Restricted)</span>
                    <p className="text-[10px] text-slate-400">DEA Schedule II–V; requires EPCS compliance</p>
                  </div>
                </div>
              </label>

              {actionError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
                  {actionError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowAddDrugModal(false); resetAddDrugForm(); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                  Save to Formulary
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
