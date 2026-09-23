// backend/src/controllers/comments.controller.ts
import { Request, Response } from 'express';

import { prisma } from '../config/prisma';
import { persistEmailEvent } from '../services/emailOutbox.service';
import { commentReplyEmailTemplate } from '../services/emailTemplates';

export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { articleId, content, parentId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    if (!articleId || !content) {
      res.status(400).json({ error: 'articleId и content обязательны' });
      return;
    }

    const article = await prisma.article.findUnique({
      where: { id: articleId },
    });
    if (!article) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }

    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
        include: { author: { select: { id: true, email: true, firstName: true, lastName: true } }, article: { select: { id: true, title: true } } },
      });
      if (!parent) {
        res.status(404).json({ error: 'Родительский комментарий не найден' });
        return;
      }
      if (parent.articleId !== articleId) {
        res.status(400).json({ error: 'Комментарий не относится к этой статье' });
        return;
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        articleId,
        authorId: userId,
        parentId: parentId || null,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const formattedComment = {
      id: comment.id,
      content: comment.content,
      author: `${comment.author.firstName || ''} ${comment.author.lastName || ''}`.trim() || 'Аноним',
      authorId: comment.author.id,
      createdAt: comment.createdAt,
      parentId: comment.parentId,
      replies: [],
    };

    if (parentId) {
      try {
        const parent = await prisma.comment.findUnique({
          where: { id: parentId },
          include: { author: { select: { id: true, email: true, firstName: true, lastName: true } }, article: { select: { slug: true, title: true } } },
        });
        if (parent?.author.email && parent.author.id !== userId) {
          await persistEmailEvent(prisma, {
            eventType: 'comment_reply_notification', aggregateId: comment.id,
            deduplicationKey: `comment-reply:${comment.id}`,
            payload: {
              to: parent.author.email,
              ...commentReplyEmailTemplate({ articleSlug: parent.article.slug, articleTitle: parent.article.title,
                comment: parent.content, reply: comment.content }),
            },
          });
        }
      } catch (error) {
        console.error('Comment reply email enqueue failed', { errorName: error instanceof Error ? error.name : 'unknown' });
      }
    }

    // Если это ответ — возвращаем обновлённого родителя со всеми ответами (до 5 уровней)
    if (parentId) {
      const getCommentWithReplies = async (id: string, depth: number = 0): Promise<any> => {
        if (depth > 5) return null;
        
        const c = await prisma.comment.findUnique({
          where: { id },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
            replies: {
              where: { isHidden: false },
              include: {
                author: { select: { id: true, firstName: true, lastName: true } },
                replies: {
                  where: { isHidden: false },
                  include: {
                    author: { select: { id: true, firstName: true, lastName: true } },
                    replies: {
                      where: { isHidden: false },
                      include: {
                        author: { select: { id: true, firstName: true, lastName: true } },
                      },
                      orderBy: { createdAt: 'asc' },
                    },
                  },
                  orderBy: { createdAt: 'asc' },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        if (!c) return null;

        return {
          id: c.id,
          content: c.content,
          author: `${c.author.firstName || ''} ${c.author.lastName || ''}`.trim() || 'Аноним',
          authorId: c.author.id,
          createdAt: c.createdAt,
          parentId: c.parentId,
          replies: await Promise.all((c.replies || []).map((r: any) => getCommentWithReplies(r.id, depth + 1))),
        };
      };

      const parentWithReplies = await getCommentWithReplies(parentId, 0);

      res.status(201).json({
        success: true,
        comment: formattedComment,
        parent: parentWithReplies,
      });
      return;
    }

    res.status(201).json({
      success: true,
      comment: formattedComment,
    });
  } catch (error: any) {
    console.error('❌ Create comment error:', error);
    res.status(500).json({ error: 'Ошибка создания комментария' });
  }
};
