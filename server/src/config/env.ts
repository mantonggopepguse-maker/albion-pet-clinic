import type { SignOptions } from 'jsonwebtoken';

const INSECURE_SECRET_MARKERS = ['change-this', 'default-secret', 'your-super-secret'];

/** Returns the JWT signing secret or fails closed when it is unavailable. */
export const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET?.trim();

    if (!secret) {
        throw new Error('JWT_SECRET not configured');
    }

    if (
        process.env.NODE_ENV === 'production' &&
        (secret.length < 32 || INSECURE_SECRET_MARKERS.some(marker => secret.includes(marker)))
    ) {
        throw new Error('JWT_SECRET must be a random value of at least 32 characters in production');
    }

    return secret;
};

/** Keeps token lifetime configuration consistent across all authentication routes. */
export const getJwtExpiresIn = (
    fallback: SignOptions['expiresIn'] = '7d',
): SignOptions['expiresIn'] => (
    (process.env.JWT_EXPIRES_IN?.trim() || fallback) as SignOptions['expiresIn']
);

/** Validates configuration that must never be missing on a production server. */
export const validateProductionEnvironment = (): void => {
    if (process.env.NODE_ENV !== 'production') return;

    getJwtSecret();

    if (!process.env.DATABASE_URL?.trim()) {
        throw new Error('DATABASE_URL not configured');
    }
};
