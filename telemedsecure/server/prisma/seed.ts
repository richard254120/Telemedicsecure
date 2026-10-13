import { PrismaClient, Role, VerificationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('Password123!');

    // Seed Admin from env variables
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@telemed.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const adminPasswordHash = await argon2.hash(adminPassword);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: adminPasswordHash,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        verificationStatus: VerificationStatus.VERIFIED,
        mustChangePassword: true
      },
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

  // Seed Doctors
  const doctors = [
    { email: 'doctor@telemed.com', firstName: 'Sarah', lastName: 'Mitchell', license: 'NPI-1928301948', spec: 'Cardiology' },
    { email: 'doctor1@telemed.com', firstName: 'John', lastName: 'Doe', license: 'NPI-1029384756', spec: 'Internal Medicine' },
    { email: 'doctor2@telemed.com', firstName: 'Jane', lastName: 'Smith', license: 'NPI-5647382910', spec: 'Family Medicine' }
  ];

  for (const doc of doctors) {
    await prisma.user.upsert({
      where: { email: doc.email },
      update: {
        passwordHash,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: doc.license,
        licenseJurisdiction: 'US-NPI',
        specialty: doc.spec
      },
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
      update: {
        passwordHash,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: n.license,
        licenseJurisdiction: 'US-RN',
        specialty: n.spec
      },
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
      update: {
        passwordHash,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        verificationStatus: VerificationStatus.VERIFIED
      },
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

  console.log('Seeding completed successfully with Argon2 verified credentials!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
