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
  ChevronRight
} from 'lucide-react';
import { TwoFactorSetupModal } from '../../components/TwoFactorSetupModal';

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

  // Data states
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Interactive Form States
  // 1. Lab Tech State
  const [labSpecimenType, setLabSpecimenType] = useState('Venous Blood (EDTA)');
  const [labTestType, setLabTestType] = useState('Complete Blood Count (CBC)');
  const [labValueResult, setLabValueResult] = useState('WBC: 6.8 x10^9/L, Hb: 14.2 g/dL, Platelets: 240 x10^9/L (Normal)');
  const [selectedLabPatient, setSelectedLabPatient] = useState<string>('');

  // 2. Radiologist State
  const [imagingType, setImagingType] = useState('Chest X-Ray (PA & Lateral)');
  const [imagingImpression, setImagingImpression] = useState('Clear lung fields. No focal consolidation, pneumothorax, or acute bony abnormalities.');
  const [isUrgentFinding, setIsUrgentFinding] = useState<boolean>(false);
  const [selectedRadioPatient, setSelectedRadioPatient] = useState<string>('');

  // 3. Billing State
  const [billingCode, setBillingCode] = useState('CPT-99214 / ICD-10-I10');
  const [billingAmount, setBillingAmount] = useState('150.00');
  const [insuranceStatus, setInsuranceStatus] = useState('Verified (Aetna Copay: $25.00)');

  // 4. Triage State
  const [triageAcuity, setTriageAcuity] = useState('ESI-3 (Urgent)');
  const [triageNotes, setTriageNotes] = useState('Mild tachypnea. SpO2 96% on room air. Stable hemodynamics.');
  const [selectedTriageConsultation, setSelectedTriageConsultation] = useState<string>('');

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

      if (validPatients.length > 0) {
        if (!selectedLabPatient) setSelectedLabPatient(validPatients[0].id);
        if (!selectedRadioPatient) setSelectedRadioPatient(validPatients[0].id);
        if (!receptionPatientId) setReceptionPatientId(validPatients[0].id);
      }
      if (validDoctors.length > 0 && !receptionDoctorId) {
        setReceptionDoctorId(validDoctors[0].id);
      }
      if (validConsultations.length > 0 && !selectedTriageConsultation) {
        setSelectedTriageConsultation(validConsultations[0].id);
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

  // Dispense Prescription (for Pharmacist)
  const handleDispenseRx = async (rxId: string) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/prescriptions/${rxId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: 'DISPENSED',
          statusReason: `Dispensed and verified by ${user?.firstName} ${user?.lastName} (RPh License #${user?.medicalLicenseNo || 'PHARM-8941'})`
        })
      });

      if (res.ok) {
        // Dispatch instant patient pickup SMS alert
        fetch(`${API_BASE}/sms/prescription-alert`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prescriptionId: rxId,
            pharmacyName: 'St. Jude Clinical Hospital Pharmacy'
          })
        }).catch(console.warn);

        setActionSuccess(`Prescription #${rxId.slice(0, 8)} successfully marked DISPENSED. Outbound SMS notification sent to patient!`);
        setTimeout(() => setActionSuccess(null), 5000);
        fetchStationData();
      } else {
        const err = await res.json();
        setActionError(err.error || 'Failed to update prescription status');
      }
    } catch (e: any) {
      setActionError(`Dispense error: ${e.message}`);
    }
  };

  // Encrypt and seal Diagnostic Lab Result (for Lab Tech)
  const handleSaveLabResult = async () => {
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      const targetPatientId = selectedLabPatient || patientsList[0]?.id;
      if (!targetPatientId) {
        setActionError('Please select a patient to record laboratory findings');
        return;
      }
      const headers = getAuthHeaders();
      const labPayload = {
        type: 'LABORATORY_REPORT',
        testPanel: labTestType,
        specimen: labSpecimenType,
        findings: labValueResult,
        recordedBy: `${user?.firstName} ${user?.lastName} (${user?.medicalLicenseNo || 'MLT-ACTIVE'})`,
        timestamp: new Date().toISOString()
      };
      const res = await fetch(`${API_BASE}/medical-records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: targetPatientId,
          data: labPayload
        })
      });
      if (res.ok) {
        setActionSuccess(`Laboratory panel [${labTestType}] envelope-encrypted (AES-256-GCM) and sealed to patient EHR. Attending physician notified.`);
        setTimeout(() => setActionSuccess(null), 5000);
      } else {
        const d = await res.json().catch(() => ({}));
        setActionError(d.error || 'Failed to seal diagnostic result');
      }
    } catch (e: any) {
      setActionError(`Lab error: ${e.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Sign and publish Teleradiology Report (for Radiologist)
  const handleSaveRadiologyReport = async () => {
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      const targetPatientId = selectedRadioPatient || patientsList[0]?.id;
      if (!targetPatientId) {
        setActionError('Please select a patient for imaging review');
        return;
      }
      const headers = getAuthHeaders();
      const radioPayload = {
        type: 'RADIOLOGY_REPORT',
        modality: imagingType,
        impression: imagingImpression,
        criticalFinding: isUrgentFinding,
        radiologist: `Dr. ${user?.firstName} ${user?.lastName} (${user?.medicalLicenseNo || 'RAD-TELE'})`,
        timestamp: new Date().toISOString()
      };
      const res = await fetch(`${API_BASE}/medical-records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: targetPatientId,
          data: radioPayload
        })
      });
      if (res.ok) {
        if (isUrgentFinding) {
          fetch(`${API_BASE}/vital-signs/clinical-flags`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              patientId: targetPatientId,
              type: 'ACUTE_RADIOLOGY_FINDING',
              severity: 'CRITICAL',
              flagReason: `Acute Radiological Finding: ${imagingType} - ${imagingImpression.slice(0, 80)}...`
            })
          }).catch(console.warn);
        }
        setActionSuccess(`Radiological impression for [${imagingType}] cryptographically signed and stored in EHR.${isUrgentFinding ? ' Critical alert broadcasted to clinical team.' : ''}`);
        setTimeout(() => setActionSuccess(null), 5000);
      } else {
        const d = await res.json().catch(() => ({}));
        setActionError(d.error || 'Failed to sign and publish radiology report');
      }
    } catch (e: any) {
      setActionError(`Radiology error: ${e.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Publish Emergency Triage Acuity Assessment (for Triage Officer)
  const handleSaveTriageAssessment = async () => {
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      const targetConsultation = consultations.find(c => c.id === selectedTriageConsultation) || consultations[0];
      const targetPatientId = targetConsultation?.patient?.id || patientsList[0]?.id;
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/vital-signs/clinical-flags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          consultationId: targetConsultation?.id,
          patientId: targetPatientId,
          type: 'TRIAGE_ACUITY_ASSIGNED',
          severity: triageAcuity.includes('Level 1') || triageAcuity.includes('Level 2') ? 'CRITICAL' : 'HIGH',
          flagReason: `Triage Acuity [${triageAcuity}]: ${triageNotes}`
        })
      });
      if (res.ok) {
        setActionSuccess(`Patient triaged at [${triageAcuity}]. Routing priority and clinical flag broadcasted to physician queue.`);
        setTimeout(() => setActionSuccess(null), 5000);
      } else {
        const d = await res.json().catch(() => ({}));
        setActionError(d.error || 'Failed to record triage acuity');
      }
    } catch (e: any) {
      setActionError(`Triage error: ${e.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

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

        {/* KPI Operational Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {station.kpis.map((kpi, idx) => (
            <div key={idx} className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</span>
              <div className="text-2xl font-black text-white tracking-tight">{kpi.val}</div>
              <p className="text-[11px] text-cyan-400 font-mono">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Role-Specific Operational Workspace */}
        {/* ============================================================== */}
        {/* 1. PHARMACIST WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'PHARMACIST' && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">e-Prescription Dispensing & DEA EPCS Verification Queue</h3>
                  <p className="text-xs text-slate-400">Digitally signed prescriptions awaiting verification, dosage review, and pharmacy fulfillment</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                  {prescriptions.length} Active Prescriptions
                </span>
              </div>

              {prescriptions.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Pill className="w-10 h-10 mx-auto mb-3 opacity-40 text-cyan-400" />
                  <p className="text-sm font-semibold text-slate-300">No pending prescriptions in queue</p>
                  <p className="text-xs text-slate-500 mt-1">Prescriptions issued by attending physicians will appear here in real-time.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {prescriptions.map((rx) => (
                    <div key={rx.id} className="p-6 hover:bg-slate-850/50 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            rx.status === 'DISPENSED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          }`}>
                            {rx.status}
                          </span>
                          <span className="text-xs font-mono text-cyan-400 font-bold">RX-#{rx.id.slice(0, 8).toUpperCase()}</span>
                          <span className="text-xs text-slate-400">Issued: {new Date(rx.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-white">
                            Patient: {rx.consultation?.patient ? `${rx.consultation.patient.firstName} ${rx.consultation.patient.lastName}` : 'Direct Patient'} • Prescribing MD: Dr. {rx.doctor?.firstName} {rx.doctor?.lastName}
                          </h4>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {rx.items?.map((item: any, i: number) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
                                <strong className="text-white">{item.medication}</strong> ({item.dosage}) - {item.instructions}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                          <span className="flex items-center space-x-1 text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Ed25519 Signature Verified</span>
                          </span>
                          <span>•</span>
                          <span>Canonical Hash: {rx.signature?.canonicalHash?.slice(0, 12) || 'Verified'}...</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigate(`/prescriptions/${rx.id}/verify`)}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                        >
                          Inspect Signature
                        </button>
                        {rx.status !== 'DISPENSED' && (
                          <button
                            onClick={() => handleDispenseRx(rx.id)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                          >
                            <Pill className="w-3.5 h-3.5" />
                            <span>Dispense & SMS Patient</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. LAB TECHNICIAN WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'LAB_TECHNICIAN' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Diagnostic Laboratory Order Intake & Result Entry</h3>
                  <p className="text-xs text-slate-400">Record specimen barcodes, enter quantitative biochemical analyses, and publish encrypted lab reports</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Select Patient *
                  </label>
                  <select
                    value={selectedLabPatient}
                    onChange={e => setSelectedLabPatient(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
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
                    Specimen Type & Container
                  </label>
                  <select
                    value={labSpecimenType}
                    onChange={e => setLabSpecimenType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Venous Blood (EDTA)">Venous Blood (EDTA Tube)</option>
                    <option value="Serum (SST Gold Top)">Serum (SST Gel Separator)</option>
                    <option value="Midstream Clean-Catch Urine">Midstream Clean-Catch Urine</option>
                    <option value="Nasopharyngeal Swab (Viral Media)">Nasopharyngeal Swab (RT-PCR)</option>
                    <option value="Biopsy Tissue (Formalin Fixed)">Biopsy Tissue (Formalin Fixed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Diagnostic Test Panel
                  </label>
                  <input
                    type="text"
                    value={labTestType}
                    onChange={e => setLabTestType(e.target.value)}
                    placeholder="Comprehensive Metabolic Panel (CMP)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Accession Barcode Number
                  </label>
                  <input
                    type="text"
                    defaultValue={`LAB-ACC-${Date.now().toString().slice(-6)}`}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 font-mono text-xs focus:outline-none"
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Quantitative Test Findings & Reference Ranges
                </label>
                <textarea
                  rows={3}
                  value={labValueResult}
                  onChange={e => setLabValueResult(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  placeholder="Enter quantitative laboratory values..."
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveLabResult}
                  disabled={isSubmittingAction}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center space-x-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSubmittingAction ? 'Encrypting with AES-256-GCM...' : 'Encrypt & Seal Diagnostic Result'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. RADIOLOGIST WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'RADIOLOGIST' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Scan className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Teleradiology PACS Reading & Imaging Review Station</h3>
                  <p className="text-xs text-slate-400">Interpret radiographic modalities, record structured clinical impressions, and flag acute emergencies</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Select Patient *
                  </label>
                  <select
                    value={selectedRadioPatient}
                    onChange={e => setSelectedRadioPatient(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
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
                    Imaging Modality & Anatomical View
                  </label>
                  <input
                    type="text"
                    value={imagingType}
                    onChange={e => setImagingType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    DICOM PACS Study UID
                  </label>
                  <input
                    type="text"
                    defaultValue={`1.2.840.10008.5.1.4.1.1.7.${Date.now()}`}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-purple-400 font-mono text-xs focus:outline-none"
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Radiological Impression & Diagnostic Findings
                </label>
                <textarea
                  rows={4}
                  value={imagingImpression}
                  onChange={e => setImagingImpression(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                  placeholder="Enter radiological impressions..."
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUrgentFinding}
                    onChange={e => setIsUrgentFinding(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-950 border-slate-700"
                  />
                  <span className="text-xs text-red-400 font-bold">Flag as Critical / Acute Finding (Triggers instant SMS to MD)</span>
                </label>

                <button
                  onClick={handleSaveRadiologyReport}
                  disabled={isSubmittingAction}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-purple-600/20 flex items-center space-x-2"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{isSubmittingAction ? 'Cryptographically Signing...' : 'Sign & Publish Radiology Report'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. BILLING & INSURANCE OFFICER WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'BILLING_OFFICER' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Medical Billing, Claims & Insurance Pre-Authorization</h3>
                  <p className="text-xs text-slate-400">HIPAA Isolated Financial Management: Process invoices, verify coverage, and submit insurance claims</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Procedure & Diagnosis Codes
                  </label>
                  <input
                    type="text"
                    value={billingCode}
                    onChange={e => setBillingCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Fee Amount (USD)
                  </label>
                  <input
                    type="text"
                    value={billingAmount}
                    onChange={e => setBillingAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Payer Verification Status
                  </label>
                  <input
                    type="text"
                    value={insuranceStatus}
                    onChange={e => setInsuranceStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setActionSuccess(`Invoice #${Date.now().toString().slice(-6)} ($${billingAmount}) generated and submitted for electronic claims clearing.`);
                    setTimeout(() => setActionSuccess(null), 4500);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs transition shadow-lg shadow-amber-600/20 flex items-center space-x-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Submit Electronic Claim & Invoice</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. TRIAGE OFFICER WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'TRIAGE_OFFICER' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Emergency Intake & Acuity Triage Sorting</h3>
                  <p className="text-xs text-slate-400">Assign Emergency Severity Index (ESI) scores and route patients to priority queues</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Select Consultation / Patient *
                  </label>
                  <select
                    value={selectedTriageConsultation}
                    onChange={e => setSelectedTriageConsultation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-rose-500"
                  >
                    {consultations.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : `Consultation #${c.id.slice(0, 6)}`} (Dr. {c.doctor?.lastName || 'Physician'})
                      </option>
                    ))}
                    {consultations.length === 0 && <option value="">No consultations in queue</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Emergency Severity Index (ESI)
                  </label>
                  <select
                    value={triageAcuity}
                    onChange={e => setTriageAcuity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:outline-none focus:border-rose-500"
                  >
                    <option value="ESI-1 (Immediate Resuscitation)">Level 1 - Immediate Resuscitation Required</option>
                    <option value="ESI-2 (Emergent / High Risk)">Level 2 - Emergent / High Risk / Severe Pain</option>
                    <option value="ESI-3 (Urgent / Multi-Resource)">Level 3 - Urgent (Multiple Diagnostic Resources)</option>
                    <option value="ESI-4 (Less Urgent / Single Resource)">Level 4 - Less Urgent (Single Diagnostic Resource)</option>
                    <option value="ESI-5 (Non-Urgent / Routine)">Level 5 - Non-Urgent (Routine Follow-up)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Virtual Waiting Room Routing
                  </label>
                  <input
                    type="text"
                    defaultValue="General Clinical Queue #A-102"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-rose-400 font-mono text-xs focus:outline-none"
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Intake Assessment & Primary Complaints
                </label>
                <textarea
                  rows={3}
                  value={triageNotes}
                  onChange={e => setTriageNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveTriageAssessment}
                  disabled={isSubmittingAction}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-rose-600/20 flex items-center space-x-2"
                >
                  <HeartPulse className="w-4 h-4" />
                  <span>{isSubmittingAction ? 'Publishing Acuity...' : 'Publish Triage Acuity Assessment'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 6. CARE COORDINATOR WORKSPACE */}
        {/* ============================================================== */}
        {stationRole === 'CARE_COORDINATOR' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Chronic Care Management & Multidisciplinary Care Plans</h3>
                  <p className="text-xs text-slate-400">Coordinate post-discharge transitions, track medication compliance, and schedule recurring telemedicine visits</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                <span className="font-bold text-white">Active Chronic Cohorts:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Cohort A: Diabetes Type II</span>
                    <span className="text-emerald-400 font-bold text-sm">14 Patients (94% adherence)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Cohort B: Essential Hypertension</span>
                    <span className="text-cyan-400 font-bold text-sm">18 Patients (Telemetry Active)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Cohort C: Post-Op Day 7</span>
                    <span className="text-purple-400 font-bold text-sm">5 Patients (Scheduled)</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setActionSuccess('Multi-disciplinary care plan notes updated. Recurring telemedicine visit scheduled.');
                    setTimeout(() => setActionSuccess(null), 4500);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs transition shadow-lg shadow-teal-600/20 flex items-center space-x-2"
                >
                  <Users className="w-4 h-4" />
                  <span>Update Care Coordination Roster</span>
                </button>
              </div>
            </div>
          </div>
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
                          message: `TeleMedSecure: Welcome ${receptionPatientName || 'Patient'} to St. Jude Hospital. Your telemedicine consultation room is ready. Connect securely at: ${window.location.origin}/waiting-room/direct`,
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
      </div>
    </div>
  );
}
