'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Loader2, 
  AlertCircle,
  Tag,
  ChevronRight,
  Shield,
  Truck,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Check,
  Package,
  Ruler,
  Weight,
  Gauge,
  Calendar,
  Star,
  Heart,
  Share2,
  Minus,
  Plus
} from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  article: string | null;
  description: string | null;
  price: number;
  retail_price?: number;
  cost_price?: number;
  stock: number;
  min_stock?: number;
  categories: Category[];
  characteristics: Record<string, string | string[]>;
  images: string[];
  image_url: string | null;
  createdAt: string;
  updatedAt: string;
  sku?: string;
  inStock?: boolean;
  features?: any[];
  category?: string;
}

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

// ============================================================
// ИКОНКИ ДЛЯ ХАРАКТЕРИСТИК
// ============================================================
const characteristicIcons: Record<string, any> = {
  'Вес': Weight,
  'Размер': Ruler,
  'Длина': Ruler,
  'Ширина': Ruler,
  'Высота': Ruler,
  'Мощность': Gauge,
  'Объем': Package,
  'Год выпуска': Calendar,
  'Материал': Tag,
  'Производитель': Star,
};

const getIconForCharacteristic = (key: string) => {
  for (const [name, Icon] of Object.entries(characteristicIcons)) {
    if (key.includes(name) || name.includes(key)) {
      return Icon;
    }
  }
  return Tag;
};

export default function ProductPage() {
  const params = useParams();
  const productId = params.id as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  const { addToCart, refetch, isInCart, getQuantity } = useCart();

  // Все изображения (уникальные)
  const allImages = useMemo(() => {
    const urls: string[] = [];
    
    if (product?.images && Array.isArray(product.images)) {
      for (const img of product.images) {
        if (typeof img === 'string' && img.trim() && !urls.includes(img)) {
          urls.push(img);
        }
      }
    }
    
    if (product?.image_url && product.image_url.trim() && !urls.includes(product.image_url)) {
      urls.unshift(product.image_url);
    }
    
    if (urls.length === 0) {
      urls.push(PLACEHOLDER_IMAGE);
    }
    
    return urls;
  }, [product]);

  const inCart = product ? isInCart(String(product.id)) : false;
  const quantityInCart = product ? getQuantity(String(product.id)) : 0;

  // Загрузка товара
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/products/${productId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Товар не найден');
          } else {
            setError('Ошибка загрузки товара');
          }
          return;
        }
        
        const data = await response.json();
        
        const adaptedProduct: Product = {
          id: data.id,
          name: data.name,
          article: data.sku || data.article || null,
          description: data.description || null,
          price: data.price || data.retail_price || 0,
          retail_price: data.price || data.retail_price || 0,
          cost_price: data.cost_price || 0,
          stock: data.stock || 0,
          min_stock: data.min_stock || 2,
          categories: data.categories || [],
          characteristics: data.characteristics || {},
          images: data.images || [],
          image_url: data.image_url || (data.images?.length > 0 ? data.images[0] : null),
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          sku: data.sku || data.article || null,
          inStock: data.inStock !== undefined ? data.inStock : (data.stock || 0) > 0,
          features: data.features || [],
          category: data.category || (data.categories?.length > 0 ? data.categories[0].name : ''),
        };
        
        setProduct(adaptedProduct);
        
        const uniqueImages = adaptedProduct.images || [];
        if (uniqueImages.length > 0) {
          setSelectedImage(uniqueImages[0]);
        } else if (adaptedProduct.image_url) {
          setSelectedImage(adaptedProduct.image_url);
        } else {
          setSelectedImage(PLACEHOLDER_IMAGE);
        }
        
      } catch (err) {
        console.error('❌ Ошибка загрузки товара:', err);
        setError('Ошибка загрузки товара');
      } finally {
        setLoading(false);
      }
    };
    
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const handleAddToCart = async () => {
    if (!product) return;
    
    setAddingToCart(true);
    try {
      const result = await addToCart(String(product.id), quantity);
      if (result) {
        await refetch();
      }
    } catch (error) {
      console.error('❌ Ошибка добавления в корзину:', error);
    } finally {
      setAddingToCart(false);
    }
  };

  const getImageUrl = (url: string | null | undefined): string => {
    if (!url) return PLACEHOLDER_IMAGE;
    if (url.startsWith('http')) return url;
    return url;
  };

  const formatPrice = (price: number): string => {
    if (!price && price !== 0) return '0 ₽';
    return price.toLocaleString('ru-RU') + ' ₽';
  };

  const getStockStatus = (stock: number, minStock: number) => {
    if (stock <= 0) {
      return { label: 'Нет в наличии', color: 'text-red-500', bg: 'bg-red-500/10' };
    }
    if (stock <= minStock) {
      return { label: `Осталось ${stock} шт.`, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    }
    return { label: 'В наличии', color: 'text-green-500', bg: 'bg-green-500/10' };
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    document.body.style.overflow = '';
  };

  const goToPrevImage = () => {
    setLightboxIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const goToNextImage = () => {
    setLightboxIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const renderCharacteristics = () => {
    if (!product?.characteristics) return null;
    
    const entries = Object.entries(product.characteristics);
    if (entries.length === 0) return null;
    
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Tag size={16} className="text-muted-foreground" />
          Характеристики
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {entries.map(([key, value]) => {
            const Icon = getIconForCharacteristic(key);
            const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
            return (
              <div key={key} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground block">{key}</span>
                  <span className="text-sm text-foreground font-medium break-words">
                    {displayValue || '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // LOADING
  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Загрузка товара...</p>
        </div>
      </div>
    );
  }

  // ERROR
  if (error || !product) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-4xl text-center py-16 bg-card border border-border rounded-2xl">
          <AlertCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground">{error || 'Товар не найден'}</h2>
          <p className="text-muted-foreground mt-2">Попробуйте вернуться в каталог</p>
          <Link href="/catalog" className="inline-block mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  const stockStatus = getStockStatus(product.stock || 0, product.min_stock || 2);
  const isOutOfStock = (product.stock || 0) <= 0;
  const mainImage = selectedImage || product.image_url || (product.images?.length > 0 ? product.images[0] : null);
  const images = allImages;
  const productPrice = product.price || product.retail_price || 0;

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-6xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight size={14} className="text-muted-foreground/30" />
          <Link href="/catalog" className="hover:text-foreground transition">Каталог</Link>
          <ChevronRight size={14} className="text-muted-foreground/30" />
          <span className="text-foreground font-medium truncate">{product.name}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* ===== ЛЕВАЯ КОЛОНКА — ФОТО ===== */}
          <div>
            {/* Главное фото */}
            <button
              onClick={() => {
                const index = images.findIndex(img => img === mainImage);
                openLightbox(index >= 0 ? index : 0);
              }}
              className="w-full aspect-square bg-card border border-border rounded-2xl overflow-hidden relative group"
            >
              <Image
                src={getImageUrl(mainImage)}
                alt={product.name}
                fill
                className="object-contain p-6 transition group-hover:scale-105 duration-500"
                unoptimized
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = PLACEHOLDER_IMAGE;
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                <span className="text-white bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium opacity-0 group-hover:opacity-100 transition">
                  🔍 Увеличить
                </span>
              </div>
              {isOutOfStock && (
                <div className="absolute top-4 left-4 bg-red-500/90 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full">
                  Нет в наличии
                </div>
              )}
            </button>
            
            {/* Миниатюры */}
            {images.length > 1 && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                {images.map((img, index) => {
                  const isError = imageErrors[`thumb-${index}`];
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(img)}
                      className={`w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition ${
                        selectedImage === img 
                          ? 'border-foreground' 
                          : 'border-border hover:border-foreground/30'
                      }`}
                    >
                      <Image
                        src={isError ? PLACEHOLDER_IMAGE : getImageUrl(img)}
                        alt=""
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                        unoptimized
                        onError={() => {
                          setImageErrors(prev => ({ ...prev, [`thumb-${index}`]: true }));
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ===== ПРАВАЯ КОЛОНКА — ИНФО ===== */}
          <div className="space-y-6">
            {/* Категории */}
            {product.categories && product.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/catalog?category=${encodeURIComponent(cat.name)}`}
                    className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Название */}
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              {product.name}
            </h1>
            
            {/* Артикул */}
            {(product.article || product.sku) && (
              <p className="text-sm text-muted-foreground/60">Артикул: {product.article || product.sku}</p>
            )}

            {/* Цена и статус */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-3xl font-bold text-foreground">
                {formatPrice(productPrice)}
              </span>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${stockStatus.bg} ${stockStatus.color}`}>
                {stockStatus.label}
              </span>
              {inCart && !isOutOfStock && (
                <span className="text-sm font-medium px-3 py-1 rounded-full bg-green-500/10 text-green-500 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  В корзине ({quantityInCart} шт.)
                </span>
              )}
            </div>

            {/* Описание */}
            {product.description && (
              <div className="border-t border-border pt-4">
                <p className="text-muted-foreground text-base font-light leading-relaxed whitespace-pre-wrap text-left">
                  {product.description}
                </p>
              </div>
            )}

            {/* Характеристики */}
            {renderCharacteristics()}

            {/* Добавление в корзину */}
            <div className="border-t border-border pt-5 space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center border border-border rounded-xl overflow-hidden bg-muted/50">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={isOutOfStock}
                    className="px-4 py-2 hover:bg-muted transition disabled:opacity-50 text-lg font-medium text-foreground"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-medium text-foreground">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock || 999, quantity + 1))}
                    disabled={isOutOfStock || quantity >= (product.stock || 999)}
                    className="px-4 py-2 hover:bg-muted transition disabled:opacity-50 text-lg font-medium text-foreground"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || addingToCart}
                  className={`flex-1 min-w-[140px] py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition ${
                    isOutOfStock
                      ? 'bg-muted text-muted-foreground/30 cursor-not-allowed'
                      : inCart
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-foreground hover:bg-foreground/80 text-background'
                  }`}
                >
                  {addingToCart ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : inCart ? (
                    <>
                      <Check size={18} />
                      В корзине
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={18} />
                      В корзину
                    </>
                  )}
                </button>
              </div>
              
              <p className="text-xs text-muted-foreground/50 text-center">
                {isOutOfStock 
                  ? 'Товар временно отсутствует на складе' 
                  : inCart
                    ? `Уже в корзине (${quantityInCart} шт.)`
                    : `Доступно ${product.stock || 0} шт.`}
              </p>
            </div>

            {/* Преимущества */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
              <div className="text-center p-3 bg-card border border-border rounded-xl hover:border-foreground/30 transition">
                <Shield className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground font-medium">Гарантия качества</p>
              </div>
              <div className="text-center p-3 bg-card border border-border rounded-xl hover:border-foreground/30 transition">
                <Truck className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground font-medium">Доставка по РФ</p>
              </div>
              <div className="text-center p-3 bg-card border border-border rounded-xl hover:border-foreground/30 transition">
                <RefreshCw className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground font-medium">Оригинальные детали</p>
              </div>
            </div>

            {/* Назад в каталог */}
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mt-2"
            >
              <ArrowLeft size={16} />
              Вернуться в каталог
            </Link>
          </div>
        </div>
      </div>

      {/* ===== ЛАЙТБОКС ===== */}
      {isLightboxOpen && images.length > 0 && (
        <div 
          className="fixed inset-0 z-[100] bg-black/98 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-6 right-6 text-white/60 hover:text-white transition z-10 p-2 hover:bg-white/10 rounded-full"
          >
            <X size={32} />
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); goToPrevImage(); }}
            className="absolute left-6 text-white/40 hover:text-white transition z-10 p-3 hover:bg-white/10 rounded-full"
          >
            <ChevronLeft size={40} />
          </button>
          
          <div 
            className="relative w-full max-w-5xl h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={getImageUrl(images[lightboxIndex])}
              alt={product.name}
              fill
              className="object-contain"
              unoptimized
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = PLACEHOLDER_IMAGE;
              }}
            />
          </div>
          
          <button
            onClick={(e) => { e.stopPropagation(); goToNextImage(); }}
            className="absolute right-6 text-white/40 hover:text-white transition z-10 p-3 hover:bg-white/10 rounded-full"
          >
            <ChevronRightIcon size={40} />
          </button>
          
          {/* Индикаторы */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(index); }}
                className={`w-2 h-2 rounded-full transition ${
                  index === lightboxIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
          
          {/* Счётчик */}
          <div className="absolute bottom-8 right-8 text-white/40 text-sm font-medium z-10">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}