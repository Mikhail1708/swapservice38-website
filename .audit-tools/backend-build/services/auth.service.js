"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.confirmResetPassword = exports.verifyResetCode = exports.requestPasswordReset = exports.confirmPasswordChange = exports.requestPasswordChange = exports.changePassword = exports.updateProfile = exports.getUserById = exports.login = exports.getVerificationContext = exports.resendVerification = exports.verifyEmail = exports.register = void 0;
// backend/src/services/auth.service.ts
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const email_service_1 = require("./email.service");
const passwordResetSecurity_service_1 = require("./passwordResetSecurity.service");
const common_schema_1 = require("../schemas/common.schema");
const credentialVersion_1 = require("../utils/credentialVersion");
const consent_service_1 = require("./consent.service");
const error_middleware_1 = require("../middleware/error.middleware");
const emailVerificationContext_service_1 = require("./emailVerificationContext.service");
const emailVerificationSecurity_service_1 = require("./emailVerificationSecurity.service");
const prisma_1 = require("../config/prisma");
const DUMMY_PASSWORD_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const findUserByEmailIdentity = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    const exact = await prisma_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
    const matches = await prisma_1.prisma.user.findMany({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        take: 2,
    });
    // Resolve legacy mixed-case identities only when unambiguous. A real exact
    // row is included in this case-insensitive query; the fallback supports
    // isolated Prisma mocks without weakening production behavior.
    if (exact)
        return matches.length > 1 ? null : (matches[0] || exact);
    return matches.length === 1 ? matches[0] : null;
};
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET is not configured');
    return secret;
};
const jwtExpiresIn = () => (process.env.JWT_EXPIRES_IN || '7d');
const notifyPasswordChanged = (email) => {
    void Promise.resolve()
        .then(() => (0, email_service_1.sendPasswordChangedEmail)(email))
        .catch(() => undefined);
};
// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
const register = async (email, password, firstName, lastName, middleName, personalDataConsent) => {
    const consentEvidence = (0, consent_service_1.personalDataEvidence)(personalDataConsent, 'registration');
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma_1.prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existing) {
        throw new Error('Пользователь с таким email уже зарегистрирован');
    }
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    const user = await prisma_1.prisma.user.create({
        data: {
            email: normalizedEmail,
            passwordHash,
            firstName,
            lastName,
            middleName, // ✅ ОТЧЕСТВО
            isVerified: false,
            role: 'user',
            consents: { create: consentEvidence },
        },
    });
    const code = (0, emailVerificationSecurity_service_1.generateEmailVerificationCode)();
    await (0, emailVerificationSecurity_service_1.issueEmailVerificationCode)(user.id, code);
    const verificationToken = await (0, emailVerificationContext_service_1.createVerificationContext)(user.id);
    await (0, email_service_1.sendVerificationEmail)(normalizedEmail, code, firstName, verificationToken);
    return { message: 'Код отправлен на почту', verificationToken };
};
exports.register = register;
// ============================================================
// ПОДТВЕРЖДЕНИЕ EMAIL
// ============================================================
const verifyEmail = async (email, code, token) => {
    const user = token
        ? await prisma_1.prisma.user.findUnique({ where: { id: await (0, emailVerificationContext_service_1.resolveVerificationContext)(token) } })
        : await findUserByEmailIdentity(email || '');
    if (!user) {
        throw new Error('Неверный или просроченный код');
    }
    // A verified address must not be distinguishable from an unknown address by
    // submitting an arbitrary code to this public endpoint.
    if (user.isVerified) {
        if (token)
            return { message: 'Email уже подтверждён', alreadyVerified: true };
        throw new Error('Неверный или просроченный код');
    }
    const verification = await (0, emailVerificationSecurity_service_1.checkEmailVerificationCode)(user.id, code, false);
    if (verification !== 'valid')
        throw new Error('Неверный или просроченный код');
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
    });
    await (0, emailVerificationSecurity_service_1.checkEmailVerificationCode)(user.id, code, true);
    return { message: 'Email подтверждён' };
};
exports.verifyEmail = verifyEmail;
const resendVerification = async (email, token) => {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = token
        ? await prisma_1.prisma.user.findUnique({ where: { id: await (0, emailVerificationContext_service_1.resolveVerificationContext)(token) } })
        : await findUserByEmailIdentity(normalizedEmail);
    if (token && !user)
        throw new error_middleware_1.AppError('Ссылка недействительна или срок её действия истёк.', 400, 'VERIFICATION_LINK_INVALID');
    if (token && user?.isVerified)
        return { message: 'Email уже подтверждён', alreadyVerified: true, retryAfter: 0 };
    const code = (0, emailVerificationSecurity_service_1.generateEmailVerificationCode)();
    const accountId = user && !user.isVerified ? user.id : `non-actionable:${normalizedEmail}`;
    const issue = await (0, emailVerificationSecurity_service_1.issueEmailVerificationCode)(accountId, code);
    if (token && issue === 'cooldown') {
        const { retryAfter } = await (0, emailVerificationSecurity_service_1.emailVerificationTiming)(accountId);
        throw new error_middleware_1.AppError('Новый код можно запросить позже', 429, 'VERIFICATION_COOLDOWN', { retryAfter });
    }
    if (user && !user.isVerified && issue === 'issued') {
        const linkToken = await (0, emailVerificationContext_service_1.createVerificationContext)(user.id);
        await (0, email_service_1.sendVerificationEmail)(user.email, code, user.firstName || undefined, linkToken);
    }
    return { message: 'Если подтверждение требуется, письмо отправлено', retryAfter: 60 };
};
exports.resendVerification = resendVerification;
const getVerificationContext = async (token) => {
    const userId = await (0, emailVerificationContext_service_1.resolveVerificationContext)(token);
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId }, select: { email: true, isVerified: true } });
    if (!user)
        throw new error_middleware_1.AppError('Ссылка недействительна или срок её действия истёк.', 400, 'VERIFICATION_LINK_INVALID');
    return {
        maskedEmail: (0, emailVerificationContext_service_1.maskVerificationEmail)(user.email),
        alreadyVerified: user.isVerified,
        ...await (0, emailVerificationSecurity_service_1.emailVerificationTiming)(userId),
    };
};
exports.getVerificationContext = getVerificationContext;
// ============================================================
// ЛОГИН
// ============================================================
const login = async (email, password) => {
    const user = await findUserByEmailIdentity(email);
    const valid = await bcrypt_1.default.compare(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
    if (!user || !user.passwordHash || !valid || user.blockedAt) {
        throw new Error('Неверный email или пароль');
    }
    if (!user.isVerified) {
        const error = new Error('Email не подтверждён');
        error.code = 'EMAIL_UNVERIFIED';
        error.verificationToken = await (0, emailVerificationContext_service_1.createVerificationContext)(user.id);
        throw error;
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, cv: (0, credentialVersion_1.credentialVersion)(user.passwordHash) }, getJwtSecret(), { expiresIn: jwtExpiresIn() });
    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            middleName: user.middleName, // ✅ ОТЧЕСТВО
            role: user.role,
            phone: user.phone,
            address: user.address,
        },
    };
};
exports.login = login;
// ============================================================
// ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ ПО ID
// ============================================================
const getUserById = async (id) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            middleName: true, // ✅ ОТЧЕСТВО
            phone: true,
            address: true,
            role: true,
            isVerified: true,
            yandexId: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    if (!user) {
        throw new Error('Пользователь не найден');
    }
    return user;
};
exports.getUserById = getUserById;
// ============================================================
// ОБНОВЛЕНИЕ ПРОФИЛЯ
// ============================================================
const updateProfile = async (userId, data) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error('Пользователь не найден');
    }
    const updated = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: {
            firstName: data.firstName,
            lastName: data.lastName,
            middleName: data.middleName, // ✅ ОТЧЕСТВО
            phone: data.phone,
            address: data.address,
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            middleName: true, // ✅ ОТЧЕСТВО
            phone: true,
            address: true,
            role: true,
            isVerified: true,
            yandexId: true,
        },
    });
    return { user: updated, message: 'Профиль обновлён' };
};
exports.updateProfile = updateProfile;
// ============================================================
// СМЕНА ПАРОЛЯ С ТЕКУЩИМ ПАРОЛЕМ
// ============================================================
const changePassword = async (userId, currentPassword, newPassword) => {
    const passwordResult = common_schema_1.passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
        throw new Error(passwordResult.error.issues[0]?.message || 'Пароль не соответствует требованиям');
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error('Пользователь не найден');
    }
    if (!user.passwordHash) {
        throw new Error('У этого аккаунта нет пароля (используйте OAuth)');
    }
    const valid = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
    if (!valid) {
        throw new Error('Неверный текущий пароль');
    }
    const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
    });
    notifyPasswordChanged(user.email);
    return { message: 'Пароль успешно изменён' };
};
exports.changePassword = changePassword;
// ============================================================
// ЗАПРОС НА СМЕНУ ПАРОЛЯ ЧЕРЕЗ ПОЧТУ (для авторизованных)
// ============================================================
const requestPasswordChange = async (userId, email) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error('Пользователь не найден');
    }
    if (user.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
        throw new Error('Email не совпадает с email пользователя');
    }
    if (!user.passwordHash) {
        throw new Error('У этого аккаунта нет пароля (используйте OAuth)');
    }
    const code = (0, passwordResetSecurity_service_1.generatePasswordResetCode)();
    const issueResult = await (0, passwordResetSecurity_service_1.issuePasswordResetCode)(`password-change:${userId}`, code);
    if (issueResult !== 'issued')
        throw new Error('Новый код можно запросить позже');
    await (0, email_service_1.sendPasswordChangeEmail)(email, code);
    return { message: 'Код подтверждения отправлен на почту' };
};
exports.requestPasswordChange = requestPasswordChange;
// ============================================================
// ПОДТВЕРЖДЕНИЕ СМЕНЫ ПАРОЛЯ (для авторизованных)
// ============================================================
const confirmPasswordChange = async (userId, code, newPassword) => {
    const passwordResult = common_schema_1.passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
        throw new Error(passwordResult.error.issues[0]?.message || 'Пароль не соответствует требованиям');
    }
    const codeResult = await (0, passwordResetSecurity_service_1.checkPasswordResetCode)(`password-change:${userId}`, code, true);
    if (codeResult !== 'valid') {
        throw new Error('Неверный или просроченный код');
    }
    const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
    const updatedUser = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
    });
    if (updatedUser?.email)
        notifyPasswordChanged(updatedUser.email);
    return { message: 'Пароль успешно изменён' };
};
exports.confirmPasswordChange = confirmPasswordChange;
// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ (ПУБЛИЧНЫЕ — НЕ ТРЕБУЮТ АВТОРИЗАЦИИ)
// ============================================================
// 1. Запрос кода восстановления
const requestPasswordReset = async (email) => {
    const user = await findUserByEmailIdentity(email);
    const response = { message: 'Если аккаунт существует, код для восстановления отправлен на почту' };
    if (!user?.passwordHash)
        return response;
    const code = (0, passwordResetSecurity_service_1.generatePasswordResetCode)();
    const issueResult = await (0, passwordResetSecurity_service_1.issuePasswordResetCode)(user.id, code);
    if (issueResult === 'issued') {
        await (0, email_service_1.sendPasswordResetEmail)(user.email, code);
    }
    return response;
};
exports.requestPasswordReset = requestPasswordReset;
// 2. Проверка кода восстановления
const verifyResetCode = async (email, code) => {
    const user = await findUserByEmailIdentity(email);
    const result = user?.passwordHash
        ? await (0, passwordResetSecurity_service_1.checkPasswordResetCode)(user.id, code, false)
        : 'expired';
    if (result !== 'valid') {
        throw new Error('Неверный или просроченный код');
    }
    return { message: 'Код подтверждён' };
};
exports.verifyResetCode = verifyResetCode;
// 3. Установка нового пароля
const confirmResetPassword = async (email, code, newPassword) => {
    const passwordResult = common_schema_1.passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
        throw new Error(passwordResult.error.issues[0]?.message || 'Пароль не соответствует требованиям');
    }
    const user = await findUserByEmailIdentity(email);
    if (!user?.passwordHash)
        throw new Error('Неверный или просроченный код');
    const result = await (0, passwordResetSecurity_service_1.checkPasswordResetCode)(user.id, code, true);
    if (result !== 'valid') {
        throw new Error('Неверный или просроченный код');
    }
    const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
    });
    notifyPasswordChanged(user.email);
    return { message: 'Пароль успешно изменён' };
};
exports.confirmResetPassword = confirmResetPassword;
// ============================================================
// ГЕНЕРАЦИЯ JWT ТОКЕНА (используется для OAuth)
// ============================================================
const generateToken = async (userId) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
    });
    if (!user)
        throw new Error('Пользователь не найден');
    return jsonwebtoken_1.default.sign({ id: userId, cv: (0, credentialVersion_1.credentialVersion)(user.passwordHash) }, getJwtSecret(), { expiresIn: jwtExpiresIn() });
};
exports.generateToken = generateToken;
//# sourceMappingURL=auth.service.js.map