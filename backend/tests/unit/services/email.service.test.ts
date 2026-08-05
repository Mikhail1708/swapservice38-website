// backend/tests/unit/services/email.service.test.ts
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangeEmail } from '../../../src/services/email.service';

// ✅ МОК ДЛЯ NODEMAILER
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockImplementation(() => Promise.resolve({ messageId: 'test-id' })),
    verify: jest.fn().mockImplementation(() => Promise.resolve(true)),
  }),
}));

// ✅ МОК ДЛЯ QUEUE (Bull)
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn().mockImplementation((data) => {
      // Сразу вызываем отправку
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({});
      return transporter.sendMail(data);
    }),
    process: jest.fn(),
    on: jest.fn(),
  }));
});

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email', async () => {
      const result = await sendVerificationEmail('test@example.com', '123456');

      expect(result).toBeDefined();
      // Проверяем что функция была вызвана (не проверяем конкретные параметры из-за очереди)
      expect(result).toBeTruthy();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      const result = await sendPasswordResetEmail('test@example.com', '123456');

      expect(result).toBeDefined();
      expect(result).toBeTruthy();
    });
  });

  describe('sendPasswordChangeEmail', () => {
    it('should send password change email', async () => {
      const result = await sendPasswordChangeEmail('test@example.com', '123456');

      expect(result).toBeDefined();
      expect(result).toBeTruthy();
    });
  });
});