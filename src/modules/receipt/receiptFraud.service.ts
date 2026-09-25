import { Expense } from '../expense/expense.model';
import { logger } from '../../config/logger';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  matchedExpenseId?: string;
  matchedTripId?: string;
  confidence: number;
}

export class ReceiptFraudService {
  /**
   * Checks whether a receipt has already been claimed in any active expense
   * across trips, preventing duplicate reimbursement and double-splitting fraud.
   */
  static async checkDuplicateReceipt(
    receiptHash?: string,
    merchantName?: string,
    amount?: number,
    date?: Date,
    excludeExpenseId?: string
  ): Promise<DuplicateCheckResult> {
    // 1. Direct hash match (Highest confidence: 1.0)
    if (receiptHash) {
      const match = await Expense.findOne({
        'receiptMetadata.receiptHash': receiptHash,
        ...(excludeExpenseId ? { _id: { $ne: excludeExpenseId } } : {}),
        isArchived: false,
      }).select('_id tripId title amountBase date');

      if (match) {
        logger.warn(`[Anti-Fraud] Duplicate receiptHash detected: ${receiptHash} matching expense ${match._id}`);
        return {
          isDuplicate: true,
          reason: 'Identical receipt image has already been submitted in another expense',
          matchedExpenseId: String(match._id),
          matchedTripId: String(match.tripId),
          confidence: 1.0,
        };
      }
    }

    // 2. Soft match: Same merchant + same amount on the same day (Confidence: 0.85)
    if (merchantName && amount && date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const match = await Expense.findOne({
        'receiptMetadata.merchantName': new RegExp(`^${merchantName.trim()}$`, 'i'),
        amountLocal: amount,
        date: { $gte: startOfDay, $lte: endOfDay },
        ...(excludeExpenseId ? { _id: { $ne: excludeExpenseId } } : {}),
        isArchived: false,
      }).select('_id tripId title amountBase date');

      if (match) {
        logger.warn(`[Anti-Fraud] Suspected duplicate receipt for merchant ${merchantName} ($${amount}) on ${date}`);
        return {
          isDuplicate: true,
          reason: `A bill for ${merchantName} with the exact same amount was already recorded today`,
          matchedExpenseId: String(match._id),
          matchedTripId: String(match.tripId),
          confidence: 0.85,
        };
      }
    }

    return { isDuplicate: false, confidence: 0 };
  }
}
