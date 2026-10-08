import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus,
  Plus,
  Trash2,
  Lock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { createPrescription, fetchContextMeta } from '../utils/api';

interface ItemForm {
  medication: string;
  dosage: string;
  instructions: string;
}

export default function PrescriptionCreate() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedConsultationId, setSelectedConsultationId] = useState('');
  const [doctorPassword, setDoctorPassword] = useState('Password123!'); // Default seeded doctor password
  const [items, setItems] = useState<ItemForm[]>([
    { medication: 'Amoxicillin', dosage: '500mg PO TID', instructions: 'Take 1 capsule every 8 hours with meals for 7 days' }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<any | null>(null);

  useEffect(() => {
    fetchContextMeta()
      .then(data => {
        setPatients(data.patients || []);
        setConsultations(data.consultations || []);
        if (data.patients && data.patients.length > 0) {
          setSelectedPatientId(data.patients[0].id);
        }
        if (data.consultations && data.consultations.length > 0) {
          setSelectedConsultationId(data.consultations[0].id);
        }
      })
      .catch(() => {
        // Fallback for demo if backend isn't loaded yet
      });
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      { medication: '', dosage: '', instructions: '' }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemForm, value: string) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const applyPreset = (presetName: string) => {
    if (presetName === 'antibiotic') {
      setItems([
        { medication: 'Amoxicillin', dosage: '500mg PO TID', instructions: 'Take 1 capsule every 8 hours with meals for 7 days' },
        { medication: 'Clavulanate Potassium', dosage: '125mg', instructions: 'Take concurrent with amoxicillin' }
      ]);
    } else if (presetName === 'hypertension') {
      setItems([
        { medication: 'Lisinopril', dosage: '10mg PO Daily', instructions: 'Take once every morning. Monitor blood pressure weekly' },
        { medication: 'Hydrochlorothiazide', dosage: '12.5mg PO Daily', instructions: 'Take in the morning with water' }
      ]);
    } else if (presetName === 'diabetes') {
      setItems([
        { medication: 'Metformin HCl', dosage: '500mg PO BID', instructions: 'Take 1 tablet twice daily with breakfast and dinner' }
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate items
      for (const it of items) {
        if (!it.medication.trim() || !it.dosage.trim()) {
          throw new Error('All prescription items must include Medication and Dosage');
        }
      }

      if (!doctorPassword.trim()) {
        throw new Error('Doctor password is required to decrypt/derive Ed25519 signing key');
      }

      const payload = {
        consultationId: selectedConsultationId || undefined,
        patientId: selectedPatientId || undefined,
        items,
        password: doctorPassword
      };

      const res = await createPrescription(payload);
      setCreatedResult(res.prescription);
    } catch (err: any) {
      setError(err.message || 'Failed to issue prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <FilePlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Create Digital Prescription</h1>
              <p className="text-sm text-slate-400">
                Issue tamper-proof prescriptions digitally signed with Doctor's Ed25519 keypair
              </p>
            </div>
          </div>
        </div>

        {/* Cryptographic Assurance Banner */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-800/40 shadow-xl">
          <div className="flex items-start space-x-4">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 mt-0.5">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-sm">
              <h3 className="font-semibold text-blue-200">Cryptographic Non-Repudiation Architecture</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Every prescription is canonically formatted (RFC 8785) and hashed using SHA-256. The hash is digitally
                signed using your private Ed25519 key, which is securely encrypted with a key derived from your doctor password
                (AES-256-GCM + PBKDF2). The resulting cryptographic proof guarantees that neither the items nor the instructions
                can be altered without invalidating the verification status.
              </p>
            </div>
          </div>
        </div>

        {/* Success Modal / Banner */}
        {createdResult && (
          <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-bold text-lg text-white">Prescription Issued & Signed Successfully!</span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                STATUS: ISSUED
              </span>
            </div>

            <p className="text-sm text-slate-300">
              Prescription <code className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300 font-mono">{createdResult.id}</code> has been signed with your Ed25519 key.
            </p>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs space-y-2 text-slate-400 break-all">
              <div>
                <span className="text-cyan-400 font-semibold">Canonical SHA-256 Hash:</span>{' '}
                {createdResult.signature?.canonicalHash || 'Computed'}
              </div>
              <div>
                <span className="text-emerald-400 font-semibold">Ed25519 Signature:</span>{' '}
                {createdResult.signature?.signature?.slice(0, 48)}...
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => navigate(`/prescriptions/${createdResult.id}`)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition shadow-lg shadow-cyan-600/30"
              >
                <span>View Full Prescription</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate(`/prescriptions/${createdResult.id}/verify`)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/30"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify Cryptographic Integrity</span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-sm flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Patient and Consultation context */}
          <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">1</span>
              <span>Patient & Consultation Assignment</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Select Patient
                </label>
                <select
                  value={selectedPatientId}
                  onChange={e => setSelectedPatientId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {patients.length > 0 ? (
                    patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} ({p.email})
                      </option>
                    ))
                  ) : (
                    <option value="">Default Patient (Alice Smith)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Linked Consultation (Optional)
                </label>
                <select
                  value={selectedConsultationId}
                  onChange={e => setSelectedConsultationId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Auto-create / Link New Consultation</option>
                  {consultations.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.patient ? `${c.patient.firstName} ${c.patient.lastName} - ` : ''}
                      {new Date(c.scheduledAt).toLocaleDateString()} ({c.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Prescription Items */}
          <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">2</span>
                <span>Prescription Items</span>
              </h2>

              {/* Presets */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets:
                </span>
                <button
                  type="button"
                  onClick={() => applyPreset('antibiotic')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                >
                  Antibiotics
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('hypertension')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                >
                  Hypertension
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('diabetes')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                >
                  Diabetes
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-3 relative group transition hover:border-slate-600"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                      Item #{idx + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-500 hover:text-rose-400 transition p-1"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Medication Name & Strength *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Amoxicillin, Lisinopril, Metformin"
                        value={item.medication}
                        onChange={e => handleItemChange(idx, 'medication', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Dosage / Frequency *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 500mg PO TID, 10mg once daily"
                        value={item.dosage}
                        onChange={e => handleItemChange(idx, 'dosage', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Patient Instructions & Warnings
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Take with meals for 7 days. Do not stop early."
                      value={item.instructions}
                      onChange={e => handleItemChange(idx, 'instructions', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2.5 border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl text-slate-300 hover:text-cyan-400 text-sm font-medium flex items-center justify-center space-x-2 transition bg-slate-900/40"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Medication Item</span>
              </button>
            </div>
          </div>

          {/* Section 3: Doctor Security Signing Unlock */}
          <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">3</span>
              <span>Doctor Cryptographic Signing Authentication</span>
            </h2>

            <p className="text-xs text-slate-400">
              To guarantee non-repudiation, your private signing key is encrypted in the database. Enter your password
              to derive the PBKDF2 AES-GCM key and sign this prescription with your certified Ed25519 keypair.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" /> Doctor Account Password
              </label>
              <input
                type="password"
                required
                value={doctorPassword}
                onChange={e => setDoctorPassword(e.target.value)}
                placeholder="Enter doctor password to unlock signing key"
                className="w-full max-w-md bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Default seeded credentials: <code className="text-cyan-400 font-mono">Password123!</code>
              </p>
            </div>
          </div>

          {/* Action button */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/prescriptions')}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-cyan-500/25 disabled:opacity-50"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>{isSubmitting ? 'Computing Signatures...' : 'Digitally Sign & Issue Prescription'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
