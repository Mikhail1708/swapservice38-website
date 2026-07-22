// frontend/app/(public)/services/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  Calendar,
  Tag,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

// ============================================================
// ЗАГРУЗКА УСЛУГИ
// ============================================================
const fetchService = async (id: string): Promise<Service | null> => {
  console.log(`🔄 Загрузка услуги ${id}...`);
  
  const response = await fetchWithCsrf(`/api/admin/services/${id}`, {
    method: 'GET',
    cache: 'no-store',
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Ошибка загрузки услуги');
  }
  
  const data = await response.json();
  return data.service || null;
};

// ============================================================
// СТРАНИЦА ДЕТАЛИ УСЛУГИ
// ============================================================
export default function ServiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const loadService = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchService(id);
        
        if (!data) {
          setError('Услуга не найдена');
          return;
        }
        
        setService(data);
        
      } catch (err: any) {
        console.error('❌ Ошибка загрузки услуги:', err);
        setError(err.message || 'Ошибка загрузки услуги');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadService();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-4xl text-center py-16 bg-card border border-border rounded-2xl">
          <AlertCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground">{error || 'Услуга не найдена'}</h2>
          <p className="text-muted-foreground mt-2">Попробуйте вернуться к списку услуг</p>
          <Link href="/services" className="inline-block mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
            Вернуться к услугам
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = service.imageUrl || PLACEHOLDER_IMAGE;
  const finalImageUrl = imgError ? PLACEHOLDER_IMAGE : imageUrl;

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-4xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/services" className="hover:text-foreground transition">Услуги</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium truncate">{service.name}</span>
        </div>

        <Link 
          href="/services" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Все услуги
        </Link>

        {/* Изображение */}
        <div className="aspect-video bg-muted rounded-2xl overflow-hidden relative mb-8 border border-border">
          <Image
            src={finalImageUrl}
            alt={service.name}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            unoptimized
          />
          {service.price && service.price > 0 && (
            <div className="absolute bottom-4 left-4 bg-foreground/90 backdrop-blur-sm text-background text-sm font-medium px-4 py-2 rounded-full">
              от {service.price.toLocaleString()} ₽
            </div>
          )}
          <div className="absolute top-4 right-4">
            {service.isActive ? (
              <span className="bg-green-500/90 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full">
                Активна
              </span>
            ) : (
              <span className="bg-muted/90 backdrop-blur-sm text-muted-foreground text-xs font-medium px-4 py-2 rounded-full">
                Неактивна
              </span>
            )}
          </div>
        </div>

        {/* Контент */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Calendar className="w-4 h-4" />
              <span>
                Добавлено: {new Date(service.createdAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">{service.name}</h1>
          </div>

          {service.description && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-muted-foreground text-base leading-relaxed whitespace-pre-wrap">
                {service.description}
              </p>
            </div>
          )}

          {service.price && service.price > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-foreground" />
                <span className="text-muted-foreground">Стоимость:</span>
              </div>
              <span className="text-2xl font-bold text-foreground">
                от {service.price.toLocaleString()} ₽
              </span>
            </div>
          )}

          {/* Контакты */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Остались вопросы?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="tel:+79148993838"
                className="flex items-center gap-3 p-4 bg-muted rounded-xl hover:bg-muted/80 transition"
              >
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Позвоните нам</p>
                  <p className="text-sm font-medium text-foreground">+7 (914) 895-58-88</p>
                </div>
              </a>
              <a
                href="mailto:swapservice38@yandex.ru"
                className="flex items-center gap-3 p-4 bg-muted rounded-xl hover:bg-muted/80 transition"
              >
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Напишите нам</p>
                  <p className="text-sm font-medium text-foreground">swapservice38@yandex.ru</p>
                </div>
              </a>
            </div>
            <div className="mt-3 flex items-center gap-3 p-4 bg-muted rounded-xl">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Приезжайте</p>
                <p className="text-sm font-medium text-foreground">г. Иркутск, ул. Новаторов 36</p>
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
            <Link
              href="/contacts"
              className="px-6 py-3 bg-foreground text-background rounded-xl font-medium hover:bg-foreground/90 transition"
            >
              Записаться
            </Link>
            <Link
              href="/services"
              className="px-6 py-3 border border-border text-foreground rounded-xl font-medium hover:bg-muted transition"
            >
              Все услуги
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}