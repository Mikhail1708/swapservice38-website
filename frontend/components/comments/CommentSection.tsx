'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { Send, User, Reply, Loader2, X, ChevronDown, ChevronRight } from 'lucide-react';

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

export const countAllComments = (comments: Comment[] | null | undefined): number => {
  if (!comments || !Array.isArray(comments)) return 0;
  let count = 0;
  for (const c of comments) {
    count += 1;
    if (c.replies && Array.isArray(c.replies)) {
      count += countAllComments(c.replies);
    }
  }
  return count;
};

const ReplyForm = ({ 
  comment,
  replyContent,
  setReplyContent,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  comment: Comment;
  replyContent: string;
  setReplyContent: (value: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) => {
  return (
    <form onSubmit={onSubmit} className="mt-2">
      <div className="flex items-start gap-2 bg-white rounded-xl p-3 border border-gray-200">
        <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-xs flex-shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
            <span>
              Ответ <span className="font-medium text-blue-600">@{comment.author}</span>
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-red-500 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={`Ответить ${comment.author}...`}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition resize-none"
            rows={2}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onCancel();
              }
            }}
          />
          <button
            type="submit"
            disabled={isSubmitting || !replyContent.trim()}
            className="mt-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Отправить
          </button>
        </div>
      </div>
    </form>
  );
};

const CommentItem = ({ 
  comment, 
  depth = 0,
  replyToId,
  setReplyToId,
  replyContent,
  setReplyContent,
  isSubmitting,
  handleSubmit,
  collapsed,
  toggleCollapse,
  isRepliesCollapsed,
  toggleRepliesCollapse,
}: {
  comment: Comment;
  depth?: number;
  replyToId: string | null;
  setReplyToId: (id: string | null) => void;
  replyContent: string;
  setReplyContent: (value: string) => void;
  isSubmitting: boolean;
  handleSubmit: (e: React.FormEvent, parentId?: string) => Promise<void>;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  isRepliesCollapsed: Set<string>;
  toggleRepliesCollapse: (id: string) => void;
}) => {
  const { user } = useAuth();
  const isReplyActive = replyToId === comment.id;
  const hasReplies = comment.replies && Array.isArray(comment.replies) && comment.replies.length > 0;
  const totalRepliesCount = hasReplies ? countAllComments(comment.replies) : 0;
  
  const isCollapsed = collapsed.has(comment.id);
  const areRepliesCollapsed = isRepliesCollapsed.has(comment.id);
  
  const MAX_DEPTH = 5;
  const isMaxDepth = depth >= MAX_DEPTH;

  if (isCollapsed) {
    return (
      <div className="relative py-1 px-3 hover:bg-gray-50 rounded-lg cursor-pointer" onClick={() => toggleCollapse(comment.id)}>
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">{comment.author}</span>
          <span className="text-xs text-gray-400">
            {new Date(comment.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {depth > 0 && depth <= MAX_DEPTH && (
        <div className="absolute left-0 top-0 bottom-0 border-l-2 border-gray-200" style={{ left: `${(depth - 1) * 20 + 4}px` }} />
      )}
      <div className="relative" style={{ paddingLeft: depth > 0 && depth <= MAX_DEPTH ? `${Math.min(depth, MAX_DEPTH) * 20 + 8}px` : 0 }}>
        <div className={`py-2 px-3 rounded-lg hover:bg-gray-50 transition ${isReplyActive ? 'bg-gray-50' : ''}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-xs flex-shrink-0">
              {comment.author?.charAt(0).toUpperCase() || 'А'}
            </div>
            <span className="font-medium text-sm text-gray-800">{comment.author || 'Аноним'}</span>
            {isMaxDepth && comment.parentId && <span className="text-xs text-blue-500">@{comment.author}</span>}
            <span className="text-xs text-gray-400">
              {new Date(comment.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <p className="text-sm text-gray-800 mt-1 leading-relaxed pl-7 break-words">{comment.content}</p>

          <div className="flex items-center gap-4 mt-1.5 pl-7">
            {user && (
              <button
                onClick={() => setReplyToId(comment.id)}
                className="text-xs text-gray-400 hover:text-blue-600 transition flex items-center gap-1 font-medium"
              >
                <Reply className="w-3.5 h-3.5" />
                Ответить
              </button>
            )}
          </div>

          {isReplyActive && (
            <ReplyForm
              comment={comment}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              isSubmitting={isSubmitting}
              onSubmit={(e) => handleSubmit(e, comment.id)}
              onCancel={() => { setReplyToId(null); setReplyContent(''); }}
            />
          )}

          {hasReplies && (
            <div className="mt-1.5 pl-7">
              <button
                onClick={() => toggleRepliesCollapse(comment.id)}
                className="text-xs text-gray-400 hover:text-blue-600 transition flex items-center gap-1 font-medium"
              >
                {areRepliesCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{totalRepliesCount} {totalRepliesCount === 1 ? 'ответ' : 'ответов'}</span>
              </button>
            </div>
          )}

          {hasReplies && !areRepliesCollapsed && (
            <div className="mt-1 space-y-0.5">
              {comment.replies!.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  replyToId={replyToId}
                  setReplyToId={setReplyToId}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  isSubmitting={isSubmitting}
                  handleSubmit={handleSubmit}
                  collapsed={collapsed}
                  toggleCollapse={toggleCollapse}
                  isRepliesCollapsed={isRepliesCollapsed}
                  toggleRepliesCollapse={toggleRepliesCollapse}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export function CommentSection({ articleId, initialComments }: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  
  const [repliesCollapsed, setRepliesCollapsed] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    const collect = (items: Comment[]) => {
      for (const c of items) {
        if (c.replies && Array.isArray(c.replies) && c.replies.length > 0) {
          ids.add(c.id);
          collect(c.replies);
        }
      }
    };
    collect(initialComments);
    return ids;
  });

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const toggleRepliesCollapse = useCallback((id: string) => {
    setRepliesCollapsed(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, content, parentId: parentId || null }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Ошибка:', error);
        return;
      }

      const data = await response.json();

      if (parentId && data.parent) {
        setComments(prev => {
          const updateReplies = (items: Comment[]): Comment[] => {
            return items.map(c => {
              if (c.id === parentId) return data.parent;
              if (c.replies && Array.isArray(c.replies)) {
                return { ...c, replies: updateReplies(c.replies) };
              }
              return c;
            });
          };
          return updateReplies(prev);
        });
        setReplyToId(null);
        setReplyContent('');
        setRepliesCollapsed(prev => {
          const newSet = new Set(prev);
          newSet.delete(parentId);
          return newSet;
        });
        setCollapsed(prev => {
          const newSet = new Set(prev);
          newSet.delete(parentId);
          return newSet;
        });
      } else if (data.comment) {
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Ошибка отправки комментария:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [articleId, replyContent, newComment]);

  return (
    <div className="pt-4">
      <div className="space-y-0.5 mb-6">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            depth={0}
            replyToId={replyToId}
            setReplyToId={setReplyToId}
            replyContent={replyContent}
            setReplyContent={setReplyContent}
            isSubmitting={isSubmitting}
            handleSubmit={handleSubmit}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            isRepliesCollapsed={repliesCollapsed}
            toggleRepliesCollapse={toggleRepliesCollapse}
          />
        ))}
      </div>

      {user ? (
        <form onSubmit={(e) => handleSubmit(e)} className="bg-gray-50 rounded-xl p-4 border border-gray-200 mt-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
              {user.firstName?.[0]?.toUpperCase() || 'А'}
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Что думаете?"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition resize-none"
                rows={2}
              />
              <button
                type="submit"
                disabled={isSubmitting || !newComment.trim()}
                className="mt-2 px-5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                {isSubmitting ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-gray-50 rounded-xl p-5 text-center border border-gray-200">
          <p className="text-gray-500 text-sm">
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