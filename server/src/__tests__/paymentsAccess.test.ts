import { describe, expect, it } from 'vitest';
import { canAccessPayment } from '../routes/payments.js';
import type { AuthRequest } from '../middleware/auth.js';

const sale = { clinicId: 'clinic-1', clientId: 'client-1' };

const makeUser = (overrides: Partial<NonNullable<AuthRequest['user']>> = {}) => ({
    id: 'staff-1',
    email: 'staff@example.com',
    name: 'Staff User',
    roles: ['Veterinarian'],
    clinicId: 'clinic-1',
    isSuperAdmin: false,
    ...overrides,
});

describe('receipt tenant access', () => {
    it('allows staff only within their clinic', () => {
        expect(canAccessPayment(makeUser(), sale)).toBe(true);
        expect(canAccessPayment(makeUser({ clinicId: 'clinic-2' }), sale)).toBe(false);
    });

    it('allows portal clients only for their own sale', () => {
        expect(canAccessPayment(makeUser({ id: 'client-1', roles: ['CLIENT'] }), sale)).toBe(true);
        expect(canAccessPayment(makeUser({ id: 'client-2', roles: ['CLIENT'] }), sale)).toBe(false);
    });

    it('allows super administrators and rejects anonymous access', () => {
        expect(canAccessPayment(makeUser({ isSuperAdmin: true, clinicId: undefined }), sale)).toBe(true);
        expect(canAccessPayment(undefined, sale)).toBe(false);
    });
});
