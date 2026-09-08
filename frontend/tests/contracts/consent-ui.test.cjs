const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function component(relative, initialState) {
  let state = initialState;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'exports', code)(name => {
    if (name === 'react') return { useId: () => 'test-checkbox', useState: initial => {
      if (state === undefined) state = typeof initial === 'function' ? initial() : initial;
      return [state, value => { state = typeof value === 'function' ? value(state) : value; }];
    } };
    if (name === '@/lib/next-shims') return { Link: 'a', Image: 'img' };
    if (name === '@/lib/site-contacts') return { SITE_CONTACTS: { telegram: 'https://t.me/swap38', max: 'https://web.max.ru/-70953461855659' } };
    return require(name);
  }, exports);
  return exports;
}
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}

test('consent checkbox is native, controlled, unchecked and document links are outside label', () => {
  const { ConsentCheckbox } = component('src/components/ConsentCheckbox.tsx');
  for (const variant of ['personalData', 'offer']) {
    const changes = [];
    const tree = ConsentCheckbox({ variant, checked: false, onChange: value => changes.push(value) });
    const [input] = nodes(tree, 'input');
    const [label] = nodes(tree, 'label');
    assert.equal(input.props.type, 'checkbox');
    assert.equal(input.props.checked, false);
    assert.equal(input.props.required, true);
    assert.equal(label.props.htmlFor, input.props.id);
    assert.equal(nodes(label, 'a').length, 0);
    const links = nodes(tree, 'a');
    assert.equal(links.length, variant === 'personalData' ? 2 : 1);
    assert.deepEqual(links.map(link => link.props.href), variant === 'personalData' ? ['/personal-data-consent', '/privacy'] : ['/offer']);
    for (const link of links) {
      assert.equal(link.props.target, '_blank');
      assert.equal(link.props.rel, 'noopener noreferrer');
      assert.equal(link.props.onClick, undefined);
    }
    assert.deepEqual(changes, []);
    input.props.onChange({ target: { checked: true } });
    assert.deepEqual(changes, [true]);
    assert.equal(nodes(ConsentCheckbox({ variant, checked: true, disabled: true, onChange() {} }), 'input')[0].props.disabled, true);
  }
});

test('cookie notice acknowledges once, and blocked localStorage never breaks rendering', () => {
  const saved = global.localStorage;
  try {
    const values = new Map();
    global.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    const { CookieBanner } = component('src/components/CookieBanner.tsx');
    assert.equal(nodes(CookieBanner(), 'aside').length, 1);
    nodes(CookieBanner(), 'button')[0].props.onClick();
    assert.equal(CookieBanner(), null);
    assert.equal(component('src/components/CookieBanner.tsx').CookieBanner(), null);
    global.localStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
    const blocked = component('src/components/CookieBanner.tsx').CookieBanner;
    assert.equal(nodes(blocked(), 'aside').length, 1);
    nodes(blocked(), 'button')[0].props.onClick();
    assert.equal(blocked(), null);
  } finally { if (saved === undefined) delete global.localStorage; else global.localStorage = saved; }
});

test('external Yandex map is absent until explicit load action', () => {
  const ContactsPage = component('src/app/(public)/contacts/page.tsx').default;
  assert.equal(nodes(ContactsPage(), 'iframe').length, 0);
  const load = nodes(ContactsPage(), 'button').find(button => button.props.children === 'Загрузить карту Яндекс');
  assert.ok(load);
  load.props.onClick();
  const maps = nodes(ContactsPage(), 'iframe');
  assert.equal(maps.length, 1);
  assert.match(maps[0].props.src, /^https:\/\/yandex.ru\/map-widget\//);
});
