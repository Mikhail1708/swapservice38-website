'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowLeft,
  Loader2,
  CreditCard,
  ShieldCheck,
  Truck,
  Clock,
  X,
  CheckCircle2,
  MapPin,
  Phone,
  AlertCircle,
  Home,
  ChevronRight,
  User,
  Mail,
  MessageSquare,
  Package
} from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';
import { useAuth } from '@/lib/hooks/useAuth';
import { fetchWithCsrf } from '@/lib/csrf';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

// ============================================================
// ВАЛИДАЦИЯ ТЕЛЕФОНА
// ============================================================
const validatePhoneStrict = (phone: string): { valid: boolean; error: string; formatted: string } => {
  const digits = phone.replace(/\D/g, '');
  
  if (!digits) {
    return { valid: false, error: 'Введите номер телефона', formatted: '' };
  }
  
  if (digits.length < 10) {
    return { valid: false, error: `Нужно ещё ${10 - digits.length} цифр`, formatted: '' };
  }
  
  if (digits.length > 11) {
    return { valid: false, error: 'Номер слишком длинный (максимум 11 цифр)', formatted: '' };
  }
  
  let formatted = '';
  let normalized = digits;
  
  if (digits.length === 10 && !['7', '8', '9'].includes(digits[0])) {
    normalized = '7' + digits;
  }
  
  if (digits.length === 11 && digits[0] === '8') {
    normalized = '7' + digits.slice(1);
  }
  
  if (digits.length === 11 && digits[0] === '9') {
    normalized = '7' + digits;
  }
  
  if (digits.length === 10 && (digits[0] === '7' || digits[0] === '9')) {
    normalized = '7' + digits;
  }
  
  if (normalized.length !== 11 || normalized[0] !== '7') {
    if (normalized.length === 10) {
      normalized = '7' + normalized;
    } else if (normalized.length === 12) {
      normalized = normalized.slice(0, 11);
    } else {
      return { valid: false, error: 'Неверный формат номера', formatted: '' };
    }
  }
  
  formatted = `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  
  return { valid: true, error: '', formatted };
};

const cleanPhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '7') return '+' + digits;
  if (digits.length === 10) return '+7' + digits;
  if (digits.length === 11 && digits[0] === '8') return '+7' + digits.slice(1);
  return phone;
};

const formatPhoneInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  
  let formatted = '';
  let rest = digits;
  
  if (digits.startsWith('7') || digits.startsWith('8') || digits.startsWith('9')) {
    formatted = '+7';
    if (digits.startsWith('8')) {
      rest = digits.slice(1);
    } else if (digits.startsWith('7')) {
      rest = digits.slice(1);
    } else {
      formatted = '+7';
      rest = digits;
    }
    
    if (rest.length > 0) {
      formatted += ' (' + rest.slice(0, 3);
    }
    if (rest.length > 3) {
      formatted += ') ' + rest.slice(3, 6);
    }
    if (rest.length > 6) {
      formatted += '-' + rest.slice(6, 8);
    }
    if (rest.length > 8) {
      formatted += '-' + rest.slice(8, 10);
    }
  } else {
    formatted = digits;
  }
  
  return formatted;
};

// ============================================================
// ПОИСК АДРЕСОВ
// ============================================================
interface Suggestion {
  value: string;
  city: string;
  street: string;
  house: string;
  postal_code?: string;
}

const searchAddresses = async (query: string): Promise<Suggestion[]> => {
  if (!query || query.length < 2) return [];
  
  try {
    const apiKey = process.env.NEXT_PUBLIC_DADATA_API_KEY || '';
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${apiKey}`,
      },
      body: JSON.stringify({
        query: query,
        count: 5,
        from_bound: { value: 'street' },
        to_bound: { value: 'house' },
      }),
    });

    if (!response.ok) throw new Error('DaData API error');
    
    const data = await response.json();
    
    return data.suggestions.map((s: any) => ({
      value: s.value,
      city: s.data?.city || s.data?.settlement || '',
      street: s.data?.street || '',
      house: s.data?.house || '',
      postal_code: s.data?.postal_code,
    }));
  } catch (error) {
    console.warn('DaData API error:', error);
    return [];
  }
};

// ============================================================
// КОМПОНЕНТ АДРЕСА
// ============================================================
function AddressInput({ 
  value, 
  onChange, 
  onBlur,
  error,
  touched,
  placeholder = 'Начните вводить адрес...',
}: { 
  value: string; 
  onChange: (val: string) => void; 
  onBlur: () => void;
  error?: string;
  touched?: boolean;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchAddresses(value);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error('Error searching addresses:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    onChange(suggestion.value);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const status = touched ? (error ? 'error' : value ? 'success' : 'idle') : 'idle';

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (value.length > 1 && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            onBlur();
            setTimeout(() => setShowSuggestions(false), 300);
          }}
          className={`w-full pl-10 pr-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition ${
            status === 'error' 
              ? 'border-red-500/50 focus:ring-red-500/20' 
              : status === 'success'
              ? 'border-green-500/50 focus:ring-green-500/20'
              : 'border-border focus:border-foreground/30 focus:ring-foreground/10'
          }`}
          placeholder={placeholder}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 animate-spin" />
        )}
        {!isLoading && value && status === 'success' && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition flex flex-col border-b border-border last:border-0"
            >
              <span className="text-foreground font-medium">{suggestion.value}</span>
              <span className="text-xs text-muted-foreground/60 mt-0.5">
                {suggestion.city && <span>🏙️ {suggestion.city}</span>}
                {suggestion.street && <span>📍 {suggestion.street}</span>}
                {suggestion.house && <span>🏠 д. {suggestion.house}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && touched && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================
// ОСНОВНАЯ СТРАНИЦА КОРЗИНЫ
// ============================================================
export default function CartPage() {
  const { cart, isLoading, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    comment: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [orderError, setOrderError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const items = cart?.items || [];
  const total = items.reduce((sum: number, item: CartItem) => sum + (item.price || 0) * (item.quantity || 0), 0);

  // Заполняем данными пользователя
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email || '',
        address: user.address || '',
      }));
    }
  }, [user]);

  const handleUpdateQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    await updateQuantity(productId, newQuantity);
  };

  const handleRemoveItem = async (productId: string) => {
    if (confirm('Удалить товар из корзины?')) {
      await updateQuantity(productId, 0);
    }
  };

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'firstName':
        if (!value.trim()) return 'Укажите имя';
        if (value.trim().length < 2) return 'Имя должно содержать минимум 2 символа';
        return '';
      case 'lastName':
        if (!value.trim()) return 'Укажите фамилию';
        if (value.trim().length < 2) return 'Фамилия должна содержать минимум 2 символа';
        return '';
      case 'phone':
        if (!value.trim()) return 'Укажите телефон';
        const result = validatePhoneStrict(value);
        if (!result.valid) return result.error;
        return '';
      case 'email':
        if (!value.trim()) return 'Укажите email';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Неверный формат email';
        }
        return '';
      case 'address':
        if (!value.trim()) return 'Укажите адрес доставки';
        if (value.trim().length < 5) return 'Укажите полный адрес';
        return '';
      default:
        return '';
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'phone') {
      formattedValue = formatPhoneInput(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    
    if (touched[field]) {
      const error = validateField(field, formattedValue);
      setFormErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setFormErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const fields = ['firstName', 'lastName', 'phone', 'email', 'address'] as const;
    
    fields.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) errors[field] = error;
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleClearCart = async () => {
    if (!confirm('Вы уверены, что хотите очистить корзину?')) return;
    try {
      await clearCart();
    } catch (error) {
      console.error('Ошибка очистки:', error);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setOrderError('Для оформления заказа необходимо авторизоваться');
      router.push('/login?redirect=/cart');
      return;
    }
    
    if (!validateForm()) return;
    if (items.length === 0) {
      setOrderError('Корзина пуста');
      return;
    }

    setIsCheckingOut(true);
    setOrderError(null);

    try {
      const cleanedPhone = cleanPhone(formData.phone);
      
      const orderData = {
        client: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: cleanedPhone,
          email: formData.email.trim(),
          address: formData.address.trim(),
        },
        items: items.map((item: CartItem) => ({
          productId: parseInt(item.productId),
          quantity: item.quantity,
          price: item.price,
        })),
        deliveryMethod: 'courier',
        deliveryAddress: formData.address.trim(),
        comment: formData.comment.trim(),
        source: 'website',
      };

      const response = await fetchWithCsrf('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });

      let data;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Ошибка сервера: ' + text.substring(0, 100));
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Ошибка создания заказа');
      }

      await clearCart();

      if (data.paymentUrl) {
        router.push(data.paymentUrl);
      } else if (data.order?.id) {
        router.push(`/payment/${data.order.id}`);
      } else if (data.orderId) {
        router.push(`/payment/${data.orderId}`);
      } else {
        router.push('/payment/success');
      }

    } catch (error: any) {
      console.error('❌ Ошибка оформления заказа:', error);
      setOrderError(error.message || 'Ошибка оформления заказа');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const getFieldStatus = (field: string) => {
    if (!touched[field]) return 'idle';
    if (formErrors[field]) return 'error';
    return 'success';
  };

  // LOADING
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // EMPTY CART
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-20">
        <div className="container-custom max-w-4xl">
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Корзина пуста</h2>
            <p className="text-muted-foreground mt-2">Добавьте товары в корзину</p>
            <Link 
              href="/catalog" 
              className="inline-block mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Перейти в каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-20">
      <div className="container-custom max-w-7xl">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/catalog" className="hover:text-foreground transition">Каталог</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">Корзина</span>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-foreground">Корзина</h1>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {items.length} {items.length === 1 ? 'товар' : 'товара'}
          </span>
        </div>

        {orderError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2">
            <X className="w-4 h-4 flex-shrink-0" />
            {orderError}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* ЛЕВАЯ КОЛОНКА — ТОВАРЫ */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {items.map((item: CartItem, index: number) => (
                <div 
                  key={item.productId}
                  className={`p-5 flex gap-5 hover:bg-muted/30 transition ${
                    index !== items.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  {/* Изображение */}
                  <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={item.image || '/images/logo/logo.png'}
                      alt={item.name || 'Товар'}
                      width={96}
                      height={96}
                      className="w-full h-full object-contain p-2"
                      unoptimized
                    />
                  </div>
                  
                  {/* Информация */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground hover:text-muted-foreground transition line-clamp-2">
                      {item.name || 'Товар'}
                    </h3>
                    
                    <div className="text-sm text-muted-foreground mt-1">
                      {item.price ? `${item.price.toLocaleString()} ₽` : 'Цена не указана'}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-border rounded-lg bg-muted/50">
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                          className="p-2 hover:bg-muted rounded-l-lg transition disabled:opacity-50"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-4 h-4 text-foreground" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                          className="p-2 hover:bg-muted rounded-r-lg transition"
                        >
                          <Plus className="w-4 h-4 text-foreground" />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-muted-foreground/50 hover:text-red-500 transition p-2 hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Сумма */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-lg font-bold text-foreground">
                      {(item.price * item.quantity).toLocaleString()} ₽
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleClearCart}
                className="text-sm text-muted-foreground hover:text-red-500 transition flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Очистить корзину
              </button>
              <Link
                href="/catalog"
                className="text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Продолжить покупки
              </Link>
            </div>

            {/* Преимущества */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <ShieldCheck className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Безопасная оплата</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <Truck className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Быстрая доставка</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <Clock className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Поддержка 24/7</p>
              </div>
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА — ОФОРМЛЕНИЕ */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-32">
              <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                Оформление заказа
              </h2>

              {!user ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-foreground font-medium mb-2">Для оформления заказа</p>
                  <p className="text-sm text-muted-foreground mb-4">Войдите в аккаунт или зарегистрируйтесь</p>
                  <div className="flex flex-col gap-3">
                    <Link 
                      href={`/login?redirect=/cart`} 
                      className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition"
                    >
                      Войти
                    </Link>
                    <Link 
                      href={`/register?redirect=/cart`} 
                      className="w-full py-3 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition"
                    >
                      Зарегистрироваться
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCheckout} className="space-y-4">
                  {/* Имя и фамилия */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                        Имя <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleFieldChange('firstName', e.target.value)}
                        onBlur={() => handleFieldBlur('firstName')}
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition ${
                          getFieldStatus('firstName') === 'error' 
                            ? 'border-red-500/50 focus:ring-red-500/20' 
                            : getFieldStatus('firstName') === 'success'
                            ? 'border-green-500/50 focus:ring-green-500/20'
                            : 'border-border focus:border-foreground/30 focus:ring-foreground/10'
                        }`}
                        placeholder="Иван"
                      />
                      {formErrors.firstName && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <X className="w-3 h-3" />
                          {formErrors.firstName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                        Фамилия <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleFieldChange('lastName', e.target.value)}
                        onBlur={() => handleFieldBlur('lastName')}
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition ${
                          getFieldStatus('lastName') === 'error' 
                            ? 'border-red-500/50 focus:ring-red-500/20' 
                            : getFieldStatus('lastName') === 'success'
                            ? 'border-green-500/50 focus:ring-green-500/20'
                            : 'border-border focus:border-foreground/30 focus:ring-foreground/10'
                        }`}
                        placeholder="Петров"
                      />
                      {formErrors.lastName && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <X className="w-3 h-3" />
                          {formErrors.lastName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Телефон */}
                  <div>
                    <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                      <Phone className="w-4 h-4 inline mr-1 text-muted-foreground/50" />
                      Телефон <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                        onBlur={() => handleFieldBlur('phone')}
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition ${
                          getFieldStatus('phone') === 'error' 
                            ? 'border-red-500/50 focus:ring-red-500/20' 
                            : getFieldStatus('phone') === 'success'
                            ? 'border-green-500/50 focus:ring-green-500/20'
                            : 'border-border focus:border-foreground/30 focus:ring-foreground/10'
                        }`}
                        placeholder="+7 (999) 999-99-99"
                        maxLength={18}
                      />
                      {formData.phone && getFieldStatus('phone') === 'success' && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                      )}
                    </div>
                    {formErrors.phone && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <X className="w-3 h-3" />
                        {formErrors.phone}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                      <Mail className="w-4 h-4 inline mr-1 text-muted-foreground/50" />
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      onBlur={() => handleFieldBlur('email')}
                      className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition ${
                        getFieldStatus('email') === 'error' 
                          ? 'border-red-500/50 focus:ring-red-500/20' 
                          : getFieldStatus('email') === 'success'
                          ? 'border-green-500/50 focus:ring-green-500/20'
                          : 'border-border focus:border-foreground/30 focus:ring-foreground/10'
                      }`}
                      placeholder="ivan@mail.ru"
                    />
                    {formErrors.email && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <X className="w-3 h-3" />
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Адрес */}
                  <div>
                    <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                      <Home className="w-4 h-4 inline mr-1 text-muted-foreground/50" />
                      Адрес доставки <span className="text-red-400">*</span>
                    </label>
                    <AddressInput
                      value={formData.address}
                      onChange={(val) => handleFieldChange('address', val)}
                      onBlur={() => handleFieldBlur('address')}
                      error={formErrors.address}
                      touched={touched.address}
                      placeholder="г. Иркутск, ул. Ленина, д. 1"
                    />
                  </div>

                  {/* Комментарий */}
                  <div>
                    <label className="block text-sm text-muted-foreground font-medium mb-1.5">
                      <MessageSquare className="w-4 h-4 inline mr-1 text-muted-foreground/50" />
                      Как удобнее с вами связаться?
                    </label>
                    <textarea
                      value={formData.comment}
                      onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/10 transition resize-none"
                      rows={2}
                      placeholder="Telegram, WhatsApp, Viber, звонок..."
                    />
                  </div>

                  {/* Итог */}
                  <div className="border-t border-border pt-4 mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Товары ({items.length} шт.):</span>
                      <span className="font-medium text-foreground">{total.toLocaleString()} ₽</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Доставка:</span>
                      <span className="font-medium text-muted-foreground/60">Рассчитывается</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-border">
                      <span className="text-foreground">Итого:</span>
                      <span className="text-foreground">{total.toLocaleString()} ₽</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isCheckingOut}
                    className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                  >
                    {isCheckingOut ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Обработка...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Перейти к оплате
                      </>
                    )}
                  </button>

                  <p className="text-xs text-muted-foreground/50 text-center mt-3">
                    Нажимая кнопку, вы соглашаетесь с условиями оферты
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}