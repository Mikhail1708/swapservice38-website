const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');
const comment = { id: 'c1', author: 'Автор', authorId: 'u1', content: '<script>text</script>', createdAt: '2026-09-23T00:00:00Z', parentId: null };

function load(file, overrides = {}) {
  const js = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => {
    if (id in overrides) return overrides[id];
    if (id === '@/lib/admin-comments') return load('src/lib/admin-comments.ts');
    return require(id);
  }, module, module.exports);
  return module.exports;
}

function page({ role = 'admin', reason = '  Нарушение правил  ', request = async () => ({ ok: true, json: async () => ({ success: true }) }), pending = false, cursor = null } = {}) {
  const values = [false, false, { title: 'Статья', description: '', content: '', tags: '', isPublished: true, readTime: 5 }, [], false,
    [comment, { ...comment, id: 'c2', parentId: 'c1' }], comment, reason, null, pending, cursor, false, null];
  const effects = [];
  let index = 0;
  const component = load('src/app/admin/content/articles/[id]/page.tsx', {
    react: { ...React, useEffect: fn => effects.push(fn), useRef: initial => ({ current: initial }), useState: () => {
      const i = index++; return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }];
    } },
    '@/lib/next-shims': { useRouter: () => ({ push() {}, back() {} }), useParams: () => ({ id: 'a1' }) },
    '@/lib/hooks/useAuth': { useAuth: () => ({ user: role ? { role } : null }) },
    '@/lib/csrf': { fetchWithCsrf: request },
  }).default;
  const tree = component();
  const nodes = [];
  function walk(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); nodes.push(node); walk(node.props?.children); }
  walk(tree);
  return { values, tree, nodes, effects, confirm: nodes.find(node => node.type === 'button' && node.props.className.includes('bg-red-600')) };
}

test('moderation UI is admin-only and escapes preview; dialog requires bounded reason', () => {
  for (const role of [null, 'user']) {
    const ui = page({ role });
    assert.equal(ui.confirm, undefined);
    assert.ok(!ui.nodes.some(node => node.type === 'dialog'));
  }
  const ui = page();
  const html = renderToStaticMarkup(ui.tree);
  assert.match(html, /&lt;script&gt;text&lt;\/script&gt;/);
  assert.match(html, /Ответ на комментарий/);
  assert.ok(ui.nodes.some(node => node.type === 'dialog' && node.props.onCancel));
  const reasonInput = ui.nodes.find(node => node.type === 'textarea' && node.props.maxLength === 2000);
  assert.equal(reasonInput.props.required, true);
  assert.equal(page({ pending: true }).confirm.props.disabled, true);
});

test('successful delete uses CSRF helper, trims reason, prevents simultaneous DELETE and preserves replies', async () => {
  let resolve;
  const calls = [];
  const ui = page({ request: (...args) => { calls.push(args); return new Promise(done => { resolve = done; }); } });
  const first = ui.confirm.props.onClick();
  await ui.confirm.props.onClick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/admin/comments/c1');
  assert.equal(calls[0][1].method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[0][1].body), { reason: 'Нарушение правил' });
  resolve({ ok: true, json: async () => ({ success: true }) });
  await first;
  assert.deepEqual(ui.values[5].map(c => [c.id, c.parentId]), [['c2', null]]);
  assert.equal(ui.values[6], null);
  assert.equal(ui.values[9], false);
});

test('invalid reason does not send DELETE; backend errors keep comments and dialog', async () => {
  for (const reason of ['', ' \n ', 'x'.repeat(2001)]) {
    const ui = page({ reason, request: () => { throw Error('must not send'); } });
    await ui.confirm.props.onClick();
    assert.equal(ui.values[5].length, 2);
    assert.ok(ui.values[8]);
  }
  const ui = page({ request: async () => ({ ok: false, json: async () => ({ error: 'Нет доступа' }) }) });
  await ui.confirm.props.onClick();
  assert.equal(ui.values[8], 'Нет доступа');
  assert.equal(ui.values[5].length, 2);
  assert.equal(ui.values[6].id, 'c1');
  assert.equal(ui.values[9], false);
});

test('SET NULL update removes only target, preserving descendants and unrelated rows without mutation', () => {
  const { removeDeletedComment } = load('src/lib/admin-comments.ts');
  const rows = [{ id: 'p', parentId: null }, { id: 'child', parentId: 'p' }, { id: 'grandchild', parentId: 'child' }, { id: 'other', parentId: null }];
  assert.deepEqual(removeDeletedComment(rows, 'p'), [{ id: 'child', parentId: null }, { id: 'grandchild', parentId: 'child' }, { id: 'other', parentId: null }]);
  assert.equal(rows[1].parentId, 'p');
});

test('admin comments load separately through bounded endpoint with cancellation cleanup', async () => {
  const original = global.fetch;
  let options;
  try {
    global.fetch = async (url, init) => {
      assert.equal(url, '/api/admin/articles/a1/comments');
      options = init;
      return { ok: true, json: async () => ({ comments: [comment], nextCursor: 'c1' }) };
    };
    const ui = page();
    const cleanup = ui.effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(ui.values[5], [comment]);
    assert.equal(ui.values[10], 'c1');
    assert.equal(options.credentials, 'include');
    cleanup();
    assert.equal(options.signal.aborted, true);
  } finally { global.fetch = original; }
});

test('load more preserves existing comments and uses backend after cursor; errors preserve list', async () => {
  const original = global.fetch;
  try {
    const ui = page({ cursor: 'c2' });
    const more = ui.nodes.find(node => node.type === 'button' && node.props.children === 'Загрузить комментарии');
    global.fetch = async url => {
      assert.equal(url, '/api/admin/articles/a1/comments?after=c2');
      return { ok: true, json: async () => ({ comments: [{ ...comment, id: 'c3' }], nextCursor: null }) };
    };
    more.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(ui.values[5].map(c => c.id), ['c1', 'c2', 'c3']);
    assert.equal(ui.values[10], null);
    global.fetch = async () => ({ ok: false, json: async () => ({ error: 'Ошибка загрузки' }) });
    more.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ui.values[12], 'Ошибка загрузки');
    assert.deepEqual(ui.values[5].map(c => c.id), ['c1', 'c2', 'c3']);
  } finally { global.fetch = original; }
});
