"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmResetPasswordController = exports.verifyResetCodeController = exports.requestPasswordResetController = exports.confirmPasswordChangeController = exports.requestPasswordChangeController = exports.changePasswordController = exports.updateProfileController = exports.meController = exports.logoutController = exports.verificationContextController = exports.resendVerificationController = exports.verifyController = exports.registerController = exports.loginController = exports.mergeCart = exports.consentStatusController = exports.consentDocumentsController = void 0;
const auth_service_1 = require("../services/auth.service");
const error_middleware_1 = require("../middleware/error.middleware");
const consent_service_1 = require("../services/consent.service");
const logger_1 = require("../config/logger");
const prisma_1 = require("../config/prisma");
const consentDocumentsController = (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ documents: consent_service_1.CONSENT_DOCUMENTS });
};
exports.consentDocumentsController = consentDocumentsController;
const consentStatusController = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ error: 'Необходимо авторизоваться' });
    try {
        const consent = await (0, consent_service_1.findPersonalDataConsent)(prisma_1.prisma, userId);
        res.json({ documents: consent_service_1.CONSENT_DOCUMENTS, requiresPersonalDataConsent: !consent });
    }
    catch {
        res.status(503).json({ code: 'CONSENT_UNAVAILABLE', error: 'Не удалось проверить согласия. Попробуйте позже' });
    }
};
exports.consentStatusController = consentStatusController;
const AUTH_BUSINESS_ERRORS = [
    'Неверный или просроченный код',
    'Пользователь не найден',
    'Неверный текущий пароль',
    'Email не совпадает с email пользователя',
    'У этого аккаунта нет пароля (используйте OAuth)',
    'Новый код можно запросить позже',
];
const sendAuthError = (res, error, fallback) => {
    if (error instanceof error_middleware_1.AppError) {
        if (error.statusCode === 429 && error.details?.retryAfter)
            res.setHeader('Retry-After', String(error.details.retryAfter));
        return res.status(error.statusCode).json({ code: error.code, error: error.message, details: error.details });
    }
    const message = error instanceof Error ? error.message : '';
    const isPasswordValidation = /парол|латин|заглавн|строчн|цифр|символ/i.test(message);
    if (AUTH_BUSINESS_ERRORS.includes(message) || isPasswordValidation) {
        return res.status(400).json({ code: 'AUTH_VALIDATION_ERROR', error: message });
    }
    logger_1.log.error('Authentication operation failed', { errorName: error instanceof Error ? error.name : 'unknown' });
    return res.status(503).json({ code: 'AUTH_UNAVAILABLE', error: fallback });
};
// ============================================================
// ПЕРЕНОС КОРЗИНЫ ПРИ АВТОРИЗАЦИИ
// ============================================================
const mergeCart = async (userId, guestId) => {
    if (!guestId)
        return true;
    try {
        const guestCart = await prisma_1.prisma.cart.findUnique({
            where: { guestId: guestId },
        });
        if (!guestCart || !guestCart.items || guestCart.items.length === 0) {
            return true;
        }
        const guestItems = guestCart.items;
        let userCart = await prisma_1.prisma.cart.findUnique({
            where: { userId: userId },
        });
        if (userCart) {
            const userItems = userCart.items;
            const mergedItems = [...userItems];
            for (const guestItem of guestItems) {
                const existingIndex = mergedItems.findIndex((item) => String(item.productId) === String(guestItem.productId));
                if (existingIndex !== -1) {
                    mergedItems[existingIndex].quantity += guestItem.quantity;
                }
                else {
                    mergedItems.push(guestItem);
                }
            }
            await prisma_1.prisma.cart.update({
                where: { userId: userId },
                data: { items: mergedItems },
            });
        }
        else {
            await prisma_1.prisma.cart.create({
                data: {
                    userId: userId,
                    items: guestItems,
                },
            });
        }
        await prisma_1.prisma.cart.delete({
            where: { guestId: guestId },
        });
        return true;
    }
    catch (error) {
        logger_1.log.error('Cart merge failed', { userId, error: error instanceof Error ? error.message : 'unknown' });
        return false;
    }
};
exports.mergeCart = mergeCart;
// ============================================================
// ЛОГИН — ПЕРЕНОС КОРЗИНЫ
// ============================================================
const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;
        const { token, user } = await (0, auth_service_1.login)(email, password);
        const guestId = req.cookies?.guestId;
        if (guestId) {
            const cartMerged = await (0, exports.mergeCart)(user.id, guestId);
            if (cartMerged) {
                res.clearCookie('guestId', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                });
            }
        }
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });
        res.json({ user });
    }
    catch (error) {
        if (error.code === 'EMAIL_UNVERIFIED') {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(403).json({ code: 'EMAIL_UNVERIFIED', error: 'Email не подтверждён', verificationToken: error.verificationToken });
        }
        res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Неверный email или пароль' });
    }
};
exports.loginController = loginController;
// ============================================================
// РЕГИСТРАЦИЯ
// ============================================================
const registerController = async (req, res) => {
    try {
        const { email, password, firstName, lastName, middleName } = req.body; // ✅ middleName
        const result = await (0, auth_service_1.register)(email, password, firstName, lastName, middleName, req.body.personalDataConsent);
        res.setHeader('Cache-Control', 'no-store');
        res.status(201).json(result);
    }
    catch (error) {
        if (error?.message === 'Пользователь с таким email уже зарегистрирован') {
            return res.status(409).json({ code: 'EMAIL_ALREADY_REGISTERED', error: error.message });
        }
        if (error instanceof error_middleware_1.AppError)
            return sendAuthError(res, error, 'Не удалось зарегистрироваться');
        logger_1.log.error('Registration failed', { errorName: error instanceof Error ? error.name : 'unknown' });
        res.status(503).json({ code: 'REGISTRATION_UNAVAILABLE', error: 'Регистрация временно недоступна. Попробуйте позже' });
    }
};
exports.registerController = registerController;
// ============================================================
// ПОДТВЕРЖДЕНИЕ EMAIL
// ============================================================
const verifyController = async (req, res) => {
    try {
        const { email, code, token } = req.body;
        if ((!email && !token) || (email && token))
            return res.status(400).json({ error: 'Укажите ссылку подтверждения или email' });
        const result = await (0, auth_service_1.verifyEmail)(email, code, token);
        res.json(result);
    }
    catch (error) {
        sendAuthError(res, error, 'Не удалось подтвердить email. Попробуйте позже');
    }
};
exports.verifyController = verifyController;
// ============================================================
// ПОВТОРНАЯ ОТПРАВКА КОДА
// ============================================================
const resendVerificationController = async (req, res) => {
    try {
        const { email, token } = req.body;
        if ((!email && !token) || (email && token))
            return res.status(400).json({ error: 'Укажите ссылку подтверждения или email' });
        const result = await (0, auth_service_1.resendVerification)(email, token);
        res.json(result);
    }
    catch (error) {
        sendAuthError(res, error, 'Не удалось отправить письмо. Попробуйте позже');
    }
};
exports.resendVerificationController = resendVerificationController;
const verificationContextController = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        res.json(await (0, auth_service_1.getVerificationContext)(req.body.token));
    }
    catch (error) {
        sendAuthError(res, error, 'Не удалось проверить ссылку. Попробуйте позже');
    }
};
exports.verificationContextController = verificationContextController;
// ============================================================
// ВЫХОД
// ============================================================
const logoutController = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
    res.json({ message: 'Выход выполнен' });
};
exports.logoutController = logoutController;
// ============================================================
// ПОЛУЧЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
// ============================================================
const meController = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        const user = await (0, auth_service_1.getUserById)(userId);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                middleName: user.middleName, // ✅ ОТЧЕСТВО
                phone: user.phone,
                address: user.address,
                role: user.role,
                isVerified: user.isVerified,
                yandexId: user.yandexId,
            }
        });
    }
    catch (error) {
        logger_1.log.error('Current user lookup failed', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(500).json({ code: 'AUTH_UNAVAILABLE', error: 'Не удалось проверить сессию' });
    }
};
exports.meController = meController;
// ============================================================
// ОБНОВЛЕНИЕ ПРОФИЛЯ
// ============================================================
const updateProfileController = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        const { firstName, lastName, middleName, phone, address } = req.body; // ✅ middleName
        const result = await (0, auth_service_1.updateProfile)(userId, {
            firstName,
            lastName,
            middleName, // ✅ ОТЧЕСТВО
            phone,
            address
        });
        res.json(result);
    }
    catch (error) {
        sendAuthError(res, error, 'Не удалось сохранить изменения. Попробуйте позже');
    }
};
exports.updateProfileController = updateProfileController;
// ============================================================
// СМЕНА ПАРОЛЯ
// ============================================================
const changePasswordController = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        const { currentPassword, newPassword } = req.body;
        const result = await (0, auth_service_1.changePassword)(userId, currentPassword, newPassword);
        const token = await (0, auth_service_1.generateToken)(userId);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });
        res.json(result);
    }
    catch (error) {
        sendAuthError(res, error, 'Не удалось изменить пароль. Попробуйте позже');
    }
};
exports.changePasswordController = changePasswordController;
const requestPasswordChangeController = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        const { email } = req.body;
        const result = await (0, auth_service_1.requestPasswordChange)(userId, email);
        res.json(result);
    }
    catch (error) {
        sendAuthError(res, error, 'Не удалось отправить код. Попробуйте позже');
    }
};
exports.requestPasswordChangeController = requestPasswordChangeController;
const confirmPasswordChangeController = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Не авторизован' });
        }
        const { code, newPassword } = req.body;
        const result = await (0, auth_service_1.confirmPasswordChange)(userId, code, newPassword);
        const token = await (0, auth_service_1.generateToken)(userId);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });
        res.json(result);
    }
    catch (error) {
        sendAuthError(res, error, 'Не удалось изменить пароль. Попробуйте позже');
    }
};
exports.confirmPasswordChangeController = confirmPasswordChangeController;
// ============================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// ============================================================
const requestPasswordResetController = async (req, res) => {
    const genericResponse = { message: 'Если аккаунт существует, код для восстановления отправлен на почту' };
    try {
        const { email } = req.body;
        await (0, auth_service_1.requestPasswordReset)(email);
        res.json(genericResponse);
    }
    catch (error) {
        // Do not expose account existence or provider failures through this public endpoint.
        logger_1.log.error('Password reset request failed', { error: error.message });
        res.json(genericResponse);
    }
};
exports.requestPasswordResetController = requestPasswordResetController;
const verifyResetCodeController = async (req, res) => {
    try {
        const { email, code } = req.body;
        const result = await (0, auth_service_1.verifyResetCode)(email, code);
        res.json(result);
    }
    catch (error) {
        sendAuthError(res, error, 'Не удалось проверить код. Попробуйте позже');
    }
};
exports.verifyResetCodeController = verifyResetCodeController;
const confirmResetPasswordController = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const result = await (0, auth_service_1.confirmResetPassword)(email, code, newPassword);
        res.json(result);
    }
    catch (error) {
        sendAuthError(res, error, 'Не удалось изменить пароль. Попробуйте позже');
    }
};
exports.confirmResetPasswordController = confirmResetPasswordController;
//# sourceMappingURL=auth.controller.js.map