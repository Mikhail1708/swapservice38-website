import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById } from '../services/auth.service';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token; // нужно установить cookie-parser

  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    const user = await getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Неверный токен' });
  }
};