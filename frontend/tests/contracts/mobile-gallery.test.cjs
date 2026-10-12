const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/app/(public)/swaps/[id]/page.tsx'), 'utf8');
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function gallery(images = ['portrait.jpg', 'wide.jpg', 'small.jpg']) {
  const slots = [], pending = [], keys = new Map(), scrolls = [], buttons = new Map();
  let cursor = 0, tree;
  const app = { inert: false };
  const body = { style: { position: '', top: '', left: '', width: '', overflow: 'auto' }, children: [app] };
  const document = { body, documentElement: { style: { overflow: '', scrollBehavior: 'smooth' } }, activeElement: null,
    addEventListener: (name, fn) => keys.set(name, fn), removeEventListener: name => keys.delete(name) };
  const makeNode = () => ({ isConnected: true, focus() { document.activeElement = this; }, querySelectorAll() { return nodes(tree).filter(n => n.type === 'button' && !n.props['aria-label']?.startsWith('Открыть')).map(n => n.element); } });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn, deps) { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) pending.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const code = ts.transpileModule(source + '\nexport { Gallery };', { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  new Function('require', 'exports', 'document', 'window', code)(name => {
    if (name === 'react') return react;
    if (name === 'react-dom') return { createPortal: node => node };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/next-shims') return { Image: 'thumbnail' };
    return {};
  }, exports, document, { scrollX: 0, scrollY: 850, scrollTo: (...args) => scrolls.push(args) });
  function render() {
    cursor = 0; tree = exports.Gallery({ images });
    for (const node of nodes(tree)) {
      const label = node.type === 'button' ? node.props['aria-label'] : null;
      node.element = node.props?.ref?.current || (label && buttons.get(label)) || makeNode();
      if (label) buttons.set(label, node.element);
      if (node.props?.ref) node.props.ref.current = node.element;
    }
    pending.splice(0).forEach(fn => fn());
  }
  render();
  return { document, app, body, scrolls,
    find: predicate => nodes(tree).find(predicate),
    click(label) { const button = nodes(tree).find(n => n.type === 'button' && n.props['aria-label'] === label); assert.ok(button, label); button.props.onClick({ currentTarget: button.element }); render(); return button.element; },
    key(key, shiftKey = false) { keys.get('keydown')?.({ key, shiftKey, preventDefault() {} }); render(); },
    swipe(dx, dy) { const stage = nodes(tree).find(n => n.props?.onTouchStart); stage.props.onTouchStart({ touches: [{ clientX: 100, clientY: 100 }] }); stage.props.onTouchEnd({ changedTouches: [{ clientX: 100 + dx, clientY: 100 + dy }] }); render(); },
    image: () => nodes(tree).find(n => n.type === 'img'),
    loaded() { nodes(tree).find(n => n.type === 'img').props.onLoad(); render(); },
  };
}
test('gallery opens in portal, locks page and restores exact scroll/styles/focus on Escape', () => {
  const g = gallery(); const opener = g.click('Открыть фото 1');
  assert.equal(g.find(n => n.props?.role === 'dialog').props['aria-modal'], 'true');
  assert.equal(g.body.style.position, 'fixed'); assert.equal(g.body.style.top, '-850px'); assert.equal(g.app.inert, true);
  assert.match(g.image().props.className, /object-contain/); assert.match(g.image().props.className, /h-auto w-auto max-h-full max-w-full/);
  assert.match(g.image().props.className, /invisible/); g.loaded(); assert.doesNotMatch(g.image().props.className, /invisible/);
  g.key('Escape'); assert.equal(g.find(n => n.props?.role === 'dialog'), undefined);
  assert.equal(g.body.style.position, ''); assert.equal(g.body.style.overflow, 'auto'); assert.equal(g.app.inert, false);
  assert.deepEqual(g.scrolls, [[0, 850]]); assert.equal(g.document.activeElement, opener);
});
test('gallery arrows, keyboard and horizontal swipes wrap; vertical gestures do not navigate', () => {
  const g = gallery(); g.click('Открыть фото 1');
  g.key('ArrowLeft'); assert.equal(g.image().props.src, 'small.jpg');
  g.click('Следующее фото'); assert.equal(g.image().props.src, 'portrait.jpg');
  g.swipe(-90, 10); assert.equal(g.image().props.src, 'wide.jpg');
  g.swipe(10, 90); assert.equal(g.image().props.src, 'wide.jpg');
  g.swipe(90, 10); assert.equal(g.image().props.src, 'portrait.jpg');
  g.click('Закрыть галерею'); assert.equal(g.body.style.position, '');
});
test('gallery traps keyboard focus and handles repeated URLs without reusing loading image', () => {
  const g = gallery(['same.jpg', 'same.jpg']); g.click('Открыть фото 1');
  g.key('Tab', true);
  assert.equal(g.document.activeElement, g.find(n => n.props?.['aria-label'] === 'Следующее фото').element);
  g.key('Tab'); assert.equal(g.document.activeElement, g.find(n => n.props?.['aria-label'] === 'Закрыть галерею').element);
  const key = g.image().key; g.click('Следующее фото'); assert.notEqual(g.image().key, key);
  g.click('Закрыть галерею');
});
test('swap navigation has explicit services parent and projects destination, including direct URLs', () => {
  const list = fs.readFileSync(path.join(root, 'src/app/(public)/swaps/page.tsx'), 'utf8');
  assert.match(list, /href="\/services"[\s\S]*?Все услуги/);
  assert.match(source, /href="\/services"[^>]*>Услуги/);
  assert.match(source, /href="\/swaps"[\s\S]*?Все проекты/);
  assert.doesNotMatch(source + list, /history\.back|router\.back|\?{4}/);
});
