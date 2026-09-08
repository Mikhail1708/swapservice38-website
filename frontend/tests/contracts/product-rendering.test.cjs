const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');

// Render the real JSX with deterministic loaded API state; no network or DB writes.
function load(relative, initialStates = [], exposeCard = false) {
  let stateIndex = 0;
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, relative), 'utf8') + (exposeCard ? '\nexports.TestCard = ProductCard;' : '');
  // ESM imports are hoisted even if a source file declares one below a constant.
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
  const hoisted = ts.factory.updateSourceFile(ast, [...ast.statements.filter(ts.isImportDeclaration), ...ast.statements.filter(s => !ts.isImportDeclaration(s))]);
  const js = ts.transpileModule(ts.createPrinter().printFile(hoisted), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const scopedRequire = id => {
    if (id === 'react') return { ...React,
      useState: value => [stateIndex < initialStates.length ? initialStates[stateIndex++] : typeof value === 'function' ? value() : value, () => {}],
      useEffect: () => {}, useMemo: fn => fn(), useCallback: fn => fn,
    };
    if (id === '@/lib/next-shims') return {
      Link: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
      Image: ({ fill, priority, unoptimized, ...props }) => React.createElement('img', props),
      useParams: () => ({ id: '134' }),
    };
    if (id === '@/lib/context/CartContext') return { useCart: () => ({ isInCart: () => false, getQuantity: () => 0 }) };
    if (id === '@/components/AddToCartButton') return { AddToCartButton: () => React.createElement('button', { 'data-testid': 'add-to-cart' }, 'Добавить в корзину') };
    if (id.startsWith('@/')) {
      const relative = 'src/' + id.slice(2);
      const extension = fs.existsSync(path.join(root, relative + '.tsx')) ? '.tsx' : '.ts';
      if (id.includes('/csrf') || id.includes('/api-error')) return {};
      return load(relative + extension);
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', js)(scopedRequire, module, module.exports);
  return module.exports;
}

for (const stock of [0, 10]) {
  for (const target of ['catalog card', 'home card', 'product page']) {
    test(`${target} renders ${stock === 0 ? 'on-order contacts without purchase' : 'stock and purchase without contacts'}`, () => {
      const product = { id: 134, name: 'Дроп Панара 4 дюйма', stock, availableStock: stock, price: 1500, images: [], sku: 'DROP-4', categories: [], characteristics: {} };
      let tree;
      if (target === 'product page') {
        const page = load('src/app/(public)/catalog/[id]/page.tsx', [product, false, null, 1, null, false, 0, {}]);
        tree = page.default();
      } else {
        const file = target === 'home card' ? 'src/components/products.tsx' : 'src/app/(public)/catalog/page.tsx';
        const card = load(file, [false], true);
        tree = card.TestCard({ product, onAddToCart: () => {}, isAdding: false, isInCart: () => false, getQuantity: () => 0 });
      }
      const html = renderToStaticMarkup(tree);
      assert.match(html, /Дроп Панара 4 дюйма/);
      if (stock === 0) {
        assert.match(html, /Под заказ/i);
        assert.match(html, /Написать в Telegram/);
        assert.match(html, /Написать в MAX/);
        assert.doesNotMatch(html, /Добавить в корзину/);
      } else {
        assert.match(html, /В наличии: 10 шт\./);
        assert.match(html, /Добавить в корзину/);
        assert.doesNotMatch(html, /Написать в (Telegram|MAX)/);
        assert.doesNotMatch(html, /Под заказ/i);
      }
    });
  }
}
