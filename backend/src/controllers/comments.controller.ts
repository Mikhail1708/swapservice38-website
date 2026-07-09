// backend/src/controllers/comments.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { articleId, content, parentId, replyToUserId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    if (!articleId || !content) {
      res.status(400).json({ error: 'articleId и content обязательны' });
      return;
    }

    // Создаём комментарий
    const comment = await prisma.comment.create({
      data: {
        content,
        articleId,
        authorId: userId,
        parentId: parentId || null,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        replies: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    // ✅ Если это ответ — увеличиваем счётчик ответов у родителя
    if (parentId) {
      // Можно добавить поле repliesCount в Comment, если нужно
    }

    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        author: `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || 'Аноним',
        authorId: comment.author.id,
        createdAt: comment.createdAt,
        parentId: comment.parentId,
        replies: comment.replies || [],
        _count: { likes: 0 },
      },
    });
  } catch (error: any) {
    console.error('❌ Create comment error:', error);
    res.status(500).json({ error: error.message || 'Ошибка создания комментария' });
  }
};