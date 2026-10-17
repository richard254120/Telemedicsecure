import { PrismaClient, Role, LabOrderStatus, RadiologyStatus, TriageStatus, CarePlanStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding clinical station data...');
  const patients = await prisma.user.findMany({ where: { role: Role.PATIENT }, take: 5 });
  if (patients.length === 0) {
    console.log('No patients found to seed stations.');
    return;
  }

  const p1 = patients[0];
  const p2 = patients[1] || p1;

  // 1. Lab Orders
  await prisma.labOrder.upsert({
    where: { orderNumber: 'LAB-2026-00101' },
    update: {},
    create: {
      orderNumber: 'LAB-2026-00101',
      patientId: p1.id,
      testName: 'Complete Blood Count (CBC) with Automated Diff',
      specimenType: 'Venous Blood (EDTA)',
      status: LabOrderStatus.COMPLETED,
      findings: 'WBC: 7.2 x10^9/L, RBC: 4.8 x10^12/L, Hemoglobin: 14.8 g/dL, Platelets: 235 x10^9/L (Normal indices)',
      referenceRange: 'WBC: 4.5-11.0, Hb: 13.5-17.5 g/dL',
      isCritical: false,
      completedAt: new Date()
    }
  });

  await prisma.labOrder.upsert({
    where: { orderNumber: 'LAB-2026-00102' },
    update: {},
    create: {
      orderNumber: 'LAB-2026-00102',
      patientId: p2.id,
      testName: 'Comprehensive Metabolic Panel (CMP)',
      specimenType: 'Serum (SST Tube)',
      status: LabOrderStatus.SAMPLE_COLLECTED,
      findings: 'Specimen accessioned at Central Pathology Station. Colorimetric enzymatic assay queued.',
      referenceRange: 'Glucose: 70-99 mg/dL, Creatinine: 0.7-1.3 mg/dL',
      isCritical: false
    }
  });

  await prisma.labOrder.upsert({
    where: { orderNumber: 'LAB-2026-00103' },
    update: {},
    create: {
      orderNumber: 'LAB-2026-00103',
      patientId: p1.id,
      testName: 'Lipid Profile Panel (HDL/LDL/Triglycerides)',
      specimenType: 'Serum (SST Tube)',
      status: LabOrderStatus.ORDERED,
      findings: null,
      referenceRange: 'Total Chol < 200 mg/dL, HDL > 40 mg/dL',
      isCritical: false
    }
  });

  // 2. Radiology Studies
  await prisma.radiologyStudy.upsert({
    where: { studyNumber: 'RAD-2026-00201' },
    update: {},
    create: {
      studyNumber: 'RAD-2026-00201',
      patientId: p1.id,
      modality: 'Chest X-Ray (PA & Lateral)',
      anatomicalRegion: 'Thorax / Pulmonary',
      dicomStudyUid: '1.2.840.10008.5.1.4.1.1.7.994821',
      status: RadiologyStatus.FINALIZED,
      impression: 'Clear lung parenchyma without focal consolidation, pneumothorax, or pleural effusion. Normal cardiothoracic ratio.',
      findings: 'Visualized bony thorax intact. No active acute cardiopulmonary process.',
      isUrgent: false,
      finalizedAt: new Date()
    }
  });

  await prisma.radiologyStudy.upsert({
    where: { studyNumber: 'RAD-2026-00202' },
    update: {},
    create: {
      studyNumber: 'RAD-2026-00202',
      patientId: p2.id,
      modality: 'Brain MRI (T1/T2/FLAIR)',
      anatomicalRegion: 'Neuroaxis / Cranium',
      dicomStudyUid: '1.2.840.10008.5.1.4.1.1.7.994822',
      status: RadiologyStatus.ORDERED,
      impression: null,
      isUrgent: false
    }
  });

  await prisma.radiologyStudy.upsert({
    where: { studyNumber: 'RAD-2026-00203' },
    update: {},
    create: {
      studyNumber: 'RAD-2026-00203',
      patientId: p1.id,
      modality: 'Abdominal Ultrasound',
      anatomicalRegion: 'Right Upper Quadrant',
      dicomStudyUid: '1.2.840.10008.5.1.4.1.1.7.994823',
      status: RadiologyStatus.IN_REVIEW,
      impression: 'Gallbladder normal caliber without cholelithiasis. Liver parenchyma homogeneous.',
      findings: 'Hepatic echotexture within normal limits. Spleen and bilateral kidneys normal.',
      isUrgent: false
    }
  });

  // 3. Triage Queue
  await prisma.triageAssessment.upsert({
    where: { triageNumber: 'TRG-2026-00301' },
    update: {},
    create: {
      triageNumber: 'TRG-2026-00301',
      patientId: p1.id,
      esiScore: 3,
      chiefComplaint: 'Progressive dry cough, low-grade pyrexia, mild dyspnea on moderate exertion',
      heartRate: 84,
      bloodPressure: '124/82',
      respiratoryRate: 18,
      temperature: 37.8,
      oxygenSat: 97.0,
      acuityNotes: 'Patient ambulatory, oriented x3. SpO2 stable on room air. Assigned to Virtual Exam Room #3.',
      assignedQueue: 'Urgent Care Telehealth Queue #2',
      status: TriageStatus.TRIAGED
    }
  });

  await prisma.triageAssessment.upsert({
    where: { triageNumber: 'TRG-2026-00302' },
    update: {},
    create: {
      triageNumber: 'TRG-2026-00302',
      patientId: p2.id,
      esiScore: 4,
      chiefComplaint: 'Routine blood pressure follow-up and prescription refill request',
      heartRate: 72,
      bloodPressure: '128/84',
      respiratoryRate: 16,
      temperature: 36.8,
      oxygenSat: 99.0,
      acuityNotes: 'Hemodynamically stable. No acute distress.',
      assignedQueue: 'Primary Care Queue #1',
      status: TriageStatus.WAITING
    }
  });

  // 4. Care Plans
  await prisma.carePlan.upsert({
    where: { planNumber: 'CCP-2026-00401' },
    update: {},
    create: {
      planNumber: 'CCP-2026-00401',
      patientId: p1.id,
      cohort: 'HYPERTENSION',
      diagnosisTitle: 'Essential Hypertension Stage II Protocol',
      goals: 'Maintain resting blood pressure < 130/80 mmHg via daily digital telemetry & sodium restriction.',
      adherencePercent: 94.0,
      riskLevel: 'LOW',
      status: CarePlanStatus.ACTIVE,
      nextReviewDate: new Date(Date.now() + 14 * 86400000),
      tasks: {
        create: [
          {
            title: 'Bi-weekly Telemetry Blood Pressure Log Review',
            description: 'Check automated Bluetooth cuff measurements uploaded to patient portal.',
            dueDate: new Date(Date.now() + 5 * 86400000)
          },
          {
            title: 'Electrolyte & Renal Function Serum Panel Check',
            description: 'Verify serum potassium and eGFR following ACE-inhibitor titration.',
            dueDate: new Date(Date.now() + 12 * 86400000)
          }
        ]
      }
    }
  });

  await prisma.carePlan.upsert({
    where: { planNumber: 'CCP-2026-00402' },
    update: {},
    create: {
      planNumber: 'CCP-2026-00402',
      patientId: p2.id,
      cohort: 'DIABETES_T2',
      diagnosisTitle: 'Type 2 Diabetes Mellitus Glycemic Optimization',
      goals: 'Target HbA1c < 7.0%, fasting glucose 80-130 mg/dL, foot exam completed.',
      adherencePercent: 88.5,
      riskLevel: 'MEDIUM',
      status: CarePlanStatus.ON_TRACK,
      nextReviewDate: new Date(Date.now() + 21 * 86400000),
      tasks: {
        create: [
          {
            title: 'Continuous Glucose Monitor (CGM) Calibration Review',
            description: 'Confirm sensor pairing and review 14-day ambulatory glucose profile.',
            dueDate: new Date(Date.now() + 7 * 86400000)
          }
        ]
      }
    }
  });

  // 5. Medication Stock
  const meds = [
    { ndc: '00378-0135-01', name: 'Metformin HCl', genericName: 'Metformin', strength: '500mg', stockQuantity: 280, unitPrice: 8.50 },
    { ndc: '00006-0740-54', name: 'Lisinopril', genericName: 'Lisinopril', strength: '10mg', stockQuantity: 195, unitPrice: 11.20 },
    { ndc: '00093-2264-01', name: 'Amoxicillin Trihydrate', genericName: 'Amoxicillin', strength: '500mg', stockQuantity: 140, unitPrice: 14.00 },
    { ndc: '00071-0156-23', name: 'Atorvastatin Calcium', genericName: 'Atorvastatin', strength: '20mg', stockQuantity: 220, unitPrice: 18.50 },
    { ndc: '59310-579-20', name: 'Albuterol Sulfate Inhaler', genericName: 'Albuterol', strength: '90mcg/actuation', stockQuantity: 45, unitPrice: 32.00 }
  ];

  for (const m of meds) {
    await prisma.medicationInventory.upsert({
      where: { ndc: m.ndc },
      update: {},
      create: {
        ...m,
        dosageForm: m.name.includes('Inhaler') ? 'INHALER' : 'TABLET',
        expiryDate: new Date(Date.now() + 450 * 86400000)
      }
    });
  }

  console.log('Seeded all station clinical data successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
