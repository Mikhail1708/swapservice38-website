import {
  orderConfirmationCustomerTemplate,
  orderCreatedCustomerTemplate,
  orderNotificationManagerTemplate,
  orderStatusCustomerTemplate,
  passwordChangeEmailTemplate,
  passwordChangedEmailTemplate,
  passwordResetEmailTemplate,
  verificationEmailTemplate,
} from '../../../src/services/emailTemplates';

describe('SWAPSERVICE38 email templates', () => {
  it('created and paid mail use the payment-based dispatch deadline, not a delivery date', () => {
    const data = {
      orderId: 'order-deadline', documentNumber: 'SS38-1', customerName: 'Иван',
      customerEmail: 'customer@example.test', customerPhone: '', total: 100,
      items: [{ name: 'Комплект', quantity: 1, price: 100, total: 100 }],
      deliveryAddress: '', comment: '',
    };
    const created = orderCreatedCustomerTemplate(data);
    const paid = orderConfirmationCustomerTemplate(data, '');
    for (const mail of [created, paid]) for (const output of [mail.html, mail.text]) {
      expect(output).toContain('после подтверждения полной оплаты');
      expect(output).toContain('не позднее 3 рабочих дней');
      expect(output).toContain('не срок перевозки');
      expect(output).toContain('О готовности к самовывозу мы уведомим');
      expect(output).not.toContain('получите заказ через 3');
    }
    expect(created.text).toContain('Оплата ещё не подтверждена');
    expect(paid.text).not.toContain('Оплата ещё не подтверждена');
  });
  it('order-created confirmation includes contract data, safe seller contacts and no internal payload', () => {
    const data = {
      orderId: 'public-order-123', customerName: '<Получатель>', total: 3000,
      createdAt: '2026-09-07T17:30:00.000Z', offerVersion: '2026-09-08',
      items: [{ name: '<Дроп-кит>', quantity: 2, price: 1000, total: 2000 }, { name: 'Защита', quantity: 1, price: 1000, total: 1000 }],
      deliveryMethod: 'post', deliveryProvider: 'Перевозчик', deliveryAddress: 'Адрес <получения>',
      passwordHash: 'PRIVATE_PASSWORD_SENTINEL', token: 'PRIVATE_TOKEN_SENTINEL', sessionId: 'PRIVATE_SESSION_SENTINEL', crmOrderId: 'PRIVATE_CRM_SENTINEL', technicalPayload: 'PRIVATE_PAYLOAD_SENTINEL',
    };
    const result = orderCreatedCustomerTemplate(data);
    for (const output of [result.html, result.text]) {
      expect(output).toContain('public-order-123');
      expect(output).toContain('8 сентября 2026');
      expect(output).toContain('UTC+8');
      expect(output).toContain('Защита');
      expect(output).toContain('Перевозчик');
      expect(output).toContain('381011379046');
      expect(output).toContain('315385000059546');
      expect(output).toContain('swap38@mail.ru');
      expect(output).toContain('https://example.test/offer');
      expect(output).toContain('2026-09-08');
      expect(output).toContain('не является кассовым чеком');
      expect(output).not.toMatch(/PRIVATE_|passwordHash|sessionId|crmOrderId|technicalPayload/);
    }
    expect(result.html).toContain('&lt;Дроп-кит&gt;');
    expect(result.html).not.toContain('<Получатель>');
    expect(result.html).toContain('Цена за шт.');
    expect(result.html).toContain('tel:+79245330880');
    expect(result.text).toMatch(/2 шт\. × 1\s000 ₽ = 2\s000 ₽/);
    expect(result.text).toMatch(/Итого товары: 3\s000 ₽/);
  });
  beforeAll(() => {
    process.env.PUBLIC_APP_URL = 'https://example.test';
  });

  afterAll(() => {
    delete process.env.PUBLIC_APP_URL;
  });

  it('renders branded verification email with a safe verification URL', () => {
    const template = verificationEmailTemplate('482196');

    expect(template.html).toContain('482196');
    expect(template.html).toContain('https://example.test/verify-email');
    expect(template.html).not.toMatch(/href="[^"]*482196/);
    expect(template.html).toContain('src="cid:swapservice38-logo"');
    expect(template.html).toContain('alt="SWAPSERVICE38"');
    expect(template.html).toContain('#0c0c0d');
    expect(template.html).not.toContain('YOUR-DOMAIN.RU');
    expect(template.html).not.toContain('localhost');
    expect(template.text).toContain('482196');
  });

  it('escapes every user-controlled order field', () => {
    const template = orderConfirmationCustomerTemplate({
      orderId: 'order-1',
      documentNumber: '42<script>',
      customerName: '<img src=x onerror=alert(1)>',
      customerEmail: 'customer@example.test',
      customerPhone: '+7 900 000-00-00',
      total: 1200,
      items: [{ name: '<b>Engine</b>', quantity: 1, price: 1200, total: 1200 }],
      deliveryAddress: '<script>alert(1)</script>',
      comment: '" onclick="alert(1)',
    }, '+7 900 000 00 00');

    expect(template.html).not.toContain('<script>');
    expect(template.html).not.toContain('<img src=x');
    expect(template.html).not.toContain('<b>Engine</b>');
    expect(template.html).toContain('&lt;script&gt;');
    expect(template.html).toContain('&lt;b&gt;Engine&lt;/b&gt;');
    expect(template.html).toContain('&quot; onclick=&quot;alert(1)');
  });

  it('follows the 720px reference hierarchy and renders every product row', () => {
    const template = orderConfirmationCustomerTemplate({
      orderId: 'order-3',
      documentNumber: 'SS38-204',
      customerName: 'Иван',
      customerEmail: 'customer@example.test',
      customerPhone: '+7 900 000-00-00',
      total: 7500,
      items: [
        { name: 'Первый комплект', quantity: 1, price: 5000, total: 5000 },
        { name: 'Второй комплект', quantity: 2, price: 1250, total: 2500 },
      ],
      deliveryAddress: '',
      comment: '',
    }, '+7 900 000 00 00');

    expect(template.html).toContain('width="720"');
    expect(template.html).toContain('Номер заказа');
    expect(template.html).toContain('Товары в заказе');
    expect(template.html).toContain('Первый комплект');
    expect(template.html).toContain('Второй комплект');
    expect(template.html).toContain('>1</td>');
    expect(template.html).toContain('>2</td>');
    expect(template.html).toContain('Данные клиента');
    expect(template.html).toContain('Статус заказа');
    expect(template.html).toContain('Перейти к заказу');
    expect(template.html).toContain('src="cid:swapservice38-logo"');
    expect(template.html).not.toContain('filter:');
  });

  it('rejects non-HTTP public origins', () => {
    process.env.PUBLIC_APP_URL = 'javascript:alert(1)';
    expect(() => verificationEmailTemplate('123456')).toThrow('must use HTTP(S)');
    process.env.PUBLIC_APP_URL = 'https://example.test';
  });

  it('uses the shared dark layout for password reset and order/status emails', () => {
    const reset = passwordResetEmailTemplate('123456');
    const passwordChange = passwordChangeEmailTemplate('654321');
    const changed = passwordChangedEmailTemplate();
    const created = orderCreatedCustomerTemplate({ orderId: 'abcdefgh-1234', customerName: 'Иван', total: 5000 });
    const status = orderStatusCustomerTemplate({ documentNumber: '100', customerName: 'Иван' }, 'Отправлен');
    const cancelled = orderStatusCustomerTemplate({ documentNumber: '101', customerName: 'Иван' }, 'Отменён');
    const manager = orderNotificationManagerTemplate({
      orderId: 'order-2',
      documentNumber: '102',
      customerName: 'Иван',
      customerEmail: 'customer@example.test',
      customerPhone: '+7 900 000-00-00',
      total: 5000,
      items: [{ name: 'Комплект', quantity: 1, price: 5000, total: 5000 }],
      deliveryAddress: '',
      comment: '',
    }, '+7 900 000 00 00');

    for (const template of [reset, passwordChange, changed, created, status, cancelled, manager]) {
      expect(template.html).toContain('src="cid:swapservice38-logo"');
      expect(template.html).toContain('background:#111113');
      expect(template.html).toContain('Производство и установка тюнинг-комплектов');
      expect(template.text.length).toBeGreaterThan(20);
    }
    expect(reset.html).toContain('https://example.test/reset-password');
    expect(changed.text).not.toContain('Код:');
    expect(changed.html).not.toMatch(/token=/i);
    expect(status.html).toContain('Отправлен');
    expect(cancelled.html).toContain('Заказ отменён');
    expect(cancelled.html).not.toContain('Заказ находится в работе');
  });
});
