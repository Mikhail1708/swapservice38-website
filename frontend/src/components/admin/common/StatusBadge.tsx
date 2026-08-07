'use client';

interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'appointment';
}

const orderStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает оплаты', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Оплачен', color: 'bg-blue-100 text-blue-800' },
  confirmed: { label: 'Подтверждён', color: 'bg-green-100 text-green-800' },
  assembling: { label: 'Собирается', color: 'bg-purple-100 text-purple-800' },
  shipped: { label: 'Отправлен', color: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-800' },
};

const appointmentStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Подтверждена', color: 'bg-green-100 text-green-800' },
  in_progress: { label: 'Выполняется', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Выполнена', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Отменена', color: 'bg-red-100 text-red-800' },
};

export function StatusBadge({ status, type = 'order' }: StatusBadgeProps) {
  const map = type === 'order' ? orderStatusMap : appointmentStatusMap;
  const statusInfo = map[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
      {statusInfo.label}
    </span>
  );
}