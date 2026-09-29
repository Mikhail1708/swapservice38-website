import { z } from 'zod';

const documentText = (min: number, max: number) =>
  z.string().trim().min(min).max(max)
    .refine(
      value => !/[\u0000-\u001f\u007f]/.test(value),
      'Недопустимые управляющие символы'
    );

/**
 * Проверка контрольной суммы ИНН.
 *
 * ЮЛ — 10 цифр:
 * проверяется 10-я контрольная цифра.
 *
 * ИП — 12 цифр:
 * проверяются 11-я и 12-я контрольные цифры.
 */
const isValidInn = (value: string): boolean => {
  if (!/^\d{10}$|^\d{12}$/.test(value)) {
    return false;
  }

  const digits = value.split('').map(Number);

  const checksum = (weights: number[]): number =>
    weights.reduce(
      (sum, weight, index) => sum + weight * digits[index],
      0
    ) % 11 % 10;

  // ИНН юридического лица
  if (digits.length === 10) {
    return checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9];
  }

  // ИНН ИП / физического лица
  const firstChecksum =
    checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);

  const secondChecksum =
    checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);

  return (
    firstChecksum === digits[10] &&
    secondChecksum === digits[11]
  );
};

export const invoiceBuyerSchema = z.object({
  buyerType: z.enum(['legal_entity', 'individual_entrepreneur']),

  legalName: documentText(2, 500),

  inn: z.string()
    .trim()
    .regex(/^\d+$/, 'ИНН должен содержать только цифры'),

  kpp: z.string()
    .trim()
    .regex(/^\d{9}$/, 'КПП должен содержать строго 9 цифр')
    .optional(),

  legalAddress: documentText(5, 1000),

  contactName: documentText(2, 200),

  phone: z.string()
    .trim()
    .min(10)
    .max(32)
    .regex(/^\+?[\d ()-]+$/, 'Неверный формат телефона')
    .transform(value => value.replace(/[ ()-]/g, ''))
    .refine(
      value => /^\+?[1-9]\d{9,14}$/.test(value),
      'Неверный формат телефона'
    ),

  email: z.string()
    .trim()
    .max(254)
    .email('Неверный email'),

}).strict().superRefine((buyer, context) => {
  const expectedLength =
    buyer.buyerType === 'legal_entity' ? 10 : 12;

  if (buyer.inn.length !== expectedLength) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['inn'],
      message: `ИНН должен содержать ${expectedLength} цифр`,
    });
  } else if (!isValidInn(buyer.inn)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['inn'],
      message: 'Некорректный ИНН. Проверьте введённые данные.',
    });
  }

  if (
    buyer.buyerType === 'individual_entrepreneur' &&
    buyer.kpp !== undefined
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['kpp'],
      message: 'У ИП нет КПП',
    });
  }
});

/** Complete client input: amount, seller and state are server-owned. */
export const requestInvoiceSchema = z.object({
  buyer: invoiceBuyerSchema,
}).strict();

export type InvoiceBuyer = z.infer<typeof invoiceBuyerSchema>;
export type RequestInvoiceInput = z.infer<typeof requestInvoiceSchema>;