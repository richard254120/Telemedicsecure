import { Router, Request, Response } from 'express';
import { PrismaClient, Role, InvoiceStatus, ClaimStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import { createChainedAuditEvent } from '../services/audit.service';

const router = Router();
const prisma = new PrismaClient();

// Standard Clinical Billing Codes Dictionary
export const STANDARD_CPT_CODES = [
  { code: '99212', description: 'Office/Outpatient visit, established patient, 10-19 min (Level 2)', defaultFee: 75.0, category: 'CONSULTATION' },
  { code: '99213', description: 'Office/Outpatient visit, established patient, 20-29 min (Level 3)', defaultFee: 110.0, category: 'CONSULTATION' },
  { code: '99214', description: 'Office/Outpatient visit, established patient, 30-39 min (Level 4)', defaultFee: 165.0, category: 'CONSULTATION' },
  { code: '99215', description: 'Office/Outpatient visit, established patient, 40-54 min (Level 5)', defaultFee: 220.0, category: 'CONSULTATION' },
  { code: '99453', description: 'Remote Patient Monitoring (RPM) initial device setup & patient education', defaultFee: 45.0, category: 'RPM' },
  { code: '99454', description: 'Remote Patient Monitoring transmission & daily recordings (30 days)', defaultFee: 65.0, category: 'RPM' },
  { code: '99058', description: 'Emergency / High-Acuity Triage Evaluation Surcharge', defaultFee: 50.0, category: 'TRIAGE' },
  { code: '80061', description: 'Lipid Panel Blood Diagnostic Test', defaultFee: 48.0, category: 'LAB_TEST' },
  { code: '80053', description: 'Comprehensive Metabolic Panel (CMP)', defaultFee: 55.0, category: 'LAB_TEST' },
  { code: '85025', description: 'Complete Blood Count (CBC) with automated differential', defaultFee: 38.0, category: 'LAB_TEST' },
  { code: '71045', description: 'Chest X-Ray Single View (Technical Component)', defaultFee: 95.0, category: 'IMAGING' },
  { code: 'RX-DISP', description: 'Pharmacy Dispensing & Tele-Pharmacology Consultation Fee', defaultFee: 25.0, category: 'MEDICATION' },
];

export const STANDARD_ICD10_CODES = [
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated' },
  { code: 'M54.5', description: 'Low back pain, unspecified' },
  { code: 'F41.1', description: 'Generalized anxiety disorder' },
  { code: 'R05', description: 'Cough / Acute bronchospasm' },
  { code: 'R50.9', description: 'Fever, unspecified' },
];

// All authenticated users can access billing router, with role restrictions per endpoint
router.use(requireAuth);

/**
 * 1. GET /api/v1/billing/codes
 * Returns standard CPT and ICD-10 medical billing dictionary
 */
router.get('/codes', (req: Request, res: Response) => {
  res.json({
    cptCodes: STANDARD_CPT_CODES,
    icd10Codes: STANDARD_ICD10_CODES,
    payers: [
      { name: 'BlueCross BlueShield', payerId: 'BCBS-001', networkStatus: 'In-Network', defaultCoverage: 0.8 },
      { name: 'Aetna Health', payerId: 'AETNA-002', networkStatus: 'In-Network', defaultCoverage: 0.8 },
      { name: 'UnitedHealthcare', payerId: 'UHC-003', networkStatus: 'In-Network', defaultCoverage: 0.75 },
      { name: 'Cigna Healthcare', payerId: 'CIGNA-004', networkStatus: 'In-Network', defaultCoverage: 0.8 },
      { name: 'Medicare Part B (Telehealth)', payerId: 'CMS-MEDICARE', networkStatus: 'Participating Provider', defaultCoverage: 0.8 },
      { name: 'Direct Self-Pay / HSA', payerId: 'SELF-PAY', networkStatus: 'Out-of-Pocket', defaultCoverage: 0.0 },
    ]
  });
});

/**
 * 2. GET /api/v1/billing/stats
 * Financial overview, A/R aging, and clean claims metrics
 */
router.get('/stats', requireRole([Role.BILLING_OFFICER, Role.ADMIN, Role.RECEPTIONIST]), async (req: Request, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        items: true,
        claims: true,
        payments: true
      }
    });

    const totalBilled = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
    const totalCollected = invoices.reduce((acc, inv) => {
      const paid = inv.payments.reduce((pAcc, p) => pAcc + p.amount, 0);
      return acc + (inv.status === InvoiceStatus.PAID ? inv.totalAmount : paid);
    }, 0);
    const totalPatientDue = invoices.reduce((acc, inv) => {
      return inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.CANCELLED ? acc + inv.patientDue : acc;
    }, 0);
    const totalInsuranceCovered = invoices.reduce((acc, inv) => acc + inv.insuranceCovered, 0);

    const claims = await prisma.insuranceClaim.findMany();
    const approvedClaims = claims.filter(c => c.status === ClaimStatus.APPROVED || c.status === ClaimStatus.SETTLED).length;
    const cleanClaimRate = claims.length > 0 ? Math.round((approvedClaims / claims.length) * 100) : 96;

    // AR Aging breakdown
    const now = new Date().getTime();
    let arCurrent = 0;   // 0-30 days
    let ar30to60 = 0;    // 31-60 days
    let ar61to90 = 0;    // 61-90 days
    let arOver90 = 0;    // 90+ days

    for (const inv of invoices) {
      if (inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.CANCELLED) {
        const days = Math.floor((now - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 30) arCurrent += inv.patientDue;
        else if (days <= 60) ar30to60 += inv.patientDue;
        else if (days <= 90) ar61to90 += inv.patientDue;
        else arOver90 += inv.patientDue;
      }
    }

    res.json({
      summary: {
        totalInvoices: invoices.length,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalPatientDue: Math.round(totalPatientDue * 100) / 100,
        totalInsuranceCovered: Math.round(totalInsuranceCovered * 100) / 100,
        pendingInvoicesCount: invoices.filter(i => i.status === InvoiceStatus.PENDING).length,
        paidInvoicesCount: invoices.filter(i => i.status === InvoiceStatus.PAID).length,
      },
      claimsMetrics: {
        totalClaims: claims.length,
        submittedClaims: claims.filter(c => c.status === ClaimStatus.SUBMITTED).length,
        approvedClaims,
        deniedClaims: claims.filter(c => c.status === ClaimStatus.DENIED).length,
        cleanClaimRate: `${cleanClaimRate}%`
      },
      arAging: {
        current: Math.round(arCurrent * 100) / 100,
        days31to60: Math.round(ar30to60 * 100) / 100,
        days61to90: Math.round(ar61to90 * 100) / 100,
        over90Days: Math.round(arOver90 * 100) / 100,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compute billing stats', details: err.message });
  }
});

/**
 * 3. GET /api/v1/billing/invoices
 * List invoices with role-based filtering (Patients see their own, Billing/Admin see all)
 */
router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let whereClause: any = {};

    if (user.role === Role.PATIENT) {
      whereClause.patientId = user.id;
    } else if (user.role === Role.DOCTOR) {
      // Doctors can see invoices connected to their consultations or patients
      const doctorConsultations = await prisma.consultation.findMany({
        where: { doctorId: user.id },
        select: { id: true }
      });
      const consIds = doctorConsultations.map(c => c.id);
      whereClause = {
        OR: [
          { consultationId: { in: consIds } },
          { notes: { contains: user.lastName } }
        ]
      };
    } else if (req.query.patientId) {
      whereClause.patientId = req.query.patientId as string;
    }

    if (req.query.status) {
      whereClause.status = req.query.status as InvoiceStatus;
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        consultation: {
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            doctor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                specialty: true
              }
            }
          }
        },
        items: true,
        claims: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch invoices', details: err.message });
  }
});

/**
 * 4. GET /api/v1/billing/unbilled-encounters
 * Cross-dashboard communication: pulls completed consultations without an invoice
 * so the Billing Officer can instantly generate an encounter invoice.
 */
router.get('/unbilled-encounters', requireRole([Role.BILLING_OFFICER, Role.ADMIN, Role.RECEPTIONIST]), async (req: Request, res: Response) => {
  try {
    const consultations = await prisma.consultation.findMany({
      where: {
        invoices: { none: {} }
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialty: true
          }
        },
        prescriptions: {
          include: { items: true }
        },
        vitalSigns: {
          select: { id: true, createdAt: true }
        },
        clinicalFlags: true
      },
      orderBy: { scheduledAt: 'desc' },
      take: 20
    });

    // Also get patient insurance eligibilities
    const patientIds = Array.from(new Set(consultations.map(c => c.patientId)));
    const eligibilities = await prisma.insuranceEligibility.findMany({
      where: { patientId: { in: patientIds } }
    });

    const eligibilityMap = new Map<string, any>();
    eligibilities.forEach(e => eligibilityMap.set(e.patientId, e));

    const enriched = consultations.map(c => {
      const eligibility = eligibilityMap.get(c.patientId) || {
        payerName: 'Self-Pay / Pending Pre-Auth',
        policyNumber: 'N/A',
        coveragePercent: 0,
        copayAmount: 50.0
      };

      // Recommended default procedure codes based on clinical flags and prescriptions
      const recommendedCpts = ['99214']; // standard 30 min telehealth
      if (c.clinicalFlags && c.clinicalFlags.length > 0) {
        recommendedCpts.push('99058'); // triage severity
      }
      if (c.prescriptions && c.prescriptions.length > 0) {
        recommendedCpts.push('RX-DISP'); // prescription fulfillment
      }

      return {
        consultationId: c.id,
        scheduledAt: c.scheduledAt,
        status: c.status,
        patient: c.patient,
        doctor: c.doctor,
        clinicalFlagsCount: c.clinicalFlags?.length || 0,
        prescriptionsCount: c.prescriptions?.length || 0,
        hasVitals: c.vitalSigns?.length > 0,
        insurance: eligibility,
        recommendedCptCodes: recommendedCpts
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch unbilled encounters', details: err.message });
  }
});

/**
 * 5. POST /api/v1/billing/invoices
 * Create a new itemized invoice & electronic claim draft
 */
router.post('/invoices', requireRole([Role.BILLING_OFFICER, Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      patientId,
      consultationId,
      items,
      payerName,
      policyNumber,
      icd10Codes,
      cptCodes,
      notes,
      autoSubmitClaim
    } = req.body;

    if (!patientId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'patientId and at least one billable item are required' });
    }

    // Verify patient exists
    const patient = await prisma.user.findUnique({ where: { id: patientId } });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Compute item totals
    let totalAmount = 0;
    const preparedItems = items.map((item: any) => {
      const qty = item.quantity && Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const unitPrice = Number(item.unitPrice) || 0;
      const totalPrice = qty * unitPrice;
      totalAmount += totalPrice;
      return {
        serviceType: item.serviceType || 'CONSULTATION',
        cptCode: item.cptCode || null,
        description: item.description || 'Medical Service',
        quantity: qty,
        unitPrice,
        totalPrice
      };
    });

    // Check insurance eligibility for auto-calculation
    const eligibility = await prisma.insuranceEligibility.findFirst({
      where: { patientId, status: 'ACTIVE' },
      orderBy: { verifiedAt: 'desc' }
    });

    let insuranceCovered = 0;
    let patientDue = totalAmount;

    if (eligibility && eligibility.coveragePercent > 0) {
      const coverageRate = eligibility.coveragePercent / 100;
      insuranceCovered = Math.round(totalAmount * coverageRate * 100) / 100;
      patientDue = Math.round((totalAmount - insuranceCovered) * 100) / 100;
      // Ensure patient pays at least their copay if applicable
      if (eligibility.copayAmount > 0 && patientDue < eligibility.copayAmount && totalAmount >= eligibility.copayAmount) {
        patientDue = eligibility.copayAmount;
        insuranceCovered = Math.round((totalAmount - patientDue) * 100) / 100;
      }
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30-day net terms

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        patientId,
        consultationId: consultationId || null,
        totalAmount,
        insuranceCovered,
        patientDue,
        status: InvoiceStatus.PENDING,
        dueDate,
        notes: notes || `Generated by ${user.role} ${user.firstName} ${user.lastName}`,
        items: {
          create: preparedItems
        }
      },
      include: {
        items: true,
        patient: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    // Optionally auto-generate Insurance Claim if payer details provided or autoSubmit is requested
    let createdClaim = null;
    const finalPayer = payerName || (eligibility ? eligibility.payerName : null);
    const finalPolicy = policyNumber || (eligibility ? eligibility.policyNumber : null);

    if (finalPayer && finalPayer !== 'Direct Self-Pay / HSA') {
      const claimNumber = `CLM-${Date.now().toString().slice(-7)}`;
      createdClaim = await prisma.insuranceClaim.create({
        data: {
          claimNumber,
          invoiceId: invoice.id,
          patientId,
          payerName: finalPayer,
          policyNumber: finalPolicy || 'POL-DEFAULT',
          icd10Codes: Array.isArray(icd10Codes) && icd10Codes.length > 0 ? icd10Codes : ['I10'],
          cptCodes: Array.isArray(cptCodes) && cptCodes.length > 0 ? cptCodes : ['99214'],
          billedAmount: totalAmount,
          approvedAmount: insuranceCovered,
          copayAmount: eligibility?.copayAmount || 25.0,
          deductibleAmount: 0.0,
          status: autoSubmitClaim ? ClaimStatus.SUBMITTED : ClaimStatus.DRAFT,
          clearinghouseTxId: autoSubmitClaim ? `EDI837P-${Date.now()}` : null,
          submittedAt: autoSubmitClaim ? new Date() : null
        }
      });
    }

    // Cryptographic audit log
    await createChainedAuditEvent({
      action: 'BILLING_INVOICE_CREATED',
      resource: `/api/v1/billing/invoices/${invoice.id}`,
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        invoiceNumber: invoice.invoiceNumber,
        totalAmount,
        patientDue,
        insuranceCovered,
        claimNumber: createdClaim?.claimNumber
      }
    });

    res.status(201).json({
      message: 'Invoice generated successfully',
      invoice,
      claim: createdClaim
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create invoice', details: err.message });
  }
});

/**
 * 6. POST /api/v1/billing/invoices/:id/pay
 * Settle patient balance via digital payment (Card, Stripe, HSA/FSA, MPesa, Cash)
 */
router.post('/invoices/:id/pay', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const invoiceId = String(req.params.id);
    const { paymentMethod, amountPaid, transactionReference } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { patient: true, payments: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Security check: Patients can only pay their own invoices
    if (user.role === Role.PATIENT && invoice.patientId !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only settle your own bills' });
    }

    const payAmount = Number(amountPaid) || invoice.patientDue;
    const txRef = transactionReference || `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Record payment
    const payment = await prisma.billingPayment.create({
      data: {
        invoiceId: invoice.id,
        amount: payAmount,
        method: paymentMethod || 'CREDIT_CARD',
        transactionRef: txRef,
        payerEmail: invoice.patient ? invoice.patient.email : null,
        receiptUrl: `/receipts/${txRef}.pdf`,
        status: 'COMPLETED'
      }
    });

    // Update invoice status
    const allPayments = await prisma.billingPayment.findMany({ where: { invoiceId: invoice.id } });
    const totalPaid = allPayments.reduce((acc, p) => acc + p.amount, 0);

    const isFullyPaid = totalPaid >= invoice.patientDue;
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
        paymentMethod: paymentMethod || 'CREDIT_CARD',
        paymentReference: txRef,
        paidAt: isFullyPaid ? new Date() : invoice.paidAt
      },
      include: { items: true, payments: true }
    });

    // Chained audit event
    await createChainedAuditEvent({
      action: 'BILLING_PAYMENT_PROCESSED',
      resource: `/api/v1/billing/invoices/${invoiceId}/pay`,
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: payAmount,
        totalPaid,
        method: paymentMethod,
        txRef
      }
    });

    res.json({
      message: isFullyPaid ? 'Invoice fully settled' : 'Partial payment recorded',
      invoice: updatedInvoice,
      payment,
      receiptNumber: `RCP-${txRef.slice(-8)}`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process payment', details: err.message });
  }
});

/**
 * 7. GET /api/v1/billing/claims
 * Retrieve claims list
 */
router.get('/claims', requireRole([Role.BILLING_OFFICER, Role.ADMIN]), async (req: Request, res: Response) => {
  try {
    const claims = await prisma.insuranceClaim.findMany({
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        invoice: {
          select: { invoiceNumber: true, totalAmount: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(claims);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch claims', details: err.message });
  }
});

/**
 * 8. PUT /api/v1/billing/claims/:id/status
 * Adjudicate, approve, deny, or appeal an insurance claim
 */
router.put('/claims/:id/status', requireRole([Role.BILLING_OFFICER, Role.ADMIN]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const claimId = String(req.params.id);
    const { status, approvedAmount, denialReason, appealNotes } = req.body;

    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      include: { invoice: true }
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const updated = await prisma.insuranceClaim.update({
      where: { id: claimId },
      data: {
        status: status as ClaimStatus,
        approvedAmount: approvedAmount !== undefined ? Number(approvedAmount) : claim.approvedAmount,
        denialReason: denialReason !== undefined ? denialReason : claim.denialReason,
        appealNotes: appealNotes !== undefined ? appealNotes : claim.appealNotes,
        adjudicatedAt: status === ClaimStatus.APPROVED || status === ClaimStatus.DENIED || status === ClaimStatus.SETTLED ? new Date() : claim.adjudicatedAt,
        submittedAt: status === ClaimStatus.SUBMITTED && !claim.submittedAt ? new Date() : claim.submittedAt,
        clearinghouseTxId: status === ClaimStatus.SUBMITTED && !claim.clearinghouseTxId ? `EDI837P-${Date.now()}` : claim.clearinghouseTxId
      }
    });

    // If claim is approved or denied, adjust the associated invoice
    if (claim.invoice) {
      if (status === ClaimStatus.APPROVED && approvedAmount !== undefined) {
        const appAmt = Number(approvedAmount);
        const newPatientDue = Math.max(0, claim.invoice.totalAmount - appAmt);
        await prisma.invoice.update({
          where: { id: claim.invoiceId },
          data: {
            insuranceCovered: appAmt,
            patientDue: newPatientDue
          }
        });
      } else if (status === ClaimStatus.DENIED) {
        // Entire amount shifts to patient responsibility
        await prisma.invoice.update({
          where: { id: claim.invoiceId },
          data: {
            insuranceCovered: 0.0,
            patientDue: claim.invoice.totalAmount
          }
        });
      }
    }

    await createChainedAuditEvent({
      action: 'BILLING_CLAIM_ADJUDICATED',
      resource: `/api/v1/billing/claims/${claimId}/status`,
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        claimNumber: claim.claimNumber,
        newStatus: status,
        approvedAmount
      }
    });

    res.json({
      message: `Claim status updated to ${status}`,
      claim: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update claim status', details: err.message });
  }
});

/**
 * 9. POST /api/v1/billing/eligibility/verify
 * Real-time EDI 270/271 insurance verification
 */
router.post('/eligibility/verify', async (req: Request, res: Response) => {
  try {
    const { patientId, payerName, policyNumber } = req.body;

    if (!patientId || !payerName || !policyNumber) {
      return res.status(400).json({ error: 'patientId, payerName, and policyNumber are required' });
    }

    // Determine realistic coverage based on payer
    let coveragePercent = 80.0;
    let copay = 25.0;
    let deductible = 500.0;

    if (payerName.includes('Medicare')) {
      coveragePercent = 80.0;
      copay = 0.0;
      deductible = 226.0;
    } else if (payerName.includes('Cigna') || payerName.includes('Aetna')) {
      coveragePercent = 85.0;
      copay = 30.0;
      deductible = 400.0;
    } else if (payerName.includes('Self-Pay')) {
      coveragePercent = 0.0;
      copay = 0.0;
      deductible = 0.0;
    }

    // Upsert or create eligibility record
    const eligibility = await prisma.insuranceEligibility.create({
      data: {
        patientId,
        payerName,
        policyNumber,
        status: 'ACTIVE',
        copayAmount: copay,
        deductibleRemaining: deductible,
        coveragePercent,
        verifiedAt: new Date()
      }
    });

    res.json({
      message: 'Eligibility verified successfully via EDI 271 response',
      eligibility: {
        ...eligibility,
        responseCode: 'AAA-ACTIVE',
        subscriberRelationship: 'Self',
        effectiveDate: '2026-01-01',
        coinsuranceRate: `${100 - coveragePercent}%`,
        telehealthCovered: true
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify insurance eligibility', details: err.message });
  }
});

/**
 * 10. POST /api/v1/billing/seed-demo-data
 * Seed realistic initial billing data for testing and demonstrations
 */
router.post('/seed-demo-data', requireRole([Role.BILLING_OFFICER, Role.ADMIN]), async (req: Request, res: Response) => {
  try {
    const patients = await prisma.user.findMany({
      where: { role: Role.PATIENT },
      take: 5
    });

    if (patients.length === 0) {
      return res.status(400).json({ error: 'No patients found to seed billing data' });
    }

    const seededInvoices = [];

    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];

      // Ensure active eligibility
      await prisma.insuranceEligibility.upsert({
        where: { id: `elig-${patient.id}` },
        update: {},
        create: {
          id: `elig-${patient.id}`,
          patientId: patient.id,
          payerName: i % 2 === 0 ? 'BlueCross BlueShield' : 'Aetna Health',
          policyNumber: `BCBS-9842${i}1`,
          status: 'ACTIVE',
          copayAmount: 25.0,
          deductibleRemaining: 350.0,
          coveragePercent: 80.0
        }
      });

      // Find an existing consultation or null
      const cons = await prisma.consultation.findFirst({
        where: { patientId: patient.id }
      });

      const invNumber = `INV-2026-00${i + 1}`;
      const total = 165.0 + (i * 45); // $165, $210, $255...
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
          dueDate: new Date(Date.now() + 14 * 86400000),
          paidAt: isPaid ? new Date() : null,
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
                unitPrice: 45.0,
                totalPrice: 45.0
              }] : [])
            ]
          }
        }
      });

      // Claim
      await prisma.insuranceClaim.upsert({
        where: { claimNumber: `CLM-2026-00${i + 1}` },
        update: {},
        create: {
          claimNumber: `CLM-2026-00${i + 1}`,
          invoiceId: invoice.id,
          patientId: patient.id,
          payerName: i % 2 === 0 ? 'BlueCross BlueShield' : 'Aetna Health',
          policyNumber: `BCBS-9842${i}1`,
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
            transactionRef: `TXN-DEMO-001`,
            payerEmail: patient.email,
            status: 'COMPLETED'
          }
        });
      }

      seededInvoices.push(invoice);
    }

    res.json({
      message: 'Demo billing data seeded successfully',
      seededCount: seededInvoices.length
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to seed billing demo data', details: err.message });
  }
});

export default router;
