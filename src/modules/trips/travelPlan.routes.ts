import { Router } from 'express';
import * as travelPlanController from './travelPlan.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });

// All travel plan routes require authentication
router.use(protect);

// GET /api/v1/trips/:tripId/plan
router.get('/', travelPlanController.getTravelPlan);

// PUT /api/v1/trips/:tripId/plan
router.put('/', travelPlanController.updateTravelPlan);

// POST /api/v1/trips/:tripId/plan/activate
router.post('/activate', travelPlanController.activateTrip);

export default router;