import { syncService } from '../../src/modules/sync/sync.service';
import { SyncLog } from '../../src/modules/sync/sync.model';

jest.mock('../../src/modules/sync/sync.model');
jest.mock('../../src/modules/expense/expense.model');
jest.mock('../../src/modules/trips/trip.model');
jest.mock('../../src/modules/settlement/settlement.model');
jest.mock('../../src/modules/trips/stop.model');
jest.mock('../../src/modules/expense/expense.service');

describe('SyncService (Push/Pull & Idempotency)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return cached result when clientOperationId has already been processed', async () => {
    const mockExistingLog = {
      clientOperationId: 'op-already-done-123',
      status: 'APPLIED',
      entityId: 'srv-exp-999',
      resultPayload: { _id: 'srv-exp-999', title: 'Coffee' },
      error: undefined,
    };

    (SyncLog.findOne as jest.Mock).mockResolvedValue(mockExistingLog);

    const results = await syncService.processPush('user-1', 'Alice', [
      {
        clientOperationId: 'op-already-done-123',
        entityType: 'expense',
        entityId: 'client-exp-1',
        operationType: 'CREATE',
        payload: { title: 'Coffee', amountLocal: 150 },
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].clientOperationId).toBe('op-already-done-123');
    expect(results[0].status).toBe('APPLIED');
    expect(results[0].serverId).toBe('srv-exp-999');
    expect(results[0].serverRecord).toEqual(mockExistingLog.resultPayload);
  });

  it('should return VALIDATION_ERROR for unsupported entity types', async () => {
    (SyncLog.findOne as jest.Mock).mockResolvedValue(null);

    const results = await syncService.processPush('user-1', 'Alice', [
      {
        clientOperationId: 'op-unknown-type',
        entityType: 'unknown_entity' as any,
        entityId: 'entity-1',
        operationType: 'CREATE',
        payload: {},
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('VALIDATION_ERROR');
    expect(results[0].error).toContain('Unsupported entity type');
  });

  it('processPull should return a valid serverTimestamp', async () => {
    const { Trip } = require('../../src/modules/trips/trip.model');
    const { Expense } = require('../../src/modules/expense/expense.model');
    const { Settlement } = require('../../src/modules/settlement/settlement.model');

    (Trip.find as jest.Mock).mockResolvedValue([]);
    (Expense.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Settlement.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const pullResult = await syncService.processPull('user-1', new Date().toISOString());
    expect(pullResult).toBeDefined();
    expect(pullResult.serverTimestamp).toBeDefined();
    expect(new Date(pullResult.serverTimestamp).getTime()).not.toBeNaN();
    expect(Array.isArray(pullResult.trips)).toBe(true);
    expect(Array.isArray(pullResult.expenses)).toBe(true);
    expect(Array.isArray(pullResult.settlements)).toBe(true);
  });
});
