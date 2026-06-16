import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class SettlementController {
    /**
     * Get simplified debts
     */
    getSimplifiedDebts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get debt summary for user
     */
    getDebtSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Create settlement
     */
    createSettlement(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Process payment
     */
    processPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Cancel settlement
     */
    cancelSettlement(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get settlement history
     */
    getSettlementHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const settlementController: SettlementController;
//# sourceMappingURL=settlement.controller.d.ts.map