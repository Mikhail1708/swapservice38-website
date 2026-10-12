"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderSchema = exports.createOrderSchema = exports.clientSchema = exports.orderItemSchema = void 0;
// backend/src/schemas/order.schema.ts
const zod_1 = require("zod");
const common_schema_1 = require("./common.schema");
const consent_service_1 = require("../services/consent.service");
const invoice_schema_1 = require("./invoice.schema");
// ============================================================
// ТОВАР В ЗАКАЗЕ
// ============================================================
exports.orderItemSchema = zod_1.z.object({
    productId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => Number(val)),
    quantity: zod_1.z.number().int().min(1, 'Минимум 1 шт.'),
    price: zod_1.z.number().min(0, 'Цена не может быть отрицательной').optional(),
});
// ============================================================
// КЛИЕНТ
// ============================================================
exports.clientSchema = zod_1.z.object({
    firstName: common_schema_1.nameSchema,
    lastName: common_schema_1.nameSchema,
    middleName: common_schema_1.nameSchema.optional().or(zod_1.z.literal('')),
    phone: common_schema_1.phoneSchema,
    email: common_schema_1.emailSchema,
    address: common_schema_1.addressSchema.optional(),
    city: zod_1.z.string().optional(),
});
// ============================================================
// СОЗДАНИЕ ЗАКАЗА
// ============================================================
exports.createOrderSchema = zod_1.z.object({
    paymentMethod: zod_1.z.enum(['online', 'bank_invoice']).default('online'),
    invoiceBuyer: invoice_schema_1.invoiceBuyerSchema.optional(),
    amount: zod_1.z.never().optional(),
    total: zod_1.z.never().optional(),
    paymentStatus: zod_1.z.never().optional(),
    sellerSnapshot: zod_1.z.never().optional(),
    invoiceNumber: zod_1.z.never().optional(),
    paidAt: zod_1.z.never().optional(),
    personalDataConsent: consent_service_1.personalDataAcceptanceSchema.optional(),
    offerAcceptance: consent_service_1.offerAcceptanceSchema,
    client: exports.clientSchema,
    deliveryMethod: zod_1.z.enum(['pickup', 'courier', 'post']).default('courier'),
    deliveryAddress: common_schema_1.addressSchema.optional(),
    deliveryProvider: zod_1.z.string().trim().max(120).optional().nullable(),
    contactMethod: zod_1.z.enum(['phone', 'max', 'telegram', 'email']).default('phone'),
    comment: zod_1.z.string().max(1000, 'Максимум 1000 символов').optional(),
    source: zod_1.z.string().default('website'),
}).superRefine((order, context) => {
    if ((order.paymentMethod === 'bank_invoice') !== Boolean(order.invoiceBuyer)) {
        context.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['invoiceBuyer'], message: 'Реквизиты покупателя обязательны только для оплаты по счёту' });
    }
});
// ============================================================
// ОБНОВЛЕНИЕ ЗАКАЗА (АДМИН)
// ============================================================
exports.updateOrderSchema = zod_1.z.object({
    guestName: common_schema_1.nameSchema.optional(),
    guestPhone: common_schema_1.phoneSchema.optional(),
    guestEmail: common_schema_1.emailSchema.optional(),
    deliveryAddress: common_schema_1.addressSchema.optional(),
    comment: zod_1.z.string().max(1000).optional(),
    deliveryMethod: zod_1.z.enum(['pickup', 'courier', 'post']).optional(),
    deliveryProvider: zod_1.z.string().trim().max(120).optional().nullable(),
    contactMethod: zod_1.z.enum(['phone', 'max', 'telegram', 'email']).optional(),
    items: zod_1.z.array(exports.orderItemSchema).optional(),
    status: zod_1.z.enum(['pending', 'paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled']).optional(),
});
//# sourceMappingURL=order.schema.js.map