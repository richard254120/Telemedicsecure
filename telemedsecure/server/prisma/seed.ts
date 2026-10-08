import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1 Admin
  await prisma.user.upsert({
    where: { email: 'admin@telemed.com' },
    update: {},
    create: {
      email: 'admin@telemed.com',
      passwordHash,
      role: Role.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  // 2 Doctors
  await prisma.user.upsert({
    where: { email: 'doctor1@telemed.com' },
    update: {},
    create: {
      email: 'doctor1@telemed.com',
      passwordHash,
      role: Role.DOCTOR,
      firstName: 'John',
      lastName: 'Doe',
    },
  });

  await prisma.user.upsert({
    where: { email: 'doctor2@telemed.com' },
    update: {},
    create: {
      email: 'doctor2@telemed.com',
      passwordHash,
      role: Role.DOCTOR,
      firstName: 'Jane',
      lastName: 'Smith',
    },
  });

  // 1 Nurse
  await prisma.user.upsert({
    where: { email: 'nurse1@telemed.com' },
    update: {},
    create: {
      email: 'nurse1@telemed.com',
      passwordHash,
      role: Role.NURSE,
      firstName: 'Mary',
      lastName: 'Johnson',
    },
  });

  // 3 Patients
  for (let i = 1; i <= 3; i++) {
    await prisma.user.upsert({
      where: { email: `patient${i}@telemed.com` },
      update: {},
      create: {
        email: `patient${i}@telemed.com`,
        passwordHash,
        role: Role.PATIENT,
        firstName: 'Patient',
        lastName: `${i}`,
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
