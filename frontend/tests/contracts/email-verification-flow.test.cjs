const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('login EMAIL_UNVERIFIED state links to the dedicated verification flow', () => {
  const loginPage = read('src/app/(auth)/login/page.tsx');
  assert.match(loginPage, /payload\?\.code === 'EMAIL_UNVERIFIED'/);
  assert.match(loginPage, /href=\{`\/verify-email\?token=/);
  assert.match(loginPage, /returnUrl=/);
});

test('verify-email uses the existing API, refreshes auth, and redirects safely', () => {
  const verifyPage = read('src/app/(auth)/verify/page.tsx');
  const apiCall = verifyPage.indexOf("fetchWithCsrf('/api/auth/verify'");
  const refresh = verifyPage.indexOf('await refresh()', apiCall);
  const redirect = verifyPage.indexOf('router.replace(destination)');

  assert.ok(apiCall >= 0, 'verification API call is present');
  assert.ok(refresh > apiCall, 'auth refresh happens after verification');
  assert.ok(redirect >= 0, 'success effect redirects');
  assert.ok(verifyPage.indexOf('setSuccess(true)', refresh) > refresh, 'success is set after auth refresh');
  assert.match(verifyPage, /if \(!success\) return/);
  assert.match(verifyPage, /getSafeInternalRedirect/);
  assert.match(verifyPage, /autoComplete="one-time-code"/);
  assert.match(verifyPage, /replace\(\/\\D\/g, ''\)\.slice\(0, 6\)/);
  assert.match(verifyPage, /Неверный или просроченный код/);
});

test('registration and app routing use /verify-email', () => {
  const registerPage = read('src/app/(auth)/register/page.tsx');
  const app = read('src/App.tsx');

  assert.match(registerPage, /router\.push\(`\/verify-email\?token=/);
  assert.match(app, /path="\/verify-email"/);
});

test('verification link resolves server-masked identity and resends using its token', () => {
  const page = read('src/app/(auth)/verify/page.tsx');
  assert.match(page, /fetchWithCsrf\('\/api\/auth\/verification-context'/);
  assert.match(page, /context\?\.maskedEmail/);
  assert.match(page, /\{maskedEmail\}/);
  assert.match(page, /token \? \{ token \} : \{ email: verificationEmail \}/);
  assert.match(page, /token \? \{ token, code \} : \{ email: verificationEmail, code \}/);
  assert.match(page, /data\.alreadyVerified/);
  assert.match(page, /data\.codeExpired/);
  assert.match(page, /response\.status === 429/);
  assert.match(page, /!token && !success/);
  for (const file of ['src/app/(auth)/register/page.tsx', 'src/app/(auth)/login/page.tsx', 'src/components/email-verification-banner.tsx']) {
    assert.doesNotMatch(read(file), /verify-email\?email=/);
  }
});
