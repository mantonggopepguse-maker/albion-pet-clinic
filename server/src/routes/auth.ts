/**
 * Staff authentication and registration routes.
 * @module auth
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { verifyFirebaseIdToken } from '../services/firebaseAdmin.js';
import { logAudit } from '../utils/auditLogger.js';
import { attemptClientLogin } from './clientAuth.js';

const router = Router();

const loginSchema = z.object({
    email: z.string().min(1), // Allow any identifier (email or username)
    password: z.string().min(6)
});

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
    roles: z.array(z.string()).min(1).optional(),
    username: z.string().min(2).max(50).optional()
});

const firebaseLoginSchema = z.object({
    idToken: z.string().min(20)
});

const getJwtSecret = () => {
    let secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET must be defined in production environment');
        }
        console.warn('WARNING: Using default JWT secret. This is insecure for production.');
        secret = 'default-secret-change-this';
    }
    return secret;
};

const signStaffSession = (user: any) => {
    const secret = getJwtSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles,
            clinicId: user.clinicId,
            isSuperAdmin: user.isSuperAdmin
        },
        secret as jwt.Secret,
        { expiresIn: expiresIn as any }
    );

    return {
        token,
        accountType: 'staff' as const,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles,
            status: user.status,
            clinicId: user.clinicId,
            isSuperAdmin: user.isSuperAdmin,
            clinic: user.clinic
        }
    };
};

const getStaffByIdentifier = async (identifier: string) => {
    return prisma.user.findFirst({
        where: {
            OR: [
                { email: identifier },
                { username: identifier }
            ]
        },
        include: {
            clinic: true
        }
    }) as any;
};

const attemptStaffLogin = async (identifier: string, password: string) => {
    const user = await getStaffByIdentifier(identifier);
    if (!user) {
        return { ok: false, statusCode: 401, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
    }

    if (user.status === 'Suspended') {
        return { ok: false, statusCode: 403, error: 'Account suspended. Please contact support.', code: 'SUSPENDED' };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        return { ok: false, statusCode: 401, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
    }

    return { ok: true, session: signStaffSession(user), user };
};

// Firebase Auth entry point. Firebase verifies identity; Postgres still owns clinic data.
router.post('/firebase-login', async (req, res) => {
    try {
        const { idToken } = firebaseLoginSchema.parse(req.body);
        const decoded = await verifyFirebaseIdToken(idToken);
        const normalizedEmail = decoded.email?.toLowerCase().trim();

        if (!normalizedEmail) {
            return res.status(400).json({ error: 'Firebase account has no email address', code: 'EMAIL_REQUIRED' });
        }

        const user = await getStaffByIdentifier(normalizedEmail);
        if (!user) {
            return res.status(404).json({
                error: 'No clinic workspace is linked to this email yet. Create your clinic account first.',
                code: 'POSTGRES_USER_NOT_FOUND',
            });
        }

        if (user.status === 'Suspended') {
            return res.status(403).json({
                error: 'Account suspended. Please contact support.',
                code: 'SUSPENDED',
            });
        }

        res.json(signStaffSession(user));
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Firebase login failed:', error);
        res.status(401).json({ error: 'Firebase sign in failed', code: 'FIREBASE_AUTH_FAILED' });
    }
});

// Shared login: one form that signs in either a staff member or a portal client.
// Staff accounts win on identifier+password match; otherwise we fall back to the client portal.
router.post('/shared-login', async (req, res) => {
    try {
        const { email: identifier, password } = loginSchema.parse(req.body);
        const normalizedIdentifier = identifier.toLowerCase().trim();

        const staffAttempt = await attemptStaffLogin(normalizedIdentifier, password);
        if (staffAttempt.ok) {
            return res.json(staffAttempt.session);
        }

        if (staffAttempt.code === 'SUSPENDED') {
            return res.status(403).json({ error: staffAttempt.error, code: staffAttempt.code });
        }

        const clientAttempt = await attemptClientLogin(normalizedIdentifier, password);
        if (clientAttempt.ok) {
            return res.json(clientAttempt.session);
        }

        res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Shared login failed:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email: identifier, password } = loginSchema.parse(req.body);
        const normalizedIdentifier = identifier.toLowerCase().trim();
        const staffAttempt = await attemptStaffLogin(normalizedIdentifier, password);
        if (!staffAttempt.ok) {
            const payload: any = { error: staffAttempt.error };
            if (staffAttempt.code) payload.code = staffAttempt.code;
            if ((staffAttempt as any).paymentUrl) payload.paymentUrl = (staffAttempt as any).paymentUrl;
            return res.status(staffAttempt.statusCode || 401).json(payload);
        }

        res.json(staffAttempt.session);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register new staff user (Admin or Super Admin only)
router.post('/register', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const { name, email, password, roles, username } = registerSchema.parse(req.body);

        // Only Super Admin can assign Admin role
        if (roles && roles.includes('Admin') && !req.user?.isSuperAdmin) {
            return res.status(403).json({ error: 'Only Super Admins can assign Admin role' });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() }
        });

        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                roles: roles || ['Veterinarian'],
                username: username || null,
                clinicId: req.user?.clinicId || null,
                status: 'Active'
            },
            select: {
                id: true,
                email: true,
                name: true,
                roles: true,
                status: true,
                clinicId: true,
                createdAt: true
            }
        });

        await logAudit(req.user!.id, 'AUTH', 'USER_CREATE', `Created user ${user.email} with roles ${user.roles.join(', ')}`);

        res.status(201).json({ user });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Email already registered' });
        }
        console.error('User registration error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// User Management (Protected)
router.get('/users', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const users = await prisma.user.findMany({
            where: req.user?.isSuperAdmin ? {} : { clinicId: req.user?.clinicId as string },
            select: {
                id: true,
                email: true,
                name: true,
                roles: true,
                status: true,
                createdAt: true,
                clinicId: true
            }
        }) as any[];
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.put('/users/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params as { id: string };
        const { name, roles, status } = req.body;

        // SECURITY: Prevent privilege escalation - only SuperAdmins can create/modify SuperAdmins
        if (roles && roles.includes('Admin') && !req.user?.isSuperAdmin) {
            return res.status(403).json({ error: 'Only Super Admins can assign Admin role' });
        }

        // Block any attempt to set isSuperAdmin via this route
        const sanitizedData: any = { name, status };
        if (roles) {
            sanitizedData.roles = roles;
        }

        const updated = await prisma.user.update({
            where: req.user?.isSuperAdmin ? { id: id as string } : { id: id as string, clinicId: req.user?.clinicId as string },
            data: sanitizedData,
            select: {
                id: true,
                email: true,
                name: true,
                roles: true,
                status: true,
                clinicId: true
            }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

router.delete('/users/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({
            where: req.user?.isSuperAdmin ? { id: id as string } : { id: id as string, clinicId: req.user?.clinicId as string }
        });
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
