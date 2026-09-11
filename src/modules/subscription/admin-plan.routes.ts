import { Router } from 'express';
import { AdminPlanController } from './admin-plan.controller';
import { protect, authorize } from '../../middleware/auth.middleware';

const router = Router();

// Protect all admin plan routes with protect + authorize('admin')
router.use(protect);
router.use(authorize('admin'));

router.get('/plans', AdminPlanController.listPlans);
router.post('/plans', AdminPlanController.createPlan);
router.get('/plans/:id', AdminPlanController.getPlan);
router.patch('/plans/:id', AdminPlanController.updatePlan);
router.post('/plans/:id/archive', AdminPlanController.archivePlan);
router.get('/audit-logs', AdminPlanController.getAuditLogs);

export default router;
