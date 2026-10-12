"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCrmOrderPayload = void 0;
const normalizePhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8'))
        return `7${digits.slice(1)}`;
    return digits;
};
const buildCrmOrderPayload = (order) => {
    const firstName = order.customerFirstName || order.guestName || order.user?.firstName || 'Клиент';
    const lastName = order.customerLastName || order.user?.lastName || '';
    const middleName = order.customerMiddleName || order.guestMiddleName || order.user?.middleName || '';
    const phone = normalizePhone(order.customerPhone || order.guestPhone || order.user?.phone);
    const email = order.customerEmail || order.guestEmail || order.user?.email || '';
    if (!phone)
        throw new Error('У заказа отсутствует телефон покупателя');
    return {
        externalOrderId: order.id,
        items: order.items.map((item) => ({
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
        source: 'website',
    };
};
exports.buildCrmOrderPayload = buildCrmOrderPayload;
//# sourceMappingURL=crmOrderPayload.service.js.map