'use client';

import { useState, useEffect, useRef } from 'react';
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
  Loader2, 
  Check,
  ChevronRight,
  ChevronLeft,
  X
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

// Галерея изображений
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
            className="aspect-square bg-muted rounded-lg overflow-hidden relative hover:opacity-80 transition group"
          >
            <Image
              src={img}
              alt={`Фото ${index + 1}`}
              fill
              className="object-cover group-hover:scale-105 transition duration-300"
              unoptimized
            />
            {index === 3 && images.length > 4 && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center text-foreground font-medium text-sm backdrop-blur-sm">
                +{images.length - 4}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Лайтбокс */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-background/98 flex items-center justify-center"
          onClick={closeGallery}
        >
          <button
            onClick={closeGallery}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition p-2 z-10"
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
                  className="absolute left-4 text-muted-foreground/40 hover:text-foreground transition p-3 z-10"
                >
                  <ChevronLeft className="w-10 h-10" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  className="absolute right-4 text-muted-foreground/40 hover:text-foreground transition p-3 z-10"
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
                    index === currentIndex ? 'bg-foreground' : 'bg-foreground/30'
                  }`}
                />
              ))}
            </div>

            <div className="absolute bottom-4 right-4 text-muted-foreground/40 text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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

  // Загрузка статьи
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
        console.error('❌ Ошибка:', err);
        setError('Статья не найдена');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  // Проверка лайка
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

  // Лайк
  const handleLike = async () => {
    if (!article || isLiking) return;
    
    setIsLiking(true);
    try {
      const response = await fetchWithCsrf('/api/likes', {
        method: 'POST',
        body: JSON.stringify({ articleId: article.id }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLiked(data.liked);
        setLikesCount((prev) => data.liked ? prev + 1 : prev - 1);
      }
    } catch (error) {
      console.error('❌ Ошибка лайка:', error);
    } finally {
      setIsLiking(false);
    }
  };

  // Поделиться
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3000);
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-32 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-4xl text-center py-16">
          <div className="text-4xl mb-4">🔧</div>
          <h1 className="text-2xl font-bold text-foreground">Статья не найдена</h1>
          <p className="text-muted-foreground mt-2">{error || 'Такой статьи нет'}</p>
          <Link 
            href="/swaps" 
            className="inline-flex items-center gap-2 mt-6 rounded-sm bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться к списку
          </Link>
        </div>
      </div>
    );
  }

  const totalComments = countAllComments(article.comments || []);

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-4xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/swaps" className="hover:text-foreground transition">Свапы</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground truncate">{article.title}</span>
        </div>

        <Link 
          href="/swaps" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Все проекты
        </Link>

        {/* Заголовок */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            {(article.tags || []).map((tag: string) => (
              <span key={tag} className="text-xs bg-muted text-foreground px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
          <h1 className="heading-display text-[clamp(28px,4vw,44px)] text-foreground leading-tight">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-muted-foreground">
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
          </div>
        </div>

        {/* Главное изображение */}
        {article.imageUrl && (
          <div className="aspect-video bg-muted rounded-lg overflow-hidden relative mb-6 border border-border">
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

        {/* Описание */}
        <p className="text-lg text-muted-foreground leading-relaxed mb-6">
          {article.description}
        </p>

        {/* Галерея */}
        {article.images && article.images.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">Фотографии проекта</h2>
            <Gallery images={article.images} />
          </div>
        )}

        {/* Контент */}
        <div 
          className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-foreground prose-li:text-muted-foreground prose-ul:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Кнопки */}
        <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-border">
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center gap-2 px-6 py-2.5 border rounded-lg transition text-sm font-medium ${
              liked 
                ? 'border-red-500 bg-red-500/10 text-red-500' 
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
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
            className={`flex items-center gap-2 px-6 py-2.5 border rounded-lg transition text-sm font-medium ${
              shareCopied 
                ? 'border-green-500 bg-green-500/10 text-green-500' 
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
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
            className="flex items-center gap-2 px-6 py-2.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Комментарии ({totalComments})</span>
          </button>
        </div>

        {/* Комментарии */}
        <CommentSection initialComments={article.comments || []} articleId={article.id} />

        {/* Навигация назад */}
        <div className="mt-12 pt-6 border-t border-border">
          <button 
            onClick={() => router.push('/swaps')}
            className="text-muted-foreground hover:text-foreground transition flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Все проекты
          </button>
        </div>
      </div>
    </div>
  );
}