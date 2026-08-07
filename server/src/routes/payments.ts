/**
 * Payment verification and receipt management routes.
 *
 * Implements the three-state payment verification workflow:
 *   1. completed       — Immediate for cash/card payments
 *   2. pending_verification — Bank transfers enter this state
 *   3. verified/rejected   — Admin action resolves pending payments
 *
 * Also provides receipt upload (disk storage), client balance queries,
 * and a finance verification queue.
 *
 * @module payments
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// ---------------------------------------------------------------------------
// Multer configuration for receipt file uploads
// ---------------------------------------------------------------------------

const uploadsDir = path.join(__dirname, '../../uploads/receipts');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/** Stores receipt files to local disk with a random suffix to prevent guessing. */
const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`);
    },
});

/** Validates that uploaded file has an allowed extension. */
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only images (jpg, png, gif) and PDF files are allowed'));
        }
    },
});

/** Zod schema for payment rejection (requires a reason). */
const rejectSchema = z.object({
    reason: z.string().min(1, 'Rejection reason is required').max(500),
});

/** Builds a public URL path for a stored receipt file. */
const getReceiptUrl = (filename: string) => `/uploads/receipts/${filename}`;

// ---------------------------------------------------------------------------
// POST /:paymentId/receipt  —  Upload a receipt for a payment
// ---------------------------------------------------------------------------
router.post(
    '/:paymentId/receipt',
    authenticate,
    upload.single('receipt'),
    async (req: AuthRequest, res) => {
        try {
            const paymentId = req.params.paymentId as string;

            const payment = await prisma.payment.findFirst({
                where: { id: paymentId },
                include: { sale: { select: { clinicId: true } } },
            });

            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }

            // Enforce clinic-scoped access
            if (!req.user?.isSuperAdmin && payment.sale.clinicId !== req.user?.clinicId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'Receipt file is required' });
            }

            const receiptUrl = getReceiptUrl(req.file.filename);

            const updated = await prisma.payment.update({
                where: { id: paymentId },
                data: { receiptUrl },
            });

            await prisma.auditLog.create({
                data: {
                    clinicId: payment.sale.clinicId,
                    userId: req.user?.id as string,
                    userName: req.user?.name || 'System',
                    module: 'Finance',
                    action: 'Receipt Upload',
                    details: `Uploaded receipt for payment ${paymentId}`,
                },
            });

            res.json(updated);
        } catch (error: any) {
            console.error('Receipt upload error:', error);
            if (error.message?.includes('Only images')) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to upload receipt' });
        }
    },
);

// ---------------------------------------------------------------------------
// POST /:paymentId/verify  —  Verify a bank transfer (Admin only)
//
// Bank transfers are set to pending_verification by the pay endpoint.
// This action confirms the funds and updates the invoice status to
// Completed if fully paid. The sale's amountPaid/balanceDue are NOT
// modified here — they were already adjusted when the payment was created.
// ---------------------------------------------------------------------------
router.post(
    '/:paymentId/verify',
    authenticate,
    authorize('Admin'),
    async (req: AuthRequest, res) => {
        try {
            const paymentId = req.params.paymentId as string;

            const payment = await prisma.payment.findFirst({
                where: { id: paymentId, status: 'pending_verification' },
                include: {
                    sale: { select: { id: true, clinicId: true, invoiceNumber: true } },
                },
            });

            if (!payment) {
                return res
                    .status(404)
                    .json({ error: 'Pending payment not found or already processed' });
            }

            if (!req.user?.isSuperAdmin && payment.sale.clinicId !== req.user?.clinicId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const result = await prisma.$transaction(async (tx: any) => {
                // Mark the payment as verified
                const updatedPayment = await tx.payment.update({
                    where: { id: paymentId },
                    data: {
                        status: 'verified',
                        verifiedBy: req.user?.id,
                        verifiedAt: new Date(),
                    },
                });

                // Re-read sale inside transaction for accurate balance
                // The pay endpoint already incremented amountPaid/decremented balanceDue
                const sale = await tx.sale.findUnique({
                    where: { id: payment.sale.id },
                    select: { id: true, clinicId: true, invoiceNumber: true, balanceDue: true },
                });

                // If the invoice is now fully covered, mark it Completed
                if (sale.balanceDue <= 0.05) {
                    await tx.sale.update({
                        where: { id: sale.id },
                        data: { status: 'Completed' },
                    });
                }

                await tx.auditLog.create({
                    data: {
                        clinicId: sale.clinicId,
                        userId: req.user?.id as string,
                        userName: req.user?.name || 'System',
                        module: 'Finance',
                        action: 'Payment Verified',
                        details: `Verified payment of ${payment.amount} for invoice #${sale.invoiceNumber}`,
                    },
                });

                return updatedPayment;
            });

            res.json(result);
        } catch (error) {
            console.error('Payment verification error:', error);
            res.status(500).json({ error: 'Failed to verify payment' });
        }
    },
);

// ---------------------------------------------------------------------------
// POST /:paymentId/reject  —  Reject a pending bank transfer (Admin only)
//
// Reverses the payment's effect on the sale: amountPaid is decremented and
// balanceDue is incremented. The invoice status is recalculated based on
// remaining non-rejected payments.
// ---------------------------------------------------------------------------
router.post(
    '/:paymentId/reject',
    authenticate,
    authorize('Admin'),
    async (req: AuthRequest, res) => {
        try {
            const paymentId = req.params.paymentId as string;
            const { reason: rejectionReason } = rejectSchema.parse({
                reason: req.body.reason || 'Rejected by finance',
            });

            const payment = await prisma.payment.findFirst({
                where: { id: paymentId, status: 'pending_verification' },
                include: {
                    sale: { select: { id: true, clinicId: true, invoiceNumber: true } },
                },
            });

            if (!payment) {
                return res
                    .status(404)
                    .json({ error: 'Pending payment not found or already processed' });
            }

            if (!req.user?.isSuperAdmin && payment.sale.clinicId !== req.user?.clinicId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const result = await prisma.$transaction(async (tx: any) => {
                // Mark the payment as rejected
                const updatedPayment = await tx.payment.update({
                    where: { id: paymentId },
                    data: {
                        status: 'rejected',
                        verifiedBy: req.user?.id,
                        verifiedAt: new Date(),
                        rejectionReason,
                    },
                });

                // Reverse the payment's impact on the sale
                await tx.sale.update({
                    where: { id: payment.sale.id },
                    data: {
                        amountPaid: { decrement: payment.amount },
                        balanceDue: { increment: payment.amount },
                    },
                });

                // Recalculate invoice status based on remaining payments
                const updatedSale = await tx.sale.findUnique({
                    where: { id: payment.sale.id },
                    select: { balanceDue: true },
                });

                const saleStatus = updatedSale.balanceDue <= 0.05 ? 'Completed' : 'Pending';

                await tx.sale.update({
                    where: { id: payment.sale.id },
                    data: { status: saleStatus },
                });

                await tx.auditLog.create({
                    data: {
                        clinicId: payment.sale.clinicId,
                        userId: req.user?.id as string,
                        userName: req.user?.name || 'System',
                        module: 'Finance',
                        action: 'Payment Rejected',
                        details: `Rejected payment of ${payment.amount} for invoice #${payment.sale.invoiceNumber}. Reason: ${rejectionReason}`,
                    },
                });

                return updatedPayment;
            });

            res.json(result);
        } catch (error) {
            console.error('Payment rejection error:', error);
            res.status(500).json({ error: 'Failed to reject payment' });
        }
    },
);

// ---------------------------------------------------------------------------
// GET /pending  —  List payments awaiting verification (Finance queue)
//
// Returns all pending_verification payments scoped to the user's clinic.
// SuperAdmins see across all clinics. Oldest entries appear first.
// ---------------------------------------------------------------------------
router.get(
    '/pending',
    authenticate,
    authorize('Admin'),
    async (req: AuthRequest, res) => {
        try {
            const clinicId = req.user?.clinicId as string;

            const pendingPayments = await prisma.payment.findMany({
                where: {
                    status: 'pending_verification',
                    sale: req.user?.isSuperAdmin ? {} : { clinicId },
                },
                include: {
                    sale: {
                        select: {
                            id: true,
                            invoiceNumber: true,
                            total: true,
                            amountPaid: true,
                            balanceDue: true,
                            clientName: true,
                            createdAt: true,
                        },
                    },
                },
                orderBy: { date: 'asc' },
            });

            res.json(pendingPayments);
        } catch (error) {
            console.error('Fetch pending payments error:', error);
            res.status(500).json({ error: 'Failed to fetch pending payments' });
        }
    },
);

// ---------------------------------------------------------------------------
// GET /client-balance/:clientId  —  Get a client's outstanding balance
//
// Sums balanceDue across all non-voided/non-deleted invoices for the client.
// Returns the total outstanding and a breakdown of each invoice.
// ---------------------------------------------------------------------------
router.get('/client-balance/:clientId', authenticate, async (req: AuthRequest, res) => {
    try {
        const clientId = req.params.clientId as string;
        const clinicId = req.user?.clinicId as string;

        const client = await prisma.client.findFirst({
            where: { id: clientId, clinicId },
        });

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const sales = await prisma.sale.findMany({
            where: {
                clientId,
                status: { notIn: ['Voided', 'Deleted'] },
                balanceDue: { gt: 0 },
            },
            select: {
                id: true,
                invoiceNumber: true,
                total: true,
                amountPaid: true,
                balanceDue: true,
                createdAt: true,
                status: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const totalOutstanding = sales.reduce((sum, s) => sum + s.balanceDue, 0);

        res.json({
            clientId: client.id,
            clientName: `${client.firstName} ${client.lastName}`,
            totalOutstanding: Math.round(totalOutstanding * 100) / 100,
            invoices: sales,
        });
    } catch (error) {
        console.error('Client balance error:', error);
        res.status(500).json({ error: 'Failed to fetch client balance' });
    }
});

export default router;
