import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  RefreshCw,
  Search,
  Activity,
  Calendar,
  CheckSquare,
  Square,
  Heart,
  TrendingUp,
  X,
  FileCheck2,
  ShieldCheck
} from 'lucide-react';

export default function CareCoordinatorWorkbench() {
  const { user, getAuthHeaders } = useAuth();

  const [plans, setPlans] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cohortFilter, setCohortFilter] = useState('ALL');

  // Modals & Action States
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedPlanTasks, setSelectedPlanTasks] = useState<any | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Care Plan Form
  const [newPatientId, setNewPatientId] = useState('');
  const [newCohort, setNewCohort] = useState('HYPERTENSION');
  const [newDiagnosisTitle, setNewDiagnosisTitle] = useState('Essential Hypertension Stage II Protocol');
  const [newGoals, setNewGoals] = useState('Maintain resting blood pressure < 130/80 mmHg via daily digital telemetry & sodium restriction.');
  const [newRiskLevel, setNewRiskLevel] = useState('MEDIUM');

  useEffect(() => {
    fetchCareData();
  }, []);

  const fetchCareData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [plnRes, statRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/stations/care-coordination/plans`, { headers }),
        fetch(`${API_BASE}/stations/care-coordination/stats`, { headers }),
        fetch(`${API_BASE}/consultations/patients`, { headers })
      ]);

      if (plnRes.ok) setPlans(await plnRes.json());
      if (statRes.ok) setStats(await statRes.json());
      if (pRes.ok) {
        const pData = await pRes.json();
        setPatients(Array.isArray(pData) ? pData : []);
        if (pData.length > 0 && !newPatientId) setNewPatientId(pData[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching care coordination data', err);
      setActionError('Could not load care coordination records.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/stations/care-coordination/plans`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: newPatientId,
          cohort: newCohort,
          diagnosisTitle: newDiagnosisTitle,
          goals: newGoals,
          riskLevel: newRiskLevel,
          nextReviewDays: 30
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to enroll patient');
      }

      setActionSuccess(`Patient successfully enrolled in Chronic Disease Management protocol.`);
      setShowEnrollModal(false);
      fetchCareData();
      setTimeout(() => setActionSuccess(null), 4500);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/stations/care-coordination/tasks/${taskId}/toggle`, {
        method: 'PUT',
        headers
      });

      if (res.ok) {
        fetchCareData();
      }
    } catch (err: any) {
      console.error('Error toggling care task', err);
    }
  };

  const filteredPlans = plans.filter(p => {
    const matchesSearch =
      p.planNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.diagnosisTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patient?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patient?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCohort = cohortFilter === 'ALL' || p.cohort === cohortFilter;
    return matchesSearch && matchesCohort;
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Care Plans</span>
          <div className="text-2xl font-black text-teal-400 tracking-tight">
            {stats?.activeCarePlans ?? plans.length}
          </div>
          <p className="text-[11px] text-teal-400 font-mono">Enrolled Chronic Cohorts</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Follow-Ups Due</span>
          <div className="text-2xl font-black text-amber-400 tracking-tight">
            {stats?.postDischargeFollowUps ?? 0}
          </div>
          <p className="text-[11px] text-amber-400 font-mono">Pending Coordinator Actions</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cohort Adherence</span>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">
            {stats?.adherenceRate ?? '93.2%'}
          </div>
          <p className="text-[11px] text-emerald-400 font-mono">Medication & Telemetry</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Readmission Risk</span>
          <div className="text-2xl font-black text-cyan-400 tracking-tight">
            {stats?.readmissionRisk ?? 'Low (3.8%)'}
          </div>
          <p className="text-[11px] text-cyan-400 font-mono">Post-Discharge Index</p>
        </div>
      </div>

      {/* Main Care Coordination Workspace */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Chronic Care Management & Multidisciplinary Care Plans</h3>
              <p className="text-xs text-slate-400">Coordinate post-discharge transitions, track medication compliance, and schedule recurring telemedicine visits</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchCareData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowEnrollModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-teal-600/20 transition flex items-center space-x-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Enroll Patient</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search plan, diagnosis, patient..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={cohortFilter}
              onChange={e => setCohortFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none"
            >
              <option value="ALL">All Cohorts</option>
              <option value="HYPERTENSION">Hypertension Cohort</option>
              <option value="DIABETES_T2">Diabetes Type II</option>
              <option value="COPD">COPD / Pulmonary</option>
              <option value="POST_OP_CARDIO">Post-Op Cardiology</option>
            </select>
            <span className="text-xs text-slate-400 font-mono">
              {filteredPlans.length} Enrolled
            </span>
          </div>
        </div>

        {/* Care Plans Roster */}
        {filteredPlans.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40 text-teal-400" />
            <p className="text-sm font-semibold text-slate-300">No chronic care plans enrolled</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredPlans.map(plan => (
              <div key={plan.id} className="p-6 hover:bg-slate-850/50 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      {plan.cohort}
                    </span>
                    <span className="text-xs font-mono text-teal-400 font-bold">{plan.planNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      plan.riskLevel === 'LOW' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {plan.riskLevel} Risk
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Patient: {plan.patient?.firstName} {plan.patient?.lastName} ({plan.patient?.email})
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5 font-medium">
                      Protocol: <span className="text-white">{plan.diagnosisTitle}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Goals: {plan.goals}
                    </p>
                  </div>

                  {/* Adherence and Review Date */}
                  <div className="flex items-center space-x-4 pt-1 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-slate-400 font-mono">Adherence:</span>
                      <div className="w-24 h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                          style={{ width: `${plan.adherencePercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-emerald-400 font-bold font-mono">{plan.adherencePercent}%</span>
                    </div>
                    <span className="text-slate-500">•</span>
                    <span className="text-[11px] text-slate-400">
                      Next Review: <strong className="text-white">{new Date(plan.nextReviewDate).toLocaleDateString()}</strong>
                    </span>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 lg:w-80 space-y-2 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Coordination Tasks ({plan.tasks?.filter((t: any) => t.isCompleted).length || 0}/{plan.tasks?.length || 0})
                  </span>
                  <div className="space-y-1.5">
                    {plan.tasks?.map((task: any) => (
                      <div
                        key={task.id}
                        onClick={() => handleToggleTask(task.id)}
                        className="flex items-start space-x-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-900 transition"
                      >
                        {task.isCompleted ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                        )}
                        <span className={`text-[11px] ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Enroll Patient in Care Plan */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-teal-400" />
                <span>Enroll Patient in Chronic Care Management</span>
              </h3>
              <button onClick={() => setShowEnrollModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleEnrollPatient} className="space-y-3">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Chronic Cohort
                  </label>
                  <select
                    value={newCohort}
                    onChange={e => setNewCohort(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value="HYPERTENSION">Hypertension Stage I/II</option>
                    <option value="DIABETES_T2">Type 2 Diabetes Mellitus</option>
                    <option value="COPD">COPD / Chronic Respiratory</option>
                    <option value="POST_OP_CARDIO">Post-Op Cardiovascular</option>
                    <option value="CHRONIC_KIDNEY">Chronic Kidney Disease</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Readmission Risk Level
                  </label>
                  <select
                    value={newRiskLevel}
                    onChange={e => setNewRiskLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value="LOW">Low Risk</option>
                    <option value="MEDIUM">Medium Risk</option>
                    <option value="HIGH">High Risk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Protocol Title *
                </label>
                <input
                  type="text"
                  value={newDiagnosisTitle}
                  onChange={e => setNewDiagnosisTitle(e.target.value)}
                  required
                  placeholder="e.g. Essential Hypertension Protocol"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Primary Goals & Telemetry Milestones *
                </label>
                <textarea
                  rows={3}
                  value={newGoals}
                  onChange={e => setNewGoals(e.target.value)}
                  required
                  placeholder="Primary clinical goals for patient..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold transition flex items-center space-x-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Enroll in Care Plan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
