import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Health check', () => {
  it('returns status ok', async () => {
    const app = express();
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});
