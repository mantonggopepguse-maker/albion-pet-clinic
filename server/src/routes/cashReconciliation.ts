/**
 * Cash reconciliation routes.
 *
 * Tracks physical cash in the till separate from electronic payment records.
 * Sales Reps record cash collected; Finance Managers reconcile entries to
 * verify the till balances. This is distinct from Payment records — it
 * tracks physical cash movements, not individual sale payments.
 *
 * @module cashReconciliation
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

/** Validates the shape of a new cash entry request. */
const createSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    method: z.string().optional().default('Cash'),
    source: z.string().optional().default('sales'),
    notes: z.string().optional(),
    saleId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /  —  Record cash collected (Sales Rep)
//
// Creates a new pending cash entry. A Finance Manager must later reconcile
// it to close the record. An audit trail is created immediately.
// ---------------------------------------------------------------------------
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const data = createSchema.parse(req.body);
        const clinicId = req.user?.clinicId as string;

        const entry = await prisma.cashReconciliation.create({
            data: {
                clinicId,
                recordedBy: req.user?.id as string,
                amount: data.amount,
                method: data.method,
                source: data.source,
                notes: data.notes,
                saleId: data.saleId || null,
                date: new Date(),
            },
        });

        await prisma.auditLog.create({
            data: {
                clinicId,
                userId: req.user?.id as string,
                userName: req.user?.name || 'System',
                module: 'Finance',
                action: 'Cash Collected',
                details: `Recorded ${data.amount} cash collected. Source: ${data.source}`,
            },
        });

        res.status(201).json(entry);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Cash reconciliation creation error:', error);
        res.status(500).json({ error: 'Failed to record cash collection' });
    }
});

// ---------------------------------------------------------------------------
// PUT /:id/reconcile  —  Mark cash as reconciled (Finance Manager)
//
// Validates the entry exists, belongs to the user's clinic, and hasn't
// already been reconciled. Updates the status and records who reconciled it.
// ---------------------------------------------------------------------------
router.put(
    '/:id/reconcile',
    authenticate,
    authorize('Admin'),
    async (req: AuthRequest, res) => {
        try {
            const entryId = req.params.id as string;
            const clinicId = req.user?.clinicId as string;

            const entry = await prisma.cashReconciliation.findFirst({
                where: { id: entryId, clinicId },
            });

            if (!entry) {
                return res.status(404).json({ error: 'Cash entry not found' });
            }

            if (entry.status === 'reconciled') {
                return res.status(400).json({ error: 'Cash entry already reconciled' });
            }

            const updated = await prisma.cashReconciliation.update({
                where: { id: entryId },
                data: {
                    status: 'reconciled',
                    reconciledBy: req.user?.id,
                    reconciledAt: new Date(),
                },
            });

            await prisma.auditLog.create({
                data: {
                    clinicId,
                    userId: req.user?.id as string,
                    userName: req.user?.name || 'System',
                    module: 'Finance',
                    action: 'Cash Reconciled',
                    details: `Reconciled ${entry.amount} cash (${entry.method}). Previously recorded by ${entry.recordedBy}`,
                },
            });

            res.json(updated);
        } catch (error) {
            console.error('Cash reconciliation error:', error);
            res.status(500).json({ error: 'Failed to reconcile cash' });
        }
    },
);

// ---------------------------------------------------------------------------
// GET /  —  List cash entries with optional status filter
//
// Returns paginated cash entries plus the aggregate total of all pending
// entries for the clinic — useful for the finance dashboard summary cards.
// ---------------------------------------------------------------------------
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const status = req.query.status as string | undefined;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const where: any = { clinicId };
        if (status) {
            where.status = status;
        }

        const [entries, total] = await Promise.all([
            prisma.cashReconciliation.findMany({
                where,
                orderBy: { date: 'desc' },
                take: limit,
                skip,
            }),
            prisma.cashReconciliation.count({ where }),
        ]);

        const pendingTotal = await prisma.cashReconciliation.aggregate({
            where: { clinicId, status: 'pending' },
            _sum: { amount: true },
        });

        res.json({
            entries,
            total,
            pendingTotal: pendingTotal._sum.amount || 0,
            page,
            limit,
        });
    } catch (error) {
        console.error('Fetch cash reconciliations error:', error);
        res.status(500).json({ error: 'Failed to fetch cash entries' });
    }
});

export default router;
