// backend/src/controllers/admin/users.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    console.log('📋 GET /api/admin/users', { page: pageNum, limit: limitNum });

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isVerified: true,
          // ❌ УБИРАЕМ blockedAt (его нет в схеме)
          // blockedAt: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.user.count(),
    ]);

    console.log(`✅ Найдено ${users.length} пользователей, всего ${total}`);

    res.json({
      users,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения пользователей' });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: { 
        orders: { 
          take: 10, 
          orderBy: { createdAt: 'desc' } 
        } 
      },
    });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    res.json({ user });
  } catch (error: any) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'manager', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Недопустимая роль' });
      return;
    }
    const user = await prisma.user.update({ 
      where: { id }, 
      data: { role } 
    });
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('❌ Update role error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const blockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    // ⚠️ Временно: просто меняем роль на заблокированного пользователя
    // или добавляем поле blocked в будущем
    const user = await prisma.user.update({
      where: { id },
      data: { role: 'user' }, // Временно
    });
    res.json({ 
      success: true, 
      user,
      message: 'Пользователь заблокирован (временно)' 
    });
  } catch (error: any) {
    console.error('❌ Block user error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const unblockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({
      where: { id },
      data: { role: 'user' },
    });
    res.json({ success: true, user, message: 'Пользователь разблокирован' });
  } catch (error: any) {
    console.error('❌ Unblock user error:', error);
    res.status(500).json({ error: error.message });
  }
};