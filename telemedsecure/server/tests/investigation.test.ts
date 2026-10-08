import { PrismaClient, Role, Severity } from '@prisma/client';
import request from 'supertest';
import app from '../src/app';
import jwt from 'jsonwebtoken';
import { investigationService } from '../src/services/investigation.service';
import { createChainedAuditEvent } from '../src/services/audit.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

describe('Step 10: Incident Investigation, Forensic Report (PDF) & On-Chain Verification', () => {
  let adminUser: any;
  let adminToken: string;
  let testPatientId: string;
  let testDoctorId: string;

  beforeAll(async () => {
    const ts = Date.now();
    adminUser = await prisma.user.create({
      data: {
        email: `investigator-admin-${ts}@telemed.local`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashadmin',
        role: Role.ADMIN,
        firstName: 'Sarah',
        lastName: 'Forensics',
      },
    });

    const secret = process.env.JWT_SECRET || 'secret';
    adminToken = jwt.sign({ id: adminUser.id }, secret, { expiresIn: '1h' });

    testPatientId = `patient-target-${ts}`;

    const doctorUser = await prisma.user.create({
      data: {
        email: `suspect-doctor-${ts}@telemed.local`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashdoc',
        role: Role.DOCTOR,
        firstName: 'Suspect',
        lastName: 'Doctor',
      },
    });
    testDoctorId = doctorUser.id;

    // Seed some audit events for timeline reconstruction
    await createChainedAuditEvent({
      action: 'LOGIN_FAILURE',
      resource: 'UserAuth',
      userId: testDoctorId,
      ipAddress: '198.51.100.24',
    });

    await createChainedAuditEvent({
      action: 'UNAUTHORIZED_RECORD_ACCESS',
      resource: `MedicalRecord:Patient:${testPatientId}`,
      userId: testDoctorId,
      ipAddress: '198.51.100.24',
    });

    await createChainedAuditEvent({
      action: 'DATA_EXPORT_ATTEMPT',
      resource: `Patient:${testPatientId}`,
      userId: testDoctorId,
      ipAddress: '198.51.100.24',
    });
  });

  afterAll(async () => {
    try {
      await prisma.forensicReport.deleteMany({
        where: { incident: { openedBy: adminUser.email } },
      });
      await prisma.evidenceFinding.deleteMany({
        where: { incident: { openedBy: adminUser.email } },
      });
      await prisma.incidentTimeline.deleteMany({
        where: { incident: { openedBy: adminUser.email } },
      });
      await prisma.incident.deleteMany({
        where: { openedBy: adminUser.email },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [adminUser.id, testDoctorId] } },
      });
    } catch (e) {
      console.warn('Teardown warning:', e);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. Incident Lifecycle & Timeline Reconstruction', () => {
    let incident: any;

    it('opens an incident with case metadata', async () => {
      incident = await investigationService.createIncident({
        title: 'Suspected EPHI Data Exfiltration',
        description: 'Anomalous record queries observed from external IP address',
        severity: Severity.HIGH,
        openedBy: adminUser.email,
        targetUserId: testDoctorId,
        targetPatientId: testPatientId,
      });

      expect(incident.id).toBeDefined();
      expect(incident.title).toBe('Suspected EPHI Data Exfiltration');
      expect(incident.status).toBe('OPEN');
    });

    it('reconstructs an incident timeline from matching audit events', async () => {
      const timeline = await investigationService.reconstructTimeline(incident.id, {
        userId: testDoctorId,
        patientId: testPatientId,
      });

      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBeGreaterThanOrEqual(2);
      expect(timeline[0].auditEventId).toBeDefined();
      expect(timeline[0].hash).toBeDefined();

      const updatedInc = await prisma.incident.findUnique({ where: { id: incident.id } });
      expect(updatedInc?.status).toBe('INVESTIGATING');
    });

    it('attaches evidence findings with SHA-256 digest', async () => {
      const finding1 = await investigationService.attachEvidenceFinding({
        incidentId: incident.id,
        description: 'Network perimeter firewall egress connection to unknown VPN endpoint',
        evidenceType: 'NETWORK_LOG',
      });

      expect(finding1.id).toBeDefined();
      expect(finding1.hashValue).toHaveLength(64);

      const finding2 = await investigationService.attachEvidenceFinding({
        incidentId: incident.id,
        description: 'Extracted database query log demonstrating unauthorized SELECT on patient table',
        evidenceType: 'DATABASE_EXTRACT',
      });

      expect(finding2.id).toBeDefined();
      expect(finding2.evidenceType).toBe('DATABASE_EXTRACT');
    });
  });

  describe('2. Forensic Report PDF Generation & On-Chain Anchoring', () => {
    let testIncident: any;
    let generatedReport: any;
    let originalPdfBuffer: Buffer;

    beforeAll(async () => {
      testIncident = await investigationService.createIncident({
        title: 'Unauthorized Record Modification Investigation',
        description: 'Audit hash-chain corroboration for patient data integrity violation',
        severity: Severity.CRITICAL,
        openedBy: adminUser.email,
        targetUserId: testDoctorId,
        targetPatientId: testPatientId,
      });

      await investigationService.reconstructTimeline(testIncident.id, {
        userId: testDoctorId,
      });

      await investigationService.attachEvidenceFinding({
        incidentId: testIncident.id,
        description: 'Tampered database row dosage field mismatch',
        evidenceType: 'CRYPTO_HASH_DIFF',
      });
    });

    it('generates a PDF report, anchors its SHA-256 hash on Hardhat chain, and stores metadata', async () => {
      const res = await investigationService.generateForensicReport({
        incidentId: testIncident.id,
        investigator: 'Inspector Sarah Forensics',
        summaryNotes: 'Complete forensic reconstruction proves intentional unauthorized record alteration.',
      });

      expect(res.report).toBeDefined();
      expect(res.reportHash).toBeDefined();
      expect(res.reportHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(res.txHash).toBeDefined();
      expect(res.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(res.blockNumber).toBeGreaterThan(0);
      expect(res.pdfBuffer).toBeDefined();
      expect(res.pdfBuffer.length).toBeGreaterThan(1000);

      // Verify PDF header magic bytes %PDF
      expect(res.pdfBuffer.slice(0, 4).toString()).toBe('%PDF');

      generatedReport = res.report;
      originalPdfBuffer = res.pdfBuffer;
    });

    it('verifies the authentic generated PDF report against the on-chain anchor (AUTHENTIC_VERIFIED)', async () => {
      const verification = await investigationService.verifyReportPdf(originalPdfBuffer);

      expect(verification.isValid).toBe(true);
      expect(verification.status).toBe('AUTHENTIC_VERIFIED');
      expect(verification.onChainAnchored).toBe(true);
      expect(verification.computedHash).toBe(generatedReport.reportHash);
      expect(verification.txHash).toBe(generatedReport.txHash);
      expect(verification.reportDetails?.id).toBe(generatedReport.id);
    });

    it('detects tampering when the PDF content is modified by even 1 byte (TAMPERED_OR_UNANCHORED)', async () => {
      // Modify 1 byte in the PDF buffer
      const tamperedBuffer = Buffer.from(originalPdfBuffer);
      tamperedBuffer[tamperedBuffer.length - 20] ^= 0xff; // Flip bits

      const verification = await investigationService.verifyReportPdf(tamperedBuffer);

      expect(verification.isValid).toBe(false);
      expect(verification.status).toBe('TAMPERED_OR_UNANCHORED');
      expect(verification.onChainAnchored).toBe(false);
      expect(verification.computedHash).not.toBe(generatedReport.reportHash);
      expect(verification.reason).toContain('does not match any anchored forensic report');
    });
  });

  describe('3. Investigation REST API Endpoints', () => {
    let incidentId: string;
    let generatedReportId: string;
    let reportPdfBuffer: Buffer;

    it('POST /api/v1/investigation/incidents opens a new incident', async () => {
      const res = await request(app)
        .post('/api/v1/investigation/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'API Test Incident',
          description: 'Triggered from compliance rule violation',
          severity: Severity.HIGH,
          targetUserId: testDoctorId,
          targetPatientId: testPatientId,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      incidentId = res.body.id;
    });

    it('POST /api/v1/investigation/incidents/:id/reconstruct builds timeline', async () => {
      const res = await request(app)
        .post(`/api/v1/investigation/incidents/${incidentId}/reconstruct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: testDoctorId });

      expect(res.status).toBe(200);
      expect(res.body.eventCount).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/investigation/incidents/:id/evidence attaches finding', async () => {
      const res = await request(app)
        .post(`/api/v1/investigation/incidents/${incidentId}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Memory dump containing key artifact',
          evidenceType: 'RAM_EXTRACT',
        });

      expect(res.status).toBe(201);
      expect(res.body.hashValue).toBeDefined();
    });

    it('POST /api/v1/investigation/incidents/:id/report generates PDF and anchors on-chain', async () => {
      const res = await request(app)
        .post(`/api/v1/investigation/incidents/${incidentId}/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          investigator: 'Agent Sarah',
          summaryNotes: 'Investigation completed. Report anchored on blockchain.',
        });

      expect(res.status).toBe(201);
      expect(res.body.report.id).toBeDefined();
      expect(res.body.reportHash).toBeDefined();
      expect(res.body.txHash).toBeDefined();
      expect(res.body.blockNumber).toBeGreaterThan(0);

      generatedReportId = res.body.report.id;
    });

    it('GET /api/v1/investigation/reports/:id/download downloads valid PDF', async () => {
      const res = await request(app)
        .get(`/api/v1/investigation/reports/${generatedReportId}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer()
        .parse((res, callback) => {
          res.setEncoding('binary');
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => callback(null, Buffer.from(data, 'binary')));
        });

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/pdf');
      reportPdfBuffer = res.body;
      expect(reportPdfBuffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('POST /api/v1/investigation/reports/verify verifies authentic uploaded PDF via multipart/form-data', async () => {
      const res = await request(app)
        .post('/api/v1/investigation/reports/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('reportPdf', reportPdfBuffer, 'authentic-report.pdf');

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.status).toBe('AUTHENTIC_VERIFIED');
      expect(res.body.onChainAnchored).toBe(true);
      expect(res.body.txHash).toBeDefined();
    });

    it('POST /api/v1/investigation/reports/verify rejects tampered uploaded PDF', async () => {
      const tampered = Buffer.from(reportPdfBuffer);
      tampered[50] = tampered[50] ^ 0x01; // Tamper single byte

      const res = await request(app)
        .post('/api/v1/investigation/reports/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('reportPdf', tampered, 'tampered-report.pdf');

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
      expect(res.body.status).toBe('TAMPERED_OR_UNANCHORED');
      expect(res.body.onChainAnchored).toBe(false);
    });
  });
});
