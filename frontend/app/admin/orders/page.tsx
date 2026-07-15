// frontend/app/admin/orders/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAdminTable } from '@/lib/hooks/useAdminTable';
import { OrdersTable } from '@/components/admin/orders/OrdersTable';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  total: number;
  status: string;
  createdAt: string;
}

export default function OrdersPage() {
  const router = useRouter();

  const {
    data: orders,
    total,
    page,
    totalPages,
    loading,
    error,
    goToPage,
  } = useAdminTable<Order>({
    url: '/api/admin/orders',
    limit: 20,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Заказы</h1>
        <p className="text-sm text-gray-500">Управление заказами</p>
      </div>

      <OrdersTable
        orders={orders}
        total={total}
        page={page}
        limit={20}
        totalPages={totalPages}
        onPageChange={goToPage}
      />
    </div>
  );
}