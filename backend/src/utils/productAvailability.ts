/** CRM stock already excludes reservations; never subtract them a second time. */
export const productAvailability = (product: { availableStock?: number; stock?: number }) => {
  const value = product.availableStock ?? product.stock ?? 0;
  const availableStock = Number.isFinite(value) ? Math.max(0, value) : 0;
  return { availableStock, stock: availableStock, inStock: availableStock > 0,
    availabilityStatus: availableStock > 0 ? 'in_stock' as const : 'on_order' as const };
};
