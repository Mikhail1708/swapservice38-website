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
  Search,
  Phone,
  AlertCircle,
  Building,
  Home
} from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';
import { useAuth } from '@/lib/hooks/useAuth';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

// ============================================================
// ЖЁСТКАЯ ВАЛИДАЦИЯ ТЕЛЕФОНА
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
// ПОИСК АДРЕСОВ ЧЕРЕЗ DADATA
// ============================================================
interface Suggestion {
  value: string;
  city: string;
  street: string;
  house: string;
  postal_code?: string;
  coordinates?: { lat: number; lon: number };
}

// ✅ ПОИСК ГОРОДОВ (ТОЛЬКО ГОРОДА)
const searchCities = async (query: string): Promise<Suggestion[]> => {
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
        count: 10,
        from_bound: { value: 'city' },
        to_bound: { value: 'city' },
      }),
    });

    if (!response.ok) throw new Error('DaData API error');
    
    const data = await response.json();
    
    return data.suggestions.map((s: any) => ({
      value: s.value,
      city: s.value,
      street: '',
      house: '',
      postal_code: s.data?.postal_code,
    }));
  } catch (error) {
    console.warn('DaData API error (cities):', error);
    return [];
  }
};

// ✅ ПОИСК АДРЕСОВ (С УЧЁТОМ ГОРОДА)
const searchAddresses = async (query: string, city?: string): Promise<Suggestion[]> => {
  if (!query || query.length < 2) return [];
  
  // Если есть город — ищем в нём
  const searchQuery = city ? `${city}, ${query}` : query;
  
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
        query: searchQuery,
        count: 10,
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
      coordinates: s.data?.geo_lat && s.data?.geo_lon 
        ? { lat: parseFloat(s.data.geo_lat), lon: parseFloat(s.data.geo_lon) }
        : undefined,
    }));
  } catch (error) {
    console.warn('DaData API error (addresses):', error);
    return [];
  }
};

// ============================================================
// КОМПОНЕНТ АВТОДОПОЛНЕНИЯ ГОРОДА
// ============================================================
function CityAutocomplete({ 
  value, 
  onChange, 
  onBlur,
  error,
  touched,
}: { 
  value: string; 
  onChange: (val: string) => void; 
  onBlur: () => void;
  error?: string;
  touched?: boolean;
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
        const results = await searchCities(value);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error('Error searching cities:', error);
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

  const handleInputChange = (val: string) => {
    onChange(val);
    if (val.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    onChange(suggestion.value);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const getFieldStatus = () => {
    if (!touched) return 'idle';
    if (error) return 'error';
    if (value && value.length > 1) return 'success';
    return 'idle';
  };

  const status = getFieldStatus();

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (value.length > 1 && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            onBlur();
            setTimeout(() => setShowSuggestions(false), 300);
          }}
          className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 transition ${
            status === 'error' 
              ? 'border-red-400 ring-red-100' 
              : status === 'success'
              ? 'border-green-400 ring-green-100'
              : 'border-gray-200 focus:ring-black/10'
          }`}
          placeholder="Иркутск"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
        {!isLoading && value && status === 'success' && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition flex items-center gap-2 border-b border-gray-50 last:border-0"
            >
              <MapPin className="w-3 h-3 text-gray-400" />
              <span className="text-black">{suggestion.value}</span>
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
// КОМПОНЕНТ АВТОДОПОЛНЕНИЯ АДРЕСА (С УЧЁТОМ ГОРОДА)
// ============================================================
function AddressAutocomplete({ 
  value, 
  city,
  onChange, 
  onBlur,
  error,
  touched,
  placeholder = 'Начните вводить адрес...',
}: { 
  value: string; 
  city: string;
  onChange: (val: string, suggestion?: Suggestion) => void; 
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
        const results = await searchAddresses(value, city);
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
  }, [value, city]);

  const handleInputChange = (val: string) => {
    onChange(val);
    if (val.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    // Если выбран адрес — автоматически заполняем город
    if (suggestion.city && !city) {
      // Город обновится через onChange в родителе
    }
    onChange(suggestion.value, suggestion);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const getFieldStatus = () => {
    if (!touched) return 'idle';
    if (error) return 'error';
    if (value && value.length > 1) return 'success';
    return 'idle';
  };

  const status = getFieldStatus();

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (value.length > 1 && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            onBlur();
            setTimeout(() => setShowSuggestions(false), 300);
          }}
          className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 transition ${
            status === 'error' 
              ? 'border-red-400 ring-red-100' 
              : status === 'success'
              ? 'border-green-400 ring-green-100'
              : 'border-gray-200 focus:ring-black/10'
          }`}
          placeholder={placeholder}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
        {!isLoading && value && status === 'success' && (
          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition flex flex-col border-b border-gray-50 last:border-0"
            >
              <span className="text-black font-medium">{suggestion.value}</span>
              <span className="text-xs text-gray-400 mt-0.5">
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
// ОСНОВНАЯ СТРАНИЦА
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
    city: '',
    address: '',
    comment: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [orderError, setOrderError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const items = cart?.items || [];
  const total = items.reduce((sum: number, item: CartItem) => sum + (item.price || 0) * (item.quantity || 0), 0);

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
      case 'city':
        if (!value.trim()) return 'Укажите город';
        if (value.trim().length < 2) return 'Город должен содержать минимум 2 символа';
        return '';
      case 'address':
        if (!value.trim()) return 'Укажите адрес доставки';
        if (value.trim().length < 5) return 'Укажите полный адрес';
        return '';
      default:
        return '';
    }
  };

  const handleFieldChange = (field: string, value: string, suggestion?: Suggestion) => {
    let formattedValue = value;
    
    if (field === 'phone') {
      formattedValue = formatPhoneInput(value);
    }
    
    // Если есть предложение от геокодера — обновляем город автоматически
    if (field === 'address' && suggestion && suggestion.city) {
      setFormData(prev => ({
        ...prev,
        address: formattedValue,
        city: suggestion.city || prev.city,
      }));
      return;
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
    const fields = ['firstName', 'lastName', 'phone', 'email', 'city', 'address'] as const;
    
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
          city: formData.city.trim(),
          address: formData.address.trim(),
        },
        items: items.map((item: CartItem) => ({
          productId: parseInt(item.productId),
          quantity: item.quantity,
          price: item.price,
        })),
        deliveryMethod: 'courier',
        deliveryAddress: `${formData.city.trim()}, ${formData.address.trim()}`,
        comment: formData.comment.trim(),
        source: 'website',
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
        credentials: 'include',
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white pt-32">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20">
        <div className="container-custom max-w-4xl">
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-10 h-10 text-gray-300" />
            </div>
            <h2 className="text-2xl font-bold text-black">Корзина пуста</h2>
            <p className="text-gray-400 mt-2">Добавьте товары в корзину</p>
            <Link 
              href="/catalog" 
              className="inline-block mt-6 px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition"
            >
              Перейти в каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white pt-32 pb-20">
        <div className="container-custom max-w-4xl">
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-gray-300" />
            </div>
            <h2 className="text-2xl font-bold text-black">Требуется авторизация</h2>
            <p className="text-gray-400 mt-2">Для оформления заказа необходимо войти в аккаунт</p>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <Link 
                href="/login?redirect=/cart" 
                className="px-8 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition"
              >
                Войти
              </Link>
              <Link 
                href="/register?redirect=/cart" 
                className="px-8 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 transition"
              >
                Зарегистрироваться
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20">
      <div className="container-custom max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/catalog" className="text-gray-400 hover:text-black transition p-2 hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-bold text-black">Корзина</h1>
          <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            {items.length} {items.length === 1 ? 'товар' : 'товара'}
          </span>
        </div>

        {orderError && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2">
            <X className="w-4 h-4" />
            {orderError}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {items.map((item: CartItem, index: number) => (
                <div 
                  key={item.productId}
                  className={`p-5 flex gap-5 hover:bg-gray-50/50 transition ${
                    index !== items.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    <Image
                      src={item.image || '/images/logo/logo.png'}
                      alt={item.name || 'Товар'}
                      width={96}
                      height={96}
                      className="w-full h-full object-contain p-2"
                      unoptimized
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-black hover:text-gray-600 transition line-clamp-2">
                      {item.name || 'Товар'}
                    </h3>
                    
                    <div className="text-sm text-gray-400 mt-1">
                      {item.price ? `${item.price.toLocaleString()} ₽` : 'Цена не указана'}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center gap-1 border border-gray-200 rounded-xl bg-white">
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                          className="p-2 hover:bg-gray-100 rounded-xl transition disabled:opacity-50"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                          className="p-2 hover:bg-gray-100 rounded-xl transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-gray-300 hover:text-red-500 transition p-2 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <span className="text-lg font-bold text-black">
                      {(item.price * item.quantity).toLocaleString()} ₽
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleClearCart}
              className="text-sm text-gray-400 hover:text-red-500 transition flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Очистить корзину
            </button>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
                <ShieldCheck className="w-6 h-6 text-black mx-auto mb-2" />
                <p className="text-xs text-gray-500">Безопасная оплата</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
                <Truck className="w-6 h-6 text-black mx-auto mb-2" />
                <p className="text-xs text-gray-500">Быстрая доставка</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
                <Clock className="w-6 h-6 text-black mx-auto mb-2" />
                <p className="text-xs text-gray-500">Поддержка 24/7</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-32">
              <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Оформление заказа
              </h2>

              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 font-medium mb-1.5">
                      Имя <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleFieldChange('firstName', e.target.value)}
                      onBlur={() => handleFieldBlur('firstName')}
                      className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 transition ${
                        getFieldStatus('firstName') === 'error' 
                          ? 'border-red-400 ring-red-100' 
                          : getFieldStatus('firstName') === 'success'
                          ? 'border-green-400 ring-green-100'
                          : 'border-gray-200 focus:ring-black/10'
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
                    <label className="block text-sm text-gray-600 font-medium mb-1.5">
                      Фамилия <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleFieldChange('lastName', e.target.value)}
                      onBlur={() => handleFieldBlur('lastName')}
                      className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 transition ${
                        getFieldStatus('lastName') === 'error' 
                          ? 'border-red-400 ring-red-100' 
                          : getFieldStatus('lastName') === 'success'
                          ? 'border-green-400 ring-green-100'
                          : 'border-gray-200 focus:ring-black/10'
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

                <div>
                  <label className="block text-sm text-gray-600 font-medium mb-1.5">
                    Телефон <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      onBlur={() => handleFieldBlur('phone')}
                      className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 transition ${
                        getFieldStatus('phone') === 'error' 
                          ? 'border-red-400 ring-red-100' 
                          : getFieldStatus('phone') === 'success'
                          ? 'border-green-400 ring-green-100'
                          : 'border-gray-200 focus:ring-black/10'
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
                  {!formErrors.phone && formData.phone && getFieldStatus('phone') === 'success' && (
                    <p className="text-xs text-green-500 mt-1">✅ Номер корректен</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-600 font-medium mb-1.5">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 transition ${
                      getFieldStatus('email') === 'error' 
                        ? 'border-red-400 ring-red-100' 
                        : getFieldStatus('email') === 'success'
                        ? 'border-green-400 ring-green-100'
                        : 'border-gray-200 focus:ring-black/10'
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

                {/* ✅ ГОРОД — АВТОДОПОЛНЕНИЕ ОТ DADATA */}
                <div>
                  <label className="block text-sm text-gray-600 font-medium mb-1.5">
                    Город <span className="text-red-400">*</span>
                  </label>
                  <CityAutocomplete
                    value={formData.city}
                    onChange={(val) => handleFieldChange('city', val)}
                    onBlur={() => handleFieldBlur('city')}
                    error={formErrors.city}
                    touched={touched.city}
                  />
                </div>

                {/* ✅ АДРЕС — АВТОДОПОЛНЕНИЕ С УЧЁТОМ ГОРОДА */}
                <div>
                  <label className="block text-sm text-gray-600 font-medium mb-1.5">
                    Адрес доставки <span className="text-red-400">*</span>
                  </label>
                  <AddressAutocomplete
                    value={formData.address}
                    city={formData.city}
                    onChange={(val, suggestion) => handleFieldChange('address', val, suggestion)}
                    onBlur={() => handleFieldBlur('address')}
                    error={formErrors.address}
                    touched={touched.address}
                    placeholder="ул. Ленина, д. 1, кв. 1"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 font-medium mb-1.5">Комментарий</label>
                  <textarea
                    value={formData.comment}
                    onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition resize-none"
                    rows={2}
                    placeholder="Дополнительная информация..."
                  />
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Товары ({items.length} шт):</span>
                    <span className="font-medium">{total.toLocaleString()} ₽</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Доставка:</span>
                    <span className="font-medium text-gray-400">Рассчитывается</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-gray-200">
                    <span>Итого:</span>
                    <span className="text-black">{total.toLocaleString()} ₽</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCheckingOut}
                  className="w-full py-4 bg-black text-white rounded-2xl font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
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

                <p className="text-xs text-gray-400 text-center mt-3">
                  Нажимая кнопку, вы соглашаетесь с условиями оферты
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}