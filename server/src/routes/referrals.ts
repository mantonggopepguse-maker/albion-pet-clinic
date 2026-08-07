/**
 * Referral management routes.
 * @module referrals
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/auditLogger.js';
import { z } from 'zod';
import { sanitizeInput } from '../utils/sanitize.js';

const referralSchema = z.object({
    submittingVetName: z.string().min(1),
    submittingClinic: z.string(),
    submittingEmail: z.string().email().optional().or(z.literal('')),
    submittingPhone: z.string(),
    patientName: z.string().min(1),
    patientSpecies: z.string(),
    patientBreed: z.string().optional(),
    patientAge: z.string().optional(),
    clientName: z.string(),
    history: z.string(),
    reasonForReferral: z.string(),
    urgency: z.string().optional(),
});

const router = Router();

// PUBLIC: Submit a referral
router.post('/submit/:clinicId', async (req, res) => {
    const { clinicId } = req.params;
    const parsed = referralSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }

    try {
        const referral = await prisma.referral.create({
            data: {
                clinicId,
                submittingVetName: sanitizeInput(parsed.data.submittingVetName),
                submittingClinic: parsed.data.submittingClinic,
                submittingEmail: parsed.data.submittingEmail || '',
                submittingPhone: parsed.data.submittingPhone,
                patientName: sanitizeInput(parsed.data.patientName),
                patientSpecies: parsed.data.patientSpecies,
                patientBreed: parsed.data.patientBreed || null,
                patientAge: parsed.data.patientAge || null,
                clientName: sanitizeInput(parsed.data.clientName),
                history: sanitizeInput(parsed.data.history),
                reasonForReferral: sanitizeInput(parsed.data.reasonForReferral),
                urgency: parsed.data.urgency || 'Routine',
                status: 'Pending'
            }
        });

        // Audit Log for the clinic
        await prisma.auditLog.create({
            data: {
                clinicId,
                userId: 'SYSTEM', // External submission
                userName: `Ext: ${parsed.data.submittingVetName}`,
                module: 'REFERRAL',
                action: 'SUBMIT',
                details: `Incoming referral for ${parsed.data.patientName} from ${parsed.data.submittingClinic}`,
                timestamp: new Date()
            }
        });

        res.json({ success: true, referralId: referral.id });
    } catch (error) {
        console.error('Referral submission failed:', error);
        res.status(500).json({ error: 'Failed to submit referral' });
    }
});

// PUBLIC: Get clinic name for the referral form
router.get('/clinic/:clinicId', async (req, res) => {
    try {
        const clinic = await prisma.clinic.findUnique({
            where: { id: req.params.clinicId },
            select: { name: true }
        });
        if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
        res.json({ name: clinic.name });
    } catch (error) {
        console.error('Failed to fetch clinic:', error);
        res.status(500).json({ error: 'Failed to fetch clinic' });
    }
});

// PRIVATE: Get all referrals for clinic
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ error: 'Clinic context required' });

        const referrals = await prisma.referral.findMany({
            where: { clinicId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(referrals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch referrals' });
    }
});

// Update referral status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const clinicId = req.user?.clinicId as string;

        // Verify referral belongs to this clinic
        const referral = await prisma.referral.findFirst({
            where: { id, clinicId }
        });

        if (!referral) {
            return res.status(404).json({ error: 'Referral not found' });
        }

        const updated = await prisma.referral.update({
            where: { id },
            data: { status: req.body.status }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'REFERRAL', 'UPDATE_STATUS', 
                `Updated referral ${id} status to ${req.body.status}`, clinicId, req.user.name);
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update referral status' });
    }
});

export default router;
