import { Router } from 'express';
import * as syncController from './sync.controller';
import { protect } from '../auth/auth.middleware';

const router = Router();

// All sync routes require authentication
router.use(protect);

router.post('/push', syncController.pushChanges);
router.post('/pull', syncController.pullChanges);
router.get('/status', syncController.getStatus);

export default router;
