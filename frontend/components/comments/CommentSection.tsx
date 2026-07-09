'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { Send, User, Reply, Loader2, MessageCircle, X } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  parentId: string | null;
  replies?: Comment[];
}

interface CommentSectionProps {
  articleId: string;
  initialComments: Comment[];
}

export function CommentSection({ articleId, initialComments }: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const findComment = (items: Comment[], id: string): Comment | null => {
    for (const c of items) {
      if (c.id === id) return c;
      if (c.replies) {
        const found = findComment(c.replies, id);
        if (found) return found;
      }
    }
    return null;
  };

  const replyTo = replyToId ? findComment(comments, replyToId) : null;

  const handleSubmit = async (e: React.FormEvent, parentId?: string) => {
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
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (parentId && data.parent) {
          const updateReplies = (items: Comment[]): Comment[] => {
            return items.map((c) => {
              if (c.id === parentId) {
                return data.parent;
              }
              if (c.replies) {
                return {
                  ...c,
                  replies: updateReplies(c.replies),
                };
              }
              return c;
            });
          };
          setComments(updateReplies(comments));
          setReplyToId(null);
          setReplyContent('');
        } else if (data.comment) {
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
    const isReplyActive = replyToId === comment.id;
    // Максимальная глубина — 5 уровней, дальше просто сжимаем
    const maxDepth = 5;
    const actualDepth = Math.min(depth, maxDepth);
    const indent = actualDepth * 8;

    return (
      <div style={{ marginLeft: depth > 0 ? `${indent}px` : 0 }} className="mb-2">
        <div className="bg-gray-50 rounded-2xl p-4 hover:bg-gray-100 transition">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center text-white font-medium text-xs">
                {comment.author?.charAt(0).toUpperCase() || 'А'}
              </div>
              <div>
                <span className="font-semibold text-black text-sm">
                  {comment.author || 'Аноним'}
                </span>
                <span className="text-xs text-gray-400 ml-2.5">
                  {new Date(comment.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            </div>
            {user && (
              <button
                onClick={() => setReplyToId(comment.id)}
                className="text-xs text-gray-400 hover:text-blue-600 transition flex items-center gap-1"
              >
                <Reply className="w-3.5 h-3.5" />
                Ответить
              </button>
            )}
          </div>
          <p className="text-gray-700 text-sm leading-relaxed pl-1">
            {comment.content}
          </p>
        </div>

        {/* Ответы */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-1 space-y-1">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}

        {/* Форма ответа */}
        {isReplyActive && (
          <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-2 mb-3">
            <div className="flex items-start gap-3 bg-white rounded-xl p-3 border border-gray-200">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-2">
                  <span>
                    Ответ <span className="font-medium text-black">@{comment.author}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setReplyToId(null); setReplyContent(''); }}
                    className="text-gray-400 hover:text-red-500 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Ответить ${comment.author}...`}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition resize-none"
                  rows={2}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setReplyToId(null);
                      setReplyContent('');
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !replyContent.trim()}
                  className="mt-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      <div className="space-y-2 mb-8">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} depth={0} />
        ))}
      </div>

      {user ? (
        <form onSubmit={(e) => handleSubmit(e)} className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0">
              {user.firstName?.[0]?.toUpperCase() || 'А'}
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Напишите комментарий..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition resize-none"
                rows={3}
              />
              <button
                type="submit"
                disabled={isSubmitting || !newComment.trim()}
                className="mt-3 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-200">
          <p className="text-gray-500">
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              Войдите
            </Link>
            , чтобы оставить комментарий
          </p>
        </div>
      )}
    </div>
  );
}