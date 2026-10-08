import { Router, Request, Response } from 'express';
import { PrismaClient, Role, Severity } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole } from '../middlewares/auth';
import { investigationService } from '../services/investigation.service';

const router = Router();
const prisma = new PrismaClient();

// Multer memory storage for PDF upload verification
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// All investigation endpoints require ADMIN role
router.use(requireAuth);

/**
 * POST /api/v1/investigation/incidents
 * Open a new Incident from a SecurityAlert or manually
 */
router.post('/incidents', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const { alertId, title, description, severity, targetUserId, targetPatientId } = req.body;
  const user = (req as any).user;

  try {
    const incident = await investigationService.createIncident({
      alertId,
      title: title || 'Security Incident Investigation',
      description: description || 'Investigative case initiated from security alert',
      severity: severity || Severity.HIGH,
      openedBy: user.email || user.id,
      targetUserId,
      targetPatientId,
    });

    res.status(201).json(incident);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/investigation/incidents
 * List all incidents
 */
router.get('/incidents', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const incidents = await prisma.incident.findMany({
    include: {
      timeline: { take: 20, orderBy: { timestamp: 'asc' } },
      evidence: true,
      reports: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(incidents);
});

/**
 * GET /api/v1/investigation/incidents/:id
 * Get full incident details
 */
router.get('/incidents/:id', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      timeline: { orderBy: { timestamp: 'asc' } },
      evidence: { orderBy: { createdAt: 'desc' } },
      reports: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  res.json(incident);
});

/**
 * POST /api/v1/investigation/incidents/:id/reconstruct
 * Reconstruct incident timeline from audit events matching filters
 */
router.post('/incidents/:id/reconstruct', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { userId, patientId, resource, action, startTime, endTime } = req.body;

  try {
    const timeline = await investigationService.reconstructTimeline(id, {
      userId,
      patientId,
      resource,
      action,
      startTime,
      endTime,
    });

    res.json({
      message: `Timeline reconstructed: ${timeline.length} audit events captured.`,
      incidentId: id,
      eventCount: timeline.length,
      timeline,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/investigation/incidents/:id/evidence
 * Attach an evidence finding
 */
router.post('/incidents/:id/evidence', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { description, evidenceType, hashValue, metadata } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Evidence description is required' });
  }

  try {
    const finding = await investigationService.attachEvidenceFinding({
      incidentId: id,
      description,
      evidenceType,
      hashValue,
      metadata,
    });

    res.status(201).json(finding);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/investigation/incidents/:id/report
 * Generate Forensic Report (PDF), anchors SHA-256 on blockchain, records report
 */
router.post('/incidents/:id/report', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { investigator, summaryNotes } = req.body;
  const user = (req as any).user;

  try {
    const result = await investigationService.generateForensicReport({
      incidentId: id,
      investigator: investigator || user.email || 'Lead Investigator',
      summaryNotes,
    });

    res.status(201).json({
      message: 'Forensic Report generated and anchored onto blockchain successfully.',
      report: result.report,
      reportHash: result.reportHash,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      chainVerification: result.chainVerification,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/investigation/reports/:id/download
 * Download the generated PDF report
 */
router.get('/reports/:id/download', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const report = await prisma.forensicReport.findUnique({ where: { id } });
  if (!report || !report.pdfPath) {
    return res.status(404).json({ error: 'Report PDF not found' });
  }

  const fullPath = path.resolve(__dirname, `../../${report.pdfPath}`);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'PDF file not found on disk' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="forensic-report-${id}.pdf"`);
  fs.createReadStream(fullPath).pipe(res);
});

/**
 * POST /api/v1/investigation/reports/verify
 * Upload PDF or raw bytes to recompute SHA-256 hash and verify on blockchain
 */
router.post(
  '/reports/verify',
  upload.single('reportPdf'),
  async (req: Request, res: Response) => {
    let pdfBuffer: Buffer | null = null;

    if (req.file) {
      pdfBuffer = req.file.buffer;
    } else if (req.body.pdfBase64) {
      pdfBuffer = Buffer.from(req.body.pdfBase64, 'base64');
    }

    if (!pdfBuffer) {
      return res.status(400).json({
        error: 'Please upload a PDF file via multipart form (reportPdf) or pass pdfBase64.',
      });
    }

    try {
      const verification = await investigationService.verifyReportPdf(pdfBuffer);
      res.json(verification);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
