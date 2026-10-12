"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productAvailability = void 0;
/** CRM stock already excludes reservations; never subtract them a second time. */
const productAvailability = (product) => {
    const value = product.availableStock ?? product.stock ?? 0;
    const availableStock = Number.isFinite(value) ? Math.max(0, value) : 0;
    return { availableStock, stock: availableStock, inStock: availableStock > 0,
        availabilityStatus: availableStock > 0 ? 'in_stock' : 'on_order' };
};
exports.productAvailability = productAvailability;
//# sourceMappingURL=productAvailability.js.map