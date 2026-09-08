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

// Executes the actual component and event handlers, with a small deterministic
// React hook host. Network and unrelated context/components are boundary mocks.
function page(relative, { legacy = false, unavailable = false } = {}) {
  const states = [], effects = [], requests = [], redirects = [];
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
    new Function('require', 'exports', 'window', code)(name => {
      if (name === 'react') return react;
      if (name === '@/lib/next-shims') return { Link: 'a', Image: 'img', useRouter: () => ({ push: url => redirects.push(url) }), useSearchParams: () => new URLSearchParams('redirect=/profile') };
      if (name === '@/components/ConsentCheckbox') return { ConsentCheckbox: 'consent-checkbox' };
      if (name === '@/components/OrderTransferNotice') return { OrderTransferNotice: 'order-transfer-notice' };
      if (name === '@/components/OAuthButtons') return { OAuthButtons: 'oauth-buttons' };
      if (name === '@/components/PhoneInput') return { PhoneInput: 'phone-input' };
      if (name === '@/components/AddressInput') return { AddressInput: 'address-input' };
      if (name === '@/lib/hooks/useAuth') return { useAuth: () => ({ user }) };
      if (name === '@/lib/hooks/useConsentStatus') return { useConsentStatus: () => consent, personalDataAcceptance: docs => ({ accepted: true, documentVersion: docs.personalDataVersion, privacyVersion: docs.privacyVersion }) };
      if (name === '@/lib/context/CartContext') return { useCart: () => ({ cart: { items: [{ productId: '1', name: 'Product', price: 100, quantity: 1 }] }, isLoading: false, refetch: async () => {}, updateQuantity: async () => {}, clearCart: async () => {} }) };
      if (name === '@/lib/csrf') return { fetchWithCsrf: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ verificationToken: 'opaque-context', order: { id: 'order-1' } }) }; } };
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
      return require(name);
    }, exports, { location: { origin: 'https://shop.example.test' } });
    return exports;
  }
  const Component = load(relative).default;
  const render = () => {
    cursor = 0;
    const tree = Component();
    if (effects.length) { effects.splice(0).forEach(effect => effect()); return render(); }
    return tree;
  };
  return { render, requests, redirects, consent, submit: async () => nodes(render(), 'form')[0].props.onSubmit({ preventDefault() {} }),
    accept: variant => { const checkbox = nodes(render(), 'consent-checkbox').find(node => node.props.variant === variant); assert.ok(checkbox, variant); checkbox.props.onChange(true); },
    fill: (id, value) => nodes(render(), 'input').find(node => node.props.id === id).props.onChange({ target: { value } }),
  };
}

test('registration starts unchecked, blocks direct submit, then sends explicit document acceptance and preserves verification redirect', async () => {
  const app = page('src/app/(auth)/register/page.tsx');
  assert.equal(nodes(app.render(), 'consent-checkbox')[0].props.checked, false);
  app.fill('email', 'new@example.test');
  app.fill('password', 'ValidPassword123!');
  app.fill('confirmPassword', 'ValidPassword123!');
  await app.submit();
  assert.equal(app.requests.length, 0);
  app.accept('personalData');
  await app.submit();
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].url, '/api/auth/register');
  assert.deepEqual(app.requests[0].body.personalDataConsent, { accepted: true, documentVersion: documents.personalDataVersion, privacyVersion: documents.privacyVersion });
  assert.match(app.redirects[0], /^\/verify-email\?token=opaque-context&returnUrl=%2Fprofile&sent=1$/);
  assert.doesNotMatch(app.redirects[0], /new%40|new@example/);
});

test('registration fails closed while backend consent documents are unavailable', async () => {
  const app = page('src/app/(auth)/register/page.tsx', { unavailable: true });
  app.accept('personalData');
  await app.submit();
  assert.equal(app.requests.length, 0);
  assert.equal(nodes(app.render(), 'button').find(node => node.props.type === 'submit').props.disabled, true);
});

test('registered checkout shows only unchecked offer, requires acceptance for every new order', async () => {
  const app = page('src/app/(public)/cart/page.tsx');
  const checkboxes = nodes(app.render(), 'consent-checkbox');
  assert.deepEqual(checkboxes.map(node => [node.props.variant, node.props.checked]), [['offer', false]]);
  await app.submit();
  assert.equal(app.requests.length, 0);
  app.accept('offer');
  await app.submit();
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].url, '/api/orders');
  assert.deepEqual(app.requests[0].body.offerAcceptance, { accepted: true, documentVersion: documents.offerVersion });
  assert.equal('personalDataConsent' in app.requests[0].body, false);
  assert.equal(nodes(app.render(), 'consent-checkbox')[0].props.checked, false);
  await app.submit();
  assert.equal(app.requests.length, 1, 'the previous order acceptance must not authorize another order');
  app.accept('offer');
  await app.submit();
  assert.equal(app.requests.length, 2);
});

test('legacy checkout requires PD plus offer; next checkout uses refreshed server consent and only offer', async () => {
  const app = page('src/app/(public)/cart/page.tsx', { legacy: true });
  assert.deepEqual(nodes(app.render(), 'consent-checkbox').map(node => [node.props.variant, node.props.checked]), [['personalData', false], ['offer', false]]);
  app.accept('offer');
  await app.submit();
  assert.equal(app.requests.length, 0);
  app.accept('personalData');
  await app.submit();
  assert.equal(app.requests.length, 1);
  assert.deepEqual(app.requests[0].body.personalDataConsent, { accepted: true, documentVersion: documents.personalDataVersion, privacyVersion: documents.privacyVersion });
  assert.deepEqual(nodes(app.render(), 'consent-checkbox').map(node => [node.props.variant, node.props.checked]), [['offer', false]]);
  app.accept('offer');
  await app.submit();
  assert.equal(app.requests.length, 2);
  assert.equal('personalDataConsent' in app.requests[1].body, false);
});

test('checkout fails closed when consent status/documents cannot be loaded', async () => {
  const app = page('src/app/(public)/cart/page.tsx', { unavailable: true });
  app.accept('offer');
  await app.submit();
  assert.equal(app.requests.length, 0);
});

test('legacy personal-data acceptance alone never substitutes for order offer acceptance', async () => {
  const app = page('src/app/(public)/cart/page.tsx', { legacy: true });
  app.accept('personalData');
  await app.submit();
  assert.equal(app.requests.length, 0);
  assert.equal(nodes(app.render(), 'consent-checkbox').find(node => node.props.variant === 'offer').props.checked, false);
});
