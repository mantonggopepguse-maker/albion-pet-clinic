/**
 * Sales / POS route handlers.
 *
 * Covers the full sales lifecycle:
 *   - Sale creation (POS receipt or INVOICE) with inventory deduction
 *   - Invoice payment (cash/card immediate, bank transfer → pending_verification)
 *   - Void and soft-delete with inventory restoration
 *   - Duplicate payment and sale idempotency guards
 *
 * All inventory mutations are wrapped in Prisma $transaction and logged
 * via logStockMovement for full auditability.
 *
 * @module sales
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { logStockMovement } from '../utils/stockMovementLogger.js';

const router = Router();

/** Validates the shape of a void/delete reason. */
const auditLogSchema = z.object({
    reason: z.string().min(1),
});

/**
 * Invoice number validation regex.
 *
 * Must start with an alphanumeric character, followed by letters, numbers,
 * slashes, underscores, or hyphens. Prevents injection in invoice references.
 */
const invoiceNumberSchema = z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(
        /^[A-Za-z0-9][A-Za-z0-9/_-]*$/,
        'Invoice number can only contain letters, numbers, slash, underscore, or hyphen',
    );

/**
 * Normalizes an invoice number by trimming whitespace and validating.
 * Returns null for missing/empty values (triggers auto-generation).
 */
const normalizeInvoiceNumber = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return invoiceNumberSchema.parse(trimmed);
};

/** Checks if a Prisma error is a unique constraint violation (P2002). */
const isUniqueConstraintError = (error: any) => error?.code === 'P2002';

/**
 * Resolves an invoice number for a new sale.
 *
 * If `requestedInvoiceNumber` is provided, validates uniqueness.
 * Otherwise, auto-generates using the format `{5-digit-pad}/{clinic acronym}`
 * (e.g. `00001/VET`). Scans up to 1000 offsets to fill gaps caused by
 * rolled-back transactions.
 *
 * @param tx - Prisma transaction client
 * @param clinicId - Scoping clinic
 * @param requestedInvoiceNumber - Custom number or null for auto-generation
 * @returns A unique invoice number string
 * @throws {Error} statusCode 409 if custom number is taken
 */
const resolveInvoiceNumber = async (
    tx: any,
    clinicId: string,
    requestedInvoiceNumber: string | null,
): Promise<string> => {
    if (requestedInvoiceNumber) {
        const existing = await tx.sale.findFirst({
            where: { clinicId, invoiceNumber: requestedInvoiceNumber },
            select: { id: true },
        });
        if (existing) {
            const error: any = new Error(
                `Invoice number "${requestedInvoiceNumber}" is already in use.`,
            );
            error.statusCode = 409;
            throw error;
        }
        return requestedInvoiceNumber;
    }

    const clinic = await tx.clinic.findUnique({
        where: { id: clinicId },
        select: { acronym: true },
    });
    const acronym = clinic?.acronym || 'VET';
    const count = await tx.sale.count({ where: { clinicId } });

    // Scan forward from the current count to find a gap
    for (let offset = 1; offset <= 1000; offset++) {
        const candidate = `${(count + offset).toString().padStart(5, '0')}/${acronym}`;
        const existing = await tx.sale.findFirst({
            where: { clinicId, invoiceNumber: candidate },
            select: { id: true },
        });
        if (!existing) return candidate;
    }

    throw new Error('Could not generate a unique invoice number.');
};

// ---------------------------------------------------------------------------
// GET /  —  List all sales (paginated, clinic-scoped)
// ---------------------------------------------------------------------------
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const clientId = req.query.clientId as string | undefined;

        const where: any = req.user?.isSuperAdmin
            ? {}
            : { clinicId: req.user?.clinicId as string };
        if (clientId) {
            where.clientId = clientId;
        }

        const sales = await prisma.sale.findMany({
            where,
            take: limit,
            skip: skip,
            orderBy: { createdAt: 'desc' },
            include: {
                items: { include: { item: true } },
                payments: true,
            },
        });
        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// ---------------------------------------------------------------------------
// GET /:id  —  Get a single sale with items and payments
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const sale = await prisma.sale.findUnique({
            where: { id: req.params.id as string },
            include: {
                items: { include: { item: true } },
                payments: true,
            },
        });

        if (sale && !req.user?.isSuperAdmin && sale.clinicId !== req.user?.clinicId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        res.json(sale);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sale' });
    }
});

// ---------------------------------------------------------------------------
// POST /  —  Create a sale (POS receipt or INVOICE)
//
// Flow:
//   1. Validates items, client, clinic ownership
//   2. Deduplication: rejects identical sales within 60 seconds
//   3. Inside a transaction:
//      a. Resolves invoice number (custom or auto-generated with gap-filling)
//      b. Validates stock availability for all inventory items
//      c. Calculates server-side total and compares with payload (within 0.5)
//      d. Creates the Sale record with items and payments
//      e. Decrements inventory quantities and logs stock movements
//      f. Creates audit log entry
//   4. Retries on invoice-number collision (auto-generated only, up to 3 tries)
// ---------------------------------------------------------------------------
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        if (!req.user?.clinicId && !req.user?.isSuperAdmin) {
            return res.status(400).json({ error: 'User is not associated with a clinic' });
        }

        const {
            items,
            type,
            clientId,
            issuerId,
            issuerName,
            clientName,
            amountPaid,
            balanceDue,
            invoiceNumber: rawInvoiceNumber,
            payments: payloadPayments,
            ...data
        } = req.body;
        const requestedInvoiceNumber = normalizeInvoiceNumber(rawInvoiceNumber);

        // --- Payload validation ---
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items array is required and must not be empty' });
        }

        for (const item of items) {
            const itemId = item.itemId || item.id;
            const itemName = item.name || item.description;
            if (!itemId && !itemName) {
                return res
                    .status(400)
                    .json({ error: 'Each item must have an itemId/id or a name/description' });
            }
        }

        // Only superadmins can create sales for a different clinic
        const targetClinicId =
            req.user?.isSuperAdmin && req.body.clinicId
                ? req.body.clinicId
                : (req.user?.clinicId as string);

        let sanitizedClientId = clientId && clientId.trim() !== '' ? clientId : null;
        if (sanitizedClientId) {
            const clientExists = await prisma.client.findUnique({
                where: { id: sanitizedClientId },
            });
            if (!clientExists) {
                console.warn(`Client ${sanitizedClientId} not found; converting to guest sale.`);
                sanitizedClientId = null;
            }
        }

        // --- Idempotency: reject exact duplicate within 60 seconds ---
        const recentDuplicate = await prisma.sale.findFirst({
            where: {
                clinicId: targetClinicId,
                total: parseFloat(req.body.total),
                clientId: sanitizedClientId,
                createdAt: { gte: new Date(Date.now() - 60_000) },
            },
            include: { items: true },
        });

        if (recentDuplicate) {
            const isExactlySame =
                recentDuplicate.items.length === items.length &&
                recentDuplicate.items.every((ri: any) =>
                    items.find(
                        (i: any) =>
                            (i.itemId || i.id) === ri.itemId &&
                            (parseInt(i.quantity) || 1) === ri.quantity,
                    ),
                );

            if (isExactlySame) {
                return res.status(409).json({
                    error: 'A duplicate sale was detected. If you intended to make a new sale, please wait a minute or change the items.',
                });
            }
        }

        // --- Transaction with retry loop for invoice number collisions ---
        let result: any = null;
        const maxAttempts = requestedInvoiceNumber ? 1 : 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                result = await prisma.$transaction(
                    async (tx: any) => {
                        const invoiceNumber = await resolveInvoiceNumber(
                            tx,
                            targetClinicId,
                            requestedInvoiceNumber,
                        );

                        // Compute server-side total from line items
                        let serverCalculatedTotal = 0;
                        for (const item of items) {
                            const itemId = item.itemId || item.id;
                            const requestedQty = parseInt(item.quantity) || 1;

                            if (!itemId) {
                                // Freestyle item — trust payload price
                                const unitPrice = parseFloat(
                                    item.pricePerUnit || item.price || item.unitPrice || 0,
                                );
                                serverCalculatedTotal += unitPrice * requestedQty;
                                continue;
                            }

                            const inventoryItem = await tx.inventoryItem.findUnique({
                                where: { id: itemId },
                            });
                            if (!inventoryItem) {
                                throw new Error(
                                    `Item "${item.name || itemId}" not found in inventory.`,
                                );
                            }
                            if (inventoryItem.quantity < requestedQty) {
                                throw new Error(
                                    `Insufficient stock for "${inventoryItem.name}". Available: ${inventoryItem.quantity}, Requested: ${requestedQty}`,
                                );
                            }

                            const unitPrice = parseFloat(
                                item.pricePerUnit ||
                                    item.price ||
                                    item.unitPrice ||
                                    inventoryItem.retailPrice ||
                                    0,
                            );
                            serverCalculatedTotal += unitPrice * requestedQty;
                        }

                        // Resolve procedure IDs by name for backward compatibility
                        const procedures = await tx.procedure.findMany({
                            where: { clinicId: targetClinicId },
                        });
                        const procedureNameMap = new Map<string, string>();
                        procedures.forEach((p: any) =>
                            procedureNameMap.set(p.name.toLowerCase(), p.id),
                        );

                        const preparedItems = items.map((item: any) => {
                            const name = item.name || item.description || '';
                            const lowerName = name.toLowerCase();
                            let foundProcedureId: string | null = null;

                            if (item.procedureId) foundProcedureId = item.procedureId;
                            else if (!item.itemId && procedureNameMap.has(lowerName)) {
                                foundProcedureId = procedureNameMap.get(lowerName)!;
                            }

                            return { ...item, procedureId: foundProcedureId };
                        });

                        // Validate total (allow small float tolerance)
                        const payloadTotal = parseFloat(req.body.total);
                        const discount = parseFloat(req.body.discount) || 0;
                        const tax = parseFloat(req.body.tax) || 0;
                        const expectedTotal = serverCalculatedTotal - discount + tax;

                        if (Math.abs(payloadTotal - expectedTotal) > 0.5) {
                            throw new Error(
                                `Payment verification failed. Please refresh and try again. (Validation mismatch: ${payloadTotal} vs ${expectedTotal})`,
                            );
                        }

                        // Determine sale status
                        const parsedBalanceDue = parseFloat(balanceDue) || 0;
                        let saleStatus = 'Completed';
                        if (type === 'INVOICE' && parsedBalanceDue > 0.05) {
                            saleStatus = 'Pending';
                        }

                        // Determine payment statuses (bank transfers → pending_verification)
                        const getPaymentStatus = (method: string): string => {
                            const transferMethods = [
                                'Bank Transfer',
                                'TRANSFER',
                                'bank_transfer',
                            ];
                            return transferMethods.includes(method)
                                ? 'pending_verification'
                                : 'completed';
                        };

                        let paymentsCreateData: any = undefined;
                        if (
                            payloadPayments &&
                            Array.isArray(payloadPayments) &&
                            payloadPayments.length > 0
                        ) {
                            paymentsCreateData = {
                                create: payloadPayments.map((p: any) => ({
                                    amount: parseFloat(p.amount),
                                    method: p.method || 'Cash',
                                    status: getPaymentStatus(p.method || 'Cash'),
                                    recordedBy: issuerName || 'System',
                                })),
                            };
                        } else if (parseFloat(amountPaid) > 0) {
                            const paymentMethod = req.body.paymentMethod || 'Cash';
                            paymentsCreateData = {
                                create: {
                                    amount: parseFloat(amountPaid),
                                    method: paymentMethod,
                                    status: getPaymentStatus(paymentMethod),
                                    recordedBy: issuerName || 'System',
                                },
                            };
                        }

                        // 1. Create the Sale record
                        const sale = await tx.sale.create({
                            data: {
                                ...data,
                                invoiceNumber,
                                type,
                                status: saleStatus,
                                clinicId: targetClinicId,
                                clientId: sanitizedClientId,
                                clientName: clientName || null,
                                amountPaid: parseFloat(amountPaid) || 0,
                                balanceDue: parsedBalanceDue,
                                issuerName: issuerName || null,
                                paymentMethod:
                                    payloadPayments && payloadPayments.length > 0
                                        ? 'SPLIT'
                                        : req.body.paymentMethod || 'Cash',
                                items: {
                                    create: preparedItems.map((item: any) => ({
                                        itemId: item.itemId || item.id || null,
                                        procedureId: item.procedureId || null,
                                        name: item.name || item.description || null,
                                        quantity: parseInt(item.quantity) || 1,
                                        pricePerUnit: parseFloat(
                                            item.pricePerUnit ||
                                                item.price ||
                                                item.unitPrice ||
                                                0,
                                        ),
                                    })),
                                },
                                payments: paymentsCreateData,
                            },
                            include: { items: { include: { item: true } }, payments: true },
                        });

                        // 2. Deduct inventory for items with an itemId
                        for (const item of items) {
                            const inventoryId = item.itemId || item.id;
                            if (!inventoryId) continue;

                            const qty = parseInt(item.quantity) || 1;
                            const beforeItem = await tx.inventoryItem.findUnique({
                                where: { id: inventoryId },
                            });

                            await tx.inventoryItem.update({
                                where: { id: inventoryId },
                                data: {
                                    quantity: { decrement: qty },
                                    sales: { increment: qty },
                                },
                            });

                            const balanceAfter = (beforeItem?.quantity || 0) - qty;
                            await logStockMovement({
                                clinicId: targetClinicId,
                                itemId: inventoryId,
                                type: 'sale',
                                quantity: -qty,
                                balanceAfter,
                                reference: invoiceNumber,
                                note: `Sale #${invoiceNumber}`,
                                userId: req.user?.id,
                            });
                        }

                        // 3. Audit trail
                        await tx.auditLog.create({
                            data: {
                                clinicId: targetClinicId,
                                userId: req.user?.id as string,
                                userName: req.user?.name as string,
                                module: 'Sales',
                                action: 'CREATE',
                                details: `Created ${sale.type} #${sale.invoiceNumber} for total ${sale.total}`,
                            },
                        });

                        return sale;
                    },
                    { maxWait: 10000, timeout: 30000 },
                );
                break;
            } catch (txError: any) {
                if (
                    !requestedInvoiceNumber &&
                    isUniqueConstraintError(txError) &&
                    attempt < maxAttempts
                ) {
                    console.warn(
                        `Invoice number collision on attempt ${attempt}; retrying sale creation.`,
                    );
                    continue;
                }
                console.error('Transaction failed:', txError);
                throw txError;
            }
        }

        if (!result) {
            throw new Error('Failed to create sale after retrying invoice number generation.');
        }

        res.status(201).json(result);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res
                .status(400)
                .json({ error: 'Invalid invoice number', details: error.errors });
        }
        if (error.statusCode === 409) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Sale creation error details:', {
            message: error.message,
            stack: error.stack,
            body: req.body,
        });
        res.status(500).json({ error: 'Failed to create sale', details: error.message });
    }
});

// ---------------------------------------------------------------------------
// PUT /:id/void  —  Void a sale (restores inventory, preserves record)
//
// Reverses all inventory deductions and marks the sale as Voided.
// Prevents double-voiding and rejects if already Deleted.
// ---------------------------------------------------------------------------
router.put('/:id/void', authenticate, async (req: AuthRequest, res) => {
    try {
        const { reason } = auditLogSchema.parse(req.body);
        const sale = await prisma.sale.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            include: { items: true },
        });

        if (!sale) return res.status(404).json({ error: 'Sale not found' });

        await prisma.$transaction(async (tx: any) => {
            // Re-read status inside transaction for race safety
            const current = await tx.sale.findUnique({
                where: { id: sale.id },
                select: { status: true },
            });
            if (current.status === 'Voided' || current.status === 'Deleted') {
                throw new Error('Sale is already voided or deleted');
            }

            // Restore inventory for each item
            for (const item of sale.items) {
                if (!item.itemId) continue;

                const beforeItem = await tx.inventoryItem.findUnique({
                    where: { id: item.itemId },
                });
                await tx.inventoryItem.update({
                    where: { id: item.itemId },
                    data: {
                        quantity: { increment: item.quantity },
                        sales: { decrement: item.quantity },
                    },
                });
                await logStockMovement({
                    clinicId: sale.clinicId,
                    itemId: item.itemId,
                    type: 'void',
                    quantity: item.quantity,
                    balanceAfter: (beforeItem?.quantity || 0) + item.quantity,
                    reference: sale.invoiceNumber,
                    note: `Voided sale #${sale.invoiceNumber}`,
                    userId: req.user?.id,
                });
            }

            await tx.sale.update({
                where: { id: sale.id },
                data: { status: 'Voided' },
            });

            await tx.auditLog.create({
                data: {
                    clinicId: sale.clinicId,
                    userId: req.user?.id as string,
                    userName: req.user?.name as string,
                    module: 'Sales',
                    action: 'Void Transaction',
                    details: `Voided ${sale.type} #${sale.invoiceNumber}. Reason: ${reason}`,
                },
            });
        });

        res.json({ message: 'Transaction voided successfully' });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res
                .status(400)
                .json({ error: 'Reason is required', details: error.errors });
        }
        if (error.message?.includes('already voided or deleted')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to void transaction' });
    }
});

// ---------------------------------------------------------------------------
// DELETE /:id  —  Soft-delete a sale (Admin only)
//
// Restores inventory (unless already voided/deleted), creates an audit
// trail with the provided reason, and marks the sale as 'Deleted'.
// The record is preserved in the database for historical reference.
// ---------------------------------------------------------------------------
router.delete('/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const reason = (req.body.reason || req.query.reason) as string;

        if (!reason) {
            return res.status(400).json({ error: 'Reason is required for deletion' });
        }

        const sale = await prisma.sale.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            include: { items: true },
        });

        if (!sale) return res.status(404).json({ error: 'Sale not found' });

        await prisma.$transaction(async (tx: any) => {
            const current = await tx.sale.findUnique({
                where: { id: sale.id },
                select: { status: true },
            });

            // Only restore inventory if not previously voided/deleted
            if (current.status !== 'Voided' && current.status !== 'Deleted') {
                for (const item of sale.items) {
                    if (!item.itemId) continue;

                    const beforeItem = await tx.inventoryItem.findUnique({
                        where: { id: item.itemId },
                        select: { quantity: true },
                    });

                    await tx.inventoryItem.update({
                        where: { id: item.itemId },
                        data: {
                            quantity: { increment: item.quantity },
                            sales: { decrement: item.quantity },
                        },
                    });

                    await logStockMovement({
                        clinicId: sale.clinicId,
                        itemId: item.itemId,
                        type: 'void',
                        quantity: item.quantity,
                        balanceAfter: (beforeItem?.quantity || 0) + item.quantity,
                        reference: sale.invoiceNumber,
                        note: `Deleted sale #${sale.invoiceNumber}`,
                        userId: req.user?.id,
                    });
                }
            }

            await tx.auditLog.create({
                data: {
                    clinicId: sale.clinicId,
                    userId: req.user?.id as string,
                    userName: req.user?.name as string,
                    module: 'Sales',
                    action: 'Delete Transaction',
                    details: `Deleted ${sale.type} #${sale.invoiceNumber}. Reason: ${reason}`,
                },
            });

            // Soft delete
            await tx.sale.update({
                where: { id: sale.id },
                data: { status: 'Deleted' },
            });
        });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

// ---------------------------------------------------------------------------
// POST /:id/pay  —  Record a payment against an invoice
//
// Flow (all inside a $transaction):
//   1. Re-reads sale + payments for race-safe validation
//   2. Validates payment doesn't exceed balance due
//   3. Prevents duplicate full payments (rejects if total >= sale total)
//   4. Adjusts sale.amountPaid / balanceDue
//   5. Creates the Payment record
//      - Cash/Card → status = 'completed', auto-marks invoice Completed
//      - Bank Transfer → status = 'pending_verification' (requires admin verify)
//   6. Creates audit log entry
// ---------------------------------------------------------------------------
router.post('/:id/pay', authenticate, async (req: AuthRequest, res) => {
    try {
        const sale = await prisma.sale.findFirst({
            where: req.user?.isSuperAdmin
                ? { id: req.params.id as string }
                : { id: req.params.id as string, clinicId: req.user?.clinicId as string },
            include: { payments: true },
        });

        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        if (sale.type !== 'INVOICE')
            return res.status(400).json({ error: 'Transaction is not an invoice' });

        const paymentAmount = parseFloat(req.body.amount);
        const method = req.body.paymentMethod || 'Cash';

        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return res.status(400).json({ error: 'Invalid payment amount' });
        }

        const result = await prisma.$transaction(async (tx: any) => {
            // Re-read inside transaction for accurate, race-safe state
            const freshSale = await tx.sale.findUnique({
                where: { id: sale.id },
                include: { payments: true },
            });

            if (!freshSale) throw new Error('Sale not found');

            if (paymentAmount > freshSale.balanceDue + 0.05) {
                const err: any = new Error('Payment amount cannot exceed balance due');
                err.statusCode = 400;
                throw err;
            }

            // Duplicate full-payment guard inside transaction
            const existingPayments = freshSale.payments.filter(
                (p: any) => p.status !== 'rejected',
            );
            const totalAlreadyPaid = existingPayments.reduce(
                (sum: number, p: any) => sum + p.amount,
                0,
            );
            if (totalAlreadyPaid >= freshSale.total - 0.05) {
                const err: any = new Error(
                    'Invoice is already fully paid. Duplicate payment prevented.',
                );
                err.statusCode = 409;
                throw err;
            }

            const newAmountPaid = (freshSale.amountPaid || 0) + paymentAmount;
            let newBalanceDue = freshSale.total - newAmountPaid;
            newBalanceDue = Math.round(newBalanceDue * 100) / 100;

            let newStatus = freshSale.status;
            let paymentStatus = 'completed';

            // Bank transfers require finance manager verification
            if (method === 'Bank Transfer' || method === 'TRANSFER') {
                paymentStatus = 'pending_verification';
            }

            if (newBalanceDue <= 0.05) {
                newBalanceDue = 0;
                if (paymentStatus === 'completed') {
                    newStatus = 'Completed';
                }
            }

            const updated = await tx.sale.update({
                where: { id: sale.id },
                data: {
                    status: newStatus,
                    amountPaid: newAmountPaid,
                    balanceDue: newBalanceDue,
                    payments: {
                        create: {
                            amount: paymentAmount,
                            method: method,
                            reference: req.body.reference || null,
                            status: paymentStatus,
                            recordedBy: req.user?.name || 'System',
                        },
                    },
                },
                include: { items: { include: { item: true } }, payments: true },
            });

            await tx.auditLog.create({
                data: {
                    clinicId: freshSale.clinicId,
                    userId: req.user?.id as string,
                    userName: req.user?.name as string,
                    module: 'Sales',
                    action: 'Payment',
                    details: `Received ${paymentStatus === 'pending_verification' ? 'pending ' : ''}payment of ${paymentAmount} for invoice #${freshSale.invoiceNumber}. Method: ${method}. New Balance: ${newBalanceDue}`,
                },
            });

            return updated;
        });

        res.json(result);
    } catch (error: any) {
        console.error('Payment error:', error);
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to process payment' });
    }
});

export default router;
