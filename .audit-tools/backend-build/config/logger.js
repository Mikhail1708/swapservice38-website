"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.logger = void 0;
// backend/src/config/logger.ts
const pino_1 = __importDefault(require("pino"));
const isDevelopment = process.env.NODE_ENV === 'development';
// ✅ РАСШИРЯЕМ ТИП ERROR ДЛЯ AXIOS
// Создаём логгер
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    base: {
        environment: process.env.NODE_ENV || 'development',
        service: 'swapservice38-backend',
    },
});
// Хелперы для удобства
exports.log = {
    info: (message, data) => {
        if (data) {
            exports.logger.info(data, message);
        }
        else {
            exports.logger.info(message);
        }
    },
    error: (message, error) => {
        if (error instanceof Error) {
            exports.logger.error({
                message,
                error: error.message,
                stack: error.stack,
            });
        }
        else if (error) {
            exports.logger.error({ message, data: error });
        }
        else {
            exports.logger.error(message);
        }
    },
    warn: (message, data) => {
        if (data) {
            exports.logger.warn(data, message);
        }
        else {
            exports.logger.warn(message);
        }
    },
    debug: (message, data) => {
        if (data) {
            exports.logger.debug(data, message);
        }
        else {
            exports.logger.debug(message);
        }
    },
    child: (bindings) => {
        return exports.logger.child(bindings);
    },
};
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map