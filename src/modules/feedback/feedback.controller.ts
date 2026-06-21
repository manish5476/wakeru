import { Request, Response, NextFunction } from 'express';
import { Feedback } from './feedback.model';
import jwt from 'jsonwebtoken';
import { User } from '../auth/auth.model';
import { config } from '../../config';

// Optional helper to check if a user is authenticated on an otherwise public endpoint
const tryGetAuthenticatedUser = async (req: Request) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(
          token,
          config.JWT_SECRET || process.env.JWT_SECRET || 'tripsplit-secret-dev'
        ) as { userId: string; type: string };
        
        if (decoded.userId && decoded.type === 'access') {
          const userDoc = await User.findOne({
            _id: decoded.userId,
            isActive: true,
            isDeleted: false,
          }).select('displayName').lean();
          if (userDoc) {
            return {
              userId: decoded.userId,
              displayName: userDoc.displayName || 'User',
            };
          }
        }
      }
    }
  } catch (error) {
    // Ignore verification errors, treat as anonymous
  }
  return null;
};

export const feedbackController = {
  /** POST /api/v1/feedback */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const authUser = await tryGetAuthenticatedUser(req);
      const { rating, category, feedback, deviceInfo, displayName } = req.body;

      const newFeedback = new Feedback({
        userId: authUser?.userId || null,
        displayName: authUser?.displayName || displayName || 'Anonymous',
        rating,
        category,
        feedback,
        deviceInfo,
      });

      await newFeedback.save();

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: { feedback: newFeedback },
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/v1/feedback */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      // Find all feedbacks, sort newest first
      const feedbacks = await Feedback.find({}).sort({ createdAt: -1 }).lean();

      res.status(200).json({
        success: true,
        data: { feedbacks },
      });
    } catch (err) {
      next(err);
    }
  },
};
