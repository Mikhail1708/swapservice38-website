'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Check
} from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';
import { cache, productCache, categoryCache } from '@/lib/cache';

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
  characteristics?: Record<string, string | string[]>;
}

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';

const getImageUrl = (images: string[] | undefined): string => {
  if (!images || images.length === 0) return PLACEHOLDER_IMAGE;
  const firstImage = images.find(img => img && img.trim() !== '');
  return firstImage || PLACEHOLDER_IMAGE;
};

export default function CatalogPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const categoryFromUrl = searchParams.get('category') || '';
  const pageFromUrl = parseInt(searchParams.get('page') || '1');
  
  // ✅ ИСПОЛЬЗУЕМ КЭШ ЧЕРЕЗ ОБЪЕКТЫ
  const [allProducts, setAllProducts] = useState<Product[]>(productCache.data || []);
  const [loading, setLoading] = useState(!productCache.data);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  const [showFilters, setShowFilters] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  const [currentPage, setCurrentPage] = useState(pageFromUrl || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(productCache.data?.length || 0);
  const [categories, setCategories] = useState<string[]>(categoryCache.data || []);
  
  const { addToCart, refetch, isInCart, getQuantity } = useCart();
  const ITEMS_PER_PAGE = 16;

  // ✅ ЗАГРУЗКА КАТЕГОРИЙ (С КЭШЕМ)
  useEffect(() => {
    if (categoryCache.data) {
      setCategories(categoryCache.data);
      return;
    }

    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/products/categories');
        if (response.ok) {
          const data = await response.json();
          categoryCache.data = data.categories || [];
          setCategories(categoryCache.data);
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки категорий:', error);
      }
    };
    fetchCategories();
  }, []);

  // ✅ ЗАГРУЗКА ТОВАРОВ (С КЭШЕМ — ТОЛЬКО 1 РАЗ!)
  const fetchProducts = useCallback(async () => {
    // ✅ ЕСЛИ УЖЕ ЕСТЬ В КЭШЕ — НЕ ГРУЗИМ
    if (productCache.data) {
      setAllProducts(productCache.data);
      setTotalItems(productCache.data.length);
      setLoading(false);
      return;
    }

    // ✅ ПРОВЕРЯЕМ КЭШ ПО КЛЮЧУ
    const cached = cache.get<Product[]>('products:all');
    if (cached) {
      productCache.data = cached;
      setAllProducts(cached);
      setTotalItems(cached.length);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/products?limit=999');
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        productCache.data = data.items;
        cache.set('products:all', data.items, 600000); // 10 минут
        setAllProducts(data.items);
        setTotalItems(data.total || data.items.length);
      } else {
        setAllProducts([]);
        setTotalItems(0);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки:', error);
      setAllProducts([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ✅ ФИЛЬТРАЦИЯ
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];
    
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower) ||
        p.sku?.toLowerCase().includes(searchLower)
      );
    }
    
    return result;
  }, [allProducts, selectedCategory, search]);

  // ✅ УНИКАЛЬНЫЕ КАТЕГОРИИ (из загруженных товаров)
  const productCategories = useMemo(() => {
    const cats = new Set(allProducts.map(p => p.category));
    return Array.from(cats).filter(Boolean);
  }, [allProducts]);

  // ✅ ПАГИНАЦИЯ НА КЛИЕНТЕ
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, currentPage]);

  // ✅ ОБНОВЛЕНИЕ СТРАНИЦ
  useEffect(() => {
    const total = filteredProducts.length;
    const pages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
    setTotalPages(pages);
    
    if (currentPage > pages) {
      setCurrentPage(1);
    }
  }, [filteredProducts.length, currentPage]);

  // ✅ ОБНОВЛЕНИЕ URL
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set('category', selectedCategory);
    if (currentPage > 1) params.set('page', String(currentPage));
    if (search) params.set('search', search);
    
    const queryString = params.toString();
    const newUrl = queryString ? `/catalog?${queryString}` : '/catalog';
    
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [selectedCategory, currentPage, search]);

  useEffect(() => {
    updateUrl();
  }, [selectedCategory, currentPage, search, updateUrl]);

  useEffect(() => {
    if (categoryFromUrl && categoryFromUrl !== selectedCategory) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [categoryFromUrl]);

  const handleAddToCart = async (productId: string | number) => {
    const id = String(productId);
    setAddingToCart(id);
    
    try {
      const result = await addToCart(id, 1);
      if (result) await refetch();
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
    setCurrentPage(1);
    router.push('/catalog');
  };

  const selectCategory = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    router.push(`/catalog?${params.toString()}`);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

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

  const showPagination = filteredProducts.length > ITEMS_PER_PAGE;

  return (
    <div className="min-h-screen bg-white pt-32 pb-20">
      <div className="container-custom">
        <div className="mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-4xl font-bold text-black">Каталог</h1>
            {selectedCategory && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600">
                {selectedCategory}
                <button onClick={() => selectCategory('')} className="hover:text-black">
                  <X size={14} />
                </button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600">
                Поиск: {search}
                <button onClick={() => setSearch('')} className="hover:text-black">
                  <X size={14} />
                </button>
              </span>
            )}
          </div>
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
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition ${
              showFilters || selectedCategory || search
                ? 'bg-black text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span className="font-medium">Фильтры</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8">
            <div className="grid md:grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Категория
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => selectCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-black focus:outline-none focus:border-black/30 transition"
                >
                  <option value="">Все категории</option>
                  {(categories.length > 0 ? categories : productCategories).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-500 hover:text-black transition border border-gray-200 rounded-xl"
              >
                Сбросить все фильтры
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 text-sm bg-black text-white rounded-xl hover:bg-gray-800 transition"
              >
                Применить
              </button>
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedProducts.map((product) => {
                const productId = String(product.id);
                const inCart = isInCart(productId);
                const quantityInCart = getQuantity(productId);
                
                return (
                  <ProductCard
                    key={productId}
                    product={product}
                    onAddToCart={handleAddToCart}
                    addingToCart={addingToCart === productId}
                    onImageError={handleImageError}
                    hasImageError={imageErrors[productId]}
                    inCart={inCart}
                    quantityInCart={quantityInCart}
                  />
                );
              })}
            </div>

            <div className="text-center mt-6 text-sm text-gray-400">
              Показано {paginatedProducts.length} товаров
              {filteredProducts.length > ITEMS_PER_PAGE && ` из ${filteredProducts.length}`}
              {totalPages > 1 && (
                <>
                  <span className="mx-2">•</span>
                  Страница {currentPage} из {totalPages}
                </>
              )}
            </div>

            {showPagination && (
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
  inCart,
  quantityInCart,
}: { 
  product: Product; 
  onAddToCart: (id: string | number) => void;
  addingToCart: boolean;
  onImageError: (id: string | number) => void;
  hasImageError?: boolean;
  inCart: boolean;
  quantityInCart: number;
}) {
  const imageUrl = getImageUrl(product.images);
  const [imgError, setImgError] = useState(false);
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
        {inCart && (
          <div className="absolute bottom-3 right-3 bg-black text-white text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
            <Check className="w-3 h-3" />
            {quantityInCart > 1 ? `${quantityInCart} шт.` : 'В корзине'}
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
              {product.stock} шт.
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
              onAddToCart(product.id);
            }}
            disabled={!product.inStock || addingToCart}
            className={`p-2.5 rounded-xl transition ${
              product.inStock
                ? inCart
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-black hover:bg-gray-800 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {addingToCart ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : inCart ? (
              <Check className="w-4 h-4" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}