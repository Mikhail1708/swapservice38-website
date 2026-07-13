// frontend/backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  console.log('🔐 Auth middleware (сайт)');
  console.log('🍪 Cookies:', req.cookies);
  console.log('📝 Headers Authorization:', req.headers.authorization);
  
  let token = req.cookies?.token;
  
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      console.log('🔑 Токен из Authorization header');
    }
  }

  if (!token) {
    console.log('❌ Токен не найден ни в cookies, ни в headers');
    return res.status(401).json({ error: 'Не авторизован' });
  }

  console.log('🔑 Токен найден:', token.substring(0, 20) + '...');

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET не настроен!');
      return res.status(500).json({ error: 'Ошибка конфигурации сервера' });
    }

    console.log('🔑 Проверка токена с секретом:', JWT_SECRET.substring(0, 10) + '...');
    
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string | number };
    console.log('✅ Токен валиден, userId:', decoded.id);

    // ✅ ПРИВОДИМ ID К СТРОКЕ (для поддержки UUID и чисел)
    const userId = String(decoded.id);
    console.log('🔄 Приведённый userId:', userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        role: true,
        isVerified: true,
        blockedAt: true,
      }
    });

    if (!user) {
      console.log('❌ Пользователь не найден в БД');
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    if (user.blockedAt) {
      console.log('❌ Пользователь заблокирован');
      return res.status(403).json({ error: 'Пользователь заблокирован' });
    }

    console.log('✅ Пользователь найден:', user.email);
    (req as any).user = user;
    next();
  } catch (error: any) {
    console.error('❌ Ошибка верификации токена:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Невалидный токен' });
    }
    
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};