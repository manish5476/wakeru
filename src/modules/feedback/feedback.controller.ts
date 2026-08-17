import { Request, Response, NextFunction } from 'express';
import { Feedback } from './feedback.model';
import jwt from 'jsonwebtoken';
import { User } from '../auth/auth.model';
import { config } from '../../config';
import cloudinary from '../../config/cloudinary.config';
import streamifier from 'streamifier';
import { z } from 'zod';

const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  category: z.string().trim().min(1).max(100),
  feedback: z.string().trim().min(1).max(5000),
  displayName: z.string().trim().max(100).optional(),
  deviceInfo: z.union([z.string().max(4000), z.record(z.unknown())]).optional(),
});

const hasValidImageSignature = (file: Express.Multer.File): boolean => {
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === 'image/webp') return bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return false;
};

// Optional helper to check if a user is authenticated on an otherwise public endpoint
const tryGetAuthenticatedUser = async (req: Request) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(
          token,
          config.JWT_SECRET
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
      const input = feedbackSchema.parse(req.body);
      const { rating, category, feedback, deviceInfo, displayName } = input;

      let parsedDeviceInfo = deviceInfo;
      if (typeof deviceInfo === 'string') {
        try {
          parsedDeviceInfo = JSON.parse(deviceInfo);
        } catch (e) {}
      }

      const imageUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        if (!req.files.every(hasValidImageSignature)) {
          return res.status(400).json({ success: false, error: 'One or more uploads are not valid images' });
        }
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
