import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import {
  verifyAuditChainAndMerkle,
  anchorAuditEventsNow,
  createChainedAuditEvent,
  repairAuditChain
} from '../services/audit.service';
import { requireAuth, requireRole } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// ============================================================================
// SECURITY (CIA triad)
// ----------------------------------------------------------------------------
// The forensic integrity surface was previously reachable with NO authentication
// at all, which inverted the whole point of a tamper-evident audit chain:
//   • GET  /events, /anchors  -> leaked the full audit trail (user IDs, IPs,
//     resources)                  => CONFIDENTIALITY breach (HIPAA / GDPR Art.5)
//   • POST /tamper, /repair, /anchor -> let ANY caller mutate/re-seal the chain
//                                    => INTEGRITY subversion & cost/DoS abuse
//
// Every endpoint below now requires an authenticated ADMIN. Write actions are
// additionally recorded to the append-only audit chain so privileged use of the
// forensic tooling is itself non-repudiable.
// ============================================================================
const adminOnly = [requireAuth, requireRole([Role.ADMIN])] as const;

router.use(...adminOnly);

const isAdminActor = (req: Request) => {
  const user = (req as any).user;
  return { userId: user?.id ?? null, email: user?.email ?? 'unknown' };
};

// ==========================================
// 1. RECOMPUTE CHAIN & VERIFY MERKLE PROOFS
// ==========================================
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const report = await verifyAuditChainAndMerkle();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Chain verification failed', details: err.message });
  }
});

// ==========================================
// 2. TRIGGER MANUAL ON-CHAIN MERKLE ANCHOR
// ==========================================
router.post('/anchor', async (req: Request, res: Response) => {
  try {
    const result = await anchorAuditEventsNow();
    const actor = isAdminActor(req);

    if (!result) {
      return res.json({
        message: 'No new unanchored audit events to anchor.',
        anchored: false
      });
    }

    // Record privileged anchoring to the chain (non-repudiation).
    await createChainedAuditEvent({
      action: 'INTEGRITY_ANCHOR_TRIGGERED',
      resource: 'AuditChain:Root',
      userId: actor.userId,
      ipAddress: req.ip || null,
      details: { merkleRoot: result.merkleRoot, txHash: result.txHash, eventCount: result.eventCount, actor: actor.email }
    });

    res.json({
      message: 'Audit events Merkle root successfully anchored on Hardhat blockchain.',
      anchored: true,
      ...result
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Blockchain anchor failed', details: err.message });
  }
});

// ==========================================
// 3. TAMPER WITH AN AUDIT EVENT ROW (DEMO / QA ONLY)
// ------------------------------------------
// Destructive by design: it mutates a live audit row WITHOUT re-hashing, purely
// to exercise tamper detection. This MUST NEVER run in production, and even in
// non-production it is ADMIN-gated and itself recorded to the chain.
// ==========================================
router.post('/tamper', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Tamper simulation is disabled in production' });
  }

  try {
    const { eventId, field, value } = req.body || {};

    let targetEvent;
    if (eventId) {
      targetEvent = await prisma.auditEvent.findUnique({ where: { id: eventId } });
    } else {
      // Find the second-to-last or latest event
      const events = await prisma.auditEvent.findMany({
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: 3
      });
      targetEvent = events[events.length > 1 ? 1 : 0];
    }

    if (!targetEvent) {
      return res.status(404).json({ error: 'No audit event found to tamper with' });
    }

    // Tamper with action or resource directly in the database without updating the hash chain
    const originalAction = targetEvent.action;
    const tamperedAction = value || `${originalAction}_UNAUTHORIZED_TAMPER`;

    const updated = await prisma.auditEvent.update({
      where: { id: targetEvent.id },
      data: {
        action: tamperedAction
      }
    });

    // Record the deliberate tamper attempt so the demo itself is accountable.
    const actor = isAdminActor(req);
    await createChainedAuditEvent({
      action: 'INTEGRITY_TAMPER_SIMULATED',
      resource: `AuditEvent:${targetEvent.id}`,
      userId: actor.userId,
      ipAddress: req.ip || null,
      details: { originalAction, tamperedAction, actor: actor.email, note: 'Non-production tamper simulation' }
    });

    res.json({
      message: 'Tampering simulated: Database row modified directly without updating the cryptographic hash chain. Verification job will now flag TAMPERED.',
      tamperedEventId: targetEvent.id,
      originalAction,
      modifiedAction: tamperedAction,
      originalHash: targetEvent.hash
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to simulate tamper', details: err.message });
  }
});

// ==========================================
// 4. EVIDENCE-PRESERVING CHAIN REPAIR
// ------------------------------------------
// Previously this blindly recomputed hashes, silently washing away tamper
// evidence. `repairAuditChain` now seals an immutable snapshot of any detected
// break (append-only) BEFORE re-linking, so integrity is restored without
// destroying the forensic record.
// ==========================================
router.post('/repair', async (req: Request, res: Response) => {
  try {
    const actor = isAdminActor(req);
    const result = await repairAuditChain();

    await createChainedAuditEvent({
      action: 'INTEGRITY_CHAIN_REPAIRED',
      resource: 'AuditChain:Root',
      userId: actor.userId,
      ipAddress: req.ip || null,
      details: {
        repairedCount: result.repairedCount,
        tamperPreserved: result.tamperPreserved,
        evidenceSnapshotId: result.evidenceSnapshotId,
        actor: actor.email
      }
    });

    res.json({
      message: `Audit chain re-linked (${result.repairedCount} events updated). ` +
        (result.tamperPreserved
          ? 'A tamper was detected; its proof was sealed to append-only evidence BEFORE repair.'
          : 'No tamper detected; only legacy/unhashed events were chained.'),
      repairedCount: result.repairedCount,
      tamperPreserved: result.tamperPreserved,
      detectedBreak: result.detectedBreak,
      evidenceSnapshotId: result.evidenceSnapshotId
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to repair chain', details: err.message });
  }
});

// ==========================================
// 5. LIST AUDIT EVENTS (For Frontend Chain Viewer)
// ==========================================
router.get('/events', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const events = await prisma.auditEvent.findMany({
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: limit
    });
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list events', details: err.message });
  }
});

// ==========================================
// 6. LIST ON-CHAIN ANCHORS (IntegrityVerification)
// ==========================================
router.get('/anchors', async (req: Request, res: Response) => {
  try {
    const anchors = await prisma.integrityVerification.findMany({
      where: { entityType: 'AuditEvent' },
      orderBy: { verifiedAt: 'desc' }
    });
    res.json(anchors);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list anchors', details: err.message });
  }
});

export default router;
