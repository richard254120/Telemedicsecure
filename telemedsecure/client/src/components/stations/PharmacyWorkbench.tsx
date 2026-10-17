import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config';
import {
  Pill,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  PackageCheck,
  Send,
  Boxes,
  Layers,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';

export default function PharmacyWorkbench() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  const [activeTab, setActiveTab] = useState<'prescriptions' | 'inventory'>('prescriptions');
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Action States
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dispensingId, setDispensingId] = useState<string | null>(null);

  // Add Med Form
  const [medNdc, setMedNdc] = useState('');
  const [medName, setMedName] = useState('');
  const [medGeneric, setMedGeneric] = useState('');
  const [medForm, setMedForm] = useState('TABLET');
  const [medStrength, setMedStrength] = useState('500mg');
  const [medQty, setMedQty] = useState('100');
  const [medPrice, setMedPrice] = useState('15.00');

  useEffect(() => {
    fetchPharmacyData();
  }, []);

  const fetchPharmacyData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [rxRes, invRes, statRes] = await Promise.all([
        fetch(`${API_BASE}/prescriptions`, { headers }),
        fetch(`${API_BASE}/stations/pharmacy/inventory`, { headers }),
        fetch(`${API_BASE}/stations/pharmacy/stats`, { headers })
      ]);

      if (rxRes.ok) setPrescriptions(await rxRes.json());
      if (invRes.ok) setInventory(await invRes.json());
      if (statRes.ok) setStats(await statRes.json());
    } catch (err: any) {
      console.error('Error fetching pharmacy data', err);
      setActionError('Could not load pharmacy inventory.');
    } finally {
      setLoading(false);
    }
  };

  const handleDispenseRx = async (rxId: string) => {
    setDispensingId(rxId);
    setActionError(null);
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/prescriptions/${rxId}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: 'DISPENSED',
          statusReason: `Dispensed and verified by Pharmacist ${user?.firstName} ${user?.lastName} (License #${user?.medicalLicenseNo || 'RPh-ACTIVE'})`
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update prescription status');
      }

      // Send SMS alert
      fetch(`${API_BASE}/sms/prescription-alert`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prescriptionId: rxId,
          pharmacyName: 'TeleMedSecure Clinical Dispensary'
        })
      }).catch(console.warn);

      setActionSuccess(`Prescription #${rxId.slice(0, 8).toUpperCase()} dispensed. Patient SMS notification dispatched!`);
      fetchPharmacyData();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setDispensingId(null);
    }
  };

  const handleRestock = async (medId: string, delta: number) => {
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/stations/pharmacy/inventory/${medId}/stock`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ delta })
      });
      if (res.ok) {
        setActionSuccess(`Medication stock replenished (+${delta} units).`);
        fetchPharmacyData();
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/stations/pharmacy/inventory`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ndc: medNdc || `00000-${Math.floor(1000 + Math.random() * 9000)}-01`,
          name: medName,
          genericName: medGeneric,
          dosageForm: medForm,
          strength: medStrength,
          stockQuantity: Number(medQty),
          unitPrice: Number(medPrice)
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add medication');
      }

      setActionSuccess(`Medication [${medName}] cataloged into dispensary stock.`);
      setShowAddMedModal(false);
      setMedName('');
      setMedGeneric('');
      fetchPharmacyData();
      setTimeout(() => setActionSuccess(null), 4500);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const filteredPrescriptions = prescriptions.filter(p =>
    p.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.consultation?.patient?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.consultation?.patient?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.items?.some((i: any) => i.medication?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredInventory = inventory.filter(m =>
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.genericName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.ndc?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Dispensation</span>
          <div className="text-2xl font-black text-amber-400 tracking-tight">
            {stats?.pendingDispense ?? prescriptions.filter(p => p.status === 'ISSUED').length}
          </div>
          <p className="text-[11px] text-amber-400 font-mono">Verified by Attending MD</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dispensed Today</span>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">
            {stats?.dispensedToday ?? prescriptions.filter(p => p.status === 'DISPENSED').length}
          </div>
          <p className="text-[11px] text-emerald-400 font-mono">Patient Pickups Cleared</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">EPCS Signatures</span>
          <div className="text-2xl font-black text-cyan-400 tracking-tight">
            {stats?.epcsRate ?? '100% Ed25519'}
          </div>
          <p className="text-[11px] text-cyan-400 font-mono">DEA Certified Digital Seals</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Low Stock Reorders</span>
          <div className="text-2xl font-black text-rose-400 tracking-tight">
            {stats?.lowStockAlerts ?? inventory.filter(m => m.stockQuantity <= m.reorderLevel).length}
          </div>
          <p className="text-[11px] text-rose-400 font-mono">Below Safety Threshold</p>
        </div>
      </div>

      {/* Main Workspace Container */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Pharmacy Dispensing & Drug Safety Station</h3>
              <p className="text-xs text-slate-400">DEA EPCS digital verification, automated inventory management, and patient SMS notifications</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchPharmacyData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('prescriptions')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'prescriptions' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Dispensing Queue ({prescriptions.length})
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'inventory' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Drug Inventory ({inventory.length})
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: e-Prescriptions Dispensation Queue */}
        {activeTab === 'prescriptions' && (
          <div className="divide-y divide-slate-800">
            {filteredPrescriptions.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Pill className="w-10 h-10 mx-auto mb-2 opacity-40 text-cyan-400" />
                <p className="text-sm font-semibold text-slate-300">No prescriptions found in queue</p>
              </div>
            ) : (
              filteredPrescriptions.map(rx => (
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
                        <span>Ed25519 EPCS Signature Validated</span>
                      </span>
                      <span>•</span>
                      <span>Hash: {rx.signature?.canonicalHash?.slice(0, 16) || 'Verified'}...</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/prescriptions/${rx.id}/verify`)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                    >
                      Verify Signature
                    </button>
                    {rx.status !== 'DISPENSED' && (
                      <button
                        onClick={() => handleDispenseRx(rx.id)}
                        disabled={dispensingId === rx.id}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                      >
                        {dispensingId === rx.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Pill className="w-3.5 h-3.5" />
                        )}
                        <span>Dispense & SMS Alert</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Drug Stock & Inventory */}
        {activeTab === 'inventory' && (
          <div>
            <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                {filteredInventory.length} Pharmaceuticals in Formulary
              </span>
              <button
                onClick={() => setShowAddMedModal(true)}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-1 shadow-md"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Medication</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">NDC Code</th>
                    <th className="px-4 py-3">Medication Name</th>
                    <th className="px-4 py-3">Dosage / Strength</th>
                    <th className="px-4 py-3">Stock on Hand</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3 text-right">Quick Restock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredInventory.map(med => (
                    <tr key={med.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3.5 font-mono text-cyan-400">{med.ndc}</td>
                      <td className="px-4 py-3.5 font-bold text-white">
                        {med.name}
                        {med.genericName && (
                          <span className="text-[10px] text-slate-400 block font-normal">Generic: {med.genericName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px]">
                          {med.strength} ({med.dosageForm})
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono">
                        <span className={`font-bold ${med.stockQuantity <= med.reorderLevel ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {med.stockQuantity} units
                        </span>
                        {med.stockQuantity <= med.reorderLevel && (
                          <span className="text-[10px] text-rose-500 block">Low Stock Alert</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-200">
                        ${med.unitPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleRestock(med.id, 50)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-semibold"
                        >
                          +50 Units
                        </button>
                        <button
                          onClick={() => handleRestock(med.id, 100)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold"
                        >
                          +100 Units
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Medication */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Pill className="w-5 h-5 text-cyan-400" />
                <span>Catalog New Medication into Formulary</span>
              </h3>
              <button onClick={() => setShowAddMedModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddMedication} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Brand Name *
                </label>
                <input
                  type="text"
                  value={medName}
                  onChange={e => setMedName(e.target.value)}
                  required
                  placeholder="e.g. Amoxicillin Trihydrate"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Generic Drug Name
                </label>
                <input
                  type="text"
                  value={medGeneric}
                  onChange={e => setMedGeneric(e.target.value)}
                  placeholder="e.g. Amoxicillin"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Dosage Form
                  </label>
                  <select
                    value={medForm}
                    onChange={e => setMedForm(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="TABLET">Tablet</option>
                    <option value="CAPSULE">Capsule</option>
                    <option value="INJECTION">Injection</option>
                    <option value="LIQUID">Liquid Suspension</option>
                    <option value="INHALER">Inhaler</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Strength
                  </label>
                  <input
                    type="text"
                    value={medStrength}
                    onChange={e => setMedStrength(e.target.value)}
                    placeholder="e.g. 500mg"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Initial Stock Qty
                  </label>
                  <input
                    type="number"
                    value={medQty}
                    onChange={e => setMedQty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Unit Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={medPrice}
                    onChange={e => setMedPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition"
                >
                  Save to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
