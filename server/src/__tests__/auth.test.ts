import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate, authorize, superAdminOnly } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { Response, NextFunction } from 'express';

const mockVerify = vi.hoisted(() => vi.fn());
vi.mock('jsonwebtoken', () => ({
  default: { verify: mockVerify },
  verify: mockVerify,
}));

const mockFindFirst = vi.hoisted(() => vi.fn());
vi.mock('../db.js', () => ({
  prisma: {
    client: {
      findFirst: mockFindFirst,
    },
  },
}));

function mockReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    headers: {},
    user: undefined,
    ...overrides,
  } as AuthRequest;
}

function mockRes(): Response {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('authenticate middleware', () => {
  let req: AuthRequest;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    req = mockReq();
    res = mockRes();
    next = vi.fn();
  });

  it('returns 401 if no Authorization header', async () => {
    req.headers = {};
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 if Authorization header does not start with Bearer', async () => {
    req.headers = { authorization: 'Basic token123' };
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 if JWT_SECRET not configured', async () => {
    delete process.env.JWT_SECRET;
    req.headers = { authorization: 'Bearer token123' };
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'JWT_SECRET not configured' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid/expired token', async () => {
    req.headers = { authorization: 'Bearer bad-token' };
    mockVerify.mockImplementation(() => { throw new Error('jwt malformed'); });
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('decodes valid token and calls next()', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    const decoded = {
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      roles: ['Admin'],
      clinicId: 'clinic-1',
      isSuperAdmin: false,
    };
    mockVerify.mockReturnValue(decoded);
    await authenticate(req, res, next);
    expect(req.user).toEqual(decoded);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 if non-superadmin has no clinicId (tenant isolation)', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    const decoded = {
      id: 'user-2',
      email: 'no-clinic@test.com',
      name: 'No Clinic',
      roles: ['Vet'],
      clinicId: undefined,
      isSuperAdmin: false,
    };
    mockVerify.mockReturnValue(decoded);
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows superadmin without clinicId', async () => {
    req.headers = { authorization: 'Bearer super-token' };
    const decoded = {
      id: 'super-1',
      email: 'super@admin.com',
      name: 'Super Admin',
      roles: ['Admin'],
      clinicId: undefined,
      isSuperAdmin: true,
    };
    mockVerify.mockReturnValue(decoded);
    await authenticate(req, res, next);
    expect(req.user).toEqual(decoded);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 if client portal access is disabled', async () => {
    req.headers = { authorization: 'Bearer client-token' };
    const decoded = {
      id: 'client-1',
      email: 'client@test.com',
      name: 'Client User',
      roles: ['CLIENT'],
      clinicId: 'clinic-1',
      isSuperAdmin: false,
    };
    mockVerify.mockReturnValue(decoded);
    mockFindFirst.mockResolvedValue(null);
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Portal access has been disabled. Please contact your clinic.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows client with active portal access', async () => {
    req.headers = { authorization: 'Bearer client-token' };
    const decoded = {
      id: 'client-1',
      email: 'client@test.com',
      name: 'Client User',
      roles: ['CLIENT'],
      clinicId: 'clinic-1',
      isSuperAdmin: false,
    };
    mockVerify.mockReturnValue(decoded);
    mockFindFirst.mockResolvedValue({ id: 'client-1' });
    await authenticate(req, res, next);
    expect(req.user).toEqual(decoded);
    expect(next).toHaveBeenCalled();
  });
});

describe('authorize middleware', () => {
  it('calls next() if user has required role', () => {
    const req = mockReq({
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        roles: ['Admin'],
        clinicId: 'c1',
        isSuperAdmin: false,
      },
    });
    const res = mockRes();
    const next = vi.fn();
    authorize('Admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() if user has one of multiple required roles', () => {
    const req = mockReq({
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        roles: ['Vet'],
        clinicId: 'c1',
        isSuperAdmin: false,
      },
    });
    const res = mockRes();
    const next = vi.fn();
    authorize('Admin', 'Vet')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 if user lacks required role', () => {
    const req = mockReq({
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        roles: ['Receptionist'],
        clinicId: 'c1',
        isSuperAdmin: false,
      },
    });
    const res = mockRes();
    const next = vi.fn();
    authorize('Admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows superadmin to bypass role check', () => {
    const req = mockReq({
      user: {
        id: 'super-1',
        email: 's@a.com',
        name: 'Super',
        roles: ['Receptionist'],
        clinicId: 'c1',
        isSuperAdmin: true,
      },
    });
    const res = mockRes();
    const next = vi.fn();
    authorize('Admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 if user is not authenticated', () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn();
    authorize('Admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('superAdminOnly middleware', () => {
  it('calls next() for superadmin', () => {
    const req = mockReq({
      user: {
        id: 's1',
        email: 's@a.com',
        name: 'S',
        roles: ['Admin'],
        clinicId: 'c1',
        isSuperAdmin: true,
      },
    });
    const res = mockRes();
    const next = vi.fn();
    superAdminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for non-superadmin', () => {
    const req = mockReq({
      user: {
        id: 'u1',
        email: 'u@b.com',
        name: 'U',
        roles: ['Admin'],
        clinicId: 'c1',
        isSuperAdmin: false,
      },
    });
    const res = mockRes();
    const next = vi.fn();
    superAdminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Super Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 if no user attached', () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn();
    superAdminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
