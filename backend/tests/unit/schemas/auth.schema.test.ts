// backend/tests/unit/schemas/auth.schema.test.ts
import {
  registerSchema,
  loginSchema,
  verifySchema,
  changePasswordSchema,
  resetPasswordRequestSchema,
  resetPasswordVerifySchema,
  resetPasswordConfirmSchema,
  updateProfileSchema,
} from '../../../src/schemas/auth.schema';

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
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate with optional firstName and lastName', () => {
      const data = {
        email: 'test@example.com',
        password: 'Test1234!',
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = { ...validData, email: 'invalid-email' };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject weak password', () => {
      const data = { ...validData, password: 'weak' };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects Cyrillic characters during registration', () => {
      expect(registerSchema.safeParse({ ...validData, password: 'Valid1Пароль' }).success).toBe(false);
    });

    it('should reject invalid firstName', () => {
      const data = { ...validData, firstName: '123' };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid lastName', () => {
      const data = { ...validData, lastName: '123' };
      const result = registerSchema.safeParse(data);
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
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = { ...validData, email: 'invalid-email' };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const data = { ...validData, password: '' };
      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const data = { email: 'test@example.com' };
      const result = loginSchema.safeParse(data);
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
      const result = verifySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = { ...validData, email: 'invalid' };
      const result = verifySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid code', () => {
      const invalidCodes = ['12345', '1234567', 'abcdef', ''];
      for (const code of invalidCodes) {
        const data = { ...validData, code };
        const result = verifySchema.safeParse(data);
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
      const result = changePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty current password', () => {
      const data = { ...validData, currentPassword: '' };
      const result = changePasswordSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject weak new password', () => {
      const data = { ...validData, newPassword: 'weak' };
      const result = changePasswordSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects Cyrillic characters during password change', () => {
      expect(changePasswordSchema.safeParse({ ...validData, newPassword: 'Valid1Пароль' }).success).toBe(false);
    });
  });

  // ============================================================
  // RESET PASSWORD REQUEST SCHEMA
  // ============================================================
  describe('resetPasswordRequestSchema', () => {
    it('should validate valid email', () => {
      const result = resetPasswordRequestSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = resetPasswordRequestSchema.safeParse({ email: 'invalid' });
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
      const result = resetPasswordVerifySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = { ...validData, email: 'invalid' };
      const result = resetPasswordVerifySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid code', () => {
      const data = { ...validData, code: '12345' };
      const result = resetPasswordVerifySchema.safeParse(data);
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
      const result = resetPasswordConfirmSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = { ...validData, email: 'invalid' };
      const result = resetPasswordConfirmSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid code', () => {
      const data = { ...validData, code: '12345' };
      const result = resetPasswordConfirmSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject weak password', () => {
      const data = { ...validData, newPassword: 'weak' };
      const result = resetPasswordConfirmSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects Cyrillic characters during password reset', () => {
      expect(resetPasswordConfirmSchema.safeParse({ ...validData, newPassword: 'Valid1Пароль' }).success).toBe(false);
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
      const result = updateProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate with partial data', () => {
      const data = { firstName: 'Иван' };
      const result = updateProfileSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate with empty data', () => {
      const result = updateProfileSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid firstName', () => {
      const data = { firstName: '123' };
      const result = updateProfileSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid lastName', () => {
      const data = { lastName: '123' };
      const result = updateProfileSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept any phone', () => {
      // phoneSchema уже валидирует, но здесь мы проверяем что она не блокирует
      const data = { phone: '123' };
      const result = updateProfileSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
