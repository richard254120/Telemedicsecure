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

// Global Error Handler
app.use(errorHandler);

export default app;
