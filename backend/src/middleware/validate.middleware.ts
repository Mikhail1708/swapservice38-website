// backend/src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { log } from '../config/logger';

export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Валидируем body
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        log.warn('⚠️ Валидация не пройдена', { errors, path: req.path });
        
        res.status(400).json({
          error: 'Ошибка валидации данных',
          code: 'VALIDATION_ERROR',
          details: errors,
        });
      } else {
        next(error);
      }
    }
  };
};
