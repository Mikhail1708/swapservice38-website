const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function load(file, states = [], extra = '') {
  let index = 0;
  const module = { exports: {} };
  const js = ts.transpileModule(read(file) + extra, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const localRequire = id => {
    if (id === 'react') return { ...React, useEffect: () => {}, useState: initial => [index < states.length ? states[index++] : initial, () => {}] };
    if (id === '@/lib/next-shims') return {
      Link: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
      Image: ({ fill, priority, unoptimized, ...props }) => React.createElement('img', props),
    };
    if (id.startsWith('@/')) {
      const p = 'src/' + id.slice(2);
      return load(p + (fs.existsSync(path.join(root, p + '.tsx')) ? '.tsx' : '.ts'));
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', js)(localRequire, module, module.exports);
  return module.exports;
}

for (const count of [0, 1, 3, 5, 10]) {
  test(`footer uses static swaps plus first four active API services: ${count}`, async () => {
    const rows = Array.from({ length: count }, (_, i) => ({ id: `s${i}`, name: `Service ${i}`, isActive: true }));
    const originalFetch = global.fetch;
    try {
      global.fetch = async (url, options) => {
        assert.equal(url, '/api/services');
        assert.ok(options.signal instanceof AbortSignal);
        return { ok: true, json: async () => ({ services: rows }) };
      };
      const result = await load('src/lib/footer-services.ts').loadFooterServices(new AbortController().signal);
      assert.deepEqual(result, rows.slice(0, 4));
      const html = render(load('src/components/site-footer.tsx', [result]).SiteFooter());
      assert.equal((html.match(/href="\/services\/s\d+"/g) || []).length, Math.min(count, 4));
      const section = html.split('>Услуги</h4>')[1].split('</ul>')[0];
      assert.match(section, /href="\/swaps"[^>]*>Свапы двигателей<\/a>/);
      if (count) assert.ok(section.indexOf('/swaps') < section.indexOf('/services/s0'));
    } finally { global.fetch = originalFetch; }
  });
}

test('footer ranks categories by real counts, preserves filter name and formats labels', async () => {
  const original = global.fetch;
  try {
    const categoryCounts = [0, 2, 1, 12, 5, 7, 3, 10].map((productCount, index) => ({ name: `КАТЕГОРИЯ & ${index}`, productCount }));
    global.fetch = async url => {
      assert.equal(url, '/api/products/categories?includeCounts=true');
      return { ok: true, json: async () => ({ categoryCounts }) };
    };
    const result = await load('src/lib/footer-categories.ts').loadFooterCategories(new AbortController().signal);
    assert.deepEqual(result.map(c => c.productCount), [12, 10, 7, 5, 3]);
    const html = render(load('src/components/site-footer.tsx', [[], result]).SiteFooter());
    const section = html.split('>Каталог</h4>')[1].split('</ul>')[0];
    assert.match(section, /^<ul[^>]*><li><a href="\/catalog"[^>]*>Все товары<\/a>/);
    assert.equal((section.match(/<li>/g) || []).length, 6);
    assert.ok(section.includes(`/catalog?category=${encodeURIComponent('КАТЕГОРИЯ & 3')}`));
    assert.ok(section.includes('Категория &amp; 3'));
    assert.ok(section.indexOf('Категория &amp; 3') < section.indexOf('Категория &amp; 7'));
  } finally { global.fetch = original; }
});

test('footer keeps static links when both APIs fail and when lists are empty', async () => {
  const original = global.fetch;
  try {
    for (const failure of [false, true]) {
      global.fetch = async () => { if (failure) throw Error('offline'); return { ok: true, json: async () => ({ services: [], categoryCounts: [] }) }; };
      const signal = new AbortController().signal;
      const services = await load('src/lib/footer-services.ts').loadFooterServices(signal);
      const categories = await load('src/lib/footer-categories.ts').loadFooterCategories(signal);
      const html = render(load('src/components/site-footer.tsx', [services, categories]).SiteFooter());
      const catalog = html.split('>Каталог</h4>')[1].split('</ul>')[0];
      const service = html.split('>Услуги</h4>')[1].split('</ul>')[0];
      assert.equal((catalog.match(/<li>/g) || []).length, 1);
      assert.match(catalog, /Все товары/);
      assert.equal((service.match(/<li>/g) || []).length, 1);
      assert.match(service, /Свапы двигателей/);
    }
  } finally { global.fetch = original; }
});

test('services exclude duplicate static name, preserve API order and sentence case', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ services: [
      { id: 'dup', name: '  СВАПЫ   ДВИГАТЕЛЕЙ ' },
      { id: 's2', name: 'РЕМОНТ ДВИГАТЕЛЕЙ' }, { id: 's1', name: 'УСЛУГА' },
    ] }) });
    const result = await load('src/lib/footer-services.ts').loadFooterServices(new AbortController().signal);
    assert.deepEqual(result.map(s => s.id), ['s2', 's1']);
    const html = render(load('src/components/site-footer.tsx', [result]).SiteFooter());
    const section = html.split('>Услуги</h4>')[1].split('</ul>')[0];
    assert.equal((section.match(/Свапы двигателей/g) || []).length, 1);
    assert.match(section, /Ремонт двигателей/);
    assert.ok(section.indexOf('/services/s2') < section.indexOf('/services/s1'));
  } finally { global.fetch = original; }
});

test('footer tolerates API failure, malformed data and excludes inactive services', async () => {
  const originalFetch = global.fetch;
  try {
    const { loadFooterServices } = load('src/lib/footer-services.ts');
    for (const response of [null, {}, { services: null }, { services: [null, { id: 'a', name: 'Inactive', isActive: false }] }]) {
      global.fetch = async () => ({ ok: true, json: async () => response });
      assert.deepEqual(await loadFooterServices(new AbortController().signal), []);
    }
    global.fetch = async () => ({ ok: false });
    assert.deepEqual(await loadFooterServices(new AbortController().signal), []);
    global.fetch = async () => { throw Error('offline'); };
    assert.deepEqual(await loadFooterServices(new AbortController().signal), []);
  } finally { global.fetch = originalFetch; }
});

test('service plain text preserves paragraphs/newlines and escapes markup', () => {
  const { PlainText } = load('src/components/content-text.tsx');
  const text = 'Абзац один\nстрока\n\nАбзац два\n<script>alert(1)</script>';
  const html = render(PlainText({ text }));
  assert.equal((html.match(/<p>/g) || []).length, 2);
  assert.match(html, /один\nстрока/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /plain-content/);
  const long = '🚗'.repeat(1000);
  assert.ok(render(PlainText({ text: long, preview: true })).includes(long));
  assert.match(read('src/app/globals.css'), /\.content-preview\s*\{[^}]*-webkit-line-clamp: 8;[^}]*overflow: hidden/);
});

test('article renderer preserves plain dash lines and existing block HTML without extra whitespace', () => {
  const { ArticleContent } = load('src/components/content-text.tsx');
  const plain = '- Двигатель\n- Коробка\n\nОписание';
  const html = render(ArticleContent({ sanitizedHtml: plain }));
  assert.match(html, /plain-content/);
  assert.ok(html.includes(plain));
  const rich = '<p>Текст <strong>важно</strong><br>строка</p>\n<ul><li>Один</li><li><em>Два</em></li></ul>';
  const result = render(ArticleContent({ sanitizedHtml: rich }));
  assert.ok(result.includes(rich));
  assert.doesNotMatch(result, /plain-content/);
  // Public API sanitizes every read, including content saved before sanitization existed.
  const controller = fs.readFileSync(path.join(root, '../backend/src/controllers/articles.controller.ts'), 'utf8');
  assert.match(controller, /content: sanitizeArticleHtml\(article.content\)/);
});

test('real service card renders description preview without a price; forms omit price', () => {
  const { TestCard } = load('src/app/(public)/services/page.tsx', [false], '\nexports.TestCard = ServiceCard;');
  const html = render(TestCard({ service: { id: 's1', name: 'Service', price: 12345, description: 'First\nSecond', isActive: true }, index: 1 }));
  assert.doesNotMatch(html, /12345|₽/);
  assert.match(html, /content-preview/);
  assert.match(html, /lg:order-2/);
  assert.match(html, /href="\/services\/s1"/);
  for (const p of ['create', '[id]']) {
    const source = read(`src/app/admin/content/services/${p}/page.tsx`);
    assert.doesNotMatch(source, /form\.price|price:\s|Цена \(/);
  }
  assert.doesNotMatch(read('src/app/(public)/services/[id]/page.tsx'), /service\.price/);
  assert.doesNotMatch(read('src/app/admin/content/services/page.tsx'), /service\.price/);
});
