import { Request, Response, NextFunction } from 'express';
import { LedgerService } from './ledger.service';
import { AuthenticatedRequest } from '../../shared/types/common.types';

export const ledgerController = {
  /**
   * GET /api/v1/ledger/balances
   * Returns canonical authoritatively calculated balances.
   */
  async getBalances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const tripId = req.query.tripId as string | undefined;
      const balances = await LedgerService.getAuthoritativeBalances(userId, tripId);

      return res.status(200).json({
        success: true,
        data: balances,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/ledger/breakdown
   * Returns transparent "How was this calculated?" breakdown.
   */
  async getBreakdown(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const breakdown = await LedgerService.getBalanceBreakdown(userId);

      return res.status(200).json({
        success: true,
        data: breakdown,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
};
