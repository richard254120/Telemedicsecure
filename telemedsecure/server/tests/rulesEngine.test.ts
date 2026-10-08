import { PrismaClient, Role, Severity, ViolationType } from '@prisma/client';
import request from 'supertest';
import app from '../src/app';
import jwt from 'jsonwebtoken';
import { rulesEngine, RULE_DEFINITIONS, RuleId } from '../src/services/rulesEngine.service';
import { gdprService } from '../src/services/gdpr.service';
import { encryptDataEnvelope } from '../src/utils/crypto';

const prisma = new PrismaClient();

describe('Step 9: Compliance Rules Engine & GDPR Endpoints', () => {
  let adminUser: any;
  let doctorUser: any;
  let patientUser: any;
  let adminToken: string;
  let doctorToken: string;
  let patientToken: string;

  beforeAll(async () => {
    // Setup test users for role testing
    const ts = Date.now();

    adminUser = await prisma.user.create({
      data: {
        email: `admin-rule-test-${ts}@telemed.local`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashadmin',
        role: Role.ADMIN,
        firstName: 'Compliance',
        lastName: 'Admin',
      },
    });

    doctorUser = await prisma.user.create({
      data: {
        email: `doctor-rule-test-${ts}@telemed.local`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashdoc',
        role: Role.DOCTOR,
        firstName: 'Marcus',
        lastName: 'Welby',
      },
    });

    patientUser = await prisma.user.create({
      data: {
        email: `patient-rule-test-${ts}@telemed.local`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashpatient',
        role: Role.PATIENT,
        firstName: 'Jane',
        lastName: 'Doe',
      },
    });

    const secret = process.env.JWT_SECRET || 'secret';
    adminToken = jwt.sign({ id: adminUser.id }, secret, { expiresIn: '1h' });
    doctorToken = jwt.sign({ id: doctorUser.id }, secret, { expiresIn: '1h' });
    patientToken = jwt.sign({ id: patientUser.id }, secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    try {
      const userIds = [adminUser.id, doctorUser.id, patientUser.id];
      await prisma.digitalSignature.deleteMany({
        where: { prescription: { doctorId: { in: userIds } } },
      });
      await prisma.prescriptionItem.deleteMany({
        where: { prescription: { doctorId: { in: userIds } } },
      });
      await prisma.prescription.deleteMany({
        where: { doctorId: { in: userIds } },
      });
      await prisma.medicalRecord.deleteMany({
        where: { patientId: { in: userIds } },
      });
      await prisma.consultation.deleteMany({
        where: { OR: [{ doctorId: { in: userIds } }, { patientId: { in: userIds } }] },
      });
      await prisma.complianceViolation.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.securityAlert.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.consent.deleteMany({
        where: { patientId: { in: userIds } },
      });
      await prisma.erasureRequest.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    } catch (e) {
      console.warn('Teardown warning:', e);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. Rule Engine Definition & Mapping', () => {
    it('defines all 9 required rules with HIPAA and GDPR clauses and severity mappings', () => {
      const requiredRules: RuleId[] = [
        'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
        'BULK_RECORD_ACCESS',
        'OFF_HOURS_ACCESS',
        'REPEATED_FAILED_LOGINS',
        'PRESCRIPTION_EDITED_AFTER_SIGNING',
        'UNENCRYPTED_PHI_DETECTED',
        'CONSENT_MISSING',
        'DATA_EXPORT_WITHOUT_JUSTIFICATION',
        'AUDIT_CHAIN_BREAK',
      ];

      for (const ruleId of requiredRules) {
        const def = RULE_DEFINITIONS[ruleId];
        expect(def).toBeDefined();
        expect(def.ruleId).toBe(ruleId);
        expect(def.hipaaClause).toMatch(/HIPAA/);
        expect(def.gdprClause).toMatch(/GDPR/);
        expect(Object.values(Severity)).toContain(def.defaultSeverity);
      }
    });

    it('exposes rule definitions via GET /api/v1/compliance/rules', async () => {
      const res = await request(app)
        .get('/api/v1/compliance/rules')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(9);
      const ruleIds = res.body.map((r: any) => r.ruleId);
      expect(ruleIds).toContain('ACCESS_OUTSIDE_ROLE_ASSIGNMENT');
      expect(ruleIds).toContain('UNENCRYPTED_PHI_DETECTED');
      expect(ruleIds).toContain('AUDIT_CHAIN_BREAK');
    });
  });

  describe('2. Detection of All 9 Compliance Rules', () => {
    it('Rule 1: Detects ACCESS_OUTSIDE_ROLE_ASSIGNMENT and creates ComplianceViolation + SecurityAlert', async () => {
      const { violation, alert } = await rulesEngine.triggerViolation({
        ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
        userId: doctorUser.id,
        resource: 'Patient:unassigned-123',
        description: 'Doctor accessed unassigned patient record',
      });

      expect(violation.ruleId).toBe('ACCESS_OUTSIDE_ROLE_ASSIGNMENT');
      expect(violation.hipaaClause).toContain('HIPAA §164.312(a)(1)');
      expect(violation.gdprClause).toContain('GDPR Art. 5(1)(f)');
      expect(alert.severity).toBe(Severity.HIGH);
    });

    it('Rule 2: Detects BULK_RECORD_ACCESS when threshold is exceeded', async () => {
      const isBulk = await rulesEngine.trackRecordAccess(doctorUser.id, 25, '127.0.0.1', 'MedicalRecords:BulkExport');
      expect(isBulk).toBe(true);

      const violation = await prisma.complianceViolation.findFirst({
        where: { ruleId: 'BULK_RECORD_ACCESS', userId: doctorUser.id },
        orderBy: { reportedAt: 'desc' },
      });
      expect(violation).not.toBeNull();
      expect(violation?.hipaaClause).toContain('HIPAA §164.312(b)');
      expect(violation?.gdprClause).toContain('GDPR Art. 32(1)(d)');
    });

    it('Rule 3: Detects OFF_HOURS_ACCESS outside standard 07:00-20:00 schedule', async () => {
      // Midnight date
      const midnight = new Date('2026-10-08T02:30:00Z');
      expect(rulesEngine.isOffHours(midnight)).toBe(true);

      const { violation, alert } = await rulesEngine.triggerViolation({
        ruleId: 'OFF_HOURS_ACCESS',
        userId: doctorUser.id,
        resource: 'Consultation:Notes',
      });

      expect(violation.ruleId).toBe('OFF_HOURS_ACCESS');
      expect(violation.hipaaClause).toContain('HIPAA §164.308(a)(1)(ii)(D)');
      expect(alert.severity).toBe(Severity.MEDIUM);
    });

    it('Rule 4: Detects REPEATED_FAILED_LOGINS when failed attempts reach threshold', async () => {
      const testIdentifier = `target-victim-${Date.now()}@test.local`;
      await rulesEngine.recordFailedLogin(testIdentifier, '192.168.1.50');
      await rulesEngine.recordFailedLogin(testIdentifier, '192.168.1.50');
      const count = await rulesEngine.recordFailedLogin(testIdentifier, '192.168.1.50');

      expect(count).toBe(3);
      const violation = await prisma.complianceViolation.findFirst({
        where: { ruleId: 'REPEATED_FAILED_LOGINS', resource: `UserAuth:${testIdentifier}` },
      });
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe(Severity.HIGH);
      expect(violation?.hipaaClause).toContain('HIPAA §164.308(a)(5)(ii)(C)');
    });

    it('Rule 5: Detects PRESCRIPTION_EDITED_AFTER_SIGNING when modifying a signed prescription', async () => {
      // Create a test consultation and signed prescription
      const consult = await prisma.consultation.create({
        data: {
          patientId: patientUser.id,
          doctorId: doctorUser.id,
          scheduledAt: new Date(),
        },
      });

      const prescription = await prisma.prescription.create({
        data: {
          consultationId: consult.id,
          doctorId: doctorUser.id,
          items: {
            create: [{ medication: 'Amoxicillin', dosage: '500mg', instructions: 'Twice daily' }],
          },
          signature: {
            create: {
              signature: 'dummy-ed25519-sig-bytes',
              publicKey: 'dummy-public-key-hex-488392819',
              algorithm: 'Ed25519-SHA256',
            },
          },
        },
      });

      // Attempt to edit signed prescription via PUT /api/v1/prescriptions/:id
      const res = await request(app)
        .put(`/api/v1/prescriptions/${prescription.id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          items: [{ medication: 'Oxycodone', dosage: '80mg', instructions: 'Tampered' }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Integrity Violation');

      // Verify ComplianceViolation was created
      const violation = await prisma.complianceViolation.findFirst({
        where: { ruleId: 'PRESCRIPTION_EDITED_AFTER_SIGNING', resource: `Prescription:${prescription.id}` },
      });
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe(Severity.CRITICAL);
      expect(violation?.hipaaClause).toContain('HIPAA §164.312(c)(1)');
    });

    it('Rule 6: Detects UNENCRYPTED_PHI_DETECTED when raw SSN or medical diagnosis is present in payload', () => {
      const ssnCheck = rulesEngine.detectUnencryptedPhi({
        notes: 'Patient SSN is 123-45-6789 and needs urgent assistance',
      });
      expect(ssnCheck.detected).toBe(true);
      expect(ssnCheck.patternMatched).toContain('Social Security Number');

      const diagnosisCheck = rulesEngine.detectUnencryptedPhi({
        condition: 'Patient diagnosed with Stage IV cancer and severe hypertension',
      });
      expect(diagnosisCheck.detected).toBe(true);
      expect(diagnosisCheck.snippets).toContain('cancer');
      expect(diagnosisCheck.snippets).toContain('hypertension');
    });

    it('Rule 7: Detects CONSENT_MISSING when processing health data without valid GDPR consent', async () => {
      // Ensure patient has no consent
      await prisma.consent.deleteMany({ where: { patientId: patientUser.id } });

      const res = await request(app)
        .post('/api/v1/medical-records')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: patientUser.id,
          data: { diagnosis: 'Headache', notes: 'Mild' },
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('GDPR Compliance Error');

      const violation = await prisma.complianceViolation.findFirst({
        where: { ruleId: 'CONSENT_MISSING', resource: `Patient:${patientUser.id}` },
        orderBy: { reportedAt: 'desc' },
      });
      expect(violation).not.toBeNull();
      expect(violation?.gdprClause).toContain('GDPR Art. 6(1)(a) & Art. 9(2)(a)');
    });

    it('Rule 8: Detects DATA_EXPORT_WITHOUT_JUSTIFICATION when export justification is omitted', async () => {
      const res = await request(app)
        .post('/api/v1/gdpr/export')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          patientId: patientUser.id,
          justification: '', // Empty justification
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Valid legal or clinical justification is required');

      const violation = await prisma.complianceViolation.findFirst({
        where: { ruleId: 'DATA_EXPORT_WITHOUT_JUSTIFICATION', userId: patientUser.id },
        orderBy: { reportedAt: 'desc' },
      });
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe(Severity.HIGH);
      expect(violation?.gdprClause).toContain('GDPR Art. 20');
    });

    it('Rule 9: Detects AUDIT_CHAIN_BREAK and creates CRITICAL violation', async () => {
      const { violation, alert } = await rulesEngine.triggerViolation({
        ruleId: 'AUDIT_CHAIN_BREAK',
        description: 'Cryptographic hash chain broken at block #42',
        resource: 'AuditChain:Root',
      });

      expect(violation.ruleId).toBe('AUDIT_CHAIN_BREAK');
      expect(violation.severity).toBe(Severity.CRITICAL);
      expect(violation.hipaaClause).toContain('HIPAA §164.312(c)(2)');
      expect(violation.gdprClause).toContain('GDPR Art. 32(1)(b)');
      expect(alert.title).toContain('Audit Hash Chain Break');
    });
  });

  describe('3. GDPR Endpoints', () => {
    it('manages consent lifecycle: grant, check, and revoke', async () => {
      // 1. Grant consent
      const grantRes = await request(app)
        .post('/api/v1/gdpr/consent')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          purpose: 'TELEMEDICINE_TREATMENT',
          version: '2.0',
        });
      expect(grantRes.status).toBe(200);
      expect(grantRes.body.consent.granted).toBe(true);

      // 2. Check active consent
      const checkRes = await request(app)
        .get(`/api/v1/gdpr/consent/check/${patientUser.id}?purpose=TELEMEDICINE_TREATMENT`)
        .set('Authorization', `Bearer ${patientToken}`);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.hasActiveConsent).toBe(true);

      // 3. Revoke consent
      const revokeRes = await request(app)
        .post('/api/v1/gdpr/consent/revoke')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          purpose: 'TELEMEDICINE_TREATMENT',
        });
      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.consent.granted).toBe(false);

      // 4. Verify check is now false
      const checkRevoked = await gdprService.hasActiveConsent(patientUser.id, 'TELEMEDICINE_TREATMENT');
      expect(checkRevoked).toBe(false);
    });

    it('exports patient data with valid justification (GDPR Art. 20)', async () => {
      // Re-grant consent first
      await gdprService.grantConsent({
        patientId: patientUser.id,
        purpose: 'TELEMEDICINE_TREATMENT',
      });

      const res = await request(app)
        .post('/api/v1/gdpr/export')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          patientId: patientUser.id,
          justification: 'Patient relocating to new healthcare provider (GDPR Art. 20 portability request)',
        });

      expect(res.status).toBe(200);
      expect(res.body.checksumSha256).toBeDefined();
      expect(res.body.data.patientProfile.id).toBe(patientUser.id);
      expect(res.body.data.exportMetadata.justification).toContain('Patient relocating');
    });

    it('executes Right-to-Erasure via crypto-shredding of per-record keys (GDPR Art. 17)', async () => {
      // Create a dummy record with encrypted DEK for the patient
      const { encryptedDek, dekIv, dekAuthTag, ciphertext, iv, authTag } = encryptDataEnvelope('Secret Diagnosis');
      const rec = await prisma.medicalRecord.create({
        data: {
          patientId: patientUser.id,
          encryptedData: ciphertext,
          dataIv: iv,
          dataAuthTag: authTag,
          encryptedDek,
          dekIv,
          dekAuthTag,
        },
      });

      // Request erasure
      const res = await request(app)
        .post('/api/v1/gdpr/erasure')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          patientId: patientUser.id,
          reason: 'Patient exercised GDPR Right to Erasure',
          confirmShred: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.recordsShredded).toBeGreaterThanOrEqual(1);

      // Verify the record's encryption keys and data were crypto-shredded
      const shreddedRec = await prisma.medicalRecord.findUnique({ where: { id: rec.id } });
      expect(shreddedRec?.encryptedData).toBe('[CRYPTO_SHREDDED_GDPR_ART_17]');
      expect(shreddedRec?.encryptedDek).toMatch(/^0+$/);

      // Verify ErasureRequest entry exists
      const erasureLog = await prisma.erasureRequest.findFirst({
        where: { userId: patientUser.id },
      });
      expect(erasureLog).not.toBeNull();
      expect(erasureLog?.status).toBe('COMPLETED');
    });
  });

  describe('4. Compliance Violations & Alerts Admin API', () => {
    it('retrieves compliance violations and resolves an alert', async () => {
      const listRes = await request(app)
        .get('/api/v1/compliance/violations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBeGreaterThan(0);

      const targetId = listRes.body[0].id;
      const resolveRes = await request(app)
        .post(`/api/v1/compliance/violations/${targetId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.violation.resolved).toBe(true);
    });

    it('simulates a rule trigger on-demand via POST /api/v1/compliance/simulate', async () => {
      const res = await request(app)
        .post('/api/v1/compliance/simulate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ruleId: 'UNENCRYPTED_PHI_DETECTED',
          customDescription: 'Simulated live security alert test from dashboard',
        });

      expect(res.status).toBe(200);
      expect(res.body.violation.ruleId).toBe('UNENCRYPTED_PHI_DETECTED');
      expect(res.body.alert.severity).toBe(Severity.CRITICAL);
    });
  });
});
