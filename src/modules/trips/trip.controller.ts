import { Request, Response, NextFunction } from 'express';
import * as tripService from './trip.service';
import { tripInsightsService } from './trip-insights.service';
import * as tripStoryService from './trip-story.service';
import { invitationService } from './invitation.service';
import { AppError } from '../../shared/errors/AppError';
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
// ✅ FIXED: Trip members store userId as Firebase UID, not UUID _id
const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.firebaseUid) throw new AppError('Not authenticated', 401);
  return {
    userId: user.firebaseUid, // Firebase UID — this is what trip.members[].userId stores
    displayName: user.displayName || 'User',
    photoURL: user.photoURL || '',
  };
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

export const createTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req); // Returns { userId, displayName, photoURL }
    const input = req.body as CreateTripInput;

    // We can pass `user` directly now since the interfaces match
    const trip = await tripService.createTrip(input, user);
    await trip.populate('stops');

    res.status(201).json({
      success: true,
      message: 'Trip created successfully',
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyTrips = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { status, includeArchived, page, limit, searchName, searchUser, dateRange } = req.query;

    const [paginatedData, stats] = await Promise.all([
      tripService.getUserTrips(user.userId, {
        status: status as string | undefined,
        includeArchived: includeArchived === 'true',
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        searchName: searchName as string | undefined,
        searchUser: searchUser as string | undefined,
        dateRange: dateRange as string | undefined,
      }),
      tripService.getUserTripStats(user.userId)
    ]);

    res.status(200).json({
      success: true,
      data: {
        trips: paginatedData.trips,
        pagination: {
          totalCount: paginatedData.totalCount,
          totalPages: paginatedData.totalPages,
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 10,
        },
        stats
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    await trip.populate('stops');

    res.status(200).json({
      success: true,
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

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

export const updateTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const input = req.body as UpdateTripInput;

    const updated = await tripService.updateTrip(trip, input);
    await updated.populate('stops');

    res.status(200).json({
      success: true,
      message: 'Trip updated',
      data: { trip: updated },
    });
  } catch (err) {
    next(err);
  }
};

export const archiveTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const trip = getTripFromReq(req);
    await tripService.archiveTrip(trip, user.userId);

    res.status(200).json({
      success: true,
      message: 'Trip archived successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const unarchiveTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const trip = getTripFromReq(req);
    await tripService.unarchiveTrip(trip, user.userId);

    res.status(200).json({
      success: true,
      message: 'Trip unarchived successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const deleteTripPermanent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const trip = getTripFromReq(req);
    await tripService.deleteTripPermanent(trip, user.userId);

    res.status(200).json({
      success: true,
      message: 'Trip permanently deleted',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STOP CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

export const addStop = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const trip = getTripFromReq(req);
    const input = req.body as CreateStopInput;

    const updated = await tripService.addStop(trip, input, user.userId);
    await updated.populate('stops');

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
    await updated.populate('stops');
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

export const updateStopRate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const { stopId } = req.params;
    const input = req.body as UpdateExchangeRateInput;

    const updated = await tripService.updateStopExchangeRate(trip, stopId, input);
    await updated.populate('stops');
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

export const reorderStops = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const input = req.body as ReorderStopsInput;

    const updated = await tripService.reorderStops(trip, input);
    await updated.populate('stops');

    res.status(200).json({
      success: true,
      message: 'Stops reordered',
      data: { stops: updated.stops },
    });
  } catch (err) {
    next(err);
  }
};

export const deleteStop = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const { stopId } = req.params;

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

    await tripService.updateMemberRole(trip, targetUserId, role, user.userId);

    res.status(200).json({
      success: true,
      message: `Member role updated to ${role}`,
    });
  } catch (err) {
    next(err);
  }
};

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
      user.userId,
      trip.isAdmin(user.userId)
    );

    const isSelf = targetUserId === user.userId;
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

export const addMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const trip = getTripFromReq(req);
    const { userId: targetUserId, role } = req.body;

    const invitation = await invitationService.sendInvitation(
      trip._id.toString(),
      targetUserId,
      user.userId,
      `You have been invited to join ${trip.title} as a ${role || 'member'}`
    );

    res.status(200).json({
      success: true,
      message: 'Invitation sent successfully',
      data: { invitation },
    });
  } catch (err) {
    next(err);
  }
};

export const joinTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { inviteCode } = req.params;

    const joinRequest = await tripService.joinTripByInviteCode(inviteCode, user);

    res.status(200).json({
      success: true,
      message: 'Join request sent successfully',
      data: { joinRequest },
    });
  } catch (err) {
    next(err);
  }
};

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

// ─────────────────────────────────────────────────────────────────────────────
// JOIN REQUEST CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingJoinRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { tripId } = req.params;

    const requests = await tripService.getPendingRequests(tripId, user.userId);

    res.status(200).json({
      success: true,
      data: { requests, count: requests.length },
    });
  } catch (err) {
    next(err);
  }
};

export const approveJoinRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { requestId } = req.params;

    const trip = await tripService.approveJoinRequest(requestId, user.userId);

    res.status(200).json({
      success: true,
      message: 'Join request approved. Member added to trip.',
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

export const rejectJoinRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { requestId } = req.params;

    await tripService.rejectJoinRequest(requestId, user.userId);

    res.status(200).json({
      success: true,
      message: 'Join request rejected.',
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminJoinRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const requests = await tripService.getAdminPendingRequests(user.userId);

    res.status(200).json({
      success: true,
      data: { requests, count: requests.length },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE AND INSIGHT CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

export const getTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const templates = tripService.getTemplates();

    res.status(200).json({
      success: true,
      data: { templates },
    });
  } catch (err) {
    next(err);
  }
};

export const createTripFromTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getUser(req);
    const { type } = req.params as { type: string };
    const input = req.body as CreateTripInput;

    const trip = await tripService.createTripFromTemplate(
      type as 'quick' | 'domestic' | 'international',
      input,
      user
    );

    res.status(201).json({
      success: true,
      message: `Trip created using ${type} template`,
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

export const getTripInsights = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = getUser(req);
    const { tripId } = req.params;
    const insights = await tripInsightsService.getTripInsights(tripId, userId);
    res.status(200).json({ success: true, data: insights });
  } catch (err) {
    next(err);
  }
};

export const getTripStory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const trip = getTripFromReq(req);
    const story = await tripStoryService.generateTripStory(trip._id as string);

    res.status(200).json({
      success: true,
      data: { story },
    });
  } catch (err) {
    next(err);
  }
};

// import { Request, Response, NextFunction } from 'express';
// import * as tripService from './trip.service';
// import { tripInsightsService } from './trip-insights.service';
// import * as tripStoryService from './trip-story.service';
// import { invitationService } from './invitation.service';
// import { AppError } from '../../shared/errors/AppError';
// import {
//   CreateTripInput,
//   UpdateTripInput,
//   CreateStopInput,
//   UpdateStopInput,
//   ReorderStopsInput,
//   UpdateExchangeRateInput,
//   GenerateInviteInput,
//   UpdateMemberRoleInput,
// } from './trip.validators';

// // Helper to read the authenticated Firebase user off the request
// // (set by your existing Firebase auth middleware)
// // const getUser = (req: Request) => {
// //   const user = (req as any).user;
// //   if (!user?.uid) throw new AppError('Not authenticated', 401);
// //   return user as { uid: string; displayName: string; photoURL?: string };
// // };
// // ✅ UPGRADED:
// const getUser = (req: Request) => {
//   const user = (req as any).user;
//   if (!user?.userId) throw new AppError('Not authenticated', 401);
//   return {
//     userId: user.userId,
//     displayName: user.displayName || 'User',
//     photoURL: user.photoURL || '',
//   };
// };

// // Helper to read req.trip set by loadTrip middleware
// const getTripFromReq = (req: Request) => {
//   const trip = (req as any).trip;
//   if (!trip) throw new AppError('Trip not loaded', 500);
//   return trip;
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // TRIP CONTROLLERS
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * POST /api/v1/trips
//  * Create a new trip. Creator is auto-added as admin.
//  */
// export const createTrip = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const input = req.body as CreateTripInput;

//     const trip = await tripService.createTrip(input, {
//       uid: user.userId,
//       displayName: user.displayName,
//       photoURL: user.photoURL,
//     });
//     await trip.populate('stops');

//     res.status(201).json({
//       success: true,
//       message: 'Trip created successfully',
//       data: { trip },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * GET /api/v1/trips
//  * Get all trips for the current user.
//  * Query params: status, includeArchived
//  */
// export const getMyTrips = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { status, includeArchived, page, limit, searchName, searchUser, dateRange } = req.query;

//     const [paginatedData, stats] = await Promise.all([
//       tripService.getUserTrips(user.userId, {
//         status: status as string | undefined,
//         includeArchived: includeArchived === 'true',
//         page: page ? parseInt(page as string, 10) : undefined,
//         limit: limit ? parseInt(limit as string, 10) : undefined,
//         searchName: searchName as string | undefined,
//         searchUser: searchUser as string | undefined,
//         dateRange: dateRange as string | undefined,
//       }),
//       tripService.getUserTripStats(user.userId)
//     ]);

//     res.status(200).json({
//       success: true,
//       data: {
//         trips: paginatedData.trips,
//         pagination: {
//           totalCount: paginatedData.totalCount,
//           totalPages: paginatedData.totalPages,
//           page: page ? parseInt(page as string, 10) : 1,
//           limit: limit ? parseInt(limit as string, 10) : 10,
//         },
//         stats
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * GET /api/v1/trips/:tripId
//  * Get a single trip. User must be a member.
//  * Middleware: loadTrip, requireMember
//  */
// export const getTrip = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     await trip.populate('stops');

//     res.status(200).json({
//       success: true,
//       data: { trip },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * GET /api/v1/trips/:tripId/summary
//  * Get rich dashboard summary: stops, member balances, budget health.
//  * Middleware: loadTrip, requireMember
//  */
// export const getTripSummary = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { tripId } = req.params;
//     const summary = await tripService.getTripSummary(tripId);

//     res.status(200).json({
//       success: true,
//       data: { summary },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * PATCH /api/v1/trips/:tripId
//  * Update trip metadata. Admin only.
//  * Middleware: loadTrip, requireAdmin
//  */
// export const updateTrip = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     const input = req.body as UpdateTripInput;

//     const updated = await tripService.updateTrip(trip, input);
//     await updated.populate('stops');

//     res.status(200).json({
//       success: true,
//       message: 'Trip updated',
//       data: { trip: updated },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * DELETE /api/v1/trips/:tripId
//  * Archive a trip (soft delete). Admin only.
//  * Middleware: loadTrip, requireAdmin
//  */
// export const archiveTrip = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const trip = getTripFromReq(req);
//     await tripService.archiveTrip(trip, user.userId);

//     res.status(200).json({
//       success: true,
//       message: 'Trip archived successfully',
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/trips/:tripId/unarchive
//  * Unarchive a trip. Admin only.
//  */
// export const unarchiveTrip = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const trip = getTripFromReq(req);
//     await tripService.unarchiveTrip(trip, user.userId);

//     res.status(200).json({
//       success: true,
//       message: 'Trip unarchived successfully',
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * DELETE /api/v1/trips/:tripId/permanent
//  * Permanently delete a trip and all its expenses. Admin only.
//  */
// export const deleteTripPermanent = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const trip = getTripFromReq(req);
//     await tripService.deleteTripPermanent(trip, user.userId);

//     res.status(200).json({
//       success: true,
//       message: 'Trip permanently deleted',
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // STOP CONTROLLERS
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * POST /api/v1/trips/:tripId/stops
//  * Add a new stop to the trip.
//  * Middleware: loadTrip, requireEditor
//  */
// export const addStop = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const trip = getTripFromReq(req);
//     const input = req.body as CreateStopInput;

//     const updated = await tripService.addStop(trip, input, user.userId);
//     await updated.populate('stops');

//     // Return the newly added stop (last one in the sorted array)
//     const newStop = updated.stops[updated.stops.length - 1];

//     res.status(201).json({
//       success: true,
//       message: 'Stop added successfully',
//       data: { stop: newStop, trip: updated },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * PATCH /api/v1/trips/:tripId/stops/:stopId
//  * Update stop metadata.
//  * Middleware: loadTrip, requireEditor, loadStop
//  */
// export const updateStop = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     const { stopId } = req.params;
//     const input = req.body as UpdateStopInput;

//     const updated = await tripService.updateStop(trip, stopId, input);
//     await updated.populate('stops');
//     const stop = updated.stops.find((s) => s._id.toString() === stopId);

//     res.status(200).json({
//       success: true,
//       message: 'Stop updated',
//       data: { stop },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * PATCH /api/v1/trips/:tripId/stops/:stopId/rate
//  * Update exchange rate for a stop.
//  * Records rateLastUpdated. Does NOT change existing expenses.
//  * Middleware: loadTrip, requireEditor
//  */
// export const updateStopRate = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     const { stopId } = req.params;
//     const input = req.body as UpdateExchangeRateInput;

//     const updated = await tripService.updateStopExchangeRate(
//       trip,
//       stopId,
//       input
//     );
//     await updated.populate('stops');
//     const stop = updated.stops.find((s) => s._id.toString() === stopId);

//     res.status(200).json({
//       success: true,
//       message: 'Exchange rate updated. New expenses will use this rate.',
//       data: {
//         stop,
//         newRate: input.currentExchangeRate,
//         baseCurrency: trip.baseCurrency,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * PATCH /api/v1/trips/:tripId/stops/reorder
//  * Reorder all stops. Send full array of stopIds in desired order.
//  * Middleware: loadTrip, requireEditor
//  */
// export const reorderStops = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     const input = req.body as ReorderStopsInput;

//     const updated = await tripService.reorderStops(trip, input);
//     await updated.populate('stops');

//     res.status(200).json({
//       success: true,
//       message: 'Stops reordered',
//       data: { stops: updated.stops },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * DELETE /api/v1/trips/:tripId/stops/:stopId
//  * Delete a stop. Only allowed if stop has no expenses.
//  * Admin only.
//  * Middleware: loadTrip, requireAdmin
//  */
// export const deleteStop = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     const { stopId } = req.params;

//     // Import Expense model inline to avoid circular dependency
//     // In your project, import at top of file if no circular dep
//     const { Expense } = await import('../expense/expense.model');
//     const expenseCount = await Expense.countDocuments({ stopId });

//     await tripService.deleteStop(trip, stopId, expenseCount);

//     res.status(200).json({
//       success: true,
//       message: 'Stop deleted successfully',
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // MEMBER CONTROLLERS
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * GET /api/v1/trips/:tripId/members
//  * List all active members with their balances.
//  * Middleware: loadTrip, requireMember
//  */
// export const getMembers = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     const activeMembers = trip.getActiveMembers();

//     const members = activeMembers.map((m: any) => ({
//       userId: m.userId,
//       displayName: m.displayName,
//       photoURL: m.photoURL,
//       role: m.role,
//       joinedAt: m.joinedAt,
//       totalPaidBase: m.totalPaidBase,
//       totalOwesBase: m.totalOwesBase,
//       netBalance: m.totalPaidBase - m.totalOwesBase,
//     }));

//     res.status(200).json({
//       success: true,
//       data: {
//         members,
//         count: members.length,
//         baseCurrency: trip.baseCurrency,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * PATCH /api/v1/trips/:tripId/members/:userId/role
//  * Change a member's role. Admin only.
//  * Middleware: loadTrip, requireAdmin
//  */
// export const updateMemberRole = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const trip = getTripFromReq(req);
//     const { userId: targetUserId } = req.params;
//     const { role } = req.body as UpdateMemberRoleInput;

//     await tripService.updateMemberRole(
//       trip,
//       targetUserId,
//       role,
//       user.userId
//     );

//     res.status(200).json({
//       success: true,
//       message: `Member role updated to ${role}`,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * DELETE /api/v1/trips/:tripId/members/:userId
//  * Remove a member from the trip (soft delete).
//  * Admin can remove anyone. Members can only remove themselves.
//  * Middleware: loadTrip, requireMember
//  */
// export const removeMember = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const trip = getTripFromReq(req);
//     const { userId: targetUserId } = req.params;

//     await tripService.removeMember(
//       trip,
//       targetUserId,
//       user.userId,
//       trip.isAdmin(user.userId)
//     );

//     const isSelf = targetUserId === user.userId;
//     res.status(200).json({
//       success: true,
//       message: isSelf ? 'You have left the trip' : 'Member removed from trip',
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // INVITE CONTROLLERS
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * POST /api/v1/trips/:tripId/members
//  * Add a new member directly. Admin only.
//  */
// export const addMember = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const trip = getTripFromReq(req);
//     const { userId: targetUserId, role } = req.body;

//     // Send an invitation instead of adding directly
//     const invitation = await invitationService.sendInvitation(
//       trip._id.toString(),
//       targetUserId,
//       user.userId,
//       `You have been invited to join ${trip.title} as a ${role || 'member'}`
//     );

//     res.status(200).json({
//       success: true,
//       message: 'Invitation sent successfully',
//       data: { invitation },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/trips/join/:inviteCode
//  * Join a trip via invite code. No loadTrip middleware needed here.
//  */
// export const joinTrip = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { inviteCode } = req.params;

//     const joinRequest = await tripService.joinTripByInviteCode(inviteCode, {
//       uid: user.userId,
//       displayName: user.displayName,
//       photoURL: user.photoURL,
//     });

//     res.status(200).json({
//       success: true,
//       message: 'Join request sent successfully',
//       data: { joinRequest },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/trips/:tripId/invite/generate
//  * Generate a new invite code. Admin only.
//  * Middleware: loadTrip, requireAdmin
//  */
// // ─────────────────────────────────────────────────────────────────────────────
// // JOIN REQUEST CONTROLLERS
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * GET /api/v1/trips/:tripId/join-requests
//  * Get all pending join requests for a trip. Admin only.
//  */
// export const getPendingJoinRequests = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { tripId } = req.params;

//     const requests = await tripService.getPendingRequests(tripId, user.userId);

//     res.status(200).json({
//       success: true,
//       data: { requests, count: requests.length },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/trips/:tripId/join-requests/:requestId/approve
//  * Approve a join request. Admin only.
//  */
// export const approveJoinRequest = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { requestId } = req.params;

//     const trip = await tripService.approveJoinRequest(requestId, user.userId);

//     res.status(200).json({
//       success: true,
//       message: 'Join request approved. Member added to trip.',
//       data: { trip },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/trips/:tripId/join-requests/:requestId/reject
//  * Reject a join request. Admin only.
//  */
// export const rejectJoinRequest = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { requestId } = req.params;

//     await tripService.rejectJoinRequest(requestId, user.userId);

//     res.status(200).json({
//       success: true,
//       message: 'Join request rejected.',
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * GET /api/v1/trips/join-requests/all
//  * Get ALL pending join requests across all trips the current user admins.
//  * Used on the home screen dashboard.
//  */
// export const getAdminJoinRequests = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const requests = await tripService.getAdminPendingRequests(user.userId);

//     res.status(200).json({
//       success: true,
//       data: { requests, count: requests.length },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// export const generateInviteCode = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     const input = req.body as GenerateInviteInput;

//     const result = await tripService.regenerateInviteCode(trip, input);

//     res.status(200).json({
//       success: true,
//       message: 'New invite code generated',
//       data: {
//         inviteCode: result.inviteCode,
//         expiresAt: result.expiresAt,
//         joinUrl: `https://tripsplit.app/join/${result.inviteCode}`,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * DELETE /api/v1/trips/:tripId/invite
//  * Revoke current invite code. Admin only.
//  * Middleware: loadTrip, requireAdmin
//  */
// export const revokeInviteCode = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     await tripService.revokeInviteCode(trip);

//     res.status(200).json({
//       success: true,
//       message: 'Invite code revoked. No new members can join until a new code is generated.',
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// // /**
// //  * GET /api/v1/trips/templates
// //  * Get available trip templates with descriptions.
// //  */
// // export const getTemplates = async (
// //   req: Request,
// //   res: Response,
// //   next: NextFunction
// // ): Promise<void> => {
// //   try {
// //     const templates = tripService.getTemplates();

// //     res.status(200).json({
// //       success: true,
// //       data: { templates },
// //     });
// //   } catch (err) {
// //     next(err);
// //   }
// // };

// // /**
// //  * POST /api/v1/trips/template/:type
// //  * Create a trip from a template.
// //  */
// // export const createTripFromTemplate = async (
// //   req: Request,
// //   res: Response,
// //   next: NextFunction
// // ): Promise<void> => {
// //   try {
// //     const user = getUser(req);
// //     const { type } = req.params as { type: string };
// //     const input = req.body as CreateTripInput;

// //     const trip = await tripService.createTripFromTemplate(
// //       type as 'quick' | 'domestic' | 'international',
// //       input,
// //       {
// //         uid: user.uid,
// //         displayName: user.displayName,
// //         photoURL: user.photoURL,
// //       }
// //     );

// //     res.status(201).json({
// //       success: true,
// //       message: `Trip created using ${type} template`,
// //       data: { trip },
// //     });
// //   } catch (err) {
// //     next(err);
// //   }
// // };






// /**
//  * GET /api/v1/trips/templates
//  * Get available trip templates with descriptions.
//  */
// export const getTemplates = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const templates = tripService.getTemplates();

//     res.status(200).json({
//       success: true,
//       data: { templates },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * POST /api/v1/trips/template/:type
//  * Create a trip from a template.
//  */
// export const createTripFromTemplate = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const user = getUser(req);
//     const { type } = req.params as { type: string };
//     const input = req.body as CreateTripInput;

//     const trip = await tripService.createTripFromTemplate(
//       type as 'quick' | 'domestic' | 'international',
//       input,
//       {
//         uid: user.userId,
//         displayName: user.displayName,
//         photoURL: user.photoURL,
//       }
//     );

//     res.status(201).json({
//       success: true,
//       message: `Trip created using ${type} template`,
//       data: { trip },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * GET /api/v1/trips/:tripId/insights
//  * Get smart insights for a trip.
//  */
// export const getTripInsights = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { userId } = getUser(req);
//     const { tripId } = req.params;
//     const insights = await tripInsightsService.getTripInsights(tripId, userId);
//     res.status(200).json({ success: true, data: insights });
//   } catch (err) {
//     next(err);
//   }
// };

// /**
//  * GET /api/v1/trips/:tripId/story
//  * Generate a trip story timeline and stats.
//  */
// export const getTripStory = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const trip = getTripFromReq(req);
//     const story = await tripStoryService.generateTripStory(trip._id as string);

//     res.status(200).json({
//       success: true,
//       data: { story },
//     });
//   } catch (err) {
//     next(err);
//   }
// };
