import { PrismaClient, Role, PrescriptionStatus } from '@prisma/client';
import request from 'supertest';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import {
  generateDoctorEd25519Keys,
  decryptDoctorPrivateKey,
  canonicalJson,
  signPrescriptionCanonical,
  verifyPrescriptionCanonical
} from '../src/utils/crypto';

const prisma = new PrismaClient();

describe('Step 7: Prescription Digital Signatures and Lifecycle', () => {
  const doctorPassword = 'DoctorPass123!Secure';
  let doctorToken: string;
  let doctorUser: any;
  let patientUser: any;
  let consultation: any;
  let createdPrescriptionId: string;

  beforeAll(async () => {
    // 1. Create a Doctor user with Argon2 password
    const hashed = await argon2.hash(doctorPassword);
    doctorUser = await prisma.user.create({
      data: {
        email: `doctor-step7-${Date.now()}@telemed.com`,
        passwordHash: hashed,
        role: Role.DOCTOR,
        firstName: 'Marcus',
        lastName: 'Welby'
      }
    });

    doctorToken = jwt.sign({ id: doctorUser.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

    // 2. Create a Patient user
    patientUser = await prisma.user.create({
      data: {
        email: `patient-step7-${Date.now()}@telemed.com`,
        passwordHash: hashed,
        role: Role.PATIENT,
        firstName: 'Alice',
        lastName: 'Smith'
      }
    });

    // 3. Create a Consultation
    consultation = await prisma.consultation.create({
      data: {
        doctorId: doctorUser.id,
        patientId: patientUser.id,
        scheduledAt: new Date()
      }
    });
  });

  afterAll(async () => {
    // Clean up
    if (createdPrescriptionId) {
      await prisma.digitalSignature.deleteMany({ where: { prescriptionId: createdPrescriptionId } });
      await prisma.prescriptionItem.deleteMany({ where: { prescriptionId: createdPrescriptionId } });
      await prisma.prescription.deleteMany({ where: { id: createdPrescriptionId } });
    }
    if (consultation) {
      await prisma.consultation.delete({ where: { id: consultation.id } });
    }
    if (doctorUser) {
      await prisma.auditEvent.deleteMany({ where: { userId: doctorUser.id } });
      await prisma.user.delete({ where: { id: doctorUser.id } });
    }
    if (patientUser) {
      await prisma.user.delete({ where: { id: patientUser.id } });
    }
    await prisma.$disconnect();
  });

  describe('Cryptographic Primitives', () => {
    it('generates an Ed25519 keypair and encrypts private key with doctor password-derived key', () => {
      const { publicKey, encryptedPrivateKey, salt, iv, authTag } = generateDoctorEd25519Keys(doctorPassword);

      expect(publicKey).toContain('BEGIN PUBLIC KEY');
      expect(encryptedPrivateKey).toBeDefined();
      expect(salt).toHaveLength(32); // 16 bytes hex
      expect(iv).toHaveLength(24); // 12 bytes hex
      expect(authTag).toHaveLength(32); // 16 bytes hex

      // Decrypt with correct password
      const privKey = decryptDoctorPrivateKey(encryptedPrivateKey, salt, iv, authTag, doctorPassword);
      expect(privKey).toBeDefined();
      expect(privKey.type).toBe('private');

      // Decrypt with incorrect password should throw auth error
      expect(() => {
        decryptDoctorPrivateKey(encryptedPrivateKey, salt, iv, authTag, 'WrongPassword!');
      }).toThrow();
    });

    it('canonically serializes JSON objects consistently regardless of key insertion order', () => {
      const objA = { b: 'beta', a: 'alpha', list: [{ y: 2, x: 1 }] };
      const objB = { a: 'alpha', list: [{ y: 2, x: 1 }], b: 'beta' };

      expect(canonicalJson(objA)).toBe(canonicalJson(objB));
      expect(canonicalJson(objA)).toBe('{"a":"alpha","b":"beta","list":[{"x":1,"y":2}]}');
    });

    it('signs SHA-256 digest of canonical JSON with Ed25519 and verifies correctly', () => {
      const keys = generateDoctorEd25519Keys(doctorPassword);
      const privKey = decryptDoctorPrivateKey(keys.encryptedPrivateKey, keys.salt, keys.iv, keys.authTag, doctorPassword);

      const testPayload = canonicalJson({ med: 'Amoxicillin', dose: '500mg' });
      const { signatureHex, canonicalHashHex } = signPrescriptionCanonical(privKey, testPayload);

      expect(signatureHex).toBeDefined();
      expect(canonicalHashHex).toHaveLength(64); // SHA-256 hex string

      // Verify valid data
      const validResult = verifyPrescriptionCanonical(keys.publicKey, testPayload, signatureHex);
      expect(validResult.isValid).toBe(true);
      expect(validResult.computedHash).toBe(canonicalHashHex);

      // Verify tampered data
      const tamperedPayload = canonicalJson({ med: 'Amoxicillin', dose: '1000mg' });
      const invalidResult = verifyPrescriptionCanonical(keys.publicKey, tamperedPayload, signatureHex);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('Prescription API Endpoints', () => {
    it('creates and signs a prescription with doctor Ed25519 keypair and creates AuditEvent', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          consultationId: consultation.id,
          password: doctorPassword,
          items: [
            { medication: 'Amoxicillin', dosage: '500mg', instructions: 'Take 1 tablet every 8 hours for 7 days' },
            { medication: 'Ibuprofen', dosage: '400mg', instructions: 'Take with food as needed for pain' }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.prescription).toBeDefined();
      expect(res.body.prescription.status).toBe('ISSUED');
      expect(res.body.prescription.signature).toBeDefined();
      expect(res.body.prescription.signature.signature).toBeDefined();
      expect(res.body.prescription.signature.publicKey).toContain('BEGIN PUBLIC KEY');

      createdPrescriptionId = res.body.prescription.id;

      // Verify audit event
      const audit = await prisma.auditEvent.findFirst({
        where: { action: 'ISSUE_PRESCRIPTION', resource: `Prescription:${createdPrescriptionId}` }
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(doctorUser.id);
    });

    it('rejects prescription creation if wrong doctor password is provided', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          consultationId: consultation.id,
          password: 'IncorrectDoctorPassword123!',
          items: [{ medication: 'Aspirin', dosage: '81mg', instructions: 'Daily' }]
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid doctor password');
    });

    it('verifies a genuine prescription as VALID via public verification endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/prescriptions/${createdPrescriptionId}/verify`);

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.status).toBe('VALID');
      expect(res.body.lifecycleStatus).toBe('ISSUED');
      expect(res.body.items).toHaveLength(2);
      expect(res.body.doctor.name).toBe('Dr. Marcus Welby');

      // Verify audit log for verification
      const verifyAudit = await prisma.auditEvent.findFirst({
        where: { action: 'VERIFY_PRESCRIPTION', resource: `Prescription:${createdPrescriptionId}` }
      });
      expect(verifyAudit).not.toBeNull();
    });

    it('updates lifecycle: dispenses prescription and logs AuditEvent', async () => {
      const res = await request(app)
        .post(`/api/v1/prescriptions/${createdPrescriptionId}/dispense`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ pharmacyNotes: 'Dispensed at CVS Pharmacy #4012' });

      expect(res.status).toBe(200);
      expect(res.body.prescription.status).toBe('DISPENSED');
      expect(res.body.prescription.statusReason).toBe('Dispensed at CVS Pharmacy #4012');

      // Verify audit event
      const dispenseAudit = await prisma.auditEvent.findFirst({
        where: { action: 'DISPENSE_PRESCRIPTION', resource: `Prescription:${createdPrescriptionId}` }
      });
      expect(dispenseAudit).not.toBeNull();
    });

    it('prevents dispensing a prescription twice', async () => {
      const res = await request(app)
        .post(`/api/v1/prescriptions/${createdPrescriptionId}/dispense`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ pharmacyNotes: 'Second attempt' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already been dispensed');
    });

    it('detects tampering and reports status as TAMPERED', async () => {
      // 1. Simulate unauthorized database tamper
      const tamperRes = await request(app)
        .post(`/api/v1/prescriptions/${createdPrescriptionId}/tamper`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(tamperRes.status).toBe(200);

      // 2. Verify prescription: cryptographic verification should now fail!
      const verifyRes = await request(app)
        .get(`/api/v1/prescriptions/${createdPrescriptionId}/verify`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.isValid).toBe(false);
      expect(verifyRes.body.status).toBe('TAMPERED');
    });
  });
});
