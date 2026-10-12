"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockPaymentWorkflowOrder = void 0;
/** Serialize irreversible CRM/refund decisions for one order. */
const lockPaymentWorkflowOrder = async (tx, orderId) => {
    await tx.$queryRaw `SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
};
exports.lockPaymentWorkflowOrder = lockPaymentWorkflowOrder;
//# sourceMappingURL=paymentWorkflowLock.service.js.map