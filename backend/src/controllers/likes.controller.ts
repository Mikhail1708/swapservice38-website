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

    const article = await prisma.article.findUnique({
      where: { id: articleId },
    });
    if (!article) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    const existingLike = await prisma.like.findUnique({
      where: {
        userId_articleId: {
          userId,
          articleId,
        },
      },
    });

    if (existingLike) {
      await prisma.like.delete({
        where: {
          userId_articleId: {
            userId,
            articleId,
          },
        },
      });
      
      await prisma.article.update({
        where: { id: articleId },
        data: { likesCount: { decrement: 1 } },
      });

      res.json({ success: true, liked: false });
    } else {
      await prisma.like.create({
        data: {
          userId,
          articleId,
        },
      });

      await prisma.article.update({
        where: { id: articleId },
        data: { likesCount: { increment: 1 } },
      });

      res.json({ success: true, liked: true });
    }
  } catch (error: any) {
    console.error('❌ Toggle like error:', error);
    res.status(500).json({ error: 'Ошибка изменения лайка' });
  }
};

// ✅ ДОБАВЛЯЕМ ЭТУ ФУНКЦИЮ
export const getUserLikes = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const likes = await prisma.like.findMany({
      where: { userId },
      select: { articleId: true },
    });

    res.json({
      articleIds: likes.map(l => l.articleId),
    });
  } catch (error: any) {
    console.error('❌ Get user likes error:', error);
    res.status(500).json({ error: 'Ошибка получения лайков' });
  }
};
