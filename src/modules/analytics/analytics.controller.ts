import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';
import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
import { ValidationError } from '../../shared/errors/AppError';
import Joi from 'joi';

const timeframeSchema = Joi.string().valid('week', 'month', 'year').default('month');

export class AnalyticsController {
  /**
   * Get user analytics
   */
  async getUserAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeframe = (req.query.timeframe as string) || 'month';
      const { error } = timeframeSchema.validate(timeframe);
      if (error) {
        throw new ValidationError('Invalid timeframe');
      }

      const analytics = await analyticsService.getUserAnalytics(
        req.user!.userId, 
        timeframe as 'week' | 'month' | 'year'
      );

      const response: ApiResponse = {
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        message: ''
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get group analytics
   */
  async getGroupAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.params;
      const timeframe = (req.query.timeframe as string) || 'month';
      
      const analytics = await analyticsService.getGroupAnalytics(
        groupId, 
        req.user!.userId,
        timeframe as 'week' | 'month' | 'year'
      );

      const response: ApiResponse = {
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        message: ''
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get predictive analytics
   */
  async getPredictiveAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.params;
      
      const analytics = await analyticsService.getPredictiveAnalytics(
        req.user!.userId,
        groupId
      );

      const response: ApiResponse = {
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
        message: ''
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get spending report
   */
  async getSpendingReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupId } = req.params;
      const timeframe = (req.query.timeframe as string) || 'month';
      
      // This can generate PDF reports
      const report = await analyticsService.getGroupAnalytics(
        groupId,
        req.user!.userId,
        timeframe as 'week' | 'month' | 'year'
      );

      const response: ApiResponse = {
        success: true,
        data: {
          report,
          exportable: true,
          formats: ['json', 'csv', 'pdf']
        },
        timestamp: new Date().toISOString(),
        message: ''
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();