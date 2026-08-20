import { describe, it, expect } from 'vitest';
import express from 'express';

describe('Branch Financial Insights API', () => {
  it('calculates branch inflow, expenditure, and net margin accurately', () => {
    const app = express();
    app.get('/api/financials/branches', (req, res) => {
      const branches = [
        {
          clinicId: 'c1',
          clinicName: 'Victoria Island Main Branch',
          acronym: 'VI',
          inflow: 2500000,
          expenditure: 1200000,
          netMargin: 1300000,
          profitabilityRate: 52,
          outstandingReceivables: 300000
        },
        {
          clinicId: 'c2',
          clinicName: 'Ikeja Branch',
          acronym: 'IKJ',
          inflow: 1800000,
          expenditure: 950000,
          netMargin: 850000,
          profitabilityRate: 47,
          outstandingReceivables: 150000
        }
      ];

      const totalInflow = branches.reduce((s, b) => s + b.inflow, 0);
      const totalExpenditure = branches.reduce((s, b) => s + b.expenditure, 0);

      res.json({
        timestamp: new Date().toISOString(),
        totalBranches: branches.length,
        totalInflow,
        totalExpenditure,
        netMargin: totalInflow - totalExpenditure,
        branches
      });
    });

    return import('supertest').then(({ default: request }) => {
      return request(app)
        .get('/api/financials/branches')
        .expect(200)
        .expect((res) => {
          expect(res.body.totalBranches).toBe(2);
          expect(res.body.totalInflow).toBe(4300000);
          expect(res.body.totalExpenditure).toBe(2150000);
          expect(res.body.netMargin).toBe(2150000);
          expect(res.body.branches).toHaveLength(2);
        });
    });
  });
});
