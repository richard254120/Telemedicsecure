import { PrismaClient, Role, InvoiceStatus, ClaimStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial billing data...');
  const patients = await prisma.user.findMany({
    where: { role: Role.PATIENT },
    take: 5
  });

  if (patients.length === 0) {
    console.log('No patients found to seed billing data.');
    return;
  }

  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];

    // Seed eligibility
    await prisma.insuranceEligibility.upsert({
      where: { id: `elig-${patient.id}` },
      update: {},
      create: {
        id: `elig-${patient.id}`,
        patientId: patient.id,
        payerName: i % 2 === 0 ? 'BlueCross BlueShield' : 'Aetna Health',
        policyNumber: `POL-BCBS-9842${i}1`,
        status: 'ACTIVE',
        copayAmount: 25.0,
        deductibleRemaining: 350.0,
        coveragePercent: 80.0
      }
    });

    const cons = await prisma.consultation.findFirst({
      where: { patientId: patient.id }
    });

    const invNumber = `INV-2026-00${i + 1}`;
    const total = 165.0 + (i * 50);
    const insCovered = Math.round(total * 0.8 * 100) / 100;
    const ptDue = Math.round((total - insCovered) * 100) / 100;
    const isPaid = i === 0;

    const invoice = await prisma.invoice.upsert({
      where: { invoiceNumber: invNumber },
      update: {},
      create: {
        invoiceNumber: invNumber,
        patientId: patient.id,
        consultationId: cons?.id || null,
        totalAmount: total,
        insuranceCovered: insCovered,
        patientDue: ptDue,
        status: isPaid ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
        dueDate: new Date(Date.now() + 20 * 86400000),
        paidAt: isPaid ? new Date() : null,
        notes: `Clinical Telehealth Encounter for ${patient.firstName} ${patient.lastName}`,
        items: {
          create: [
            {
              serviceType: 'CONSULTATION',
              cptCode: '99214',
              description: 'Office/Outpatient Telehealth Visit, Level 4 (30-39 min)',
              quantity: 1,
              unitPrice: 165.0,
              totalPrice: 165.0
            },
            ...(i > 0 ? [{
              serviceType: 'LAB_TEST',
              cptCode: '80061',
              description: 'Lipid Diagnostic Blood Panel',
              quantity: 1,
              unitPrice: 50.0,
              totalPrice: 50.0
            }] : [])
          ]
        }
      }
    });

    await prisma.insuranceClaim.upsert({
      where: { claimNumber: `CLM-2026-00${i + 1}` },
      update: {},
      create: {
        claimNumber: `CLM-2026-00${i + 1}`,
        invoiceId: invoice.id,
        patientId: patient.id,
        payerName: i % 2 === 0 ? 'BlueCross BlueShield' : 'Aetna Health',
        policyNumber: `POL-BCBS-9842${i}1`,
        icd10Codes: ['I10', 'E11.9'],
        cptCodes: ['99214'],
        billedAmount: total,
        approvedAmount: insCovered,
        copayAmount: 25.0,
        status: isPaid ? ClaimStatus.SETTLED : (i === 1 ? ClaimStatus.SUBMITTED : ClaimStatus.DRAFT),
        clearinghouseTxId: `EDI837P-${1000 + i}`,
        submittedAt: new Date(),
        adjudicatedAt: isPaid ? new Date() : null
      }
    });

    if (isPaid) {
      await prisma.billingPayment.create({
        data: {
          invoiceId: invoice.id,
          amount: ptDue,
          method: 'CREDIT_CARD',
          transactionRef: `TXN-DEMO-${invoice.invoiceNumber}`,
          payerEmail: patient.email,
          status: 'COMPLETED'
        }
      });
    }
  }

  console.log('Seeded demo billing data successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
