// backend/src/schemas/order.schema.ts
import { z } from 'zod';
import { phoneSchema, emailSchema, nameSchema, addressSchema } from './common.schema';

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
  phone: phoneSchema,
  email: emailSchema,
  address: addressSchema.optional(),
  city: z.string().optional(),
});

// ============================================================
// СОЗДАНИЕ ЗАКАЗА
// ============================================================
export const createOrderSchema = z.object({
  client: clientSchema,
  items: z.array(orderItemSchema).min(1, 'Корзина пуста'),
  deliveryMethod: z.enum(['pickup', 'courier', 'post']).default('courier'),
  deliveryAddress: addressSchema.optional(),
  comment: z.string().max(1000, 'Максимум 1000 символов').optional(),
  source: z.string().default('website'),
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
  items: z.array(orderItemSchema).optional(),
  status: z.enum(['pending', 'paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled']).optional(),
});