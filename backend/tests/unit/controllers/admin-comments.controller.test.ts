import { PrismaClient } from '@prisma/client';
import { deleteComment, getArticleComments } from '../../../src/controllers/admin/comments.controller';
import { persistEmailEvent } from '../../../src/services/emailOutbox.service';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import adminRoutes from '../../../src/routes/admin.routes';
import csrfMiddleware, { getCsrfToken } from '../../../src/middleware/csrf.middleware';
import { credentialVersion } from '../../../src/utils/credentialVersion';
import { readFileSync } from 'fs';
import { resolve } from 'path';

jest.mock('../../../src/services/emailOutbox.service', () => ({
  persistEmailEvent: jest.fn(),
}));

const db = new PrismaClient() as any;
const enqueue = persistEmailEvent as jest.Mock;

const invoke = async (id: string, reason: unknown) => {
  const response: any = { statusCode: 200, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; } };
  await deleteComment({ params: { id }, body: { reason } } as any, response);
  return response;
};

describe('admin comment moderation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.comment.findUnique = jest.fn().mockResolvedValue({
      id: 'comment-1', content: '<bad>',
      author: { id: 'user-1', email: 'author@example.test', firstName: 'Author' },
      article: { id: 'article-1', slug: 'engine-swap-project', title: 'Article' },
    });
    db.comment.delete = jest.fn().mockResolvedValue({ id: 'comment-1' });
    enqueue.mockResolvedValue(undefined);
  });

  it('deletes a comment and queues an escaped moderation email', async () => {
    const response = await invoke('comment-1', '  Нарушение <правил>  ');
    expect(response.statusCode).toBe(200);
    expect(db.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
    expect(enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      deduplicationKey: 'comment-moderation-delete:comment-1',
      payload: expect.objectContaining({
        to: 'author@example.test',
        html: expect.not.stringContaining('<правил>'),
      }),
    }));
    const payload = enqueue.mock.calls[0][1].payload;
    expect(payload.subject).toContain('удалён модератором');
    expect(payload.html).toContain('&lt;bad&gt;');
    expect(payload.html).toContain('Нарушение &lt;правил&gt;');
    expect(payload.html).toContain('/swaps/engine-swap-project#comments');
    expect(payload.html).not.toContain('/swaps/article-1');
    expect(payload.html).toContain('<!doctype html>');
    expect(payload.text).toContain('Причина: Нарушение <правил>\n');
    expect(db.comment.delete.mock.invocationCallOrder[0]).toBeLessThan(enqueue.mock.invocationCallOrder[0]);
  });

  it.each([undefined, '', '   ', 123, {}, 'x'.repeat(2001)])('rejects invalid reason %#', async reason => {
    expect((await invoke('comment-1', reason)).statusCode).toBe(400);
    expect(db.comment.delete).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it.each(['', '   ', 'x'.repeat(129)])('rejects invalid ID %#', async id => {
    expect((await invoke(id, 'reason')).statusCode).toBe(400);
    expect(db.comment.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an empty or whitespace-only reason before deletion', async () => {
    expect((await invoke('comment-1', '   ')).statusCode).toBe(400);
    expect(db.comment.delete).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing comment', async () => {
    db.comment.findUnique.mockResolvedValue(null);
    expect((await invoke('missing', 'moderation')).statusCode).toBe(404);
    expect(db.comment.delete).not.toHaveBeenCalled();
  });

  it('deletes even when the author has no email', async () => {
    db.comment.findUnique.mockResolvedValue({ id: 'comment-1', content: 'text', author: { id: 'user-1', email: null }, article: { id: 'article-1', title: 'Article' } });
    expect((await invoke('comment-1', 'moderation')).statusCode).toBe(200);
    expect(db.comment.delete).toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('keeps deletion successful when email outbox fails', async () => {
    enqueue.mockRejectedValue(new Error('outbox unavailable'));
    expect((await invoke('comment-1', 'moderation')).statusCode).toBe(200);
    expect(db.comment.delete).toHaveBeenCalled();
  });

  it('returns safe 500 on deletion failure and never enqueues', async () => {
    db.comment.delete.mockRejectedValue(new Error('PRIVATE_DB_DETAIL'));
    const response = await invoke('comment-1', 'reason');
    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('PRIVATE_DB_DETAIL');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('concurrent/repeated delete returns 404 without a second email', async () => {
    db.comment.delete.mockResolvedValueOnce({ id: 'comment-1' }).mockRejectedValueOnce({ code: 'P2025' });
    const responses = await Promise.all([invoke('comment-1', 'reason'), invoke('comment-1', 'reason')]);
    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 404]);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('leaves replies to the existing SET NULL FK, not recursive deletion', async () => {
    const sql = readFileSync(resolve(__dirname, '../../../prisma/migrations/20260706025436_add_blog_models/migration.sql'), 'utf8');
    expect(sql).toMatch(/CONSTRAINT "Comment_parentId_fkey"[^;]+ON DELETE SET NULL/);
    await invoke('comment-1', 'reason');
    expect(db.comment.delete).toHaveBeenCalledTimes(1);
    expect(db.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
    const publicController = readFileSync(resolve(__dirname, '../../../src/controllers/articles.controller.ts'), 'utf8');
    expect(publicController).toContain('parentId: null, isHidden: false');
  });

  it('pages all comment depths without author email or unbounded reads', async () => {
    db.article.findUnique = jest.fn().mockResolvedValue({ id: 'article-1' });
    db.comment.findMany = jest.fn().mockResolvedValue(Array.from({ length: 51 }, (_, i) => ({
      id: `id-${i}`, content: 'reply', parentId: 'parent', author: { firstName: 'A', lastName: 'B' },
    })));
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await getArticleComments({ params: { id: 'article-1' }, query: { after: 'cursor' } } as any, res);
    expect(db.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 51, orderBy: { id: 'asc' }, where: { articleId: 'article-1', id: { gt: 'cursor' } },
    }));
    expect(res.json.mock.calls[0][0].comments).toHaveLength(50);
    expect(res.json.mock.calls[0][0].nextCursor).toBe('id-49');
    expect(db.comment.findMany.mock.calls[0][0].select.author.select).toEqual({ firstName: true, lastName: true });
  });

  describe('real admin route guards and CSRF', () => {
    const app = express();
    app.use(express.json(), cookieParser(), csrfMiddleware);
    app.get('/api/csrf-token', getCsrfToken);
    app.use('/api/admin', adminRoutes);

    const send = async (role?: string, csrf = true) => {
      db.user.findUnique = jest.fn().mockResolvedValue({ id: 'moderator', role, passwordHash: 'fixture-hash', blockedAt: null });
      const client = request.agent(app);
      const token = csrf ? (await client.get('/api/csrf-token')).body.csrfToken : undefined;
      let call = client.delete('/api/admin/comments/comment-1');
      if (role) call = call.set('Authorization', `Bearer ${jwt.sign({ id: 'moderator', cv: credentialVersion('fixture-hash') }, process.env.JWT_SECRET!)}`);
      if (token) call = call.set('X-CSRF-Token', token);
      return call.send({ reason: 'Moderated' });
    };

    it('rejects unauthenticated requests', async () => {
      expect((await send()).status).toBe(401);
      expect(db.comment.delete).not.toHaveBeenCalled();
    });
    it.each(['user', 'manager'])('rejects non-admin %s', async role => {
      expect((await send(role)).status).toBe(403);
      expect(db.comment.delete).not.toHaveBeenCalled();
    });
    it('rejects admin without CSRF', async () => {
      expect((await send('admin', false)).status).toBe(403);
      expect(db.comment.delete).not.toHaveBeenCalled();
    });
    it('allows admin with verified identity and CSRF', async () => {
      expect((await send('admin')).status).toBe(200);
      expect(db.comment.delete).toHaveBeenCalledTimes(1);
    });
  });
});
