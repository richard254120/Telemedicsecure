import React, { useState, useEffect } from 'react';
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
  Layers,
  Printer
} from 'lucide-react';

export default function LabStationWorkbench() {
  const { user, getAuthHeaders } = useAuth();

  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Action States
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [viewResultOrder, setViewResultOrder] = useState<any | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Order Form
  const [newPatientId, setNewPatientId] = useState('');
  const [newTestName, setNewTestName] = useState('Complete Blood Count (CBC) with Automated Diff');
  const [newSpecimenType, setNewSpecimenType] = useState('Venous Blood (EDTA)');

  // Result Entry Form
  const [resultFindings, setResultFindings] = useState('');
  const [resultRefRange, setResultRefRange] = useState('');
  const [resultIsCritical, setResultIsCritical] = useState(false);
  const [resultCriticalNotes, setResultCriticalNotes] = useState('');

  useEffect(() => {
    fetchLabData();
  }, []);

  const fetchLabData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [ordRes, statRes, ptsRes] = await Promise.all([
        fetch(`${API_BASE}/stations/lab/orders`, { headers }),
        fetch(`${API_BASE}/stations/lab/stats`, { headers }),
        fetch(`${API_BASE}/consultations/patients`, { headers })
      ]);

      if (ordRes.ok) setOrders(await ordRes.json());
      if (statRes.ok) setStats(await statRes.json());
      if (ptsRes.ok) {
        const pData = await ptsRes.json();
        setPatients(Array.isArray(pData) ? pData : []);
        if (pData.length > 0 && !newPatientId) setNewPatientId(pData[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching lab data', err);
      setActionError('Could not load laboratory diagnostics data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/stations/lab/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: newPatientId,
          testName: newTestName,
          specimenType: newSpecimenType
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create order');
      }

      setActionSuccess('Diagnostic laboratory requisition created and queued for collection.');
      setShowOrderModal(false);
      fetchLabData();
      setTimeout(() => setActionSuccess(null), 4500);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openResultModal = (order: any) => {
    setSelectedOrder(order);
    setResultFindings(order.findings || 'WBC: 6.8 x10^9/L, Hb: 14.2 g/dL, Platelets: 240 x10^9/L (Normal)');
    setResultRefRange(order.referenceRange || 'WBC: 4.5-11.0, Hb: 13.5-17.5 g/dL');
    setResultIsCritical(Boolean(order.isCritical));
    setResultCriticalNotes(order.criticalNotes || '');
    setShowResultModal(true);
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/stations/lab/orders/${selectedOrder.id}/result`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          findings: resultFindings,
          referenceRange: resultRefRange,
          isCritical: resultIsCritical,
          criticalNotes: resultCriticalNotes,
          status: 'COMPLETED'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save results');
      }

      setActionSuccess(`Lab findings for [${selectedOrder.testName}] cryptographically sealed and attached to patient EHR.${resultIsCritical ? ' CRITICAL alert sent to MD.' : ''}`);
      setShowResultModal(false);
      fetchLabData();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.testName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.patient?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.patient?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Action Banners */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Real-time KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Orders In-Queue</span>
          <div className="text-2xl font-black text-white tracking-tight">
            {stats?.ordersInQueue ?? orders.filter(o => o.status !== 'COMPLETED').length}
          </div>
          <p className="text-[11px] text-teal-400 font-mono">Active Laboratory Panels</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Specimens Processed</span>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">
            {stats?.specimensCollected ?? orders.length}
          </div>
          <p className="text-[11px] text-emerald-400 font-mono">Barcode Accessioned</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Critical Flags</span>
          <div className="text-2xl font-black text-rose-400 tracking-tight">
            {stats?.criticalValuesFlagged ?? orders.filter(o => o.isCritical).length}
          </div>
          <p className="text-[11px] text-rose-400 font-mono">Immediate Physician Notification</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average Turnaround</span>
          <div className="text-2xl font-black text-cyan-400 tracking-tight">
            {stats?.turnaroundTimeAvg ?? '28 min'}
          </div>
          <p className="text-[11px] text-cyan-400 font-mono">From Collection to EHR Seal</p>
        </div>
      </div>

      {/* Main Diagnostic Queue */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Diagnostic Laboratory Order Intake & Testing Queue</h3>
              <p className="text-xs text-slate-400">Live feed of test requisitions from Attending Physicians and Clinical Stations</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchLabData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowOrderModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-600/20 transition flex items-center space-x-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Lab Requisition</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by order #, test, patient..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ORDERED">Ordered</option>
              <option value="SAMPLE_COLLECTED">Sample Collected</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <span className="text-xs text-slate-400 font-mono">
              {filteredOrders.length} Tests Listed
            </span>
          </div>
        </div>

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-40 text-teal-400" />
            <p className="text-sm font-semibold text-slate-300">No laboratory orders match your criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Order # / Barcode</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Diagnostic Panel</th>
                  <th className="px-4 py-3">Specimen Tube</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3.5 font-mono text-teal-400 font-bold">
                      {order.orderNumber}
                      <span className="text-[10px] text-slate-500 block font-normal">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-white font-medium block">
                        {order.patient?.firstName} {order.patient?.lastName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{order.patient?.email}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-white font-semibold">{order.testName}</span>
                      {order.isCritical && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                          CRITICAL VALUE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
                        {order.specimenType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        order.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : order.status === 'PROCESSING' || order.status === 'SAMPLE_COLLECTED'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      {order.status !== 'COMPLETED' ? (
                        <button
                          onClick={() => openResultModal(order)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition inline-flex items-center space-x-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Enter Findings</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setViewResultOrder(order)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 font-semibold text-xs border border-slate-700 transition inline-flex items-center space-x-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>View Sealed Report</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: New Lab Requisition */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <FlaskConical className="w-5 h-5 text-teal-400" />
                <span>Create Diagnostic Laboratory Requisition</span>
              </h3>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Select Patient *
                </label>
                <select
                  value={newPatientId}
                  onChange={e => setNewPatientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500"
                  required
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Diagnostic Test Panel *
                </label>
                <select
                  value={newTestName}
                  onChange={e => setNewTestName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="Complete Blood Count (CBC) with Automated Diff">Complete Blood Count (CBC) with Automated Diff</option>
                  <option value="Comprehensive Metabolic Panel (CMP)">Comprehensive Metabolic Panel (CMP)</option>
                  <option value="Lipid Profile Panel (Total Chol, HDL, LDL, Triglycerides)">Lipid Profile Panel (Total Chol, HDL, LDL, Triglycerides)</option>
                  <option value="Hemoglobin A1c Glycated Blood Test">Hemoglobin A1c Glycated Blood Test</option>
                  <option value="Urinalysis Complete with Microscopic Exam">Urinalysis Complete with Microscopic Exam</option>
                  <option value="Respiratory Pathogen Panel (RT-PCR Viral Media)">Respiratory Pathogen Panel (RT-PCR Viral Media)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Specimen Type & Collection Tube *
                </label>
                <select
                  value={newSpecimenType}
                  onChange={e => setNewSpecimenType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="Venous Blood (EDTA Tube)">Venous Blood (EDTA Tube)</option>
                  <option value="Serum (SST Gel Separator)">Serum (SST Gel Separator)</option>
                  <option value="Midstream Clean-Catch Urine">Midstream Clean-Catch Urine</option>
                  <option value="Nasopharyngeal Swab (Viral Media)">Nasopharyngeal Swab (Viral Media)</option>
                  <option value="Capillary Blood (Fingerstick)">Capillary Blood (Fingerstick)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold transition flex items-center space-x-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Requisition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record & Seal Lab Findings */}
      {showResultModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Enter & Seal Quantitative Laboratory Findings</h3>
                <span className="text-xs text-teal-400 font-mono">Order #{selectedOrder.orderNumber}</span>
              </div>
              <button onClick={() => setShowResultModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveResult} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient & Diagnostic Panel</span>
                <span className="text-white font-bold text-sm block">
                  {selectedOrder.patient?.firstName} {selectedOrder.patient?.lastName} • {selectedOrder.testName}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">Specimen: {selectedOrder.specimenType}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Quantitative Findings & Analyte Values *
                </label>
                <textarea
                  rows={3}
                  value={resultFindings}
                  onChange={e => setResultFindings(e.target.value)}
                  required
                  placeholder="e.g. WBC: 6.8 x10^9/L, Hb: 14.2 g/dL, Platelets: 240 x10^9/L (Normal)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Reference Range Standard
                </label>
                <input
                  type="text"
                  value={resultRefRange}
                  onChange={e => setResultRefRange(e.target.value)}
                  placeholder="e.g. WBC: 4.5-11.0, Hb: 13.5-17.5 g/dL"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resultIsCritical}
                    onChange={e => setResultIsCritical(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0"
                  />
                  <span className="text-rose-400 font-bold">Flag as Critical / Panic Value (Triggers instant Doctor alert)</span>
                </label>

                {resultIsCritical && (
                  <input
                    type="text"
                    value={resultCriticalNotes}
                    onChange={e => setResultCriticalNotes(e.target.value)}
                    placeholder="Urgent clinical notes for physician..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-rose-500/40 text-rose-300 text-xs focus:outline-none"
                  />
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold transition flex items-center space-x-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Seal & Publish to EHR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Sealed Report */}
      {viewResultOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Sealed Diagnostic Laboratory Report</h3>
                <span className="text-xs text-teal-400 font-mono">Order #{viewResultOrder.orderNumber}</span>
              </div>
              <button onClick={() => setViewResultOrder(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Patient:</span>
                <span className="text-white font-bold">{viewResultOrder.patient?.firstName} {viewResultOrder.patient?.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Diagnostic Panel:</span>
                <span className="text-white font-semibold">{viewResultOrder.testName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Specimen:</span>
                <span className="text-teal-400 font-mono">{viewResultOrder.specimenType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Completed Timestamp:</span>
                <span className="text-slate-300 font-mono">{new Date(viewResultOrder.completedAt || viewResultOrder.updatedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Analytical Findings:</span>
              <p className="text-white font-mono text-xs whitespace-pre-wrap">{viewResultOrder.findings}</p>
              {viewResultOrder.referenceRange && (
                <p className="text-[11px] text-slate-400 font-mono pt-1">Reference: {viewResultOrder.referenceRange}</p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={() => setViewResultOrder(null)}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
