import { Router } from 'express';
import * as tripController from './trip.controller';
import {
  loadTrip,
  loadStop,
  requireMember,
  requireAdmin,
  requireEditor,
  validate,
} from './trip.middleware';
import {
  createTripSchema,
  updateTripSchema,
  createStopSchema,
  updateStopSchema,
  reorderStopsSchema,
  updateExchangeRateSchema,
  updateMemberRoleSchema,
  joinTripSchema,
  generateInviteSchema,
  tripIdParamSchema,
  stopIdParamSchema,
  memberParamSchema,
} from './trip.validators';
import { authenticate } from '../middleware/authenticate'; // your existing Firebase auth middleware

const router = Router();

// All trip routes require a valid Firebase token
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// TRIP ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST   /api/v1/trips          → Create trip
 * GET    /api/v1/trips          → Get my trips
 */
router
  .route('/')
  .post(validate(createTripSchema), tripController.createTrip)
  .get(tripController.getMyTrips);

/**
 * POST /api/v1/trips/join/:inviteCode → Join trip via invite code
 * Note: must be defined BEFORE /:tripId to avoid route conflict
 */
router.post(
  '/join/:inviteCode',
  validate(joinTripSchema, 'params'),
  tripController.joinTrip
);

/**
 * GET    /api/v1/trips/:tripId          → Get trip detail
 * PATCH  /api/v1/trips/:tripId          → Update trip (admin)
 * DELETE /api/v1/trips/:tripId          → Archive trip (admin)
 */
router
  .route('/:tripId')
  .get(
    validate(tripIdParamSchema, 'params'),
    loadTrip(),
    requireMember,
    tripController.getTrip
  )
  .patch(
    validate(tripIdParamSchema, 'params'),
    loadTrip(),
    requireAdmin,
    validate(updateTripSchema),
    tripController.updateTrip
  )
  .delete(
    validate(tripIdParamSchema, 'params'),
    loadTrip(),
    requireAdmin,
    tripController.archiveTrip
  );

/**
 * GET /api/v1/trips/:tripId/summary → Trip dashboard summary
 */
router.get(
  '/:tripId/summary',
  validate(tripIdParamSchema, 'params'),
  loadTrip(),
  requireMember,
  tripController.getTripSummary
);

// ─────────────────────────────────────────────────────────────────────────────
// INVITE ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST   /api/v1/trips/:tripId/invite/generate → New invite code (admin)
 * DELETE /api/v1/trips/:tripId/invite          → Revoke invite code (admin)
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// STOP ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/trips/:tripId/stops → Add stop (editor)
 */
router.post(
  '/:tripId/stops',
  validate(tripIdParamSchema, 'params'),
  loadTrip(),
  requireEditor,
  validate(createStopSchema),
  tripController.addStop
);

/**
 * PATCH /api/v1/trips/:tripId/stops/reorder → Reorder all stops (editor)
 * Note: must be BEFORE /:stopId to avoid treating "reorder" as a stopId
 */
router.patch(
  '/:tripId/stops/reorder',
  validate(tripIdParamSchema, 'params'),
  loadTrip(),
  requireEditor,
  validate(reorderStopsSchema),
  tripController.reorderStops
);

/**
 * PATCH  /api/v1/trips/:tripId/stops/:stopId       → Update stop (editor)
 * DELETE /api/v1/trips/:tripId/stops/:stopId       → Delete stop (admin)
 */
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

/**
 * PATCH /api/v1/trips/:tripId/stops/:stopId/rate → Update exchange rate (editor)
 */
router.patch(
  '/:tripId/stops/:stopId/rate',
  validate(stopIdParamSchema, 'params'),
  loadTrip(),
  requireEditor,
  loadStop,
  validate(updateExchangeRateSchema),
  tripController.updateStopRate
);

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/trips/:tripId/members → List members (member)
 */
router.get(
  '/:tripId/members',
  validate(tripIdParamSchema, 'params'),
  loadTrip(),
  requireMember,
  tripController.getMembers
);

/**
 * PATCH  /api/v1/trips/:tripId/members/:userId/role → Change role (admin)
 * DELETE /api/v1/trips/:tripId/members/:userId      → Remove member (self or admin)
 */
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
  requireMember,   // any active member can remove themselves; service checks the rest
  tripController.removeMember
);

export default router;
