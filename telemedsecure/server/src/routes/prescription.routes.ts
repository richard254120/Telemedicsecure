import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, Role, PrescriptionStatus } from '@prisma/client';
import argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  canonicalJson,
  generateDoctorEd25519Keys,
  decryptDoctorPrivateKey,
  signPrescriptionCanonical,
  verifyPrescriptionCanonical
} from '../utils/crypto';
import { createChainedAuditEvent } from '../services/audit.service';
import { rulesEngine } from '../services/rulesEngine.service';

const router = Router();
const prisma = new PrismaClient();

// Optional auth middleware for verification endpoint (accessible to patients, pharmacists, or public scanner)
const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (user && user.isActive) {
        (req as any).user = user;
      }
    }
  } catch {
    // Non-fatal for optional auth
  }
  next();
};

// Helper: verify doctor password against Argon2 or Bcrypt hash
async function verifyDoctorPassword(hash: string, password: string): Promise<boolean> {
  try {
    if (hash.startsWith('$argon2')) {
      return await argon2.verify(hash, password);
    }
  } catch {}
  try {
    return await bcrypt.compare(password, hash);
  } catch {}
  return false;
}

// Build canonical payload for signing and verification
function buildCanonicalPayload(prescription: {
  id: string;
  consultationId: string;
  doctorId: string;
  items: Array<{ id: string; medication: string; dosage: string; instructions: string }>;
  createdAt: Date;
}): string {
  return canonicalJson({
    id: prescription.id,
    consultationId: prescription.consultationId,
    doctorId: prescription.doctorId,
    items: prescription.items.map(it => ({
      dosage: it.dosage,
      id: it.id,
      instructions: it.instructions,
      medication: it.medication
    })),
    createdAt: prescription.createdAt.toISOString()
  });
}

// ==========================================
// 1. VERIFY ENDPOINT (Public / Patient / Pharmacist)
// ==========================================
router.get('/:id/verify', optionalAuth, async (req: Request, res: Response) => {
  try {
    const prescriptionId = String(req.params.id);

    const prescription: any = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        items: true,
        signature: true,
        doctor: { select: { id: true, firstName: true, lastName: true, email: true, doctorPublicKey: true } },
        consultation: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      }
    });

    if (!prescription || !prescription.signature) {
      return res.status(404).json({
        error: 'Prescription or digital signature not found',
        isValid: false,
        status: 'TAMPERED'
      });
    }

    // Reconstruct canonical data from existing DB records
    const canonicalPayload = buildCanonicalPayload(prescription);

    // Verify Ed25519 signature over SHA-256 of canonical data
    const { isValid, computedHash } = verifyPrescriptionCanonical(
      prescription.signature.publicKey,
      canonicalPayload,
      prescription.signature.signature
    );

    // Audit log verification event
    const callerId = (req as any).user?.id || null;
    await createChainedAuditEvent({
      action: 'VERIFY_PRESCRIPTION',
      resource: `Prescription:${prescriptionId}`,
      userId: callerId,
      ipAddress: req.ip || 'unknown',
      userAgent: (req.headers['user-agent'] as string) || 'unknown'
    });

    res.json({
      prescriptionId: prescription.id,
      isValid,
      status: isValid ? 'VALID' : 'TAMPERED',
      lifecycleStatus: prescription.status,
      statusReason: prescription.statusReason,
      canonicalHash: prescription.signature.canonicalHash,
      computedHash,
      doctor: {
        id: prescription.doctor.id,
        name: `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`,
        email: prescription.doctor.email
      },
      patient: {
        id: prescription.consultation?.patient?.id,
        name: prescription.consultation?.patient
          ? `${prescription.consultation.patient.firstName} ${prescription.consultation.patient.lastName}`
          : 'Unknown Patient',
        email: prescription.consultation?.patient?.email
      },
      items: prescription.items,
      signature: {
        id: prescription.signature.id,
        algorithm: prescription.signature.algorithm,
        signature: prescription.signature.signature,
        publicKey: prescription.signature.publicKey,
        createdAt: prescription.signature.createdAt
      },
      canonicalPayload,
      issuedAt: prescription.createdAt,
      updatedAt: prescription.updatedAt
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
});

// All subsequent routes require authentication
router.use(requireAuth);

// ==========================================
// 2. METADATA: Doctors, Patients, Consultations
// ==========================================
router.get('/meta/context', async (req: Request, res: Response) => {
  try {
    const patients = await prisma.user.findMany({
      where: { role: Role.PATIENT },
      select: { id: true, firstName: true, lastName: true, email: true }
    });
    const consultations = await prisma.consultation.findMany({
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json({ patients, consultations });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch metadata', details: err.message });
  }
});

// ==========================================
// 3. LIST PRESCRIPTIONS
// ==========================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let whereClause: any = {};

    if (user.role === Role.DOCTOR) {
      whereClause = { doctorId: user.id };
    } else if (user.role === Role.PATIENT) {
      whereClause = { consultation: { patientId: user.id } };
    }
    // NURSE and ADMIN see all

    const prescriptions = await prisma.prescription.findMany({
      where: whereClause,
      include: {
        items: true,
        signature: true,
        doctor: { select: { id: true, firstName: true, lastName: true, email: true } },
        consultation: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(prescriptions);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve prescriptions', details: err.message });
  }
});

// ==========================================
// 3.5. PRESCRIPTION AUDIT MODULE (Admin / Doctor)
// ==========================================
router.get('/audit/all', requireRole([Role.ADMIN, Role.DOCTOR]), async (req: Request, res: Response) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      include: {
        items: true,
        signature: true,
        doctor: { select: { id: true, firstName: true, lastName: true, email: true, doctorPublicKey: true } },
        consultation: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const audited = await Promise.all(
      prescriptions.map(async (rx: any) => {
        const auditHistory = await prisma.auditEvent.findMany({
          where: { resource: `Prescription:${rx.id}` },
          orderBy: { timestamp: 'asc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }
          }
        });

        let signatureStatus: 'VALID' | 'TAMPERED' = 'TAMPERED';
        let canonicalHash = '';
        if (rx.signature && rx.doctor.doctorPublicKey) {
          try {
            const canonical = buildCanonicalPayload(rx);
            canonicalHash = crypto.createHash('sha256').update(canonical).digest('hex');
            const valid = verifyPrescriptionCanonical(canonical, rx.signature.signature, rx.doctor.doctorPublicKey);
            signatureStatus = valid ? 'VALID' : 'TAMPERED';
          } catch {
            signatureStatus = 'TAMPERED';
          }
        }

        return {
          ...rx,
          signatureStatus,
          canonicalHash,
          auditHistory
        };
      })
    );

    res.json(audited);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to perform prescription audit', details: err.message });
  }
});

// ==========================================
// 4. GET SINGLE PRESCRIPTION
// ==========================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prescriptionId = String(req.params.id);
    const user = (req as any).user;

    const prescription: any = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        items: true,
        signature: true,
        doctor: { select: { id: true, firstName: true, lastName: true, email: true } },
        consultation: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      }
    });

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    // Role check: Patient can only view own, Doctor assigned
    if (user.role === Role.PATIENT && prescription.consultation?.patientId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(prescription);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve prescription', details: err.message });
  }
});

// ==========================================
// 5. ISSUE PRESCRIPTION (Doctor only)
// ==========================================
router.post('/', requireRole([Role.DOCTOR]), async (req: Request, res: Response) => {
  try {
    const { consultationId, patientId, items, password } = req.body;
    const doctorUser = (req as any).user;

    if (!password) {
      return res.status(400).json({
        error: 'Doctor password is required to decrypt/derive Ed25519 cryptographic signing key'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one prescription item is required' });
    }

    // 1. Verify doctor password
    const passwordValid = await verifyDoctorPassword(doctorUser.passwordHash, password);
    if (!passwordValid) {
      await createChainedAuditEvent({
        action: 'SIGNING_AUTH_FAILURE',
        resource: `Doctor:${doctorUser.id}`,
        userId: doctorUser.id,
        ipAddress: req.ip || 'unknown',
        userAgent: (req.headers['user-agent'] as string) || 'unknown'
      });
      return res.status(401).json({ error: 'Invalid doctor password. Cannot unlock Ed25519 signing key.' });
    }

    // 2. Fetch or create doctor's Ed25519 keypair
    let privateKeyObj;
    let publicKeyPem = doctorUser.doctorPublicKey;

    if (!doctorUser.doctorEncryptedPrivKey || !doctorUser.doctorKeyDerivationSalt) {
      // Keypair generation per doctor (private key encrypted with doctor password-derived key)
      const generated = generateDoctorEd25519Keys(password);
      await prisma.user.update({
        where: { id: doctorUser.id },
        data: {
          doctorPublicKey: generated.publicKey,
          doctorEncryptedPrivKey: generated.encryptedPrivateKey,
          doctorKeyDerivationSalt: generated.salt,
          doctorKeyIv: generated.iv,
          doctorKeyAuthTag: generated.authTag
        }
      });
      publicKeyPem = generated.publicKey;
      privateKeyObj = decryptDoctorPrivateKey(
        generated.encryptedPrivateKey,
        generated.salt,
        generated.iv,
        generated.authTag,
        password
      );
    } else {
      // Decrypt private key using password-derived key
      privateKeyObj = decryptDoctorPrivateKey(
        doctorUser.doctorEncryptedPrivKey,
        doctorUser.doctorKeyDerivationSalt,
        doctorUser.doctorKeyIv,
        doctorUser.doctorKeyAuthTag,
        password
      );
    }

    // 3. Resolve or create consultation link
    let resolvedConsultationId = consultationId;
    if (!resolvedConsultationId) {
      // Auto-link to existing consultation or create one if patientId provided
      let targetPatientId = patientId;
      if (!targetPatientId) {
        const firstPatient = await prisma.user.findFirst({ where: { role: Role.PATIENT } });
        targetPatientId = firstPatient?.id;
      }

      if (!targetPatientId) {
        return res.status(400).json({ error: 'No patient found to link consultation' });
      }

      const consultation = await prisma.consultation.create({
        data: {
          doctorId: doctorUser.id,
          patientId: targetPatientId,
          scheduledAt: new Date()
        }
      });
      resolvedConsultationId = consultation.id;
    }

    // 4. Create prescription and prescription items in DB
    const prescription = await prisma.prescription.create({
      data: {
        consultationId: resolvedConsultationId,
        doctorId: doctorUser.id,
        status: PrescriptionStatus.ISSUED,
        items: {
          create: items.map((it: any) => ({
            medication: String(it.medication).trim(),
            dosage: String(it.dosage).trim(),
            instructions: String(it.instructions || '').trim()
          }))
        }
      },
      include: {
        items: true,
        consultation: { include: { patient: true } }
      }
    });

    // 5. Construct canonical JSON representation
    const canonicalPayload = buildCanonicalPayload(prescription);

    // 6. Sign SHA-256 of canonical JSON with Ed25519 private key
    const { signatureHex, canonicalHashHex } = signPrescriptionCanonical(privateKeyObj, canonicalPayload);

    // 7. Store Signature record
    const digitalSignature = await prisma.digitalSignature.create({
      data: {
        prescriptionId: prescription.id,
        signature: signatureHex,
        publicKey: publicKeyPem,
        canonicalHash: canonicalHashHex,
        algorithm: 'Ed25519-SHA256'
      }
    });

    // 8. Create AuditEvent for state change
    await createChainedAuditEvent({
      action: 'ISSUE_PRESCRIPTION',
      resource: `Prescription:${prescription.id}`,
      userId: doctorUser.id,
      ipAddress: req.ip || 'unknown',
      userAgent: (req.headers['user-agent'] as string) || 'unknown'
    });

    res.status(201).json({
      message: 'Prescription issued and cryptographically signed with Ed25519',
      prescription: {
        ...prescription,
        signature: digitalSignature
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to issue prescription', details: err.message });
  }
});

// ==========================================
// 6. DISPENSE PRESCRIPTION (Pharmacist/Doctor/Nurse/Admin)
// ==========================================
router.post('/:id/dispense', requireRole([Role.DOCTOR, Role.NURSE, Role.ADMIN]), async (req: Request, res: Response) => {
  try {
    const prescriptionId = String(req.params.id);
    const user = (req as any).user;
    const { pharmacyNotes } = req.body;

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId }
    });

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    if (prescription.status === PrescriptionStatus.REVOKED) {
      return res.status(400).json({ error: 'Cannot dispense a revoked prescription' });
    }

    if (prescription.status === PrescriptionStatus.DISPENSED) {
      return res.status(400).json({ error: 'Prescription has already been dispensed' });
    }

    const updated = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: PrescriptionStatus.DISPENSED,
        statusReason: pharmacyNotes || 'Dispensed by pharmacy'
      },
      include: { items: true, signature: true }
    });

    // Audit log state change
    await createChainedAuditEvent({
      action: 'DISPENSE_PRESCRIPTION',
      resource: `Prescription:${prescriptionId}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
      userAgent: (req.headers['user-agent'] as string) || 'unknown'
    });

    res.json({
      message: 'Prescription successfully marked as DISPENSED',
      prescription: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to dispense prescription', details: err.message });
  }
});

// ==========================================
// 7. REVOKE PRESCRIPTION (Doctor / Admin)
// ==========================================
router.post('/:id/revoke', requireRole([Role.DOCTOR, Role.ADMIN]), async (req: Request, res: Response) => {
  try {
    const prescriptionId = String(req.params.id);
    const user = (req as any).user;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Revocation reason is required' });
    }

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId }
    });

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    if (prescription.status === PrescriptionStatus.REVOKED) {
      return res.status(400).json({ error: 'Prescription is already revoked' });
    }

    // Doctor can only revoke prescriptions they issued
    if (user.role === Role.DOCTOR && prescription.doctorId !== user.id) {
      return res.status(403).json({ error: 'You can only revoke prescriptions you issued' });
    }

    const updated = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: PrescriptionStatus.REVOKED,
        statusReason: reason
      },
      include: { items: true, signature: true }
    });

    // Audit log state change
    await createChainedAuditEvent({
      action: 'REVOKE_PRESCRIPTION',
      resource: `Prescription:${prescriptionId}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
      userAgent: (req.headers['user-agent'] as string) || 'unknown'
    });

    res.json({
      message: 'Prescription successfully REVOKED',
      prescription: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to revoke prescription', details: err.message });
  }
});

// ==========================================
// 7.5. EDIT / UPDATE PRESCRIPTION (Detects modification after signing)
// ==========================================
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const prescriptionId = String(req.params.id);
    const user = (req as any).user;
    const { items, statusReason } = req.body;

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { signature: true, items: true },
    });

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    // Rule Check: Attempt to edit prescription after digital signature was created
    if (prescription.signature) {
      await rulesEngine.triggerViolation({
        ruleId: 'PRESCRIPTION_EDITED_AFTER_SIGNING',
        description: `Attempted modification of Prescription:${prescriptionId} which is already cryptographically signed by Dr. Key ${prescription.signature.publicKey.slice(0, 16)}...`,
        userId: user?.id || null,
        sourceIp: req.ip || 'unknown',
        resource: `Prescription:${prescriptionId}`,
        metadata: {
          prescriptionId,
          existingSignatureId: prescription.signature.id,
          attemptedItems: items,
        },
      });

      return res.status(409).json({
        error: 'Integrity Violation: This prescription has been digitally signed and cannot be modified. Any changes violate HIPAA §164.312(c)(1) and GDPR Art. 5(1)(f). Revoke and issue a new prescription instead.',
        prescriptionId,
        signedAt: prescription.signature.createdAt,
      });
    }

    // If unsigned, update items
    if (items && Array.isArray(items)) {
      await prisma.prescriptionItem.deleteMany({ where: { prescriptionId } });
      await prisma.prescriptionItem.createMany({
        data: items.map((it: any) => ({
          prescriptionId,
          medication: it.medication,
          dosage: it.dosage,
          instructions: it.instructions,
        })),
      });
    }

    const updated = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { items: true },
    });

    res.json({ message: 'Prescription updated successfully', prescription: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update prescription', details: err.message });
  }
});

// ==========================================
// 8. TEST / DEMO: TAMPER WITH PRESCRIPTION ITEM
// ==========================================
router.post('/:id/tamper', async (req: Request, res: Response) => {
  try {
    const prescriptionId = String(req.params.id);
    const user = (req as any).user;

    const item = await prisma.prescriptionItem.findFirst({
      where: { prescriptionId }
    });

    if (!item) {
      return res.status(404).json({ error: 'No prescription items found to tamper with' });
    }

    // Tamper with dosage directly in DB
    const tamperedItem = await prisma.prescriptionItem.update({
      where: { id: item.id },
      data: {
        dosage: `${item.dosage} [ALTERED_UNAUTHORIZED_500mg]`
      }
    });

    await createChainedAuditEvent({
      action: 'SIMULATE_TAMPER',
      resource: `Prescription:${prescriptionId}`,
      userId: user?.id || null,
      ipAddress: req.ip || 'unknown',
      userAgent: (req.headers['user-agent'] as string) || 'unknown'
    });

    res.json({
      message: 'Tampering simulated: Prescription item dosage was modified directly in database. Cryptographic verification will now fail (TAMPERED).',
      tamperedItem
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to simulate tamper', details: err.message });
  }
});

export default router;
