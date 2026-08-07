// frontend/components/PhoneInput.tsx
'use client';

import { useState, useRef } from 'react';
import { formatPhoneInput, validatePhone, normalizePhoneForServer }  from '@/lib/validation/phone';

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
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Форматируем для отображения
  const displayValue = value ? formatPhoneInput(value) : '';

  const handleFocus = () => {
    setIsFocused(true);
    // Если поле пустое — подставляем маску
    if (!value) {
      onChange('7');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(2, 2);
        }
      }, 10);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Если пользователь пытается стереть +7 — возвращаем
    if (rawValue === '+' || rawValue === '+7' || rawValue === '') {
      onChange('');
      return;
    }
    
    // Форматируем
    const formatted = formatPhoneInput(rawValue);
    // Сохраняем нормализованное значение (только цифры)
    onChange(normalizePhoneForServer(formatted));
  };

  const handleBlur = () => {
    setIsFocused(false);
    setTouched(true);
    if (onBlur) onBlur();
    
    // Если ввели неполный номер — очищаем
    if (value && value.length < 10) {
      onChange('');
    }
  };

  const validation = validatePhone(value);
  const showError = (touched || error) && value && !validation.valid;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm text-muted-foreground font-medium mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={isFocused ? displayValue || '+7 ' : displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className={`
          w-full px-4 py-2.5 border rounded-lg 
          focus:outline-none focus:ring-2 focus:ring-foreground/20
          transition
          bg-muted text-foreground placeholder:text-muted-foreground/50
          ${showError ? 'border-red-500 focus:ring-red-500/20' : 'border-border focus:border-foreground/30'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
        maxLength={18}
      />
      
      {showError && (
        <p className="text-xs text-red-500 mt-1">
          {error || validation.error}
        </p>
      )}
    </div>
  );
};