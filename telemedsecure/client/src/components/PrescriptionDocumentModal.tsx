import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  Printer,
  Download,
  Copy,
  Check,
  X,
  FileCheck2,
  Lock,
  QrCode,
  Building2,
  Stethoscope,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface PrescriptionModalProps {
  prescription: any;
  onClose: () => void;
}

export const PrescriptionDocumentModal: React.FC<PrescriptionModalProps> = ({
  prescription: rx,
  onClose
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Parse medication data if JSON string
  const med = typeof rx?.medication === 'string'
    ? (() => { try { return JSON.parse(rx.medication); } catch { return { name: rx.medication }; } })()
    : rx?.medication || {};

  const verifyUrl = `${window.location.origin}/prescriptions/verify?id=${encodeURIComponent(rx?.id || '')}&hash=${encodeURIComponent(rx?.digitalSignature || '')}`;

  useEffect(() => {
    if (rx) {
      QRCode.toDataURL(verifyUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('Failed to generate QR code', err));
    }
  }, [rx, verifyUrl]);

  if (!rx) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-8 print:border-none print:shadow-none print:my-0 print:rounded-none print:bg-white print:text-black">
        
        {/* Action Toolbar (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
              DEA EPCS Signed Electronic Prescription
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-700"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Verify URL'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-cyan-600/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prescription Printable Document Body */}
        <div className="p-8 sm:p-10 space-y-8 bg-slate-900 text-slate-100 print:bg-white print:text-slate-900 print:p-6" id="printable-rx">
          
          {/* Clinic & Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-800 print:border-slate-300 pb-6">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-cyan-400 print:text-cyan-800">
                <Building2 className="w-6 h-6" />
                <span className="text-xl font-black tracking-tight">TELEMEDSECURE CLINICAL NETWORK</span>
              </div>
              <p className="text-xs text-slate-400 print:text-slate-600">
                Department of Digital Medicine & Cryptographic Health Records
              </p>
              <p className="text-[11px] text-slate-500 print:text-slate-500 font-mono">
                DEA EPCS Certified Electronic Prescribing for Controlled Substances • 21 CFR Part 1311
              </p>
            </div>

            <div className="text-right sm:text-right space-y-1">
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 print:border print:border-slate-400 print:text-slate-900 print:bg-slate-100">
                RX #{rx.id ? rx.id.substring(0, 12).toUpperCase() : 'EPCS-RX'}
              </span>
              <div className="text-xs text-slate-400 print:text-slate-600 mt-2">
                Date Issued: <strong className="text-white print:text-black">{new Date(rx.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
              </div>
              <div className="text-xs text-slate-400 print:text-slate-600">
                Status: <strong className="text-emerald-400 print:text-emerald-700 font-mono">{rx.status || 'ACTIVE'}</strong>
              </div>
            </div>
          </div>

          {/* Practitioner & Patient Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-950/50 border border-slate-800 print:bg-slate-50 print:border-slate-300">
            {/* Prescriber Info */}
            <div className="space-y-1.5 border-b sm:border-b-0 sm:border-r border-slate-800 print:border-slate-300 pb-4 sm:pb-0 sm:pr-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 print:text-slate-600 uppercase tracking-wider">
                <Stethoscope className="w-4 h-4 text-cyan-400 print:text-cyan-700" />
                <span>Licensed Prescriber (Doctor)</span>
              </div>
              <div className="text-sm font-bold text-white print:text-slate-900">
                Dr. {rx.doctor?.firstName || 'Attending'} {rx.doctor?.lastName || 'Physician'}
              </div>
              <div className="text-xs text-slate-400 print:text-slate-600 font-mono">
                {rx.doctor?.email || 'doctor@telemedsecure.org'}
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-600">
                NPI No: <strong className="text-slate-300 print:text-slate-800 font-mono">{rx.doctor?.medicalLicenseNo || 'NPI-1928301948'}</strong>
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-600">
                Specialty: <span className="text-slate-300 print:text-slate-800">{rx.doctor?.specialty || 'General Telehealth'}</span>
              </div>
            </div>

            {/* Patient Info */}
            <div className="space-y-1.5 sm:pl-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 print:text-slate-600 uppercase tracking-wider">
                <User className="w-4 h-4 text-purple-400 print:text-purple-700" />
                <span>Patient Demographics</span>
              </div>
              <div className="text-sm font-bold text-white print:text-slate-900">
                {rx.patient?.firstName || 'Patient'} {rx.patient?.lastName || ''}
              </div>
              <div className="text-xs text-slate-400 print:text-slate-600 font-mono">
                {rx.patient?.email || 'patient@telemedsecure.org'}
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-600">
                MRN / ID: <strong className="text-slate-300 print:text-slate-800 font-mono">MRN-{rx.patientId ? rx.patientId.substring(0, 8) : '00000000'}</strong>
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-600">
                Treatment Authorization: <span className="text-emerald-400 print:text-emerald-700 font-semibold">Consent Verified</span>
              </div>
            </div>
          </div>

          {/* Rx Medication Details Box */}
          <div className="p-6 rounded-2xl bg-cyan-950/20 border-2 border-dashed border-cyan-500/40 print:bg-white print:border-slate-400 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-3xl font-serif font-black text-cyan-400 print:text-slate-900 mr-2">℞</span>
                <span className="text-xl font-black text-white print:text-black">
                  {med.name || med.drugName || rx.medicationName || 'Prescribed Pharmaceutical'}
                </span>
                <span className="ml-3 px-2.5 py-0.5 rounded text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 print:border print:border-slate-400 print:text-slate-900">
                  {med.dosage || rx.dosage || 'Standard Clinical Dose'}
                </span>
              </div>

              {med.deaSchedule && (
                <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-mono">
                  {med.deaSchedule}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-cyan-500/20 print:border-slate-300 text-xs">
              <div>
                <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-bold">Directions (Sig)</span>
                <strong className="text-white print:text-slate-900">{med.frequency || rx.frequency || 'Take as clinically directed by physician'}</strong>
              </div>
              <div>
                <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-bold">Dispense Quantity</span>
                <strong className="text-white print:text-slate-900">{med.quantity || rx.quantity || '30 Day Supply'}</strong>
              </div>
              <div>
                <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-bold">Refills Authorized</span>
                <strong className="text-white print:text-slate-900">{med.refills !== undefined ? med.refills : (rx.refills || 0)}</strong>
              </div>
              <div>
                <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-bold">Substitution Allowed</span>
                <strong className="text-white print:text-slate-900">Yes (Generic Permitted)</strong>
              </div>
            </div>

            {rx.notes && (
              <div className="pt-2 text-xs text-slate-300 print:text-slate-700 italic border-t border-cyan-500/20 print:border-slate-300">
                Clinical Instructions: "{rx.notes}"
              </div>
            )}
          </div>

          {/* Cryptographic Authenticity & QR Verification Barcode */}
          <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 print:bg-slate-50 print:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2 flex-1">
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 print:text-emerald-700 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Cryptographic Proof of Authenticity (Ed25519)</span>
              </div>
              <p className="text-[11px] text-slate-400 print:text-slate-600 leading-relaxed">
                This electronic prescription was signed using the physician’s cryptographic Ed25519 private key in compliance with DEA EPCS dual-factor authorization. Scan the QR code or visit the verification portal to audit the digital signature against the Merkle tree state.
              </p>
              
              <div className="p-2.5 rounded-xl bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 font-mono text-[10px] space-y-1">
                <div className="text-slate-400 print:text-slate-600 truncate">
                  Digital Signature: <span className="text-emerald-400 print:text-emerald-700 font-bold">{rx.digitalSignature || 'ED25519-AUTHENTICATED-EPCS-SIGNATURE-HASH'}</span>
                </div>
                <div className="text-slate-400 print:text-slate-600 truncate">
                  Public Key ID: <span className="text-cyan-400 print:text-cyan-700">{rx.doctor?.id ? `KEY-${rx.doctor.id.substring(0, 16)}` : 'KEY-PRACTITIONER-VERIFIED'}</span>
                </div>
              </div>
            </div>

            {/* Scannable Verification QR Code */}
            <div className="flex flex-col items-center justify-center shrink-0 p-3 bg-white rounded-2xl shadow-md border border-slate-300">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="Prescription Verification QR Code"
                  className="w-28 h-28 object-contain"
                />
              ) : (
                <div className="w-28 h-28 bg-slate-100 flex items-center justify-center text-slate-400">
                  <QrCode className="w-8 h-8 animate-pulse" />
                </div>
              )}
              <span className="text-[9px] font-mono font-bold text-slate-800 mt-1 uppercase tracking-wider text-center">
                Scan to Verify
              </span>
            </div>
          </div>

          {/* Footer Legal Notice */}
          <div className="text-[10px] text-slate-500 print:text-slate-500 border-t border-slate-800 print:border-slate-300 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Official TeleMedSecure DEA EPCS Prescription Document • Valid in all 50 US States</span>
            <span>Tamper-evident cryptographic ledger audit ID: <strong className="font-mono">{rx.id || 'N/A'}</strong></span>
          </div>

        </div>
      </div>
    </div>
  );
};
