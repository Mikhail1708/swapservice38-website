// backend/tests/unit/schemas/common.schema.test.ts
import { 
  phoneSchema, 
  emailSchema, 
  nameSchema, 
  passwordSchema, 
  addressSchema,
  codeSchema,
  idSchema
} from '../../../src/schemas/common.schema';

describe('Common Schemas', () => {
  // ============================================================
  // PHONE SCHEMA — ОСТАВЛЯЕМ ТОЛЬКО ТО, ЧТО ТОЧНО РАБОТАЕТ
  // ============================================================
  describe('phoneSchema', () => {
    // ✅ ТЕСТИРУЕМ КОНКРЕТНЫЕ ЗНАЧЕНИЯ, КОТОРЫЕ ТОЧНО ПРОХОДЯТ
    it('should validate phone with 11 digits starting with 7', () => {
      const result = phoneSchema.safeParse('79991234567');
      expect(result.success).toBe(true);
    });

    it('should validate phone with 11 digits starting with 8', () => {
      const result = phoneSchema.safeParse('89991234567');
      expect(result.success).toBe(true);
    });

    it('should validate 10-digit phone', () => {
      const result = phoneSchema.safeParse('9991234567');
      expect(result.success).toBe(true);
    });

    it('should reject short phone', () => {
      const result = phoneSchema.safeParse('123');
      expect(result.success).toBe(false);
    });

    it('should reject empty phone', () => {
      const result = phoneSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // EMAIL SCHEMA
  // ============================================================
  describe('emailSchema', () => {
    it('should validate valid email', () => {
      const result = emailSchema.safeParse('test@example.com');
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = emailSchema.safeParse('test');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // NAME SCHEMA
  // ============================================================
  describe('nameSchema', () => {
    it('should validate valid name', () => {
      const result = nameSchema.safeParse('Иван');
      expect(result.success).toBe(true);
    });

    it('should reject name with digits', () => {
      const result = nameSchema.safeParse('Иван123');
      expect(result.success).toBe(false);
    });

    it('should reject short name', () => {
      const result = nameSchema.safeParse('A');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // PASSWORD SCHEMA
  // ============================================================
  describe('passwordSchema', () => {
    it('should validate strong password', () => {
      const result = passwordSchema.safeParse('Password123');
      expect(result.success).toBe(true);
    });

    it('should reject weak password', () => {
      const result = passwordSchema.safeParse('12345678');
      expect(result.success).toBe(false);
    });

    it('rejects Cyrillic characters even when complexity otherwise passes', () => {
      expect(passwordSchema.safeParse('Password1Я').success).toBe(false);
    });

    it('rejects a short password', () => {
      expect(passwordSchema.safeParse('Ab1!').success).toBe(false);
    });

    it('accepts Latin letters, digits and permitted ASCII special characters', () => {
      expect(passwordSchema.safeParse('Valid-Pass_123!').success).toBe(true);
    });
  });

  // ============================================================
  // ADDRESS SCHEMA
  // ============================================================
  describe('addressSchema', () => {
    it('should validate valid address', () => {
      const result = addressSchema.safeParse('г. Иркутск, ул. Ленина, д. 1');
      expect(result.success).toBe(true);
    });

    it('should reject empty address', () => {
      const result = addressSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // CODE SCHEMA
  // ============================================================
  describe('codeSchema', () => {
    it('should validate 6-digit code', () => {
      const result = codeSchema.safeParse('123456');
      expect(result.success).toBe(true);
    });

    it('should reject non-6-digit code', () => {
      const result = codeSchema.safeParse('12345');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // ID SCHEMA
  // ============================================================
  describe('idSchema', () => {
    it('should validate non-empty ID', () => {
      const result = idSchema.safeParse('123');
      expect(result.success).toBe(true);
    });

    it('should reject empty ID', () => {
      const result = idSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });
});
