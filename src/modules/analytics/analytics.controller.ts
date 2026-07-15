import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';

const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.firebaseUid) throw new Error('Not authenticated');
  return user.firebaseUid; // ✅ FIXED: Use Firebase UID
};

export const analyticsController = {
  async getQuickStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const stats = await analyticsService.getQuickStats(userId);
      res.status(200).json({ success: true, data: stats });
    } catch (err) { next(err); }
  },

  async getUserAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const data = await analyticsService.getUserAnalytics(userId, req.query as any);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getTripAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { tripId } = req.params;
      const data = await analyticsService.getTripAnalytics(tripId, userId, req.query as any);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getYearlySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const year = parseInt(req.params.year);
      const data = await analyticsService.getYearlySummary(userId, year);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  },
};