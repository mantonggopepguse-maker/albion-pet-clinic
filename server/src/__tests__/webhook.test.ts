import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
    ALLOWED_WEBHOOK_PLATFORMS,
    isValidWebhookPlatform,
    verifyWebhookAuth,
} from '../routes/ai-client.js';

describe('Webhook Platform Validation', () => {
    it('allows valid supported platforms (case-insensitive)', () => {
        expect(isValidWebhookPlatform('WHATSAPP')).toBe(true);
        expect(isValidWebhookPlatform('whatsapp')).toBe(true);
        expect(isValidWebhookPlatform('telegram')).toBe(true);
        expect(isValidWebhookPlatform('SMS')).toBe(true);
        expect(isValidWebhookPlatform('twilio')).toBe(true);
        expect(isValidWebhookPlatform('GENERIC')).toBe(true);
    });

    it('rejects unsupported or empty platforms', () => {
        expect(isValidWebhookPlatform('facebook')).toBe(false);
        expect(isValidWebhookPlatform('instagram')).toBe(false);
        expect(isValidWebhookPlatform('discord')).toBe(false);
        expect(isValidWebhookPlatform('')).toBe(false);
    });
});

describe('Webhook Signature and Secret Authentication', () => {
    const SECRET = 'super-secret-key-12345';
    const payload = { from: '+1234567890', content: 'Hello doctor', clinicId: 'c1' };

    it('returns true if no secret is configured (dev mode)', () => {
        expect(verifyWebhookAuth('', undefined, undefined, payload)).toBe(true);
    });

    it('authorizes when raw x-webhook-secret matches', () => {
        expect(verifyWebhookAuth(SECRET, SECRET, undefined, payload)).toBe(true);
    });

    it('rejects when raw x-webhook-secret is wrong and no signature is provided', () => {
        expect(verifyWebhookAuth(SECRET, 'wrong-secret', undefined, payload)).toBe(false);
        expect(verifyWebhookAuth(SECRET, undefined, undefined, payload)).toBe(false);
    });

    it('authorizes when valid x-hub-signature-256 HMAC is provided', () => {
        const bodyStr = JSON.stringify(payload);
        const signature = 'sha256=' + crypto.createHmac('sha256', SECRET).update(bodyStr).digest('hex');

        expect(verifyWebhookAuth(SECRET, undefined, signature, payload)).toBe(true);
    });

    it('rejects forged or modified x-hub-signature-256 HMAC', () => {
        const signature = 'sha256=' + crypto.createHmac('sha256', 'different-secret').update(JSON.stringify(payload)).digest('hex');
        expect(verifyWebhookAuth(SECRET, undefined, signature, payload)).toBe(false);
    });

    it('rejects malformed or truncated signature strings safely without crashing', () => {
        expect(verifyWebhookAuth(SECRET, undefined, 'invalid', payload)).toBe(false);
        expect(verifyWebhookAuth(SECRET, undefined, '', payload)).toBe(false);
    });
});
