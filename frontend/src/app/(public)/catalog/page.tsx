// frontend/app/(public)/catalog/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Image, Link, useSearchParams, useRouter } from '@/lib/next-shims';
import { 
  Search, 
  ShoppingCart, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Check,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { useCart }  from '@/lib/context/CartContext';
import { AddToCartButton } from '@/components/AddToCartButton';
import { fetchWithCsrf }  from '@/lib/csrf';
import { userMessageFromError } from '@/lib/api-error';
import { productAvailability } from '@/lib/product-availability';
import { matchesProductCategory } from '@/lib/product-category';

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
  availableStock?: number;
  images: string[];
  image_url?: string;
  sku: string;
  characteristics?: Record<string, string | string[]>;
}

const PLACEHOLDER_IMAGE = '/images/logo/logo.png';
const ITEMS_PER_PAGE = 16;

// ============================================================
// API ФУНКЦИИ — БЕЗ КЕША!
// ============================================================
const fetchProducts = async (): Promise<Product[]> => {
  const timestamp = Date.now();
  const products = new Map<string, Product>();
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetchWithCsrf(`/api/products?limit=999&page=${page}&_t=${timestamp}`, {
      method: 'GET', cache: 'no-store',
    });
    if (!response.ok) throw new Error('Ошибка загрузки товаров');
    const data = await response.json();
    const items: Product[] = data.items || data || [];
    for (const product of items) products.set(String(product.id), product);
    totalPages = Number.isSafeInteger(data.totalPages) ? Math.max(1, data.totalPages) : 1;
    page += 1;
  } while (page <= totalPages);
  return [...products.values()];
};

const fetchCategories = async (): Promise<string[]> => {
  const timestamp = Date.now();
  const response = await fetchWithCsrf(`/api/products/categories?_t=${timestamp}`, {
    method: 'GET',
    cache: 'no-store',
  });
  
  if (!response.ok) {
    return [];
  }
  
  const data = await response.json();
  const categories = data.categories || [];
  
  return categories;
};

// ============================================================
// НОРМАЛИЗАЦИЯ ТОВАРА
// ============================================================
const normalizeProduct = (item: any): Product => {
  let images: string[] = [];
  
  if (item.images && Array.isArray(item.images)) {
    images = item.images.filter(Boolean);
  }
  
  if (images.length === 0 && item.image_url) {
    images = [item.image_url];
  }
  
  if (images.length === 0 && item.image) {
    images = [item.image];
  }
  
  if (images.length === 0 && item.ProductImage && Array.isArray(item.ProductImage)) {
    images = item.ProductImage
      .filter((img: any) => img.url)
      .map((img: any) => img.url);
  }
  
  if (images.length === 0 && item.productImages && Array.isArray(item.productImages)) {
    images = item.productImages
      .filter((img: any) => img.url || img)
      .map((img: any) => img.url || img);
  }
  
  if (images.length === 0) {
    images = [PLACEHOLDER_IMAGE];
  }
  
  return {
    id: item.id || item.productId,
    name: item.name || 'Товар',
    description: item.description || '',
    price: item.price || item.retail_price || 0,
    oldPrice: item.oldPrice || item.old_price || null,
    category: item.category || item.categories?.[0]?.name || '',
    categories: item.categories || [],
    inStock: item.inStock !== undefined ? item.inStock : (item.stock || 0) > 0,
    stock: item.stock || 0,
    availableStock: item.availableStock ?? item.stock ?? 0,
    sku: item.sku || item.article || '',
    images: images,
    image_url: images[0] || '',
    characteristics: item.characteristics || {},
  };
};

// ============================================================
// КОМПОНЕНТ КАРТОЧКИ ТОВАРА
// ============================================================
function ProductCard({ product }: { product: Product }) {
  const [imgError, setImgError] = useState(false);
  const { isInCart, getQuantity } = useCart();
  
  const imageUrl = product.images?.[0] || PLACEHOLDER_IMAGE;
  const finalImageUrl = imgError ? PLACEHOLDER_IMAGE : imageUrl;
  
  const availability = productAvailability(product);
  const isOutOfStock = availability.isOnOrder;
  const inCart = isInCart(String(product.id));
  const quantityInCart = getQuantity(String(product.id));

  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-foreground/30 transition hover:shadow-lg hover:shadow-black/5 flex flex-col">
      <Link href={`/catalog/${product.id}`} className="block aspect-square bg-muted relative overflow-hidden">
        <div className="relative w-full h-full">
          <Image
            src={finalImageUrl}
            alt={product.name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition duration-500"
            onError={() => setImgError(true)}
            unoptimized
          />
        </div>
        
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {isOutOfStock && (
            <span className="bg-white/10 backdrop-blur-sm text-white text-[10px] font-medium px-3 py-1 rounded-full border border-white/20 shadow-sm">
                Под заказ
            </span>
          )}
          {product.oldPrice && (
            <span className="bg-green-500/90 backdrop-blur-sm text-white text-[10px] font-medium px-3 py-1 rounded-full">
              -{Math.round((1 - product.price / product.oldPrice) * 100)}%
            </span>
          )}
        </div>
        тзь
        {inCart && !isOutOfStock && (
          <div className="absolute bottom-3 right-3 bg-foreground/90 backdrop-blur-sm text-background text-[10px] font-medium px-3 py-1 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3" />
            {quantityInCart > 1 ? `${quantityInCart} шт.` : 'В корзине'}
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 hidden sm:flex items-center justify-center bg-black/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none p-6">
            <div className="max-w-[220px] text-center">
              <p className="text-sm font-medium text-white leading-relaxed">
                Для приобретения товара свяжитесь с менеджером
              </p>
              <span className="inline-block mt-2 text-xs text-white/65">Подробнее →</span>
            </div>
          </div>
        )}
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <Link href={`/catalog/${product.id}`}>
          <h3 className="font-semibold text-foreground hover:text-muted-foreground transition line-clamp-2 text-sm leading-snug">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {product.sku && (
            <span className="text-xs text-muted-foreground/60">Арт: {product.sku}</span>
          )}
        </div>

        {product.description && (
          <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-2 flex-1">
            {product.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {product.category && (
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {product.category}
            </span>
          )}
          {!isOutOfStock && (
            <span className="text-[10px] text-green-500 px-2 py-0.5 rounded-full bg-green-500/10">
              {availability.label}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between mt-3 pt-3 border-t border-border">
          <div>
            <span className="text-xl font-bold text-foreground">
              {product.price.toLocaleString()} ₽
            </span>
            {product.oldPrice && (
              <span className="text-sm text-muted-foreground/50 line-through ml-2">
                {product.oldPrice.toLocaleString()} ₽
              </span>
            )}
          </div>
          
          {!isOutOfStock && <AddToCartButton
            productId={String(product.id)} 
            showQuantity={false}
            maxStock={availability.availableStock}
            className="px-3 py-2 text-sm"
          />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ОСНОВНАЯ СТРАНИЦА КАТАЛОГА — БЕЗ КЕША!
// ============================================================
export default function CatalogPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const categoryFromUrl = searchParams.get('category') || '';
  const searchFromUrl = searchParams.get('search') || '';
  const pageFromUrl = parseInt(searchParams.get('page') || '1');

  const [search, setSearch] = useState(searchFromUrl);
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(pageFromUrl || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // ===== ЗАГРУЗКА ДАННЫХ (БЕЗ КЕША) =====
  const loadData = async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      // Загружаем товары
      const products = await fetchProducts();
      const normalized = products.map(normalizeProduct);
      setAllProducts(normalized);
      
      // Загружаем категории
      const cats = await fetchCategories();
      setCategories(cats);
      
    } catch (err: unknown) {
      setError(userMessageFromError(err, 'Не удалось загрузить товары. Попробуйте позже.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Загрузка при монтировании
  useEffect(() => {
    loadData(true);
    const reload = () => { void loadData(false); };
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, []);

  // ===== СИНХРОНИЗАЦИЯ С URL =====
  useEffect(() => {
    if (categoryFromUrl) setSelectedCategory(categoryFromUrl);
  }, [categoryFromUrl]);

  useEffect(() => {
    if (searchFromUrl) setSearch(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    if (pageFromUrl) setCurrentPage(pageFromUrl);
  }, [pageFromUrl]);

  // ===== РУЧНОЕ ОБНОВЛЕНИЕ =====
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };

  // ===== ФИЛЬТРАЦИЯ =====
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    if (selectedCategory) {
      result = result.filter(p => matchesProductCategory(p, selectedCategory));
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

  // ===== ПАГИНАЦИЯ =====
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, currentPage]);

  // ===== ОБНОВЛЕНИЕ URL =====
  const updateUrl = useCallback((category: string, page: number, searchTerm: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (page > 1) params.set('page', String(page));
    if (searchTerm) params.set('search', searchTerm);

    const queryString = params.toString();
    const newUrl = queryString ? `/catalog?${queryString}` : '/catalog';
    router.push(newUrl);
  }, [router]);

  // ===== ОБРАБОТЧИКИ =====
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl h-[320px] animate-pulse">
                <div className="h-48 bg-muted rounded-t-2xl" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-6 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom">
        {/* Заголовок */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-bold text-foreground">Каталог</h1>
              {selectedCategory && (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm text-foreground">
                  {selectedCategory}
                  <button onClick={() => selectCategory('')} className="hover:text-muted-foreground transition">
                    <X size={14} />
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm text-foreground">
                  Поиск: {search}
                  <button onClick={() => handleSearch('')} className="hover:text-muted-foreground transition">
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
            <p className="text-muted-foreground font-light mt-2">
              Тюнинг, свап-комплекты и запчасти для внедорожников
              {allProducts.length > 0 && (
                <span className="ml-2 text-sm text-muted-foreground/50">
                  (всего {allProducts.length} товаров)
                </span>
              )}
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition disabled:opacity-50 flex-shrink-0"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {refreshing ? 'Обновление...' : 'Обновить'}
          </button>
        </div>

        {/* Поиск и фильтры */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Поиск товаров..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-2xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10 transition"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition ${
              showFilters || selectedCategory || search
                ? 'bg-foreground text-background'
                : 'bg-muted border border-border text-foreground hover:bg-muted/80'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span className="font-medium">Фильтры</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {(selectedCategory || search) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <X className="w-4 h-4" />
              Сбросить
            </button>
          )}
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-8 animate-in slide-in-from-top-2 duration-200">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Категория
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => selectCategory('')}
                    className={`px-4 py-2 rounded-lg text-sm transition ${
                      !selectedCategory
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                  >
                    Все
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => selectCategory(cat)}
                      className={`px-4 py-2 rounded-lg text-sm transition ${
                        selectedCategory === cat
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6 pt-4 border-t border-border">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition border border-border rounded-lg"
              >
                Сбросить все
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:bg-foreground/90 transition"
              >
                Применить
              </button>
            </div>
          </div>
        )}

        {/* Результаты */}
        {error ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => loadData(true)}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-lg text-sm hover:bg-foreground/90 transition"
            >
              Попробовать снова
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-foreground text-lg font-medium">Товаров не найдено</p>
            <p className="text-muted-foreground text-sm mt-1">Попробуйте изменить фильтры</p>
            <button
              onClick={clearFilters}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-lg text-sm hover:bg-foreground/90 transition"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedProducts.map((product) => (
                <ProductCard key={String(product.id)} product={product} />
              ))}
            </div>

            <div className="text-center mt-6 text-sm text-muted-foreground/60">
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
                  className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    currentPage === 1
                      ? 'text-muted-foreground/30 cursor-not-allowed'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                          page === currentPage
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={index} className="w-10 h-10 flex items-center justify-center text-muted-foreground/50">
                        {page}
                      </span>
                    )
                  ))}
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    currentPage === totalPages
                      ? 'text-muted-foreground/30 cursor-not-allowed'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
