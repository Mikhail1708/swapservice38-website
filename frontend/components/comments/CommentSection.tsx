'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { Send, User, Reply, ThumbsUp, Loader2 } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  parentId: string | null;
  replies?: Comment[];
  _count: { likes: number };
}

interface CommentSectionProps {
  articleId: string;
  initialComments: Comment[];
}

export function CommentSection({ articleId, initialComments }: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent, parentId?: string, replyToUserId?: string) => {
    e.preventDefault();
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          content,
          parentId: parentId || null,
          replyToUserId: replyToUserId || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (parentId) {
          // Добавляем ответ к родительскому комментарию
          setComments(prev => prev.map(c => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: [...(c.replies || []), data.comment],
              };
            }
            return c;
          }));
          setReplyTo(null);
          setReplyContent('');
        } else {
          setComments([data.comment, ...comments]);
          setNewComment('');
        }
      }
    } catch (error) {
      console.error('Ошибка отправки комментария:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const [showReply, setShowReply] = useState(false);

    return (
      <div className={`${depth > 0 ? 'ml-8 pl-4 border-l-2 border-gray-200' : ''}`}>
        <div className="bg-gray-50 rounded-2xl p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm">
                {comment.author?.charAt(0) || 'А'}
              </div>
              <div>
                <span className="font-medium text-black text-sm">{comment.author || 'Аноним'}</span>
                <span className="text-xs text-gray-400 ml-3">
                  {new Date(comment.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setReplyTo({ id: comment.id, author: comment.author });
                setShowReply(true);
              }}
              className="text-xs text-gray-400 hover:text-black transition flex items-center gap-1"
            >
              <Reply className="w-3 h-3" />
              Ответить
            </button>
          </div>
          <p className="text-gray-600 font-light text-sm">{comment.content}</p>
          <div className="flex items-center gap-4 mt-2">
            <button className="text-xs text-gray-400 hover:text-black transition flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              {comment._count?.likes || 0}
            </button>
          </div>
        </div>

        {/* Ответы */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-3 mb-3">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}

        {/* Форма ответа */}
        {showReply && replyTo?.id === comment.id && (
          <form onSubmit={(e) => handleSubmit(e, comment.id, comment.authorId)} className="mb-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">
                  Ответ для <span className="font-medium text-black">{replyTo.author}</span>
                  <button
                    type="button"
                    onClick={() => { setReplyTo(null); setShowReply(false); }}
                    className="ml-2 text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Ответить ${replyTo.author}...`}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black/30 transition resize-none"
                  rows={2}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !replyContent.trim()}
                  className="mt-2 px-4 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Отправить
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <div className="border-t border-gray-200 pt-8 mt-8">
      <h3 className="text-xl font-bold text-black mb-6 flex items-center gap-2">
        <MessageCircle className="w-5 h-5" />
        Комментарии ({comments.length})
      </h3>

      <div className="space-y-4 mb-8">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {/* Основная форма комментария */}
      {user ? (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium flex-shrink-0">
              {user.firstName?.[0] || 'А'}
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Напишите комментарий..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:border-black/30 transition resize-none"
                rows={3}
              />
              <button
                type="submit"
                disabled={isSubmitting || !newComment.trim()}
                className="mt-3 px-6 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-6 text-center">
          <p className="text-gray-500">
            <Link href="/login" className="text-black font-medium hover:underline">
              Войдите
            </Link>
            , чтобы оставить комментарий
          </p>
        </div>
      )}
    </div>
  );
}