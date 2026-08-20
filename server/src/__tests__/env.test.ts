import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJwtExpiresIn, getJwtSecret, validateProductionEnvironment } from '../config/env.js';

describe('server environment security', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('fails closed when JWT_SECRET is missing', () => {
        vi.stubEnv('JWT_SECRET', '');
        expect(() => getJwtSecret()).toThrow('JWT_SECRET not configured');
    });

    it('rejects weak JWT secrets in production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('JWT_SECRET', 'default-secret-change-this');
        expect(() => getJwtSecret()).toThrow('at least 32 characters');
    });

    it('accepts a strong production configuration', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('JWT_SECRET', 'a-strong-random-secret-with-more-than-32-characters');
        vi.stubEnv('DATABASE_URL', 'postgresql://localhost/test');
        expect(() => validateProductionEnvironment()).not.toThrow();
    });

    it('uses the configured token lifetime', () => {
        vi.stubEnv('JWT_EXPIRES_IN', '12h');
        expect(getJwtExpiresIn('30d')).toBe('12h');
    });
});
