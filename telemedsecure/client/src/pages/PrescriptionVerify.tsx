import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Lock,
  ArrowRight,
  Pill,
  User,
  RotateCcw,
  Fingerprint
} from 'lucide-react';
import {
  verifyPrescription,
  tamperPrescription,
  VerificationResult
} from '../utils/api';

export default function PrescriptionVerify() {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [prescriptionId, setPrescriptionId] = useState(paramId || '');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tamperingSimulated, setTamperingSimulated] = useState(false);

  const runVerification = async (targetId: string) => {
    if (!targetId.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const data = await verifyPrescription(targetId.trim());
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Verification could not be completed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paramId) {
      setPrescriptionId(paramId);
      runVerification(paramId);
    }
  }, [paramId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prescriptionId) {
      navigate(`/prescriptions/${prescriptionId}/verify`);
      runVerification(prescriptionId);
    }
  };

  const handleSimulateTamper = async () => {
    if (!prescriptionId) return;
    try {
      setLoading(true);
      await tamperPrescription(prescriptionId);
      setTamperingSimulated(true);
      // Re-run verification immediately to demonstrate the TAMPERED alert
      await runVerification(prescriptionId);
    } catch (err: any) {
      alert(err.message || 'Failed to simulate tamper');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-2">
            <Fingerprint className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Prescription Cryptographic Verification Portal
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Public verification portal for patients, pharmacies, and clinicians. Validates Ed25519 digital signatures
            over canonical JSON to detect any database tampering or unauthorized alterations.
          </p>
        </div>

        {/* Search / Lookup Box */}
        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto">
          <div className="relative flex items-center">
            <input
              type="text"
              value={prescriptionId}
              onChange={e => setPrescriptionId(e.target.value)}
              placeholder="Paste or enter Prescription ID (e.g. 5f4e...)"
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl pl-12 pr-32 py-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-xl font-mono"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-4" />
            <button
              type="submit"
              disabled={loading || !prescriptionId.trim()}
              className="absolute right-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-cyan-500/25 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-5 rounded-2xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-sm flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-400" />
            <div>
              <p className="font-semibold">Verification Error</p>
              <p className="text-xs text-rose-300/80">{error}</p>
            </div>
          </div>
        )}

        {/* Verification Result Display */}
        {result && (
          <div className="space-y-6 animate-in fade-in">
            {/* Primary Status Banner (VALID vs TAMPERED) */}
            {result.status === 'VALID' ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border-2 border-emerald-500/70 shadow-2xl shadow-emerald-950/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                          Cryptographic Assurance
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ED25519 VALID
                        </span>
                      </div>
                      <h2 className="text-2xl font-black text-white tracking-tight">
                        STATUS: VALID
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleSimulateTamper}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-mono transition flex items-center space-x-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Simulate Tamper Test</span>
                    </button>
                    <button
                      onClick={() => navigate(`/prescriptions/${result.prescriptionId}`)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                    >
                      View Record
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  The Ed25519 digital signature successfully validated against{' '}
                  <span className="font-semibold text-white">{result.doctor.name}</span>'s certified public key.
                  The canonical JSON representation of the medications, dosages, instructions, and timestamps matches
                  the signed cryptographic digest perfectly. The prescription has <span className="text-emerald-400 font-semibold">NOT been modified</span>.
                </p>
              </div>
            ) : (
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-rose-950/70 via-slate-900 to-rose-950/70 border-2 border-rose-500 shadow-2xl shadow-rose-950/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400">
                      <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-rose-400">
                          Critical Security Alert
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          SIGNATURE MISMATCH
                        </span>
                      </div>
                      <h2 className="text-2xl font-black text-rose-200 tracking-tight">
                        STATUS: TAMPERED
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => runVerification(result.prescriptionId)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center space-x-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-check</span>
                    </button>
                  </div>
                </div>

                <p className="text-sm text-rose-200 leading-relaxed font-medium">
                  WARNING: The computed SHA-256 hash of the prescription in the database does NOT match the signature signed
                  by {result.doctor.name}! Medication items, dosages, instructions, or metadata have been altered without
                  authorization. DO NOT DISPENSE THIS PRESCRIPTION.
                </p>
              </div>
            )}

            {/* Lifecycle & Verification Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <span className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Lifecycle Status
                </span>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                      result.lifecycleStatus === 'ISSUED'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : result.lifecycleStatus === 'DISPENSED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {result.lifecycleStatus}
                  </span>
                  {result.statusReason && (
                    <span className="text-xs text-slate-400 truncate">({result.statusReason})</span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <span className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Prescribing Physician
                </span>
                <span className="text-sm font-bold text-white block truncate">{result.doctor.name}</span>
                <span className="text-xs text-slate-400 font-mono block truncate">{result.doctor.email}</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <span className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Patient Identity
                </span>
                <span className="text-sm font-bold text-white block truncate">{result.patient.name}</span>
                <span className="text-xs text-slate-400 font-mono block truncate">{result.patient.email}</span>
              </div>
            </div>

            {/* Prescribed Items in Verification Record */}
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                <Pill className="w-4 h-4 text-cyan-400" />
                <span>Verified Prescription Items ({result.items.length})</span>
              </h3>

              <div className="space-y-2">
                {result.items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500 font-mono">#{idx + 1}</span>
                        <span className="font-semibold text-white text-sm">{it.medication}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                          {it.dosage}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{it.instructions || 'As directed'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic Comparison Breakdown */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-slate-400 uppercase text-[11px] font-sans font-semibold">
                  Cryptographic Verification Hashes
                </span>
                <span className="text-[10px] text-cyan-400 font-sans">
                  Algorithm: {result.signature.algorithm}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-slate-400 block text-[11px] font-sans mb-1">
                    Canonical Stored Hash (SHA-256):
                  </span>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 break-all select-all">
                    {result.canonicalHash || 'N/A'}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-sans mb-1">
                    Recomputed Payload Hash:
                  </span>
                  <div
                    className={`p-2.5 rounded-lg border break-all select-all ${
                      result.computedHash === result.canonicalHash
                        ? 'bg-slate-900 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/60 text-rose-300'
                    }`}
                  >
                    {result.computedHash}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-sans mb-1">
                    Ed25519 Digital Signature:
                  </span>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 break-all select-all">
                    {result.signature.signature}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
