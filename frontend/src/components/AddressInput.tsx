// frontend/components/AddressInput.tsx
'use client';

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Loader2, MapPin, X, AlertCircle } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf';

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

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: string, data: any) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  error?: string;
  touched?: boolean;
}

// Поиск адресов через DaData
const searchAddresses = async (query: string, signal: AbortSignal): Promise<Suggestion[]> => {
  if (!query || query.length < 3) return []; // минимум 3 символа для поиска

    const response = await fetchWithCsrf('/api/address/suggestions', {
      method: 'POST',
      body: JSON.stringify({ query }),
      signal,
    });

    if (!response.ok) throw new Error('ADDRESS_SUGGESTIONS_UNAVAILABLE');
    
    const data = await response.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
};

export const AddressInput = ({
  value,
  onChange,
  onSelect,
  onBlur,
  placeholder = 'Введите адрес доставки',
  className = '',
  disabled = false,
  required = false,
  label,
  error,
  touched = false,
}: AddressInputProps) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [localTouched, setLocalTouched] = useState(false);
  const [suggestionsUnavailable, setSuggestionsUnavailable] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const isInternalChange = useRef(false);
  const skipNextSearchRef = useRef(false);
  const inputId = useId();
  const listboxId = `${inputId}-suggestions`;

  const isTouched = touched || localTouched;

  // Синхронизация с внешним value
  useEffect(() => {
    if (!isInternalChange.current && value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  // Закрытие подсказок при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Поиск с debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Если пользователь выбрал подсказку — не ищем
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    // Если меньше 3 символов — не ищем
    if (inputValue.length < 3) {
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      setLoading(false);
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;
      setLoading(true);
      try {
        const results = await searchAddresses(inputValue, controller.signal);
        if (controller.signal.aborted) return;
        setSuggestionsUnavailable(false);
        setSuggestions(results);
        setActiveIndex(results.length > 0 ? 0 : -1);
        // Показываем подсказки только если есть результаты и поле не пустое
        setIsOpen(results.length > 0 && inputValue.length >= 3);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSuggestionsUnavailable(true);
        setSuggestions([]);
        setActiveIndex(-1);
        setIsOpen(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400); // чуть больше задержка для комфорта

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      requestControllerRef.current?.abort();
    };
  }, [inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSuggestionsUnavailable(false);
    setLocalTouched(true);
    isInternalChange.current = true;
    onChange(newValue);
    isInternalChange.current = false;
    
    // Если пользователь удалил текст — закрываем подсказки
    if (newValue.length < 3) {
      setIsOpen(false);
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    const fullAddress = suggestion.unrestricted_value || suggestion.value;
    
    setInputValue(fullAddress);
    skipNextSearchRef.current = true;
    setIsOpen(false);
    setSuggestions([]);
    setLocalTouched(true);
    
    isInternalChange.current = true;
    onChange(fullAddress);
    isInternalChange.current = false;
    
    if (onSelect) {
      onSelect(fullAddress, suggestion.data);
    }
    
    // Закрываем подсказки после выбора
    setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };

  const handleClear = () => {
    setInputValue('');
    setSuggestions([]);
    setIsOpen(false);
    isInternalChange.current = true;
    onChange('');
    isInternalChange.current = false;
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleBlur = () => {
    setLocalTouched(true);
    // Закрываем подсказки с задержкой, чтобы дать время на клик
    setTimeout(() => {
      setIsOpen(false);
    }, 300);
    if (onBlur) onBlur();
  };

  const handleFocus = () => {
    // Если есть введённый текст и больше 3 символов — показываем подсказки
    if (inputValue.length >= 3 && suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const showError = isTouched && error;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (!isOpen || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      handleSelectSuggestion(suggestions[activeIndex]);
    }
  };

  return (
    <div className="w-full" ref={wrapperRef}>
      {label && (
        <label htmlFor={inputId} className="block text-sm text-muted-foreground font-medium mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={`
              w-full pl-10 pr-10 py-2.5 border rounded-lg 
              focus:outline-none focus:ring-2 transition
              text-foreground placeholder:text-muted-foreground/50
              bg-muted
              ${showError 
                ? 'border-red-500/50 focus:ring-red-500/20' 
                : 'border-border focus:ring-foreground/20 focus:border-foreground/30'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${className}
            `}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
            aria-label={label || placeholder}
          />

          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 animate-spin" />
          )}
          
          {inputValue && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition p-1"
              aria-label="Очистить адрес"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showError && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        )}

        {suggestionsUnavailable && !showError && (
          <p className="text-xs text-muted-foreground mt-1" role="status">
            Подсказки недоступны — введите адрес вручную.
          </p>
        )}

        {/* Подсказки */}
        {isOpen && suggestions.length > 0 && (
          <div id={listboxId} role="listbox" className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50 transition border-b border-border last:border-0"
              >
                <div className="text-foreground font-medium truncate">
                  {suggestion.value}
                </div>
                <div className="text-xs text-muted-foreground/60 mt-0.5 truncate">
                  {suggestion.data.city && suggestion.data.street 
                    ? `${suggestion.data.city}, ${suggestion.data.street}`
                    : suggestion.data.city || suggestion.data.street || ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
