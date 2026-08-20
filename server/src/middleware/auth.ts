import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { getJwtSecret } from '../config/env.js';

/**
 * Extended Express request with authenticated user context.
 *
 * Added by the `authenticate` middleware. All route handlers should
 * use this type to access the current user's identity, roles, and
 * clinic membership for authorization decisions.
 */
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string;
        roles: string[];
        clinicId?: string;
        isSuperAdmin: boolean;
        isClient?: boolean;
    };
    file?: any;
    files?: any;
}

/**
 * JWT authentication middleware.
 *
 * Verifies the Bearer token from the Authorization header, decodes
 * the user payload, and attaches it to `req.user`. Enforces:
 * - Non-superadmin users must have a `clinicId` (tenant isolation)
 * - Client-portal tokens are validated against the active client record
 *
 * On failure, returns 401 (invalid/expired token) or 403 (tenant/portal error).
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        let secret: string;
        try {
            secret = getJwtSecret();
        } catch {
            return res.status(500).json({ error: 'JWT_SECRET not configured' });
        }

        const decoded = jwt.verify(token, secret) as any;

        if (
            !decoded ||
            typeof decoded !== 'object' ||
            typeof decoded.id !== 'string' ||
            !Array.isArray(decoded.roles) ||
            typeof decoded.isSuperAdmin !== 'boolean'
        ) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Standard users MUST have a clinicId to prevent cross-tenant data leakage
        if (!decoded.isSuperAdmin && !decoded.clinicId) {
            console.warn('Rejected authenticated request without tenant context');
            return res.status(403).json({ error: 'Tenant context missing. Please login again.' });
        }

        // Verify client-portal tokens against active portal access
        if (Array.isArray(decoded.roles) && decoded.roles.includes('CLIENT')) {
            const activeClient = await prisma.client.findFirst({
                where: {
                    id: decoded.id,
                    clinicId: decoded.clinicId,
                    isPortalEnabled: true,
                },
                select: { id: true },
            });

            if (!activeClient) {
                return res.status(403).json({
                    error: 'Portal access has been disabled. Please contact your clinic.',
                });
            }
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Role-based authorization middleware.
 *
 * Checks that the authenticated user has at least one of the specified
 * roles. SuperAdmins bypass all role checks.
 *
 * Must be used AFTER `authenticate` middleware.
 *
 * @param roles - One or more role names that are permitted (e.g. 'Admin', 'Vet')
 */
export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Super Admin can access everything
        if (req.user.isSuperAdmin) {
            return next();
        }

        const hasRole = req.user.roles.some((role) => roles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

/**
 * SuperAdmin-only access guard.
 *
 * Must be used AFTER `authenticate` middleware.
 */
export const superAdminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.isSuperAdmin) {
        return res.status(403).json({ error: 'Super Admin access required' });
    }
    next();
};
