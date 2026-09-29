'use client';

import { Building2, Mail, MapPin, User } from 'lucide-react';
import { AddressInput } from '@/components/AddressInput';
import { PhoneInput } from '@/components/PhoneInput';
import type { InvoiceBuyer } from '@/lib/invoice/types';
import { validatePhone } from '@/lib/validation/phone';

export const emptyInvoiceBuyer = (
  defaults: Partial<InvoiceBuyer> = {}
): InvoiceBuyer => ({
  buyerType: 'legal_entity',
  legalName: '',
  inn: '',
  kpp: '',
  legalAddress: '',
  contactName: '',
  phone: '',
  email: '',
  ...defaults,
});

/**
 * Проверяет контрольную сумму ИНН.
 *
 * ЮЛ:
 * - 10 цифр;
 * - 10-я цифра является контрольной.
 *
 * ИП:
 * - 12 цифр;
 * - 11-я и 12-я цифры являются контрольными.
 */
const isValidInn = (value: string): boolean => {
  if (!/^(?:\d{10}|\d{12})$/.test(value)) {
    return false;
  }

  const digits = value.split('').map(Number);

  const checksum = (weights: number[]): number =>
    weights.reduce(
      (sum, weight, index) => sum + weight * digits[index],
      0
    ) %
    11 %
    10;

  // ИНН юридического лица — 10 цифр
  if (digits.length === 10) {
    return (
      checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9]
    );
  }

  // ИНН ИП / физического лица — 12 цифр
  const firstChecksum = checksum([
    7, 2, 4, 10, 3, 5, 9, 4, 6, 8,
  ]);

  const secondChecksum = checksum([
    3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8,
  ]);

  return (
    firstChecksum === digits[10] &&
    secondChecksum === digits[11]
  );
};

export function validateInvoiceBuyer(
  buyer: InvoiceBuyer
): Record<string, string> {
  const errors: Record<string, string> = {};

  const inn = buyer.inn.trim();
  const innLength =
    buyer.buyerType === 'legal_entity' ? 10 : 12;

  if (buyer.legalName.trim().length < 2) {
    errors.legalName =
      'Укажите название организации или ФИО ИП';
  }

  if (!/^\d+$/.test(inn)) {
    errors.inn = 'ИНН должен содержать только цифры';
  } else if (inn.length !== innLength) {
    errors.inn = `ИНН должен содержать ${innLength} цифр`;
  } else if (!isValidInn(inn)) {
    errors.inn =
      'Некорректный ИНН. Проверьте введённые данные.';
  }

  if (
    buyer.buyerType === 'legal_entity' &&
    buyer.kpp?.trim() &&
    !/^\d{9}$/.test(buyer.kpp.trim())
  ) {
    errors.kpp =
      'КПП должен содержать строго 9 цифр';
  }

  if (buyer.legalAddress.trim().length < 5) {
    errors.legalAddress =
      'Укажите юридический адрес';
  }

  if (buyer.contactName.trim().length < 2) {
    errors.contactName =
      'Укажите контактное лицо';
  }

  const phoneValidation = validatePhone(buyer.phone);

  if (!phoneValidation.valid) {
    errors.phone =
      phoneValidation.error ||
      'Укажите корректный телефон';
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      buyer.email.trim()
    )
  ) {
    errors.email =
      'Укажите корректный email';
  }

  return errors;
}

export function InvoiceBuyerForm({
  value,
  onChange,
  errors = {},
  disabled = false,
}: {
  value: InvoiceBuyer;
  onChange: (value: InvoiceBuyer) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}) {
  const set = (
    key: keyof InvoiceBuyer,
    next: string
  ) =>
    onChange({
      ...value,
      [key]: next,
    });

  const setDigits = (
    key: 'inn',
    next: string,
    maxLength: number
  ) =>
    set(
      key,
      next.replace(/\D/g, '').slice(0, maxLength)
    );

  const field = (
    key: keyof InvoiceBuyer,
    label: string,
    icon: React.ReactNode,
    placeholder: string,
    optional = false
  ) => (
    <div>
      <label className="block text-sm text-muted-foreground font-medium mb-1.5">
        {icon}
        {label}
        {!optional && (
          <span className="text-red-400"> *</span>
        )}
      </label>

      <input
        disabled={disabled}
        value={(value[key] as string) || ''}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition disabled:opacity-60 ${
          errors[key]
            ? 'border-red-500/50 focus:ring-red-500/20'
            : 'border-border focus:border-foreground/30 focus:ring-foreground/10'
        }`}
      />

      {errors[key] && (
        <p className="text-xs text-red-500 mt-1">
          {errors[key]}
        </p>
      )}
    </div>
  );

  const innLength =
    value.buyerType === 'legal_entity' ? 10 : 12;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-muted-foreground font-medium mb-1.5">
          <Building2 className="w-4 h-4 inline mr-1" />
          Тип покупателя
        </label>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['legal_entity', 'Юридическое лицо'],
              ['individual_entrepreneur', 'ИП'],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...value,
                  buyerType: type,
                  inn: '',
                  kpp:
                    type === 'individual_entrepreneur'
                      ? ''
                      : value.kpp,
                })
              }
              className={`px-3 py-2.5 rounded-lg border text-sm font-medium ${
                value.buyerType === type
                  ? 'border-foreground bg-foreground/5 text-foreground'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {field(
        'legalName',
        value.buyerType === 'legal_entity'
          ? 'Название организации'
          : 'ФИО ИП',
        <Building2 className="w-4 h-4 inline mr-1" />,
        value.buyerType === 'legal_entity'
          ? 'ООО «Компания»'
          : 'Иванов Иван Иванович'
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground font-medium mb-1.5">
            <Building2 className="w-4 h-4 inline mr-1" />
            ИНН
            <span className="text-red-400"> *</span>
          </label>

          <input
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
            value={value.inn}
            onChange={e =>
              setDigits(
                'inn',
                e.target.value,
                innLength
              )
            }
            placeholder={`${innLength} цифр`}
            maxLength={innLength}
            className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition disabled:opacity-60 ${
              errors.inn
                ? 'border-red-500/50 focus:ring-red-500/20'
                : 'border-border focus:border-foreground/30 focus:ring-foreground/10'
            }`}
          />

          {errors.inn && (
            <p className="text-xs text-red-500 mt-1">
              {errors.inn}
            </p>
          )}
        </div>

        {value.buyerType === 'legal_entity' && (
          <div>
            <label className="block text-sm text-muted-foreground font-medium mb-1.5">
              <Building2 className="w-4 h-4 inline mr-1" />
              КПП
            </label>

            <input
              disabled={disabled}
              inputMode="numeric"
              autoComplete="off"
              value={value.kpp || ''}
              onChange={e =>
                set(
                  'kpp',
                  e.target.value
                    .replace(/\D/g, '')
                    .slice(0, 9)
                )
              }
              placeholder="9 цифр"
              maxLength={9}
              className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition disabled:opacity-60 ${
                errors.kpp
                  ? 'border-red-500/50 focus:ring-red-500/20'
                  : 'border-border focus:border-foreground/30 focus:ring-foreground/10'
              }`}
            />

            {errors.kpp && (
              <p className="text-xs text-red-500 mt-1">
                {errors.kpp}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-muted-foreground font-medium mb-1.5">
          <MapPin className="w-4 h-4 inline mr-1" />
          Юридический адрес
          <span className="text-red-400"> *</span>
        </label>

        <AddressInput
          value={value.legalAddress}
          onChange={next =>
            set('legalAddress', next)
          }
          disabled={disabled}
          required
          error={errors.legalAddress}
          touched={Boolean(errors.legalAddress)}
          placeholder="Начните вводить адрес и выберите из списка"
        />
      </div>

      {field(
        'contactName',
        'Контактное лицо',
        <User className="w-4 h-4 inline mr-1" />,
        'Имя и фамилия'
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <PhoneInput
          label="Телефон"
          value={value.phone}
          onChange={next => set('phone', next)}
          disabled={disabled}
          required
          error={errors.phone}
          className="w-full"
        />

        {field(
          'email',
          'Email',
          <Mail className="w-4 h-4 inline mr-1" />,
          'mail@example.ru'
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Сумма счёта и реквизиты продавца формируются
        сервером. Счёт выставляется без НДС.
      </p>
    </div>
  );
}