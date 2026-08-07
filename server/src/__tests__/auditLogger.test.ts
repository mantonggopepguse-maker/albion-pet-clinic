import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
vi.mock('../db.js', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
    auditLog: {
      create: mockCreate,
    },
  },
}));

import { logAudit } from '../utils/auditLogger.js';

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates audit log with all provided fields', async () => {
    await logAudit(
      'user-1',
      'SALES',
      'CREATE',
      'Created invoice INV-001',
      'clinic-1',
      'Dr. Smith',
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        userName: 'Dr. Smith',
        clinicId: 'clinic-1',
        module: 'SALES',
        action: 'CREATE',
        details: 'Created invoice INV-001',
        timestamp: expect.any(Date),
      },
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('fetches userName from DB when not provided', async () => {
    mockFindUnique.mockResolvedValue({
      clinicId: 'clinic-2',
      name: 'Dr. Jane',
    });

    await logAudit('user-2', 'FINANCE', 'Payment Verified', 'Payment verified for INV-002');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      select: { clinicId: true, name: true },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userName: 'Dr. Jane',
        clinicId: 'clinic-2',
      }),
    });
  });

  it('fetches clinicId from DB when not provided', async () => {
    mockFindUnique.mockResolvedValue({
      clinicId: 'clinic-3',
      name: 'Dr. Bob',
    });

    await logAudit(
      'user-3',
      'INVENTORY',
      'RESTOCK',
      'Restocked 50 units of Item-X',
      undefined,
      'Dr. Bob',
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: 'clinic-3',
        userName: 'Dr. Bob',
      }),
    });
  });

  it('uses "Unknown" when user not found in DB', async () => {
    mockFindUnique.mockResolvedValue(null);

    await logAudit('user-4', 'SALES', 'VOID', 'Voided sale');
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userName: 'Unknown',
      }),
    });
  });

  it('handles user without clinicId gracefully', async () => {
    mockFindUnique.mockResolvedValue({
      clinicId: null,
      name: 'Dr. NoClinic',
    });

    await logAudit('user-5', 'SALES', 'CREATE', 'Test entry');
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userName: 'Dr. NoClinic',
        clinicId: undefined,
      }),
    });
  });

  it('does not throw when prisma fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFindUnique.mockRejectedValue(new Error('DB unavailable'));

    await expect(
      logAudit('user-6', 'SALES', 'CREATE', 'Should not crash'),
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to log audit:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
