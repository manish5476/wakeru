import { Router } from 'express';
import * as tripController from './trip.controller';
import { loadTrip, loadStop, requireMember, requireAdmin, requireEditor, validate } from './trip.middleware';
import { createTripSchema, updateTripSchema, createStopSchema, updateStopSchema, reorderStopsSchema, updateExchangeRateSchema, updateMemberRoleSchema, joinTripSchema, generateInviteSchema, tripIdParamSchema, stopIdParamSchema, joinRequestParamSchema, memberParamSchema, addMemberSchema, } from './trip.validators';
import { protect } from '../../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(protect);

// ============================================================
// ⚠️ TEMPLATE ROUTES — MUST BE BEFORE /:tripId ROUTES
// ============================================================

/**
 * GET /api/v1/trips/templates → Get available templates
 */
router.get('/templates', tripController.getTemplates);

/**
 * POST /api/v1/trips/template/:type → Create trip from template
 */
router.post(
  '/template/:type',
  validate(
    z.object({
      type: z.enum(['quick', 'domestic', 'international'], {
        message: 'Template must be quick, domestic, or international',
      }),
    }),
    'params'
  ),
  validate(createTripSchema),
  tripController.createTripFromTemplate
);

// ============================================================
// JOIN ROUTE — Must be BEFORE /:tripId
// ============================================================

/**
 * POST /api/v1/trips/join/:inviteCode → Join trip via invite code
 */
router.post(
  '/join/:inviteCode',
  validate(joinTripSchema, 'params'),
  tripController.joinTrip
);

/**
 * GET /api/v1/trips/join-requests/all → Get all pending join requests for trips I admin
 * Used on the home screen. Must be BEFORE /:tripId routes.
 */
router.get('/join-requests/all', tripController.getAdminJoinRequests);

// ============================================================
// TRIP COLLECTION ROUTES
// ============================================================

/**
 * POST /api/v1/trips → Create trip
 * GET  /api/v1/trips → Get my trips
 */
router
  .route('/')
  .post(validate(createTripSchema), tripController.createTrip)
  .get(tripController.getMyTrips);

// ============================================================
// TRIP-SPECIFIC ROUTES — /:tripId (must be LAST)
// ============================================================

/**
 * GET    /api/v1/trips/:tripId → Get trip detail
 * PATCH  /api/v1/trips/:tripId → Update trip
 * DELETE /api/v1/trips/:tripId → Archive trip
 */
router
  .route('/:tripId')
  .get(
    validate(tripIdParamSchema, 'params'),
    loadTrip({ includeArchived: true }),
    requireMember,
    tripController.getTrip
  )
  .patch(
    validate(tripIdParamSchema, 'params'),
    loadTrip(),
    requireMember,
    validate(updateTripSchema),
    tripController.updateTrip
  )
  .delete(
    validate(tripIdParamSchema, 'params'),
    loadTrip({ includeArchived: true }),
    requireMember,
    tripController.archiveTrip
  );

router.post(
  '/:tripId/unarchive',
  validate(tripIdParamSchema, 'params'),
  loadTrip({ includeArchived: true }),
  requireMember,
  tripController.unarchiveTrip
);

router.delete(
  '/:tripId/permanent',
  validate(tripIdParamSchema, 'params'),
  loadTrip({ includeArchived: true }),
  requireMember,
  tripController.deleteTripPermanent
);

router.get(
  '/:tripId/insights',
  validate(tripIdParamSchema, 'params'),
  loadTrip({ includeArchived: true }),
  requireMember,
  tripController.getTripInsights
);

router.get(
  '/:tripId/story',
  validate(tripIdParamSchema, 'params'),
  loadTrip({ includeArchived: true }),
  requireMember,
  tripController.getTripStory
);

/**
 * GET /api/v1/trips/:tripId/summary → Trip dashboard summary
 */
router.get(
  '/:tripId/summary',
  validate(tripIdParamSchema, 'params'),
  loadTrip({ includeArchived: true }),
  requireMember,
  tripController.getTripSummary
);

// ============================================================
// INVITE ROUTES
// ============================================================

router.post(
  '/:tripId/invite/generate',
  validate(tripIdParamSchema, 'params'),
  loadTrip(),
  requireAdmin,
  validate(generateInviteSchema),
  tripController.generateInviteCode
);

router.delete(
  '/:tripId/invite',
  validate(tripIdParamSchema, 'params'),
  loadTrip(),
  requireAdmin,
  tripController.revokeInviteCode
);

// ============================================================
// JOIN REQUEST ROUTES
// ============================================================

router.get(
  '/:tripId/join-requests',
  validate(tripIdParamSchema, 'params'),
  tripController.getPendingJoinRequests
);

router.post(
  '/:tripId/join-requests/:requestId/approve',
  validate(joinRequestParamSchema, 'params'),
  tripController.approveJoinRequest
);

router.post(
  '/:tripId/join-requests/:requestId/reject',
  validate(joinRequestParamSchema, 'params'),
  tripController.rejectJoinRequest
);

// ============================================================
// STOP ROUTES
// ============================================================

router.post(
  '/:tripId/stops',
  validate(tripIdParamSchema, 'params'),
  loadTrip(),
  requireEditor,
  validate(createStopSchema),
  tripController.addStop
);

router.patch(
  '/:tripId/stops/reorder',
  validate(tripIdParamSchema, 'params'),
  loadTrip(),
  requireEditor,
  validate(reorderStopsSchema),
  tripController.reorderStops
);

router
  .route('/:tripId/stops/:stopId')
  .patch(
    validate(stopIdParamSchema, 'params'),
    loadTrip(),
    requireEditor,
    loadStop,
    validate(updateStopSchema),
    tripController.updateStop
  )
  .delete(
    validate(stopIdParamSchema, 'params'),
    loadTrip(),
    requireAdmin,
    tripController.deleteStop
  );

router.patch(
  '/:tripId/stops/:stopId/rate',
  validate(stopIdParamSchema, 'params'),
  loadTrip(),
  requireEditor,
  loadStop,
  validate(updateExchangeRateSchema),
  tripController.updateStopRate
);

// ============================================================
// MEMBER ROUTES
// ============================================================

router.get(
  '/:tripId/members',
  validate(tripIdParamSchema, 'params'),
  loadTrip({ includeArchived: true }),
  requireMember,
  tripController.getMembers
);

router.post(
  '/:tripId/members',
  validate(tripIdParamSchema, 'params'),
  loadTrip(),
  requireAdmin,
  validate(addMemberSchema),
  tripController.addMember
);

router.patch(
  '/:tripId/members/:userId/role',
  validate(memberParamSchema, 'params'),
  loadTrip(),
  requireAdmin,
  validate(updateMemberRoleSchema),
  tripController.updateMemberRole
);

router.delete(
  '/:tripId/members/:userId',
  validate(memberParamSchema, 'params'),
  loadTrip(),
  requireMember,
  tripController.removeMember
);

import travelPlanRoutes from '../travelPlan/travelPlan.routes';

router.use('/:tripId/plan', travelPlanRoutes);

export default router;
