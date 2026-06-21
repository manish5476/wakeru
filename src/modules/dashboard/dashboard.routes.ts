import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();
router.use(protect);

router.get('/', dashboardController.getDashboard);

export default router;