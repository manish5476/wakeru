import { receiptController } from '../../src/modules/receipt/receipt.controller';
import { Trip } from '../../src/modules/trips/trip.model';
import { Expense } from '../../src/modules/expense/expense.model';

jest.mock('../../src/modules/trips/trip.model');
jest.mock('../../src/modules/expense/expense.model');

describe('Receipt Pre-flight Validation & Duplicate Detection API', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should pass AppError(400) to next when amountMinor is missing or negative', async () => {
    mockReq = {
      user: { firebaseUid: 'usr-1' },
      body: {
        tripId: 'trip-100',
        amountMinor: -500,
        splits: [],
      },
    };

    (Trip.findById as jest.Mock).mockResolvedValue({
      _id: 'trip-100',
      isMember: () => true,
      baseCurrency: 'INR',
    });

    await receiptController.validateReceiptExpense(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: expect.stringContaining('positive integer'),
      })
    );
  });

  it('should pass AppError(404) to next when trip does not exist', async () => {
    mockReq = {
      user: { firebaseUid: 'usr-1' },
      body: {
        tripId: 'trip-nonexistent',
        amountMinor: 50000,
        splits: [{ amountMinor: 50000 }],
      },
    };

    (Trip.findById as jest.Mock).mockResolvedValue(null);

    await receiptController.validateReceiptExpense(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Trip not found',
      })
    );
  });

  it('should pass AppError(403) to next when user is not a member of the trip', async () => {
    mockReq = {
      user: { firebaseUid: 'usr-intruder' },
      body: {
        tripId: 'trip-100',
        amountMinor: 50000,
        splits: [{ amountMinor: 50000 }],
      },
    };

    (Trip.findById as jest.Mock).mockResolvedValue({
      _id: 'trip-100',
      isMember: (uid: string) => uid === 'usr-1',
      baseCurrency: 'INR',
    });

    await receiptController.validateReceiptExpense(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: expect.stringContaining('not a member'),
      })
    );
  });

  it('should pass AppError(400) to next when split sum does not match amountMinor', async () => {
    mockReq = {
      user: { firebaseUid: 'usr-1' },
      body: {
        tripId: 'trip-100',
        amountMinor: 10000, // 100.00 INR
        splits: [
          { amountMinor: 5000 },
          { amountMinor: 4000 }, // sum is 9000, mismatch!
        ],
      },
    };

    (Trip.findById as jest.Mock).mockResolvedValue({
      _id: 'trip-100',
      isMember: () => true,
      baseCurrency: 'INR',
    });

    await receiptController.validateReceiptExpense(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: expect.stringContaining('Split sum'),
      })
    );
  });

  it('should detect duplicate receipt hash within the trip and return 200 with duplicateDetected: true', async () => {
    mockReq = {
      user: { firebaseUid: 'usr-1' },
      body: {
        tripId: 'trip-100',
        amountMinor: 74550,
        receiptHash: 'rec_dominos_123',
        splits: [{ amountMinor: 74550 }],
      },
    };

    (Trip.findById as jest.Mock).mockResolvedValue({
      _id: 'trip-100',
      isMember: () => true,
      baseCurrency: 'INR',
    });

    const mockExpense = {
      _id: 'exp-existing-99',
      title: "Domino's Pizza",
      amountLocal: 74550,
      date: '2026-03-14',
    };

    (Expense.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(mockExpense),
    });

    await receiptController.validateReceiptExpense(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: {
        valid: true,
        duplicateDetected: true,
        existingExpense: {
          id: 'exp-existing-99',
          title: "Domino's Pizza",
          amountLocal: 74550,
          date: '2026-03-14',
        },
        tripCurrency: 'INR',
      },
    });
  });

  it('should approve valid clean receipt without duplicates and return 200 with duplicateDetected: false', async () => {
    mockReq = {
      user: { firebaseUid: 'usr-1' },
      body: {
        tripId: 'trip-100',
        amountMinor: 74550,
        receiptHash: 'rec_dominos_clean',
        splits: [
          { amountMinor: 37275 },
          { amountMinor: 37275 },
        ],
      },
    };

    (Trip.findById as jest.Mock).mockResolvedValue({
      _id: 'trip-100',
      isMember: () => true,
      baseCurrency: 'INR',
    });

    (Expense.findOne as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await receiptController.validateReceiptExpense(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: {
        valid: true,
        duplicateDetected: false,
        existingExpense: null,
        tripCurrency: 'INR',
      },
    });
  });
});
