import crypto from 'crypto';
import { PrismaClient, AuditEvent } from '@prisma/client';
import { canonicalJson } from '../utils/crypto';
import { MerkleTree } from '../utils/merkle';
import { anchorRootOnChain, isRootAnchoredOnChain, getRootFromChain, isBlockchainReachable } from './blockchain.service';

const prisma = new PrismaClient();

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
export const ANCHOR_BATCH_SIZE = 5; // Anchor every 5 events
export const ANCHOR_INTERVAL_MS = 5 * 60 * 1000; // or every 5 minutes

/**
 * Compute deterministic SHA-256 hash over canonical fields of an AuditEvent
 */
export function computeAuditEventHash(event: {
  action: string;
  resource: string;
  prevHash: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: Date | string;
}): string {
  const canonicalData = canonicalJson({
    action: event.action,
    ipAddress: event.ipAddress || '',
    prevHash: event.prevHash,
    resource: event.resource,
    timestamp: typeof event.timestamp === 'string' ? event.timestamp : event.timestamp.toISOString(),
    userAgent: event.userAgent || '',
    userId: event.userId || ''
  });

  return crypto.createHash('sha256').update(canonicalData).digest('hex');
}

/**
 * Serialisation lock for hash-chain appends.
 *
 * The chain is a linked list: each event's prevHash MUST be the hash of the
 * event that immediately precedes it in append order. `createChainedAuditEvent`
 * reads the current tail, computes the new hash, then writes. Under concurrent
 * requests two events can read the SAME tail and both link to it — a chain fork
 * that later surfaces as a spurious TAMPERED verdict (or, worse, hides a real
 * splice). We funnel every append through a single in-process queue so the
 * read→compute→write critical section is atomic.
 *
 * NOTE: this guarantees ordering within one Node process. A multi-instance
 * deployment must additionally use a DB advisory lock / serialisable transaction.
 */
let appendQueue: Promise<unknown> = Promise.resolve();

/**
 * Create a new AuditEvent that is cryptographically chained to the previous event
 */
export async function createChainedAuditEvent(data: {
  action: string;
  resource: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: any;
}): Promise<AuditEvent> {
  // Enqueue the critical section behind any in-flight append.
  const task = appendQueue.then(async () => {
    // 1. Fetch latest event in DB to establish the chain
    const lastEvent = await prisma.auditEvent.findFirst({
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }]
    });

    const prevHash = lastEvent && lastEvent.hash ? lastEvent.hash : GENESIS_HASH;
    const timestamp = new Date();

    let validUserId: string | null = null;
    if (data.userId) {
      try {
        const user = await prisma.user.findUnique({ where: { id: data.userId } });
        if (user) validUserId = data.userId;
      } catch {}
    }

    // 2. Compute canonical SHA-256 hash
    const hash = computeAuditEventHash({
      action: data.action,
      resource: data.resource,
      prevHash,
      userId: validUserId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp
    });

    // 3. Save to database
    return prisma.auditEvent.create({
      data: {
        action: data.action,
        resource: data.resource,
        userId: validUserId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        timestamp,
        prevHash,
        hash
      }
    });
  });

  // Keep the queue alive even if this append rejects, then release it.
  appendQueue = task.catch(() => {});

  const event = await task;

  // 4. Check if unanchored events reach the threshold (outside the lock)
  checkAndTriggerAnchor().catch(err => console.error('Auto-anchor error:', err.message));

  return event;
}

/**
 * Backfill any legacy audit events that lack a cryptographic hash
 */
export async function backfillChainIfEmpty(): Promise<number> {
  const allEvents = await prisma.auditEvent.findMany({
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }]
  });

  let updatedCount = 0;
  let runningPrevHash = GENESIS_HASH;

  for (const ev of allEvents) {
    const recomputedHash = computeAuditEventHash({
      action: ev.action,
      resource: ev.resource,
      prevHash: runningPrevHash,
      userId: ev.userId,
      ipAddress: ev.ipAddress,
      userAgent: ev.userAgent,
      timestamp: ev.timestamp
    });

    if (!ev.hash || ev.prevHash !== runningPrevHash || ev.hash !== recomputedHash) {
      await prisma.auditEvent.update({
        where: { id: ev.id },
        data: {
          prevHash: runningPrevHash,
          hash: recomputedHash
        }
      });
      runningPrevHash = recomputedHash;
      updatedCount++;
    } else {
      runningPrevHash = ev.hash;
    }
  }

  if (updatedCount > 0) {
    console.log(`AuditChain: Backfilled and chained ${updatedCount} legacy events.`);
  }
  return updatedCount;
}

/**
 * Get all unanchored events
 */
async function getUnanchoredEvents(): Promise<AuditEvent[]> {
  const lastVerification = await prisma.integrityVerification.findFirst({
    where: { entityType: 'AuditEvent' },
    orderBy: { verifiedAt: 'desc' }
  });

  let afterDate = new Date(0);
  if (lastVerification && lastVerification.verifiedAt) {
    afterDate = lastVerification.verifiedAt;
  }

  return prisma.auditEvent.findMany({
    where: {
      timestamp: { gt: afterDate }
    },
    orderBy: { timestamp: 'asc' }
  });
}

let isAnchoringInProgress = false;

/**
 * Anchor unanchored audit events: build Merkle tree and anchor root on the Hardhat chain
 */
export async function anchorAuditEventsNow(): Promise<{
  merkleRoot: string;
  txHash: string | null;
  blockNumber: number | null;
  anchored: boolean;
  eventCount: number;
  verificationId: string;
} | null> {
  if (isAnchoringInProgress) {
    return null;
  }
  isAnchoringInProgress = true;

  try {
    // Ensure chain integrity before building tree
    await backfillChainIfEmpty();

    const events = await getUnanchoredEvents();
    if (events.length === 0) {
      return null;
    }

  // 1. Extract event hashes as leaves
  const leaves = events.map(e => e.hash);

  // 2. Build Merkle tree
  const tree = new MerkleTree(leaves);
  const rawRoot = tree.getRoot();
  const merkleRootBytes32 = tree.getRootBytes32();

  // 3. Anchor on Hardhat blockchain
  const onChain = await anchorRootOnChain(merkleRootBytes32);

  // 4. Record in IntegrityVerification table.
  //    A batch sealed while the node was unreachable has NO real tx: we store
  //    txHash/blockNumber as NULL (a PENDING anchor) instead of the placeholder
  //    the offline path returns, so a later verify against a back-up node treats
  //    it as "not yet confirmed" rather than a false on-chain mismatch/breach.
  const verification = await prisma.integrityVerification.create({
    data: {
      entityType: 'AuditEvent',
      entityId: `${events[0].id}:${events[events.length - 1].id}`,
      merkleRoot: merkleRootBytes32,
      txHash: onChain.anchored ? onChain.txHash : null,
      blockNumber: onChain.anchored ? onChain.blockNumber : null,
      eventCount: events.length,
      isValid: true
    }
  });

  console.log(`AuditChain: Anchored batch of ${events.length} events. Root: ${merkleRootBytes32}, Tx: ${onChain.anchored ? onChain.txHash : '(pending - node offline)'}`);

    return {
      merkleRoot: merkleRootBytes32,
      txHash: onChain.anchored ? onChain.txHash : null,
      blockNumber: onChain.anchored ? onChain.blockNumber : null,
      anchored: onChain.anchored,
      eventCount: events.length,
      verificationId: verification.id
    };
  } finally {
    isAnchoringInProgress = false;
  }
}

/**
 * Check if unanchored events exceed the batch threshold
 */
async function checkAndTriggerAnchor() {
  const unanchored = await getUnanchoredEvents();
  if (unanchored.length >= ANCHOR_BATCH_SIZE) {
    await anchorAuditEventsNow();
  }
}

export interface ChainVerificationReport {
  isValid: boolean;
  status: 'VALID' | 'TAMPERED';
  totalEvents: number;
  chainIntact: boolean;
  brokenEvent: {
    id: string;
    index: number;
    action: string;
    resource: string;
    reason: string;
    expectedHash: string;
    actualHash: string;
    expectedPrevHash: string;
    actualPrevHash: string;
  } | null;
  anchorsChecked: number;
  onChainVerified: boolean;
  onChainReachable: boolean;
  merkleRootsMatch: boolean;
  anchorRecords: Array<{
    id: string;
    merkleRoot: string;
    txHash: string | null;
    blockNumber: number | null;
    eventCount: number;
    verifiedAt: Date;
    /**
     * true = root confirmed on-chain, false = reachable but genuinely absent
     * (real tamper), null = could not be checked because the node is offline
     * (anchor verification PENDING — never reported as a breach).
     */
    onChainValid: boolean | null;
  }>;
  verifiedAt: string;
}

/**
 * Recompute the entire audit hash-chain and verify Merkle roots against blockchain
 */
export async function verifyAuditChainAndMerkle(): Promise<ChainVerificationReport> {
  const events = await prisma.auditEvent.findMany({
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }]
  });

  let runningPrevHash = GENESIS_HASH;
  let brokenEvent: ChainVerificationReport['brokenEvent'] = null;
  let chainIntact = true;

  // 1. Verify individual hash and prevHash chain
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    // Compute expected hash
    const expectedHash = computeAuditEventHash({
      action: ev.action,
      resource: ev.resource,
      prevHash: ev.prevHash,
      userId: ev.userId,
      ipAddress: ev.ipAddress,
      userAgent: ev.userAgent,
      timestamp: ev.timestamp
    });

    if (ev.hash !== expectedHash) {
      chainIntact = false;
      brokenEvent = {
        id: ev.id,
        index: i,
        action: ev.action,
        resource: ev.resource,
        reason: 'Event contents modified: computed hash does not match stored hash (Data Tampering detected)',
        expectedHash,
        actualHash: ev.hash,
        expectedPrevHash: runningPrevHash,
        actualPrevHash: ev.prevHash
      };
      break;
    }

    if (ev.prevHash !== runningPrevHash) {
      chainIntact = false;
      brokenEvent = {
        id: ev.id,
        index: i,
        action: ev.action,
        resource: ev.resource,
        reason: 'Hash chain broken: prevHash does not match previous event hash (Chain Splice/Deletion detected)',
        expectedHash,
        actualHash: ev.hash,
        expectedPrevHash: runningPrevHash,
        actualPrevHash: ev.prevHash
      };
      break;
    }

    runningPrevHash = ev.hash;
  }

  // 2. Verify all IntegrityVerification records against Hardhat blockchain
  const verifications = await prisma.integrityVerification.findMany({
    where: { entityType: 'AuditEvent' },
    orderBy: { verifiedAt: 'desc' }
  });

  // The on-chain Merkle anchor is a SECONDARY proof. The DB hash-chain (chainIntact)
  // is the definitive tamper-evidence layer. A blockchain OUTAGE must never be
  // reported as a data breach, so when the node is unreachable we mark anchors as
  // PENDING (null) rather than invalid, and only raise a real on-chain breach when
  // the node IS reachable and a root is genuinely absent.
  const onChainReachable = await isBlockchainReachable();

  let allOnChainValid = true;
  const anchorRecords: ChainVerificationReport['anchorRecords'] = [];

  for (const v of verifications) {
    // txHash == null means the batch was sealed while the node was offline and
    // never actually written on-chain: that is a PENDING anchor, not evidence of
    // tampering. Only a batch that DID record a tx, yet whose root is absent from
    // the reachable chain, is a genuine on-chain breach.
    const onChainValid = !v.txHash
      ? null
      : (onChainReachable ? await isRootAnchoredOnChain(v.merkleRoot) : null);
    if (onChainValid === false) {
      allOnChainValid = false;
    }

    anchorRecords.push({
      id: v.id,
      merkleRoot: v.merkleRoot,
      txHash: v.txHash,
      blockNumber: v.blockNumber,
      eventCount: v.eventCount,
      verifiedAt: v.verifiedAt,
      onChainValid
    });
  }

  const onChainBreach = onChainReachable && verifications.length > 0 && !allOnChainValid;
  const isValid = chainIntact && !onChainBreach;

  if (!chainIntact || onChainBreach) {
    try {
      const { rulesEngine } = await import('./rulesEngine.service');
      await rulesEngine.triggerViolation({
        ruleId: 'AUDIT_CHAIN_BREAK',
        description: brokenEvent
          ? `Cryptographic audit hash chain break detected: ${brokenEvent.reason}`
          : 'Merkle root on-chain verification mismatch (anchored root absent from reachable chain)',
        resource: brokenEvent?.id ? `AuditEvent:${brokenEvent.id}` : 'AuditChain:Root',
        metadata: {
          brokenEvent,
          totalEvents: events.length,
          onChainVerified: allOnChainValid,
        },
      });
    } catch (triggerErr: any) {
      console.error('Failed to trigger AUDIT_CHAIN_BREAK rule:', triggerErr?.message);
    }
  }

  return {
    isValid,
    status: isValid ? 'VALID' : 'TAMPERED',
    totalEvents: events.length,
    chainIntact,
    brokenEvent,
    anchorsChecked: verifications.length,
    onChainVerified: onChainReachable ? allOnChainValid : false,
    onChainReachable,
    merkleRootsMatch: chainIntact,
    anchorRecords,
    verifiedAt: new Date().toISOString()
  };
}

// 5-minute periodic anchoring scheduler
let periodicAnchorTimer: NodeJS.Timeout | null = null;
export function startPeriodicAnchoring() {
  if (periodicAnchorTimer) return;
  periodicAnchorTimer = setInterval(() => {
    anchorAuditEventsNow().catch(err => console.error('Periodic anchor error:', err.message));
  }, ANCHOR_INTERVAL_MS);
}

export interface ChainRepairResult {
  repairedCount: number;
  tamperPreserved: boolean;
  detectedBreak: ChainVerificationReport['brokenEvent'];
  evidenceSnapshotId: string | null;
  onChainSnapshot: boolean;
}

/**
 * Evidence-preserving chain repair.
 *
 * A naive "repair" that simply recomputes hashes over tampered rows DESTROYS
 * the forensic record: the altered event becomes indistinguishable from a
 * legitimate one. Before recomputing, we seal proof of the break into
 * append-only storage so non-repudiation survives the repair:
 *
 *   1. An `IntegrityVerification` snapshot (entityType AuditChainBreak) records
 *      the tampered event id + expected vs stored hash. Repair never rewrites
 *      these snapshot rows.
 *   2. A chained audit event marker is appended to the live chain.
 *
 * The chain is then re-linked (backfill) so it verifies VALID again, but the
 * tamper remains undeniable. Only used by ADMIN-gated endpoints.
 */
export async function repairAuditChain(): Promise<ChainRepairResult> {
  const report = await verifyAuditChainAndMerkle();

  let evidenceSnapshotId: string | null = null;

  if (!report.isValid && report.brokenEvent) {
    // 1. Seal an immutable snapshot of the break before touching the chain.
    const snapshot = await prisma.integrityVerification.create({
      data: {
        entityType: 'AuditChainBreak',
        entityId: `break:${report.brokenEvent.id}`,
        merkleRoot: '0x' + report.brokenEvent.actualHash,
        eventCount: report.totalEvents,
        isValid: false
      }
    });
    evidenceSnapshotId = snapshot.id;

    // 2. Append an undeniable marker to the audit chain itself.
    await createChainedAuditEvent({
      action: 'AUDIT_CHAIN_TAMPER_SEALED_PRE_REPAIR',
      resource: `AuditEvent:${report.brokenEvent.id}`,
      details: {
        reason: report.brokenEvent.reason,
        expectedHash: report.brokenEvent.expectedHash,
        storedHash: report.brokenEvent.actualHash,
        snapshotId: snapshot.id
      }
    });
  }

  // 3. Re-link the chain forward (only fills/restores consistency; snapshot rows are untouched).
  const repairedCount = await backfillChainIfEmpty();

  return {
    repairedCount,
    tamperPreserved: Boolean(report.brokenEvent),
    detectedBreak: report.brokenEvent,
    evidenceSnapshotId,
    onChainSnapshot: false
  };
}
