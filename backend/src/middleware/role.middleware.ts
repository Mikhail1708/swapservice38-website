// backend/src/middleware/role.middleware.ts
import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  // ✅ ТОЛЬКО ADMIN ИЛИ MANAGER
  if (user.role !== 'admin' && user.role !== 'manager') {
    return res.status(403).json({ error: 'Доступ запрещён. Требуется роль admin или manager' });
  }

  next();
};

export const requireAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  // ✅ ТОЛЬКО ADMIN
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ запрещён. Требуется роль admin' });
  }

  next();
};