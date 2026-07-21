// frontend/app/(public)/cart/page.tsx
'use client';

import { useState, useEffect } from 'react';
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
  AlertCircle,
  Home,
  ChevronRight,
  Mail,
  MessageSquare,
  Package,
  Phone
} from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';
import { useAuth } from '@/lib/hooks/useAuth';
import { fetchWithCsrf } from '@/lib/csrf';
import { PhoneInput } from '@/components/PhoneInput';
import { AddressInput } from '@/components/AddressInput';
import { 
  validatePhone, 
  cleanPhone, 
  formatPhoneInput,
  normalizePhoneForServer
} from '@/lib/validation/phone';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
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
        const result = validatePhone(value);
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
      const formatted = formatPhoneInput(value);
      formattedValue = normalizePhoneForServer(formatted);
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
                    <PhoneInput
                      label="Телефон"
                      value={formData.phone}
                      onChange={(val) => handleFieldChange('phone', val)}
                      onBlur={() => handleFieldBlur('phone')}
                      error={formErrors.phone}
                      required
                      className="w-full"
                    />
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
                    Нажимая кнопку, вы соглашаетесь с{' '}
                    <Link href="/offer" className="text-muted-foreground hover:text-foreground underline transition">
                      условиями оферты
                    </Link>
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