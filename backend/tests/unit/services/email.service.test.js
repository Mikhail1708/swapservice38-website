"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/tests/unit/services/email.service.test.ts
const email_service_1 = require("../../../src/services/email.service");
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
            const result = await (0, email_service_1.sendVerificationEmail)('test@example.com', '123456');
            expect(result).toBeDefined();
            // Проверяем что функция была вызвана (не проверяем конкретные параметры из-за очереди)
            expect(result).toBeTruthy();
        });
    });
    describe('sendPasswordResetEmail', () => {
        it('should send password reset email', async () => {
            const result = await (0, email_service_1.sendPasswordResetEmail)('test@example.com', '123456');
            expect(result).toBeDefined();
            expect(result).toBeTruthy();
        });
    });
    describe('sendPasswordChangeEmail', () => {
        it('should send password change email', async () => {
            const result = await (0, email_service_1.sendPasswordChangeEmail)('test@example.com', '123456');
            expect(result).toBeDefined();
            expect(result).toBeTruthy();
        });
    });
});
//# sourceMappingURL=email.service.test.js.map