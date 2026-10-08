import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import app from '../src/app';
import {
  computeAuditEventHash,
  createChainedAuditEvent,
  verifyAuditChainAndMerkle,
  anchorAuditEventsNow,
  backfillChainIfEmpty,
  GENESIS_HASH
} from '../src/services/audit.service';
import { MerkleTree } from '../src/utils/merkle';
import { anchorRootOnChain, getRootFromChain, isRootAnchoredOnChain } from '../src/services/blockchain.service';

const prisma = new PrismaClient();

describe('Step 8: Hash-Chained AuditEvents, Merkle Trees & Blockchain Anchoring', () => {
  beforeAll(async () => {
    // Backfill any existing un-hashed events
    await backfillChainIfEmpty();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Audit Hash Chaining', () => {
    it('computes consistent canonical SHA-256 hashes regardless of field order', () => {
      const timestamp = new Date('2026-10-08T12:00:00Z');
      const hash1 = computeAuditEventHash({
        action: 'TEST_ACTION',
        resource: 'Patient:123',
        prevHash: GENESIS_HASH,
        userId: 'user-abc',
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        timestamp
      });

      const hash2 = computeAuditEventHash({
        prevHash: GENESIS_HASH,
        resource: 'Patient:123',
        action: 'TEST_ACTION',
        userAgent: 'Jest',
        ipAddress: '127.0.0.1',
        userId: 'user-abc',
        timestamp: '2026-10-08T12:00:00.000Z'
      });

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('creates successive chained events where each points to previous event hash', async () => {
      const event1 = await createChainedAuditEvent({
        action: 'CHAIN_TEST_1',
        resource: 'Resource:A',
        userId: 'tester-1'
      });

      const event2 = await createChainedAuditEvent({
        action: 'CHAIN_TEST_2',
        resource: 'Resource:B',
        userId: 'tester-1'
      });

      expect(event1.hash).toBeDefined();
      expect(event1.hash).toHaveLength(64);
      expect(event2.prevHash).toBe(event1.hash);
      expect(event2.hash).toHaveLength(64);
      expect(event2.hash).not.toBe(event1.hash);
    });
  });

  describe('Merkle Tree Cryptography', () => {
    it('builds a valid Merkle tree and verifies proofs', () => {
      const leaves = [
        '1111111111111111111111111111111111111111111111111111111111111111',
        '2222222222222222222222222222222222222222222222222222222222222222',
        '3333333333333333333333333333333333333333333333333333333333333333',
        '4444444444444444444444444444444444444444444444444444444444444444'
      ];

      const tree = new MerkleTree(leaves);
      const root = tree.getRoot();

      expect(root).toHaveLength(64);
      expect(tree.getRootBytes32()).toBe('0x' + root);

      // Verify proof for leaf #1
      const proof = tree.getProof(1);
      expect(proof.length).toBeGreaterThan(0);
      const isValid = MerkleTree.verifyProof(leaves[1], proof, root);
      expect(isValid).toBe(true);

      // Verify tampered leaf fails
      const isTamperedValid = MerkleTree.verifyProof('5555555555555555555555555555555555555555555555555555555555555555', proof, root);
      expect(isTamperedValid).toBe(false);
    });
  });

  describe('Solidity Blockchain Anchoring', () => {
    it('anchors Merkle root on Hardhat chain and reads it via getRoot', async () => {
      const dummyRoot = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const anchorResult = await anchorRootOnChain(dummyRoot);

      expect(anchorResult.txHash).toBeDefined();
      expect(anchorResult.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Verify contract state
      const isAnchored = await isRootAnchoredOnChain(dummyRoot);
      expect(isAnchored).toBe(true);

      const retrievedRoot = await getRootFromChain(anchorResult.rootIndex);
      expect(retrievedRoot?.toLowerCase()).toBe(dummyRoot.toLowerCase());
    });
  });

  describe('Integrity Verification API Endpoints', () => {
    it('anchors audit events via POST /api/v1/integrity/anchor', async () => {
      // Create a few events to ensure unanchored events exist
      await createChainedAuditEvent({ action: 'PRE_ANCHOR_1', resource: 'Test:1' });
      await createChainedAuditEvent({ action: 'PRE_ANCHOR_2', resource: 'Test:2' });

      const res = await request(app).post('/api/v1/integrity/anchor');
      expect(res.status).toBe(200);

      if (res.body.anchored) {
        expect(res.body.merkleRoot).toBeDefined();
        expect(res.body.txHash).toBeDefined();
      }
    });

    it('verifies the audit chain and reports VALID when un-tampered', async () => {
      const res = await request(app).get('/api/v1/integrity/verify');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VALID');
      expect(res.body.isValid).toBe(true);
      expect(res.body.chainIntact).toBe(true);
      expect(res.body.brokenEvent).toBeNull();
    });

    it('detects tampering and reports TAMPERED when a database row is modified', async () => {
      // 1. Trigger tamper simulation
      const tamperRes = await request(app).post('/api/v1/integrity/tamper');
      expect(tamperRes.status).toBe(200);
      expect(tamperRes.body.tamperedEventId).toBeDefined();

      // 2. Run verification job: should now report TAMPERED and identify the broken event!
      const verifyRes = await request(app).get('/api/v1/integrity/verify');
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.status).toBe('TAMPERED');
      expect(verifyRes.body.isValid).toBe(false);
      expect(verifyRes.body.chainIntact).toBe(false);
      expect(verifyRes.body.brokenEvent).not.toBeNull();
      expect(verifyRes.body.brokenEvent.id).toBe(tamperRes.body.tamperedEventId);

      // 3. Repair the chain to return to healthy state
      const repairRes = await request(app).post('/api/v1/integrity/repair');
      expect(repairRes.status).toBe(200);

      // 4. Verify healthy state restored
      const afterRepair = await request(app).get('/api/v1/integrity/verify');
      expect(afterRepair.body.status).toBe('VALID');
      expect(afterRepair.body.isValid).toBe(true);
    });
  });
});
