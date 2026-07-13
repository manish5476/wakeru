import { Router } from 'express';
import { feedbackController } from './feedback.controller';
import { protect } from '../../middleware/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Submit feedback - public (optional auth is handled internally in controller)
router.post('/', upload.array('images', 3), feedbackController.create);

// Get feedbacks - protected (authenticated users only)
router.get('/', protect, feedbackController.list);

export default router;
