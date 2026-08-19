import { buildCrmOrderPayload } from '../../../src/services/crmOrderPayload.service';

describe('CRM order payload', () => {
  it('passes the complete customer, delivery and contact snapshot to CRM', () => {
    const payload = buildCrmOrderPayload({
      id: 'site-order-1',
      items: [{ productId: '149', quantity: 2, price: 1250 }],
      customerFirstName: 'Иван',
      customerLastName: 'Петров',
      customerMiddleName: 'Сергеевич',
      customerPhone: '8 (914) 123-45-67',
      customerEmail: 'ivan@example.com',
      contactMethod: 'telegram',
      deliveryMethod: 'post',
      deliveryAddress: 'Иркутск, ул. Ленина, 1',
      deliveryProvider: 'СДЭК',
      comment: 'Позвонить перед отправкой',
    });

    expect(payload).toEqual(expect.objectContaining({
      externalOrderId: 'site-order-1',
      deliveryMethod: 'post',
      deliveryAddress: 'Иркутск, ул. Ленина, 1',
      deliveryProvider: 'СДЭК',
      contactMethod: 'telegram',
      comment: 'Позвонить перед отправкой',
      client: expect.objectContaining({
        firstName: 'Иван',
        lastName: 'Петров',
        middleName: 'Сергеевич',
        name: 'Петров Иван Сергеевич',
        fullName: 'Петров Иван Сергеевич',
        phone: '79141234567',
        email: 'ivan@example.com',
        address: 'Иркутск, ул. Ленина, 1',
        preferredContact: 'telegram',
      }),
      items: [{ productId: 149, quantity: 2, price: 1250 }],
    }));
  });

  it('does not send an order without a customer phone', () => {
    expect(() => buildCrmOrderPayload({ id: 'site-order-2', items: [] }))
      .toThrow('У заказа отсутствует телефон покупателя');
  });
});
