const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../src/app/(public)/catalog/page.tsx'), 'utf8');
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

test('catalog loader sends filters on every page and retains backend price order', async () => {
  const code = source.slice(source.indexOf('const fetchProducts ='), source.indexOf('const fetchCategories ='));
  const api = {}, requests = [];
  new Function('exports', 'fetchWithCsrf', compile(`${code}\nexports.load = fetchProducts;`))(api, async url => {
    requests.push(new URL(url, 'https://test.invalid'));
    return { ok: true, json: async () => ({ items: [{ id: requests.length, stock: 10 - requests.length, price: requests.length }], totalPages: 2 }) };
  });
  const products = await api.load('in_stock', 'price_asc', 'Suspension', 'spring');
  assert.deepEqual(products.map(p => p.id), [1, 2]);
  for (const [index, url] of requests.entries()) {
    for (const [key, value] of Object.entries({ availability: 'in_stock', sort: 'price_asc', category: 'Suspension', search: 'spring', page: String(index + 1) })) assert.equal(url.searchParams.get(key), value);
  }
});

function updater(query) {
  const searchParams = new URLSearchParams(query), urls = [];
  const code = source.slice(source.indexOf('  const updateUrl ='), source.indexOf('  // ===== ОБРАБОТЧИКИ'));
  const api = {};
  new Function('exports', 'useCallback', 'router', 'searchParams', 'availability', 'sort', compile(`${code}\nexports.update = updateUrl;`))(
    api, fn => fn, { push: url => urls.push(new URL(url, 'https://test.invalid')) }, searchParams, searchParams.get('availability') || '', searchParams.get('sort') || '');
  return { update: api.update, urls };
}

test('filter and sort changes reset page while preserving category, search and unrelated URL params', () => {
  const app = updater('category=3&search=spring&page=4&availability=in_stock&sort=price_asc&other=kept');
  app.update('3', 1, 'spring', 'on_order', 'price_desc');
  const params = app.urls[0].searchParams;
  assert.equal(params.has('page'), false);
  assert.equal(params.get('category'), '3'); assert.equal(params.get('search'), 'spring');
  assert.equal(params.get('other'), 'kept');
  assert.equal(params.get('availability'), 'on_order'); assert.equal(params.get('sort'), 'price_desc');
});

test('default removes explicit sort, preserving in_stock; pagination retains URL filters after reload', () => {
  const app = updater('availability=in_stock&sort=price_asc');
  app.update('', 1, '', 'in_stock', '');
  assert.equal(app.urls[0].searchParams.get('availability'), 'in_stock');
  assert.equal(app.urls[0].searchParams.has('sort'), false);
  const reloaded = updater(app.urls[0].search);
  reloaded.update('', 2, '');
  assert.equal(reloaded.urls[0].searchParams.get('page'), '2');
  assert.equal(reloaded.urls[0].searchParams.get('availability'), 'in_stock');
});

test('UI provides availability and price selects; both reset page and default has no explicit sort', () => {
  assert.match(source, /aria-label="Наличие" value=\{availability\}/);
  assert.match(source, /aria-label="Сортировка" value=\{sort\}/);
  for (const value of ['in_stock', 'on_order', 'price_asc', 'price_desc']) assert.ok(source.includes(`value="${value}"`));
  assert.match(source, /<option value="">По умолчанию<\/option>/);
  assert.match(source, /updateUrl\(selectedCategory, 1, search, e.target.value, sort\)/);
  assert.match(source, /updateUrl\(selectedCategory, 1, search, availability, e.target.value\)/);
  assert.match(source, /version !== loadVersion.current/);
});
