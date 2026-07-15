// frontend/app/(public)/catalog/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
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

const fetchProducts = async (): Promise<Product[]> => {
  const response = await fetch('/api/products?limit=999', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Ошибка загрузки товаров');
  }
  const data = await response.json();
  return data.items || data || [];
};

const fetchCategories = async (): Promise<string[]> => {
  const response = await fetch('/api/products/categories', {
    credentials: 'include',
  });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return data.categories || [];
};

export default function CatalogPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ✅ ЧИТАЕМ ИЗ URL
  const categoryFromUrl = searchParams.get('category') || '';
  const searchFromUrl = searchParams.get('search') || '';
  const pageFromUrl = parseInt(searchParams.get('page') || '1');

  // ✅ СОСТОЯНИЯ СИНХРОНИЗИРУЮТСЯ С URL
  const [search, setSearch] = useState(searchFromUrl);
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  const [showFilters, setShowFilters] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(pageFromUrl || 1);
  const ITEMS_PER_PAGE = 16;

  const { addToCart, refetch: refetchCart, isInCart, getQuantity } = useCart();

  // ============================================================
  // REACT QUERY — ТОВАРЫ
  // ============================================================
  const {
    data: allProducts = [],
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
  });

  // ============================================================
  // REACT QUERY — КАТЕГОРИИ
  // ============================================================
  const {
    data: categories = [],
    isLoading: categoriesLoading,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
  });

  // ============================================================
  // ✅ ОБНОВЛЯЕМ selectedCategory ПРИ ИЗМЕНЕНИИ URL
  // ============================================================
  useEffect(() => {
    if (categoryFromUrl && categoryFromUrl !== selectedCategory) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [categoryFromUrl]);

  useEffect(() => {
    if (searchFromUrl && searchFromUrl !== search) {
      setSearch(searchFromUrl);
    }
  }, [searchFromUrl]);

  // ============================================================
  // ФИЛЬТРАЦИЯ
  // ============================================================
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

  // ============================================================
  // ПАГИНАЦИЯ
  // ============================================================
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, currentPage]);

  // ============================================================
  // ✅ ОБНОВЛЕНИЕ URL ПРИ ИЗМЕНЕНИИ ФИЛЬТРОВ
  // ============================================================
  const updateUrl = useCallback((category: string, page: number, searchTerm: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (page > 1) params.set('page', String(page));
    if (searchTerm) params.set('search', searchTerm);

    const queryString = params.toString();
    const newUrl = queryString ? `/catalog?${queryString}` : '/catalog';

    // ✅ ИСПОЛЬЗУЕМ push ДЛЯ ОБНОВЛЕНИЯ URL (НЕ replace)
    router.push(newUrl, { scroll: false });
  }, [router]);

  // ============================================================
  // ОБРАБОТЧИКИ
  // ============================================================
  const selectCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    updateUrl(category, 1, search);
  }, [search, updateUrl]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setCurrentPage(1);
    updateUrl(selectedCategory, 1, value);
  }, [selectedCategory, updateUrl]);

  const handleAddToCart = async (productId: string | number) => {
    const id = String(productId);
    setAddingToCart(id);

    try {
      const result = await addToCart(id, 1);
      if (result) await refetchCart();
    } catch (error) {
      console.error('❌ Ошибка добавления в корзину:', error);
    } finally {
      setAddingToCart(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setCurrentPage(1);
    router.push('/catalog');
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    updateUrl(selectedCategory, page, search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  const isLoading = productsLoading || categoriesLoading;

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
                <button onClick={() => handleSearch('')} className="hover:text-black">
                  <X size={14} />
                </button>
              </span>
            )}
          </div>
          <p className="text-gray-400 font-light mt-2">
            Тюнинг-комплекты и запчасти для внедорожников
            {!isLoading && allProducts.length > 0 && (
              <span className="ml-2 text-sm text-gray-300">
                (всего {allProducts.length} товаров)
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
              onChange={(e) => handleSearch(e.target.value)}
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
                  {categories.map(cat => (
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
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl h-[320px] animate-pulse" />
            ))}
          </div>
        ) : productsError ? (
          <div className="text-center py-16">
            <p className="text-red-500">Ошибка загрузки товаров</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-black text-white rounded-xl text-sm hover:bg-gray-800 transition"
            >
              Попробовать снова
            </button>
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
                    onImageError={(id) => setImageErrors(prev => ({ ...prev, [String(id)]: true }))}
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => goToPage(currentPage - 1)}
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
                  onClick={() => goToPage(currentPage + 1)}
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

// ============================================================
// КОМПОНЕНТ КАРТОЧКИ ТОВАРА
// ============================================================
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
  const imageUrl = product.images?.[0] || PLACEHOLDER_IMAGE;
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