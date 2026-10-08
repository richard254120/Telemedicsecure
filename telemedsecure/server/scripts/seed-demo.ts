import { PrismaClient, Role, PrescriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  generateDoctorEd25519Keys,
  decryptDoctorPrivateKey,
  signPrescriptionCanonical,
  canonicalJson,
  encryptDataEnvelope
} from '../src/utils/crypto';
import {
  createChainedAuditEvent,
  backfillChainIfEmpty,
  anchorAuditEventsNow
} from '../src/services/audit.service';

const prisma = new PrismaClient();

async function seedDemo() {
  console.log('🚀 [TeleMedSecure] Starting Full End-to-End Demo Environment Seeding...');
  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Create or Update Demo Users
  console.log('👤 Seeding standard demo accounts across all 4 roles...');
  
  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@telemed.com' },
    update: { passwordHash, isActive: true, failedAttempts: 0, lockedUntil: null },
    create: {
      email: 'admin@telemed.com',
      passwordHash,
      role: Role.ADMIN,
      firstName: 'Chief Security',
      lastName: 'Officer'
    }
  });

  // Doctor with Ed25519 Keys
  const ed25519Keys = generateDoctorEd25519Keys(defaultPassword);
  const doctor = await prisma.user.upsert({
    where: { email: 'doctor1@telemed.com' },
    update: {
      passwordHash,
      isActive: true,
      failedAttempts: 0,
      lockedUntil: null,
      doctorPublicKey: ed25519Keys.publicKey,
      doctorEncryptedPrivKey: ed25519Keys.encryptedPrivateKey,
      doctorKeyDerivationSalt: ed25519Keys.salt,
      doctorKeyIv: ed25519Keys.iv,
      doctorKeyAuthTag: ed25519Keys.authTag
    },
    create: {
      email: 'doctor1@telemed.com',
      passwordHash,
      role: Role.DOCTOR,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      doctorPublicKey: ed25519Keys.publicKey,
      doctorEncryptedPrivKey: ed25519Keys.encryptedPrivateKey,
      doctorKeyDerivationSalt: ed25519Keys.salt,
      doctorKeyIv: ed25519Keys.iv,
      doctorKeyAuthTag: ed25519Keys.authTag
    }
  });

  // Patient
  const patient = await prisma.user.upsert({
    where: { email: 'patient1@telemed.com' },
    update: { passwordHash, isActive: true, failedAttempts: 0, lockedUntil: null },
    create: {
      email: 'patient1@telemed.com',
      passwordHash,
      role: Role.PATIENT,
      firstName: 'Alice',
      lastName: 'Smith'
    }
  });

  // Nurse
  const nurse = await prisma.user.upsert({
    where: { email: 'nurse1@telemed.com' },
    update: { passwordHash, isActive: true, failedAttempts: 0, lockedUntil: null },
    create: {
      email: 'nurse1@telemed.com',
      passwordHash,
      role: Role.NURSE,
      firstName: 'Mary',
      lastName: 'Johnson'
    }
  });

  console.log('   ✅ Admin:   admin@telemed.com   / Password123!');
  console.log('   ✅ Doctor:  doctor1@telemed.com / Password123! (Ed25519 Registered)');
  console.log('   ✅ Patient: patient1@telemed.com/ Password123!');
  console.log('   ✅ Nurse:   nurse1@telemed.com  / Password123!');

  // 2. Grant GDPR Consents for Patient
  console.log('📜 Granting patient GDPR consents (Art. 6 & 9)...');
  const consents = ['TELEMEDICINE_TREATMENT', 'E_PRESCRIBING', 'DATA_SHARING'];
  for (const purpose of consents) {
    const existing = await prisma.consent.findFirst({
      where: { patientId: patient.id, purpose }
    });
    if (existing) {
      await prisma.consent.update({
        where: { id: existing.id },
        data: { granted: true }
      });
    } else {
      await prisma.consent.create({
        data: { patientId: patient.id, purpose, granted: true }
      });
    }
  }

  // 3. Create Demo Consultation Room (demo-123)
  console.log('🩺 Seeding consultation room demo-123...');
  const consultation = await prisma.consultation.upsert({
    where: { id: 'demo-123' },
    update: {
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: new Date(),
      status: 'SCHEDULED'
    },
    create: {
      id: 'demo-123',
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: new Date(),
      status: 'SCHEDULED'
    }
  });

  // 4. Envelope Encrypt Consultation Notes
  console.log('🔐 Envelope-encrypting clinical consultation notes (AES-256-GCM + DEK)...');
  const clinicalNotesText = 'Patient presents with intermittent chest tightness and hypertension. Recommended ACE inhibitor therapy and sodium restriction.';
  const notesEnc = encryptDataEnvelope(clinicalNotesText);

  await prisma.consultation.update({
    where: { id: consultation.id },
    data: {
      encryptedNotes: notesEnc.ciphertext,
      notesIv: notesEnc.iv,
      notesAuthTag: notesEnc.authTag,
      encryptedDek: notesEnc.encryptedDek,
      dekIv: notesEnc.dekIv,
      dekAuthTag: notesEnc.dekAuthTag
    }
  });

  // 5. Envelope Encrypt Vitals with Clinical Flags
  console.log('❤️  Capturing envelope-encrypted vitals & triggering clinical flags...');
  const vitalsData = { bpSystolic: 148, bpDiastolic: 94, heartRate: 104, temp: 37.1, spO2: 91 };
  const vitalsEnc = encryptDataEnvelope(JSON.stringify(vitalsData));

  const vitalRecord = await prisma.vitalSign.create({
    data: {
      consultationId: consultation.id,
      encryptedVitals: vitalsEnc.ciphertext,
      vitalsIv: vitalsEnc.iv,
      vitalsAuthTag: vitalsEnc.authTag,
      encryptedDek: vitalsEnc.encryptedDek,
      dekIv: vitalsEnc.dekIv,
      dekAuthTag: vitalsEnc.dekAuthTag
    }
  });

  await prisma.clinicalFlag.create({
    data: {
      consultationId: consultation.id,
      patientId: patient.id,
      flagType: 'ABNORMAL_VITALS',
      description: 'Hypertension (148/94 mmHg), Tachycardia (104 bpm), Hypoxia (91% SpO2)',
      severity: 'HIGH'
    }
  });

  // 6. Issue DEA EPCS Digitally Signed Prescription
  console.log('✍️  Issuing Ed25519 digitally signed prescription...');
  const prescription = await prisma.prescription.create({
    data: {
      consultationId: consultation.id,
      doctorId: doctor.id,
      status: PrescriptionStatus.ISSUED,
      items: {
        create: [
          {
            medication: 'Lisinopril',
            dosage: '10mg',
            instructions: 'Take 1 tablet daily by mouth in the morning'
          },
          {
            medication: 'Atorvastatin',
            dosage: '20mg',
            instructions: 'Take 1 tablet daily at bedtime'
          }
        ]
      }
    },
    include: { items: true }
  });

  // Sign canonical JSON
  const canonical = canonicalJson({
    id: prescription.id,
    consultationId: prescription.consultationId,
    doctorId: prescription.doctorId,
    items: prescription.items.map(it => ({
      id: it.id,
      medication: it.medication,
      dosage: it.dosage,
      instructions: it.instructions
    })),
    createdAt: prescription.createdAt.toISOString()
  });

  const decryptedPrivKey = decryptDoctorPrivateKey(
    doctor.doctorEncryptedPrivKey!,
    doctor.doctorKeyDerivationSalt!,
    doctor.doctorKeyIv!,
    doctor.doctorKeyAuthTag!,
    defaultPassword
  );

  const { signatureHex, canonicalHashHex } = signPrescriptionCanonical(decryptedPrivKey, canonical);

  await prisma.digitalSignature.create({
    data: {
      prescriptionId: prescription.id,
      signature: signatureHex,
      publicKey: doctor.doctorPublicKey!,
      canonicalHash: canonicalHashHex,
      algorithm: 'Ed25519-SHA256'
    }
  });

  // 7. Generate Audit Events & Anchor to Hardhat Blockchain
  console.log('⛓️  Chaining audit events and anchoring Merkle root onto Hardhat blockchain...');
  await createChainedAuditEvent({
    action: 'DEMO_SEED_INIT',
    resource: 'System:Bootstrap',
    userId: admin.id
  });

  await createChainedAuditEvent({
    action: 'ISSUE_PRESCRIPTION',
    resource: `Prescription:${prescription.id}`,
    userId: doctor.id
  });

  await createChainedAuditEvent({
    action: 'RECORD_VITALS',
    resource: `VitalSign:${vitalRecord.id}`,
    userId: nurse.id
  });

  await backfillChainIfEmpty();
  const anchor = await anchorAuditEventsNow();

  if (anchor) {
    console.log(`   🔗 Hardhat Merkle Anchor Root: ${anchor.merkleRoot}`);
    console.log(`   🔗 Ethereum Transaction Hash: ${anchor.txHash}`);
  }

  // 8. Create a Demo Incident for the Investigation Tool
  console.log('🚨 Registering pending incident for Forensic Investigation Studio...');
  await prisma.incident.create({
    data: {
      title: 'Suspicious Off-Hours Access Attempt',
      description: 'Multiple unassigned clinical chart accesses detected outside operating hours from unknown IP range.',
      severity: 'HIGH',
      status: 'OPEN',
      openedBy: admin.id
    }
  });

  console.log('\n=============================================================');
  console.log('🎉 [TeleMedSecure] Demo Environment Successfully Initialized!');
  console.log('=============================================================');
  console.log('🌐 Web Application:       http://localhost:5173');
  console.log('🩺 Doctor Dashboard:      http://localhost:5173/doctor');
  console.log('👤 Patient Portal:        http://localhost:5173/patient');
  console.log('🩹 Nursing Station:       http://localhost:5173/nurse');
  console.log('🛡️ Admin & Compliance:   http://localhost:5173/admin');
  console.log('🔍 Forensics Studio:      http://localhost:5173/investigation');
  console.log('📜 Report Verifier:       http://localhost:5173/investigation/verify');
  console.log('=============================================================\n');
}

seedDemo()
  .catch((e) => {
    console.error('❌ Demo seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
