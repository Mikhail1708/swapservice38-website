// app/(public)/swaps/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Share2, 
  MessageCircle, 
  Heart, 
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Send,
  User,
  Loader2,
  Reply
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

interface Comment {
  id: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  parentId: string | null;
  replies?: Comment[];
  _count?: { likes: number };
}

interface Article {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  imageUrl: string;
  images: string[];
  date: string;
  readTime: number;
  tags: string[];
  views: number;
  likesCount: number;
  comments: Comment[];
}

// ============================================================
// КОМПОНЕНТ ГАЛЕРЕИ
// ============================================================
function Gallery({ images }: { images: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const openGallery = (index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeGallery = () => {
    setIsOpen(false);
    document.body.style.overflow = 'auto';
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGallery();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <div className="grid grid-cols-4 gap-3 mt-4">
        {images.slice(0, 4).map((img, index) => (
          <button
            key={index}
            onClick={() => openGallery(index)}
            className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative hover:opacity-80 transition"
          >
            <Image
              src={img}
              alt={`Фото ${index + 1}`}
              fill
              className="object-cover"
              unoptimized
            />
            {index === 3 && images.length > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-medium text-sm">
                +{images.length - 4}
              </div>
            )}
          </button>
        ))}
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
          onClick={closeGallery}
        >
          <button
            onClick={closeGallery}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition p-2 z-10"
          >
            <X className="w-8 h-8" />
          </button>

          <div 
            className="relative w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                  className="absolute left-4 text-white/40 hover:text-white transition p-3 z-10"
                >
                  <ChevronLeft className="w-10 h-10" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  className="absolute right-4 text-white/40 hover:text-white transition p-3 z-10"
                >
                  <ChevronRight className="w-10 h-10" />
                </button>
              </>
            )}

            <div className="relative w-full max-w-6xl h-[80vh]">
              <Image
                src={images[currentIndex]}
                alt={`Фото ${currentIndex + 1}`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition ${
                    index === currentIndex ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>

            <div className="absolute bottom-4 right-4 text-white/40 text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// КОМПОНЕНТ КОММЕНТАРИЕВ (С ОТВЕТАМИ)
// ============================================================
function Comments({ comments: initialComments, articleId }: { comments: Comment[]; articleId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; author: string; authorId: string } | null>(null);
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
            {user && (
              <button
                onClick={() => {
                  setReplyTo({ id: comment.id, author: comment.author, authorId: comment.authorId });
                  setShowReply(true);
                }}
                className="text-xs text-gray-400 hover:text-black transition flex items-center gap-1"
              >
                <Reply className="w-3 h-3" />
                Ответить
              </button>
            )}
          </div>
          <p className="text-gray-600 font-light text-sm">{comment.content}</p>
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
        <form onSubmit={(e) => handleSubmit(e)} className="bg-gray-50 rounded-2xl p-5">
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

// ============================================================
// ОСНОВНАЯ СТРАНИЦА
// ============================================================
export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const response = await fetch(`/api/articles/${id}`);
        if (!response.ok) throw new Error('Статья не найдена');
        const data = await response.json();
        setArticle(data);
        setLikesCount(data.likesCount || 0);
      } catch (err) {
        console.error('❌ Ошибка загрузки статьи:', err);
        setError('Статья не найдена');
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [id]);

  const handleLike = async () => {
    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article?.id }),
      });
      if (response.ok) {
        const data = await response.json();
        setLiked(data.liked);
        setLikesCount((prev) => data.liked ? prev + 1 : prev - 1);
      }
    } catch (error) {
      console.error('Ошибка лайка:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black">Статья не найдена</h1>
          <p className="text-gray-400 mt-2">{error || 'Такой статьи нет в нашем блоге'}</p>
          <Link href="/swaps" className="inline-block mt-6 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition">
            Вернуться к списку
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-4xl">
        <Link href="/swaps" className="inline-flex items-center gap-2 text-gray-400 hover:text-black transition mb-6">
          <ArrowLeft className="w-4 h-4" />
          Все проекты
        </Link>

        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            {article.tags?.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-medium">
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-[clamp(28px,4vw,40px)] font-bold text-black leading-tight">
            {article.title}
          </h1>
          <div className="flex items-center gap-6 mt-4 text-sm text-gray-400 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(article.date).toLocaleDateString('ru-RU')}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {article.readTime || 5} мин чтения
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {article.views || 0} просмотров
            </span>
            <span className="flex items-center gap-1.5">
              <Heart className="w-4 h-4" />
              {likesCount} лайков
            </span>
          </div>
        </div>

        {article.imageUrl && (
          <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden relative mb-6">
            <Image
              src={article.imageUrl}
              alt={article.title}
              fill
              className="object-cover"
              unoptimized
              priority
            />
          </div>
        )}

        <p className="text-lg text-gray-600 font-light leading-relaxed mb-6">
          {article.description}
        </p>

        {article.images && article.images.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-black mb-3">Фотографии проекта</h2>
            <Gallery images={article.images} />
          </div>
        )}

        <div 
          className="prose prose-gray max-w-none prose-headings:text-black prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-black prose-a:text-black"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 px-6 py-2.5 border rounded-xl transition text-sm font-medium ${
              liked 
                ? 'border-red-500 bg-red-50 text-red-500' 
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-red-500' : ''}`} />
            <span>{liked ? 'Нравится' : 'Нравится'} ({likesCount})</span>
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition text-sm font-medium">
            <Share2 className="w-4 h-4" />
            <span>Поделиться</span>
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition text-sm font-medium">
            <MessageCircle className="w-4 h-4" />
            <span>Комментарии ({article.comments?.length || 0})</span>
          </button>
        </div>

        <Comments comments={article.comments || []} articleId={article.id} />

        <div className="flex flex-col sm:flex-row justify-between gap-4 mt-12 pt-6 border-t border-gray-200">
          <button 
            onClick={() => router.push('/swaps')}
            className="text-gray-400 hover:text-black transition flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Все проекты
          </button>
        </div>
      </div>
    </div>
  );
}