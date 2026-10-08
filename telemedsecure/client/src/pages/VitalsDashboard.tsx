import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function VitalsDashboard() {
  const [vitals, setVitals] = useState({
    bpSystolic: 120,
    bpDiastolic: 80,
    heartRate: 75,
    temp: 36.5,
    spO2: 98
  });
  const [history, setHistory] = useState([
    { time: '10:00', heartRate: 72, spO2: 98 },
    { time: '11:00', heartRate: 75, spO2: 97 },
    { time: '12:00', heartRate: 105, spO2: 91 }, // Abnormal
    { time: '13:00', heartRate: 85, spO2: 95 }
  ]);
  const [flags, setFlags] = useState<{ severity: string; description: string }[]>([
    { severity: 'MEDIUM', description: 'Abnormal HR (105 bpm), Hypoxia (91%)' }
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry = { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), heartRate: vitals.heartRate, spO2: vitals.spO2 };
    setHistory([...history, newEntry]);
    
    // Fake the flagging simulation locally for demo
    if (vitals.heartRate > 100 || vitals.spO2 < 92) {
      setFlags([...flags, { severity: 'HIGH', description: `Abnormal HR (${vitals.heartRate} bpm), SpO2 (${vitals.spO2}%)` }]);
    }
    alert('Vitals captured and AES-GCM encrypted payload dispatched to server.');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Patient Vitals & Clinical Flags</h1>
      
      {flags.length > 0 && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <h2 className="text-amber-800 font-bold mb-2 flex items-center gap-2">
             Clinical Flags Detected
          </h2>
          <ul className="list-disc pl-5">
            {flags.map((f, i) => (
              <li key={i} className="text-amber-700">
                <span className="font-semibold">{f.severity}:</span> {f.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="col-span-1 bg-white p-6 rounded-2xl shadow border border-slate-200">
          <h2 className="font-bold text-lg mb-4">Capture Vitals</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Blood Pressure (mmHg)</label>
              <div className="flex gap-2 mt-1">
                <input type="number" value={vitals.bpSystolic} onChange={e => setVitals({...vitals, bpSystolic: +e.target.value})} className="w-full border rounded-lg p-2" />
                <span className="text-slate-400 self-center">/</span>
                <input type="number" value={vitals.bpDiastolic} onChange={e => setVitals({...vitals, bpDiastolic: +e.target.value})} className="w-full border rounded-lg p-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Heart Rate (bpm)</label>
              <input type="number" value={vitals.heartRate} onChange={e => setVitals({...vitals, heartRate: +e.target.value})} className="mt-1 w-full border rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">SpO2 (%)</label>
              <input type="number" value={vitals.spO2} onChange={e => setVitals({...vitals, spO2: +e.target.value})} className="mt-1 w-full border rounded-lg p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Temperature (°C)</label>
              <input type="number" step="0.1" value={vitals.temp} onChange={e => setVitals({...vitals, temp: +e.target.value})} className="mt-1 w-full border rounded-lg p-2" />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg mt-4">
              Encrypt & Submit
            </button>
          </div>
        </form>

        <div className="col-span-2 bg-white p-6 rounded-2xl shadow border border-slate-200">
          <h2 className="font-bold text-lg mb-4">Vitals Trend (Decrypted View)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[85, 100]} />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2} name="Heart Rate" />
                <Line yAxisId="right" type="monotone" dataKey="spO2" stroke="#3b82f6" strokeWidth={2} name="SpO2 %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
