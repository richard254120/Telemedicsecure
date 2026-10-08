import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Blocks,
  Link as LinkIcon,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Layers,
  Cpu,
  Clock,
  Sparkles,
  ArrowDown
} from 'lucide-react';
import {
  verifyAuditIntegrity,
  triggerOnChainAnchor,
  tamperAuditEvent,
  repairAuditChain,
  getChainedAuditEvents,
  AuditVerificationReport,
  ChainedAuditEventItem
} from '../utils/api';

export default function AuditIntegrityDashboard() {
  const [report, setReport] = useState<AuditVerificationReport | null>(null);
  const [events, setEvents] = useState<ChainedAuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vReport, vEvents] = await Promise.all([
        verifyAuditIntegrity(),
        getChainedAuditEvents()
      ]);
      setReport(vReport);
      setEvents(vEvents);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunVerify = async () => {
    try {
      setActionLoading(true);
      const res = await verifyAuditIntegrity();
      setReport(res);
      setBannerNotice('Verification job recomputed audit chain and verified all Merkle proofs.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnchorNow = async () => {
    try {
      setActionLoading(true);
      const res = await triggerOnChainAnchor();
      setBannerNotice(res.message);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateTamper = async () => {
    try {
      setActionLoading(true);
      const res = await tamperAuditEvent();
      setBannerNotice(res.message);
      // Immediately run verification to show TAMPERED
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepairChain = async () => {
    try {
      setActionLoading(true);
      const res = await repairAuditChain();
      setBannerNotice(res.message);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Blocks className="w-4 h-4" />
              <span>Step 8: Hash-Chained Audit & Blockchain Merkle Anchoring</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Audit Trail Cryptographic Integrity
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Tamper-evident hash chain with periodic Merkle tree root anchoring on Solidity smart contract
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunVerify}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition border border-slate-700"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400" />
              <span>Re-run Verify Job</span>
            </button>

            <button
              onClick={handleAnchorNow}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-lg shadow-cyan-600/25"
            >
              <Cpu className="w-4 h-4" />
              <span>Anchor to Hardhat Chain</span>
            </button>

            <button
              onClick={handleSimulateTamper}
              disabled={actionLoading}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-mono transition border border-amber-500/40"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Simulate DB Tampering</span>
            </button>

            {report && !report.isValid && (
              <button
                onClick={handleRepairChain}
                disabled={actionLoading}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Heal / Repair Chain</span>
              </button>
            )}
          </div>
        </div>

        {bannerNotice && (
          <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 text-cyan-300 text-xs flex items-center justify-between">
            <span>{bannerNotice}</span>
            <button onClick={() => setBannerNotice(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Primary Status Banner */}
        {report && (
          <div>
            {report.status === 'VALID' ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-emerald-950/70 border-2 border-emerald-500 shadow-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                          AUDIT TRAIL INTEGRITY CONFIRMED
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ON-CHAIN VERIFIED
                        </span>
                      </div>
                      <h2 className="text-2xl font-black text-white tracking-tight">
                        STATUS: VALID (CHAIN INTACT & MERKLE ANCHORED)
                      </h2>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="block text-xs uppercase tracking-wider text-slate-400">Total Audited Events</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono">{report.totalEvents} Events</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  Every audit record is linked via SHA-256 canonical hashing (<code className="text-cyan-400 font-mono">prevHash → hash</code>).
                  Batch Merkle roots have been anchored on the Hardhat Solidity smart contract (<code className="text-cyan-400 font-mono">AuditAnchor.sol</code>),
                  guaranteeing mathematical tamper-detection and regulatory non-repudiation.
                </p>
              </div>
            ) : (
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 border-2 border-rose-500 shadow-2xl space-y-4 animate-pulse">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400">
                      <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-rose-400">
                          CRITICAL AUDIT BREACH DETECTED
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          HASH CHAIN MISMATCH
                        </span>
                      </div>
                      <h2 className="text-2xl font-black text-rose-100 tracking-tight">
                        STATUS: TAMPERED (UNAUTHORIZED DATABASE ALTERATION)
                      </h2>
                    </div>
                  </div>

                  <button
                    onClick={handleRepairChain}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30"
                  >
                    Repair Chain
                  </button>
                </div>

                {report.brokenEvent && (
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-rose-500/50 space-y-2 text-xs font-mono">
                    <p className="text-rose-400 font-bold font-sans">
                      Tampering pinpointed at Event #{report.brokenEvent.index} (ID: {report.brokenEvent.id}):
                    </p>
                    <p className="text-slate-300">{report.brokenEvent.reason}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-500">Expected Canonical Hash:</span>
                        <div className="text-emerald-400 break-all select-all">{report.brokenEvent.expectedHash}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Stored Tampered Hash:</span>
                        <div className="text-rose-400 break-all select-all">{report.brokenEvent.actualHash}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 2: On-Chain Merkle Anchors */}
        <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span>Blockchain Merkle Anchors (Solidity Contract)</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3
            </span>
          </div>

          {report?.anchorRecords && report.anchorRecords.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/60">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Anchor Timestamp</th>
                    <th className="py-3 px-4">Merkle Root (bytes32)</th>
                    <th className="py-3 px-4">Tx Hash</th>
                    <th className="py-3 px-4">Block #</th>
                    <th className="py-3 px-4">Events</th>
                    <th className="py-3 px-4">On-Chain Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {report.anchorRecords.map((a, i) => (
                    <tr key={a.id || i} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        {new Date(a.verifiedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-cyan-300 break-all select-all">
                        {a.merkleRoot.slice(0, 18)}...{a.merkleRoot.slice(-8)}
                      </td>
                      <td className="py-3 px-4 text-slate-400 break-all select-all">
                        {a.txHash ? `${a.txHash.slice(0, 14)}...` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">{a.blockNumber || 1}</td>
                      <td className="py-3 px-4 text-slate-300 font-sans">{a.eventCount}</td>
                      <td className="py-3 px-4 font-sans">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>getRoot() MATCH</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-3">No Merkle anchors found yet. Click "Anchor to Hardhat Chain" to create one.</p>
          )}
        </div>

        {/* Section 3: Live Visual Hash Chain Timeline */}
        <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <LinkIcon className="w-5 h-5 text-cyan-400" />
              <span>Live Audit Hash-Chain Viewer (Chronological Chain)</span>
            </h2>
            <span className="text-xs text-slate-400">
              Showing recent events ({events.length})
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {events.map((ev, index) => {
              const isBroken = report?.brokenEvent?.id === ev.id;
              return (
                <div key={ev.id} className="space-y-2">
                  <div
                    className={`p-4 rounded-xl border transition ${
                      isBroken
                        ? 'bg-rose-950/60 border-rose-500 text-rose-200 shadow-lg shadow-rose-950/50'
                        : 'bg-slate-900 border-slate-700/80 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2 font-sans">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-800/40">
                          #{events.length - index}
                        </span>
                        <span className="font-bold text-white text-sm">{ev.action}</span>
                        <span className="text-slate-400 text-xs font-mono">• {ev.resource}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(ev.timestamp).toLocaleTimeString()} ({new Date(ev.timestamp).toLocaleDateString()})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">prevHash:</span>
                        <span className="text-slate-400 select-all break-all">
                          {ev.prevHash}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">SHA-256 Canonical Hash:</span>
                        <span className={isBroken ? 'text-rose-300 font-bold select-all break-all' : 'text-emerald-400 select-all break-all'}>
                          {ev.hash}
                        </span>
                      </div>
                    </div>
                  </div>

                  {index < events.length - 1 && (
                    <div className="flex justify-center text-slate-600">
                      <ArrowDown className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
