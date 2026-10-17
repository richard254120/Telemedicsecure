import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  FileText,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  PlusCircle,
  RefreshCw,
  Send,
  Eye,
  Printer,
  ChevronRight,
  UserCheck,
  Stethoscope,
  Activity,
  Layers,
  FileCheck2,
  X,
  ExternalLink,
  Receipt,
  Download
} from 'lucide-react';

interface BillingStats {
  summary: {
    totalInvoices: number;
    totalBilled: number;
    totalCollected: number;
    totalPatientDue: number;
    totalInsuranceCovered: number;
    pendingInvoicesCount: number;
    paidInvoicesCount: number;
  };
  claimsMetrics: {
    totalClaims: number;
    submittedClaims: number;
    approvedClaims: number;
    deniedClaims: number;
    cleanClaimRate: string;
  };
  arAging: {
    current: number;
    days31to60: number;
    days61to90: number;
    over90Days: number;
  };
}

export default function BillingOfficerWorkbench() {
  const { getAuthHeaders } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'unbilled' | 'claims' | 'invoices' | 'eligibility'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [unbilledEncounters, setUnbilledEncounters] = useState<any[]>([]);
  const [codesDictionary, setCodesDictionary] = useState<{ cptCodes: any[]; icd10Codes: any[]; payers: any[] }>({
    cptCodes: [],
    icd10Codes: [],
    payers: []
  });

  // Action status banners
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<any | null>(null);
  const [showGenerateInvoiceModal, setShowGenerateInvoiceModal] = useState<boolean>(false);
  const [selectedEncounterForBill, setSelectedEncounterForBill] = useState<any | null>(null);
  const [showAdjudicateModal, setShowAdjudicateModal] = useState<boolean>(false);
  const [selectedClaimForAdjudication, setSelectedClaimForAdjudication] = useState<any | null>(null);
  const [adjudicateStatus, setAdjudicateStatus] = useState<'APPROVED' | 'DENIED' | 'APPEALED'>('APPROVED');
  const [adjudicateAmount, setAdjudicateAmount] = useState<string>('');
  const [adjudicateDenialReason, setAdjudicateDenialReason] = useState<string>('');

  // Invoice Generation Form
  const [formPatientId, setFormPatientId] = useState('');
  const [formConsultationId, setFormConsultationId] = useState('');
  const [formPayer, setFormPayer] = useState('BlueCross BlueShield');
  const [formPolicy, setFormPolicy] = useState('POL-BCBS-98421');
  const [formIcd10, setFormIcd10] = useState('I10');
  const [formItems, setFormItems] = useState<Array<{ serviceType: string; cptCode: string; description: string; quantity: number; unitPrice: number }>>([
    { serviceType: 'CONSULTATION', cptCode: '99214', description: 'Office/Outpatient Telehealth Visit, Level 4 (30-39 min)', quantity: 1, unitPrice: 165.0 }
  ]);
  const [formAutoSubmitClaim, setFormAutoSubmitClaim] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Eligibility Verification Form
  const [eligPatientId, setEligPatientId] = useState('');
  const [eligPayer, setEligPayer] = useState('BlueCross BlueShield');
  const [eligPolicy, setEligPolicy] = useState('BCBS-778239');
  const [eligResult, setEligResult] = useState<any | null>(null);
  const [eligVerifying, setEligVerifying] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [statsRes, invRes, clmRes, unbilledRes, codesRes] = await Promise.all([
        fetch(`${API_BASE}/billing/stats`, { headers }),
        fetch(`${API_BASE}/billing/invoices`, { headers }),
        fetch(`${API_BASE}/billing/claims`, { headers }),
        fetch(`${API_BASE}/billing/unbilled-encounters`, { headers }),
        fetch(`${API_BASE}/billing/codes`, { headers })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
      if (clmRes.ok) setClaims(await clmRes.json());
      if (unbilledRes.ok) setUnbilledEncounters(await unbilledRes.json());
      if (codesRes.ok) setCodesDictionary(await codesRes.json());
    } catch (err: any) {
      console.error('Failed to load billing data', err);
      setActionError('Error connecting to billing microservices.');
    } finally {
      setLoading(false);
    }
  };

  const openBillModalForEncounter = (enc: any) => {
    setSelectedEncounterForBill(enc);
    setFormPatientId(enc.patient?.id || '');
    setFormConsultationId(enc.consultationId);
    setFormPayer(enc.insurance?.payerName || 'BlueCross BlueShield');
    setFormPolicy(enc.insurance?.policyNumber || 'POL-DEFAULT');
    
    // Auto-populate items based on clinical actions
    const items = [
      {
        serviceType: 'CONSULTATION',
        cptCode: '99214',
        description: `Telehealth Encounter w/ Dr. ${enc.doctor?.lastName || 'Physician'} (Level 4)`,
        quantity: 1,
        unitPrice: 165.0
      }
    ];

    if (enc.clinicalFlagsCount > 0) {
      items.push({
        serviceType: 'TRIAGE',
        cptCode: '99058',
        description: 'Triage Acuity Surcharge & Clinical Vital Flag Monitoring',
        quantity: 1,
        unitPrice: 50.0
      });
    }

    if (enc.prescriptionsCount > 0) {
      items.push({
        serviceType: 'MEDICATION',
        cptCode: 'RX-DISP',
        description: 'E-Prescription Verification & Dispensing Administration',
        quantity: 1,
        unitPrice: 25.0
      });
    }

    setFormItems(items);
    setShowGenerateInvoiceModal(true);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setActionError(null);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/billing/invoices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: formPatientId,
          consultationId: formConsultationId || undefined,
          payerName: formPayer,
          policyNumber: formPolicy,
          icd10Codes: [formIcd10],
          cptCodes: formItems.map(i => i.cptCode),
          items: formItems,
          autoSubmitClaim: formAutoSubmitClaim
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate invoice');
      }

      const data = await res.json();
      setActionSuccess(`Superbill ${data.invoice.invoiceNumber} successfully created & claim queued.`);
      setShowGenerateInvoiceModal(false);
      fetchBillingData();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleAdjudicateClaim = async () => {
    if (!selectedClaimForAdjudication) return;
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/billing/claims/${selectedClaimForAdjudication.id}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: adjudicateStatus,
          approvedAmount: adjudicateStatus === 'APPROVED' ? Number(adjudicateAmount) : undefined,
          denialReason: adjudicateStatus === 'DENIED' ? adjudicateDenialReason : undefined
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to adjudicate claim');
      }

      setActionSuccess(`Claim ${selectedClaimForAdjudication.claimNumber} adjudicated as ${adjudicateStatus}.`);
      setShowAdjudicateModal(false);
      fetchBillingData();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleVerifyEligibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eligPatientId) {
      setActionError('Please select a patient to verify.');
      return;
    }
    setEligVerifying(true);
    setActionError(null);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/billing/eligibility/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: eligPatientId,
          payerName: eligPayer,
          policyNumber: eligPolicy
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Verification failed');
      }

      const data = await res.json();
      setEligResult(data.eligibility);
      setActionSuccess('EDI 271 real-time eligibility confirmed: Active In-Network Coverage.');
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setEligVerifying(false);
    }
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.patient?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.patient?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Banner Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Sub-Navigation */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
              <CreditCard className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Revenue Cycle & Billing Command Station</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  HIPAA ISOLATED RCM
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-dashboard claims clearing, encounter superbills, real-time EDI 270/271 eligibility, and automated patient ledger
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchBillingData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </button>

            <button
              onClick={() => {
                if (unbilledEncounters.length > 0) {
                  openBillModalForEncounter(unbilledEncounters[0]);
                } else if (invoices.length > 0) {
                  setFormPatientId(invoices[0].patientId);
                  setShowGenerateInvoiceModal(true);
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition shadow-lg shadow-amber-600/20 flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Superbill</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 pt-4">
          {[
            { id: 'overview', label: 'Financial Overview & KPIs', icon: TrendingUp },
            { id: 'unbilled', label: `Unbilled Encounters (${unbilledEncounters.length})`, icon: Stethoscope },
            { id: 'claims', label: `Claims & Clearinghouse (${claims.length})`, icon: FileCheck2 },
            { id: 'invoices', label: `Invoices & Ledger (${invoices.length})`, icon: Receipt },
            { id: 'eligibility', label: 'EDI 270/271 Eligibility', icon: ShieldCheck },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: FINANCIAL OVERVIEW & KPIS */}
      {/* ============================================================== */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Total Billed Charges</span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white mt-2 font-mono">
                ${stats.summary.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="mt-2 flex items-center text-[11px] text-blue-400">
                <span>{stats.summary.totalInvoices} Encounters Processed</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Net Collections (Paid)</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white mt-2 font-mono">
                ${stats.summary.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="mt-2 flex items-center text-[11px] text-emerald-400">
                <span>{stats.summary.paidInvoicesCount} Invoices Fully Settled</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Outstanding Patient Due</span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-amber-400 mt-2 font-mono">
                ${stats.summary.totalPatientDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="mt-2 flex items-center text-[11px] text-slate-400">
                <span>{stats.summary.pendingInvoicesCount} Pending Patient Statements</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Clean Claim Clearance Rate</span>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white mt-2 font-mono">
                {stats.claimsMetrics.cleanClaimRate}
              </p>
              <div className="mt-2 flex items-center text-[11px] text-indigo-400">
                <span>{stats.claimsMetrics.approvedClaims} of {stats.claimsMetrics.totalClaims} Claims Cleared</span>
              </div>
            </div>
          </div>

          {/* Accounts Receivable (A/R) Aging */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Accounts Receivable (A/R) Aging Distribution</span>
                </h3>
                <p className="text-xs text-slate-400">Breakdown of aging unpaid claims and patient balances</p>
              </div>
              <span className="text-xs font-mono text-slate-400">Industry Benchmark: &lt; 35 Days</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-400 block uppercase tracking-wider font-semibold">0 - 30 Days (Current)</span>
                <span className="text-lg font-bold text-emerald-400 font-mono mt-1 block">
                  ${stats.arAging.current.toFixed(2)}
                </span>
                <span className="text-[10px] text-emerald-500/80">Optimal Recovery</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-400 block uppercase tracking-wider font-semibold">31 - 60 Days</span>
                <span className="text-lg font-bold text-blue-400 font-mono mt-1 block">
                  ${stats.arAging.days31to60.toFixed(2)}
                </span>
                <span className="text-[10px] text-blue-400/80">Standard Insurer Adjudication</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-400 block uppercase tracking-wider font-semibold">61 - 90 Days</span>
                <span className="text-lg font-bold text-amber-400 font-mono mt-1 block">
                  ${stats.arAging.days61to90.toFixed(2)}
                </span>
                <span className="text-[10px] text-amber-400/80">Follow-Up Required</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-400 block uppercase tracking-wider font-semibold">90+ Days (At Risk)</span>
                <span className="text-lg font-bold text-rose-400 font-mono mt-1 block">
                  ${stats.arAging.over90Days.toFixed(2)}
                </span>
                <span className="text-[10px] text-rose-400/80">Appeal or Statement Dispatch</span>
              </div>
            </div>
          </div>

          {/* Quick Action Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Stethoscope className="w-4 h-4 text-emerald-400" />
                <span>Clinical Encounter Ingestion Pipeline</span>
              </h4>
              <p className="text-xs text-slate-400">
                There are <span className="text-amber-400 font-bold">{unbilledEncounters.length} unbilled encounters</span> from doctors, nurses, and labs awaiting superbill generation.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('unbilled')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs border border-slate-700 transition flex items-center space-x-2"
                >
                  <span>Review Unbilled Encounters</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-blue-400" />
                <span>Clearinghouse Queue & Claims Dispatch</span>
              </h4>
              <p className="text-xs text-slate-400">
                Electronic claims formatted in ANSI X12 EDI 837P are ready for batch submission and real-time CMS-1500 clearing.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('claims')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 font-semibold text-xs border border-slate-700 transition flex items-center space-x-2"
                >
                  <span>Manage Claims Queue</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: UNBILLED ENCOUNTERS (Cross-Dashboard Pipeline) */}
      {/* ============================================================== */}
      {activeTab === 'unbilled' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center space-x-3">
            <Activity className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <span>
              <strong>Cross-Dashboard Intelligence:</strong> Encounters automatically pulled from Doctor consultations, Nurse vital signs, and Pharmacy fulfillments. Click <strong>Generate Superbill</strong> to auto-assemble billing codes.
            </span>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4">Pending Clinical Encounters Requiring Invoicing</h3>

            {unbilledEncounters.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/60 mb-2" />
                <p>All clinical consultations are currently billed and up to date.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Attending Physician</th>
                      <th className="px-4 py-3">Encounter Date</th>
                      <th className="px-4 py-3">Clinical Items</th>
                      <th className="px-4 py-3">Payer / Eligibility</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {unbilledEncounters.map((enc: any) => (
                      <tr key={enc.consultationId} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-white block">
                            {enc.patient?.firstName} {enc.patient?.lastName}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">{enc.patient?.email}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-white">Dr. {enc.doctor?.firstName} {enc.doctor?.lastName}</span>
                          <span className="text-[10px] text-slate-400 block">{enc.doctor?.specialty || 'General Practice'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300 font-mono text-[11px]">
                          {new Date(enc.scheduledAt).toLocaleDateString()} {new Date(enc.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] border border-blue-500/20">
                              CPT 99214
                            </span>
                            {enc.clinicalFlagsCount > 0 && (
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] border border-rose-500/20">
                                Triage Flag (+99058)
                              </span>
                            )}
                            {enc.prescriptionsCount > 0 && (
                              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] border border-purple-500/20">
                                Rx Disp (+RX-DISP)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-white block font-medium">{enc.insurance?.payerName}</span>
                          <span className="text-[10px] text-slate-400">
                            Copay: ${enc.insurance?.copayAmount || 0} • {enc.insurance?.coveragePercent}% Coverage
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => openBillModalForEncounter(enc)}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition flex items-center space-x-1.5 ml-auto"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Generate Superbill</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: ELECTRONIC CLAIMS & CLEARINGHOUSE */}
      {/* ============================================================== */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <FileCheck2 className="w-4 h-4 text-blue-400" />
                  <span>Clearinghouse Claims Queue (EDI 837P / CMS-1500)</span>
                </h3>
                <p className="text-xs text-slate-400">Real-time claim status tracking, code scrub checks, and adjudication</p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono">
                  {claims.length} Claims Recorded
                </span>
              </div>
            </div>

            {claims.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <p>No insurance claims have been drafted or submitted yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Claim #</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Payer & Policy</th>
                      <th className="px-4 py-3">Diagnosis / CPT</th>
                      <th className="px-4 py-3">Billed / Approved</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Adjudication</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {claims.map((clm: any) => (
                      <tr key={clm.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3.5 font-mono text-amber-400 font-bold">
                          {clm.claimNumber}
                          <span className="text-[10px] text-slate-500 block">Inv #{clm.invoice?.invoiceNumber}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-white font-medium block">
                            {clm.patient?.firstName} {clm.patient?.lastName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{clm.patient?.email}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-white font-medium block">{clm.payerName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{clm.policyNumber}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {clm.icd10Codes?.map((icd: string, idx: number) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20">
                                {icd}
                              </span>
                            ))}
                            {clm.cptCodes?.map((cpt: string, idx: number) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] border border-blue-500/20">
                                {cpt}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono">
                          <span className="text-white font-bold block">${clm.billedAmount.toFixed(2)}</span>
                          <span className="text-[10px] text-emerald-400">
                            Approved: ${clm.approvedAmount !== null ? clm.approvedAmount.toFixed(2) : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            clm.status === 'SETTLED' || clm.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : clm.status === 'DENIED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : clm.status === 'SUBMITTED'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {clm.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => {
                              setSelectedClaimForAdjudication(clm);
                              setAdjudicateAmount(String(clm.approvedAmount || clm.billedAmount * 0.8));
                              setShowAdjudicateModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                          >
                            Adjudicate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: INVOICES & PATIENT LEDGER */}
      {/* ============================================================== */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search invoice or patient..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                </select>
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Showing {filteredInvoices.length} of {invoices.length} Statements
              </div>
            </div>

            {filteredInvoices.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <p>No invoices matching criteria found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Invoice #</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Issued Date</th>
                      <th className="px-4 py-3">Total Amount</th>
                      <th className="px-4 py-3">Ins. Covered</th>
                      <th className="px-4 py-3">Patient Due</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredInvoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3.5 font-mono text-amber-400 font-bold">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-white font-medium block">
                            {inv.patient?.firstName} {inv.patient?.lastName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{inv.patient?.email}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300 font-mono text-[11px]">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-white font-bold">
                          ${inv.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-emerald-400">
                          ${inv.insuranceCovered.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-amber-400 font-bold">
                          ${inv.patientDue.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => setSelectedInvoiceForView(inv)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="View Superbill"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: REAL-TIME EDI 270/271 ELIGIBILITY VERIFIER */}
      {/* ============================================================== */}
      {activeTab === 'eligibility' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 lg:col-span-1">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">EDI 270 Inquiry Engine</h3>
                <p className="text-xs text-slate-400">Real-time payer benefits & copay determination</p>
              </div>
            </div>

            <form onSubmit={handleVerifyEligibility} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Select Patient
                </label>
                <select
                  value={eligPatientId}
                  onChange={e => setEligPatientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {invoices.map((inv: any) => (
                    <option key={inv.patientId} value={inv.patientId}>
                      {inv.patient?.firstName} {inv.patient?.lastName} ({inv.patient?.email})
                    </option>
                  ))}
                  {unbilledEncounters.map((enc: any) => (
                    <option key={enc.patient?.id} value={enc.patient?.id}>
                      {enc.patient?.firstName} {enc.patient?.lastName} ({enc.patient?.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Health Plan / Payer Name
                </label>
                <select
                  value={eligPayer}
                  onChange={e => setEligPayer(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="BlueCross BlueShield">BlueCross BlueShield</option>
                  <option value="Aetna Health">Aetna Health</option>
                  <option value="UnitedHealthcare">UnitedHealthcare</option>
                  <option value="Cigna Healthcare">Cigna Healthcare</option>
                  <option value="Medicare Part B (Telehealth)">Medicare Part B (Telehealth)</option>
                  <option value="Direct Self-Pay / HSA">Direct Self-Pay / HSA</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Member / Policy ID
                </label>
                <input
                  type="text"
                  value={eligPolicy}
                  onChange={e => setEligPolicy(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={eligVerifying}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition flex items-center justify-center space-x-2"
              >
                {eligVerifying ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>Run EDI 270 Verification</span>
              </button>
            </form>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 lg:col-span-2">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Electronic Response (EDI 271 Clearing Results)</span>
            </h3>

            {eligResult ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <div>
                      <span className="text-sm font-bold text-white block">Active Coverage Confirmed</span>
                      <span className="text-xs text-emerald-400">Status Code: {eligResult.responseCode || 'AAA-ACTIVE'} • Telehealth Eligible</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 font-mono">
                    EDI 271 Verified
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Copay Responsibility</span>
                    <span className="text-base font-bold text-white font-mono mt-1 block">
                      ${eligResult.copayAmount?.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Coinsurance Rate</span>
                    <span className="text-base font-bold text-blue-400 font-mono mt-1 block">
                      {eligResult.coveragePercent}%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Deductible Remaining</span>
                    <span className="text-base font-bold text-amber-400 font-mono mt-1 block">
                      ${eligResult.deductibleRemaining?.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Payer Network</span>
                    <span className="text-xs font-bold text-emerald-400 mt-1 block truncate">
                      {eligResult.payerName}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 font-mono space-y-1">
                  <p>• Subscriber Policy: {eligResult.policyNumber}</p>
                  <p>• Verification Timestamp: {new Date(eligResult.verifiedAt).toISOString()}</p>
                  <p>• Digital Pre-Authorization Token: AUTH-{Date.now().toString().slice(-8)}</p>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500 text-xs">
                <ShieldCheck className="w-12 h-12 mx-auto text-slate-700 mb-2" />
                <p>Run a verification query on the left to inspect payer coverage and copay rules.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: GENERATE SUPERBILL & INVOICE */}
      {/* ============================================================== */}
      {showGenerateInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Generate Itemized Superbill & Invoice</h3>
                  <p className="text-xs text-slate-400">Assembles procedure & diagnostic codes into an electronic claim</p>
                </div>
              </div>
              <button onClick={() => setShowGenerateInvoiceModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Insurance Payer
                  </label>
                  <select
                    value={formPayer}
                    onChange={e => setFormPayer(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="BlueCross BlueShield">BlueCross BlueShield</option>
                    <option value="Aetna Health">Aetna Health</option>
                    <option value="UnitedHealthcare">UnitedHealthcare</option>
                    <option value="Cigna Healthcare">Cigna Healthcare</option>
                    <option value="Direct Self-Pay / HSA">Direct Self-Pay / HSA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Primary Diagnosis Code (ICD-10)
                  </label>
                  <select
                    value={formIcd10}
                    onChange={e => setFormIcd10(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  >
                    <option value="I10">I10 - Essential (primary) hypertension</option>
                    <option value="E11.9">E11.9 - Type 2 diabetes mellitus</option>
                    <option value="J06.9">J06.9 - Acute upper respiratory infection</option>
                    <option value="J45.909">J45.909 - Unspecified asthma</option>
                    <option value="M54.5">M54.5 - Low back pain</option>
                    <option value="F41.1">F41.1 - Generalized anxiety disorder</option>
                  </select>
                </div>
              </div>

              {/* Billable Items Table */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Line Items (CPT / Procedure Codes)
                </label>
                <div className="space-y-2">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-mono font-bold text-amber-400 mr-2">{item.cptCode}</span>
                        <span className="text-white">{item.description}</span>
                        <span className="text-[10px] text-slate-400 block">{item.serviceType} • Qty: {item.quantity}</span>
                      </div>
                      <span className="font-mono font-bold text-white text-sm">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total Superbill Charge</span>
                <span className="text-lg font-bold text-amber-400 font-mono">
                  ${formItems.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoSubmitClaim"
                  checked={formAutoSubmitClaim}
                  onChange={e => setFormAutoSubmitClaim(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
                />
                <label htmlFor="autoSubmitClaim" className="text-xs text-slate-300">
                  Automatically submit ANSI X12 EDI 837P claim to clearinghouse immediately
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGenerateInvoiceModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 transition flex items-center space-x-2"
                >
                  {formSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  <span>Commit Superbill & Invoice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: VIEW ITEMIZED SUPERBILL INVOICE */}
      {/* ============================================================== */}
      {selectedInvoiceForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Itemized Clinical Statement</h3>
                  <p className="text-xs text-slate-400 font-mono">Invoice #{selectedInvoiceForView.invoiceNumber}</p>
                </div>
              </div>
              <button onClick={() => setSelectedInvoiceForView(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Patient Header */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Patient Details</span>
                <span className="text-white font-bold text-sm block">
                  {selectedInvoiceForView.patient?.firstName} {selectedInvoiceForView.patient?.lastName}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">{selectedInvoiceForView.patient?.email}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Status</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  selectedInvoiceForView.status === 'PAID'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {selectedInvoiceForView.status}
                </span>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Itemized Clinical Services
              </span>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                {selectedInvoiceForView.items?.map((item: any) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-amber-400 font-bold mr-2">{item.cptCode || 'SVC'}</span>
                      <span className="text-white font-medium">{item.description}</span>
                    </div>
                    <span className="font-mono font-bold text-white">${item.totalPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Ledger Calculation */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Total Billed Amount:</span>
                <span className="text-white">${selectedInvoiceForView.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Insurance Paid / Approved:</span>
                <span>-${selectedInvoiceForView.insuranceCovered.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-amber-400 font-bold text-sm pt-2 border-t border-slate-800">
                <span>Patient Balance Due:</span>
                <span>${selectedInvoiceForView.patientDue.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Statement</span>
              </button>
              <button
                onClick={() => setSelectedInvoiceForView(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CLAIM ADJUDICATION (Clearinghouse response simulator) */}
      {/* ============================================================== */}
      {showAdjudicateModal && selectedClaimForAdjudication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Adjudicate Insurance Claim</h3>
              <button onClick={() => setShowAdjudicateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 font-mono">
                <span className="text-slate-400 block">Claim: {selectedClaimForAdjudication.claimNumber}</span>
                <span className="text-white block">Payer: {selectedClaimForAdjudication.payerName}</span>
                <span className="text-amber-400 block">Billed: ${selectedClaimForAdjudication.billedAmount.toFixed(2)}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Adjudication Decision
                </label>
                <select
                  value={adjudicateStatus}
                  onChange={e => setAdjudicateStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="APPROVED">APPROVED (Post Payment & Settle)</option>
                  <option value="DENIED">DENIED (Reject & Shift to Patient Due)</option>
                  <option value="APPEALED">APPEALED (Submit Supporting Clinical Note)</option>
                </select>
              </div>

              {adjudicateStatus === 'APPROVED' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Approved Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={adjudicateAmount}
                    onChange={e => setAdjudicateAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {adjudicateStatus === 'DENIED' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Denial Reason Code (ANSI CARC)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CARC 16: Claim/service lacks information"
                    value={adjudicateDenialReason}
                    onChange={e => setAdjudicateDenialReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowAdjudicateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjudicateClaim}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs"
              >
                Post ERA & Update Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
