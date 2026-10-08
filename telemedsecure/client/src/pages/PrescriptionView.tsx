import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Pill,
  User,
  Building2,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import {
  getPrescription,
  dispensePrescription,
  revokePrescription,
  tamperPrescription,
  PrescriptionData
} from '../utils/api';

export default function PrescriptionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSig, setCopiedSig] = useState(false);

  // Modals / Input states
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getPrescription(id);
      setPrescription(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load prescription');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDispense = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      await dispensePrescription(id, dispenseNotes);
      setShowDispenseModal(false);
      setActionSuccess('Prescription marked as DISPENSED. Audit event recorded.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Dispense failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!id || !revokeReason.trim()) {
      alert('Revocation reason is required');
      return;
    }
    try {
      setActionLoading(true);
      await revokePrescription(id, revokeReason);
      setShowRevokeModal(false);
      setActionSuccess('Prescription has been REVOKED. Audit event recorded.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Revocation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTamper = async () => {
    if (!id) return;
    if (!confirm('This will modify a prescription medication item directly in the database without updating its cryptographic signature. Are you sure?')) {
      return;
    }
    try {
      setActionLoading(true);
      await tamperPrescription(id);
      setActionSuccess('Tamper simulated! Medication dosage modified in DB. Verification will now show TAMPERED.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Tamper simulation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'key' | 'sig') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSig(true);
      setTimeout(() => setCopiedSig(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !prescription) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-8 flex flex-col items-center justify-center">
        <AlertTriangle className="w-12 h-12 text-rose-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Error Loading Prescription</h2>
        <p className="text-slate-400 mb-6">{error || 'Prescription not found'}</p>
        <button
          onClick={() => navigate('/prescriptions')}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-white text-sm"
        >
          Back to Prescriptions
        </button>
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (prescription.status) {
      case 'ISSUED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>ISSUED</span>
          </span>
        );
      case 'DISPENSED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>DISPENSED</span>
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>REVOKED</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            to="/prescriptions"
            className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Prescriptions</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate(`/prescriptions/${prescription.id}/verify`)}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition shadow-lg shadow-cyan-600/25"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verify Cryptographic Integrity</span>
            </button>

            {prescription.status === 'ISSUED' && (
              <button
                onClick={() => setShowDispenseModal(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition shadow-lg shadow-emerald-600/25"
              >
                <Building2 className="w-4 h-4" />
                <span>Dispense (Pharmacy)</span>
              </button>
            )}

            {prescription.status !== 'REVOKED' && (
              <button
                onClick={() => setShowRevokeModal(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition shadow-lg shadow-rose-600/25"
              >
                <XCircle className="w-4 h-4" />
                <span>Revoke</span>
              </button>
            )}

            <button
              onClick={handleTamper}
              title="Test tampering detection"
              className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Simulate DB Tampering</span>
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-sm flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Main Prescription Card */}
        <div className="rounded-3xl bg-slate-800/90 border border-slate-700/80 shadow-2xl overflow-hidden">
          {/* Header Banner */}
          <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-800 via-slate-800/95 to-slate-900 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Electronic Medical Prescription</h1>
                  <p className="text-xs text-slate-400 font-mono">
                    RX ID: {prescription.id}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {getStatusBadge()}
              <div className="text-right">
                <span className="block text-xs uppercase tracking-wider text-slate-400">Issued On</span>
                <span className="text-sm font-semibold text-white">
                  {new Date(prescription.createdAt).toLocaleDateString()} at{' '}
                  {new Date(prescription.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {prescription.statusReason && (
            <div className="px-8 py-3 bg-slate-900/60 border-b border-slate-700/60 text-xs flex items-center space-x-2 text-slate-300">
              <span className="font-semibold text-cyan-400">Status Notes:</span>
              <span>{prescription.statusReason}</span>
            </div>
          )}

          {/* Details Grid */}
          <div className="p-6 sm:p-8 space-y-8">
            {/* Doctor and Patient Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Prescribing Doctor */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Prescribing Physician
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    ED25519 SIGNED
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">
                  {prescription.doctor ? `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}` : 'Physician'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{prescription.doctor?.email || 'doctor@telemed.com'}</p>
                <p className="text-xs text-slate-500">Board Certified Telemedicine Practitioner</p>
              </div>

              {/* Patient */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-700/60 space-y-2">
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Patient Information
                </span>
                <h3 className="text-base font-bold text-white">
                  {prescription.consultation?.patient
                    ? `${prescription.consultation.patient.firstName} ${prescription.consultation.patient.lastName}`
                    : 'Patient'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {prescription.consultation?.patient?.email || 'patient@telemed.com'}
                </p>
                <p className="text-xs text-slate-500">
                  Consultation Ref: <span className="font-mono text-slate-400">{prescription.consultationId.slice(0, 18)}...</span>
                </p>
              </div>
            </div>

            {/* Prescribed Items Table */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Pill className="w-5 h-5 text-cyan-400" />
                <span>Prescribed Medications & Regimen</span>
              </h3>

              <div className="overflow-x-auto rounded-2xl border border-slate-700/60 bg-slate-900/60">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Medication</th>
                      <th className="py-3 px-4">Dosage / Frequency</th>
                      <th className="py-3 px-4">Instructions & Cautions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {prescription.items.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 text-slate-500 font-mono text-xs">{index + 1}</td>
                        <td className="py-3 px-4 font-semibold text-white">{item.medication}</td>
                        <td className="py-3 px-4 text-cyan-300 font-mono text-xs">{item.dosage}</td>
                        <td className="py-3 px-4 text-slate-300 text-xs leading-relaxed">{item.instructions || 'As directed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cryptographic Proof & Non-Repudiation Certificate */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-700/80 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5 text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                  <h4 className="font-bold text-sm tracking-wide text-white uppercase">
                    Non-Repudiation Cryptographic Certificate
                  </h4>
                </div>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-800/40">
                  {prescription.signature?.algorithm || 'Ed25519-SHA256'}
                </span>
              </div>

              <div className="space-y-3 text-xs font-mono">
                {/* Canonical SHA-256 Hash */}
                <div>
                  <div className="text-slate-400 text-[11px] mb-1 font-sans font-semibold uppercase">
                    Canonical JSON SHA-256 Digest (RFC 8785)
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-cyan-300 break-all select-all">
                    {prescription.signature?.canonicalHash || 'Generated upon signature'}
                  </div>
                </div>

                {/* Digital Signature */}
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1 font-sans font-semibold uppercase">
                    <span>Ed25519 Digital Signature (Hex)</span>
                    <button
                      onClick={() => copyToClipboard(prescription.signature?.signature || '', 'sig')}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                    >
                      {copiedSig ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{copiedSig ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-emerald-300 break-all select-all">
                    {prescription.signature?.signature || 'N/A'}
                  </div>
                </div>

                {/* Public Key */}
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1 font-sans font-semibold uppercase">
                    <span>Doctor Public Key (SPKI PEM)</span>
                    <button
                      onClick={() => copyToClipboard(prescription.signature?.publicKey || '', 'key')}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-slate-400 overflow-x-auto text-[10px] leading-tight">
                    {prescription.signature?.publicKey || 'N/A'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dispense Modal */}
      {showDispenseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <span>Dispense Prescription</span>
            </h3>
            <p className="text-xs text-slate-300">
              Confirm that this prescription is being fulfilled and dispensed by the pharmacy.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Pharmacy / Dispenser Notes
              </label>
              <textarea
                value={dispenseNotes}
                onChange={e => setDispenseNotes(e.target.value)}
                placeholder="e.g. Dispensed by Walgreens #1042 - Pharmacist Jane Doe"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowDispenseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDispense}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/30"
              >
                {actionLoading ? 'Processing...' : 'Confirm Dispensing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              <span>Revoke Prescription</span>
            </h3>
            <p className="text-xs text-slate-300">
              Revoking marks this prescription as permanently invalid. An audit event will be logged.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Revocation Reason *
              </label>
              <textarea
                required
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
                placeholder="e.g. Patient adverse allergy detected / superseded by updated dosage"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowRevokeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-600/30"
              >
                {actionLoading ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
