"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/tests/unit/schemas/auth.schema.test.ts
const auth_schema_1 = require("../../../src/schemas/auth.schema");
describe('Auth Schemas', () => {
    // ============================================================
    // REGISTER SCHEMA
    // ============================================================
    describe('registerSchema', () => {
        const validData = {
            email: 'test@example.com',
            password: 'Test1234!',
            firstName: 'Иван',
            lastName: 'Петров',
        };
        it('should validate valid registration data', () => {
            const result = auth_schema_1.registerSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
        it('should validate with optional firstName and lastName', () => {
            const data = {
                email: 'test@example.com',
                password: 'Test1234!',
            };
            const result = auth_schema_1.registerSchema.safeParse(data);
            expect(result.success).toBe(true);
        });
        it('should reject invalid email', () => {
            const data = { ...validData, email: 'invalid-email' };
            const result = auth_schema_1.registerSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject weak password', () => {
            const data = { ...validData, password: 'weak' };
            const result = auth_schema_1.registerSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject invalid firstName', () => {
            const data = { ...validData, firstName: '123' };
            const result = auth_schema_1.registerSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject invalid lastName', () => {
            const data = { ...validData, lastName: '123' };
            const result = auth_schema_1.registerSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // LOGIN SCHEMA
    // ============================================================
    describe('loginSchema', () => {
        const validData = {
            email: 'test@example.com',
            password: 'Test1234!',
        };
        it('should validate valid login data', () => {
            const result = auth_schema_1.loginSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
        it('should reject invalid email', () => {
            const data = { ...validData, email: 'invalid-email' };
            const result = auth_schema_1.loginSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject empty password', () => {
            const data = { ...validData, password: '' };
            const result = auth_schema_1.loginSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject missing password', () => {
            const data = { email: 'test@example.com' };
            const result = auth_schema_1.loginSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // VERIFY SCHEMA
    // ============================================================
    describe('verifySchema', () => {
        const validData = {
            email: 'test@example.com',
            code: '123456',
        };
        it('should validate valid verification data', () => {
            const result = auth_schema_1.verifySchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
        it('should reject invalid email', () => {
            const data = { ...validData, email: 'invalid' };
            const result = auth_schema_1.verifySchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject invalid code', () => {
            const invalidCodes = ['12345', '1234567', 'abcdef', ''];
            for (const code of invalidCodes) {
                const data = { ...validData, code };
                const result = auth_schema_1.verifySchema.safeParse(data);
                expect(result.success).toBe(false);
            }
        });
    });
    // ============================================================
    // CHANGE PASSWORD SCHEMA
    // ============================================================
    describe('changePasswordSchema', () => {
        const validData = {
            currentPassword: 'Old1234!',
            newPassword: 'New1234!',
        };
        it('should validate valid change password data', () => {
            const result = auth_schema_1.changePasswordSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
        it('should reject empty current password', () => {
            const data = { ...validData, currentPassword: '' };
            const result = auth_schema_1.changePasswordSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject weak new password', () => {
            const data = { ...validData, newPassword: 'weak' };
            const result = auth_schema_1.changePasswordSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // RESET PASSWORD REQUEST SCHEMA
    // ============================================================
    describe('resetPasswordRequestSchema', () => {
        it('should validate valid email', () => {
            const result = auth_schema_1.resetPasswordRequestSchema.safeParse({ email: 'test@example.com' });
            expect(result.success).toBe(true);
        });
        it('should reject invalid email', () => {
            const result = auth_schema_1.resetPasswordRequestSchema.safeParse({ email: 'invalid' });
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // RESET PASSWORD VERIFY SCHEMA
    // ============================================================
    describe('resetPasswordVerifySchema', () => {
        const validData = {
            email: 'test@example.com',
            code: '123456',
        };
        it('should validate valid data', () => {
            const result = auth_schema_1.resetPasswordVerifySchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
        it('should reject invalid email', () => {
            const data = { ...validData, email: 'invalid' };
            const result = auth_schema_1.resetPasswordVerifySchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject invalid code', () => {
            const data = { ...validData, code: '12345' };
            const result = auth_schema_1.resetPasswordVerifySchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // RESET PASSWORD CONFIRM SCHEMA
    // ============================================================
    describe('resetPasswordConfirmSchema', () => {
        const validData = {
            email: 'test@example.com',
            code: '123456',
            newPassword: 'New1234!',
        };
        it('should validate valid data', () => {
            const result = auth_schema_1.resetPasswordConfirmSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
        it('should reject invalid email', () => {
            const data = { ...validData, email: 'invalid' };
            const result = auth_schema_1.resetPasswordConfirmSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject invalid code', () => {
            const data = { ...validData, code: '12345' };
            const result = auth_schema_1.resetPasswordConfirmSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject weak password', () => {
            const data = { ...validData, newPassword: 'weak' };
            const result = auth_schema_1.resetPasswordConfirmSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // UPDATE PROFILE SCHEMA
    // ============================================================
    describe('updateProfileSchema', () => {
        const validData = {
            firstName: 'Иван',
            lastName: 'Петров',
            phone: '+79991234567',
            address: 'г. Иркутск, ул. Ленина, д. 1',
        };
        it('should validate valid profile data', () => {
            const result = auth_schema_1.updateProfileSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
        it('should validate with partial data', () => {
            const data = { firstName: 'Иван' };
            const result = auth_schema_1.updateProfileSchema.safeParse(data);
            expect(result.success).toBe(true);
        });
        it('should validate with empty data', () => {
            const result = auth_schema_1.updateProfileSchema.safeParse({});
            expect(result.success).toBe(true);
        });
        it('should reject invalid firstName', () => {
            const data = { firstName: '123' };
            const result = auth_schema_1.updateProfileSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should reject invalid lastName', () => {
            const data = { lastName: '123' };
            const result = auth_schema_1.updateProfileSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
        it('should accept any phone', () => {
            // phoneSchema уже валидирует, но здесь мы проверяем что она не блокирует
            const data = { phone: '123' };
            const result = auth_schema_1.updateProfileSchema.safeParse(data);
            expect(result.success).toBe(true);
        });
    });
});
//# sourceMappingURL=auth.schema.test.js.map