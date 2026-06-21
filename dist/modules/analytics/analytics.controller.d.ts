import { Request, Response, NextFunction } from 'express';
export declare const analyticsController: {
    getQuickStats(req: Request, res: Response, next: NextFunction): Promise<void>;
    getUserAnalytics(req: Request, res: Response, next: NextFunction): Promise<void>;
    getTripAnalytics(req: Request, res: Response, next: NextFunction): Promise<void>;
    getYearlySummary(req: Request, res: Response, next: NextFunction): Promise<void>;
};
//# sourceMappingURL=analytics.controller.d.ts.map