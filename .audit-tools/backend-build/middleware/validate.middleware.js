"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const logger_1 = require("../config/logger");
const validate = (schema) => {
    return async (req, res, next) => {
        try {
            // Валидируем body
            const validated = await schema.parseAsync(req.body);
            req.body = validated;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const errors = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));
                logger_1.log.warn('⚠️ Валидация не пройдена', { errors, path: req.path });
                res.status(400).json({
                    error: 'Ошибка валидации данных',
                    code: 'VALIDATION_ERROR',
                    details: errors,
                });
            }
            else {
                next(error);
            }
        }
    };
};
exports.validate = validate;
//# sourceMappingURL=validate.middleware.js.map