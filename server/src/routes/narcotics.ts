/**
 * Narcotics inventory tracking routes.
 * @module narcotics
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logStockMovement } from '../utils/stockMovementLogger.js';
import { z } from 'zod';

const narcoticLogSchema = z.object({
    itemId: z.string().uuid(),
    patientId: z.string().uuid().optional(),
    amountDrawn: z.number().positive(),
    wasteAmount: z.number().optional(),
    pin: z.string(),
    note: z.string().optional(),
});

const router = Router();

// Get all narcotic logs
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const logs = await prisma.narcoticLog.findMany({
            where: { clinicId },
            include: {
                user: { select: { name: true } },
                patient: { select: { name: true } },
                item: { select: { name: true } }
            },
            orderBy: { timestamp: 'desc' }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch narcotic logs' });
    }
});

// Create a narcotic log (requires PIN verification)
router.post('/log', authenticate, async (req: AuthRequest, res) => {
    const parsed = narcoticLogSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }
    const { itemId, patientId, amountDrawn, wasteAmount, pin, note } = parsed.data;
    const userId = req.user?.id as string;
    const clinicId = req.user?.clinicId as string;

    try {
        // Verify PIN
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user || !user.controlledPin || !(await bcrypt.compare(pin, user.controlledPin))) {
            return res.status(403).json({ error: 'Invalid narcotics access PIN' });
        }

        // Create log entry within a transaction to ensure both log and inventory update succeed
        const result = await prisma.$transaction(async (tx: any) => {
            // Fetch current balance first
            const item = await tx.inventoryItem.findUnique({
                where: { id: itemId },
                select: { name: true, quantity: true }
            });

            if (!item) throw new Error('Inventory item not found');

            const totalDeduction = amountDrawn + (wasteAmount || 0);
            const newBalance = item.quantity - totalDeduction;

            if (newBalance < 0) {
                throw new Error(`Insufficient stock for ${item.name}. Available: ${item.quantity}, Requested: ${totalDeduction}`);
            }

            const log = await tx.narcoticLog.create({
                data: {
                    clinicId,
                    itemId,
                    patientId: patientId || undefined,
                    userId,
                    amountDrawn,
                    wasteAmount: wasteAmount || 0,
                    balanceAfter: newBalance,
                    timestamp: new Date(),
                    reason: note || '',
                    authPinUsed: 'VERIFIED'
                }
            });

            // Deduct from inventory
            await tx.inventoryItem.update({
                where: { id: itemId },
                data: { quantity: newBalance }
            });

            // Stock movement log
            await logStockMovement({
                clinicId,
                itemId,
                type: 'adjustment',
                quantity: -totalDeduction,
                balanceAfter: newBalance,
                reference: `narcotic-${log.id}`,
                note: note || 'Narcotic draw',
                userId
            });

            // Audit Trail
            await tx.auditLog.create({
                data: {
                    userId,
                    userName: user.name,
                    clinicId,
                    module: 'NARCOTICS',
                    action: 'LOG_USAGE',
                    details: `Logged ${amountDrawn} units usage of ${item.name}. Balance: ${newBalance}`,
                    timestamp: new Date()
                }
            });

            return log;
        });

        res.json(result);
    } catch (error) {
        console.error('Narcotic logging failed:', error);
        res.status(500).json({ error: 'Failed to log narcotic usage' });
    }
});

export default router;
