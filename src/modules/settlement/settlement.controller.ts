import { Request, Response, NextFunction } from 'express';
import { settlementService } from './settlement.service';
import { AppError } from '../../shared/errors/AppError';

// ============================================================
// HELPER
// ============================================================

const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.userId) throw new AppError('Not authenticated', 401);
  return {
    uid: user.userId,
    displayName: user.displayName || 'User',
  };
};

// ============================================================
// CONTROLLERS
// ============================================================

/**
 * GET /api/v1/settlements/trip/:tripId
 * Get current settlement plan (auto-calculates if needed).
 */
export const getSettlement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;

    const settlement = await settlementService.getSettlement(tripId, user.uid);

    res.status(200).json({
      success: true,
      data: {
        settlement,
        summary: {
          totalTransactions: settlement.totalTransactions,
          totalAmount: settlement.transactions.reduce((s, t) => s + t.amountBase, 0),
          pendingCount: settlement.transactions.filter((t) => t.status === 'pending').length,
          confirmedCount: settlement.transactions.filter((t) => t.status === 'confirmed').length,
          baseCurrency: settlement.baseCurrency,
          isStale: settlement.isStale,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/settlements/trip/:tripId/calculate
 * Force recalculate settlement.
 */
export const calculateSettlement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;

    const settlement = await settlementService.calculateSettlement(tripId, user.uid);

    res.status(200).json({
      success: true,
      message: `Settlement calculated — ${settlement.totalTransactions} transfers needed`,
      data: { settlement },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/settlements/trip/:tripId/pay
 * Initiate UPI payment for a settlement transaction.
 */
export const initiatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;
    const { transactionId } = req.body;

    const result = await settlementService.initiatePayment(
      tripId,
      transactionId,
      user.uid
    );

    res.status(200).json({
      success: true,
      message: 'Payment initiated. Open the UPI link to complete.',
      data: {
        transaction: result.transaction,
        upiDeepLink: result.upiDeepLink,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/settlements/trip/:tripId/confirm
 * Confirm receipt of a payment (recipient only).
 */
export const confirmPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;
    const { transactionId } = req.body;

    const settlement = await settlementService.confirmPayment(
      tripId,
      transactionId,
      user.uid
    );

    res.status(200).json({
      success: true,
      message: 'Payment confirmed. Related expenses updated.',
      data: {
        settlement,
        isFullySettled: settlement.transactions.every((t) => t.status === 'confirmed'),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/settlements/trip/:tripId/dispute
 * Dispute a payment.
 */
export const disputePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;
    const { transactionId } = req.body;

    const settlement = await settlementService.disputePayment(
      tripId,
      transactionId,
      user.uid
    );

    res.status(200).json({
      success: true,
      message: 'Payment disputed. Trip members will be notified.',
      data: { settlement },
    });
  } catch (err) {
    next(err);
  }
};