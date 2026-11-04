import { Router, Request, Response } from 'express';
import { PrismaClient, Role, CareTeamRole, CareTeamStatus } from '@prisma/client';
import { requireAuth } from '../middlewares/auth';
import { createChainedAuditEvent } from '../services/audit.service';
import { canViewPatient } from '../services/panelAccess.service';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

const clinicianSelect = { id: true, firstName: true, lastName: true, email: true, role: true };

/**
 * GET /api/v1/care-team/team/:patientId
 * Return a patient's active care team. Requester must be the patient, an
 * active member of that team, or an admin.
 */
router.get('/team/:patientId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const patientId = String(req.params.patientId);

    const members = await prisma.careTeamMembership.findMany({
      where: { patientId, status: CareTeamStatus.ACTIVE },
      include: { clinician: { select: clinicianSelect } },
      orderBy: { createdAt: 'asc' },
    });

    const isPatient = user.role === Role.PATIENT && user.id === patientId;
    const isAdmin = user.role === Role.ADMIN;
    const isMember = members.some((m) => m.clinicianId === user.id);

    if (!isPatient && !isAdmin && !isMember) {
      return res.status(403).json({ error: 'Access denied: Not a member of this care team' });
    }

    res.json({
      patientId,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        source: m.source,
        clinician: m.clinician,
        createdAt: m.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch care team', details: err.message });
  }
});

/**
 * POST /api/v1/care-team/team
 * Add a clinician (DOCTOR or NURSE) to a patient's care team. Allowed for the
 * patient themselves, an admin, or a doctor already assigned to the patient.
 */
router.post('/team', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { patientId, clinicianId } = req.body;

    if (!patientId || !clinicianId) {
      return res.status(400).json({ error: 'patientId and clinicianId are required' });
    }

    const clinician = await prisma.user.findFirst({
      where: { id: clinicianId, role: { in: [Role.DOCTOR, Role.NURSE] }, isActive: true },
      select: { ...clinicianSelect },
    });
    if (!clinician) return res.status(404).json({ error: 'Clinician not found or inactive' });

    // Authorization: patient self, admin, or an assigned doctor on this panel.
    const isPatient = user.role === Role.PATIENT && user.id === patientId;
    const isAdmin = user.role === Role.ADMIN;
    const isAssignedDoctor = user.role === Role.DOCTOR && await canViewPatient(user, patientId);
    if (!isPatient && !isAdmin && !isAssignedDoctor) {
      await createChainedAuditEvent({
        action: 'CARE_TEAM_ADD_DENIED',
        resource: `Patient:${patientId}`,
        userId: user.id,
        ipAddress: req.ip || 'unknown',
      });
      return res.status(403).json({ error: 'Forbidden: You cannot modify this care team' });
    }

    const role: CareTeamRole = clinician.role === Role.NURSE ? CareTeamRole.NURSE : CareTeamRole.DOCTOR;

    const membership = await prisma.careTeamMembership.upsert({
      where: { patientId_clinicianId: { patientId, clinicianId } },
      create: {
        patientId,
        clinicianId,
        role,
        status: CareTeamStatus.ACTIVE,
        source: user.role === Role.PATIENT ? 'PATIENT_ISSUED' : 'MANUAL',
      },
      update: { status: CareTeamStatus.ACTIVE, role },
      include: { clinician: { select: clinicianSelect } },
    });

    await createChainedAuditEvent({
      action: 'CARE_TEAM_MEMBER_ADDED',
      resource: `CareTeamMembership:${membership.id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    res.status(201).json({
      id: membership.id,
      patientId,
      role: membership.role,
      status: membership.status,
      clinician: membership.clinician,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add care team member', details: err.message });
  }
});

/**
 * POST /api/v1/care-team/team/remove
 * Deactivate a care-team membership. Allowed for the patient, an admin, or a
 * doctor on the panel.
 */
router.post('/team/remove', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { patientId, clinicianId } = req.body;

    if (!patientId || !clinicianId) {
      return res.status(400).json({ error: 'patientId and clinicianId are required' });
    }

    const isPatient = user.role === Role.PATIENT && user.id === patientId;
    const isAdmin = user.role === Role.ADMIN;
    const isAssignedDoctor = user.role === Role.DOCTOR && await canViewPatient(user, patientId);
    if (!isPatient && !isAdmin && !isAssignedDoctor) {
      return res.status(403).json({ error: 'Forbidden: You cannot modify this care team' });
    }

    const membership = await prisma.careTeamMembership.findUnique({
      where: { patientId_clinicianId: { patientId, clinicianId } },
    });
    if (!membership) return res.status(404).json({ error: 'Membership not found' });

    const updated = await prisma.careTeamMembership.update({
      where: { id: membership.id },
      data: { status: CareTeamStatus.INACTIVE },
    });

    await createChainedAuditEvent({
      action: 'CARE_TEAM_MEMBER_REMOVED',
      resource: `CareTeamMembership:${membership.id}`,
      userId: user.id,
      ipAddress: req.ip || 'unknown',
    });

    res.json({ id: updated.id, status: updated.status });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove care team member', details: err.message });
  }
});

export default router;
