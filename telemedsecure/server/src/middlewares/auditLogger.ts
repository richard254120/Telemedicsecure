import { Request, Response, NextFunction } from 'express';
import { createChainedAuditEvent } from '../services/audit.service';

export const auditLogger = (action: string, resource: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function (body) {
      res.locals.body = body;
      return originalSend.call(this, body);
    };

    res.on('finish', async () => {
      const userId = (req as any).user?.id || null;
      
      try {
        await createChainedAuditEvent({
          userId,
          action,
          resource,
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
        });
      } catch (error) {
        console.error('Audit Log Failed:', error);
      }
    });

    next();
  };
};
