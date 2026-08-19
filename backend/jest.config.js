// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.ts'],
  modulePathIgnorePatterns: [
    '<rootDir>/tests/.*\\.(?:js|d\\.ts)(?:\\.map)?$',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // ✅ ИСПОЛЬЗУЕМ АЛИАСЫ
  moduleNameMapper: {
    // ✅ АЛИАСЫ ДЛЯ ПУТЕЙ
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@schemas/(.*)$': '<rootDir>/src/schemas/$1',
    '^@queues/(.*)$': '<rootDir>/src/queues/$1',
    '^@prisma/client$': '<rootDir>/tests/__mocks__/@prisma/client.ts',
  },
  moduleDirectories: ['node_modules', '<rootDir>/src', '<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
  maxWorkers: 1,
  globalTeardown: '<rootDir>/tests/helpers/teardown.ts',
};
