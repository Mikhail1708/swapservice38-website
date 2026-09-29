import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { renderInvoicePdf } from '../services/invoicePdf.service';

export async function downloadInvoicePdf(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'Необходима авторизация' }); return; }
  try {
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId }, include: { invoice: true } });
    if (!order) { res.status(404).json({ error: 'Заказ не найден' }); return; }
    if (order.invoice?.documentStatus !== 'issued' || !order.invoice.issuedAt) {
      res.status(409).json({ error: 'Счёт ещё не выпущен или отменён' }); return;
    }
    const pdf = await renderInvoicePdf(order.invoice);
    const filename = `invoice-${order.invoice.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch {
    res.status(500).json({ error: 'Не удалось сформировать счёт' });
  }
}
