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
 * Get current settlement plan.
 */
export const getSettlement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;

    const settlement = await settlementService.getSettlement(
      tripId,
      user.uid
    );

    res.status(200).json({
      success: true,
      data: {
        settlement,
        summary: {
          totalTransactions: settlement.totalTransactions,
          totalAmount: settlement.totalAmount,
          pendingCount: settlement.pendingCount,
          initiatedCount: settlement.initiatedCount,
          confirmedCount: settlement.confirmedCount,
          disputedCount: settlement.disputedCount,
          baseCurrency: settlement.baseCurrency,
          isStale: settlement.isStale,
          isFullySettled: settlement.isFullySettled,
          settlementProgress: settlement.settlementProgress,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/settlements/trip/:tripId/summary
 * Get settlement summary (dashboard widget).
 */
export const getSettlementSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;

    const summary = await settlementService.getSettlementSummary(
      tripId,
      user.uid
    );

    res.status(200).json({
      success: true,
      data: summary,
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

    const settlement = await settlementService.calculateSettlement(
      tripId,
      user.uid
    );

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
    const { transactionId, partialAmount } = req.body;

    const result = await settlementService.initiatePayment(
      tripId,
      transactionId,
      user.uid,
      partialAmount
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
 * POST /api/v1/settlements/trip/:tripId/retry
 * Retry a failed/disputed payment.
 */
export const retryPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;
    const { transactionId } = req.body;

    const result = await settlementService.retryPayment(
      tripId,
      transactionId,
      user.uid
    );

    res.status(200).json({
      success: true,
      message: 'Payment retried. New UPI link generated.',
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
 * Confirm receipt of a payment.
 */
export const confirmPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;
    const { transactionId, notes } = req.body;

    const settlement = await settlementService.confirmPayment(
      tripId,
      transactionId,
      user.uid,
      notes
    );

    res.status(200).json({
      success: true,
      message: 'Payment confirmed. Related expenses updated.',
      data: {
        settlement,
        isFullySettled: settlement.isFullySettled,
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
    const { transactionId, reason } = req.body;

    const settlement = await settlementService.disputePayment(
      tripId,
      transactionId,
      user.uid,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Payment disputed. The other party has been notified.',
      data: { settlement },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/settlements/mine
 * Get all my settlements across all trips.
 */
export const getMySettlements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { status } = req.query;

    const result = await settlementService.getMySettlements(
      user.uid,
      status as string | undefined
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/settlements/trip/:tripId/history
 * Get settlement history for a trip.
 */
export const getSettlementHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;

    const history = await settlementService.getSettlementHistory(
      tripId,
      user.uid
    );

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/settlements/trip/:tripId/export
 * Export settlement as JSON or CSV.
 */
export const exportSettlement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;
    const format = (req.query.format as 'json' | 'csv') || 'json';

    const data = await settlementService.exportSettlement(
      tripId,
      user.uid,
      format
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=settlement-${tripId}.csv`
      );
      res.status(200).send(data);
    } else {
      res.status(200).json({
        success: true,
        data,
      });
    }
  } catch (err) {
    next(err);
  }
};

// import { Request, Response, NextFunction } from 'express';
// import { settlementService } from './settlement.service';
// import { AppError } from '../../shared/errors/AppError';

// // ============================================================
// // HELPER
// // ============================================================

// const getUser = (req: Request) => {
//   const user = (req as any).user;
//   if (!user?.userId) throw new AppError('Not authenticated', 401);
//   return {
//     uid: user.userId,
//     displayName: user.displayName || 'User',
//   };
// };

// // ============================================================
// // CONTROLLERS
// // ============================================================

// /**
//  * GET /api/v1/settlements/trip/:tripId
//  * Get current settlement plan (auto-calculates if needed).
//  */
// export const getSettlement = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { tripId } = req.params;

//     const settlement = await settlementService.getSettlement(tripId, user.uid);

//     res.status(200).json({
//       success: true,
//       data: {
//         settlement,
//         summary: {
//           totalTransactions: settlement.totalTransactions,
//           totalAmount: settlement.transactions.reduce((s, t) => s + t.amountBase, 0),
//           pendingCount: settlement.transactions.filter((t) => t.status === 'pending').length,
//           confirmedCount: settlement.transactions.filter((t) => t.status === 'confirmed').length,
//           baseCurrency: settlement.baseCurrency,
//           isStale: settlement.isStale,
//         },
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/settlements/trip/:tripId/calculate
//  * Force recalculate settlement.
//  */
// export const calculateSettlement = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { tripId } = req.params;

//     const settlement = await settlementService.calculateSettlement(tripId, user.uid);

//     res.status(200).json({
//       success: true,
//       message: `Settlement calculated — ${settlement.totalTransactions} transfers needed`,
//       data: { settlement },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/settlements/trip/:tripId/pay
//  * Initiate UPI payment for a settlement transaction.
//  */
// export const initiatePayment = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { tripId } = req.params;
//     const { transactionId } = req.body;

//     const result = await settlementService.initiatePayment(
//       tripId,
//       transactionId,
//       user.uid
//     );

//     res.status(200).json({
//       success: true,
//       message: 'Payment initiated. Open the UPI link to complete.',
//       data: {
//         transaction: result.transaction,
//         upiDeepLink: result.upiDeepLink,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/settlements/trip/:tripId/confirm
//  * Confirm receipt of a payment (recipient only).
//  */
// export const confirmPayment = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { tripId } = req.params;
//     const { transactionId } = req.body;

//     const settlement = await settlementService.confirmPayment(
//       tripId,
//       transactionId,
//       user.uid
//     );

//     res.status(200).json({
//       success: true,
//       message: 'Payment confirmed. Related expenses updated.',
//       data: {
//         settlement,
//         isFullySettled: settlement.transactions.every((t) => t.status === 'confirmed'),
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/settlements/trip/:tripId/dispute
//  * Dispute a payment.
//  */
// export const disputePayment = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { tripId } = req.params;
//     const { transactionId } = req.body;

//     const settlement = await settlementService.disputePayment(
//       tripId,
//       transactionId,
//       user.uid
//     );

//     res.status(200).json({
//       success: true,
//       message: 'Payment disputed. Trip members will be notified.',
//       data: { settlement },
//     });
//   } catch (err) {
//     next(err);
//   }
// };