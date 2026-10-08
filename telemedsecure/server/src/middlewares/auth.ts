import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    (req as any).user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user || !allowedRoles.includes(user.role)) {
      try {
        const { rulesEngine } = await import('../services/rulesEngine.service');
        await rulesEngine.triggerViolation({
          ruleId: 'ACCESS_OUTSIDE_ROLE_ASSIGNMENT',
          description: `User ${user?.id || 'anonymous'} with role ${user?.role || 'NONE'} attempted unauthorized access to role-protected resource: ${req.originalUrl}`,
          userId: user?.id || null,
          resource: req.originalUrl,
          sourceIp: req.ip || 'unknown',
          metadata: { requiredRoles: allowedRoles, currentRole: user?.role },
        });
      } catch (e) {
        console.error('RulesEngine trigger failed:', e);
      }
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    
    next();
  };
};
