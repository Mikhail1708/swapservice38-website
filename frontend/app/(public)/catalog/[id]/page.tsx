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
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';

interface ProductImage {
  id: number;
  url: string;
  isMain: boolean;
  sortOrder: number;
}

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  article: string | null;
  description: string | null;
  cost_price: number;
  retail_price: number;
  stock: number;
  min_stock: number;
  categories: Category[];
  characteristics: Record<string, string | string[]>;
  images: ProductImage[];
  image_url: string | null;
  createdAt: string;
  updatedAt: string;
}

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

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
  
  const { addToCart, refetch } = useCart();

  // ✅ ВСЕ ИЗОБРАЖЕНИЯ
  const allImages = useMemo(() => {
    const images = product?.images || [];
    const urls = images.map(img => img.url);
    if (product?.image_url && !urls.includes(product.image_url)) {
      urls.unshift(product.image_url);
    }
    return urls.filter(Boolean);
  }, [product]);

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
        setProduct(data);
        
        if (data.images && data.images.length > 0) {
          const mainImage = data.images.find((img: ProductImage) => img.isMain);
          setSelectedImage(mainImage?.url || data.images[0]?.url || null);
        } else if (data.image_url) {
          setSelectedImage(data.image_url);
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
    return price.toLocaleString('ru-RU') + ' ₽';
  };

  const getStockStatus = (stock: number, minStock: number) => {
    if (stock <= 0) {
      return { label: 'Нет в наличии', color: 'text-red-600', bg: 'bg-red-50' };
    }
    if (stock <= minStock) {
      return { label: `Осталось ${stock} шт.`, color: 'text-yellow-600', bg: 'bg-yellow-50' };
    }
    return { label: 'В наличии', color: 'text-green-600', bg: 'bg-green-50' };
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
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
        <h3 className="text-sm font-semibold text-black mb-4 flex items-center gap-2">
          <Tag size={16} className="text-gray-400" />
          Характеристики
        </h3>
        <div className="space-y-2">
          {entries.map(([key, value]) => {
            const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
            return (
              <div key={key} className="flex items-start gap-2 text-sm">
                <span className="text-gray-500 min-w-[120px]">{key}:</span>
                <span className="text-black font-medium">{displayValue || '—'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20">
        <div className="container-custom max-w-4xl text-center py-16">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-black">{error || 'Товар не найден'}</h2>
          <p className="text-gray-400 mt-2">Попробуйте вернуться в каталог</p>
          <Link href="/catalog" className="inline-block mt-6 px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition">
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  const stockStatus = getStockStatus(product.stock, product.min_stock);
  const isOutOfStock = product.stock <= 0;
  const mainImage = selectedImage || product.image_url || (product.images?.length > 0 ? product.images[0].url : null);
  const images = allImages;

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom max-w-6xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-black transition">Главная</Link>
          <ChevronRight size={14} />
          <Link href="/catalog" className="hover:text-black transition">Каталог</Link>
          <ChevronRight size={14} />
          <span className="text-black font-medium truncate">{product.name}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* ===== ЛЕВАЯ КОЛОНКА — ФОТО ===== */}
          <div>
            <button
              onClick={() => {
                const index = images.findIndex(img => img === mainImage);
                openLightbox(index >= 0 ? index : 0);
              }}
              className="w-full aspect-square bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 relative group"
            >
              <Image
                src={getImageUrl(mainImage)}
                alt={product.name}
                fill
                className="object-contain p-4 transition group-hover:scale-105 duration-300"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                <span className="text-white bg-black/50 px-4 py-2 rounded-full text-sm opacity-0 group-hover:opacity-100 transition">
                  🔍 Увеличить
                </span>
              </div>
            </button>
            
            {images.length > 0 && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(img)}
                    className={`w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition ${
                      selectedImage === img ? 'border-black' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <Image
                      src={getImageUrl(img)}
                      alt=""
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ===== ПРАВАЯ КОЛОНКА — ИНФО ===== */}
          <div className="space-y-5">
            {/* Категории */}
            {product.categories && product.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/catalog?category=${encodeURIComponent(cat.name)}`}
                    className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-600 hover:bg-gray-200 transition"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}

            <h1 className="text-3xl font-bold text-black leading-tight">{product.name}</h1>
            
            {product.article && (
              <p className="text-sm text-gray-400">Артикул: {product.article}</p>
            )}

            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-3xl font-bold text-black">
                {formatPrice(product.retail_price)}
              </span>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${stockStatus.bg} ${stockStatus.color}`}>
                {stockStatus.label}
              </span>
            </div>

            {product.description && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-gray-600 text-base font-light leading-relaxed whitespace-pre-wrap text-left">
                  {product.description}
                </p>
              </div>
            )}

            {renderCharacteristics()}

            <div className="border-t border-gray-200 pt-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={isOutOfStock}
                    className="px-4 py-2 hover:bg-gray-100 transition disabled:opacity-50 text-lg font-medium"
                  >
                    −
                  </button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={isOutOfStock || quantity >= product.stock}
                    className="px-4 py-2 hover:bg-gray-100 transition disabled:opacity-50 text-lg font-medium"
                  >
                    +
                  </button>
                </div>
                
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || addingToCart}
                  className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition ${
                    isOutOfStock
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-gray-800'
                  }`}
                >
                  {addingToCart ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ShoppingCart size={18} />
                      {isOutOfStock ? 'Нет в наличии' : 'В корзину'}
                    </>
                  )}
                </button>
              </div>
              
              <p className="text-xs text-gray-400 text-center">
                {isOutOfStock 
                  ? 'Товар временно отсутствует на складе' 
                  : `Доступно ${product.stock} шт.`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <Shield className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                <p className="text-[10px] text-gray-500 font-medium">Гарантия качества</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <Truck className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                <p className="text-[10px] text-gray-500 font-medium">Доставка по РФ</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <RefreshCw className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                <p className="text-[10px] text-gray-500 font-medium">Оригинальные детали</p>
              </div>
            </div>

            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-black transition mt-2"
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
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-6 right-6 text-white hover:text-gray-300 transition z-10"
          >
            <X size={32} />
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); goToPrevImage(); }}
            className="absolute left-6 text-white hover:text-gray-300 transition z-10 p-2"
          >
            <ChevronLeft size={40} />
          </button>
          
          <div 
            className="relative w-full max-w-4xl h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={getImageUrl(images[lightboxIndex])}
              alt={product.name}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          
          <button
            onClick={(e) => { e.stopPropagation(); goToNextImage(); }}
            className="absolute right-6 text-white hover:text-gray-300 transition z-10 p-2"
          >
            <ChevronRightIcon size={40} />
          </button>
          
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
          
          <div className="absolute bottom-8 right-8 text-white/50 text-sm z-10">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}