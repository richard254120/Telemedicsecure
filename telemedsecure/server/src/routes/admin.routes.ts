import crypto from 'crypto';
import { Router } from 'express';
import argon2 from 'argon2';
import { PrismaClient, Role, VerificationStatus } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import * as speakeasy from 'speakeasy';
import { createChainedAuditEvent } from '../services/audit.service';

const router = Router();
const prisma = new PrismaClient();

// Only ADMIN can access these routes
router.use(requireAuth);
router.use(requireRole([Role.ADMIN]));

const logAudit = async (action: string, resource: string, userId?: string | null, ip?: string) => {
  await createChainedAuditEvent({
    action,
    resource,
    userId,
    ipAddress: ip || 'unknown',
    userAgent: 'unknown',
  });
};

// System-wide statistics and overall performance metrics across the entire platform
router.get('/stats', async (req, res) => {
  try {
    const startTime = Date.now();
    const [
      userRoleCounts,
      totalUsers,
      activeUsers,
      lockedUsers,
      consultations,
      prescriptions,
      signedPrescriptionsCount,
      radiologyStudies,
      labOrders,
      triageAssessments,
      invoices,
      insuranceClaims,
      auditEventsCount,
      violations,
      alerts,
      incidents,
      invitationsCount,
      activeInvitationsCount,
    ] = await Promise.all([
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
      prisma.consultation.findMany({
        select: { status: true, startedAt: true, endedAt: true },
      }),
      prisma.prescription.findMany({
        select: { status: true },
      }),
      prisma.digitalSignature.count(),
      prisma.radiologyStudy.findMany({
        select: { status: true, modality: true, isUrgent: true },
      }),
      prisma.labOrder.findMany({
        select: { status: true, isCritical: true },
      }),
      prisma.triageAssessment.findMany({
        select: { status: true, esiScore: true },
      }),
      prisma.invoice.findMany({
        select: { totalAmount: true, patientDue: true, insuranceCovered: true, status: true },
      }),
      prisma.insuranceClaim.findMany({
        select: { status: true, billedAmount: true, approvedAmount: true },
      }),
      prisma.auditEvent.count(),
      prisma.complianceViolation.findMany({
        select: { severity: true, resolved: true },
      }),
      prisma.securityAlert.findMany({
        select: { severity: true },
      }),
      prisma.incident.findMany({
        select: { status: true, severity: true },
      }),
      prisma.staffInvitation.count(),
      prisma.staffInvitation.count({
        where: { expiresAt: { gt: new Date() }, isAccepted: false },
      }),
    ]);

    const dbLatencyMs = Date.now() - startTime;

    // Roles breakdown map
    const rolesMap: Record<string, number> = {};
    for (const r of userRoleCounts) {
      rolesMap[r.role] = r._count.id;
    }

    // Consultations stats
    const totalConsultations = consultations.length;
    const completedConsultations = consultations.filter(c => c.status === 'COMPLETED').length;
    const inProgressConsultations = consultations.filter(c => c.status === 'IN_PROGRESS').length;
    const scheduledConsultations = consultations.filter(c => c.status === 'SCHEDULED').length;
    const cancelledConsultations = consultations.filter(c => c.status === 'CANCELLED').length;
    const consultationCompletionRate = totalConsultations > 0
      ? Math.round((completedConsultations / totalConsultations) * 100)
      : 100;

    // Prescriptions stats
    const totalPrescriptions = prescriptions.length;
    const dispensedPrescriptions = prescriptions.filter(p => p.status === 'DISPENSED').length;
    const issuedPrescriptions = prescriptions.filter(p => p.status === 'ISSUED').length;
    const revokedPrescriptions = prescriptions.filter(p => p.status === 'REVOKED').length;
    const signatureRate = totalPrescriptions > 0
      ? Math.round((signedPrescriptionsCount / totalPrescriptions) * 100)
      : 100;

    // Radiology stats
    const totalRadiology = radiologyStudies.length;
    const completedRadiology = radiologyStudies.filter(r => r.status === 'FINALIZED').length;
    const urgentRadiology = radiologyStudies.filter(r => r.isUrgent).length;
    const modalityBreakdown: Record<string, number> = {};
    for (const r of radiologyStudies) {
      modalityBreakdown[r.modality] = (modalityBreakdown[r.modality] || 0) + 1;
    }

    // Lab stats
    const totalLab = labOrders.length;
    const completedLab = labOrders.filter(l => l.status === 'COMPLETED').length;
    const criticalLab = labOrders.filter(l => l.isCritical).length;

    // Triage stats
    const totalTriage = triageAssessments.length;
    const avgEsiScore = totalTriage > 0
      ? Number((triageAssessments.reduce((sum, t) => sum + (t.esiScore || 3), 0) / totalTriage).toFixed(1))
      : 3.0;

    // Financial / Billing stats
    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID');
    const totalCollected = paidInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalPatientOutstanding = invoices.filter(inv => inv.status === 'PENDING').reduce((sum, inv) => sum + (inv.patientDue || 0), 0);
    const totalInsuranceCovered = invoices.reduce((sum, inv) => sum + (inv.insuranceCovered || 0), 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    const totalClaims = insuranceClaims.length;
    const approvedClaims = insuranceClaims.filter(c => c.status === 'APPROVED' || c.status === 'SETTLED').length;
    const claimApprovalRate = totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0;

    // Security & Compliance
    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL').length;
    const unresolvedViolations = violations.filter(v => !v.resolved).length;
    const openIncidents = incidents.filter(i => i.status !== 'CLOSED').length;

    const uptimeSeconds = Math.floor(process.uptime());
    const memUsage = process.memoryUsage();

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        lockedUsers,
        roles: rolesMap,
      },
      clinical: {
        totalConsultations,
        completedConsultations,
        inProgressConsultations,
        scheduledConsultations,
        cancelledConsultations,
        completionRate: consultationCompletionRate,
      },
      prescriptions: {
        totalPrescriptions,
        dispensed: dispensedPrescriptions,
        issued: issuedPrescriptions,
        revoked: revokedPrescriptions,
        signedCount: signedPrescriptionsCount,
        signatureRate,
      },
      diagnostics: {
        radiology: {
          total: totalRadiology,
          completed: completedRadiology,
          urgent: urgentRadiology,
          modalityBreakdown,
        },
        lab: {
          total: totalLab,
          completed: completedLab,
          critical: criticalLab,
        },
        triage: {
          total: totalTriage,
          avgEsiScore,
        },
      },
      financial: {
        totalBilled,
        totalCollected,
        totalPatientOutstanding,
        totalInsuranceCovered,
        collectionRate,
        totalClaims,
        approvedClaims,
        claimApprovalRate,
      },
      security: {
        auditEventsCount,
        unresolvedViolations,
        criticalViolations,
        alertsCount: alerts.length,
        openIncidents,
        invitationsCount,
        activeInvitationsCount,
      },
      system: {
        uptimeSeconds,
        dbLatencyMs,
        memoryRssMb: Math.round(memUsage.rss / (1024 * 1024)),
        memoryHeapUsedMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Error fetching admin statistics:', err);
    res.status(500).json({ error: 'Failed to load system-wide performance statistics' });
  }
});

// 1. List all users
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      lockedUntil: true,
      verificationStatus: true,
      medicalLicenseNo: true,
      licenseJurisdiction: true,
      specialty: true,
      verifiedAt: true,
      verifiedById: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

// 2. Provision staff (admin creates account with password or generated temporary credentials)
router.post('/users', async (req, res) => {
  try {
    const { email, firstName, lastName, role, medicalLicenseNo, licenseJurisdiction, specialty, password } = req.body;
    const adminUser = (req as any).user;

    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'Email, first name, last name, and role are required' });
    }
    if (role === Role.PATIENT) {
      return res.status(400).json({ error: 'Cannot assign PATIENT role via admin endpoint' });
    }
    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Use admin-supplied password if provided and valid (>= 8 chars), otherwise generate strong temporary password
    const rawPassword = (password && typeof password === 'string' && password.trim().length >= 8)
      ? password.trim()
      : crypto.randomBytes(12).toString('base64').replace(/[/+=]/g, 'A');
    const passwordHash = await argon2.hash(rawPassword);

    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        verificationStatus: VerificationStatus.VERIFIED,
        medicalLicenseNo: medicalLicenseNo?.trim() || null,
        licenseJurisdiction:
          licenseJurisdiction?.trim() ||
          (['DOCTOR', 'NURSE', 'PHARMACIST', 'RECEPTIONIST', 'ADMIN'].includes(role) ? 'US-NPI' : null),
        specialty: specialty?.trim() || (['DOCTOR', 'NURSE'].includes(role) ? 'General Practice' : (role === Role.ADMIN ? 'Hospital Administration' : null)),
        verifiedAt: new Date(),
        verifiedById: adminUser.id,
        createdById: adminUser.id,
        mustChangePassword: false,
        isActive: true,
      },
    });

    await logAudit('STAFF_ACCOUNT_PROVISIONED', `USER:${newUser.id}`, adminUser.id, req.ip);
    res.status(201).json({
      message: `${role} account provisioned successfully`,
      temporaryPassword: rawPassword,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        verificationStatus: newUser.verificationStatus,
        medicalLicenseNo: newUser.medicalLicenseNo,
        specialty: newUser.specialty,
      },
    });
  } catch (err: any) {
    console.error('Provision staff error:', err);
    res.status(500).json({ error: 'Failed to provision staff account' });
  }
});

// 3. Verify / reject practitioner credentials
router.put('/users/:id/verify-credentials', async (req, res) => {
  const { verificationStatus } = req.body;
  const adminUser = (req as any).user;
  if (!Object.values(VerificationStatus).includes(verificationStatus)) {
    return res.status(400).json({ error: 'Invalid verification status' });
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      verificationStatus,
      verifiedAt: new Date(),
      verifiedById: adminUser.id,
      isActive: verificationStatus === VerificationStatus.VERIFIED ? true : target.isActive,
    },
  });

  await logAudit(
    verificationStatus === VerificationStatus.VERIFIED
      ? 'PRACTITIONER_CREDENTIAL_VERIFIED'
      : 'PRACTITIONER_CREDENTIAL_REJECTED',
    `USER:${target.id}`,
    adminUser.id,
    req.ip,
  );
  res.json({ message: `Credentials updated to ${verificationStatus}`, user: updated });
});

// 4. Staff invitation endpoints (create, list, revoke)
// Default expiration: 5 minutes (enforces tight security for single-use onboarding tokens)
router.post('/invitations', async (req, res) => {
  try {
    const { email, role, expiresInMinutes, expiresInHours } = req.body;
    const adminUser = (req as any).user;
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }
    if (!Object.values(Role).includes(role) || role === Role.PATIENT) {
      return res.status(400).json({ error: 'Invalid role for invitation' });
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    
    // Explicitly set default expiration to 5 minutes
    const minutes = (() => {
  // Allow overriding default expiration via environment variable (in minutes)
  const envDefault = process.env.INVITE_DEFAULT_EXPIRATION_MINUTES
    ? Number(process.env.INVITE_DEFAULT_EXPIRATION_MINUTES)
    : 60; // default to 60 minutes for production use
  if (expiresInMinutes !== undefined) return Number(expiresInMinutes);
  if (expiresInHours !== undefined) return Number(expiresInHours) * 60;
  return envDefault;
})();
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    const invitation = await prisma.staffInvitation.create({
      data: { email: email.toLowerCase().trim(), role, tokenHash, invitedById: adminUser.id, expiresAt },
    });
    await logAudit('STAFF_INVITATION_CREATED', `INVITATION:${invitation.id}`, adminUser.id, req.ip);
    res.status(201).json({ message: 'Invitation created', token: rawToken, invitation, expiresInMinutes: minutes });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

router.get('/invitations', async (req, res) => {
  const invitations = await prisma.staffInvitation.findMany({
    include: { invitedBy: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invitations);
});

router.delete('/invitations/:id', async (req, res) => {
  const adminUser = (req as any).user;
  await prisma.staffInvitation.delete({ where: { id: req.params.id } });
  await logAudit('STAFF_INVITATION_REVOKED', `INVITATION:${req.params.id}`, adminUser.id, req.ip);
  res.json({ message: 'Invitation revoked' });
});

// 5. Change user role (cannot set to PATIENT)
router.put('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!Object.values(Role).includes(role) || role === Role.PATIENT) {
    return res.status(400).json({ error: 'Invalid or disallowed role' });
  }
  const adminUser = (req as any).user;
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
  await logAudit('USER_ROLE_CHANGED', `USER:${req.params.id}`, adminUser.id, req.ip);
  res.json({ message: 'Role updated', role: user.role });
});

// 6. Activate / deactivate user (admin cannot deactivate self)
router.put('/users/:id/status', async (req, res) => {
  const { isActive } = req.body;
  const adminUser = (req as any).user;
  const targetId = req.params.id;
  if (targetId === adminUser.id) {
    return res.status(400).json({ error: 'Admins cannot change their own activation status' });
  }
  const user = await prisma.user.update({
    where: { id: targetId },
    data: { isActive, lockedUntil: isActive ? null : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) },
  });
  await logAudit('USER_STATUS_CHANGED', `USER:${targetId}`, adminUser.id, req.ip);
  res.json({ message: 'Status updated', isActive: user.isActive });
});

// 7. Generate TOTP secret for a user
router.post('/users/:id/totp', async (req, res) => {
  const secret = speakeasy.generateSecret().base32;
  await prisma.user.update({ where: { id: req.params.id }, data: { totpSecret: secret } });
  await logAudit('TOTP_GENERATED', `USER:${req.params.id}`, (req as any).user.id, req.ip);
  res.json({ message: 'TOTP secret generated', secret });
});

// Helper function to completely and permanently purge a user and all cascade relations
async function purgeSingleUser(tx: any, targetId: string) {
  // 1. Clear administrative references to avoid foreign key errors
  await tx.user.updateMany({ where: { createdById: targetId }, data: { createdById: null } });
  await tx.user.updateMany({ where: { verifiedById: targetId }, data: { verifiedById: null } });
  await tx.staffInvitation.deleteMany({ where: { invitedById: targetId } });

  // 2. Anonymize user in chained audit logs to preserve cryptographic block hashes
  await tx.auditEvent.updateMany({ where: { userId: targetId }, data: { userId: null } });

  // 3. Delete patient GDPR, medical, consent & insurance records
  await tx.consent.deleteMany({ where: { patientId: targetId } });
  await tx.erasureRequest.deleteMany({ where: { userId: targetId } });
  await tx.medicalRecord.deleteMany({ where: { patientId: targetId } });
  await tx.clinicalFlag.deleteMany({ where: { patientId: targetId } });
  await tx.insuranceEligibility.deleteMany({ where: { patientId: targetId } });

  // 4. Delete patient invoices, invoice items, and payments
  const patientInvoices = await tx.invoice.findMany({ where: { patientId: targetId }, select: { id: true } });
  const pInvIds = patientInvoices.map((i: any) => i.id);
  if (pInvIds.length > 0) {
    await tx.insuranceClaim.deleteMany({ where: { invoiceId: { in: pInvIds } } });
    await tx.billingPayment.deleteMany({ where: { invoiceId: { in: pInvIds } } });
    await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: pInvIds } } });
    await tx.invoice.deleteMany({ where: { id: { in: pInvIds } } });
  }
  await tx.insuranceClaim.deleteMany({ where: { patientId: targetId } });

  // 5. Delete station orders where user is patient or staff
  await tx.labOrder.deleteMany({ where: { OR: [{ patientId: targetId }, { technicianId: targetId }] } });
  await tx.radiologyStudy.deleteMany({ where: { OR: [{ patientId: targetId }, { radiologistId: targetId }] } });
  await tx.triageAssessment.deleteMany({ where: { OR: [{ patientId: targetId }, { officerId: targetId }] } });
  await tx.carePlan.deleteMany({ where: { OR: [{ patientId: targetId }, { coordinatorId: targetId }] } });

  // 6. Delete prescriptions authored by doctor (with items & signatures)
  const docPrescriptions = await tx.prescription.findMany({ where: { doctorId: targetId }, select: { id: true } });
  const docRxIds = docPrescriptions.map((p: any) => p.id);
  if (docRxIds.length > 0) {
    await tx.prescriptionItem.deleteMany({ where: { prescriptionId: { in: docRxIds } } });
    await tx.digitalSignature.deleteMany({ where: { prescriptionId: { in: docRxIds } } });
    await tx.prescription.deleteMany({ where: { id: { in: docRxIds } } });
  }

  // 7. Delete consultations where user is patient or doctor (with vitals, sub-invoices, and notes)
  const consultations = await tx.consultation.findMany({
    where: { OR: [{ patientId: targetId }, { doctorId: targetId }] },
    select: { id: true }
  });
  const cIds = consultations.map((c: any) => c.id);
  if (cIds.length > 0) {
    const cRx = await tx.prescription.findMany({ where: { consultationId: { in: cIds } }, select: { id: true } });
    const cRxIds = cRx.map((p: any) => p.id);
    if (cRxIds.length > 0) {
      await tx.prescriptionItem.deleteMany({ where: { prescriptionId: { in: cRxIds } } });
      await tx.digitalSignature.deleteMany({ where: { prescriptionId: { in: cRxIds } } });
      await tx.prescription.deleteMany({ where: { id: { in: cRxIds } } });
    }
    await tx.vitalSign.deleteMany({ where: { consultationId: { in: cIds } } });
    await tx.clinicalFlag.deleteMany({ where: { consultationId: { in: cIds } } });
    await tx.labOrder.deleteMany({ where: { consultationId: { in: cIds } } });
    await tx.radiologyStudy.deleteMany({ where: { consultationId: { in: cIds } } });
    await tx.triageAssessment.deleteMany({ where: { consultationId: { in: cIds } } });

    const cInvoices = await tx.invoice.findMany({ where: { consultationId: { in: cIds } }, select: { id: true } });
    const cInvIds = cInvoices.map((i: any) => i.id);
    if (cInvIds.length > 0) {
      await tx.insuranceClaim.deleteMany({ where: { invoiceId: { in: cInvIds } } });
      await tx.billingPayment.deleteMany({ where: { invoiceId: { in: cInvIds } } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: cInvIds } } });
      await tx.invoice.deleteMany({ where: { id: { in: cInvIds } } });
    }

    await tx.consultation.deleteMany({ where: { id: { in: cIds } } });
  }

  // 8. Permanently delete the User record
  await tx.user.delete({ where: { id: targetId } });
}

// 8. Completely and permanently delete any user from the system
router.delete('/users/:id', async (req, res) => {
  try {
    const adminUser = (req as any).user;
    const targetId = req.params.id;

    if (targetId === adminUser.id) {
      return res.status(400).json({ error: 'Security restriction: Administrators cannot delete their own active account.' });
    }

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.$transaction(async (tx) => {
      await purgeSingleUser(tx, targetId);
    });

    await logAudit(
      'USER_PURGED_PERMANENTLY',
      `USER:${target.email}:${target.role}`,
      adminUser.id,
      req.ip
    );

    res.json({
      message: `User ${target.firstName} ${target.lastName} (${target.email} - ${target.role}) and all associated records have been permanently deleted from the system.`,
      deletedUserId: targetId,
    });
  } catch (err: any) {
    console.error('Error permanently deleting user:', err);
    res.status(500).json({ error: `Failed to delete user: ${err.message || 'Database error'}` });
  }
});

// 9. Batch/bulk permanent deletion of multiple users at once
router.post('/users/batch-delete', async (req, res) => {
  try {
    const adminUser = (req as any).user;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Array of userIds is required for batch deletion' });
    }

    // Filter out the admin's own ID
    const validTargetIds = userIds.filter((id: string) => id !== adminUser.id);
    if (validTargetIds.length === 0) {
      return res.status(400).json({ error: 'Cannot delete your own active administrator account.' });
    }

    const targets = await prisma.user.findMany({
      where: { id: { in: validTargetIds } },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    if (targets.length === 0) {
      return res.status(404).json({ error: 'No matching users found to delete.' });
    }

    await prisma.$transaction(async (tx) => {
      for (const target of targets) {
        await purgeSingleUser(tx, target.id);
      }
    });

    await logAudit(
      'USERS_BATCH_PURGED_PERMANENTLY',
      `COUNT:${targets.length}:USERS:${targets.map(t => t.email).join(',')}`,
      adminUser.id,
      req.ip
    );

    res.json({
      message: `Successfully purged ${targets.length} user account(s) and all associated records permanently from the system.`,
      deletedCount: targets.length,
      deletedUserIds: targets.map(t => t.id),
    });
  } catch (err: any) {
    console.error('Error in batch deleting users:', err);
    res.status(500).json({ error: `Failed to delete users in batch: ${err.message || 'Database error'}` });
  }
});

export default router;

