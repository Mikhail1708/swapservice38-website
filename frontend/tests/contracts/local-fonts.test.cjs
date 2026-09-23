const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

test('Inter and Oswald retain weight ranges and use valid local WOFF2 assets', () => {
  const css = fs.readFileSync(path.join(root, 'src/app/fonts.css'), 'utf8');
  assert.match(css, /font-family: 'Inter';[\s\S]*?font-weight: 300 900;/);
  assert.match(css, /font-family: 'Oswald';[\s\S]*?font-weight: 400 700;/);
  const sources = [...css.matchAll(/url\(([^)]+)\)/g)].map(match => match[1]);
  assert.equal(sources.length, 12);
  for (const source of sources) {
    assert.match(source, /^\/fonts\/[a-z-]+\.woff2$/);
    const data = fs.readFileSync(path.join(root, 'public', source));
    assert.equal(data.toString('ascii', 0, 4), 'wOF2');
    assert.equal(data.readUInt32BE(8), data.length);
  }
  for (const family of ['inter', 'oswald']) {
    assert.match(fs.readFileSync(path.join(root, `public/fonts/${family}-OFL.txt`), 'utf8'), /SIL OPEN FONT LICENSE Version 1.1/);
    assert.ok(sources.includes(`/fonts/${family}-cyrillic.woff2`));
    assert.ok(sources.includes(`/fonts/${family}-latin.woff2`));
  }
});

test('entrypoint loads local font CSS and no remote font stylesheet', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const entry = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/app/fonts.css'), 'utf8');
  assert.doesNotMatch(html + css, /fonts\.(?:googleapis|gstatic)\.com/);
  assert.match(entry, /import '\.\/app\/fonts\.css'/);
  assert.match(css, /font-display: swap/);
  assert.match(css, /--font-oswald: 'Oswald'/);
});
