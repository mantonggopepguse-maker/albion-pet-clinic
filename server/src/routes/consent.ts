/**
 * Consent form management routes.
 * @module consent
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const consentSchema = z.object({
  patientId: z.string().min(1),
  clientId: z.string().min(1),
  type: z.string().min(1),
  content: z.string().min(1),
});

const router = Router();

// POST /api/consent — create a consent form (staff side; mounted at /api/consent)
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const parsed = consentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        }
        const { patientId, clientId, type, content } = parsed.data;
        const clinicId = req.user?.clinicId;

        if (!clinicId) return res.status(403).json({ error: 'Clinic context required' });

        const form = await prisma.consentForm.create({
            data: {
                clinicId,
                patientId,
                clientId,
                type,
                content,
                status: 'Pending'
            }
        });

        res.json(form);
    } catch (error) {
        console.error('Consent Creation Error:', error);
        res.status(500).json({ error: 'Failed to create consent form' });
    }
});

export default router;
