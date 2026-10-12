"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.ConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.AppError = void 0;
const logger_1 = require("../config/logger");
// Типы ошибок
class AppError extends Error {
    constructor(message, statusCode = 500, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(message = 'Ресурс не найден') {
        super(message, 404, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends AppError {
    constructor(message = 'Не авторизован') {
        super(message, 401, 'UNAUTHORIZED');
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Доступ запрещён') {
        super(message, 403, 'FORBIDDEN');
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends AppError {
    constructor(message = 'Конфликт данных') {
        super(message, 409, 'CONFLICT');
    }
}
exports.ConflictError = ConflictError;
// Глобальный обработчик ошибок
const errorHandler = (err, req, res, next) => {
    // Логируем ошибку с контекстом
    logger_1.log.error('Ошибка обработки запроса', {
        errorName: err?.name || 'Error',
        errorCode: err?.code,
        path: req.path,
        method: req.method,
    });
    // Если это наша кастомная ошибка
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            details: err.details,
        });
    }
    // CSRF ошибка
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            success: false,
            error: 'Неверный CSRF токен',
            code: 'CSRF_TOKEN_INVALID',
        });
    }
    // Ошибка Prisma: запись не найдена
    if (err.code === 'P2025') {
        return res.status(404).json({
            success: false,
            error: 'Запись не найдена',
            code: 'NOT_FOUND',
        });
    }
    // Ошибка Prisma: уникальность
    if (err.code === 'P2002') {
        return res.status(409).json({
            success: false,
            error: 'Запись с такими данными уже существует',
            code: 'CONFLICT',
        });
    }
    // Ошибка Prisma: внешний ключ
    if (err.code === 'P2003') {
        return res.status(400).json({
            success: false,
            error: 'Нарушение целостности данных',
            code: 'FOREIGN_KEY_VIOLATION',
        });
    }
    // Ошибка валидации (Zod)
    if (err.name === 'ZodError') {
        return res.status(400).json({
            success: false,
            error: 'Ошибка валидации данных',
            code: 'VALIDATION_ERROR',
            details: err.errors,
        });
    }
    // Ошибка JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Неверный токен',
            code: 'INVALID_TOKEN',
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Токен истёк',
            code: 'TOKEN_EXPIRED',
        });
    }
    // Ошибка по умолчанию (не показываем детали в production)
    const exposeDiagnostics = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    const errorMessage = exposeDiagnostics
        ? err.message || 'Внутренняя ошибка сервера'
        : 'Внутренняя ошибка сервера';
    res.status(err.status || 500).json({
        success: false,
        error: errorMessage,
        code: err.code || 'INTERNAL_SERVER_ERROR',
        ...(exposeDiagnostics ? { stack: err.stack } : {}),
    });
};
exports.errorHandler = errorHandler;
// Middleware для обработки 404
const notFoundHandler = (req, res, next) => {
    next(new NotFoundError(`Маршрут ${req.method} ${req.path} не найден`));
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=error.middleware.js.map