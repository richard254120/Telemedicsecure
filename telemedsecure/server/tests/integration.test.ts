import { PrismaClient, Role } from '@prisma/client';
import request from 'supertest';
import app from '../src/app';
import * as crypto from 'crypto';
import {
  generateDoctorEd25519Keys,
  decryptDoctorPrivateKey,
  signPrescriptionCanonical,
  verifyPrescriptionCanonical,
  canonicalJson,
  encryptDataEnvelope,
  decryptDataEnvelope
} from '../src/utils/crypto';
import {
  createChainedAuditEvent,
  verifyAuditChainAndMerkle,
  anchorAuditEventsNow,
  backfillChainIfEmpty,
  computeAuditEventHash
} from '../src/services/audit.service';
import { isRootAnchoredOnChain } from '../src/services/blockchain.service';

const prisma = new PrismaClient();

describe('Step 12: Comprehensive Integration Test Suite', () => {
  let adminToken: string;
  let doctorToken: string;
  let patientToken: string;
  let nurseToken: string;

  let testDoctor: any;
  let testPatient: any;
  let testConsultation: any;

  beforeAll(async () => {
    await backfillChainIfEmpty();

    // 1. Obtain tokens for all roles using quick-login
    const adminRes = await request(app)
      .post('/api/v1/auth/quick-login')
      .send({ role: 'ADMIN' });
    adminToken = adminRes.body.accessToken;

    const docRes = await request(app)
      .post('/api/v1/auth/quick-login')
      .send({ role: 'DOCTOR' });
    doctorToken = docRes.body.accessToken;
    testDoctor = docRes.body.user;

    const patRes = await request(app)
      .post('/api/v1/auth/quick-login')
      .send({ role: 'PATIENT' });
    patientToken = patRes.body.accessToken;
    testPatient = patRes.body.user;

    const nurseRes = await request(app)
      .post('/api/v1/auth/quick-login')
      .send({ role: 'NURSE' });
    nurseToken = nurseRes.body.accessToken;

    // Ensure test patient has GDPR consent for telemedicine
    const existingConsent = await prisma.consent.findFirst({
      where: {
        patientId: testPatient.id,
        purpose: 'TELEMEDICINE_TREATMENT'
      }
    });

    if (!existingConsent) {
      await prisma.consent.create({
        data: {
          patientId: testPatient.id,
          purpose: 'TELEMEDICINE_TREATMENT',
          granted: true
        }
      });
    }

    // Ensure testDoctor has Ed25519 keys registered
    const ed25519Keys = generateDoctorEd25519Keys('Password123!');
    await prisma.user.update({
      where: { id: testDoctor.id },
      data: {
        doctorPublicKey: ed25519Keys.publicKey,
        doctorEncryptedPrivKey: ed25519Keys.encryptedPrivateKey,
        doctorKeyDerivationSalt: ed25519Keys.salt,
        doctorKeyIv: ed25519Keys.iv,
        doctorKeyAuthTag: ed25519Keys.authTag
      }
    });

    // Create a shared test consultation
    testConsultation = await prisma.consultation.create({
      data: {
        patientId: testPatient.id,
        doctorId: testDoctor.id,
        scheduledAt: new Date()
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. AUTHENTICATION & SESSION INTEGRATION
  // =========================================================================
  describe('1. Authentication & Session Integration', () => {
    const testEmail = `integ-${Date.now()}@telemed.test`;
    const testPassword = 'SecurePassword123!';

    it('successfully registers a new user with Argon2/Bcrypt hashing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          firstName: 'Integration',
          lastName: 'Tester',
          role: 'PATIENT'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User registered');

      // Verify password was securely hashed in database
      const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.passwordHash).not.toBe(testPassword);
      expect(dbUser?.passwordHash).toMatch(/^(\$argon2|\$2[abxy]\$)/);
    });

    it('authenticates user with valid credentials and issues JWT with user metadata', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user).toMatchObject({
        email: testEmail,
        firstName: 'Integration',
        lastName: 'Tester',
        role: 'PATIENT'
      });
    });

    it('rejects authentication with invalid password and tracks failed attempts', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');

      const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
      expect(dbUser?.failedAttempts).toBeGreaterThanOrEqual(1);
    });

    it('validates active session via GET /api/v1/auth/me', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email');
      expect(res.body.role).toBe('PATIENT');
    });
  });

  // =========================================================================
  // 2. ROLE-BASED ACCESS CONTROL (RBAC) INTEGRATION
  // =========================================================================
  describe('2. Role-Based Access Control (RBAC) Integration', () => {
    it('denies patient access to doctor-only endpoints (issue prescription)', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          consultationId: testConsultation.id,
          items: [{ medication: 'Amoxicillin', dosage: '500mg', instructions: 'TID' }],
          doctorPassword: 'Password123!'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('denies patient access to admin-only user management', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });

    it('denies nurse access to admin-only user management', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(403);
    });

    it('allows admin full access to user management and role modification', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('blocks admin from viewing sensitive decrypted clinical vitals (Zero-Knowledge)', async () => {
      // Create a test vital sign record
      const vitalRes = await request(app)
        .post('/api/v1/vitals')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          consultationId: testConsultation.id,
          vitals: { bpSystolic: 120, bpDiastolic: 80, heartRate: 72, temp: 36.6, spO2: 99 }
        });
      expect(vitalRes.status).toBe(201);
      const vitalId = vitalRes.body.id;

      // Admin attempts to view decrypted vitals
      const adminView = await request(app)
        .get(`/api/v1/vitals/${vitalId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminView.status).toBe(403);
      expect(adminView.body.error).toContain('Admins cannot view clinical content');
    });
  });

  // =========================================================================
  // 3. ENVELOPE ENCRYPTION & DATA INTEGRITY
  // =========================================================================
  describe('3. AES-256-GCM Envelope Encryption Integration', () => {
    it('encrypts consultation notes with unique DEK and stores authentic ciphertexts', async () => {
      const sensitiveNote = 'Patient diagnosed with Stage 1 Hypertension. Prescribed Lisinopril 10mg daily.';

      const res = await request(app)
        .put(`/api/v1/consultations/${testConsultation.id}/notes`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ notes: sensitiveNote });

      expect(res.status).toBe(200);

      // Verify raw database record
      const updatedConsultation = await prisma.consultation.findUnique({
        where: { id: testConsultation.id }
      });

      expect(updatedConsultation?.encryptedNotes).toBeDefined();
      expect(updatedConsultation?.encryptedNotes).not.toBe(sensitiveNote);
      expect(updatedConsultation?.notesIv).toBeDefined();
      expect(updatedConsultation?.notesAuthTag).toBeDefined();
      expect(updatedConsultation?.encryptedDek).toBeDefined();

      // Ensure raw ciphertext cannot be read without decryption
      expect(updatedConsultation?.encryptedNotes).not.toContain('Lisinopril');

      // Decrypt using envelope helper
      const decrypted = decryptDataEnvelope(
        updatedConsultation!.encryptedNotes!,
        updatedConsultation!.notesIv!,
        updatedConsultation!.notesAuthTag!,
        updatedConsultation!.encryptedDek!,
        updatedConsultation!.dekIv!,
        updatedConsultation!.dekAuthTag!
      );
      expect(decrypted).toBe(sensitiveNote);
    });

    it('captures and envelope-encrypts vital signs with automated clinical flag detection', async () => {
      const res = await request(app)
        .post('/api/v1/vitals')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          consultationId: testConsultation.id,
          vitals: {
            bpSystolic: 155, // Abnormal: Hypertension
            bpDiastolic: 95,
            heartRate: 110,  // Abnormal: Tachycardia
            temp: 37.2,
            spO2: 90         // Abnormal: Hypoxia
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.flagged).toBe(true);

      // Verify clinical flag created
      const flags = await prisma.clinicalFlag.findMany({
        where: { consultationId: testConsultation.id }
      });
      expect(flags.length).toBeGreaterThan(0);
      expect(flags.some(f => f.description.includes('Hypertension'))).toBe(true);
      expect(flags.some(f => f.description.includes('Hypoxia'))).toBe(true);
    });
  });

  // =========================================================================
  // 4. ED25519 DIGITAL SIGNATURES & PRESCRIPTION LIFECYCLE
  // =========================================================================
  describe('4. Ed25519 Digital Signatures & Prescription Verification', () => {
    let prescriptionId: string;

    it('allows doctor to issue digitally signed prescription with Ed25519 keypair', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          consultationId: testConsultation.id,
          items: [
            { medication: 'Lisinopril', dosage: '10mg', instructions: 'Take 1 tablet daily in morning' },
            { medication: 'Hydrochlorothiazide', dosage: '12.5mg', instructions: 'Take 1 tablet daily with water' }
          ],
          password: 'Password123!'
        });

      expect(res.status).toBe(201);
      expect(res.body.prescription).toBeDefined();
      expect(res.body.prescription.signature).toBeDefined();
      expect(res.body.prescription.status).toBe('ISSUED');

      prescriptionId = res.body.prescription.id;
    });

    it('verifies valid prescription signature and returns VALID status', async () => {
      const res = await request(app)
        .get(`/api/v1/prescriptions/${prescriptionId}/verify`);

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.status).toBe('VALID');
      expect(res.body).toHaveProperty('computedHash');
      expect(res.body.signature?.publicKey || res.body.doctorPublicKey).toBeDefined();
    });

    it('detects tampering when database prescription items are altered directly', async () => {
      // Directly tamper with an item in the database
      const firstItem = await prisma.prescriptionItem.findFirst({
        where: { prescriptionId }
      });
      expect(firstItem).not.toBeNull();

      // Tamper dosage: change 10mg to 100mg (lethal dose modification)
      await prisma.prescriptionItem.update({
        where: { id: firstItem!.id },
        data: { dosage: '100mg (TAMPERED)' }
      });

      // Verification endpoint must detect mismatch
      const res = await request(app)
        .get(`/api/v1/prescriptions/${prescriptionId}/verify`);

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
      expect(res.body.status).toBe('TAMPERED');

      // Revert modification
      await prisma.prescriptionItem.update({
        where: { id: firstItem!.id },
        data: { dosage: '10mg' }
      });
    });
  });

  // =========================================================================
  // 5. AUDIT HASH-CHAINING, MERKLE TREES & BLOCKCHAIN ANCHORING
  // =========================================================================
  describe('5. Audit Hash-Chaining, Merkle Trees & Hardhat Blockchain Anchoring', () => {
    beforeAll(async () => {
      // Ensure chain is clean before section 5 runs
      await request(app).post('/api/v1/integrity/repair');
    });

    it('creates successive chained events with deterministic prevHash links', async () => {
      const eventA = await createChainedAuditEvent({
        action: 'INTEG_ACTION_A',
        resource: 'Resource:IntegA',
        userId: testDoctor.id
      });

      const eventB = await createChainedAuditEvent({
        action: 'INTEG_ACTION_B',
        resource: 'Resource:IntegB',
        userId: testDoctor.id
      });

      expect(eventA.hash).toHaveLength(64);
      expect(eventB.prevHash).toBe(eventA.hash);
      expect(eventB.hash).toHaveLength(64);
    });

    it('builds Merkle tree and anchors root on Hardhat blockchain contract', async () => {
      // Trigger a new event to guarantee unanchored items exist
      await createChainedAuditEvent({
        action: 'INTEG_ANCHOR_TRIGGER',
        resource: 'Resource:AnchorTarget',
        userId: testDoctor.id
      });

      const anchorResult = await anchorAuditEventsNow();
      if (anchorResult) {
        expect(anchorResult.merkleRoot).toMatch(/^0x[0-9a-fA-F]{64}$/);
        expect(anchorResult.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

        // Verify root is anchored in Solidity contract
        const isAnchored = await isRootAnchoredOnChain(anchorResult.merkleRoot);
        expect(isAnchored).toBe(true);
      } else {
        // If already anchored, verify latest anchor in DB
        const latest = await prisma.integrityVerification.findFirst({
          orderBy: { verifiedAt: 'desc' }
        });
        expect(latest).not.toBeNull();
        expect(latest?.merkleRoot).toMatch(/^0x[0-9a-fA-F]{64}$/);
      }
    });

    it('verifies audit chain integrity and reports valid chain status', async () => {
      await request(app).post('/api/v1/integrity/repair');
      const verifyRes = await request(app).get('/api/v1/integrity/verify');
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.isValid).toBe(true);
      expect(verifyRes.body.status).toBe('VALID');
      expect(verifyRes.body.chainIntact).toBe(true);
    });

    it('detects tampering and chain break via /api/v1/integrity/tamper', async () => {
      const tamperRes = await request(app).post('/api/v1/integrity/tamper');
      expect(tamperRes.status).toBe(200);
      expect(tamperRes.body.tamperedEventId).toBeDefined();

      const verifyRes = await request(app).get('/api/v1/integrity/verify');
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.status).toBe('TAMPERED');
      expect(verifyRes.body.isValid).toBe(false);

      // Restore chain
      const repairRes = await request(app).post('/api/v1/integrity/repair');
      expect(repairRes.status).toBe(200);

      const afterRepair = await request(app).get('/api/v1/integrity/verify');
      expect(afterRepair.body.status).toBe('VALID');
      expect(afterRepair.body.isValid).toBe(true);
    });
  });
});
