import { Router } from 'express';
import { feedbackController } from './feedback.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

// Submit feedback - public (optional auth is handled internally in controller)
router.post('/', feedbackController.create);

// Get feedbacks - protected (authenticated users only)
router.get('/', protect, feedbackController.list);

export default router;
