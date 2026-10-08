import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  PlusCircle,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Search,
  Pill
} from 'lucide-react';
import { listPrescriptions, PrescriptionData } from '../utils/api';

export default function PrescriptionList() {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ISSUED' | 'DISPENSED' | 'REVOKED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    listPrescriptions()
      .then(data => setPrescriptions(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = prescriptions.filter(p => {
    const matchesStatus = filter === 'ALL' || p.status === filter;
    const matchesSearch =
      searchTerm === '' ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.doctor?.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.items.some(i => i.medication.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ISSUED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3" />
            <span>ISSUED</span>
          </span>
        );
      case 'DISPENSED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>DISPENSED</span>
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            <span>REVOKED</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center space-x-3">
              <FileText className="w-8 h-8 text-cyan-400" />
              <span>Digital Prescriptions</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Cryptographically signed with Doctor Ed25519 keys & verifiable by pharmacies
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/prescriptions/verify"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition flex items-center space-x-2 border border-slate-700"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verify Prescription</span>
            </Link>

            <Link
              to="/prescriptions/new"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold transition shadow-lg shadow-cyan-500/25 flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Issue Prescription</span>
            </Link>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            {(['ALL', 'ISSUED', 'DISPENSED', 'REVOKED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                  filter === s
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Search by ID, med, doctor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Prescription List Cards */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-800/40 border border-slate-700/60 text-center space-y-4">
            <FileText className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Prescriptions Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No prescriptions match the selected filter. Click below to issue the first prescription.
            </p>
            <Link
              to="/prescriptions/new"
              className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Issue New Prescription</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(p => (
              <div
                key={p.id}
                className="p-5 sm:p-6 rounded-2xl bg-slate-800/80 border border-slate-700/60 hover:border-slate-600 transition shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(p.status)}
                    <span className="text-xs font-mono text-slate-400">ID: {p.id.slice(0, 16)}...</span>
                    <span className="text-xs text-slate-500">
                      • {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">
                      {p.items.map(i => i.medication).join(', ')}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Prescribed by Dr. {p.doctor?.firstName} {p.doctor?.lastName} for{' '}
                      {p.consultation?.patient
                        ? `${p.consultation.patient.firstName} ${p.consultation.patient.lastName}`
                        : 'Patient'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {p.items.map((i, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-[11px] bg-slate-900 border border-slate-700 text-cyan-300 font-mono"
                      >
                        <Pill className="w-3 h-3 text-cyan-400" />
                        <span>{i.medication} ({i.dosage})</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/prescriptions/${p.id}/verify`)}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify</span>
                  </button>
                  <button
                    onClick={() => navigate(`/prescriptions/${p.id}`)}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-md shadow-cyan-600/20"
                  >
                    <span>View Details</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
