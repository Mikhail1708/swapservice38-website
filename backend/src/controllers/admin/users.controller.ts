import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================================
// ВАЛИДАЦИЯ ТЕЛЕФОНА
// ============================================================
const validatePhone = (phone: string): boolean => {
  if (!phone) return true; // Поле необязательное
  
  const digits = phone.replace(/\D/g, '');
  // Должно быть 11 цифр и начинаться с 7
  return digits.length === 11 && digits.startsWith('7');
};

// ============================================================
// GET /api/admin/users — список пользователей
// ============================================================
export const getUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { orders: true },
          },
        },
      }),
      prisma.user.count(),
    ]);

    res.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('❌ Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
};

// ============================================================
// GET /api/admin/users/:id — получить пользователя
// ============================================================
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
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
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { orders: true, appointments: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ user });
  } catch (error) {
    console.error('❌ Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
};

// ============================================================
// POST /api/admin/users — СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================
export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, address, role, isVerified } = req.body;

    // Проверка email
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    // Проверка пароля
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    // Валидация телефона
    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ error: 'Некорректный номер телефона' });
    }

    // Проверка на существующего пользователя
    const existing = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.trim(),
        passwordHash: hashedPassword,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        role: role || 'user',
        isVerified: isVerified ?? false,
      },
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
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({ user, message: 'Пользователь создан' });
  } catch (error) {
    console.error('❌ Ошибка создания пользователя:', error);
    res.status(500).json({ error: 'Ошибка создания пользователя' });
  }
};

// ============================================================
// PUT /api/admin/users/:id — ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, address, role, isVerified } = req.body;

    // Проверяем существование
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Валидация телефона
    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ error: 'Некорректный номер телефона' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        role: role || existing.role,
        isVerified: isVerified ?? existing.isVerified,
      },
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
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user, message: 'Пользователь обновлён' });
  } catch (error) {
    console.error('❌ Ошибка обновления пользователя:', error);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
};

// ============================================================
// DELETE /api/admin/users/:id — УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
// ============================================================
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Проверяем существование
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Не даём удалить самого себя
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }

    // Удаляем связанные данные (каскадно)
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.cart.deleteMany({ where: { userId: id } }),
      prisma.order.deleteMany({ where: { userId: id } }),
      prisma.appointment.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    res.json({ message: 'Пользователь удалён' });
  } catch (error) {
    console.error('❌ Ошибка удаления пользователя:', error);
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
};

// ============================================================
// PATCH /api/admin/users/:id/role — СМЕНА РОЛИ
// ============================================================
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Некорректная роль' });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Не даём понизить себя
    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: 'Нельзя изменить свою роль' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    res.json({ user, message: `Роль изменена на ${role}` });
  } catch (error) {
    console.error('❌ Ошибка смены роли:', error);
    res.status(500).json({ error: 'Ошибка смены роли' });
  }
};

// ============================================================
// POST /api/admin/users/:id/block — БЛОКИРОВКА
// ============================================================
export const blockUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if ((req as any).user?.id === id) {
      return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { blockedAt: new Date() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        blockedAt: true,
      },
    });

    res.json({ user, message: 'Пользователь заблокирован' });
  } catch (error) {
    console.error('❌ Ошибка блокировки:', error);
    res.status(500).json({ error: 'Ошибка блокировки' });
  }
};

// ============================================================
// POST /api/admin/users/:id/unblock — РАЗБЛОКИРОВКА
// ============================================================
export const unblockUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { blockedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        blockedAt: true,
      },
    });

    res.json({ user, message: 'Пользователь разблокирован' });
  } catch (error) {
    console.error('❌ Ошибка разблокировки:', error);
    res.status(500).json({ error: 'Ошибка разблокировки' });
  }
};

// ============================================================
// PUT /api/admin/users/:id/password — СМЕНА ПАРОЛЯ (админом)
// ============================================================
export const changeUserPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash: hashedPassword },
    });

    res.json({ message: 'Пароль изменён' });
  } catch (error) {
    console.error('❌ Ошибка смены пароля:', error);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
};