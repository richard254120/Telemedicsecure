import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  Plus,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

export default function ConsultationCreate() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users`, { headers });
      if (res.ok) {
        const users = await res.json();
        const patients = users.filter((u: any) => u.role === 'PATIENT');
        setPatients(patients);
      }
    } catch (e) {
      console.error('Failed to fetch patients', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!selectedPatientId || !scheduledAt) {
        throw new Error('Please select a patient and schedule a date/time');
      }

      const headers = getAuthHeaders();
      const payload = {
        patientId: selectedPatientId,
        scheduledAt: new Date(scheduledAt).toISOString()
      };

      const res = await fetch(`${API_BASE}/consultations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create consultation');
      }

      const consultation = await res.json();
      setSuccess(true);
      setTimeout(() => {
        navigate('/doctor');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create consultation');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-8">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Consultation Scheduled!</h2>
            <p className="text-slate-400">Redirecting to your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Schedule Consultation</h1>
              <p className="text-sm text-slate-400">
                Create a new telemedicine consultation appointment with a patient
              </p>
            </div>
          </div>
        </div>

        {/* GDPR Consent Notice */}
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-2">
          <div className="flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <h3 className="font-semibold text-cyan-200">GDPR Compliance Check</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                The system will verify that the selected patient has granted active consent for telemedicine treatment
                before scheduling. If consent is missing, you will be prompted to have the patient complete the consent form.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-sm flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Patient Selection */}
          <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-400" />
              <span>Select Patient</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Patient
              </label>
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a patient...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.email})
                  </option>
                ))}
              </select>
              {patients.length === 0 && (
                <p className="text-xs text-slate-500 mt-2">No patients available. Contact an administrator to add patients.</p>
              )}
            </div>
          </div>

          {/* Scheduling */}
          <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span>Schedule Date & Time</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Appointment Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Reason for Consultation (Optional)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Follow-up for hypertension, Annual checkup, Prescription renewal"
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              <span>{loading ? 'Scheduling...' : 'Schedule Consultation'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
