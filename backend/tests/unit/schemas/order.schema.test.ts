// backend/tests/unit/schemas/order.schema.test.ts
import {
  orderItemSchema,
  clientSchema,
  createOrderSchema,
  updateOrderSchema,
} from '../../../src/schemas/order.schema';

describe('Order Schemas', () => {
  // ============================================================
  // ORDER ITEM SCHEMA
  // ============================================================
  describe('orderItemSchema', () => {
    const validItem = {
      productId: 1,
      quantity: 2,
      price: 1000,
    };

    it('should validate valid order item', () => {
      const result = orderItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it('should validate with string productId', () => {
      const data = { ...validItem, productId: '123' };
      const result = orderItemSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.productId).toBe(123);
      }
    });

    it('should reject missing productId', () => {
      const data = { quantity: 2, price: 1000 };
      const result = orderItemSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid quantity (0)', () => {
      const data = { ...validItem, quantity: 0 };
      const result = orderItemSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid quantity (negative)', () => {
      const data = { ...validItem, quantity: -1 };
      const result = orderItemSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject negative price', () => {
      const data = { ...validItem, price: -100 };
      const result = orderItemSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // CLIENT SCHEMA
  // ============================================================
  describe('clientSchema', () => {
    const validClient = {
      firstName: 'Иван',
      lastName: 'Петров',
      phone: '+79991234567',
      email: 'test@example.com',
      address: 'г. Иркутск, ул. Ленина, д. 1',
      city: 'Иркутск',
    };

    it('should validate valid client data', () => {
      const result = clientSchema.safeParse(validClient);
      expect(result.success).toBe(true);
    });

    it('should validate without optional fields', () => {
      const data = {
        firstName: 'Иван',
        lastName: 'Петров',
        phone: '+79991234567',
        email: 'test@example.com',
      };
      const result = clientSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject missing firstName', () => {
      const data = { lastName: 'Петров', phone: '+79991234567', email: 'test@example.com' };
      const result = clientSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing phone', () => {
      const data = { firstName: 'Иван', lastName: 'Петров', email: 'test@example.com' };
      const result = clientSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid phone', () => {
      const data = { ...validClient, phone: '123' };
      const result = clientSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const data = { ...validClient, email: 'invalid' };
      const result = clientSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid firstName', () => {
      const data = { ...validClient, firstName: '123' };
      const result = clientSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // CREATE ORDER SCHEMA
  // ============================================================
  describe('createOrderSchema', () => {
    const validOrder = {
      client: {
        firstName: 'Иван',
        lastName: 'Петров',
        phone: '+79991234567',
        email: 'test@example.com',
        address: 'г. Иркутск, ул. Ленина, д. 1',
      },
      items: [
        { productId: 1, quantity: 2, price: 1000 },
        { productId: 2, quantity: 1, price: 500 },
      ],
      deliveryMethod: 'courier',
      deliveryAddress: 'г. Иркутск, ул. Ленина, д. 1',
      comment: 'Test comment',
      source: 'website',
    };

    it('should validate valid order', () => {
      const result = createOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it('should validate without optional fields', () => {
      const data = {
        client: {
          firstName: 'Иван',
          lastName: 'Петров',
          phone: '+79991234567',
          email: 'test@example.com',
        },
        items: [{ productId: 1, quantity: 2, price: 1000 }],
        deliveryMethod: 'courier',
      };
      const result = createOrderSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should use default deliveryMethod', () => {
      const data = {
        client: {
          firstName: 'Иван',
          lastName: 'Петров',
          phone: '+79991234567',
          email: 'test@example.com',
        },
        items: [{ productId: 1, quantity: 2, price: 1000 }],
      };
      const result = createOrderSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deliveryMethod).toBe('courier');
      }
    });

    it('should ignore client-supplied items because the server cart is authoritative', () => {
      const data = { ...validOrder, items: [] };
      const result = createOrderSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('items');
      }
    });

    it('should reject missing client', () => {
      const data = { items: [{ productId: 1, quantity: 2, price: 1000 }] };
      const result = createOrderSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid deliveryMethod', () => {
      const data = { ...validOrder, deliveryMethod: 'invalid' };
      const result = createOrderSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // UPDATE ORDER SCHEMA
  // ============================================================
  describe('updateOrderSchema', () => {
    const validUpdate = {
      guestName: 'Иван Петров',
      guestPhone: '+79991234567',
      guestEmail: 'test@example.com',
      deliveryAddress: 'г. Иркутск, ул. Ленина, д. 1',
      comment: 'Updated comment',
      deliveryMethod: 'pickup',
      items: [{ productId: 1, quantity: 3, price: 1000 }],
      status: 'confirmed',
    };

    it('should validate valid update', () => {
      const result = updateOrderSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate partial update', () => {
      const data = { guestName: 'Иван Петров' };
      const result = updateOrderSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate empty update', () => {
      const result = updateOrderSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid phone', () => {
      const data = { guestPhone: '123' };
      const result = updateOrderSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const data = { guestEmail: 'invalid' };
      const result = updateOrderSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const data = { status: 'invalid' };
      const result = updateOrderSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept valid statuses', () => {
      const validStatuses = ['pending', 'paid', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled'];
      for (const status of validStatuses) {
        const data = { status };
        const result = updateOrderSchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });
  });
});
