"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/tests/unit/services/auth.service.test.ts
const auth_service_1 = require("../../../src/services/auth.service");
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// ✅ МОКИ ДОЛЖНЫ БЫТЬ ПЕРВЫМИ!
jest.mock('@prisma/client', () => {
    const mockPrisma = {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    };
    return {
        PrismaClient: jest.fn(() => mockPrisma),
    };
});
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
// ✅ ПОЛУЧАЕМ МОКИ
const mockPrisma = new client_1.PrismaClient();
// ✅ МОКИ ДЛЯ REDIS И EMAIL (из setup.ts)
describe('Auth Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test_secret';
        process.env.JWT_EXPIRES_IN = '7d';
    });
    // ============================================================
    // REGISTER
    // ============================================================
    describe('register', () => {
        const registerData = {
            email: 'test@example.com',
            password: 'Test1234!',
            firstName: 'Test',
            lastName: 'User'
        };
        it('should register user and send verification email', async () => {
            // ✅ ПРАВИЛЬНЫЙ МОК
            mockPrisma.user.findUnique.mockResolvedValue(null);
            mockPrisma.user.create.mockResolvedValue({
                id: 'user-1',
                email: registerData.email,
                firstName: registerData.firstName,
                lastName: registerData.lastName,
                isVerified: false,
                role: 'user',
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            bcrypt_1.default.hash.mockResolvedValue('hashed_password');
            const result = await (0, auth_service_1.register)(registerData.email, registerData.password, registerData.firstName, registerData.lastName);
            expect(result).toEqual({ message: 'Код отправлен на почту' });
            expect(mockPrisma.user.create).toHaveBeenCalled();
        });
        it('should throw error if user already exists', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                email: registerData.email,
                isVerified: true,
            });
            await expect((0, auth_service_1.register)(registerData.email, registerData.password)).rejects.toThrow('Пользователь с таким email уже зарегистрирован');
            expect(mockPrisma.user.create).not.toHaveBeenCalled();
        });
    });
    // ============================================================
    // VERIFY EMAIL
    // ============================================================
    describe('verifyEmail', () => {
        const email = 'test@example.com';
        const code = '123456';
        it('should verify user email with valid code', async () => {
            const redis = require('../../../src/config/redis').default;
            redis.get.mockResolvedValue(code);
            mockPrisma.user.update.mockResolvedValue({
                id: 'user-1',
                email,
                isVerified: true,
            });
            const result = await (0, auth_service_1.verifyEmail)(email, code);
            expect(result).toEqual({ message: 'Email подтверждён' });
            expect(mockPrisma.user.update).toHaveBeenCalled();
        });
        it('should throw error if code is invalid', async () => {
            const redis = require('../../../src/config/redis').default;
            redis.get.mockResolvedValue('wrong_code');
            await expect((0, auth_service_1.verifyEmail)(email, code)).rejects.toThrow('Неверный или просроченный код');
        });
        it('should throw error if code is expired', async () => {
            const redis = require('../../../src/config/redis').default;
            redis.get.mockResolvedValue(null);
            await expect((0, auth_service_1.verifyEmail)(email, code)).rejects.toThrow('Неверный или просроченный код');
        });
    });
    // ============================================================
    // LOGIN
    // ============================================================
    describe('login', () => {
        const loginData = {
            email: 'test@example.com',
            password: 'Test1234!',
        };
        it('should login user and return JWT token', async () => {
            const mockUser = {
                id: 'user-1',
                email: loginData.email,
                passwordHash: 'hashed_password',
                firstName: 'Test',
                lastName: 'User',
                role: 'user',
                phone: '+79999999999',
                address: 'г. Иркутск',
                isVerified: true,
            };
            mockPrisma.user.findUnique.mockResolvedValue(mockUser);
            bcrypt_1.default.compare.mockResolvedValue(true);
            jsonwebtoken_1.default.sign.mockReturnValue('mock_jwt_token');
            const result = await (0, auth_service_1.login)(loginData.email, loginData.password);
            expect(result).toHaveProperty('token', 'mock_jwt_token');
            expect(result.user).toHaveProperty('id', mockUser.id);
        });
        it('should throw error if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect((0, auth_service_1.login)(loginData.email, loginData.password)).rejects.toThrow('Неверный email или пароль');
        });
        it('should throw error if email not verified', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                email: loginData.email,
                passwordHash: 'hashed_password',
                isVerified: false,
            });
            await expect((0, auth_service_1.login)(loginData.email, loginData.password)).rejects.toThrow('Email не подтверждён');
        });
        it('should throw error if password is incorrect', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                email: loginData.email,
                passwordHash: 'hashed_password',
                isVerified: true,
            });
            bcrypt_1.default.compare.mockResolvedValue(false);
            await expect((0, auth_service_1.login)(loginData.email, loginData.password)).rejects.toThrow('Неверный email или пароль');
        });
    });
    // ============================================================
    // CHANGE PASSWORD
    // ============================================================
    describe('changePassword', () => {
        const userId = 'user-1';
        const currentPassword = 'Old1234!';
        const newPassword = 'New1234!';
        it('should change password with valid current password', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: userId,
                passwordHash: 'old_hashed_password',
            });
            bcrypt_1.default.compare.mockResolvedValue(true);
            bcrypt_1.default.hash.mockResolvedValue('new_hashed_password');
            mockPrisma.user.update.mockResolvedValue({});
            const result = await (0, auth_service_1.changePassword)(userId, currentPassword, newPassword);
            expect(result).toEqual({ message: 'Пароль успешно изменён' });
        });
        it('should throw error if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect((0, auth_service_1.changePassword)(userId, currentPassword, newPassword)).rejects.toThrow('Пользователь не найден');
        });
        it('should throw error if user has no password (OAuth)', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: userId,
                passwordHash: null,
            });
            await expect((0, auth_service_1.changePassword)(userId, currentPassword, newPassword)).rejects.toThrow('У этого аккаунта нет пароля (используйте OAuth)');
        });
        it('should throw error if current password is incorrect', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: userId,
                passwordHash: 'old_hashed_password',
            });
            bcrypt_1.default.compare.mockResolvedValue(false);
            await expect((0, auth_service_1.changePassword)(userId, currentPassword, newPassword)).rejects.toThrow('Неверный текущий пароль');
        });
    });
    // ============================================================
    // REQUEST PASSWORD CHANGE
    // ============================================================
    describe('requestPasswordChange', () => {
        const userId = 'user-1';
        const email = 'test@example.com';
        it('should send password change code to email', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: userId,
                email: email,
                passwordHash: 'hashed_password',
            });
            const result = await (0, auth_service_1.requestPasswordChange)(userId, email);
            expect(result).toEqual({ message: 'Код подтверждения отправлен на почту' });
        });
        it('should throw error if user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            await expect((0, auth_service_1.requestPasswordChange)(userId, email)).rejects.toThrow('Пользователь не найден');
        });
        it('should throw error if email does not match', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: userId,
                email: 'wrong@example.com',
                passwordHash: 'hashed_password',
            });
            await expect((0, auth_service_1.requestPasswordChange)(userId, email)).rejects.toThrow('Email не совпадает с email пользователя');
        });
    });
    // ============================================================
    // CONFIRM PASSWORD CHANGE
    // ============================================================
    describe('confirmPasswordChange', () => {
        const userId = 'user-1';
        const code = '123456';
        const newPassword = 'New1234!';
        it('should confirm password change with valid code', async () => {
            const redis = require('../../../src/config/redis').default;
            redis.get.mockResolvedValue(code);
            bcrypt_1.default.hash.mockResolvedValue('new_hashed_password');
            mockPrisma.user.update.mockResolvedValue({});
            const result = await (0, auth_service_1.confirmPasswordChange)(userId, code, newPassword);
            expect(result).toEqual({ message: 'Пароль успешно изменён' });
        });
        it('should throw error if code is invalid', async () => {
            const redis = require('../../../src/config/redis').default;
            redis.get.mockResolvedValue('wrong_code');
            await expect((0, auth_service_1.confirmPasswordChange)(userId, code, newPassword)).rejects.toThrow('Неверный или просроченный код');
        });
        it('should throw error if code is expired', async () => {
            const redis = require('../../../src/config/redis').default;
            redis.get.mockResolvedValue(null);
            await expect((0, auth_service_1.confirmPasswordChange)(userId, code, newPassword)).rejects.toThrow('Неверный или просроченный код');
        });
        it('should throw error if password is too short', async () => {
            const redis = require('../../../src/config/redis').default;
            redis.get.mockResolvedValue(code);
            await expect((0, auth_service_1.confirmPasswordChange)(userId, code, 'short')).rejects.toThrow('Пароль должен быть минимум 8 символов');
        });
    });
});
//# sourceMappingURL=auth.service.test.js.map