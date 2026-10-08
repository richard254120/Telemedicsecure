import { PrismaClient, Severity, IncidentStatus, Incident, ForensicReport, EvidenceFinding, IncidentTimeline } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { anchorRootOnChain, isRootAnchoredOnChain } from './blockchain.service';
import { verifyAuditChainAndMerkle, createChainedAuditEvent } from './audit.service';

const prisma = new PrismaClient();

const STORAGE_DIR = path.resolve(__dirname, '../../storage/reports');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export interface ReconstructTimelineFilters {
  userId?: string;
  patientId?: string;
  resource?: string;
  action?: string;
  startTime?: Date | string;
  endTime?: Date | string;
}

export class InvestigationService {
  private static instance: InvestigationService;

  public static getInstance(): InvestigationService {
    if (!InvestigationService.instance) {
      InvestigationService.instance = new InvestigationService();
    }
    return InvestigationService.instance;
  }

  /**
   * 1. Open an Incident from a SecurityAlert or manually
   */
  public async createIncident(params: {
    alertId?: string;
    title: string;
    description: string;
    severity?: Severity;
    openedBy?: string;
    targetUserId?: string;
    targetPatientId?: string;
  }): Promise<Incident> {
    const { alertId, title, description, severity = Severity.HIGH, openedBy, targetUserId, targetPatientId } = params;

    const incident = await prisma.incident.create({
      data: {
        alertId: alertId || null,
        title,
        description,
        severity,
        status: IncidentStatus.OPEN,
        openedBy: openedBy || 'Security Administrator',
        targetUserId: targetUserId || null,
        targetPatientId: targetPatientId || null,
      },
    });

    await createChainedAuditEvent({
      action: 'INCIDENT_OPENED',
      resource: `Incident:${incident.id}`,
      userId: openedBy || null,
      details: { title, severity, alertId },
    });

    return incident;
  }

  /**
   * 2. Reconstruct an Incident Timeline from audit events
   */
  public async reconstructTimeline(incidentId: string, filters: ReconstructTimelineFilters = {}): Promise<IncidentTimeline[]> {
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    // Build audit query filter
    const where: any = {};
    const targetUser = filters.userId || incident.targetUserId;
    if (targetUser) {
      where.userId = targetUser;
    }

    const targetPatient = filters.patientId || incident.targetPatientId;
    if (targetPatient) {
      where.resource = { contains: targetPatient };
    }

    if (filters.resource) {
      where.resource = { contains: filters.resource };
    }

    if (filters.action) {
      where.action = { contains: filters.action };
    }

    if (filters.startTime || filters.endTime) {
      where.timestamp = {};
      if (filters.startTime) where.timestamp.gte = new Date(filters.startTime);
      if (filters.endTime) where.timestamp.lte = new Date(filters.endTime);
    }

    // Query chronological audit events
    const matchingAuditEvents = await prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: 100,
    });

    // Replace timeline for this incident
    await prisma.incidentTimeline.deleteMany({ where: { incidentId } });

    const timelineItems = await Promise.all(
      matchingAuditEvents.map(async ev => {
        return prisma.incidentTimeline.create({
          data: {
            incidentId,
            auditEventId: ev.id,
            action: ev.action,
            resource: ev.resource,
            userId: ev.userId,
            timestamp: ev.timestamp,
            hash: ev.hash,
            event: `[${ev.action}] on resource ${ev.resource} by user ${ev.userId || 'system'} (IP: ${ev.ipAddress || 'unknown'})`,
          },
        });
      })
    );

    // Update incident status
    await prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.INVESTIGATING },
    });

    await createChainedAuditEvent({
      action: 'INCIDENT_TIMELINE_RECONSTRUCTED',
      resource: `Incident:${incidentId}`,
      details: { eventsCount: timelineItems.length, filters },
    });

    return timelineItems;
  }

  /**
   * 3. Attach an Evidence Finding to an Incident
   */
  public async attachEvidenceFinding(params: {
    incidentId: string;
    description: string;
    evidenceType?: string;
    hashValue?: string;
    metadata?: any;
  }): Promise<EvidenceFinding> {
    const { incidentId, description, evidenceType = 'LOG_EXTRACT', hashValue, metadata } = params;

    const computedHash =
      hashValue ||
      crypto
        .createHash('sha256')
        .update(description + (metadata ? JSON.stringify(metadata) : ''))
        .digest('hex');

    const finding = await prisma.evidenceFinding.create({
      data: {
        incidentId,
        description,
        evidenceType,
        hashValue: computedHash,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    await createChainedAuditEvent({
      action: 'EVIDENCE_FINDING_ATTACHED',
      resource: `Evidence:${finding.id}`,
      details: { incidentId, evidenceType, hashValue: computedHash },
    });

    return finding;
  }

  /**
   * 4. Generate Forensic Report (PDF) with timeline, evidence, chain-verification,
   * compute its SHA-256 hash, and anchor on the Hardhat Solidity blockchain.
   */
  public async generateForensicReport(params: {
    incidentId: string;
    investigator?: string;
    summaryNotes?: string;
  }): Promise<{
    report: ForensicReport;
    pdfBuffer: Buffer;
    reportHash: string;
    txHash: string;
    blockNumber: number;
    chainVerification: any;
  }> {
    const { incidentId, investigator = 'Security Officer / Lead Forensics', summaryNotes } = params;

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        timeline: { orderBy: { timestamp: 'asc' } },
        evidence: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    // 1. Run live cryptographic audit chain verification
    const chainVerification = await verifyAuditChainAndMerkle();

    // 2. Generate PDF document using PDFKit
    const pdfBuffer = await this.buildForensicPdf({
      incident,
      investigator,
      summaryNotes: summaryNotes || incident.description,
      chainVerification,
    });

    // 3. Compute canonical SHA-256 hash of the generated PDF
    const reportHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const reportHash0x = reportHash.startsWith('0x') ? reportHash : `0x${reportHash}`;

    // 4. Anchor report hash on-chain via Solidity smart contract
    console.log(`[ForensicReport] Anchoring report hash on blockchain: ${reportHash0x}`);
    const onChainAnchor = await anchorRootOnChain(reportHash0x);

    // 5. Save PDF file to storage
    const reportId = crypto.randomUUID();
    const fileName = `forensic-report-${incidentId}-${Date.now()}.pdf`;
    const filePath = path.join(STORAGE_DIR, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    // 6. Record ForensicReport in database
    const report = await prisma.forensicReport.create({
      data: {
        id: reportId,
        incidentId,
        title: `Forensic Investigation: ${incident.title}`,
        summary: summaryNotes || incident.description,
        severity: incident.severity,
        investigator,
        reportHash: reportHash0x,
        txHash: onChainAnchor.txHash,
        blockNumber: onChainAnchor.blockNumber,
        chainValid: chainVerification.isValid,
        pdfPath: `/storage/reports/${fileName}`,
      },
    });

    // 7. Update incident status to CLOSED / REPORTED
    await prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.CLOSED },
    });

    // 8. Log chained audit event
    await createChainedAuditEvent({
      action: 'FORENSIC_REPORT_GENERATED_AND_ANCHORED',
      resource: `ForensicReport:${report.id}`,
      details: {
        incidentId,
        reportHash: reportHash0x,
        txHash: onChainAnchor.txHash,
        blockNumber: onChainAnchor.blockNumber,
      },
    });

    return {
      report,
      pdfBuffer,
      reportHash: reportHash0x,
      txHash: onChainAnchor.txHash,
      blockNumber: onChainAnchor.blockNumber,
      chainVerification,
    };
  }

  /**
   * 5. Verify an uploaded PDF against on-chain anchored hash
   */
  public async verifyReportPdf(pdfBuffer: Buffer): Promise<{
    isValid: boolean;
    status: 'AUTHENTIC_VERIFIED' | 'TAMPERED_OR_UNANCHORED';
    computedHash: string;
    onChainAnchored: boolean;
    blockNumber?: number | null;
    txHash?: string | null;
    reportDetails?: ForensicReport | null;
    reason?: string;
    verifiedAt: string;
  }> {
    const computedHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const computedHash0x = computedHash.startsWith('0x') ? computedHash : `0x${computedHash}`;

    // 1. Check if hash exists in smart contract on Ethereum / Hardhat chain
    const onChainAnchored = await isRootAnchoredOnChain(computedHash0x);

    // 2. Query matching forensic report in database
    const matchingReport = await prisma.forensicReport.findFirst({
      where: { reportHash: computedHash0x },
      include: { incident: true },
    });

    const isValid = onChainAnchored && Boolean(matchingReport);

    return {
      isValid,
      status: isValid ? 'AUTHENTIC_VERIFIED' : 'TAMPERED_OR_UNANCHORED',
      computedHash: computedHash0x,
      onChainAnchored,
      blockNumber: matchingReport?.blockNumber || null,
      txHash: matchingReport?.txHash || null,
      reportDetails: matchingReport || null,
      reason: isValid
        ? 'Report cryptographic checksum verified against immutable blockchain anchor.'
        : 'The SHA-256 hash of this PDF does not match any anchored forensic report on the blockchain. The document has been altered or tampered with.',
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Helper: Builds formatted forensic PDF with styling
   */
  private buildForensicPdf(params: {
    incident: any;
    investigator: string;
    summaryNotes: string;
    chainVerification: any;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const { incident, investigator, summaryNotes, chainVerification } = params;
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      // Header Banner
      doc.rect(40, 40, 515, 60).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
        .text('TELEMEDSECURE FORENSIC REPORT', 55, 52);
      doc.fillColor('#38bdf8').fontSize(9).font('Helvetica')
        .text('CRYPTOGRAPHICALLY ANCHORED INCIDENT INVESTIGATION & AUDIT PROOF', 55, 75);

      doc.moveDown(3);
      doc.fillColor('#000000');

      // Incident Case Metadata Table
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
        .text('1. INCIDENT CASE METADATA', 40, 115);
      doc.rect(40, 130, 515, 80).fill('#f8fafc').stroke('#cbd5e1');
      doc.fillColor('#334155').fontSize(9).font('Helvetica');
      doc.text(`Incident ID: ${incident.id}`, 50, 140);
      doc.text(`Case Title:  ${incident.title}`, 50, 155);
      doc.text(`Severity:    ${incident.severity}`, 50, 170);
      doc.text(`Opened At:   ${new Date(incident.createdAt).toUTCString()}`, 50, 185);

      doc.text(`Lead Investigator: ${investigator}`, 300, 140);
      doc.text(`Target User:       ${incident.targetUserId || 'N/A'}`, 300, 155);
      doc.text(`Status:            ${incident.status}`, 300, 170);

      // Section 2: Cryptographic Audit Chain Verification Status
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
        .text('2. AUDIT TRAIL CHAIN-VERIFICATION RESULT', 40, 225);
      
      const chainValid = chainVerification.isValid;
      doc.rect(40, 240, 515, 60)
        .fill(chainValid ? '#ecfdf5' : '#fef2f2')
        .stroke(chainValid ? '#10b981' : '#ef4444');

      doc.fillColor(chainValid ? '#065f46' : '#991b1b')
        .fontSize(11).font('Helvetica-Bold')
        .text(`AUDIT CHAIN STATUS: ${chainVerification.status} (Intact: ${chainVerification.chainIntact ? 'YES' : 'NO'})`, 50, 252);

      doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
      doc.text(`Total Audit Events Verified: ${chainVerification.totalEvents} | Blockchain Merkle Roots Verified: ${chainVerification.anchorsChecked}`, 50, 270);
      doc.text(`Verification Timestamp: ${chainVerification.verifiedAt}`, 50, 283);

      // Section 3: Summary of Incident
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
        .text('3. INVESTIGATIVE SUMMARY & FINDINGS', 40, 315);
      doc.rect(40, 330, 515, 60).fill('#f8fafc').stroke('#cbd5e1');
      doc.fontSize(9).font('Helvetica').fillColor('#1e293b')
        .text(summaryNotes, 50, 340, { width: 495, lineGap: 3 });

      // Section 4: Attached Evidence Findings
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
        .text(`4. ATTACHED EVIDENCE FINDINGS (${incident.evidence.length})`, 40, 405);
      
      let curY = 420;
      if (incident.evidence.length === 0) {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748b')
          .text('No explicit evidence artifacts attached.', 50, curY);
        curY += 20;
      } else {
        incident.evidence.slice(0, 4).forEach((ev: any, idx: number) => {
          doc.rect(40, curY, 515, 28).fill('#f1f5f9').stroke('#cbd5e1');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a')
            .text(`[#${idx + 1}] ${ev.evidenceType}: ${ev.description}`, 48, curY + 5);
          doc.font('Courier').fontSize(7.5).fillColor('#475569')
            .text(`SHA-256: ${ev.hashValue}`, 48, curY + 16);
          curY += 32;
        });
      }

      // Section 5: Reconstructed Chronological Timeline
      curY = Math.max(curY + 10, 520);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
        .text(`5. RECONSTRUCTED AUDIT EVENT TIMELINE (${incident.timeline.length} Events)`, 40, curY);
      curY += 15;

      incident.timeline.slice(0, 5).forEach((item: any, idx: number) => {
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
          .text(`${new Date(item.timestamp).toISOString()} • ${item.action || 'EVENT'}`, 48, curY);
        doc.fontSize(7).font('Helvetica').fillColor('#334155')
          .text(`Resource: ${item.resource || 'N/A'} | Actor: ${item.userId || 'system'} | Hash: ${item.hash?.slice(0, 24)}...`, 48, curY + 9);
        curY += 22;
      });

      // Footer: Cryptographic Blockchain Seal
      doc.rect(40, 740, 515, 55).fill('#0f172a');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#38bdf8')
        .text('BLOCKCHAIN INTEGRITY SEAL • HARDHAT AUDIT ANCHOR', 50, 750);
      doc.fontSize(7).font('Helvetica').fillColor('#cbd5e1')
        .text('This document contains an immutable SHA-256 seal anchored to the Solidity smart contract.', 50, 762);
      doc.text('Verify authenticity by uploading this PDF at /investigation/verify.', 50, 774);

      doc.end();
    });
  }
}

export const investigationService = InvestigationService.getInstance();
