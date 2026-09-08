// backend/src/controllers/admin/dashboard.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { log } from '../../config/logger';

const prisma = new PrismaClient();

const startOfLocalDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const today = startOfLocalDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(today);
    const day = weekStart.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + mondayOffset);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const chartStart = new Date(today);
    chartStart.setDate(chartStart.getDate() - 6);

    // Payment truth lives in PaymentAttempt, not in the fulfillment/lifecycle Order.status.
    // A successful attempt that later becomes compensation_required/refunded stops matching this predicate.
    const successfullyPaidWhere = {
      paymentAttempts: { some: { status: 'succeeded' } },
    } as const;

    const [
      totalOrders,
      ordersToday,
      ordersWeek,
      ordersMonth,
      paidOrders,
      pendingOrders,
      revenueTotalAggregate,
      revenueMonthAggregate,
      totalUsers,
      newUsersWeek,
      newUsersMonth,
      chartOrders,
      groupedStatuses,
      recentOrders,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.order.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.count({ where: successfullyPaidWhere }),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.order.aggregate({ where: successfullyPaidWhere, _sum: { total: true } }),
      prisma.order.aggregate({
        where: { ...successfullyPaidWhere, createdAt: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.findMany({
        where: { createdAt: { gte: chartStart, lt: tomorrow } },
        select: { createdAt: true },
      }),
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          guestName: true,
          customerFirstName: true,
          customerLastName: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const dayCounts = new Map<string, number>();
    for (const order of chartOrders) {
      const date = startOfLocalDay(order.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    }

    const ordersByDay = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(chartStart);
      date.setDate(chartStart.getDate() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return { date: key, count: dayCounts.get(key) || 0 };
    });

    const statusDistribution = groupedStatuses.map((item) => ({
      status: item.status,
      count: item._count._all,
    }));

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
          total: revenueTotalAggregate._sum.total || 0,
          month: revenueMonthAggregate._sum.total || 0,
        },
        users: {
          total: totalUsers,
          newWeek: newUsersWeek,
          newMonth: newUsersMonth,
        },
      },
      charts: { ordersByDay, statusDistribution },
      recent: {
        orders: recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber || order.id.slice(0, 8),
          guestName: order.guestName || [order.customerLastName, order.customerFirstName].filter(Boolean).join(' ') || 'Гость',
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
        })),
      },
    });
  } catch (error: any) {
    log.error('Dashboard stats error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
};
