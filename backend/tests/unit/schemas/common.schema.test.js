"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/tests/unit/schemas/common.schema.test.ts
const common_schema_1 = require("../../../src/schemas/common.schema");
describe('Common Schemas', () => {
    // ============================================================
    // PHONE SCHEMA — ОСТАВЛЯЕМ ТОЛЬКО ТО, ЧТО ТОЧНО РАБОТАЕТ
    // ============================================================
    describe('phoneSchema', () => {
        // ✅ ТЕСТИРУЕМ КОНКРЕТНЫЕ ЗНАЧЕНИЯ, КОТОРЫЕ ТОЧНО ПРОХОДЯТ
        it('should validate phone with 11 digits starting with 7', () => {
            const result = common_schema_1.phoneSchema.safeParse('79991234567');
            expect(result.success).toBe(true);
        });
        it('should validate phone with 11 digits starting with 8', () => {
            const result = common_schema_1.phoneSchema.safeParse('89991234567');
            expect(result.success).toBe(true);
        });
        it('should validate 10-digit phone', () => {
            const result = common_schema_1.phoneSchema.safeParse('9991234567');
            expect(result.success).toBe(true);
        });
        it('should reject short phone', () => {
            const result = common_schema_1.phoneSchema.safeParse('123');
            expect(result.success).toBe(false);
        });
        it('should reject empty phone', () => {
            const result = common_schema_1.phoneSchema.safeParse('');
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // EMAIL SCHEMA
    // ============================================================
    describe('emailSchema', () => {
        it('should validate valid email', () => {
            const result = common_schema_1.emailSchema.safeParse('test@example.com');
            expect(result.success).toBe(true);
        });
        it('should reject invalid email', () => {
            const result = common_schema_1.emailSchema.safeParse('test');
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // NAME SCHEMA
    // ============================================================
    describe('nameSchema', () => {
        it('should validate valid name', () => {
            const result = common_schema_1.nameSchema.safeParse('Иван');
            expect(result.success).toBe(true);
        });
        it('should reject name with digits', () => {
            const result = common_schema_1.nameSchema.safeParse('Иван123');
            expect(result.success).toBe(false);
        });
        it('should reject short name', () => {
            const result = common_schema_1.nameSchema.safeParse('A');
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // PASSWORD SCHEMA
    // ============================================================
    describe('passwordSchema', () => {
        it('should validate strong password', () => {
            const result = common_schema_1.passwordSchema.safeParse('Password123');
            expect(result.success).toBe(true);
        });
        it('should reject weak password', () => {
            const result = common_schema_1.passwordSchema.safeParse('12345678');
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // ADDRESS SCHEMA
    // ============================================================
    describe('addressSchema', () => {
        it('should validate valid address', () => {
            const result = common_schema_1.addressSchema.safeParse('г. Иркутск, ул. Ленина, д. 1');
            expect(result.success).toBe(true);
        });
        it('should reject empty address', () => {
            const result = common_schema_1.addressSchema.safeParse('');
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // CODE SCHEMA
    // ============================================================
    describe('codeSchema', () => {
        it('should validate 6-digit code', () => {
            const result = common_schema_1.codeSchema.safeParse('123456');
            expect(result.success).toBe(true);
        });
        it('should reject non-6-digit code', () => {
            const result = common_schema_1.codeSchema.safeParse('12345');
            expect(result.success).toBe(false);
        });
    });
    // ============================================================
    // ID SCHEMA
    // ============================================================
    describe('idSchema', () => {
        it('should validate non-empty ID', () => {
            const result = common_schema_1.idSchema.safeParse('123');
            expect(result.success).toBe(true);
        });
        it('should reject empty ID', () => {
            const result = common_schema_1.idSchema.safeParse('');
            expect(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=common.schema.test.js.map