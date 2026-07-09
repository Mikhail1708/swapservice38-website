// backend/src/controllers/admin/orders.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    console.log('📋 GET /api/admin/orders', { page: pageNum, limit: limitNum });

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.order.count(),
    ]);

    console.log(`✅ Найдено ${orders.length} заказов, всего ${total}`);

    res.json({
      orders: orders.map((o: any) => ({
        ...o,
        customerName: o.guestName || 'Гость',
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения заказов' });
  }
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ error: 'Заказ не найден' });
      return;
    }
    res.json({ order });
  } catch (error: any) {
    console.error('❌ Get order error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });
    res.json({ success: true, order });
  } catch (error: any) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.order.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Delete order error:', error);
    res.status(500).json({ error: error.message });
  }
};