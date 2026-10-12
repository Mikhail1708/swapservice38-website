"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeSchema = exports.idSchema = exports.addressSchema = exports.passwordSchema = exports.optionalNameSchema = exports.nameSchema = exports.emailSchema = exports.phoneSchema = void 0;
const zod_1 = require("zod");
exports.phoneSchema = zod_1.z.string()
    .min(10, 'Минимум 10 цифр')
    .max(12, 'Максимум 12 цифр')
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 10
    || (value.length === 11 && (value.startsWith('7') || value.startsWith('8'))), { message: 'Неверный формат номера' });
exports.emailSchema = zod_1.z.string()
    .email('Неверный формат email')
    .min(3, 'Email слишком короткий')
    .max(255, 'Email слишком длинный');
exports.nameSchema = zod_1.z.string()
    .min(2, 'Минимум 2 символа')
    .max(50, 'Максимум 50 символов')
    .regex(/^[a-zA-Zа-яА-ЯёЁ\s-]+$/, 'Только буквы, пробелы и дефисы');
exports.optionalNameSchema = exports.nameSchema.optional().or(zod_1.z.literal(''));
exports.passwordSchema = zod_1.z.string()
    .min(8, 'Минимум 8 символов')
    .regex(/[A-Z]/, 'Добавьте заглавную латинскую букву')
    .regex(/[a-z]/, 'Добавьте строчную латинскую букву')
    .regex(/[0-9]/, 'Добавьте цифру')
    .regex(/^[\x20-\x7E]+$/, 'Используйте только латинские символы, цифры и специальные знаки');
exports.addressSchema = zod_1.z.string()
    .min(5, 'Минимум 5 символов')
    .max(500, 'Максимум 500 символов');
exports.idSchema = zod_1.z.string().min(1, 'ID обязателен');
exports.codeSchema = zod_1.z.string()
    .length(6, 'Код должен содержать 6 цифр')
    .regex(/^\d{6}$/, 'Код должен содержать только цифры');
//# sourceMappingURL=common.schema.js.map