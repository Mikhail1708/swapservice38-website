// backend/src/schemas/order.schema.ts
import { z } from 'zod';
import { phoneSchema, emailSchema, nameSchema, addressSchema } from './common.schema';
import { personalDataAcceptanceSchema, offerAcceptanceSchema } from '../services/consent.service';
import { invoiceBuyerSchema } from './invoice.schema';

// ============================================================
// ТОВАР В ЗАКАЗЕ
// ============================================================
export const orderItemSchema = z.object({
  productId: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  quantity: z.number().int().min(1, 'Минимум 1 шт.'),
  price: z.number().min(0, 'Цена не может быть отрицательной').optional(),
});

// ============================================================
// КЛИЕНТ
// ============================================================
export const clientSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  middleName: nameSchema.optional().or(z.literal('')),
  phone: phoneSchema,
  email: emailSchema,
  address: addressSchema.optional(),
  city: z.string().optional(),
});

// ============================================================
// СОЗДАНИЕ ЗАКАЗА
// ============================================================
export const createOrderSchema = z.object({
  paymentMethod: z.enum(['online', 'bank_invoice']).default('online'),
  invoiceBuyer: invoiceBuyerSchema.optional(),
  amount: z.never().optional(),
  total: z.never().optional(),
  paymentStatus: z.never().optional(),
  sellerSnapshot: z.never().optional(),
  invoiceNumber: z.never().optional(),
  paidAt: z.never().optional(),
  personalDataConsent: personalDataAcceptanceSchema.optional(),
  offerAcceptance: offerAcceptanceSchema,
  client: clientSchema,
  deliveryMethod: z.enum(['pickup', 'courier', 'post']).default('courier'),
  deliveryAddress: addressSchema.optional(),
  deliveryProvider: z.string().trim().max(120).optional().nullable(),
  contactMethod: z.enum(['phone', 'whatsapp', 'telegram', 'email']).default('phone'),
  comment: z.string().max(1000, 'Максимум 1000 символов').optional(),
  source: z.string().default('website'),
}).superRefine((order, context) => {
  if ((order.paymentMethod === 'bank_invoice') !== Boolean(order.invoiceBuyer)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['invoiceBuyer'], message: 'Реквизиты покупателя обязательны только для оплаты по счёту' });
  }
});

// ============================================================
// ОБНОВЛЕНИЕ ЗАКАЗА (АДМИН)
// ============================================================
export const updateOrderSchema = z.object({
  guestName: nameSchema.optional(),
  guestPhone: phoneSchema.optional(),
  guestEmail: emailSchema.optional(),
  deliveryAddress: addressSchema.optional(),
  comment: z.string().max(1000).optional(),
  deliveryMethod: z.enum(['pickup', 'courier', 'post']).optional(),
  deliveryProvider: z.string().trim().max(120).optional().nullable(),
  contactMethod: z.enum(['phone', 'whatsapp', 'telegram', 'email']).optional(),
  items: z.array(orderItemSchema).optional(),
  status: z.enum(['pending', 'paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled']).optional(),
});
