// backend/src/middleware/role.middleware.ts
import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  if (!['admin', 'manager'].includes(user.role)) {
    return res.status(403).json({ error: 'Доступ запрещён. Требуется роль admin или manager' });
  }

  next();
};

export const requireAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён. Требуется роль admin' });
  }

  next();
};