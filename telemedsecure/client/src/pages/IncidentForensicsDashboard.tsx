import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSearch,
  ShieldAlert,
  Clock,
  FileText,
  PlusCircle,
  Download,
  CheckCircle2,
  AlertTriangle,
  Blocks,
  RefreshCw,
  Search,
  Layers,
  FileCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { API_BASE } from '../config';

interface Incident {
  id: string;
  alertId: string | null;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'CLOSED';
  openedBy: string | null;
  targetUserId: string | null;
  targetPatientId: string | null;
  createdAt: string;
  timeline: Array<{
    id: string;
    event: string;
    action: string | null;
    resource: string | null;
    userId: string | null;
    timestamp: string;
    hash: string | null;
  }>;
  evidence: Array<{
    id: string;
    description: string;
    evidenceType: string;
    hashValue: string;
    createdAt: string;
  }>;
  reports: Array<{
    id: string;
    title: string;
    reportHash: string;
    txHash: string | null;
    blockNumber: number | null;
    pdfPath: string | null;
    createdAt: string;
  }>;
}

export default function IncidentForensicsDashboard() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);

  // New Incident Modal / Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSeverity, setNewSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [newTargetUser, setNewTargetUser] = useState('');

  // Reconstruct Timeline Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [reconstructing, setReconstructing] = useState(false);

  // Evidence Finding Form
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [evidenceType, setEvidenceType] = useState('LOG_EXTRACT');
  const [attachingEvidence, setAttachingEvidence] = useState(false);

  // Generate Report Form
  const [investigatorName, setInvestigatorName] = useState('Chief Forensic Investigator');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);

  const token = localStorage.getItem('token') || '';

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/investigation/incidents`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setIncidents(data);
        if (data.length > 0 && !selectedIncident) {
          setSelectedIncident(data[0]);
        } else if (selectedIncident) {
          const updated = data.find(i => i.id === selectedIncident.id);
          if (updated) setSelectedIncident(updated);
        }
      }
    } catch (e) {
      console.error('Fetch incidents error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleCreateIncident = async () => {
    if (!newTitle) return;
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/investigation/incidents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: newTitle,
          description: newDescription || 'Case initiated for forensic review',
          severity: newSeverity,
          targetUserId: newTargetUser || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setNewTitle('');
        setNewDescription('');
        fetchIncidents();
        setSelectedIncident(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReconstructTimeline = async () => {
    if (!selectedIncident) return;
    setReconstructing(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE}/investigation/incidents/${selectedIncident.id}/reconstruct`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: filterUser || undefined,
          patientId: filterPatient || undefined,
          resource: filterResource || undefined,
        }),
      });

      await fetchIncidents();
    } catch (e) {
      console.error(e);
    } finally {
      setReconstructing(false);
    }
  };

  const handleAttachEvidence = async () => {
    if (!selectedIncident || !evidenceDesc) return;
    setAttachingEvidence(true);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE}/investigation/incidents/${selectedIncident.id}/evidence`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: evidenceDesc,
          evidenceType,
        }),
      });

      setEvidenceDesc('');
      await fetchIncidents();
    } catch (e) {
      console.error(e);
    } finally {
      setAttachingEvidence(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedIncident) return;
    setGeneratingReport(true);
    setReportResult(null);
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/investigation/incidents/${selectedIncident.id}/report`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          investigator: investigatorName,
          summaryNotes: summaryNotes || selectedIncident.description,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setReportResult(data);
        await fetchIncidents();
      } else {
        alert(data.error);
      }
    } catch (e: any) {
      alert(`Generation failed: ${e.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400">
              <FileSearch className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Forensic Incident Investigation Hub</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Reconstruct audit timelines, attach cryptographic evidence, generate PDF reports, and anchor hashes on the blockchain
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/investigation/verify')}
              className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
            >
              <Blocks className="w-4 h-4" />
              <span>Verify Report On-Chain</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center space-x-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Open New Incident</span>
            </button>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Incidents List (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Investigative Cases ({incidents.length})
              </h2>
              <button
                onClick={fetchIncidents}
                className="text-slate-500 hover:text-slate-300 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {incidents.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                  No cases open. Click "Open New Incident" to start an investigation.
                </div>
              ) : (
                incidents.map(inc => {
                  const isSelected = selectedIncident?.id === inc.id;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                        isSelected
                          ? 'bg-indigo-950/30 border-indigo-500/60 shadow-lg shadow-indigo-950/40'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inc.severity === 'CRITICAL'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          }`}
                        >
                          {inc.severity}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            inc.status === 'CLOSED'
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-amber-400 bg-amber-500/10'
                          }`}
                        >
                          {inc.status}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-white line-clamp-1">{inc.title}</h3>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{inc.description}</p>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <span>{inc.timeline.length} timeline events</span>
                        <span>{inc.reports.length} reports</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Incident Details & Tools (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedIncident ? (
              <>
                {/* Active Case Header */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">CASE ID: {selectedIncident.id}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      Opened: {new Date(selectedIncident.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white">{selectedIncident.title}</h2>
                  <p className="text-xs text-slate-300">{selectedIncident.description}</p>
                </div>

                {/* 1. Reconstruct Timeline Panel */}
                <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-sm font-bold text-white">
                        Reconstruct Audit Timeline ({selectedIncident.timeline.length} Events)
                      </h3>
                    </div>
                    <button
                      onClick={handleReconstructTimeline}
                      disabled={reconstructing}
                      className="px-3.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                    >
                      {reconstructing ? 'Reconstructing...' : 'Run Reconstruction'}
                    </button>
                  </div>

                  {/* Filter Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Filter User ID..."
                      value={filterUser}
                      onChange={e => setFilterUser(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Filter Patient ID..."
                      value={filterPatient}
                      onChange={e => setFilterPatient(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Filter Resource..."
                      value={filterResource}
                      onChange={e => setFilterResource(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>

                  {/* Timeline Stream */}
                  {selectedIncident.timeline.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No events in timeline. Set filters and click "Run Reconstruction" above.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedIncident.timeline.map((item, idx) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs font-mono space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-cyan-400 font-bold">#{idx + 1} {item.action || 'EVENT'}</span>
                            <span className="text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-slate-300 text-[11px] font-sans">{item.event}</div>
                          <div className="text-[9px] text-slate-600 truncate">SHA-256: {item.hash}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Attached Evidence Findings */}
                <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">
                      Evidence Findings ({selectedIncident.evidence.length})
                    </h3>
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={evidenceType}
                      onChange={e => setEvidenceType(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="LOG_EXTRACT">Log Extract</option>
                      <option value="NETWORK_LOG">Network Egress</option>
                      <option value="RAM_EXTRACT">Memory Artifact</option>
                      <option value="DATABASE_ROW">DB Row Snapshot</option>
                      <option value="CRYPTO_HASH_DIFF">Hash Discrepancy</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Evidence description & artifact details..."
                      value={evidenceDesc}
                      onChange={e => setEvidenceDesc(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <button
                      onClick={handleAttachEvidence}
                      disabled={attachingEvidence || !evidenceDesc}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                    >
                      Attach
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {selectedIncident.evidence.map(ev => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1 font-mono"
                      >
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300">
                          {ev.evidenceType}
                        </span>
                        <p className="text-slate-300 text-[11px] font-sans">{ev.description}</p>
                        <div className="text-[9px] text-slate-500 truncate">Hash: {ev.hashValue}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Generate Forensic Report (PDF) & Blockchain Anchoring */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-950 border border-indigo-900/40 space-y-4">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Forensic Report Generation & Blockchain Anchoring
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Lead Investigator:</label>
                      <input
                        type="text"
                        value={investigatorName}
                        onChange={e => setInvestigatorName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Executive Summary Notes:</label>
                      <input
                        type="text"
                        value={summaryNotes}
                        onChange={e => setSummaryNotes(e.target.value)}
                        placeholder="Comprehensive finding summary..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-xs transition shadow-xl shadow-emerald-600/20 flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <Blocks className="w-4 h-4" />
                    <span>{generatingReport ? 'Generating & Anchoring on Hardhat...' : 'Generate Forensic PDF & Anchor On-Chain'}</span>
                  </button>

                  {/* Generated Reports List */}
                  {selectedIncident.reports.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <h4 className="text-xs font-bold text-slate-400 uppercase">Anchored Reports</h4>
                      {selectedIncident.reports.map(rep => (
                        <div
                          key={rep.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-white">{rep.title}</span>
                            <div className="font-mono text-[10px] text-cyan-400 truncate max-w-md">
                              SHA-256: {rep.reportHash}
                            </div>
                            <div className="font-mono text-[9px] text-slate-500">
                              Block #{rep.blockNumber} • Tx: {rep.txHash?.slice(0, 20)}...
                            </div>
                          </div>
                          <a
                            href={`${API_BASE}/investigation/reports/${rep.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download PDF</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-3xl">
                Select an incident from the left to view details and generate reports.
              </div>
            )}
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Open Incident Investigation</h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Case Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Unauthorized Record Modification Investigation"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Severity</label>
                  <select
                    value={newSeverity}
                    onChange={e => setNewSeverity(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Incident background details..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Target User ID (Optional)</label>
                  <input
                    type="text"
                    value={newTargetUser}
                    onChange={e => setNewTargetUser(e.target.value)}
                    placeholder="Filter audit logs by this user..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateIncident}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs"
                >
                  Create Case
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
