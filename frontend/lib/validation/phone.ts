// frontend/lib/validation/phone.ts
'use client';

// ============================================================
// ОЧИСТКА ТЕЛЕФОНА (ТОЛЬКО ЦИФРЫ)
// ============================================================
export const cleanPhone = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

// ============================================================
// ВАЛИДАЦИЯ ТЕЛЕФОНА
// ============================================================
export interface PhoneValidationResult {
  valid: boolean;
  error: string;
  formatted: string;
  normalized: string;
}

export const validatePhone = (phone: string): PhoneValidationResult => {
  const digits = cleanPhone(phone);
  
  if (!digits) {
    return { valid: false, error: 'Введите номер телефона', formatted: '', normalized: '' };
  }
  
  if (digits.length < 10) {
    return { 
      valid: false, 
      error: `Нужно ещё ${10 - digits.length} цифр`, 
      formatted: '', 
      normalized: '' 
    };
  }
  
  if (digits.length > 11) {
    return { 
      valid: false, 
      error: 'Номер слишком длинный (максимум 11 цифр)', 
      formatted: '', 
      normalized: '' 
    };
  }
  
  let normalized = digits;
  
  // Нормализация: всегда +7XXXXXXXXXX
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
      return { valid: false, error: 'Неверный формат номера', formatted: '', normalized: '' };
    }
  }
  
  // Форматирование для отображения
  const formatted = `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  
  return { valid: true, error: '', formatted, normalized };
};

// ============================================================
// ФОРМАТИРОВАНИЕ ПРИ ВВОДЕ
// ============================================================
export const formatPhoneInput = (value: string): string => {
  const digits = cleanPhone(value);
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
// ПРОВЕРКА ДЛЯ СЕРВЕРА (БЕЗ ФОРМАТИРОВАНИЯ)
// ============================================================
export const validatePhoneServer = (phone: string): boolean => {
  if (!phone) return true;
  const digits = cleanPhone(phone);
  return digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'));
};

// ============================================================
// ФОРМАТИРОВАНИЕ ДЛЯ ОТОБРАЖЕНИЯ
// ============================================================
export const formatPhoneDisplay = (phone: string): string => {
  if (!phone) return '';
  const digits = cleanPhone(phone);
  if (digits.length !== 11) return phone;
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
};

// ============================================================
// НОРМАЛИЗАЦИЯ ДЛЯ ОТПРАВКИ НА СЕРВЕР
// ============================================================
export const normalizePhoneForServer = (phone: string): string => {
  if (!phone) return '';
  const digits = cleanPhone(phone);
  
  // Если начинается с 8, меняем на 7
  if (digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }
  
  // Если начинается с 7, возвращаем как есть
  if (digits.startsWith('7')) {
    return digits;
  }
  
  // Если 10 цифр, добавляем 7
  if (digits.length === 10) {
    return `7${digits}`;
  }
  
  // Если 11 цифр и не начинается с 7 или 8
  if (digits.length === 11) {
    return `7${digits}`;
  }
  
  return digits;
};

// ============================================================
// ПОЛУЧИТЬ ТОЛЬКО ЦИФРЫ (АЛИАС)
// ============================================================
export const getPhoneDigits = cleanPhone;