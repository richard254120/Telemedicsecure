import React, { useState } from 'react';
import {
  ShieldCheck,
  FileSearch,
  UploadCloud,
  CheckCircle2,
  AlertOctagon,
  FileText,
  Blocks,
  RefreshCw,
  ExternalLink,
  Lock
} from 'lucide-react';
import { API_BASE } from '../config';

interface VerificationResult {
  isValid: boolean;
  status: 'AUTHENTIC_VERIFIED' | 'TAMPERED_OR_UNANCHORED';
  computedHash: string;
  onChainAnchored: boolean;
  blockNumber?: number | null;
  txHash?: string | null;
  reportDetails?: any | null;
  reason?: string;
  verifiedAt: string;
}

export default function ReportVerification() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleVerify = async () => {
    if (!selectedFile) {
      setError('Please select or drop a PDF report file.');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('reportPdf', selectedFile);

    try {
      const token = localStorage.getItem('token') || '';
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/investigation/reports/verify`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed');
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || 'Network error verifying report');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            <Blocks className="w-3.5 h-3.5" />
            <span>Hardhat Solidity Smart Contract Verification</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Forensic Report Integrity Verification
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Upload any TeleMedSecure Forensic Report (PDF) to recompute its SHA-256 cryptographic digest and verify authenticity against the blockchain anchor.
          </p>
        </div>

        {/* Upload Box */}
        <div
          onDragOver={e => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`p-10 rounded-3xl border-2 border-dashed transition flex flex-col items-center justify-center text-center space-y-4 ${
            dragActive
              ? 'border-cyan-400 bg-cyan-950/20'
              : selectedFile
              ? 'border-emerald-500/50 bg-slate-900/80'
              : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shadow-lg">
            {selectedFile ? <FileText className="w-8 h-8 text-emerald-400" /> : <UploadCloud className="w-8 h-8" />}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              {selectedFile ? selectedFile.name : 'Choose a Forensic Report (PDF) to verify'}
            </p>
            <p className="text-xs text-slate-500">
              {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Drag & drop file here, or click to browse'}
            </p>
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-semibold transition">
              {selectedFile ? 'Choose Different File' : 'Browse Files'}
            </span>
          </label>
        </div>

        {/* Verify Action Button */}
        {selectedFile && (
          <div className="flex justify-center">
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="px-8 py-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-cyan-600/20 transition flex items-center space-x-2 disabled:opacity-50"
            >
              <FileSearch className="w-4 h-4" />
              <span>{isVerifying ? 'Verifying On Blockchain...' : 'Verify Cryptographic Seal'}</span>
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Verification Result Card */}
        {result && (
          <div
            className={`p-8 rounded-3xl border shadow-2xl transition space-y-6 ${
              result.isValid
                ? 'bg-gradient-to-b from-emerald-950/30 via-slate-900 to-slate-950 border-emerald-500/40 shadow-emerald-950/40'
                : 'bg-gradient-to-b from-red-950/30 via-slate-900 to-slate-950 border-red-500/40 shadow-red-950/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    result.isValid
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}
                >
                  {result.isValid ? (
                    <CheckCircle2 className="w-8 h-8" />
                  ) : (
                    <AlertOctagon className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        result.isValid
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {result.status}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(result.verifiedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {result.isValid
                      ? 'Authentic & Verified On Blockchain'
                      : 'Verification Failed: Tampered or Forged Document'}
                  </h2>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase font-semibold">On-Chain Anchor</span>
                <div
                  className={`text-sm font-bold font-mono mt-0.5 ${
                    result.onChainAnchored ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {result.onChainAnchored ? 'ANCHORED (FOUND)' : 'NOT ANCHORED (ABSENT)'}
                </div>
              </div>
            </div>

            {/* Cryptographic Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-slate-400 uppercase text-[10px] font-sans font-semibold">Recomputed SHA-256 Digest</div>
                <div className="text-cyan-300 break-all">{result.computedHash}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-slate-400 uppercase text-[10px] font-sans font-semibold">Blockchain Transaction Hash</div>
                <div className="text-indigo-300 break-all">{result.txHash || 'None (Transaction not found on chain)'}</div>
              </div>
            </div>

            {result.reportDetails && (
              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans">
                  Associated Case Details from Database
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Case Title:</span>
                    <strong className="text-white">{result.reportDetails.title}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Investigator:</span>
                    <strong className="text-white">{result.reportDetails.investigator}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Block Height:</span>
                    <strong className="text-emerald-400">#{result.blockNumber}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
              <strong className="text-slate-300">Verification Rationale: </strong>
              {result.reason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
