'use client';
import { ArticleContent, PlainText } from '@/components/content-text';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter, Image, Link } from '@/lib/next-shims';
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
import { useAuth }  from '@/lib/hooks/useAuth';
import { CommentSection, countAllComments } from '@/components/comments/CommentSection';
import { fetchWithCsrf }  from '@/lib/csrf';

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
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const changeImage = (direction: number) => {
    if (images.length < 2) return;
    setImageState('loading');
    setCurrentIndex(index => (index + direction + images.length) % images.length);
  };
  useEffect(() => {
    if (!isOpen) return;
    // PageLayout scrolls the document. Fix the body as well for mobile Safari.
    const body = document.body, root = document.documentElement;
    const scrollX = window.scrollX, scrollY = window.scrollY;
    const saved = { position: body.style.position, top: body.style.top, left: body.style.left,
      width: body.style.width, overflow: body.style.overflow, rootOverflow: root.style.overflow };
    Object.assign(body.style, { position: 'fixed', top: '-' + scrollY + 'px', left: '-' + scrollX + 'px', width: '100%', overflow: 'hidden' });
    root.style.overflow = 'hidden';
    const siblings = Array.from(body.children).filter(node => node !== dialogRef.current) as HTMLElement[];
    const previousInert = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setIsOpen(false); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); changeImage(event.key === 'ArrowLeft' ? -1 : 1);
      }
      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      siblings.forEach((node, index) => { node.inert = previousInert[index]; });
      Object.assign(body.style, { position: saved.position, top: saved.top, left: saved.left, width: saved.width, overflow: saved.overflow });
      root.style.overflow = saved.rootOverflow;
      const scrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(scrollX, scrollY);
      root.style.scrollBehavior = scrollBehavior;
      if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true });
    };
  }, [isOpen, images.length]);
  if (!images?.length) return null;
  return (
    <>
      <div className="grid grid-cols-4 gap-3 mt-4">
        {images.slice(0, 4).map((img, index) => (
          <button key={index} type="button" aria-label={'Открыть фото ' + (index + 1)}
            onClick={event => { openerRef.current = event.currentTarget; setCurrentIndex(index); setImageState('loading'); setIsOpen(true); }}
            className="aspect-square bg-muted rounded-lg overflow-hidden relative hover:opacity-80 transition group">
            <Image src={img} alt={'Фото ' + (index + 1)} fill className="object-cover group-hover:scale-105 transition duration-300 motion-reduce:transition-none" unoptimized />
            {index === 3 && images.length > 4 && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center text-foreground font-medium text-sm backdrop-blur-sm">+{images.length - 4}</div>
            )}
          </button>
        ))}
      </div>
      {isOpen && createPortal(
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Фотографии проекта"
          className="fixed inset-0 z-[9999] grid grid-rows-[auto_minmax(0,1fr)_auto] h-[100vh] supports-[height:100dvh]:h-[100dvh] overflow-hidden bg-black/95 text-white"
          style={{ paddingTop: 'max(8px, env(safe-area-inset-top))', paddingBottom: 'max(8px, env(safe-area-inset-bottom))', paddingLeft: 'max(12px, env(safe-area-inset-left))', paddingRight: 'max(12px, env(safe-area-inset-right))' }}>
          <div className="flex justify-end pb-2">
            <button ref={closeRef} type="button" aria-label="Закрыть галерею" onClick={() => setIsOpen(false)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative min-h-0 min-w-0 flex items-center justify-center overflow-hidden touch-pan-y"
            onClick={event => { if (event.target === event.currentTarget) setIsOpen(false); }}
            onTouchStart={event => { gesture.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
            onTouchCancel={() => { gesture.current = null; }}
            onTouchEnd={event => {
              const start = gesture.current;
              gesture.current = null;
              if (!start || !event.changedTouches.length) return;
              const dx = event.changedTouches[0].clientX - start.x;
              const dy = event.changedTouches[0].clientY - start.y;
              if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) changeImage(dx < 0 ? 1 : -1);
            }}>
            {imageState === 'loading' && <span role="status" className="absolute flex items-center gap-2 text-sm"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />Загрузка фото</span>}
            {imageState === 'error' && <p role="status" className="text-center text-sm">Не удалось загрузить фото. Выберите другое изображение.</p>}
            <img key={currentIndex + ':' + images[currentIndex]} src={images[currentIndex]} alt={'Фото ' + (currentIndex + 1)} draggable={false}
              onLoad={() => setImageState('ready')} onError={() => setImageState('error')}
              className={'block h-auto w-auto max-h-full max-w-full object-contain ' + (imageState === 'ready' ? '' : 'invisible')} />
          </div>
          <div className="flex items-center justify-center gap-6 pt-2">
            {images.length > 1 && <button type="button" aria-label="Предыдущее фото" onClick={() => changeImage(-1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/60 hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>}
            <span aria-live="polite" className="min-w-[4rem] text-center text-sm tabular-nums">{currentIndex + 1} / {images.length}</span>
            {images.length > 1 && <button type="button" aria-label="Следующее фото" onClick={() => changeImage(1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/60 hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>}
          </div>
        </div>, document.body
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

  // SEO конкретного свапа после загрузки данных статьи
  useEffect(() => {
    if (!article) return;

    document.title = `${article.title} — свап автомобиля | SWAPSERVICE38`;

    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content =
      article.description?.trim() ||
      `Свап ${article.title} от SWAPSERVICE38 в Иркутске.`;

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `https://swap38.ru/swaps/${encodeURIComponent(article.slug)}`;
  }, [article]);

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
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/services" className="hover:text-foreground transition">Услуги</Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Link href="/swaps" className="hover:text-foreground transition">Свапы</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="min-w-0 text-foreground [overflow-wrap:anywhere]" aria-current="page">{article.title}</span>
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
          <h1 className="heading-display text-[clamp(28px,4vw,44px)] text-foreground leading-tight [overflow-wrap:anywhere]">
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
        <div className="text-lg text-muted-foreground mb-6"><PlainText text={article.description || ''} /></div>

        {/* Галерея */}
        {article.images && article.images.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-3">Фотографии проекта</h2>
            <Gallery images={article.images} />
          </div>
        )}

        {/* Контент */}
        <ArticleContent sanitizedHtml={article.content} />

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
