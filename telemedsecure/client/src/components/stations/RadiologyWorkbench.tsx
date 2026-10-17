import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  Scan,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  RefreshCw,
  Search,
  FileCheck,
  X,
  Printer,
  ShieldCheck,
  Eye,
  Activity
} from 'lucide-react';

export default function RadiologyWorkbench() {
  const { user, getAuthHeaders } = useAuth();

  const [studies, setStudies] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalityFilter, setModalityFilter] = useState('ALL');

  // Modals & Action States
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState<any | null>(null);
  const [viewStudyReport, setViewStudyReport] = useState<any | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Study Form
  const [newPatientId, setNewPatientId] = useState('');
  const [newModality, setNewModality] = useState('Chest X-Ray (PA & Lateral)');
  const [newAnatomy, setNewAnatomy] = useState('Thorax / Pulmonary');

  // Report Form
  const [reportImpression, setReportImpression] = useState('');
  const [reportFindings, setReportFindings] = useState('');
  const [reportIsUrgent, setReportIsUrgent] = useState(false);

  useEffect(() => {
    fetchRadiologyData();
  }, []);

  const fetchRadiologyData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [stdRes, statRes, ptsRes] = await Promise.all([
        fetch(`${API_BASE}/stations/radiology/studies`, { headers }),
        fetch(`${API_BASE}/stations/radiology/stats`, { headers }),
        fetch(`${API_BASE}/consultations/patients`, { headers })
      ]);

      if (stdRes.ok) setStudies(await stdRes.json());
      if (statRes.ok) setStats(await statRes.json());
      if (ptsRes.ok) {
        const pData = await ptsRes.json();
        setPatients(Array.isArray(pData) ? pData : []);
      }
    } catch (err: any) {
      console.error('Error fetching radiology data', err);
      setActionError('Could not load radiology telemetry.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/stations/radiology/studies`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: newPatientId,
          modality: newModality,
          anatomicalRegion: newAnatomy
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to order study');
      }

      setActionSuccess('PACS DICOM imaging study registered and accessioned in queue.');
      setShowOrderModal(false);
      fetchRadiologyData();
      setTimeout(() => setActionSuccess(null), 4500);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openReportModal = (study: any) => {
    setSelectedStudy(study);
    setReportImpression(study.impression || 'Clear lung fields. No focal consolidation, pneumothorax, or acute bony abnormalities.');
    setReportFindings(study.findings || 'Visualized anatomical structures intact without acute pathological process.');
    setReportIsUrgent(Boolean(study.isUrgent));
    setShowReportModal(true);
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudy) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/stations/radiology/studies/${selectedStudy.id}/report`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          impression: reportImpression,
          findings: reportFindings,
          isUrgent: reportIsUrgent
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to sign report');
      }

      setActionSuccess(`Radiological impression for [${selectedStudy.modality}] cryptographically signed and published to EHR.${reportIsUrgent ? ' Critical alert broadcasted to clinical care team.' : ''}`);
      setShowReportModal(false);
      fetchRadiologyData();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudies = studies.filter(s => {
    const matchesSearch =
      s.studyNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.modality?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.anatomicalRegion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.patient?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.patient?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModality = modalityFilter === 'ALL' || s.modality?.includes(modalityFilter);
    return matchesSearch && matchesModality;
  });

  return (
    <div className="space-y-6">
      {/* Notifications */}
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Scans Awaiting Read</span>
          <div className="text-2xl font-black text-white tracking-tight">
            {stats?.scansAwaitingRead ?? studies.filter(s => s.status !== 'FINALIZED').length}
          </div>
          <p className="text-[11px] text-purple-400 font-mono">PACS / DICOM Worklist</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Signed Impressions</span>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">
            {stats?.signedImpressions ?? studies.filter(s => s.status === 'FINALIZED').length}
          </div>
          <p className="text-[11px] text-emerald-400 font-mono">Cryptographically Sealed</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Urgent Findings</span>
          <div className="text-2xl font-black text-rose-400 tracking-tight">
            {stats?.urgentFindings ?? studies.filter(s => s.isUrgent).length}
          </div>
          <p className="text-[11px] text-rose-400 font-mono">Acute Alerts Broadcasted</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Modalities Online</span>
          <div className="text-2xl font-black text-cyan-400 tracking-tight">
            {stats?.modalitiesActive ?? 'XR, CT, MRI, US'}
          </div>
          <p className="text-[11px] text-cyan-400 font-mono">PACS Network Active</p>
        </div>
      </div>

      {/* Main Radiology Worklist */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Teleradiology PACS Reading & Imaging Review Worklist</h3>
              <p className="text-xs text-slate-400">Interpret radiographic modalities, record structured clinical impressions, and flag acute emergencies</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchRadiologyData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Worklist"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowOrderModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition flex items-center space-x-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register Imaging Study</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search study #, modality, patient..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={modalityFilter}
              onChange={e => setModalityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none"
            >
              <option value="ALL">All Modalities</option>
              <option value="X-Ray">X-Ray (XR)</option>
              <option value="MRI">Magnetic Resonance (MRI)</option>
              <option value="CT">Computed Tomography (CT)</option>
              <option value="Ultrasound">Ultrasound (US)</option>
            </select>
            <span className="text-xs text-slate-400 font-mono">
              {filteredStudies.length} Studies Listed
            </span>
          </div>
        </div>

        {/* Studies Table */}
        {filteredStudies.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Scan className="w-10 h-10 mx-auto mb-2 opacity-40 text-purple-400" />
            <p className="text-sm font-semibold text-slate-300">No imaging studies match your criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Study # / Modality</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Anatomical Region</th>
                  <th className="px-4 py-3">DICOM UID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudies.map(study => (
                  <tr key={study.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-purple-400 font-bold block">{study.studyNumber}</span>
                      <span className="text-white font-medium text-[11px]">{study.modality}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-white font-medium block">
                        {study.patient?.firstName} {study.patient?.lastName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{study.patient?.email}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
                        {study.anatomicalRegion}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                      {study.dicomStudyUid}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        study.status === 'FINALIZED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : study.status === 'URGENT_FLAGGED'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {study.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      {study.status !== 'FINALIZED' && study.status !== 'URGENT_FLAGGED' ? (
                        <button
                          onClick={() => openReportModal(study)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition inline-flex items-center space-x-1"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>Interpret & Sign</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setViewStudyReport(study)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-400 font-semibold text-xs border border-slate-700 transition inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Impression</span>
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

      {/* Modal: Register Imaging Study */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Scan className="w-5 h-5 text-purple-400" />
                <span>Register Teleradiology PACS Study</span>
              </h3>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateStudy} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Select Patient *
                </label>
                <select
                  value={newPatientId}
                  onChange={e => setNewPatientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                  required
                >
                  <option value="" disabled hidden>Select a patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Imaging Modality *
                </label>
                <select
                  value={newModality}
                  onChange={e => setNewModality(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value="Chest X-Ray (PA & Lateral)">Chest X-Ray (PA & Lateral)</option>
                  <option value="Brain MRI with Diffusion & FLAIR">Brain MRI with Diffusion & FLAIR</option>
                  <option value="Abdominal & Pelvic CT with Contrast">Abdominal & Pelvic CT with Contrast</option>
                  <option value="Right Upper Quadrant Abdominal Ultrasound">Right Upper Quadrant Abdominal Ultrasound</option>
                  <option value="Spine Lumbar MRI (L1-S1)">Spine Lumbar MRI (L1-S1)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Anatomical Target Region *
                </label>
                <input
                  type="text"
                  value={newAnatomy}
                  onChange={e => setNewAnatomy(e.target.value)}
                  required
                  placeholder="e.g. Thorax, Cranium, Abdomen"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                />
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition flex items-center space-x-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Accession to PACS</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Interpret & Sign Report */}
      {showReportModal && selectedStudy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Interpret & Cryptographically Sign Radiology Report</h3>
                <span className="text-xs text-purple-400 font-mono">Study #{selectedStudy.studyNumber}</span>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveReport} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient & Modality Target</span>
                <span className="text-white font-bold text-sm block">
                  {selectedStudy.patient?.firstName} {selectedStudy.patient?.lastName} • {selectedStudy.modality}
                </span>
                <span className="text-purple-400 font-mono text-[11px]">Region: {selectedStudy.anatomicalRegion}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Diagnostic Findings (Structured Technical Observations) *
                </label>
                <textarea
                  rows={2}
                  value={reportFindings}
                  onChange={e => setReportFindings(e.target.value)}
                  required
                  placeholder="Detailed anatomical observations..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Clinical Impression / Final Assessment *
                </label>
                <textarea
                  rows={3}
                  value={reportImpression}
                  onChange={e => setReportImpression(e.target.value)}
                  required
                  placeholder="Primary impression and diagnostic conclusions..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reportIsUrgent}
                    onChange={e => setReportIsUrgent(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0"
                  />
                  <span className="text-rose-400 font-bold">Flag as Acute Emergency Finding (Pushes immediate critical flag to Physician)</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition flex items-center space-x-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Sign & Publish Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Sealed Report */}
      {viewStudyReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Signed Diagnostic Radiology Report</h3>
                <span className="text-xs text-purple-400 font-mono">Study #{viewStudyReport.studyNumber}</span>
              </div>
              <button onClick={() => setViewStudyReport(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Patient:</span>
                <span className="text-white font-bold">{viewStudyReport.patient?.firstName} {viewStudyReport.patient?.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Modality & Region:</span>
                <span className="text-white font-semibold">{viewStudyReport.modality} ({viewStudyReport.anatomicalRegion})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">DICOM Study UID:</span>
                <span className="text-purple-400 font-mono text-[10px] truncate max-w-[220px]">{viewStudyReport.dicomStudyUid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Signed Timestamp:</span>
                <span className="text-slate-300 font-mono">{new Date(viewStudyReport.finalizedAt || viewStudyReport.updatedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Radiological Impression:</span>
              <p className="text-white font-mono text-xs whitespace-pre-wrap">{viewStudyReport.impression}</p>
              {viewStudyReport.findings && (
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase">Technical Findings:</span>
                  <p>{viewStudyReport.findings}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center space-x-1"
              >
                <Printer className="w-4 h-4" />
                <span>Print Report</span>
              </button>
              <button
                onClick={() => setViewStudyReport(null)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
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
