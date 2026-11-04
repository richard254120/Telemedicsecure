import { PrismaClient, Role, VerificationStatus, CareTeamRole, CareTeamStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Keep clinicians' panels intact once per-doctor/per-nurse data isolation is
 * enforced. For every existing consultation we make the attending doctor an
 * ACTIVE DOCTOR care-team member of the patient. Idempotent: relies on the
 * @@unique([patientId, clinicianId]) upsert, so re-running on boot is safe and
 * never overwrites manual/administrative changes to membership status.
 */
async function syncCareTeamFromConsultations() {
  const consults = await prisma.consultation.findMany({
    select: { patientId: true, doctorId: true },
    distinct: ['patientId', 'doctorId'],
  });

  let created = 0;
  for (const c of consults) {
    if (!c.doctorId) continue;
    const existing = await prisma.careTeamMembership.findUnique({
      where: { patientId_clinicianId: { patientId: c.patientId, clinicianId: c.doctorId } },
    });
    if (existing) continue;
    await prisma.careTeamMembership.create({
      data: {
        patientId: c.patientId,
        clinicianId: c.doctorId,
        role: CareTeamRole.DOCTOR,
        status: CareTeamStatus.ACTIVE,
        source: 'CONSULTATION',
      },
    });
    created++;
  }
  if (created > 0) console.log(`CareTeam: derived ${created} doctor membership(s) from existing consultations.`);
}

// This seed is executed on every boot by scripts/start.js (`prisma db seed`), so
// it must be non-destructive. The previous revision wrote `passwordHash`,
// `isActive`, `failedAttempts` and `lockedUntil` in every upsert's update branch,
// which meant a single redeploy restored the published demo password, re-activated
// accounts an administrator had suspended, and cleared lockouts.
// SEED_FORCE_RESET=true restores the old overwrite behaviour for local recovery.
const RESET_EXISTING = process.env.SEED_FORCE_RESET === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// README.md / DEPLOYMENT.md publish `Password123!` for the demo roster, so those
// identities must never be created on a deployed system.
const SEED_DEMO_USERS = !IS_PRODUCTION || process.env.SEED_DEMO_DATA === 'true';

async function main() {
  const passwordHash = await argon2.hash('Password123!');

    // Seed Admin from env variables
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@telemed.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    if (IS_PRODUCTION && !process.env.ADMIN_PASSWORD) {
      // Bootstrapping a new admin without a real secret is refused, but a
      // re-run (build/startup/hooks) against a database that already has the
      // admin must not fail the whole deploy over it.
      const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (existingAdmin) {
        console.warn(`WARNING: ADMIN_PASSWORD is not set, but administrator ${adminEmail} already exists. Leaving the stored credentials untouched.`);
        if (!SEED_DEMO_USERS) {
          console.log('Seeding skipped: administrator already provisioned (production).');
          return;
        }
      } else {
        throw new Error('Refusing to bootstrap an administrator with the built-in default password. Set ADMIN_PASSWORD (and ADMIN_EMAIL) in the deployment environment.');
      }
    } else {
      const adminPasswordHash = await argon2.hash(adminPassword);
      await prisma.user.upsert({
        where: { email: adminEmail },
        update: RESET_EXISTING ? {
          passwordHash: adminPasswordHash,
          isActive: true,
          failedAttempts: 0,
          lockedUntil: null,
          verificationStatus: VerificationStatus.VERIFIED,
          mustChangePassword: true
        } : {},
        create: {
          email: adminEmail,
          passwordHash: adminPasswordHash,
          role: Role.ADMIN,
          firstName: 'Chief',
          lastName: 'Administrator',
          isActive: true,
          verificationStatus: VerificationStatus.VERIFIED,
          mustChangePassword: true,
          verifiedAt: new Date()
        }
      });
    }

  // Always reconcile care-team memberships from existing consultations so
  // clinicians do not lose panel access to patients they already treat once
  // per-clinician data isolation goes live.
  await syncCareTeamFromConsultations();

  if (!SEED_DEMO_USERS) {
    console.log('Seeding completed: administrator bootstrapped, demo roster skipped (production).');
    return;
  }

  // Seed Doctors
  const doctors = [
    { email: 'doctor@telemed.com', firstName: 'Sarah', lastName: 'Mitchell', license: 'NPI-1928301948', spec: 'Cardiology' },
    { email: 'doctor1@telemed.com', firstName: 'John', lastName: 'Doe', license: 'NPI-1029384756', spec: 'Internal Medicine' },
    { email: 'doctor2@telemed.com', firstName: 'Jane', lastName: 'Smith', license: 'NPI-5647382910', spec: 'Family Medicine' }
  ];

  for (const doc of doctors) {
    await prisma.user.upsert({
      where: { email: doc.email },
      update: RESET_EXISTING ? {
        passwordHash,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: doc.license,
        licenseJurisdiction: 'US-NPI',
        specialty: doc.spec
      } : {},
      create: {
        email: doc.email,
        passwordHash,
        role: Role.DOCTOR,
        firstName: doc.firstName,
        lastName: doc.lastName,
        isActive: true,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: doc.license,
        licenseJurisdiction: 'US-NPI',
        specialty: doc.spec,
        verifiedAt: new Date()
      },
    });
  }

  // Seed Nurses
  const nurses = [
    { email: 'nurse@telemed.com', firstName: 'Elena', lastName: 'Rostova', license: 'RN-44910284', spec: 'Triage & Critical Care' },
    { email: 'nurse1@telemed.com', firstName: 'Mary', lastName: 'Johnson', license: 'RN-88192031', spec: 'General Nursing' }
  ];

  for (const n of nurses) {
    await prisma.user.upsert({
      where: { email: n.email },
      update: RESET_EXISTING ? {
        passwordHash,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: n.license,
        licenseJurisdiction: 'US-RN',
        specialty: n.spec
      } : {},
      create: {
        email: n.email,
        passwordHash,
        role: Role.NURSE,
        firstName: n.firstName,
        lastName: n.lastName,
        isActive: true,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: n.license,
        licenseJurisdiction: 'US-RN',
        specialty: n.spec,
        verifiedAt: new Date()
      },
    });
  }

  // Seed Patients
  const patients = [
    { email: 'patient@telemed.com', firstName: 'Alex', lastName: 'Rivera' },
    { email: 'patient1@telemed.com', firstName: 'Patient', lastName: 'One' },
    { email: 'patient2@telemed.com', firstName: 'Patient', lastName: 'Two' },
    { email: 'patient3@telemed.com', firstName: 'Patient', lastName: 'Three' }
  ];

  for (const p of patients) {
    await prisma.user.upsert({
      where: { email: p.email },
      update: RESET_EXISTING ? {
        passwordHash,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        verificationStatus: VerificationStatus.VERIFIED
      } : {},
      create: {
        email: p.email,
        passwordHash,
        role: Role.PATIENT,
        firstName: p.firstName,
        lastName: p.lastName,
        isActive: true,
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: new Date()
      },
    });
  }

  // Seed Allied Healthcare & Clinical Stations Staff
  const clinicalStaff = [
    { email: 'pharmacist@telemed.com', role: Role.PHARMACIST, firstName: 'Marcus', lastName: 'Vance', license: 'RPH-99214', spec: 'Clinical Pharmacy' },
    { email: 'lab@telemed.com', role: Role.LAB_TECHNICIAN, firstName: 'Clara', lastName: 'Oswald', license: 'MLT-55201', spec: 'Biochemical Pathology' },
    { email: 'radiology@telemed.com', role: Role.RADIOLOGIST, firstName: 'David', lastName: 'Tennant', license: 'RAD-77109', spec: 'Teleradiology' },
    { email: 'billing@telemed.com', role: Role.BILLING_OFFICER, firstName: 'Robert', lastName: 'Sterling', license: 'CPB-33412', spec: 'Medical Billing & Coding' },
    { email: 'triage@telemed.com', role: Role.TRIAGE_OFFICER, firstName: 'Amy', lastName: 'Pond', license: 'EMT-88301', spec: 'Emergency Triage' },
    { email: 'care@telemed.com', role: Role.CARE_COORDINATOR, firstName: 'Rory', lastName: 'Williams', license: 'CCM-22190', spec: 'Chronic Care & Case Management' },
    { email: 'reception@telemed.com', role: Role.RECEPTIONIST, firstName: 'Donna', lastName: 'Noble', license: 'PAS-11045', spec: 'Patient Access & Scheduling' }
  ];

  for (const s of clinicalStaff) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: RESET_EXISTING ? {
        passwordHash,
        role: s.role,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: s.license,
        licenseJurisdiction: 'US-CLINICAL',
        specialty: s.spec
      } : {},
      create: {
        email: s.email,
        passwordHash,
        role: s.role,
        firstName: s.firstName,
        lastName: s.lastName,
        isActive: true,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: s.license,
        licenseJurisdiction: 'US-CLINICAL',
        specialty: s.spec,
        verifiedAt: new Date()
      }
    });
  }

  console.log('Seeding completed successfully with Argon2 verified credentials for all clinical hospital roles!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
