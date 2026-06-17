import { Request, Response, NextFunction } from 'express';
import * as tripService from './trip.service';
import { AppError } from '@/shared/errors/AppError';
import {
  CreateTripInput,
  UpdateTripInput,
  CreateStopInput,
  UpdateStopInput,
  ReorderStopsInput,
  UpdateExchangeRateInput,
  GenerateInviteInput,
  UpdateMemberRoleInput,
} from './trip.validators';

// Helper to read the authenticated Firebase user off the request
// (set by your existing Firebase auth middleware)
const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.uid) throw new AppError('Not authenticated', 401);
  return user as { uid: string; displayName: string; photoURL?: string };
};

// Helper to read req.trip set by loadTrip middleware
const getTripFromReq = (req: Request) => {
  const trip = (req as any).trip;
  if (!trip) throw new AppError('Trip not loaded', 500);
  return trip;
};

// ─────────────────────────────────────────────────────────────────────────────
// TRIP CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/trips
 * Create a new trip. Creator is auto-added as admin.
 */
export const createTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const input = req.body as CreateTripInput;

    const trip = await tripService.createTrip(input, {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });

    res.status(201).json({
      success: true,
      message: 'Trip created successfully',
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/trips
 * Get all trips for the current user.
 * Query params: status, includeArchived
 */
export const getMyTrips = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { status, includeArchived } = req.query;

    const trips = await tripService.getUserTrips(user.uid, {
      status: status as string | undefined,
      includeArchived: includeArchived === 'true',
    });

    res.status(200).json({
      success: true,
      data: {
        trips,
        count: trips.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/trips/:tripId
 * Get a single trip. User must be a member.
 * Middleware: loadTrip, requireMember
 */
export const getTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);

    res.status(200).json({
      success: true,
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/trips/:tripId/summary
 * Get rich dashboard summary: stops, member balances, budget health.
 * Middleware: loadTrip, requireMember
 */
export const getTripSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tripId } = req.params;
    const summary = await tripService.getTripSummary(tripId);

    res.status(200).json({
      success: true,
      data: { summary },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/trips/:tripId
 * Update trip metadata. Admin only.
 * Middleware: loadTrip, requireAdmin
 */
export const updateTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const input = req.body as UpdateTripInput;

    const updated = await tripService.updateTrip(trip, input);

    res.status(200).json({
      success: true,
      message: 'Trip updated',
      data: { trip: updated },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/trips/:tripId
 * Archive a trip (soft delete). Admin only.
 * Middleware: loadTrip, requireAdmin
 */
export const archiveTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    await tripService.archiveTrip(trip);

    res.status(200).json({
      success: true,
      message: 'Trip archived successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STOP CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/trips/:tripId/stops
 * Add a new stop to the trip.
 * Middleware: loadTrip, requireEditor
 */
export const addStop = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const trip = getTripFromReq(req);
    const input = req.body as CreateStopInput;

    const updated = await tripService.addStop(trip, input, user.uid);

    // Return the newly added stop (last one in the sorted array)
    const newStop = updated.stops[updated.stops.length - 1];

    res.status(201).json({
      success: true,
      message: 'Stop added successfully',
      data: { stop: newStop, trip: updated },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/trips/:tripId/stops/:stopId
 * Update stop metadata.
 * Middleware: loadTrip, requireEditor, loadStop
 */
export const updateStop = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const { stopId } = req.params;
    const input = req.body as UpdateStopInput;

    const updated = await tripService.updateStop(trip, stopId, input);
    const stop = updated.stops.find((s) => s._id.toString() === stopId);

    res.status(200).json({
      success: true,
      message: 'Stop updated',
      data: { stop },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/trips/:tripId/stops/:stopId/rate
 * Update exchange rate for a stop.
 * Records rateLastUpdated. Does NOT change existing expenses.
 * Middleware: loadTrip, requireEditor
 */
export const updateStopRate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const { stopId } = req.params;
    const input = req.body as UpdateExchangeRateInput;

    const updated = await tripService.updateStopExchangeRate(
      trip,
      stopId,
      input
    );
    const stop = updated.stops.find((s) => s._id.toString() === stopId);

    res.status(200).json({
      success: true,
      message: 'Exchange rate updated. New expenses will use this rate.',
      data: {
        stop,
        newRate: input.currentExchangeRate,
        baseCurrency: trip.baseCurrency,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/trips/:tripId/stops/reorder
 * Reorder all stops. Send full array of stopIds in desired order.
 * Middleware: loadTrip, requireEditor
 */
export const reorderStops = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const input = req.body as ReorderStopsInput;

    const updated = await tripService.reorderStops(trip, input);

    res.status(200).json({
      success: true,
      message: 'Stops reordered',
      data: { stops: updated.stops },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/trips/:tripId/stops/:stopId
 * Delete a stop. Only allowed if stop has no expenses.
 * Admin only.
 * Middleware: loadTrip, requireAdmin
 */
export const deleteStop = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const { stopId } = req.params;

    // Import Expense model inline to avoid circular dependency
    // In your project, import at top of file if no circular dep
    const { Expense } = await import('../expense/expense.model');
    const expenseCount = await Expense.countDocuments({ stopId });

    await tripService.deleteStop(trip, stopId, expenseCount);

    res.status(200).json({
      success: true,
      message: 'Stop deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/trips/:tripId/members
 * List all active members with their balances.
 * Middleware: loadTrip, requireMember
 */
export const getMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const activeMembers = trip.getActiveMembers();

    const members = activeMembers.map((m: any) => ({
      userId: m.userId,
      displayName: m.displayName,
      photoURL: m.photoURL,
      role: m.role,
      joinedAt: m.joinedAt,
      totalPaidBase: m.totalPaidBase,
      totalOwesBase: m.totalOwesBase,
      netBalance: m.totalPaidBase - m.totalOwesBase,
    }));

    res.status(200).json({
      success: true,
      data: {
        members,
        count: members.length,
        baseCurrency: trip.baseCurrency,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/trips/:tripId/members/:userId/role
 * Change a member's role. Admin only.
 * Middleware: loadTrip, requireAdmin
 */
export const updateMemberRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const trip = getTripFromReq(req);
    const { userId: targetUserId } = req.params;
    const { role } = req.body as UpdateMemberRoleInput;

    await tripService.updateMemberRole(
      trip,
      targetUserId,
      role,
      user.uid
    );

    res.status(200).json({
      success: true,
      message: `Member role updated to ${role}`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/trips/:tripId/members/:userId
 * Remove a member from the trip (soft delete).
 * Admin can remove anyone. Members can only remove themselves.
 * Middleware: loadTrip, requireMember
 */
export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const trip = getTripFromReq(req);
    const { userId: targetUserId } = req.params;

    await tripService.removeMember(
      trip,
      targetUserId,
      user.uid,
      trip.isAdmin(user.uid)
    );

    const isSelf = targetUserId === user.uid;
    res.status(200).json({
      success: true,
      message: isSelf ? 'You have left the trip' : 'Member removed from trip',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INVITE CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/trips/join/:inviteCode
 * Join a trip via invite code. No loadTrip middleware needed here.
 */
export const joinTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { inviteCode } = req.params;

    const trip = await tripService.joinTripByInviteCode(inviteCode, {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });

    res.status(200).json({
      success: true,
      message: 'Joined trip successfully',
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/trips/:tripId/invite/generate
 * Generate a new invite code. Admin only.
 * Middleware: loadTrip, requireAdmin
 */
export const generateInviteCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const input = req.body as GenerateInviteInput;

    const result = await tripService.regenerateInviteCode(trip, input);

    res.status(200).json({
      success: true,
      message: 'New invite code generated',
      data: {
        inviteCode: result.inviteCode,
        expiresAt: result.expiresAt,
        joinUrl: `https://tripsplit.app/join/${result.inviteCode}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/trips/:tripId/invite
 * Revoke current invite code. Admin only.
 * Middleware: loadTrip, requireAdmin
 */
export const revokeInviteCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    await tripService.revokeInviteCode(trip);

    res.status(200).json({
      success: true,
      message: 'Invite code revoked. No new members can join until a new code is generated.',
    });
  } catch (err) {
    next(err);
  }
};
