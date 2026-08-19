type OrderWithCustomer = {
  id: string;
  items: unknown;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerMiddleName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  guestName?: string | null;
  guestMiddleName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  contactMethod?: string | null;
  deliveryMethod?: string | null;
  deliveryAddress?: string | null;
  deliveryProvider?: string | null;
  comment?: string | null;
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
};

const normalizePhone = (value?: string | null): string => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
};

export const buildCrmOrderPayload = (order: OrderWithCustomer) => {
  const firstName = order.customerFirstName || order.guestName || order.user?.firstName || 'Клиент';
  const lastName = order.customerLastName || order.user?.lastName || '';
  const middleName = order.customerMiddleName || order.guestMiddleName || order.user?.middleName || '';
  const phone = normalizePhone(order.customerPhone || order.guestPhone || order.user?.phone);
  const email = order.customerEmail || order.guestEmail || order.user?.email || '';

  if (!phone) throw new Error('У заказа отсутствует телефон покупателя');

  return {
    externalOrderId: order.id,
    items: (order.items as any[]).map((item: any) => ({
      productId: typeof item.productId === 'string' ? Number.parseInt(item.productId, 10) : item.productId,
      quantity: item.quantity || 1,
      price: item.price || 0,
    })),
    client: {
      firstName,
      lastName,
      middleName,
      name: [lastName, firstName, middleName].filter(Boolean).join(' '),
      fullName: [lastName, firstName, middleName].filter(Boolean).join(' '),
      phone,
      email,
      address: order.deliveryAddress || '',
      preferredContact: order.contactMethod || 'phone',
    },
    deliveryMethod: order.deliveryMethod || 'pickup',
    deliveryAddress: order.deliveryAddress || '',
    deliveryProvider: order.deliveryProvider || '',
    contactMethod: order.contactMethod || 'phone',
    comment: order.comment || '',
    source: 'website' as const,
  };
};
