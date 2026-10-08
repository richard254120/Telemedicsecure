import Link from 'next/link';
import './globals.css';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '4rem', maxWidth: '800px', textAlign: 'center' }}>
        <h1 className="title-glow" style={{ fontSize: '3rem', marginBottom: '1rem', background: 'linear-gradient(to right, #e0e1dd, #778da9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          TeleMedSecure
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
          A Telemedicine Platform with Encrypted Consultations and Forensic Compliance Monitoring. 
          Built for modern healthcare compliance (HIPAA, GDPR) with end-to-end encrypted video, secure prescription management, and incident investigation tools.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="button">
            Forensic Dashboard
          </Link>
          <Link href="/consultation" className="button" style={{ background: 'transparent', border: '1px solid var(--accent-color)' }}>
            Join Consultation
          </Link>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginTop: '4rem', maxWidth: '1000px', width: '100%' }}>
        {[
          { title: 'E2E Encryption', desc: 'Secure video/chat and digital signatures for prescriptions.' },
          { title: 'Compliance Audit', desc: 'Immutable consultation logging and prescription audit trails.' },
          { title: 'Incident Reconstruction', desc: 'Forensic reporting and compliance violation detection.' }
        ].map((feat, i) => (
          <div key={i} className="glass-panel" style={{ padding: '2rem', animationDelay: `${i * 0.2}s` }}>
            <h3 style={{ color: 'var(--highlight-color)', marginBottom: '0.5rem' }}>{feat.title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{feat.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
