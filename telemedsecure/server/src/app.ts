import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/errorHandler';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import consultationRoutes from './routes/consultation.routes';
import prescriptionRoutes from './routes/prescription.routes';
import medicalRecordRoutes from './routes/medicalRecord.routes';
import vitalSignsRoutes from './routes/vitalSigns.routes';
import integrityRoutes from './routes/integrity.routes';
import complianceRoutes from './routes/compliance.routes';
import gdprRoutes from './routes/gdpr.routes';
import investigationRoutes from './routes/investigation.routes';

const app = express();

// Security Middlewares: Content Security Policy & Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'http://localhost:4000', 'ws://localhost:4000', 'http://127.0.0.1:8545'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-simulate-off-hours'],
}));

// Safe JSON body parser with size cap
app.use(express.json({ limit: '10mb' }));

// Rate Limiting (Brute-force and DoS protection)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', limiter);

// Root Welcome & Status Portal
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TeleMedSecure • Backend API & Signaling Server</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: radial-gradient(circle at top, #0f172a 0%, #020617 100%);
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 40px;
      max-width: 640px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .pulse {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }
    .box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 14px;
      border-radius: 12px;
      font-size: 13px;
    }
    .box-title { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .box-val { color: #e2e8f0; font-weight: 500; font-family: monospace; }
    .btn-group { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      color: white;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span class="pulse"></span>
      Backend & Signaling Server Operational
    </div>
    <h1>TeleMedSecure API</h1>
    <p>
      End-to-end encrypted telemedicine core server. Providing zero-knowledge WebRTC signaling, 
      AES-256-GCM envelope encryption, Ed25519 digital signatures, and Merkle hash-chain audit anchoring.
    </p>

    <div class="grid">
      <div class="box">
        <div class="box-title">Server Protocol</div>
        <div class="box-val">HTTPS & WSS (Socket.IO)</div>
      </div>
      <div class="box">
        <div class="box-title">Database</div>
        <div class="box-val">PostgreSQL (Render Cloud)</div>
      </div>
      <div class="box">
        <div class="box-title">Health Check</div>
        <div class="box-val">/health (200 OK)</div>
      </div>
      <div class="box">
        <div class="box-title">Security Policies</div>
        <div class="box-val">CSP & TLS 1.3 Active</div>
      </div>
    </div>

    <div class="btn-group">
      <a href="/health" class="btn btn-primary">Check /health Endpoint</a>
      <a href="https://github.com/richard254120/Telemedicsecure" target="_blank" class="btn btn-secondary">GitHub Repository</a>
    </div>
  </div>
</body>
</html>
    `);
  }

  res.status(200).json({
    name: 'TeleMedSecure API & WebRTC Signaling Server',
    status: 'ONLINE',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      consultations: '/api/v1/consultations',
      prescriptions: '/api/v1/prescriptions',
      compliance: '/api/v1/compliance',
      integrity: '/api/v1/integrity',
      investigation: '/api/v1/investigation'
    }
  });
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    csp: 'enforced',
    tls: req.secure ? 'TLS 1.3' : 'localhost-dev'
  });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);
app.use('/api/v1/medical-records', medicalRecordRoutes);
app.use('/api/v1/vitals', vitalSignsRoutes);
app.use('/api/v1/vital-signs', vitalSignsRoutes);
app.use('/api/v1/integrity', integrityRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/gdpr', gdprRoutes);
app.use('/api/v1/investigation', investigationRoutes);

// Fallback for unmatched routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found', path: req.path });
  }
  if (req.accepts('html')) {
    return res.redirect('/');
  }
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Global Error Handler
app.use(errorHandler);

export default app;
