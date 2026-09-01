import { Prisma } from '@prisma/client';

/** Serialize irreversible CRM/refund decisions for one order. */
export const lockPaymentWorkflowOrder = async (
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> => {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
};
