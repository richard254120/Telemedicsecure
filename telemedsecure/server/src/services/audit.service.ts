import crypto from 'crypto';
import { PrismaClient, AuditEvent } from '@prisma/client';
import { canonicalJson } from '../utils/crypto';
import { MerkleTree } from '../utils/merkle';
import { anchorRootOnChain, isRootAnchoredOnChain, getRootFromChain } from './blockchain.service';

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
  // 1. Fetch latest event in DB to establish the chain
  const lastEvent = await prisma.auditEvent.findFirst({
    orderBy: { timestamp: 'desc' }
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
  const event = await prisma.auditEvent.create({
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

  // 4. Check if unanchored events reach the threshold
  checkAndTriggerAnchor().catch(err => console.error('Auto-anchor error:', err.message));

  return event;
}

/**
 * Backfill any legacy audit events that lack a cryptographic hash
 */
export async function backfillChainIfEmpty(): Promise<number> {
  const allEvents = await prisma.auditEvent.findMany({
    orderBy: { timestamp: 'asc' }
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
  txHash: string;
  blockNumber: number;
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

  // 4. Record in IntegrityVerification table
  const verification = await prisma.integrityVerification.create({
    data: {
      entityType: 'AuditEvent',
      entityId: `${events[0].id}:${events[events.length - 1].id}`,
      merkleRoot: merkleRootBytes32,
      txHash: onChain.txHash,
      blockNumber: onChain.blockNumber,
      eventCount: events.length,
      isValid: true
    }
  });

  console.log(`AuditChain: Anchored batch of ${events.length} events. Root: ${merkleRootBytes32}, Tx: ${onChain.txHash}`);

    return {
      merkleRoot: merkleRootBytes32,
      txHash: onChain.txHash,
      blockNumber: onChain.blockNumber,
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
  merkleRootsMatch: boolean;
  anchorRecords: Array<{
    id: string;
    merkleRoot: string;
    txHash: string | null;
    blockNumber: number | null;
    eventCount: number;
    verifiedAt: Date;
    onChainValid: boolean;
  }>;
  verifiedAt: string;
}

/**
 * Recompute the entire audit hash-chain and verify Merkle roots against blockchain
 */
export async function verifyAuditChainAndMerkle(): Promise<ChainVerificationReport> {
  const events = await prisma.auditEvent.findMany({
    orderBy: { timestamp: 'asc' }
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

  let allOnChainValid = true;
  const anchorRecords: ChainVerificationReport['anchorRecords'] = [];

  for (const v of verifications) {
    const onChainValid = await isRootAnchoredOnChain(v.merkleRoot);
    if (!onChainValid) {
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

  const isValid = chainIntact && (verifications.length === 0 || allOnChainValid);

  if (!isValid) {
    try {
      const { rulesEngine } = await import('./rulesEngine.service');
      await rulesEngine.triggerViolation({
        ruleId: 'AUDIT_CHAIN_BREAK',
        description: `Cryptographic audit hash chain break detected: ${brokenEvent ? brokenEvent.reason : 'Merkle root on-chain verification mismatch'}`,
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
    onChainVerified: allOnChainValid,
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
