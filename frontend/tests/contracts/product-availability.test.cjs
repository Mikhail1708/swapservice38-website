const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const source = read('src/lib/product-availability.ts');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
new Function('exports', compiled)(exported);

test('shared availability labels use authoritative free stock', () => {
  assert.deepEqual(exported.productAvailability({ stock: 4 }), { availableStock: 4, isOnOrder: false, label: 'В наличии: 4 шт.' });
  assert.deepEqual(exported.productAvailability({ stock: 8, availableStock: 0 }), { availableStock: 0, isOnOrder: true, label: 'Под заказ' });
});

test('catalog category filter includes secondary category names and numeric category ids', () => {
  const code = ts.transpileModule(read('src/lib/product-category.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const api = {};
  new Function('exports', code)(api);
  const product = { category: 'Подвеска', categories: [{ id: 2, name: 'Подвеска' }, { id: 3, name: 'Лифт-комплекты' }] };
  assert.equal(api.matchesProductCategory(product, 'Лифт-комплекты'), true);
  assert.equal(api.matchesProductCategory(product, '3'), true);
  assert.equal(api.matchesProductCategory(product, 'unknown'), false);
  assert.match(read('src/app/(public)/catalog/page.tsx'), /matchesProductCategory\(p, selectedCategory\)/);
});
test('catalog, home cards, and detail use the shared availability and enquiry components', () => {
  for (const file of ['src/components/products.tsx', 'src/app/(public)/catalog/page.tsx', 'src/app/(public)/catalog/[id]/page.tsx']) {
    const code = read(file);
    assert.match(code, /productAvailability\(product\)/);
    assert.match(code, /<ProductEnquiry product=\{product\}/);
  }
});
test('enquiry buttons are only rendered for on-order products and use real shared contacts', () => {
  const code = read('src/components/ProductEnquiry.tsx');
  assert.match(code, /if \(!productAvailability\(product\).isOnOrder\) return null/);
  assert.match(code, /href=\{SITE_CONTACTS.telegram\}/);
  assert.match(code, /href=\{SITE_CONTACTS.max\}/);
  const contacts = read('src/lib/site-contacts.ts');
  assert.match(contacts, /https:\/\/t.me\/swap38/);
  assert.match(contacts, /https:\/\/web.max.ru\/-70953461855659/);
});

test('catalog follows every CRM page rather than truncating at 999 products', async () => {
  const page = read('src/app/(public)/catalog/page.tsx');
  const loader = page.slice(page.indexOf('const fetchProducts ='), page.indexOf('const fetchCategories ='));
  const compiledLoader = ts.transpileModule(`${loader}\nexports.fetchProducts = fetchProducts;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const api = {};
  const calls = [];
  new Function('exports', 'fetchWithCsrf', compiledLoader)(api, async url => {
    calls.push(url);
    return { ok: true, json: async () => ({ items: [{ id: calls.length, stock: calls.length === 1 ? 1 : 0 }], totalPages: 2 }) };
  });
  const products = await api.fetchProducts();
  assert.equal(products.length, 2);
  assert.equal(products[1].stock, 0);
  assert.match(calls[1], /page=2/);
});
