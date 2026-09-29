import { downloadInvoicePdf } from '../../../src/controllers/invoicePdf.controller';
import { prisma } from '../../../src/config/prisma';
import { renderInvoicePdf } from '../../../src/services/invoicePdf.service';

jest.mock('../../../src/config/prisma', () => ({
  prisma: { order: { findFirst: jest.fn() } },
}));
jest.mock('../../../src/services/invoicePdf.service', () => ({
  renderInvoicePdf: jest.fn(),
}));

const db = prisma as any;
const render = renderInvoicePdf as jest.Mock;

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(), send: jest.fn() };
}

describe('invoice PDF ownership and state', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('does not return a foreign order PDF', async () => {
    db.order.findFirst.mockResolvedValue(null);
    const res = response();
    await downloadInvoicePdf({ user: { id: 'user-1' }, params: { id: 'foreign' } } as any, res as any);
    expect(db.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', userId: 'user-1' } }));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(render).not.toHaveBeenCalled();
  });

  it('returns only an issued owned invoice with safe PDF headers', async () => {
    db.order.findFirst.mockResolvedValue({ invoice: { id: 'BI/1', documentStatus: 'issued', issuedAt: new Date() } });
    render.mockResolvedValue(Buffer.from('%PDF-test'));
    const res = response();
    await downloadInvoicePdf({ user: { id: 'user-1' }, params: { id: 'order-1' } } as any, res as any);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="invoice-BI_1.pdf"');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('%PDF-test'));
  });
});
