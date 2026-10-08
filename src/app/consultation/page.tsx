'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '../globals.css';

export default function ConsultationRoom() {
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [callStatus, setCallStatus] = useState('Connecting...');

  // Mock the E2E handshake process
  useEffect(() => {
    const timer1 = setTimeout(() => setCallStatus('Establishing Secure Connection...'), 1000);
    const timer2 = setTimeout(() => setCallStatus('Verifying Identity Keys...'), 2500);
    const timer3 = setTimeout(() => {
      setIsEncrypted(true);
      setCallStatus('E2E Encrypted Session Active');
    }, 4000);

    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background-main)' }}>
      {/* Sidebar / Tools */}
      <aside style={{ width: '300px', backgroundColor: 'var(--surface-main)', borderRight: '1px solid var(--surface-border)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="title-glow" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>TeleMedSecure</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              width: '10px', height: '10px', borderRadius: '50%', 
              backgroundColor: isEncrypted ? 'var(--success-color)' : 'var(--warning-color)',
              boxShadow: isEncrypted ? '0 0 10px var(--success-color)' : 'none',
              transition: 'all 0.5s ease'
            }} />
            <span style={{ fontSize: '0.85rem', color: isEncrypted ? 'var(--success-color)' : 'var(--warning-color)' }}>
              {callStatus}
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Session Participants</h3>
          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>DR</div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Dr. Sarah Jenkins</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Host • Cardiologist</p>
            </div>
          </div>
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--success-color)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#4b5563', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>YOU</div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Patient (You)</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Verified Identity</p>
            </div>
          </div>
        </div>

        <div>
          <button className="button" style={{ width: '100%', marginBottom: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <span>📝</span> Issue Prescription
          </button>
          <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', textDecoration: 'underline' }}>
            Exit to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main Video Area */}
      <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ 
          flex: 1, 
          backgroundColor: '#000', 
          borderRadius: '16px', 
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}>
          {/* Mock Video Feed of Doctor */}
          <div style={{ textAlign: 'center', opacity: isEncrypted ? 1 : 0.3, transition: 'opacity 1s ease' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👨‍⚕️</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 500 }}>Dr. Sarah Jenkins</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Video Feed Active</p>
          </div>

          {/* Self View (Picture in Picture) */}
          <div style={{ 
            position: 'absolute', 
            bottom: '2rem', 
            right: '2rem', 
            width: '240px', 
            height: '160px', 
            backgroundColor: '#1f2937', 
            borderRadius: '12px',
            border: '2px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Your Camera</span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '1.5rem', 
          marginTop: '2rem' 
        }}>
          <button style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>🎤</button>
          <button style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>📷</button>
          <button style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--error-color)', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}>📞</button>
        </div>
        
        {/* E2E Security Badge Overlay */}
        <div style={{ 
          position: 'absolute', 
          top: '3rem', 
          left: '3rem', 
          backgroundColor: 'rgba(0,0,0,0.6)', 
          backdropFilter: 'blur(8px)',
          padding: '8px 16px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ fontSize: '1.2rem' }}>{isEncrypted ? '🔒' : '🔓'}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isEncrypted ? 'var(--success-color)' : 'var(--warning-color)' }}>
            {isEncrypted ? 'End-to-End Encrypted' : 'Negotiating Keys...'}
          </span>
        </div>
      </main>
    </div>
  );
}
