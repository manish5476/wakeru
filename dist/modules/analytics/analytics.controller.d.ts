import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class AnalyticsController {
    /**
     * Get user analytics
     */
    getUserAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get group analytics
     */
    getGroupAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get predictive analytics
     */
    getPredictiveAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get spending report
     */
    getSpendingReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const analyticsController: AnalyticsController;
//# sourceMappingURL=analytics.controller.d.ts.map