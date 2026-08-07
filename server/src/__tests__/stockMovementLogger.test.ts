import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());
vi.mock('../db.js', () => ({
  prisma: {
    stockMovement: {
      create: mockCreate,
    },
  },
}));

import { logStockMovement } from '../utils/stockMovementLogger.js';

describe('logStockMovement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a stock movement record with all fields', async () => {
    const params = {
      clinicId: 'clinic-1',
      itemId: 'item-1',
      type: 'sale' as const,
      quantity: -2,
      balanceAfter: 10,
      reference: 'INV-001',
      note: 'Sold 2 units',
      userId: 'user-1',
    };

    await logStockMovement(params);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        clinicId: 'clinic-1',
        itemId: 'item-1',
        type: 'sale',
        quantity: -2,
        balanceAfter: 10,
        reference: 'INV-001',
        note: 'Sold 2 units',
        userId: 'user-1',
      },
    });
  });

  it('creates a stock movement without optional fields', async () => {
    const params = {
      clinicId: 'clinic-2',
      itemId: 'item-2',
      type: 'restock' as const,
      quantity: 50,
      balanceAfter: 100,
    };

    await logStockMovement(params);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        clinicId: 'clinic-2',
        itemId: 'item-2',
        type: 'restock',
        quantity: 50,
        balanceAfter: 100,
        reference: undefined,
        note: undefined,
        userId: undefined,
      },
    });
  });

  it('handles reconciliation type', async () => {
    const params = {
      clinicId: 'clinic-3',
      itemId: 'item-3',
      type: 'reconciliation' as const,
      quantity: 5,
      balanceAfter: 45,
      note: 'Physical count adjustment',
    };

    await logStockMovement(params);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'reconciliation',
          note: 'Physical count adjustment',
        }),
      }),
    );
  });

  it('handles adjustment type', async () => {
    const params = {
      clinicId: 'clinic-4',
      itemId: 'item-4',
      type: 'adjustment' as const,
      quantity: 1,
      balanceAfter: 30,
      userId: 'user-2',
    };

    await logStockMovement(params);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'adjustment',
          userId: 'user-2',
        }),
      }),
    );
  });

  it('handles void type', async () => {
    const params = {
      clinicId: 'clinic-5',
      itemId: 'item-5',
      type: 'void' as const,
      quantity: 3,
      balanceAfter: 20,
      reference: 'VOID-SALE-001',
    };

    await logStockMovement(params);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'void',
          reference: 'VOID-SALE-001',
        }),
      }),
    );
  });

  it('logs error to console but does not throw when prisma fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error('DB connection failed'));

    const params = {
      clinicId: 'clinic-1',
      itemId: 'item-1',
      type: 'sale' as const,
      quantity: -1,
      balanceAfter: 9,
    };

    await expect(logStockMovement(params)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to log stock movement:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
