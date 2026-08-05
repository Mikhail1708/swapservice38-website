// backend/src/config/logger.ts
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

// ✅ РАСШИРЯЕМ ТИП ERROR ДЛЯ AXIOS
interface AxiosError extends Error {
  response?: {
    data?: any;
    status?: number;
  };
}

// Создаём логгер
export const logger = pino({
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
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    environment: process.env.NODE_ENV || 'development',
    service: 'swapservice38-backend',
  },
});

// Хелперы для удобства
export const log = {
  info: (message: string, data?: any) => {
    if (data) {
      logger.info(data, message);
    } else {
      logger.info(message);
    }
  },

  error: (message: string, error?: any) => {
    if (error instanceof Error) {
      const axiosError = error as AxiosError;
      logger.error({
        message,
        error: error.message,
        stack: error.stack,
        ...(axiosError.response?.data && { responseData: axiosError.response.data }),
        ...(axiosError.response?.status && { responseStatus: axiosError.response.status }),
      });
    } else if (error) {
      logger.error({ message, data: error });
    } else {
      logger.error(message);
    }
  },

  warn: (message: string, data?: any) => {
    if (data) {
      logger.warn(data, message);
    } else {
      logger.warn(message);
    }
  },

  debug: (message: string, data?: any) => {
    if (data) {
      logger.debug(data, message);
    } else {
      logger.debug(message);
    }
  },

  child: (bindings: Record<string, any>) => {
    return logger.child(bindings);
  },
};

export default logger;