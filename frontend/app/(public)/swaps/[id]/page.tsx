// frontend/app/(public)/swaps/[id]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Calendar, Clock, Share2, MessageCircle, 
  Heart, Eye, Loader2, Check 
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { CommentSection, countAllComments } from '@/components/comments/CommentSection';
import { fetchWithCsrf } from '@/lib/csrf';

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

interface Comment {
  id: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  parentId: string | null;
  replies?: Comment[];
}

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
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
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
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  className="absolute right-4 text-white/40 hover:text-white transition p-3 z-10"
                >
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
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
// ОСНОВНАЯ СТРАНИЦА
// ============================================================
export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();
  
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const fetchedRef = useRef(false);

  // ЗАГРУЗКА СТАТЬИ — ТОЛЬКО 1 РАЗ
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

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

  // ПРОВЕРКА ЛАЙКА — ТОЛЬКО КОГДА ЕСТЬ ПОЛЬЗОВАТЕЛЬ
  useEffect(() => {
    if (!user || !article) return;

    const checkLike = async () => {
      try {
        const res = await fetch('/api/likes/user');
        if (res.ok) {
          const data = await res.json();
          if (data.articleIds?.includes(id)) {
            setLiked(true);
          }
        }
      } catch (e) {
        // Игнорируем
      }
    };
    checkLike();
  }, [user, article, id]);

  // ✅ ЛАЙК С CSRF
  const handleLike = async () => {
    if (!article) return;
    if (isLiking) return;
    
    setIsLiking(true);
    try {
      // ✅ ИСПОЛЬЗУЕМ fetchWithCsrf
      const response = await fetchWithCsrf('/api/likes', {
        method: 'POST',
        body: JSON.stringify({ articleId: article.id }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLiked(data.liked);
        setLikesCount((prev) => data.liked ? prev + 1 : prev - 1);
      } else {
        const errorData = await response.json();
        console.error('❌ Ошибка лайка:', errorData);
        if (response.status === 403) {
          alert('Ошибка CSRF. Попробуйте обновить страницу.');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка лайка:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3000);
      });
    } else {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black">Статья не найдена</h1>
          <p className="text-gray-400 mt-2">{error || 'Такой статьи нет'}</p>
          <Link href="/swaps" className="inline-block mt-6 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition">
            Вернуться к списку
          </Link>
        </div>
      </div>
    );
  }

  const totalComments = countAllComments(article.comments || []);

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/swaps" className="inline-flex items-center gap-2 text-gray-400 hover:text-black transition mb-6">
          <ArrowLeft className="w-4 h-4" />
          Все проекты
        </Link>

        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            {article.tags?.map((tag: string) => (
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
            disabled={isLiking}
            className={`flex items-center gap-2 px-6 py-2.5 border rounded-xl transition text-sm font-medium ${
              liked 
                ? 'border-red-500 bg-red-50 text-red-500' 
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLiking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Heart className={`w-4 h-4 ${liked ? 'fill-red-500' : ''}`} />
            )}
            <span>{liked ? 'Нравится' : 'Нравится'} ({likesCount})</span>
          </button>
          
          <button
            onClick={handleShare}
            className={`flex items-center gap-2 px-6 py-2.5 border rounded-xl transition text-sm font-medium ${
              shareCopied 
                ? 'border-green-500 bg-green-50 text-green-600' 
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {shareCopied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Скопировано!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Поделиться</span>
              </>
            )}
          </button>
          
          <button 
            onClick={() => {
              const commentsSection = document.querySelector('.pt-4');
              if (commentsSection) {
                commentsSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Комментарии ({totalComments})</span>
          </button>
        </div>

        <CommentSection initialComments={article.comments || []} articleId={article.id} />

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