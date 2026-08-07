import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.js';

const mockSign = vi.hoisted(() => vi.fn(() => 'signed-token'));
vi.mock('jsonwebtoken', () => ({
    default: { sign: mockSign, verify: vi.fn() },
    sign: mockSign,
    verify: vi.fn(),
}));

const mockBcryptCompare = vi.hoisted(() => vi.fn());
vi.mock('bcryptjs', () => ({
    default: { compare: mockBcryptCompare, hash: vi.fn() },
    compare: mockBcryptCompare,
    hash: vi.fn(),
}));

const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockClientFindFirst = vi.hoisted(() => vi.fn());
const mockClientUpdate = vi.hoisted(() => vi.fn());
vi.mock('../db.js', () => ({
    prisma: {
        user: { findFirst: mockUserFindFirst },
        client: {
            findFirst: mockClientFindFirst,
            update: mockClientUpdate,
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        portalInvite: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    },
}));

vi.mock('../services/firebaseAdmin.js', () => ({
    verifyFirebaseIdToken: vi.fn(),
}));

const staffUser = {
    id: 'staff-1',
    email: 'doctor@clinic.com',
    name: 'Dr. Good',
    username: null,
    roles: ['Veterinarian'],
    status: 'Active',
    clinicId: 'clinic-1',
    isSuperAdmin: false,
    password: 'hashed-staff-password',
    clinic: { id: 'clinic-1', name: 'Clinic One' },
};

const portalClient = {
    id: 'client-1',
    clinicId: 'clinic-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    password: 'hashed-client-password',
    isPortalEnabled: true,
    portalPasswordMustChange: false,
};

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    return app;
}

describe('POST /api/auth/shared-login', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        mockBcryptCompare.mockResolvedValue(true);
    });

    it('signs in a staff member and returns a staff session', async () => {
        mockUserFindFirst.mockResolvedValue(staffUser);
        mockClientFindFirst.mockResolvedValue(null);

        const res = await request(buildApp())
            .post('/api/auth/shared-login')
            .send({ email: 'doctor@clinic.com', password: 'secret1' });

        expect(res.status).toBe(200);
        expect(res.body.accountType).toBe('staff');
        expect(res.body.token).toBe('signed-token');
        expect(res.body.user).toMatchObject({ id: 'staff-1', email: 'doctor@clinic.com' });
    });

    it('falls back to the client portal when no staff account matches', async () => {
        mockUserFindFirst.mockResolvedValue(null);
        mockClientFindFirst.mockResolvedValue(portalClient);
        mockClientUpdate.mockResolvedValue(portalClient);

        const res = await request(buildApp())
            .post('/api/auth/shared-login')
            .send({ email: 'jane@example.com', password: 'secret1' });

        expect(res.status).toBe(200);
        expect(res.body.accountType).toBe('client');
        expect(res.body.token).toBe('signed-token');
        expect(res.body.client).toMatchObject({ id: 'client-1', firstName: 'Jane' });
        expect(mockClientUpdate).toHaveBeenCalled();
    });

    it('returns 401 when neither staff nor client credentials match', async () => {
        mockUserFindFirst.mockResolvedValue(null);
        mockClientFindFirst.mockResolvedValue(null);

        const res = await request(buildApp())
            .post('/api/auth/shared-login')
            .send({ email: 'nobody@example.com', password: 'secret1' });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    });

    it('returns 403 for suspended staff without falling through to client', async () => {
        mockUserFindFirst.mockResolvedValue({ ...staffUser, status: 'Suspended' });

        const res = await request(buildApp())
            .post('/api/auth/shared-login')
            .send({ email: 'doctor@clinic.com', password: 'secret1' });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('SUSPENDED');
        expect(mockClientFindFirst).not.toHaveBeenCalled();
    });

    it('rejects invalid payloads with 400', async () => {
        const res = await request(buildApp())
            .post('/api/auth/shared-login')
            .send({ email: 'not-an-email', password: 'short' });

        expect(res.status).toBe(400);
    });
});
