const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../src/components', file), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', ...Object.keys(globals), code)(name => {
    if (name === '@/lib/hero-rotation') return load('../lib/hero-rotation.ts', mocks, globals);
    if (name === './hero-image-assets.json') return { default: require('../../src/lib/hero-image-assets.json') };
    return mocks[name] || {};
  }, exports, ...Object.values(globals));
  return exports;
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function hero(reduced = false) {
  let cursor = 0, clock = 0, nextTimer = 0;
  const slots = [], pending = [], timers = new Map(), listeners = new Set();
  const media = { matches: reduced, addEventListener: (_, cb) => listeners.add(cb), removeEventListener: (_, cb) => listeners.delete(cb) };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useEffect(fn, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((dep, n) => !Object.is(dep, old.deps[n]))) {
        pending.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const schedule = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay, at: clock + delay }); return id; };
  const cancel = id => timers.delete(id);
  const { Hero } = load('hero.tsx', { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/lib/next-shims': { Image: 'img', Link: 'a' } }, {
    window: { matchMedia: () => media, setTimeout: schedule, clearTimeout: cancel },
    document: { addEventListener() {}, removeEventListener() {} },
    setTimeout: schedule,
    clearTimeout: cancel,
  });
  let tree;
  function render() { cursor = 0; tree = Hero(); pending.splice(0).forEach(fn => fn()); }
  render();
  render(); // Apply the media query effect before asserting timer behaviour.
  return {
    get timers() { return new Map([...timers].filter(([, timer]) => timer.delay === 12000)); },
    click(label) { const button = nodes(tree).find(n => n.type === 'button' && n.props['aria-label'] === label); assert.ok(button, label); button.props.onClick(); render(); },
    active: () => [...new Set(nodes(tree).filter(n => n.type === 'button' && n.props['aria-pressed']).map(n => n.props['aria-label']))],
    advance(ms) { clock += ms; for (const [id, t] of [...timers]) if (t.at <= clock) { timers.delete(id); t.fn(); } render(); },
    reduce() { media.matches = true; listeners.forEach(cb => cb()); render(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('hero wraps both directions and synchronizes indicators', () => {
  const h = hero();
  h.click('Предыдущий слайд'); assert.deepEqual(h.active(), ['Переключить на слайд 5']);
  h.click('Следующий слайд'); assert.deepEqual(h.active(), ['Переключить на слайд 1']);
  h.click('Переключить на слайд 3'); assert.deepEqual(h.active(), ['Переключить на слайд 3']);
  h.unmount(); assert.equal(h.timers.size, 0);
});
test('manual changes restart one auto timer, including clicking the active indicator', () => {
  const h = hero();
  h.advance(11000); h.click('Следующий слайд');
  assert.equal(h.timers.size, 1);
  h.advance(11000); assert.deepEqual(h.active(), ['Переключить на слайд 2']);
  h.click('Переключить на слайд 2');
  h.advance(11000); assert.deepEqual(h.active(), ['Переключить на слайд 2']);
  h.advance(1000); assert.deepEqual(h.active(), ['Переключить на слайд 3']);
  assert.equal(h.timers.size, 1); h.unmount();
});
test('reduced motion stops automatic movement while manual controls remain available', () => {
  const h = hero(true); assert.equal(h.timers.size, 0);
  h.click('Следующий слайд'); assert.deepEqual(h.active(), ['Переключить на слайд 2']);
  h.unmount();
  const running = hero(); running.reduce(); assert.equal(running.timers.size, 0); running.unmount();
});
test('header scrolls the actual document scroller without URL or click interception', () => {
  const calls = [];
  let reduced = false;
  class Element { constructor(interactive = false) { this.interactive = interactive; } closest(selector) { assert.match(selector, /a, button/); assert.match(selector, /data-header-menu/); return this.interactive ? this : null; } }
  const scroller = { scrollTop: 850, scrollTo: options => calls.push(options) };
  const { scrollFromHeader } = load('site-header.tsx', {}, { Element, document: { scrollingElement: scroller }, window: { matchMedia: () => ({ matches: reduced }) } });
  scrollFromHeader({ target: new Element(true) }); assert.equal(calls.length, 0);
  scrollFromHeader({ target: new Element() }); assert.deepEqual(calls.pop(), { top: 0, behavior: 'smooth' });
  reduced = true; scrollFromHeader({ target: new Element() }); assert.deepEqual(calls.pop(), { top: 0, behavior: 'auto' });
  scroller.scrollTop = 0; scrollFromHeader({ target: new Element() }); assert.equal(calls.length, 0);
});
