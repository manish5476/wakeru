import { Router } from 'express';
import { personController } from './person.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();
router.use(protect);

router.get('/:userId', personController.getPersonDetail);

export default router;