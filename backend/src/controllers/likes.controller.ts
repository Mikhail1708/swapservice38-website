// backend/src/controllers/likes.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const toggleLike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { articleId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    if (!articleId) {
      res.status(400).json({ error: 'articleId обязателен' });
      return;
    }

    // Проверяем существование лайка
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_articleId: {
          userId,
          articleId,
        },
      },
    });

    if (existingLike) {
      // Удаляем лайк
      await prisma.like.delete({
        where: {
          userId_articleId: {
            userId,
            articleId,
          },
        },
      });
      
      // Обновляем счётчик
      await prisma.article.update({
        where: { id: articleId },
        data: { likesCount: { decrement: 1 } },
      });

      res.json({ success: true, liked: false });
    } else {
      // Создаём лайк
      await prisma.like.create({
        data: {
          userId,
          articleId,
        },
      });

      // Обновляем счётчик
      await prisma.article.update({
        where: { id: articleId },
        data: { likesCount: { increment: 1 } },
      });

      res.json({ success: true, liked: true });
    }
  } catch (error: any) {
    console.error('❌ Toggle like error:', error);
    res.status(500).json({ error: error.message || 'Ошибка изменения лайка' });
  }
};