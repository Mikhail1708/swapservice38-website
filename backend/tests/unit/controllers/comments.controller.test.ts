import { PrismaClient } from '@prisma/client';
import { createComment } from '../../../src/controllers/comments.controller';
import { persistEmailEvent } from '../../../src/services/emailOutbox.service';

jest.mock('../../../src/services/emailOutbox.service', () => ({
  persistEmailEvent: jest.fn(),
}));

const db = new PrismaClient() as any;
const enqueue = persistEmailEvent as jest.Mock;
db.comment.findUnique = jest.fn();

const invoke = async (userId: string, body: any) => {
  const response: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; },
  };
  await createComment({ body, user: { id: userId } } as any, response);
  return response;
};

describe('comment reply email notification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.article.findUnique.mockResolvedValue({ id: 'article-1', title: 'Article' });
    db.comment.create.mockResolvedValue({
      id: 'reply-1', content: 'Ответ', parentId: 'parent-1', createdAt: new Date(),
      author: { id: 'user-b', firstName: 'B', lastName: 'User' },
    });
    db.comment.findUnique.mockResolvedValue({
      id: 'parent-1', articleId: 'article-1', content: 'Исходный комментарий',
      parentId: null, author: { id: 'user-a', email: 'a@example.test', firstName: 'A', lastName: 'User' },
      article: { id: 'article-1', title: 'Article' }, replies: [],
    });
    enqueue.mockResolvedValue(undefined);
  });

  it('queues one notification for a reply by another user with the expected payload', async () => {
    const response = await invoke('user-b', { articleId: 'article-1', parentId: 'parent-1', content: 'Ответ' });

    expect(response.statusCode).toBe(201);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][1]).toEqual(expect.objectContaining({
      eventType: 'comment_reply_notification',
      aggregateId: 'reply-1',
      deduplicationKey: 'comment-reply:reply-1',
      payload: expect.objectContaining({
        to: 'a@example.test',
        subject: expect.stringContaining('SWAPSERVICE38'),
        text: expect.stringContaining('/swaps/article-1#comments'),
        html: expect.stringContaining('Исходный комментарий'),
      }),
    }));
  });

  it('does not notify when a user replies to their own comment', async () => {
    db.comment.findUnique.mockResolvedValue({
      id: 'parent-1', articleId: 'article-1', content: 'Свой комментарий', parentId: null,
      author: { id: 'user-a', email: 'a@example.test', firstName: 'A', lastName: 'User' },
      article: { id: 'article-1', title: 'Article' }, replies: [],
    });

    const response = await invoke('user-a', { articleId: 'article-1', parentId: 'parent-1', content: 'Ответ себе' });
    expect(response.statusCode).toBe(201);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('creates the reply without email when the parent author has no email', async () => {
    db.comment.findUnique.mockResolvedValue({
      id: 'parent-1', articleId: 'article-1', content: 'Комментарий', parentId: null,
      author: { id: 'user-a', email: null, firstName: 'A', lastName: 'User' },
      article: { id: 'article-1', title: 'Article' }, replies: [],
    });

    const response = await invoke('user-b', { articleId: 'article-1', parentId: 'parent-1', content: 'Ответ' });
    expect(response.statusCode).toBe(201);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not turn a successful reply into an error when email enqueue fails', async () => {
    enqueue.mockRejectedValue(new Error('outbox unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await invoke('user-b', { articleId: 'article-1', parentId: 'parent-1', content: 'Ответ' });
      expect(response.statusCode).toBe(201);
      expect(db.comment.create).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
