'use client';

import { useState, useEffect, useCallback } from 'react';
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
  CheckCircle2
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
// ФУНКЦИЯ ОЧИСТКИ ТЕЛЕФОНА
// ============================================================
const cleanPhone = (phone: string): string => {
  if (!phone) return '';
  
  // Удаляем все кроме цифр
  let cleaned = phone.replace(/\D/g, '');
  
  // Если номер начинается с 8, заменяем на 7
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.substring(1);
  }
  
  // Если номер начинается с 7 и длина 11 цифр
  if (cleaned.startsWith('7') && cleaned.length === 11) {
    return '+' + cleaned;
  }
  
  // Если номер начинается с 7 и длина 10 цифр
  if (cleaned.startsWith('7') && cleaned.length === 10) {
    return '+' + cleaned;
  }
  
  // Если номер из 10 цифр без кода страны
  if (cleaned.length === 10) {
    return '+7' + cleaned;
  }
  
  // Если номер из 11 цифр без +
  if (cleaned.length === 11) {
    return '+' + cleaned;
  }
  
  // Если уже есть + или другой формат
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Возвращаем как есть
  return phone;
};

// ============================================================
// ФУНКЦИЯ ФОРМАТИРОВАНИЯ ТЕЛЕФОНА ПРИ ВВОДЕ
// ============================================================
const formatPhoneInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  let formatted = '';
  
  if (digits.startsWith('7') || digits.startsWith('8')) {
    formatted = '+7';
    const rest = digits.slice(1);
    
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

  // Безопасное получение items
  const items = cart?.items || [];
  const total = items.reduce((sum: number, item: CartItem) => sum + (item.price || 0) * (item.quantity || 0), 0);

  // Автозаполнение из профиля
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
        const cleaned = cleanPhone(value).replace(/\D/g, '');
        if (cleaned.length < 10) return 'Введите полный номер телефона (10 цифр)';
        if (cleaned.length > 11) return 'Номер телефона слишком длинный';
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

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20">
      <div className="container-custom max-w-7xl">
        {/* Заголовок */}
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
          {/* Товары в корзине */}
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
                      src={item.image || '/images/placeholder.svg'}
                      alt={item.name || 'Товар'}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
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

            {/* Преимущества */}
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

          {/* Форма оформления */}
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
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    onBlur={() => handleFieldBlur('phone')}
                    className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 transition ${
                      getFieldStatus('phone') === 'error' 
                        ? 'border-red-400 ring-red-100' 
                        : getFieldStatus('phone') === 'success'
                        ? 'border-green-400 ring-green-100'
                        : 'border-gray-200 focus:ring-black/10'
                    }`}
                    placeholder="+7 (999) 999-99-99"
                  />
                  {formErrors.phone && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {formErrors.phone}
                    </p>
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

                <div>
                  <label className="block text-sm text-gray-600 font-medium mb-1.5">
                    Город <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                    onBlur={() => handleFieldBlur('city')}
                    className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 transition ${
                      getFieldStatus('city') === 'error' 
                        ? 'border-red-400 ring-red-100' 
                        : getFieldStatus('city') === 'success'
                        ? 'border-green-400 ring-green-100'
                        : 'border-gray-200 focus:ring-black/10'
                    }`}
                    placeholder="Иркутск"
                  />
                  {formErrors.city && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {formErrors.city}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-600 font-medium mb-1.5">
                    Адрес доставки <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    onBlur={() => handleFieldBlur('address')}
                    className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 transition ${
                      getFieldStatus('address') === 'error' 
                        ? 'border-red-400 ring-red-100' 
                        : getFieldStatus('address') === 'success'
                        ? 'border-green-400 ring-green-100'
                        : 'border-gray-200 focus:ring-black/10'
                    }`}
                    placeholder="ул. Ленина, д. 1, кв. 1"
                  />
                  {formErrors.address && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {formErrors.address}
                    </p>
                  )}
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