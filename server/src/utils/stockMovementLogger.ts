import { prisma } from '../db.js';

/**
 * Record types for inventory stock movements.
 *
 * - **sale**: Items deducted when a sale is completed
 * - **restock**: Items added via batch restock
 * - **reconciliation**: Quantity adjusted during physical count
 * - **adjustment**: Manual correction (e.g., narcotic draw, flowsheet usage)
 * - **void**: Items returned when a sale is voided or deleted
 */
export type StockMovementType = 'sale' | 'restock' | 'reconciliation' | 'adjustment' | 'void';

export interface StockMovementParams {
    clinicId: string;
    itemId: string;
    type: StockMovementType;
    quantity: number;
    balanceAfter: number;
    reference?: string;
    note?: string;
    userId?: string;
}

/**
 * Creates a permanent stock movement record for inventory tracking.
 *
 * Every inventory mutation should produce exactly one movement log to
 * enable full auditability. The `balanceAfter` field records the item's
 * quantity *after* the mutation so that historical queries never need to
 * replay all transactions to determine past stock levels.
 *
 * **Note:** This function uses the global Prisma client, not a transaction
 * client. When called inside a `$transaction` block, the movement log
 * will be committed independently of the enclosing transaction.
 *
 * @param params - Stock movement details
 */
export const logStockMovement = async (params: StockMovementParams): Promise<void> => {
    try {
        await prisma.stockMovement.create({
            data: {
                clinicId: params.clinicId,
                itemId: params.itemId,
                type: params.type,
                quantity: params.quantity,
                balanceAfter: params.balanceAfter,
                reference: params.reference,
                note: params.note,
                userId: params.userId,
            },
        });
    } catch (error) {
        console.error('Failed to log stock movement:', error);
    }
};
