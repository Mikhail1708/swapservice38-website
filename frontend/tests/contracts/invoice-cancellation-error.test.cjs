const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');

test('paid invoice 409 shows the business explanation, not HTTP status text', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/lib/api-error.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  const response = new Response(JSON.stringify({ code: 'BANK_INVOICE_ALREADY_PAID' }), { status: 409, statusText: 'Conflict' });
  assert.equal(await mod.exports.readApiError(response, 'Ошибка'), 'Оплата по счёту уже подтверждена. Для отмены оплаченного заказа свяжитесь с нами.');
});
