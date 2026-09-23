import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { log } from '../../config/logger';
import { persistEmailEvent } from '../../services/emailOutbox.service';
import { commentModerationEmailTemplate } from '../../services/emailTemplates';

const validId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;

export const getArticleComments = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { after } = req.query;
  if (!validId(id) || (after !== undefined && !validId(after))) {
    res.status(400).json({ error: 'Некорректный идентификатор' });
    return;
  }
  try {
    if (!await prisma.article.findUnique({ where: { id }, select: { id: true } })) {
      res.status(404).json({ error: 'Статья не найдена' });
      return;
    }
    const rows = await prisma.comment.findMany({
      where: { articleId: id, ...(typeof after === 'string' ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' }, take: 51,
      select: { id: true, content: true, createdAt: true, parentId: true,
        author: { select: { firstName: true, lastName: true } } },
    });
    const page = rows.slice(0, 50);
    res.json({ comments: page.map(({ author, ...comment }) => ({ ...comment,
      author: [author.firstName, author.lastName].filter(Boolean).join(' ') || 'Аноним' })),
      nextCursor: rows.length > 50 ? page[49].id : null });
  } catch {
    log.error('Admin comments lookup failed');
    res.status(500).json({ error: 'Не удалось загрузить комментарии' });
  }
};

export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!validId(id)) {
    res.status(400).json({ error: 'Некорректный идентификатор комментария' });
    return;
  }
  if (!reason) {
    res.status(400).json({ error: 'Причина удаления обязательна' });
    return;
  }
  if (reason.length > 2000) {
    res.status(400).json({ error: 'Причина удаления не должна превышать 2000 символов' });
    return;
  }

  try {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, email: true, firstName: true } },
        article: { select: { slug: true, title: true } },
      },
    });
    if (!comment) {
      res.status(404).json({ error: 'Комментарий не найден' });
      return;
    }

    await prisma.comment.delete({ where: { id: comment.id } });

    if (comment.author.email) {
      try {
        await persistEmailEvent(prisma, {
          eventType: 'comment_moderation_deleted',
          aggregateId: comment.id,
          deduplicationKey: `comment-moderation-delete:${comment.id}`,
          payload: {
            to: comment.author.email,
            ...commentModerationEmailTemplate({ articleSlug: comment.article.slug,
              articleTitle: comment.article.title, comment: comment.content, reason }),
          },
        });
      } catch (error) {
        log.error('Comment moderation email enqueue failed', { errorName: error instanceof Error ? error.name : 'unknown', commentId: comment.id });
      }
    }

    res.json({ success: true, id: comment.id });
  } catch (error) {
    // Another moderator may have deleted this row between lookup and DELETE.
    if ((error as { code?: string })?.code === 'P2025') {
      res.status(404).json({ error: 'Комментарий не найден' });
      return;
    }
    log.error('Delete comment error', { errorName: error instanceof Error ? error.name : 'unknown' });
    res.status(500).json({ error: 'Не удалось удалить комментарий' });
  }
};
