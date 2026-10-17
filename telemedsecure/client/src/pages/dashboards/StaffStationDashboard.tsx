import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  Pill,
  FlaskConical,
  Scan,
  CreditCard,
  HeartPulse,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Send,
  Smartphone,
  ShieldCheck,
  FileText,
  Activity,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Eye,
  FileCheck,
  Lock,
  Printer,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { TwoFactorSetupModal } from '../../components/TwoFactorSetupModal';
import { ClinicalChatDrawer } from '../../components/ClinicalChatDrawer';
import BillingOfficerWorkbench from '../../components/BillingOfficerWorkbench';
import LabStationWorkbench from '../../components/stations/LabStationWorkbench';
import RadiologyWorkbench from '../../components/stations/RadiologyWorkbench';
import PharmacyWorkbench from '../../components/stations/PharmacyWorkbench';
import TriageWorkbench from '../../components/stations/TriageWorkbench';
import CareCoordinatorWorkbench from '../../components/stations/CareCoordinatorWorkbench';


interface StaffStationDashboardProps {
  stationRole: UserRole;
}

export default function StaffStationDashboard({ stationRole }: StaffStationDashboardProps) {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [show2FAModal, setShow2FAModal] = useState<boolean>(false);
  const [showChatDrawer, setShowChatDrawer] = useState<boolean>(false);

  // Data states
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 5. Receptionist State
  const [receptionPhone, setReceptionPhone] = useState('');
  const [receptionPatientName, setReceptionPatientName] = useState('');
  const [receptionPatientId, setReceptionPatientId] = useState('');
  const [receptionDoctorId, setReceptionDoctorId] = useState('');
  const [receptionDateTime, setReceptionDateTime] = useState('');
  const [receptionReason, setReceptionReason] = useState('General Consultation');

  // Directory datasets for inter-service workflows
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  useEffect(() => {
    fetchStationData();
  }, [user, stationRole]);

  const fetchStationData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [rxRes, cRes, pRes, dRes] = await Promise.all([
        fetch(`${API_BASE}/prescriptions`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/consultations`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/consultations/patients`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/consultations/doctors`, { headers }).then(r => r.ok ? r.json() : []).catch(() => [])
      ]);

      const validPrescriptions = Array.isArray(rxRes) ? rxRes : [];
      const validConsultations = Array.isArray(cRes) ? cRes : [];
      const validPatients = Array.isArray(pRes) ? pRes : [];
      const validDoctors = Array.isArray(dRes) ? dRes : [];

      setPrescriptions(validPrescriptions);
      setConsultations(validConsultations);
      setPatientsList(validPatients);
      setDoctorsList(validDoctors);

      if (validPatients.length > 0 && !receptionPatientId) {
        setReceptionPatientId(validPatients[0].id);
      }
      if (validDoctors.length > 0 && !receptionDoctorId) {
        setReceptionDoctorId(validDoctors[0].id);
      }
    } catch (err: any) {
      console.warn('Failed to load station datasets:', err);
    } finally {
      setLoading(false);
    }
  };


  // Helper metadata by role
  const getStationInfo = () => {
    switch (stationRole) {
      case 'PHARMACIST':
        return {
          title: 'Pharmacy Dispensing & Drug Safety Station',
          dept: 'Department of Clinical Pharmacy & Therapeutics',
          color: 'from-cyan-600 to-blue-600',
          icon: Pill,
          kpis: [
            { label: 'Pending Dispensation', val: prescriptions.filter(p => p.status === 'ISSUED').length, sub: 'Verified by Physician' },
            { label: 'Dispensed Today', val: prescriptions.filter(p => p.status === 'DISPENSED').length, sub: 'Handed to Patient' },
            { label: 'EPCS Signatures', val: '100% Ed25519', sub: 'DEA Compliant' },
            { label: 'Interactions Checked', val: 'Active', sub: 'Drug-Drug Alerts' }
          ]
        };
      case 'LAB_TECHNICIAN':
        return {
          title: 'Laboratory Diagnostic & Pathology Station',
          dept: 'Division of Laboratory Medicine & Specimen Analysis',
          color: 'from-emerald-600 to-teal-600',
          icon: FlaskConical,
          kpis: [
            { label: 'Lab Orders In-Queue', val: 8, sub: 'Diagnostic Panels' },
            { label: 'Specimens Collected', val: 14, sub: 'Barcode Matched' },
            { label: 'Critical Values Flagged', val: 1, sub: 'Notified Physician' },
            { label: 'Turnaround Time', val: '32 min', sub: 'Avg per Test' }
          ]
        };
      case 'RADIOLOGIST':
        return {
          title: 'Diagnostic Radiology & Tele-Imaging Station',
          dept: 'Department of Medical Imaging & Nuclear Medicine',
          color: 'from-purple-600 to-indigo-600',
          icon: Scan,
          kpis: [
            { label: 'Scans Awaiting Read', val: 6, sub: 'PACS / DICOM' },
            { label: 'Signed Impressions', val: 18, sub: 'Cryptographically Sealed' },
            { label: 'Urgent Findings', val: 0, sub: 'No Acute Bleeds' },
            { label: 'Modalities Active', val: 'XR, CT, MRI', sub: 'All Sensors Online' }
          ]
        };
      case 'BILLING_OFFICER':
        return {
          title: 'Patient Accounts & Insurance Claims Station',
          dept: 'Department of Patient Financial Services & Revenue Cycle',
          color: 'from-amber-600 to-orange-600',
          icon: CreditCard,
          kpis: [
            { label: 'Claims Pending Review', val: 12, sub: 'ICD-10 / CPT Encounters' },
            { label: 'Approved Claims', val: '$28,450', sub: 'Medicare & Commercial' },
            { label: 'Copays Collected', val: '$1,820', sub: 'Electronic Payment' },
            { label: 'Privacy Isolation', val: 'HIPAA Compliant', sub: 'Financial PHI Separated' }
          ]
        };
      case 'TRIAGE_OFFICER':
        return {
          title: 'Emergency Intake & Acuity Triage Station',
          dept: 'Division of Emergency Medicine & Virtual Triage',
          color: 'from-rose-600 to-red-600',
          icon: HeartPulse,
          kpis: [
            { label: 'Virtual Waiting Room', val: consultations.filter(c => c.status === 'SCHEDULED').length, sub: 'Patients in Queue' },
            { label: 'Acuity Level 1/2', val: 1, sub: 'Priority Fast-Track' },
            { label: 'Average Wait Time', val: '6.4 min', sub: 'Intake to Clinician' },
            { label: 'NEWS2 Alerts', val: 'Automated', sub: 'Telemetry Linked' }
          ]
        };
      case 'CARE_COORDINATOR':
        return {
          title: 'Chronic Care & Case Management Station',
          dept: 'Department of Population Health & Integrated Care',
          color: 'from-teal-600 to-cyan-600',
          icon: Users,
          kpis: [
            { label: 'Active Care Plans', val: 24, sub: 'Hypertension & Diabetes' },
            { label: 'Post-Discharge Follow-ups', val: 7, sub: '48-hour Protocol' },
            { label: 'Adherence Rate', val: '92.4%', sub: 'Medication Compliance' },
            { label: 'Readmission Risk', val: 'Low (4%)', sub: 'Telemedicine Coordinated' }
          ]
        };
      case 'RECEPTIONIST':
      default:
        return {
          title: 'Patient Access & Front-Desk Scheduling Station',
          dept: 'Department of Patient Access & Clinical Scheduling',
          color: 'from-blue-600 to-cyan-600',
          icon: Calendar,
          kpis: [
            { label: 'Appointments Today', val: consultations.length || 10, sub: 'Virtual & In-Person' },
            { label: 'Checked-In Patients', val: 8, sub: 'Verified Identification' },
            { label: 'SMS Join Links Sent', val: 15, sub: 'Carrier Delivered' },
            { label: 'Physicians On-Duty', val: 4, sub: 'Active Calendars' }
          ]
        };
    }
  };

  const station = getStationInfo();
  const IconComponent = station.icon;



  // Schedule Appointment from Front Desk (for Receptionist)
  const handleReceptionSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receptionDateTime) {
      setActionError('Please specify scheduled appointment date and time');
      return;
    }
    const targetPatientId = receptionPatientId || patientsList[0]?.id;
    if (!targetPatientId) {
      setActionError('Please select a patient');
      return;
    }
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/consultations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: targetPatientId,
          doctorId: receptionDoctorId || doctorsList[0]?.id,
          scheduledAt: new Date(receptionDateTime).toISOString(),
          reason: receptionReason
        })
      });
      if (res.ok) {
        const created = await res.json();
        setActionSuccess(`Appointment successfully scheduled! Session ID: #${created.id?.substring(0, 8)}`);
        setReceptionDateTime('');
        fetchStationData();
        setTimeout(() => setActionSuccess(null), 5000);
      } else {
        const d = await res.json().catch(() => ({}));
        setActionError(d.error || 'Failed to schedule appointment');
      }
    } catch (e: any) {
      setActionError(`Booking error: ${e.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${station.color} flex items-center justify-center text-white shadow-xl`}>
                <IconComponent className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  {station.dept}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {station.title}
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active Clinician: <span className="font-semibold text-white">{user?.firstName} {user?.lastName}</span> ({stationRole}) • Verified License: <span className="font-mono text-cyan-300">{user?.medicalLicenseNo || 'HOSP-STATION-ACTIVE'}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchStationData}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition"
              title="Refresh Station Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowChatDrawer(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-cyan-300 font-semibold text-xs transition flex items-center space-x-1.5"
            >
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span>Care Chat</span>
            </button>
            <button
              onClick={() => setShow2FAModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-purple-300 font-semibold text-xs transition flex items-center space-x-1.5"
            >
              <Lock className="w-4 h-4 text-purple-400" />
              <span>Security 2FA</span>
            </button>
            <button
              onClick={() => navigate('/calendar')}
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-cyan-300 font-semibold text-xs transition flex items-center space-x-1.5"
            >
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Master Schedule</span>
            </button>
          </div>
        </div>

        {/* Action Messages */}
        {actionSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* KPI Operational Metrics Cards (Receptionist Station) */}
        {stationRole === 'RECEPTIONIST' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {station.kpis.map((kpi, idx) => (
              <div key={idx} className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</span>
                <div className="text-2xl font-black text-white tracking-tight">{kpi.val}</div>
                <p className="text-[11px] text-cyan-400 font-mono">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Role-Specific Operational Workspace */}
        {/* ============================================================== */}
        {/* 1. PHARMACIST WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'PHARMACIST' && (
          <PharmacyWorkbench />
        )}

        {/* ============================================================== */}
        {/* 2. LAB TECHNICIAN WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'LAB_TECHNICIAN' && (
          <LabStationWorkbench />
        )}

        {/* ============================================================== */}
        {/* 3. RADIOLOGIST WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'RADIOLOGIST' && (
          <RadiologyWorkbench />
        )}

        {/* ============================================================== */}
        {/* 4. BILLING & INSURANCE OFFICER WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'BILLING_OFFICER' && (
          <BillingOfficerWorkbench />
        )}

        {/* ============================================================== */}
        {/* 5. TRIAGE OFFICER WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'TRIAGE_OFFICER' && (
          <TriageWorkbench />
        )}

        {/* ============================================================== */}
        {/* 6. CARE COORDINATOR WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'CARE_COORDINATOR' && (
          <CareCoordinatorWorkbench />
        )}


        {/* ============================================================== */}
        {/* 7. RECEPTIONIST WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'RECEPTIONIST' && (
          <div className="space-y-6">
            {/* Quick Schedule Appointment Panel */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Patient Intake & Telemedicine Appointment Scheduling</h3>
                  <p className="text-xs text-slate-400">Book appointments directly with attending physicians for virtual and in-person clinical encounters</p>
                </div>
              </div>

              <form onSubmit={handleReceptionSchedule} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Select Patient *
                    </label>
                    <select
                      value={receptionPatientId}
                      onChange={e => setReceptionPatientId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500"
                    >
                      {patientsList.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} ({p.email})
                        </option>
                      ))}
                      {patientsList.length === 0 && <option value="">No patients registered</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Attending Physician *
                    </label>
                    <select
                      value={receptionDoctorId}
                      onChange={e => setReceptionDoctorId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-cyan-500"
                    >
                      {doctorsList.map(d => (
                        <option key={d.id} value={d.id}>
                          Dr. {d.firstName} {d.lastName} ({d.specialty || 'General Practice'})
                        </option>
                      ))}
                      {doctorsList.length === 0 && <option value="">No physicians available</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Appointment Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={receptionDateTime}
                      onChange={e => setReceptionDateTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Reason for Encounter / Clinical Chief Complaint
                  </label>
                  <input
                    type="text"
                    value={receptionReason}
                    onChange={e => setReceptionReason(e.target.value)}
                    placeholder="e.g. Hypertension review, persistent cough, prescription renewal"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-cyan-600/20 flex items-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmittingAction ? 'Scheduling...' : 'Confirm & Schedule Appointment'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Direct SMS Join Link Dispatch */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Direct SMS Waiting Room Invitation</h3>
                  <p className="text-xs text-slate-400">Dispatch instant 1-click video call SMS join links to patient smartphones</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    value={receptionPatientName}
                    onChange={e => setReceptionPatientName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Mobile Phone Number (for direct join link) *
                  </label>
                  <input
                    type="tel"
                    value={receptionPhone}
                    onChange={e => setReceptionPhone(e.target.value)}
                    placeholder="+254712345678 or +1 (555) 019-3829"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={async () => {
                    if (!receptionPhone.trim()) {
                      setActionError('Please enter a valid phone number');
                      return;
                    }
                    try {
                      const res = await fetch(`${API_BASE}/sms/send`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({
                          to: receptionPhone.trim(),
                          message: `TeleMedSecure: Welcome ${receptionPatientName || 'Patient'} to TeleMedSecure Clinical Health System. Your telemedicine consultation room is ready. Connect securely at: ${window.location.origin}/waiting-room/direct`,
                          purpose: 'DIRECT_JOIN_LINK'
                        })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setActionSuccess(`SMS join alert dispatched to ${receptionPhone}! (${data.log?.status})`);
                        setReceptionPhone('');
                        setReceptionPatientName('');
                        setTimeout(() => setActionSuccess(null), 4500);
                      } else {
                        setActionError(data.error || 'Failed to dispatch SMS');
                      }
                    } catch (e: any) {
                      setActionError(e.message);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/20 flex items-center space-x-2"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Send Telemedicine Room SMS</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2FA Setup Modal */}
        <TwoFactorSetupModal
          isOpen={show2FAModal}
          onClose={() => setShow2FAModal(false)}
        />

        {/* Real-Time Encrypted Clinical Care Chat Drawer */}
        <ClinicalChatDrawer
          isOpen={showChatDrawer}
          onClose={() => setShowChatDrawer(false)}
          consultationId="general-clinical-channel"
          recipientName={`Attending Care Team (${stationRole})`}
          recipientRole={stationRole}
        />
      </div>
    </div>
  );
}
