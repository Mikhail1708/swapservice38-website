const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const documents = { personalDataVersion: '2026-09-07', privacyVersion: '2026-09-07', offerVersion: '2026-09-07' };

function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}

const buyer = { buyerType: 'legal_entity', legalName: 'ООО Покупатель', inn: '7707083893', kpp: '770701001', legalAddress: 'Иркутск, ул. Ленина, 1', contactName: 'Иван Иванов', phone: '79991234567', email: 'buyer@example.test' };
function visible(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  if (Array.isArray(tree)) return tree.map(visible).join(' ');
  return visible(tree.props?.children);
}

test('checkout bank_invoice sends one atomic order request and never starts YooKassa', async () => {
  const app = page('src/app/(public)/cart/page.tsx');
  nodes(app.render(), 'button').find(n => visible(n).includes('Получить счёт для ЮЛ')).props.onClick();
  nodes(app.render(), 'invoice-buyer-form')[0].props.onChange(buyer);
  app.accept('offer');
  await app.submit();
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].url, '/api/orders');
  assert.equal(app.requests[0].body.paymentMethod, 'bank_invoice');
  assert.deepEqual(app.requests[0].body.invoiceBuyer, buyer);
  assert.deepEqual(app.redirects, ['/profile/orders/details?id=order-1']);
  for (const forbidden of ['amount', 'sellerSnapshot', 'paymentStatus', 'paidAt', 'invoiceNumber', 'total']) assert.equal(forbidden in app.requests[0].body, false);
});

test('invalid KPP blocks checkout submit; legal INN10/IP INN12 and optional KPP9 are validated', async () => {
  const app = page('src/app/(public)/cart/page.tsx');
  const validate = app.load('src/components/invoice/InvoiceBuyerForm.tsx').validateInvoiceBuyer;
  assert.deepEqual(validate(buyer), {});
  assert.ok(validate({ ...buyer, inn: '123456789012' }).inn);
  assert.deepEqual(validate({ ...buyer, kpp: '' }), {});
  assert.deepEqual(validate({ ...buyer, buyerType: 'individual_entrepreneur', inn: '500100732259', kpp: undefined }), {});
  assert.ok(validate({ ...buyer, buyerType: 'individual_entrepreneur' }).inn);
  for (const kpp of ['123', '1234567890', 'abcdefghi']) assert.ok(validate({ ...buyer, kpp }).kpp);
  nodes(app.render(), 'button').find(n => visible(n).includes('Получить счёт для ЮЛ')).props.onClick();
  nodes(app.render(), 'invoice-buyer-form')[0].props.onChange({ ...buyer, kpp: '123' });
  app.accept('offer');
  await app.submit();
  assert.equal(app.requests.length, 0);
});

test('INN validation is format-only and rejects wrong length or non-digits before POST', () => {
  const validate = page('src/app/(public)/cart/page.tsx').load('src/components/invoice/InvoiceBuyerForm.tsx').validateInvoiceBuyer;
  assert.deepEqual(validate({ ...buyer, inn: '1234567890' }), {});
  assert.ok(validate({ ...buyer, inn: '123456789' }).inn);
  assert.ok(validate({ ...buyer, inn: '12345678901' }).inn);
  assert.ok(validate({ ...buyer, inn: '123456789a' }).inn);
  assert.deepEqual(validate({ ...buyer, buyerType: 'individual_entrepreneur', inn: '123456789012', kpp: undefined }), {});
  for (const inn of ['1234567890', '12345678901', '1234567890123', '12345678901a']) {
    assert.ok(validate({ ...buyer, buyerType: 'individual_entrepreneur', inn, kpp: undefined }).inn);
  }
});

test('HTTP 400 stops checkout without an automatic retry and re-enables submit', async () => {
  const app = page('src/app/(public)/cart/page.tsx', { orderResponse: { ok: false, status: 400, body: { error: 'Неверный ИНН' } } });
  app.accept('offer');
  await app.submit();
  assert.equal(app.requests.length, 1);
  const submit = nodes(app.render(), 'button').find(n => n.props.type === 'submit');
  assert.equal(submit.props.disabled, false);
  assert.match(visible(app.render()), /Неверный ИНН/);
});

test('double click while checkout is in flight sends one order request', async () => {
  const app = page('src/app/(public)/cart/page.tsx');
  app.accept('offer');
  await Promise.all([app.submit(), app.submit()]);
  assert.equal(app.requests.length, 1);
});

test('buyer form uses existing PhoneInput and AddressInput and clears/hides KPP for IP', () => {
  const app = page('src/app/(public)/cart/page.tsx');
  const Form = app.load('src/components/invoice/InvoiceBuyerForm.tsx').InvoiceBuyerForm;
  let changed;
  const tree = Form({ value: buyer, onChange: value => { changed = value; } });
  assert.equal(nodes(tree, 'phone-input').length, 1);
  assert.equal(nodes(tree, 'address-input').length, 1);
  nodes(tree, 'button').find(n => visible(n) === 'ИП').props.onClick();
  assert.equal(changed.kpp, '');
  assert.doesNotMatch(visible(Form({ value: changed, onChange() {} })), /КПП/);
});

test('online checkout retains its existing payment redirect', async () => {
  const app = page('src/app/(public)/cart/page.tsx');
  app.accept('offer'); await app.submit();
  assert.equal(app.requests.length, 1);
  assert.equal('invoiceBuyer' in app.requests[0].body, false);
  assert.deepEqual(app.redirects, ['/payment/order-1']);
});

for (const state of ['preparing', 'issued', 'paid', 'online', 'missing']) {
  test(`order page uses server projection: ${state}`, async () => {
    const bank = !['online', 'missing'].includes(state);
    const order = { id: 'order-1', status: state === 'paid' ? 'paid' : 'pending', total: 123.45, createdAt: new Date().toISOString(), items: [], deliveryMethod: 'pickup',
      ...(state === 'missing' ? {} : { payment: { paymentMethod: bank ? 'bank_invoice' : 'online', paymentStatus: state === 'paid' ? 'paid' : 'unpaid', canPayOnline: !bank, canRequestInvoice: !bank, canDownloadInvoice: ['issued','paid'].includes(state) } }),
      invoice: bank ? { id: 'i', amountMinor: '12345', invoiceNumber: state === 'preparing' ? null : 'BI-2026-1', documentStatus: state === 'preparing' ? 'preparing' : 'issued', issuedAt: state === 'preparing' ? null : '2026-09-29T00:00:00Z', dueAt: '2026-10-02T00:00:00Z' } : null };
    const app = page('src/app/(auth)/profile/orders/details/page.tsx', { order });
    assert.match(visible(app.render()), /Загрузка заказа/);
    await new Promise(resolve => setImmediate(resolve));
    const tree = app.render(), text = visible(tree);
    if (bank) {
      assert.match(text, /По счёту/); assert.doesNotMatch(text, /ЮKassa|Оплатить онлайн|Платёж обрабатывается/);
      assert.match(text, state === 'paid' ? /Оплачено по счёту/ : /Ожидает оплаты по счёту/);
      assert.match(text, /123,45/);
      assert.equal(nodes(tree, 'a').some(n => n.props.href === '/api/orders/order-1/invoice/pdf'), state !== 'preparing');
    } else if (state === 'online') { assert.match(text, /Онлайн через ЮKassa/); assert.match(text, /Оплатить онлайн/); }
    else { assert.doesNotMatch(text, /ЮKassa|Оплатить онлайн/); assert.match(text, /Информация об оплате недоступна/); }
  });
}

// Executes the actual component and event handlers, with a small deterministic
// React hook host. Network and unrelated context/components are boundary mocks.
function page(relative, { legacy = false, unavailable = false, order = null, orderResponse = null } = {}) {
  const states = [], effects = [], requests = [], redirects = [];
  const router = { push: url => redirects.push(url), replace: url => redirects.push(url) };
  let cursor = 0;
  const consent = { documents: unavailable ? null : documents, requiresPersonalDataConsent: legacy, error: '', reload: async () => { consent.requiresPersonalDataConsent = false; } };
  const user = { id: 'user-1', firstName: 'Иван', lastName: 'Иванов', phone: '+79991234567', email: 'user@example.test' };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = states[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous[i]))) { effects.push(effect); states[index] = deps; }
    },
  };
  function load(file) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText.replace(/import\.meta\.env/g, '{}');
    new Function('require', 'exports', 'window', 'fetch', code)(name => {
      if (name === 'react') return react;
      if (name === '@/lib/next-shims') return { Link: 'a', Image: 'img', useRouter: () => router, useParams: () => ({ id: 'order-1' }), useSearchParams: () => new URLSearchParams('id=order-1') };
      if (name === '@/components/ConsentCheckbox') return { ConsentCheckbox: 'consent-checkbox' };
      if (name === '@/components/OrderTransferNotice') return { OrderTransferNotice: 'order-transfer-notice' };
      if (name === '@/components/OAuthButtons') return { OAuthButtons: 'oauth-buttons' };
      if (name === '@/components/PhoneInput') return { PhoneInput: 'phone-input' };
      if (name === '@/components/invoice/InvoiceBuyerForm') { const form = load('src/components/invoice/InvoiceBuyerForm.tsx'); return { ...form, InvoiceBuyerForm: 'invoice-buyer-form' }; }
      if (name === '@/components/AddressInput') return { AddressInput: 'address-input' };
      if (name === '@/lib/hooks/useAuth') return { useAuth: () => ({ user, loading: false }) };
      if (name === '@/lib/hooks/useConsentStatus') return { useConsentStatus: () => consent, personalDataAcceptance: docs => ({ accepted: true, documentVersion: docs.personalDataVersion, privacyVersion: docs.privacyVersion }) };
      if (name === '@/lib/context/CartContext') return { useCart: () => ({ cart: { items: [{ productId: '1', name: 'Product', price: 100, quantity: 1 }] }, isLoading: false, refetch: async () => {}, updateQuantity: async () => {}, clearCart: async () => {} }) };
      if (name === '@/lib/csrf') return { fetchWithCsrf: async (url, options) => { requests.push({ url, body: options.body ? JSON.parse(options.body) : undefined }); const result = orderResponse || { ok: true, body: { verificationToken: 'opaque-context', order: order || { id: 'order-1' } } }; return { ok: result.ok, status: result.status || (result.ok ? 200 : 400), json: async () => result.body }; } };
      if (name.startsWith('@/')) { const base = `src/${name.slice(2)}`; return load(fs.existsSync(path.join(root, `${base}.ts`)) ? `${base}.ts` : `${base}.tsx`); }
      return require(name);
    }, exports, { location: { origin: 'https://shop.example.test' }, setInterval: () => 1, clearInterval() {}, addEventListener() {}, removeEventListener() {} }, async url => ({ ok: true, json: async () => ({ order }) }));
    return exports;
  }
  const Component = load(relative).default;
  const render = () => {
    cursor = 0;
    const tree = Component();
    if (effects.length) { effects.splice(0).forEach(effect => effect()); return render(); }
    return tree;
  };
  return { render, requests, redirects, consent, load, submit: async () => nodes(render(), 'form')[0].props.onSubmit({ preventDefault() {}, stopPropagation() {} }),
    accept: variant => { const checkbox = nodes(render(), 'consent-checkbox').find(node => node.props.variant === variant); assert.ok(checkbox, variant); checkbox.props.onChange(true); },
    fill: (id, value) => nodes(render(), 'input').find(node => node.props.id === id).props.onChange({ target: { value } }),
  };
}

for (const payment of [{ paymentMethod: 'bank_invoice', paymentStatus: 'unpaid', canPayOnline: false }, undefined]) {
  test(`direct payment route never calls YooKassa with ${payment ? 'bank intent' : 'missing projection'}`, async () => {
    const app = page('src/app/(public)/payment/[orderId]/page.tsx', { order: { id: 'order-1', status: 'pending', payment } });
    app.render(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.requests.length, 0);
    assert.doesNotMatch(visible(app.render()), /Оплатить через ЮKassa/);
    if (payment) assert.equal(app.redirects[0], '/profile/orders/details?id=order-1');
  });
}
