/** CRM stock already has active reservations deducted. */
export function productAvailability(product: { availableStock?: number; stock?: number }) {
  const value = product.availableStock ?? product.stock ?? 0;
  const availableStock = Number.isFinite(value) ? Math.max(0, value) : 0;
  return {
    availableStock,
    isOnOrder: availableStock <= 0,
    label: availableStock > 0 ? `В наличии: ${availableStock} шт.` : 'Под заказ',
  };
}
