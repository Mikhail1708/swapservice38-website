// backend/src/controllers/admin/dashboard.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // ===== ЗАКАЗЫ =====
    const totalOrders = await prisma.order.count();
    const ordersToday = await prisma.order.count({
      where: { createdAt: { gte: today } },
    });
    const ordersWeek = await prisma.order.count({
      where: { createdAt: { gte: weekAgo } },
    });
    const ordersMonth = await prisma.order.count({
      where: { createdAt: { gte: monthAgo } },
    });
    const paidOrders = await prisma.order.count({
      where: { status: 'paid' },
    });
    const pendingOrders = await prisma.order.count({
      where: { status: 'pending' },
    });

    // ===== ВЫРУЧКА =====
    const allPaidOrders = await prisma.order.findMany({
      where: { status: 'paid' },
      select: { total: true },
    });
    const revenueTotal = allPaidOrders.reduce((sum, o) => sum + o.total, 0);

    const paidOrdersMonth = await prisma.order.findMany({
      where: {
        status: 'paid',
        createdAt: { gte: monthAgo },
      },
      select: { total: true },
    });
    const revenueMonth = paidOrdersMonth.reduce((sum, o) => sum + o.total, 0);

    // ===== ПОЛЬЗОВАТЕЛИ =====
    const totalUsers = await prisma.user.count();
    const newUsersWeek = await prisma.user.count({
      where: { createdAt: { gte: weekAgo } },
    });
    const newUsersMonth = await prisma.user.count({
      where: { createdAt: { gte: monthAgo } },
    });

    // ===== ДИНАМИКА ЗАКАЗОВ ПО ДНЯМ =====
    const ordersByDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await prisma.order.count({
        where: {
          createdAt: { gte: date, lt: nextDate },
        },
      });
      
      ordersByDay.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    // ===== РАСПРЕДЕЛЕНИЕ ПО СТАТУСАМ =====
    const allOrders = await prisma.order.findMany({
      select: { status: true },
    });
    const statusMap: Record<string, number> = {};
    allOrders.forEach((o) => {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;
    });
    const statusDistribution = Object.entries(statusMap).map(([status, count]) => ({
      status,
      count,
    }));

    // ===== ПОСЛЕДНИЕ ЗАКАЗЫ =====
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      stats: {
        orders: {
          total: totalOrders,
          today: ordersToday,
          week: ordersWeek,
          month: ordersMonth,
          paid: paidOrders,
          pending: pendingOrders,
        },
        revenue: {
          total: revenueTotal,
          month: revenueMonth,
        },
       
        users: {
          total: totalUsers,
          newWeek: newUsersWeek,
          newMonth: newUsersMonth,
        },
      },
      charts: {
        ordersByDay,
        statusDistribution,
      },
      recent: {
        orders: recentOrders.map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber || o.id.slice(0, 8),
          guestName: o.guestName || 'Гость',
          total: o.total,
          status: o.status,
          createdAt: o.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({ error: error.message || 'Ошибка получения статистики' });
  }
};