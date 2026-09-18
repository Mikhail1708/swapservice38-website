import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import vm from 'vm';

describe('F30 process-wide Prisma client', () => {
  it('constructs once across services/middleware and preserves the email outbox alias', async () => {
    let db: any, getCart: any, constructor: jest.Mock;
    jest.isolateModules(() => {
      constructor = require('@prisma/client').PrismaClient;
      constructor.mockClear();
      db = require('../../../src/config/prisma').prisma;
      getCart = require('../../../src/services/cart.service').getCart;
      require('../../../src/middleware/auth.middleware');
      require('../../../src/services/orderCancellation.service');
      const outbox = require('../../../src/services/emailOutbox.service');
      expect(outbox.emailOutboxPrisma).toBe(db);
      expect(require('../../../src/config/prisma').prisma).toBe(db);
      expect(constructor).toHaveBeenCalledTimes(1);
    });
    const cart = { id: 'fixture-cart', items: [] };
    db.cart.findFirst.mockResolvedValueOnce(cart);
    expect(await getCart('fixture-user')).toEqual(expect.objectContaining({ id: 'fixture-cart' }));
    const error = new Error('fixture DB unavailable');
    db.cart.findFirst.mockRejectedValueOnce(error);
    await expect(getCart('fixture-user')).rejects.toBe(error);
    expect(constructor!).toHaveBeenCalledTimes(1);
  });

  it('all runtime Prisma constructors are owned by the shared module', () => {
    const root = path.resolve(__dirname, '../../../src');
    const constructors: string[] = [];
    function visitDirectory(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) { visitDirectory(file); continue; }
        if (!file.endsWith('.ts')) continue;
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        function visit(node: ts.Node) {
          if (ts.isNewExpression(node) && node.expression.getText(source).endsWith('PrismaClient')) constructors.push(path.relative(root, file).replace(/\\/g, '/'));
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    visitDirectory(root);
    // Old HEAD has 26 constructors: this fails on the original root cause.
    expect(constructors).toEqual(['config/prisma.ts']);
  });

  it('does not hide construction failure or create a fallback client', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../src/config/prisma.ts'), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const failure = new Error('fixture initialization failure');
    const constructor = jest.fn(() => { throw failure; });
    expect(() => vm.runInNewContext(compiled, { exports: {}, require: () => ({ PrismaClient: constructor }) })).toThrow(failure);
    expect(constructor).toHaveBeenCalledTimes(1);
  });
});
