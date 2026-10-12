"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfileSchema = exports.resetPasswordConfirmSchema = exports.resetPasswordVerifySchema = exports.resetPasswordRequestSchema = exports.changePasswordSchema = exports.resendVerificationSchema = exports.verificationContextSchema = exports.verifySchema = exports.loginSchema = exports.registerSchema = void 0;
// backend/src/schemas/auth.schema.ts
const zod_1 = require("zod");
const common_schema_1 = require("./common.schema");
const consent_service_1 = require("../services/consent.service");
// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
exports.registerSchema = zod_1.z.object({
    personalDataConsent: consent_service_1.personalDataAcceptanceSchema,
    email: common_schema_1.emailSchema,
    password: common_schema_1.passwordSchema,
    firstName: common_schema_1.optionalNameSchema,
    lastName: common_schema_1.optionalNameSchema,
    middleName: common_schema_1.optionalNameSchema,
});
// ============================================================
// ЛОГИН
// ============================================================
exports.loginSchema = zod_1.z.object({
    email: common_schema_1.emailSchema,
    password: zod_1.z.string().min(1, 'Введите пароль'),
});
// ============================================================
// ПОДТВЕРЖДЕНИЕ EMAIL
// ============================================================
exports.verifySchema = zod_1.z.object({
    email: common_schema_1.emailSchema.optional(),
    token: zod_1.z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
    code: common_schema_1.codeSchema,
}).refine((data) => Boolean(data.email) !== Boolean(data.token), { message: 'Укажите ссылку подтверждения или email' });
exports.verificationContextSchema = zod_1.z.object({ token: zod_1.z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
exports.resendVerificationSchema = zod_1.z.object({
    email: common_schema_1.emailSchema.optional(),
    token: zod_1.z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
}).refine((data) => Boolean(data.email) !== Boolean(data.token), { message: 'Укажите ссылку подтверждения или email' });
// ============================================================
// СМЕНА ПАРОЛЯ (АВТОРИЗОВАННЫЙ)
// ============================================================
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Введите текущий пароль'),
    newPassword: common_schema_1.passwordSchema,
});
// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// ============================================================
exports.resetPasswordRequestSchema = zod_1.z.object({
    email: common_schema_1.emailSchema,
});
exports.resetPasswordVerifySchema = zod_1.z.object({
    email: common_schema_1.emailSchema,
    code: common_schema_1.codeSchema,
});
exports.resetPasswordConfirmSchema = zod_1.z.object({
    email: common_schema_1.emailSchema,
    code: common_schema_1.codeSchema,
    newPassword: common_schema_1.passwordSchema,
});
// ============================================================
// ОБНОВЛЕНИЕ ПРОФИЛЯ
// ============================================================
exports.updateProfileSchema = zod_1.z.object({
    firstName: common_schema_1.optionalNameSchema,
    lastName: common_schema_1.optionalNameSchema,
    middleName: common_schema_1.optionalNameSchema,
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
});
//# sourceMappingURL=auth.schema.js.map