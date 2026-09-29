import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { log } from '../config/logger';
import { publicInvoice, invoiceService, InvoiceError, invoiceReservationReleased } from '../services/invoice.service';
import { getOrderPaymentView } from '../services/orderPaymentView.service';

async function loadOwnedOrder(orderId: string, userId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { invoice: true, paymentAttempts: { take: 1 } },
  });
}

export const getInvoiceStateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) { res.status(401).json({ error: 'Необходима авторизация' }); return; }
    const order = await loadOwnedOrder(req.params.id, userId);
    if (!order) { res.status(404).json({ error: 'Заказ не найден' }); return; }
    const view = getOrderPaymentView(order, order.paymentAttempts[0] || null, order.invoice, {
      reservationReleased: await invoiceReservationReleased(order),
    });
    res.json({ payment: view, invoice: publicInvoice(order.invoice) });
  } catch (error) {
    log.error('Invoice state lookup failed', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Не удалось загрузить состояние оплаты' });
  }
};

export const requestInvoiceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) { res.status(401).json({ error: 'Необходима авторизация' }); return; }
    const invoice = await invoiceService.prepare(req.params.id, userId, req.body);
    const order = await loadOwnedOrder(req.params.id, userId);
    if (!order) { res.status(404).json({ error: 'Заказ не найден' }); return; }
    const view = getOrderPaymentView(order, order.paymentAttempts[0] || null, order.invoice || invoice, {
      reservationReleased: await invoiceReservationReleased(order),
    });
    res.status(invoice.documentStatus === 'issued' ? 200 : 202).json({
      success: true,
      payment: view,
      invoice: publicInvoice(order.invoice || invoice),
    });
  } catch (error) {
    if (error instanceof InvoiceError) {
      res.status(error.status).json({ code: error.code, error: error.message });
      return;
    }
    log.error('Invoice request failed', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ code: 'INVOICE_REQUEST_FAILED', error: 'Не удалось подготовить счёт' });
  }
};
