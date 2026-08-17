import { Router } from 'express';
import { feedbackController } from './feedback.controller';
import { protect } from '../../middleware/auth.middleware';
import multer from 'multer';
import { feedbackRateLimiter } from '../../middleware/rateLimiter.middleware';

const router = Router();
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 3, fileSize: 5 * 1024 * 1024, fields: 10, fieldSize: 16 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, allowedTypes.has(file.mimetype)),
});

// Submit feedback - public (optional auth is handled internally in controller)
router.post('/', feedbackRateLimiter, upload.array('images', 3), feedbackController.create);

// Get feedbacks - protected (authenticated users only)
router.get('/', protect, feedbackController.list);

export default router;
