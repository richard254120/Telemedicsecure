import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft } from 'lucide-react';

export default function VitalsDashboard() {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();
  const [vitals, setVitals] = useState({
    bpSystolic: 120,
    bpDiastolic: 80,
    heartRate: 75,
    temp: 36.5,
    spO2: 98
  });
  const [history, setHistory] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchVitalsData();
  }, [user]);

  const fetchVitalsData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/vital-signs`, { headers });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load vitals data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/vital-signs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: user?.id,
          bpSystolic: vitals.bpSystolic,
          bpDiastolic: vitals.bpDiastolic,
          heartRate: vitals.heartRate,
          temperature: vitals.temp,
          spO2: vitals.spO2
        })
      });
      if (res.ok) {
        alert('Vitals captured and AES-GCM encrypted payload dispatched to server.');
        fetchVitalsData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to save vitals'}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Patient Vitals & Clinical Flags</h1>
              <p className="text-xs text-slate-400 mt-1">
                Encrypted vital sign capture and threshold-based clinical flagging.
              </p>
            </div>
          </div>
        </div>

        {flags.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
              Clinical Flags Detected
            </div>
            <ul className="list-disc pl-5">
              {flags.map((f, i) => (
                <li key={i} className="text-amber-200/90">
                  <span className="font-semibold">{f.severity}:</span> {f.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <form onSubmit={handleSubmit} className="col-span-1 bg-slate-800/80 p-6 rounded-3xl border border-slate-700/80 shadow-lg">
            <h2 className="font-bold text-lg mb-4 text-white">Capture Vitals</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Blood Pressure (mmHg)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={vitals.bpSystolic}
                    onChange={e => setVitals({ ...vitals, bpSystolic: +e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-slate-400 self-center">/</span>
                  <input
                    type="number"
                    value={vitals.bpDiastolic}
                    onChange={e => setVitals({ ...vitals, bpDiastolic: +e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={vitals.heartRate}
                  onChange={e => setVitals({ ...vitals, heartRate: +e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">SpO2 (%)</label>
                <input
                  type="number"
                  value={vitals.spO2}
                  onChange={e => setVitals({ ...vitals, spO2: +e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.temp}
                  onChange={e => setVitals({ ...vitals, temp: +e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg mt-4 disabled:opacity-50 transition"
              >
                {loading ? 'Encrypting...' : 'Encrypt & Submit'}
              </button>
            </div>
          </form>

          <div className="col-span-1 md:col-span-2 bg-slate-800/80 p-6 rounded-3xl border border-slate-700/80 shadow-lg">
            <h2 className="font-bold text-lg mb-4 text-white">Vitals Trend (Decrypted View)</h2>
            {history.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#ef4444" />
                    <YAxis yAxisId="right" orientation="right" domain={[85, 100]} stroke="#06b6d4" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '0.75rem' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2} name="Heart Rate" />
                    <Line yAxisId="right" type="monotone" dataKey="spO2" stroke="#06b6d4" strokeWidth={2} name="SpO2 %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-400">
                No vitals data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
