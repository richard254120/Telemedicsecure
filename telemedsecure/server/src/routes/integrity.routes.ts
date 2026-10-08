import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  verifyAuditChainAndMerkle,
  anchorAuditEventsNow,
  createChainedAuditEvent,
  backfillChainIfEmpty
} from '../services/audit.service';
import { isRootAnchoredOnChain } from '../services/blockchain.service';

const router = Router();
const prisma = new PrismaClient();

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
    if (!result) {
      return res.json({
        message: 'No new unanchored audit events to anchor.',
        anchored: false
      });
    }

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
// 3. TAMPER WITH AN AUDIT EVENT ROW (DEMO SCRIPT)
// ==========================================
router.post('/tamper', async (req: Request, res: Response) => {
  try {
    const { eventId, field, value } = req.body || {};

    let targetEvent;
    if (eventId) {
      targetEvent = await prisma.auditEvent.findUnique({ where: { id: eventId } });
    } else {
      // Find the second-to-last or latest event
      const events = await prisma.auditEvent.findMany({
        orderBy: { timestamp: 'desc' },
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
// 4. RESTORE / REPAIR AUDIT CHAIN
// ==========================================
router.post('/repair', async (req: Request, res: Response) => {
  try {
    const count = await backfillChainIfEmpty();
    res.json({
      message: `Audit chain re-computed and repaired successfully (${count} events updated).`,
      repairedCount: count
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
      orderBy: { timestamp: 'desc' },
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
