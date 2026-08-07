/**
 * Super admin management routes.
 * @module superadmin
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, superAdminOnly, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/auditLogger.js';

const router = Router();
const APP_BASE_URL = (process.env.FRONTEND_URL || process.env.APP_URL || 'https://app.albionpetclinic.com').replace(/\/$/, '');

const clinicSchema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    address: z.string().min(2).optional().or(z.literal('')),
    email: z.string().email(),
    phone: z.string().min(2).optional().or(z.literal('')),
    adminPassword: z.string().min(6),
    practiceType: z.string().min(2).optional().or(z.literal('')),
    country: z.string().optional(),
    language: z.string().optional(),
    currencySymbol: z.string().optional(),
    acronym: z.string().optional(),
    status: z.enum(['Active', 'Suspended']).default('Active')
});

const inviteSchema = z.object({
    clinicId: z.string().optional(),
    expiresInDays: z.number().default(7)
});

// Get all clinics with usage metrics
router.get('/clinics', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const clinics = await prisma.clinic.findMany({
            include: {
                _count: {
                    select: { 
                        users: true, 
                        clients: true,
                        sales: true,
                        appointments: true 
                    }
                },
                users: {
                    where: { roles: { has: 'Admin' } },
                    select: { email: true, name: true },
                    take: 1
                }
            }
        });

        // Calculate "Cloud Run Load" proxy based on 24h activity
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentActivity = await prisma.auditLog.groupBy({
            by: ['clinicId'],
            where: {
                timestamp: { gte: twentyFourHoursAgo },
                clinicId: { not: null }
            },
            _count: {
                _all: true
            }
        });

        const activityMap = new Map();
        recentActivity.forEach(a => activityMap.set(a.clinicId, a._count._all));

        const enhancedClinics = clinics.map(clinic => ({
            ...clinic,
            activity24h: activityMap.get(clinic.id) || 0
        }));

        res.json(enhancedClinics);
    } catch (error) {
        console.error('Failed to fetch clinics:', error);
        res.status(500).json({ error: 'Failed to fetch clinics' });
    }
});

// Get system-wide stats for Super Admin dashboard
router.get('/stats', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const [clinicCount, totalUsers, totalClients, storageUsage] = await prisma.$transaction([
            prisma.clinic.count(),
            prisma.user.count(),
            prisma.client.count(),
            prisma.clinic.aggregate({ _sum: { storageUsage: true } })
        ]);

        res.json({
            totalClinics: clinicCount,
            totalUsers,
            totalClients,
            totalStorageMB: storageUsage._sum.storageUsage || 0,
            dbStatus: 'Healthy',
            systemLoad: 'Normal' // Placeholder for real system metrics if available
        });
    } catch (error) {
        console.error('Failed to fetch system stats:', error);
        res.status(500).json({ error: 'Failed to fetch system statistics' });
    }
});

// Create a clinic
router.post('/clinics', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const data = clinicSchema.parse(req.body);

        // Check if admin user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered to another user' });
        }

        const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Create Clinic
            const clinic = await tx.clinic.create({
                data: {
                    name: data.name,
                    slug: data.slug,
                    address: data.address || null,
                    email: data.email,
                    phone: data.phone || null,
                    practiceType: data.practiceType || null,
                    status: data.status,
                    country: data.country || 'Nigeria',
                    language: data.language || 'English',
                    currencySymbol: data.currencySymbol || 'â‚¦',
                    acronym: data.acronym || data.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().substring(0, 3)
                }
            });

            // 2. Create Admin User
            const adminUser = await tx.user.create({
                data: {
                    email: data.email,
                    password: hashedPassword,
                    name: `${data.name} Admin`,
                    roles: ['Admin', 'Veterinarian'],
                    status: 'Active',
                    clinicId: clinic.id
                }
            });

            return { clinic, adminUser };
        });

        // Log this action
        await logAudit(req.user!.id, 'SuperAdmin', 'Clinic Creation', `Created clinic ${data.name} (Slug: ${data.slug}) and admin user ${data.email}`);

        res.status(201).json(result);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Clinic creation failed:', error);
        res.status(500).json({ error: 'Failed to create clinic and admin user', message: error.message });
    }
});

// Update a clinic
router.put('/clinics/:id', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const clinicData = req.body;

        const validatedData = clinicSchema.partial().parse(clinicData);
        const clinic = await prisma.clinic.update({
            where: { id: id as string },
            data: validatedData
        });

        // Log this action
        const action = validatedData.status ? `Status Update (${validatedData.status})` : 'Info Update';
        await logAudit(req.user!.id, 'SuperAdmin', 'Clinic Update', `${action} for clinic ${id}`);

        res.json(clinic);
    } catch (error: any) {
        console.error('Failed to update clinic:', error);
        res.status(500).json({ error: 'Failed to update clinic', message: error.message });
    }
});

// Delete a clinic
router.delete('/clinics/:id', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        await prisma.clinic.delete({ where: { id: id as string } });
        
        // Log this action
        await logAudit(req.user!.id, 'SuperAdmin', 'Clinic Deletion', `Permanently deleted clinic ID ${id}`);

        res.json({ message: 'Clinic deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete clinic' });
    }
});

// Generate one-time use registration link
router.post('/invites', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const { clinicId, expiresInDays } = inviteSchema.parse(req.body);
        const code = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const invite = await prisma.inviteLink.create({
            data: {
                clinicId,
                code,
                expiresAt
            }
        });

        res.status(201).json({
            ...invite,
            link: `${APP_BASE_URL}/?code=${code}`
        });

        // Log this action
        await logAudit(req.user!.id, 'SuperAdmin', 'Invite Generation', `Generated registration invite code for clinic ${clinicId || 'New Practice'}`);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate invite' });
    }
});

// Get all active invites
router.get('/invites', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const invites = await prisma.inviteLink.findMany({
            where: { isUsed: false, expiresAt: { gt: new Date() } },
            include: { clinic: { select: { name: true } } }
        });
        res.json(invites.map(invite => ({
            ...invite,
            link: `${APP_BASE_URL}/?code=${invite.code}`
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch invites' });
    }
});

// Get a single clinic with detailed stats
router.get('/clinics/:id', authenticate, superAdminOnly, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const clinic = await prisma.clinic.findUnique({
            where: { id: id as string },
            include: {
                _count: {
                    select: {
                        users: true,
                        clients: true,
                        inventoryItems: true,
                        procedures: true,
                        sales: true,
                        appointments: true,
                    }
                },
                users: {
                    where: { roles: { has: 'Admin' } },
                    select: { email: true, name: true },
                    take: 1
                }
            }
        });

        if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

        // Count patients across all clients of this clinic
        const patientCount = await prisma.patient.count({
            where: { owner: { clinicId: id as string } }
        });

        res.json({ ...clinic, patientCount });
    } catch (error) {
        console.error("Failed to fetch clinic details:", error);
        res.status(500).json({ error: 'Failed to fetch clinic details' });
    }
});

export default router;
