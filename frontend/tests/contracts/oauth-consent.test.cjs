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
function mount({ provider = 'yandex', getOk = true, postOk = true, redirect = '/cart' } = {}) {
  let cursor = 0;
  const states = [], effects = [], requests = [], events = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
    },
    useEffect(effect) {
      const index = cursor++;
      if (!(index in states)) { states[index] = true; effects.push(effect); }
    },
  };
  function load(relative) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText.replace(/import\.meta\.env/g, '{}');
    new Function('require', 'exports', 'fetch', 'window', code)(name => {
      if (name === 'react') return react;
      if (name === '@/lib/next-shims') return { Link: 'a', Image: 'img', useRouter: () => ({ replace: url => events.push(['redirect', url]) }) };
      if (name === '@/components/ConsentCheckbox') return { ConsentCheckbox: 'consent-checkbox' };
      if (name === '@/lib/hooks/useAuth') return { useAuth: () => ({ refresh: async () => events.push(['refresh']) }) };
      if (name === '@/lib/hooks/useConsentStatus') return { personalDataAcceptance: docs => ({ accepted: true, documentVersion: docs.personalDataVersion, privacyVersion: docs.privacyVersion }) };
      if (name === '@/lib/csrf') return { fetchWithCsrf: async (url, options) => {
        requests.push({ url, ...options });
        return { ok: postOk, json: async () => ({ redirect, error: 'Internal provider token secret' }) };
      } };
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
      return require(name);
    }, exports, async (url, options) => {
      requests.push({ url, ...options });
      return { ok: getOk, json: async () => ({ provider, documents }) };
    }, { location: { origin: 'https://shop.example.test' } });
    return exports;
  }
  const Component = load('src/app/(auth)/oauth-consent/page.tsx').default;
  const render = () => { cursor = 0; const tree = Component(); effects.splice(0).forEach(effect => effect()); return tree; };
  return { render, requests, events,
    ready: async () => { render(); await new Promise(resolve => setImmediate(resolve)); return render(); },
    accept: () => nodes(render(), 'consent-checkbox')[0].props.onChange(true),
    submit: () => nodes(render(), 'form')[0].props.onSubmit({ preventDefault() {} }),
  };
}

for (const provider of ['yandex', 'max']) {
  test(`${provider}: pending context is cookie-bound; default false; only explicit consent is submitted; auth refresh precedes redirect`, async () => {
    const app = mount({ provider });
    const tree = await app.ready();
    assert.equal(nodes(tree, 'consent-checkbox')[0].props.checked, false);
    assert.equal(nodes(tree, 'button')[0].props.disabled, true);
    assert.deepEqual(app.requests[0], { url: '/api/auth/oauth/consent', credentials: 'include', cache: 'no-store' });
    await app.submit();
    assert.equal(app.requests.length, 1);
    app.accept();
    await Promise.all([app.submit(), app.submit()]);
    assert.equal(app.requests.length, 2, 'double submit is blocked');
    assert.equal(app.requests[1].method, 'POST');
    assert.deepEqual(JSON.parse(app.requests[1].body), { personalDataConsent: { accepted: true, documentVersion: documents.personalDataVersion, privacyVersion: documents.privacyVersion } });
    assert.deepEqual(app.events, [['refresh'], ['redirect', '/cart']]);
    assert.equal(nodes(app.render(), 'form').length, 0);
  });
}

test('invalid/expired pending GET fails closed and offers login restart', async () => {
  const app = mount({ getOk: false });
  const tree = await app.ready();
  assert.equal(nodes(tree, 'form').length, 0);
  assert.equal(nodes(tree, 'p').some(node => node.props.role === 'alert'), true);
  assert.equal(nodes(tree, 'a').some(node => node.props.href === '/login'), true);
  assert.equal(app.requests.length, 1);
});

test('expired/reused pending POST shows only safe error; no refresh/redirect/retry form', async () => {
  const app = mount({ postOk: false });
  await app.ready(); app.accept(); await app.submit();
  assert.deepEqual(app.events, []);
  const tree = app.render();
  assert.equal(nodes(tree, 'form').length, 0);
  assert.doesNotMatch(JSON.stringify(tree), /Internal provider token secret/);
  assert.equal(nodes(tree, 'a').some(node => node.props.href === '/login'), true);
});

test('OAuth consent redirect cannot navigate to an external origin', async () => {
  const app = mount({ redirect: '//evil.example' });
  await app.ready(); app.accept(); await app.submit();
  assert.deepEqual(app.events, [['refresh'], ['redirect', '/']]);
});

test('OAuth consent route is mounted without changing the existing callback route', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="\/oauth-consent" element=\{<OAuthConsentPage \/>\}/);
  assert.match(app, /path="\/oauth-callback" element=\{<OAuthCallbackPage \/>\}/);
});
