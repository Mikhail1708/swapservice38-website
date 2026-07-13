'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: string, data: any) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  error?: string;
}

// Типы для DaData
interface Suggestion {
  value: string;
  unrestricted_value: string;
  data: {
    postal_code?: string;
    country?: string;
    region?: string;
    city?: string;
    street?: string;
    house?: string;
    flat?: string;
    geo_lat?: string;
    geo_lon?: string;
    [key: string]: any;
  };
}

export const AddressInput = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Введите адрес',
  className = '',
  disabled = false,
  required = false,
  label,
  error,
}: AddressInputProps) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Поиск адреса через DaData
  const searchAddress = useCallback(async (search: string) => {
    if (!search || search.length < 2) {
      setSuggestions([]);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_DADATA_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ DaData API ключ не настроен');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${apiKey}`,
        },
        body: JSON.stringify({
          query: search,
          count: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка DaData: ${response.status}`);
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setIsOpen(true);
    } catch (error) {
      console.error('❌ Ошибка DaData:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce для поиска
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      searchAddress(query);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, searchAddress]);

  // Синхронизация с внешним value
  useEffect(() => {
    if (value !== query) {
      setQuery(value || '');
    }
  }, [value]);

  // Выбор адреса
  const handleSelect = (suggestion: Suggestion) => {
    const fullAddress = suggestion.unrestricted_value || suggestion.value;
    setQuery(fullAddress);
    onChange(fullAddress);
    setIsOpen(false);
    setSuggestions([]);
    
    if (onSelect) {
      onSelect(fullAddress, suggestion.data);
    }
  };

  // Очистка
  const handleClear = () => {
    setQuery('');
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleBlur = () => {
    setTouched(true);
    // Если поле не пустое, но не выбрано из списка — оставляем как есть
  };

  const showError = (touched || error) && required && !query;

  return (
    <div className="w-full" ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setTouched(true);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={`
              w-full pl-10 pr-10 py-2 border rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-gray-900
              transition-colors
              ${showError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-gray-900'}
              ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
              ${className}
            `}
          />

          {query && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}

          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>

        {/* Выпадающий список с подсказками */}
        {isOpen && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm border-b border-gray-100 last:border-none"
              >
                <div className="font-medium">{suggestion.value}</div>
                {suggestion.data.city && (
                  <div className="text-xs text-gray-500">
                    {suggestion.data.region && `${suggestion.data.region}, `}
                    {suggestion.data.city}
                    {suggestion.data.street && `, ${suggestion.data.street}`}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {showError && (
        <p className="text-xs text-red-500 mt-1">
          {error || 'Адрес обязателен для заполнения'}
      </p>
      )}
    </div>
  );
};