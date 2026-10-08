import { Router, Request, Response } from 'express';
import { PrismaClient, Role, Severity } from '@prisma/client';
import { requireAuth, requireRole } from '../middlewares/auth';
import { rulesEngine, RULE_DEFINITIONS, RuleId } from '../services/rulesEngine.service';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

/**
 * GET /api/v1/compliance/rules
 * Returns definitions of all 9 rules, HIPAA & GDPR clauses, and severities
 */
router.get('/rules', async (req: Request, res: Response) => {
  res.json(Object.values(RULE_DEFINITIONS));
});

/**
 * GET /api/v1/compliance/violations
 * Retrieve all ComplianceViolations with optional filtering
 */
router.get('/violations', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const { resolved, severity, ruleId, limit = '100' } = req.query;

  const where: any = {};
  if (resolved !== undefined) {
    where.resolved = resolved === 'true';
  }
  if (severity && Object.values(Severity).includes(severity as Severity)) {
    where.severity = severity as Severity;
  }
  if (ruleId) {
    where.ruleId = ruleId as string;
  }

  const violations = await prisma.complianceViolation.findMany({
    where,
    take: parseInt(limit as string, 10),
    orderBy: { reportedAt: 'desc' },
  });

  res.json(violations);
});

/**
 * GET /api/v1/compliance/alerts
 * Retrieve all SecurityAlerts
 */
router.get('/alerts', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const { limit = '100' } = req.query;

  const alerts = await prisma.securityAlert.findMany({
    take: parseInt(limit as string, 10),
    orderBy: { createdAt: 'desc' },
  });

  res.json(alerts);
});

/**
 * POST /api/v1/compliance/violations/:id/resolve
 * Mark a compliance violation as resolved
 */
router.post('/violations/:id/resolve', requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const violation = await prisma.complianceViolation.update({
    where: { id },
    data: { resolved: true },
  });

  res.json({ message: 'Compliance violation marked as resolved', violation });
});

/**
 * POST /api/v1/compliance/simulate
 * Explicitly trigger any of the 9 rules for live testing, demonstration, or evaluation
 */
router.post('/simulate', requireRole([Role.ADMIN, Role.DOCTOR]), async (req: Request, res: Response) => {
  const { ruleId, customDescription, targetUserId, resource, metadata } = req.body;

  if (!ruleId || !RULE_DEFINITIONS[ruleId as RuleId]) {
    return res.status(400).json({
      error: `Invalid ruleId. Must be one of: ${Object.keys(RULE_DEFINITIONS).join(', ')}`,
    });
  }

  const user = (req as any).user;

  try {
    const result = await rulesEngine.triggerViolation({
      ruleId: ruleId as RuleId,
      description: customDescription,
      userId: targetUserId || user.id,
      resource: resource || `Simulation:${ruleId}`,
      sourceIp: req.ip || req.socket.remoteAddress,
      metadata: metadata || { simulated: true, triggeredBy: user.email },
    });

    res.json({
      message: `Rule ${ruleId} triggered successfully. ComplianceViolation and SecurityAlert created and dispatched via Socket.IO.`,
      violation: result.violation,
      alert: result.alert,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
