// swapservice38-website/backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  console.log('🔐 Auth middleware (сайт)');
  
  let token = req.cookies?.token;
  
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    console.log('❌ Токен не найден');
    return res.status(401).json({ error: 'Не авторизован' });
  }

  try {
    console.log('🔑 Проверка токена в своей БД...');
    
    // ✅ ПРОВЕРЯЕМ ТОКЕН СВОИМ СЕКРЕТОМ
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    console.log('✅ Токен валиден, userId:', decoded.id);

    // ✅ ИЩЕМ ПОЛЬЗОВАТЕЛЯ В СВОЕЙ БД
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        role: true,
        isVerified: true,
      }
    });

    if (!user) {
      console.log('❌ Пользователь не найден в БД');
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    console.log('✅ Пользователь найден:', user.email);
    (req as any).user = user;
    next();
  } catch (error: any) {
    console.error('❌ Ошибка верификации токена:', error.message);
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};