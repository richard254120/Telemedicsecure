import { PrismaClient, Role, CareTeamStatus, AccessGrantStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clinician panel-access authorization.
 *
 * A doctor's accessible patients = care-team memberships (role DOCTOR, ACTIVE)
 * ∪ patients with a consultation assigned to them
 * ∪ patients who granted them a redeemed, still-active AccessGrant.
 *
 * A nurse's accessible patients = care-team memberships (role NURSE, ACTIVE) only.
 *
 * Any other role (ADMIN, RECEPTIONIST, station roles, ...) returns `null`,
 * meaning "unrestricted" — their existing directory visibility is preserved so
 * scheduling and station workflows do not regress.
 */
export async function getAccessiblePatientIds(user: any): Promise<string[] | null> {
  if (!user) return null;

  if (user.role === Role.NURSE) {
    const memberships = await prisma.careTeamMembership.findMany({
      where: { clinicianId: user.id, role: 'NURSE', status: CareTeamStatus.ACTIVE },
      select: { patientId: true },
    });
    return Array.from(new Set(memberships.map((m) => m.patientId)));
  }

  if (user.role === Role.DOCTOR) {
    const [memberships, consultations, grants] = await Promise.all([
      prisma.careTeamMembership.findMany({
        where: { clinicianId: user.id, role: 'DOCTOR', status: CareTeamStatus.ACTIVE },
        select: { patientId: true },
      }),
      prisma.consultation.findMany({
        where: { doctorId: user.id },
        select: { patientId: true },
      }),
      prisma.accessGrant.findMany({
        where: {
          doctorId: user.id,
          status: AccessGrantStatus.ACTIVE,
          redeemedAt: { not: null },
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { patientId: true },
      }),
    ]);

    const ids = [
      ...memberships.map((m) => m.patientId),
      ...consultations.map((c) => c.patientId),
      ...grants.map((g) => g.patientId),
    ];
    return Array.from(new Set(ids));
  }

  // ADMIN, RECEPTIONIST, station roles, PATIENT: unrestricted / unchanged
  return null;
}

/**
 * Single-patient authorization check. Returns true if the clinician may view
 * the patient's chart. Non-clinician roles always pass (they are unrestricted).
 */
export async function canViewPatient(user: any, patientId: string): Promise<boolean> {
  const accessible = await getAccessiblePatientIds(user);
  if (accessible === null) return true;
  return accessible.includes(patientId);
}

/**
 * Returns an active, redeemed, un-expired AccessGrant binding this doctor to
 * this patient, or null. Used to widen a doctor's read access temporarily.
 */
export async function getActiveGrantForDoctor(doctorId: string, patientId: string) {
  return prisma.accessGrant.findFirst({
    where: {
      doctorId,
      patientId,
      status: AccessGrantStatus.ACTIVE,
      redeemedAt: { not: null },
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: 'desc' },
  });
}

/**
 * Writes a PatientAccessEvent row — the patient-facing "who viewed my record"
 * log. AuditEvent has no patientId field, so we record access explicitly here.
 * Never throws: a logging failure must not break a legitimate clinical read.
 */
export async function logPatientAccess(params: {
  patientId: string;
  viewerId: string;
  viewerRole: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
}): Promise<void> {
  try {
    await prisma.patientAccessEvent.create({
      data: {
        patientId: params.patientId,
        viewerId: params.viewerId,
        viewerRole: params.viewerRole,
        action: params.action,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
      },
    });
    // Touch the grant's lastAccessAt when this read rode on a temporary grant.
    if (params.resourceType === 'MEDICAL_RECORD' || params.action === 'READ_MEDICAL_RECORD') {
      const grant = await prisma.accessGrant.findFirst({
        where: {
          doctorId: params.viewerId,
          patientId: params.patientId,
          status: AccessGrantStatus.ACTIVE,
        },
      });
      if (grant) {
        await prisma.accessGrant.update({
          where: { id: grant.id },
          data: { lastAccessAt: new Date() },
        });
      }
    }
  } catch (err) {
    console.warn('[panelAccess] failed to log patient access:', err);
  }
}
