// backend/tests/helpers/setup.ts

// ✅ МОК ДЛЯ REDIS С ИСПОЛЬЗОВАНИЕМ АЛИАСА
jest.mock('@config/redis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(600),
    flushall: jest.fn().mockResolvedValue('OK'),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn().mockReturnThis(),
    quit: jest.fn().mockResolvedValue('OK'),
    duplicate: jest.fn().mockReturnThis(),
    disconnect: jest.fn().mockResolvedValue(undefined),
    defineCommand: jest.fn(),
    sendCommand: jest.fn().mockResolvedValue('OK'),
    pipeline: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    multi: jest.fn().mockReturnThis(),
    call: jest.fn().mockResolvedValue('OK'),
    status: 'ready',
    connecting: false,
    connected: true,
    options: {},
    nodes: [],
    slots: [],
  };
  
  return {
    __esModule: true,
    default: mockRedis,
    redis: mockRedis,
    safeRedis: {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(600),
      flushall: jest.fn().mockResolvedValue(undefined),
      setJson: jest.fn().mockResolvedValue(undefined),
      getJson: jest.fn().mockResolvedValue(null),
    },
  };
});

// ✅ МОК ДЛЯ BULL QUEUE
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    process: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    getFailed: jest.fn().mockResolvedValue([]),
    retry: jest.fn().mockResolvedValue({}),
    empty: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue([]),
    getJob: jest.fn().mockResolvedValue(null),
    getJobs: jest.fn().mockResolvedValue([]),
    getJobLogs: jest.fn().mockResolvedValue({ logs: [], count: 0 }),
    getWorkers: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }));
});

// ✅ МОК ДЛЯ NODEMAILER
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    verify: jest.fn().mockImplementation((callback) => {
      if (callback) {
        callback(null, true);
      }
      return Promise.resolve(true);
    }),
    close: jest.fn(),
  }),
}));

// ✅ МОК ДЛЯ EMAIL SERVICE
jest.mock('@services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendPasswordChangeEmail: jest.fn().mockResolvedValue(true),
  sendOrderConfirmationToCustomer: jest.fn().mockResolvedValue(true),
  sendOrderNotificationToManager: jest.fn().mockResolvedValue(true),
  sendEmail: jest.fn().mockResolvedValue(true),
}));

// ✅ МОК ДЛЯ CRM QUEUE
jest.mock('@queues/crm.queue', () => ({
  addOrderToCRMQueue: jest.fn().mockResolvedValue({ id: 'job-123' }),
  addUpdateToCRMQueue: jest.fn().mockResolvedValue({ id: 'job-456' }),
  retryFailedOrders: jest.fn().mockResolvedValue({ retried: 0 }),
  getCRMQueueStats: jest.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  }),
  default: {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    process: jest.fn(),
    on: jest.fn(),
  },
}));

// ✅ МОК ДЛЯ AXIOS
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  put: jest.fn().mockResolvedValue({ data: {} }),
  patch: jest.fn().mockResolvedValue({ data: {} }),
  delete: jest.fn().mockResolvedValue({ data: {} }),
  isAxiosError: jest.fn().mockReturnValue(false),
  create: jest.fn().mockReturnThis(),
  defaults: {
    timeout: 5000,
    headers: {
      common: {},
    },
  },
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
}));

// ✅ ГЛОБАЛЬНЫЙ МОК ДЛЯ FETCH
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    status: 200,
    headers: new Headers(),
    clone: jest.fn().mockReturnThis(),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    blob: jest.fn().mockResolvedValue(new Blob()),
    formData: jest.fn().mockResolvedValue(new FormData()),
  })
) as jest.Mock;

// ✅ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ДЛЯ ТЕСТОВ
process.env.JWT_SECRET = 'test_secret_123';
process.env.JWT_EXPIRES_IN = '7d';
process.env.CRM_API_URL = 'http://localhost:5000';
process.env.CLIENT_URL = 'http://localhost:3001';
process.env.YOO_KASSA_SHOP_ID = 'test-shop';
process.env.YOO_KASSA_SECRET_KEY = 'test-secret';
process.env.INTERNAL_API_KEY = 'test-internal-key';
process.env.WEBHOOK_SECRET = 'test-webhook-secret';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'test-pass';
process.env.EMAIL_FROM = 'test@test.com';
process.env.MANAGER_EMAIL = 'manager@test.com';

// ✅ ПОДАВЛЯЕМ КОНСОЛЬНЫЕ ВЫВОДЫ (ОПЦИОНАЛЬНО)
// jest.spyOn(console, 'log').mockImplementation(() => {});
// jest.spyOn(console, 'error').mockImplementation(() => {});
// jest.spyOn(console, 'warn').mockImplementation(() => {});
// jest.spyOn(console, 'info').mockImplementation(() => {});
// jest.spyOn(console, 'debug').mockImplementation(() => {});

// ✅ ОСТАНАВЛИВАЕМ CSRF INTERVAL
afterAll(() => {
  try {
    const { stopCleanupInterval } = require('../../src/middleware/csrf.middleware');
    if (stopCleanupInterval) {
      stopCleanupInterval();
    }
  } catch (e) {
    // ignore
  }
});