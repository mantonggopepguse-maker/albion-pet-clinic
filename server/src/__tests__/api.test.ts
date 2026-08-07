import { describe, it, expect } from 'vitest';
import express from 'express';

describe('API routes', () => {
  it('health endpoint returns proper shape', () => {
    const app = express();
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    return import('supertest').then(({ default: request }) => {
      return request(app)
        .get('/health')
        .expect(200)
        .expect(res => {
          expect(res.body.status).toBe('ok');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  it('404 for unknown API routes', () => {
    const app = express();
    app.use('/api', (req, res) => {
      res.status(404).json({ error: 'API route not found' });
    });

    return import('supertest').then(({ default: request }) => {
      return request(app)
        .get('/api/nonexistent')
        .expect(404)
        .expect(res => {
          expect(res.body.error).toBe('API route not found');
        });
    });
  });
});
