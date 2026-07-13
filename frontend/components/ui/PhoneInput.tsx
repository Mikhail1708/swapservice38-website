'use client';

import { useState } from 'react';
import InputMask from 'react-input-mask';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  error?: string;
}

export const PhoneInput = ({
  value,
  onChange,
  onBlur,
  placeholder = '+7 (___) ___-__-__',
  className = '',
  disabled = false,
  required = false,
  label,
  error,
}: PhoneInputProps) => {
  const [touched, setTouched] = useState(false);

  // Очистка номера от форматирования (только цифры)
  const cleanPhone = (phone: string): string => {
    return phone.replace(/\D/g, '');
  };

  // Валидация номера (11 цифр, начинается с 7)
  const validatePhone = (phone: string): boolean => {
    const digits = cleanPhone(phone);
    
    // Должно быть 11 цифр
    if (digits.length !== 11) return false;
    
    // Должно начинаться с 7 или 8 (после очистки всегда будет 7 или 8)
    if (!digits.startsWith('7') && !digits.startsWith('8')) return false;
    
    return true;
  };

  // Форматирование для отправки на сервер (в формате +7XXXXXXXXXX)
  const formatForServer = (phone: string): string => {
    const digits = cleanPhone(phone);
    if (digits.length === 0) return '';
    
    // Если начинается с 8, меняем на 7 (без +)
    if (digits.startsWith('8')) {
      return `7${digits.slice(1)}`;
    }
    
    // Если начинается с 7, возвращаем как есть
    if (digits.startsWith('7')) {
      return digits;
    }
    
    // Если нет кода страны, добавляем 7
    return `7${digits}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const digits = cleanPhone(rawValue);
    
    // Если пустое значение - передаём пустую строку
    if (digits.length === 0) {
      onChange('');
      return;
    }
    
    // Передаём форматированный номер для сервера (только цифры, без +)
    onChange(formatForServer(rawValue));
  };

  const handleBlur = () => {
    setTouched(true);
    if (onBlur) onBlur();
  };

  const showError = (touched || error) && value && !validatePhone(value);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <InputMask
        mask="+7 (999) 999-99-99"
        maskChar="_"
        value={value ? `+7${value.slice(1)}` : ''}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className={`
          w-full px-4 py-2 border rounded-lg 
          focus:outline-none focus:ring-2 focus:ring-gray-900
          transition-colors
          ${showError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-gray-900'}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          ${className}
        `}
      />
      
      {showError && (
        <p className="text-xs text-red-500 mt-1">
          {error || 'Введите корректный номер телефона (11 цифр)'}
        </p>
      )}
    </div>
  );
};

// Вспомогательная функция для валидации телефона на сервере
export const validatePhoneServer = (phone: string): boolean => {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'));
};

// Вспомогательная функция для очистки телефона
export const cleanPhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

// Форматирование для отображения
export const formatPhoneDisplay = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 11) return phone;
  
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
};