import { Request, Response, NextFunction } from 'express';
import { Feedback } from './feedback.model';
import jwt from 'jsonwebtoken';
import { User } from '../auth/auth.model';
import { config } from '../../config';
import cloudinary from '../../config/cloudinary.config';
import streamifier from 'streamifier';

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

      let parsedDeviceInfo = deviceInfo;
      if (typeof deviceInfo === 'string') {
        try {
          parsedDeviceInfo = JSON.parse(deviceInfo);
        } catch (e) {}
      }

      const imageUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        const uploadPromises = req.files.map((file: Express.Multer.File) => {
          return new Promise<string>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: 'feedback',
                public_id: `fb-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                transformation: [{ width: 800, crop: 'limit' }, { fetch_format: 'webp', quality: 80 }],
              },
              (error: any, result: any) => {
                if (error) return reject(error);
                resolve(result.secure_url);
              }
            );
            streamifier.createReadStream(file.buffer).pipe(uploadStream);
          });
        });
        
        const uploadedUrls = await Promise.all(uploadPromises);
        imageUrls.push(...uploadedUrls);
      }

      const newFeedback = new Feedback({
        userId: authUser?.userId || null,
        displayName: authUser?.displayName || displayName || 'Anonymous',
        rating: Number(rating),
        category,
        feedback,
        images: imageUrls,
        deviceInfo: parsedDeviceInfo,
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
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const skip = (page - 1) * limit;

      // Find all feedbacks, sort newest first
      const [feedbacks, total] = await Promise.all([
        Feedback.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Feedback.countDocuments({}),
      ]);

      res.status(200).json({
        success: true,
        data: {
          feedbacks,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          }
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
