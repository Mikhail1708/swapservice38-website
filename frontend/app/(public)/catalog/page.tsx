'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Star, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';

interface Product {
  id: string | number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  categories?: Array<{ id: number; name: string }>;
  inStock: boolean;
  stock?: number;
  images: string[];
  sku: string;
  rating?: number;
  reviews?: number;
}

// ✅ ЛОГО КАК ЗАГЛУШКА
const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

// ✅ ФУНКЦИЯ ПОЛУЧЕНИЯ КОРРЕКТНОГО URL ИЗОБРАЖЕНИЯ
const getImageUrl = (images: string[] | undefined): string => {
  if (!images || images.length === 0) return PLACEHOLDER_IMAGE;
  
  // Ищем первое непустое изображение
  const firstImage = images.find(img => img && img.trim() !== '');
  return firstImage || PLACEHOLDER_IMAGE;
};

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  // Пагинация
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // ✅ ДОБАВЛЯЕМ refetch ДЛЯ ОБНОВЛЕНИЯ КОРЗИНЫ В ХЕДЕРЕ
  const { addToCart, refetch } = useCart();
  const ITEMS_PER_PAGE = 16;

  // Уникальные категории
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats).filter(Boolean);
  }, [products]);

  // Фильтрация товаров
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
                          product.description?.toLowerCase().includes(search.toLowerCase()) ||
                          product.sku?.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !selectedCategory || product.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, selectedCategory]);

  // Загрузка товаров
  const fetchProducts = useCallback(async (page: number) => {
    try {
      setLoading(true);
      
      let url = `/api/products?page=${page}&limit=${ITEMS_PER_PAGE}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`📦 Страница ${page}: ${data.items?.length || 0} товаров из ${data.total}`);
      
      if (data.items && data.items.length > 0) {
        setProducts(data.items);
        setTotalItems(data.total || data.items.length);
        setTotalPages(data.totalPages || Math.ceil((data.total || data.items.length) / ITEMS_PER_PAGE));
      } else {
        setProducts([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search]);

  // Загрузка при смене страницы
  useEffect(() => {
    fetchProducts(currentPage);
  }, [currentPage, fetchProducts]);

  // Сброс на первую страницу при смене фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, search]);

  // ✅ ОБНОВЛЕННЫЙ ОБРАБОТЧИК ДОБАВЛЕНИЯ В КОРЗИНУ
  const handleAddToCart = async (productId: string | number) => {
    const id = String(productId);
    setAddingToCart(id);
    console.log('🛒 Добавление в корзину:', id);
    
    try {
      const result = await addToCart(id, 1);
      if (result) {
        // ✅ ОБНОВЛЯЕМ КОРЗИНУ В ХЕДЕРЕ
        await refetch();
        console.log('✅ Товар добавлен в корзину, корзина обновлена');
      } else {
        console.error('❌ Не удалось добавить товар');
      }
    } catch (error) {
      console.error('❌ Ошибка добавления в корзину:', error);
    } finally {
      setAddingToCart(null);
    }
  };

  const handleImageError = (productId: string | number) => {
    setImageErrors(prev => ({ ...prev, [String(productId)]: true }));
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
  };

  // Переключение страниц
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  // Генерация номеров страниц
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const half = Math.floor(maxVisible / 2);
      let start = Math.max(1, currentPage - half);
      let end = Math.min(totalPages, currentPage + half);
      
      if (start === 1) end = Math.min(totalPages, maxVisible);
      if (end === totalPages) start = Math.max(1, totalPages - maxVisible + 1);
      
      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black">Продукция</h1>
          <p className="text-gray-400 font-light mt-2">
            Тюнинг-комплекты и запчасти для внедорожников
            {!loading && totalItems > 0 && (
              <span className="ml-2 text-sm text-gray-300">
                (всего {totalItems} товаров)
              </span>
            )}
          </p>
        </div>

        {/* Поиск и фильтры */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск товаров..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-black placeholder-gray-400 focus:outline-none focus:border-black/30 transition"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl transition"
          >
            <Filter className="w-5 h-5" />
            <span className="font-medium">Фильтры</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Фильтры */}
        {showFilters && categories.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8">
            <div className="grid md:grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Категория
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-black focus:outline-none focus:border-black/30 transition"
                >
                  <option value="">Все категории</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={clearFilters}
              className="mt-4 text-sm text-gray-400 hover:text-black transition"
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        {/* Результаты */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl h-[320px] animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">Товаров не найдено</p>
            <p className="text-gray-300 text-sm mt-1">Попробуйте изменить фильтры</p>
            <button
              onClick={clearFilters}
              className="mt-4 px-6 py-2 bg-black text-white rounded-xl text-sm hover:bg-gray-800 transition"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <>
            {/* Сетка товаров */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={String(product.id)}
                  product={product}
                  onAddToCart={handleAddToCart}
                  addingToCart={addingToCart === String(product.id)}
                  onImageError={handleImageError}
                  hasImageError={imageErrors[String(product.id)]}
                />
              ))}
            </div>

            {/* Информация о количестве */}
            <div className="text-center mt-6 text-sm text-gray-400">
              Показано {filteredProducts.length} товаров
              {totalItems > filteredProducts.length && ` из ${totalItems}`}
              <span className="mx-2">•</span>
              Страница {currentPage} из {totalPages}
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition ${
                    currentPage === 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Назад
                </button>

                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, index) => (
                    typeof page === 'number' ? (
                      <button
                        key={index}
                        onClick={() => goToPage(page)}
                        className={`w-10 h-10 rounded-xl text-sm font-medium transition ${
                          page === currentPage
                            ? 'bg-black text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={index} className="w-10 h-10 flex items-center justify-center text-gray-400">
                        {page}
                      </span>
                    )
                  ))}
                </div>

                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition ${
                    currentPage === totalPages
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Вперёд
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ===== КОМПОНЕНТ КАРТОЧКИ ТОВАРА =====
function ProductCard({ 
  product, 
  onAddToCart, 
  addingToCart,
  onImageError,
  hasImageError,
}: { 
  product: Product; 
  onAddToCart: (id: string | number) => void;
  addingToCart: boolean;
  onImageError: (id: string | number) => void;
  hasImageError?: boolean;
}) {
  // ✅ ПОЛУЧАЕМ ИЗОБРАЖЕНИЕ
  const imageUrl = getImageUrl(product.images);
  const [imgError, setImgError] = useState(false);
  
  // ✅ ЕСЛИ ЕСТЬ ОШИБКА — ПОКАЗЫВАЕМ ЛОГО
  const finalImageUrl = (hasImageError || imgError) ? PLACEHOLDER_IMAGE : imageUrl;

  return (
    <div className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-400 transition hover:shadow-lg flex flex-col">
      <Link href={`/catalog/${product.id}`} className="block aspect-square bg-gray-50 relative overflow-hidden">
        <div className="relative w-full h-full">
          <Image
            src={finalImageUrl}
            alt={product.name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition duration-500"
            onError={() => {
              setImgError(true);
              onImageError(product.id);
            }}
            unoptimized
          />
        </div>
        {!product.inStock && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs px-3 py-1 rounded-full font-medium">
            Нет в наличии
          </div>
        )}
        {product.oldPrice && (
          <div className="absolute top-3 left-3 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
            -{Math.round((1 - product.price / product.oldPrice) * 100)}%
          </div>
        )}
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <Link href={`/catalog/${product.id}`}>
          <h3 className="font-semibold text-black hover:text-gray-600 transition line-clamp-2 text-sm">
            {product.name}
          </h3>
        </Link>
        
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {product.sku && (
            <span className="text-xs text-gray-400">Арт: {product.sku}</span>
          )}
        </div>

        {product.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2 flex-1">
            {product.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {product.category && (
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">
              {product.category}
            </span>
          )}
          {product.stock !== undefined && product.stock > 0 && (
            <span className="text-xs text-green-500 px-2 py-0.5 rounded-full bg-green-50">
              В наличии: {product.stock}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between mt-3 pt-3 border-t border-gray-100">
          <div>
            <span className="text-xl font-bold text-black">
              {product.price.toLocaleString()} ₽
            </span>
            {product.oldPrice && (
              <span className="text-sm text-gray-400 line-through ml-2">
                {product.oldPrice.toLocaleString()} ₽
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🛒 Клик по корзине для товара:', product.id);
              onAddToCart(product.id);
            }}
            disabled={!product.inStock || addingToCart}
            className={`p-2.5 rounded-xl transition ${
              product.inStock
                ? 'bg-black hover:bg-gray-800 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {addingToCart ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}