const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const root = path.resolve(__dirname, '../..');
function load(relative) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'exports', code)(name => {
    if (name === '@/lib/next-shims') return { Link: 'a' };
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  }, exports);
  return exports;
}
for (const route of ['privacy', 'offer', 'personal-data-consent']) {
  test(`${route}: mounted public legal page renders current version and matching operator links`, () => {
    const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
    assert.ok(app.includes(`path="/${route}"`));
    const Page = load(`src/app/(public)/${route}/page.tsx`).default;
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.match(html, /8 сентября 2026 г/);
    assert.match(html, /381011379046/);
    assert.match(html, /315385000059546/);
    assert.match(html, /href="mailto:swap38@mail.ru"[^>]*>\s*swap38@mail.ru/);
    assert.match(html, /href="tel:\+79245330880"[^>]*>\+7 \(924\) 533-08-80/);
    if (route === 'offer') {
      assert.match(html, /href="tel:\+79834460888"[^>]*>\+7 \(983\) 446-08-88/);
      assert.match(html, /12 часов/);
      assert.match(html, /не ограничивает законное право/);
      assert.match(html, /также дистанционно/);
      assert.match(html, /3 \(трёх\) рабочих дней/);
      assert.match(html, /подтверждения полной оплаты/);
      assert.match(html, /а не срок перевозки/);
      assert.match(html, /фиксируется до внесения предоплаты/);
      assert.match(html, /версия 2026-09-08.1/);
    }
  });
}
test('legal versions match backend evidence versions, without broadening processing scope', () => {
  const source = fs.readFileSync(path.join(root, '../backend/src/services/consent.service.ts'), 'utf8');
  for (const field of ['personalDataVersion', 'privacyVersion']) assert.ok(source.includes(`${field}: '2026-09-08'`));
  assert.ok(source.includes("offerVersion: '2026-09-08.1'"));
  assert.ok(source.includes("PERSONAL_DATA_SCOPE = 'account-orders-v1'"));
});

test('cart and payment show the same transfer rule before their payment buttons', () => {
  const Notice = load('src/components/OrderTransferNotice.tsx').OrderTransferNotice;
  for (const method of ['pickup', 'post']) {
    const html = renderToStaticMarkup(React.createElement(Notice, { deliveryMethod: method }));
    assert.match(html, /не позднее 3 рабочих дней после подтверждения полной оплаты/);
    assert.match(html, /href="\/offer"/);
    if (method === 'pickup') assert.match(html, /уведомим о готовности/);
    else {
      assert.match(html, /не получения посылки/);
      assert.match(html, /Стоимость доставки не включена/);
    }
  }
  for (const [page, button] of [['cart/page.tsx', 'type="submit"'], ['payment/[orderId]/page.tsx', 'onClick={handlePay}']]) {
    const source = fs.readFileSync(path.join(root, 'src/app/(public)', page), 'utf8');
    const noticePosition = source.indexOf('<OrderTransferNotice');
    assert.ok(noticePosition >= 0 && source.indexOf(button, noticePosition) > noticePosition);
  }
});
