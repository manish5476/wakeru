import crypto from 'crypto';
import { Types } from 'mongoose';
import { Trip, ITrip, ITripMember } from './trip.model';
import { Stop, IStop } from './stop.model';
import { User } from '../auth/auth.model';
import { JoinRequest, IJoinRequest } from './join_request.model';
import { invitationService } from './invitation.service';
import { socketServer } from '../../infrastructure/websocket/socket.server';

import {
  CreateTripInput,
  UpdateTripInput,
  CreateStopInput,
  UpdateStopInput,
  ReorderStopsInput,
  UpdateExchangeRateInput,
  GenerateInviteInput,
} from './trip.validators';
import { AppError } from '../../shared/errors/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// export type TripTemplate = 'quick' | 'domestic' | 'international';

interface TemplateConfig {
  autoCreateStop: boolean;
  stopCurrency?: string;
  allowMultiCurrency: boolean;
  description: string;
}

// const TEMPLATE_CONFIGS: Record<TripTemplate, TemplateConfig> = {
//   quick: {
//     autoCreateStop: true,
//     allowMultiCurrency: false,
//     description: 'One stop, one currency — perfect for a single destination trip',
//   },
//   domestic: {
//     autoCreateStop: false,
//     allowMultiCurrency: false,
//     description: 'Multiple stops within one country — all expenses in one currency',
//   },
//   international: {
//     autoCreateStop: false,
//     allowMultiCurrency: true,
//     description: 'Multiple countries with different currencies and exchange rates',
//   },
// };

// /**
//  * Create a trip using a template.
//  * Templates pre-configure the trip for common travel scenarios.
//  *
//  * @param template - 'quick' | 'domestic' | 'international'
//  * @param input - Trip creation data
//  * @param creator - The user creating the trip
//  */
// export const createTripFromTemplate = async (
//   template: TripTemplate,
//   input: CreateTripInput,
//   creator: UserInfo
// ): Promise<ITrip> => {
//   const config = TEMPLATE_CONFIGS[template];

//   if (!config) {
//     throw new AppError(
//       `Invalid template: ${template}. Must be quick, domestic, or international`,
//       400
//     );
//   }

//   // For Quick Trip: auto-create a matching stop
//   if (config.autoCreateStop && !input.initialStop) {
//     input.initialStop = {
//       name: input.title,
//       currency: input.baseCurrency,
//       currentExchangeRate: 1.0,
//       startDate: input.startDate,
//       endDate: input.endDate,
//     };
//   }

//   const trip = await createTrip(input, creator);

//   return trip;
// };

// /**
//  * Get available templates with descriptions.
//  * Useful for the frontend template picker screen.
//  */
// export const getTemplates = () => {
//   return Object.entries(TEMPLATE_CONFIGS).map(([key, config]) => ({
//     id: key as TripTemplate,
//     name: key === 'quick' ? 'Quick Trip'
//       : key === 'domestic' ? 'Domestic Multi-City'
//         : 'International Tour',
//     ...config,
//   }));
// };

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface UserInfo {
  uid: string;
  displayName: string;
  photoURL?: string;
}

interface TripFilters {
  status?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
  searchName?: string;
  searchUser?: string;
  dateRange?: string;
}

interface PaginatedTrips {
  trips: ITrip[];
  totalCount: number;
  totalPages: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIP CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new trip.
 * The creator is automatically added as an admin member.
 * If initialStop is provided, it is added as the first stop.
 */
// export const createTrip = async (
//   input: CreateTripInput,
//   creator: UserInfo
// ): Promise<ITrip> => {
//   const { initialStop, ...tripData } = input;

//   const creatorMember: ITripMember = {
//     userId: creator.uid,
//     displayName: creator.displayName,
//     photoURL: creator.photoURL,
//     role: 'admin',
//     joinedAt: new Date(),
//     isActive: true,
//     totalPaidBase: 0,
//     totalOwesBase: 0,
//   };

//   const trip = new Trip({
//     ...tripData,
//     createdBy: creator.uid,
//     members: [creatorMember],
//     stops: [],
//     stopCount: 0,
//     totalSpentBase: 0,
//   });

//   // If the creator included an initial stop (e.g. from Quick Trip template)
//   if (initialStop) {
//     const stop = buildStopSubdoc(initialStop, creator.uid, 0);
//     trip.stops.push(stop as any);
//     trip.stopCount = 1;
//   }

//   await trip.save();
//   return trip;
// };
export const createTrip = async (
  input: CreateTripInput,
  creator: UserInfo
): Promise<ITrip> => {
  const { initialStop, ...tripData } = input;

  const creatorMember: ITripMember = {
    userId: creator.uid,
    displayName: creator.displayName,
    photoURL: creator.photoURL,
    role: 'admin',
    joinedAt: new Date(),
    isActive: true,
    totalPaidBase: 0,
    totalOwesBase: 0,
  };

  const trip = new Trip({
    ...tripData,
    createdBy: creator.uid,
    members: [creatorMember],
    stops: [],
    stopCount: 0,
    totalSpentBase: 0,
  });

  // ✅ NEW: Handle initial members — send invitations instead of directly adding
  if (input.memberIds && input.memberIds.length > 0) {
    await trip.save(); // Must save trip first so it has an _id for the invitation

    const users = await User.find({
      _id: { $in: input.memberIds },
      isActive: true,
      isDeleted: false,
    });

    for (const u of users) {
      if ((u._id as string) !== creator.uid) {
        try {
          await invitationService.sendInvitation(
            trip._id.toString(),
            u._id.toString(),
            creator.uid,
            `${creator.displayName} invited you to join ${trip.title}`
          );
        } catch (e) {
          // Ignore duplicate invitation errors silently
        }
      }
    }
  }

  // ✅ NEW: Always ensure at least ONE stop exists
  if (initialStop) {
    const stop = buildStopSubdoc(initialStop, creator.uid, 0);
    const newStop = await Stop.create({ ...stop, tripId: trip._id });
    trip.stops.push(newStop._id as any);
  } else {
    // Auto-create a default stop matching the trip
    // This makes the trip work like a simple expense group for basic users
    const defaultStop = buildStopSubdoc(
      {
        name: tripData.title,
        currency: tripData.baseCurrency,
        currentExchangeRate: 1.0,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
      },
      creator.uid,
      0
    );
    const newStop = await Stop.create({ ...defaultStop, tripId: trip._id });
    trip.stops.push(newStop._id as any);
  }

  trip.stopCount = trip.stops.length;
  await trip.save();
  return trip;
};
/**
 * Get all trips where the user is an active member.
 * Excludes archived trips by default.
 */
export const getUserTrips = async (
  userId: string,
  filters: TripFilters = {}
): Promise<PaginatedTrips> => {
  // Auto-Complete Automation
  await Trip.updateMany(
    { 'members.userId': userId, status: { $in: ['active', 'planning'] }, endDate: { $lt: new Date() } },
    { $set: { status: 'completed' } }
  );

  const query: Record<string, unknown> = {
    'members.userId': userId,
    'members.isActive': true,
  };

  if (!filters.includeArchived) {
    query.isArchived = false;
  }

  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.searchName) {
    query.title = { $regex: filters.searchName, $options: 'i' };
  }
  
  if (filters.searchUser) {
    query['members.displayName'] = { $regex: filters.searchUser, $options: 'i' };
  }
  
  if (filters.dateRange && filters.dateRange !== 'all') {
    const now = new Date();
    if (filters.dateRange === 'upcoming') {
      query.startDate = { $gte: now };
    } else if (filters.dateRange === 'past') {
      query.endDate = { $lt: now };
    } else if (filters.dateRange === 'this_month') {
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      query.startDate = { $gte: thisMonthStart, $lt: nextMonthStart };
    }
  }

  const page = filters.page ? Number(filters.page) : 1;
  const limit = filters.limit ? Number(filters.limit) : 10;
  const skip = (page - 1) * limit;

  const totalCount = await Trip.countDocuments(query);
  const totalPages = Math.ceil(totalCount / limit);

  const trips = await Trip.find(query)
    .sort({ startDate: -1 })
    .skip(skip)
    .limit(limit)
    .populate('stops')
    .lean()
    .exec();

  return { trips: trips as unknown as ITrip[], totalCount, totalPages };
};

/**
 * Get aggregated stats across all active trips for a user.
 */
export const getUserTripStats = async (userId: string) => {
  const query = {
    'members.userId': userId,
    'members.isActive': true,
    isArchived: false,
  };

  const trips = await Trip.find(query).lean().exec();

  let activeTripsCount = 0;
  let totalSpentBase = 0;
  let totalTravelers = 0;

  for (const trip of trips) {
    if (trip.status === 'active' || trip.status === 'planning') {
      activeTripsCount++;
    }
    totalSpentBase += trip.totalSpentBase || 0;
    totalTravelers += trip.members?.length || 0;
  }

  return {
    activeTripsCount,
    totalSpentBase,
    totalCountries: 4, // Placeholder matching frontend
    totalTravelers
  };
};

/**
 * Get a single trip by ID.
 * Validates that the requesting user is a member.
 */
export const getTripById = async (
  tripId: string,
  userId: string
): Promise<ITrip> => {
  const trip = await Trip.findOne({ _id: tripId }).populate('stops');

  if (!trip) {
    throw new AppError('Trip not found', 404);
  }

  if (!trip.isMember(userId)) {
    throw new AppError('You are not a member of this trip', 403);
  }

  return trip;
};

/**
 * Update trip metadata (title, dates, budget, settings).
 * Only admins can call this.
 */
export const updateTrip = async (
  trip: ITrip,
  input: UpdateTripInput
): Promise<ITrip> => {
  const allowedFields: (keyof UpdateTripInput)[] = [
    'title',
    'description',
    'coverImage',
    'startDate',
    'endDate',
    'totalBudget',
    'defaultSplitMethod',
    'status',
  ];

  allowedFields.forEach((field) => {
    if (input[field] !== undefined) {
      (trip as any)[field] = input[field];
    }
  });

  await trip.save();
  return trip;
};

/**
 * Soft-archive a trip. Data is preserved.
 * Only admins can archive.
 */
export const archiveTrip = async (trip: ITrip, userId: string): Promise<ITrip> => {
  if (!trip.allowOthersToArchiveTrip && trip.createdBy !== userId) {
    throw new AppError('Only the trip creator can archive this trip', 403);
  }
  trip.isArchived = true;
  trip.status = 'archived';
  await trip.save();
  return trip;
};

export const unarchiveTrip = async (trip: ITrip, userId: string): Promise<ITrip> => {
  if (!trip.allowOthersToArchiveTrip && trip.createdBy !== userId) {
    throw new AppError('Only the trip creator can unarchive this trip', 403);
  }
  trip.isArchived = false;
  trip.status = 'active'; // Reset to active when unarchived
  await trip.save();
  return trip;
};

export const deleteTripPermanent = async (trip: ITrip, userId: string): Promise<void> => {
  if (!trip.allowOthersToArchiveTrip && trip.createdBy !== userId) {
    throw new AppError('Only the trip creator can delete this trip', 403);
  }
  const { Expense } = await import('../expense/expense.model');
  await Expense.deleteMany({ tripId: trip._id });
  await Trip.deleteOne({ _id: trip._id });
};

/**
 * Get a trip summary — totals by stop, per member balances.
 * Used for the main trip dashboard view.
 */
export const getTripSummary = async (tripId: string) => {
  const trip = await Trip.findById(tripId).populate('stops').lean();

  if (!trip) {
    throw new AppError('Trip not found', 404);
  }

  const stopSummaries = trip.stops.map((stop) => ({
    stopId: stop._id,
    name: stop.name,
    emoji: stop.emoji,
    currency: stop.currency,
    currentExchangeRate: stop.currentExchangeRate,
    totalSpentLocal: stop.totalSpentLocal,
    totalSpentBase: stop.totalSpentBase,
    expenseCount: stop.expenseCount,
    budget: stop.budget,
    budgetBase: stop.budgetBase,
    // Budget health: under 80% = green, 80-100% = amber, over 100% = red
    budgetHealth: stop.budget
      ? stop.totalSpentLocal / stop.budget < 0.8
        ? 'green'
        : stop.totalSpentLocal / stop.budget <= 1.0
          ? 'amber'
          : 'red'
      : null,
    order: stop.order,
  }));

  const memberSummaries = trip.members
    .filter((m) => m.isActive)
    .map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      photoURL: m.photoURL,
      role: m.role,
      totalPaidBase: m.totalPaidBase,
      totalOwesBase: m.totalOwesBase,
      // Positive = they are owed money; negative = they owe money
      netBalance: m.totalPaidBase - m.totalOwesBase,
    }));

  return {
    tripId: trip._id,
    title: trip.title,
    baseCurrency: trip.baseCurrency,
    status: trip.status,
    startDate: trip.startDate,
    endDate: trip.endDate,
    totalSpentBase: trip.totalSpentBase,
    totalBudget: trip.totalBudget,
    stopCount: trip.stopCount,
    memberCount: trip.members.filter((m) => m.isActive).length,
    stops: stopSummaries,
    members: memberSummaries,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// STOP CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a new stop to a trip.
 * Exchange rate defaults to 1.0 if stop currency === trip base currency.
 */
export const addStop = async (
  trip: ITrip,
  input: CreateStopInput,
  creatorUid: string
): Promise<ITrip> => {
  // Auto-set exchange rate to 1 if same currency as base
  if (input.currency.toUpperCase() === trip.baseCurrency.toUpperCase()) {
    input.currentExchangeRate = 1.0;
  }

  // Set order to end of list if not specified
  const order =
    input.order !== undefined ? input.order : trip.stops.length;

  const newStopData = buildStopSubdoc(input, creatorUid, order);
  const newStop = await Stop.create({ ...newStopData, tripId: trip._id });
  
  trip.stops.push(newStop._id as any);
  trip.stopCount = trip.stops.length;

  await trip.save();
  await trip.populate('stops'); // Populate to return full objects if needed

  socketServer.notifyStopAdded(
    trip._id.toString(),
    input.name,
    creatorUid
  );

  return trip;
};

/**
 * Update a stop's metadata (name, budget, dates, notes, image).
 * If exchange rate changes, records rateLastUpdated.
 */
export const updateStop = async (
  trip: ITrip,
  stopId: string,
  input: UpdateStopInput
): Promise<ITrip> => {
  const stop = await Stop.findById(stopId);

  if (!stop || stop.tripId.toString() !== trip._id.toString()) {
    throw new AppError('Stop not found in this trip', 404);
  }

  // Track when exchange rate changes
  if (
    input.currentExchangeRate !== undefined &&
    input.currentExchangeRate !== stop.currentExchangeRate
  ) {
    stop.rateLastUpdated = new Date();
  }

  const updatableFields: (keyof UpdateStopInput)[] = [
    'name',
    'emoji',
    'country',
    'location',
    'currency',
    'currentExchangeRate',
    'budget',
    'startDate',
    'endDate',
    'notes',
    'coverImage',
  ];

  updatableFields.forEach((field) => {
    if (input[field] !== undefined) {
      (stop as any)[field] = input[field];
    }
  });

  // Recompute budgetBase if budget or rate changed
  if (stop.budget !== undefined) {
    stop.budgetBase = parseFloat(
      (stop.budget * stop.currentExchangeRate).toFixed(2)
    );
  }

  await stop.save();
  await trip.populate('stops');
  return trip;
};

/**
 * Update the exchange rate for a stop.
 * Also records rateLastUpdated timestamp.
 * NOTE: This does NOT retroactively change existing expenses — they keep
 * the rate that was active when they were created.
 */
export const updateStopExchangeRate = async (
  trip: ITrip,
  stopId: string,
  input: UpdateExchangeRateInput
): Promise<ITrip> => {
  const stop = await Stop.findById(stopId);

  if (!stop || stop.tripId.toString() !== trip._id.toString()) {
    throw new AppError('Stop not found', 404);
  }

  stop.currentExchangeRate = input.currentExchangeRate;
  stop.rateLastUpdated = new Date();

  // Recompute budgetBase with new rate
  if (stop.budget !== undefined) {
    stop.budgetBase = parseFloat(
      (stop.budget * stop.currentExchangeRate).toFixed(2)
    );
  }

  await stop.save();
  await trip.populate('stops');

  socketServer.notifyExchangeRateUpdated(
    trip._id.toString(),
    stop.name,
    input.currentExchangeRate,
    stop.currency,
    trip.baseCurrency
  );

  return trip;
};

/**
 * Reorder stops by providing the full list of stopIds in the desired order.
 */
export const reorderStops = async (
  trip: ITrip,
  input: ReorderStopsInput
): Promise<ITrip> => {
  const { stopIds } = input;

  // Validate all provided IDs exist in this trip
  const existingIds = trip.stops.map((s: any) => s._id ? s._id.toString() : s.toString());
  const allValid = stopIds.every((id: string) => existingIds.includes(id));

  if (!allValid || stopIds.length !== trip.stops.length) {
    throw new AppError(
      'stopIds must include all existing stop IDs for this trip',
      400
    );
  }

  // Update order in Stop collection
  await Promise.all(
    stopIds.map((stopId: string, index: number) =>
      Stop.findByIdAndUpdate(stopId, { order: index })
    )
  );

  // Update trip.stops array order
  trip.stops.sort((a: any, b: any) => {
    const aId = a._id ? a._id.toString() : a.toString();
    const bId = b._id ? b._id.toString() : b.toString();
    return stopIds.indexOf(aId) - stopIds.indexOf(bId);
  });

  await trip.save();
  await trip.populate('stops');
  return trip;
};

/**
 * Delete a stop — only allowed if the stop has no expenses.
 * Expense check is done via the Expense model to avoid coupling here.
 */
export const deleteStop = async (
  trip: ITrip,
  stopId: string,
  expenseCount: number   // caller passes this from Expense.countDocuments({ stopId })
): Promise<ITrip> => {
  if (expenseCount > 0) {
    throw new AppError(
      'Cannot delete a stop that has expenses. Delete all expenses first.',
      400
    );
  }

  const stopIndex = trip.stops.findIndex(
    (s: any) => (s._id ? s._id.toString() : s.toString()) === stopId
  );

  if (stopIndex === -1) {
    throw new AppError('Stop not found in this trip', 404);
  }

  await Stop.findByIdAndDelete(stopId);

  trip.stops.splice(stopIndex, 1);
  trip.stopCount = trip.stops.length;

  await trip.save();
  
  // Re-normalize order values after deletion
  if (trip.stops.length > 0) {
    await Promise.all(
      trip.stops.map((s: any, i) => {
        const id = s._id ? s._id : s;
        return Stop.findByIdAndUpdate(id, { order: i });
      })
    );
  }

  await trip.populate('stops');
  return trip;
};

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Join a trip using an invite code.
 * Validates code exists and hasn't expired.
 * If user was previously a member (isActive=false), reactivates them.
 */
export const joinTripByInviteCode = async (
  inviteCode: string,
  joiner: UserInfo
): Promise<IJoinRequest> => {
  const trip = await Trip.findOne({
    inviteCode: inviteCode.toUpperCase(),
    isArchived: false,
  });

  if (!trip) {
    throw new AppError('Invalid or expired invite code', 404);
  }

  // Check expiry
  if (trip.inviteCodeExpiresAt && trip.inviteCodeExpiresAt < new Date()) {
    throw new AppError('This invite code has expired', 400);
  }

  // Check if already an active member
  if (trip.isMember(joiner.uid)) {
    throw new AppError('You are already a member of this trip', 409);
  }

  // Create a join request instead of adding them immediately
  const existingRequest = await JoinRequest.findOne({ tripId: trip._id, userId: joiner.uid });
  if (existingRequest && existingRequest.status === 'pending') {
    throw new AppError('You already have a pending join request for this trip', 409);
  }

  const joinRequest = new JoinRequest({
    tripId: trip._id,
    tripTitle: trip.title,
    userId: joiner.uid,
    userName: joiner.displayName,
    photoURL: joiner.photoURL,
    status: 'pending',
  });

  await joinRequest.save();

  // Notify admins
  const admins = trip.members.filter((m) => m.role === 'admin' && m.isActive);
  admins.forEach((admin) => {
    socketServer.sendToUser(admin.userId, 'trip:join_request', {
      type: 'TRIP_JOIN_REQUEST',
      title: 'New Join Request',
      message: `${joiner.displayName} wants to join ${trip.title}`,
      tripId: trip._id.toString(),
      requestId: joinRequest._id.toString(),
      timestamp: new Date().toISOString(),
    });
  });

  return joinRequest;
};

/**
 * Get all pending join requests for a trip (admin only).
 */
export const getPendingRequests = async (
  tripId: string,
  requestingUserId: string
): Promise<IJoinRequest[]> => {
  const trip = await getTripById(tripId, requestingUserId);
  if (!trip.isAdmin(requestingUserId)) {
    throw new AppError('Only admins can view join requests', 403);
  }

  return JoinRequest.find({ tripId: trip._id, status: 'pending' }).sort({ createdAt: -1 });
};

/**
 * Get ALL pending join requests across all trips the requesting user admins.
 * Used on the home screen to surface requests needing attention.
 */
export const getAdminPendingRequests = async (
  adminUserId: string
): Promise<IJoinRequest[]> => {
  // Find all trips where the user is an active admin
  const adminTrips = await Trip.find({
    members: {
      $elemMatch: { userId: adminUserId, role: 'admin', isActive: true },
    },
    isArchived: false,
  }).select('_id');

  const tripIds = adminTrips.map((t) => t._id);
  if (tripIds.length === 0) return [];

  return JoinRequest.find({ tripId: { $in: tripIds }, status: 'pending' }).sort({ createdAt: -1 });
};

/**
 * Approve a join request.
 */
export const approveJoinRequest = async (
  requestId: string,
  requestingUserId: string
): Promise<ITrip> => {
  const joinRequest = await JoinRequest.findById(requestId);
  if (!joinRequest) throw new AppError('Join request not found', 404);
  if (joinRequest.status !== 'pending') throw new AppError(`Request already ${joinRequest.status}`, 400);

  const trip = await getTripById(joinRequest.tripId.toString(), requestingUserId);
  if (!trip.isAdmin(requestingUserId)) {
    throw new AppError('Only admins can approve join requests', 403);
  }

  // Update request status
  joinRequest.status = 'approved';
  joinRequest.respondedAt = new Date();
  joinRequest.respondedBy = requestingUserId;
  await joinRequest.save();

  // Add the member
  const existingMember = trip.members.find(
    (m) => m.userId === joinRequest.userId && !m.isActive
  );

  if (existingMember) {
    existingMember.isActive = true;
    existingMember.displayName = joinRequest.userName;
    existingMember.photoURL = joinRequest.photoURL;
    existingMember.joinedAt = new Date();
  } else {
    trip.members.push({
      userId: joinRequest.userId,
      displayName: joinRequest.userName,
      photoURL: joinRequest.photoURL,
      role: 'member',
      joinedAt: new Date(),
      isActive: true,
      totalPaidBase: 0,
      totalOwesBase: 0,
    });
  }

  await trip.save();

  // Notify the approved user
  socketServer.sendToUser(joinRequest.userId, 'trip:join_approved', {
    type: 'TRIP_JOIN_APPROVED',
    title: 'Join Request Approved',
    message: `Your request to join ${trip.title} has been approved!`,
    tripId: trip._id.toString(),
    timestamp: new Date().toISOString(),
  });

  // Notify other members in the trip
  socketServer.sendToTrip(trip._id.toString(), 'trip:member_joined', {
    type: 'MEMBER_ADDED',
    tripId: trip._id.toString(),
    joinerName: joinRequest.userName,
    message: `${joinRequest.userName} joined the trip!`,
    timestamp: new Date().toISOString(),
  });

  return trip;
};

/**
 * Reject a join request.
 */
export const rejectJoinRequest = async (
  requestId: string,
  requestingUserId: string
): Promise<void> => {
  const joinRequest = await JoinRequest.findById(requestId);
  if (!joinRequest) throw new AppError('Join request not found', 404);
  if (joinRequest.status !== 'pending') throw new AppError(`Request already ${joinRequest.status}`, 400);

  const trip = await getTripById(joinRequest.tripId.toString(), requestingUserId);
  if (!trip.isAdmin(requestingUserId)) {
    throw new AppError('Only admins can reject join requests', 403);
  }

  joinRequest.status = 'rejected';
  joinRequest.respondedAt = new Date();
  joinRequest.respondedBy = requestingUserId;
  await joinRequest.save();

  // Notify the rejected user
  socketServer.sendToUser(joinRequest.userId, 'trip:join_rejected', {
    type: 'TRIP_JOIN_REJECTED',
    title: 'Join Request Rejected',
    message: `Your request to join ${trip.title} was declined.`,
    tripId: trip._id.toString(),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Change a member's role.
 * Cannot demote the last admin.
 * Cannot change your own role (use removeMember to leave).
 */
export const updateMemberRole = async (
  trip: ITrip,
  targetUserId: string,
  newRole: 'admin' | 'member' | 'viewer',
  requestingUserId: string
): Promise<ITrip> => {
  if (targetUserId === requestingUserId) {
    throw new AppError('You cannot change your own role', 400);
  }

  const member = trip.getMember(targetUserId);

  if (!member) {
    throw new AppError('Member not found in this trip', 404);
  }

  // Guard: cannot remove last admin
  if (member.role === 'admin' && newRole !== 'admin') {
    const adminCount = trip.members.filter(
      (m) => m.isActive && m.role === 'admin'
    ).length;

    if (adminCount <= 1) {
      throw new AppError(
        'Cannot demote the last admin. Promote another member first.',
        400
      );
    }
  }

  member.role = newRole;
  await trip.save();
  return trip;
};

/**
 * Add a member directly to a trip (without invite code).
 */
export const addMember = async (
  trip: ITrip,
  targetUserId: string,
  role: 'admin' | 'member' | 'viewer'
): Promise<ITrip> => {
  if (trip.isMember(targetUserId)) {
    throw new AppError('User is already a member of this trip', 409);
  }

  const user = await User.findOne({ _id: targetUserId, isActive: true, isDeleted: false });
  if (!user) {
    throw new AppError('User not found or inactive', 404);
  }

  // Check if previously left — reactivate instead of duplicating
  const existingMember = trip.members.find(
    (m) => m.userId === targetUserId && !m.isActive
  );

  if (existingMember) {
    existingMember.isActive = true;
    existingMember.displayName = user.displayName;
    existingMember.photoURL = user.photoURL;
    existingMember.role = role;
    existingMember.joinedAt = new Date();
  } else {
    trip.members.push({
      userId: user._id,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: role,
      joinedAt: new Date(),
      isActive: true,
      totalPaidBase: 0,
      totalOwesBase: 0,
    });
  }

  await trip.save();
  return trip;
};

/**
 * Remove a member from a trip (soft delete — isActive = false).
 * An admin can remove any member. A member can only remove themselves.
 * Cannot remove the last admin.
 */
export const removeMember = async (
  trip: ITrip,
  targetUserId: string,
  requestingUserId: string,
  requestingIsAdmin: boolean
): Promise<ITrip> => {
  const isSelfRemoval = targetUserId === requestingUserId;

  if (!isSelfRemoval && !requestingIsAdmin) {
    throw new AppError('Only admins can remove other members', 403);
  }

  const member = trip.getMember(targetUserId);

  if (!member) {
    throw new AppError('Member not found or already inactive', 404);
  }

    // Cannot remove the last admin
    if (member.role === 'admin') {
        const adminCount = trip.members.filter(
            (m) => m.isActive && m.role === 'admin'
        ).length;

        if (adminCount <= 1) {
            throw new AppError(
                'Cannot remove the last admin. Transfer admin role first.',
                400
            );
        }
    }

    if (member.totalPaidBase === 0 && member.totalOwesBase === 0) {
        // Hard Removal: No financial history, so completely delete them from the members array
        // @ts-ignore - mongoose array method
        trip.members.pull({ _id: member._id });
    } else {
        // Soft Deactivation: They have financial history, so we must keep them for historical splits
        member.isActive = false;
        // Also demote to viewer to be safe
        member.role = 'viewer';
    }

    await trip.save();
  return trip;
};

// ─────────────────────────────────────────────────────────────────────────────
// INVITE CODE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a new invite code for the trip.
 * Replaces any existing code.
 */
export const regenerateInviteCode = async (
  trip: ITrip,
  input: GenerateInviteInput
): Promise<{ inviteCode: string; expiresAt: Date }> => {
  const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

  trip.inviteCode = newCode;
  trip.inviteCodeExpiresAt = expiresAt;

  await trip.save();

  return { inviteCode: newCode, expiresAt };
};

/**
 * Revoke the current invite code (set to undefined).
 * No new members can join until a new code is generated.
 */
export const revokeInviteCode = async (trip: ITrip): Promise<void> => {
  trip.inviteCode = undefined;
  trip.inviteCodeExpiresAt = undefined;
  await trip.save();
};

// ─────────────────────────────────────────────────────────────────────────────
// CACHED TOTAL UPDATES (called by ExpenseService — not directly by controllers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Increment stop and trip-level cached totals when an expense is added.
 * Uses MongoDB $inc for atomicity — safe under concurrent requests.
 */
export const incrementStopTotals = async (
  tripId: string,
  stopId: string,
  amountLocal: number,
  amountBase: number,
  payerUid: string,
  owedAmounts: { userId: string; amountBase: number }[]
): Promise<void> => {
  // 1. Update Trip totalSpentBase
  await Trip.findByIdAndUpdate(tripId, {
    $inc: { totalSpentBase: amountBase },
  });

  // 2. Update Stop totals
  await Stop.findByIdAndUpdate(stopId, {
    $inc: {
      totalSpentBase: amountBase,
      totalSpentLocal: amountLocal,
      expenseCount: 1,
    },
  });

  // Update payer's totalPaidBase
  await Trip.findOneAndUpdate(
    { _id: tripId, 'members.userId': payerUid },
    { $inc: { 'members.$.totalPaidBase': amountBase } }
  );

  // Update each member's totalOwesBase
  for (const { userId, amountBase: owedAmount } of owedAmounts) {
    await Trip.findOneAndUpdate(
      { _id: tripId, 'members.userId': userId },
      { $inc: { 'members.$.totalOwesBase': owedAmount } }
    );
  }
};

/**
 * Reverse cached totals when an expense is deleted.
 * Exact mirror of incrementStopTotals with negative values.
 */
export const decrementStopTotals = async (
  tripId: string,
  stopId: string,
  amountLocal: number,
  amountBase: number,
  payerUid: string,
  owedAmounts: { userId: string; amountBase: number }[]
): Promise<void> => {
  // 1. Update Trip totalSpentBase
  await Trip.findByIdAndUpdate(tripId, {
    $inc: { totalSpentBase: -amountBase },
  });

  // 2. Update Stop totals
  await Stop.findByIdAndUpdate(stopId, {
    $inc: {
      totalSpentBase: -amountBase,
      totalSpentLocal: -amountLocal,
      expenseCount: -1,
    },
  });

  await Trip.findOneAndUpdate(
    { _id: tripId, 'members.userId': payerUid },
    { $inc: { 'members.$.totalPaidBase': -amountBase } }
  );

  for (const { userId, amountBase: owedAmount } of owedAmounts) {
    await Trip.findOneAndUpdate(
      { _id: tripId, 'members.userId': userId },
      { $inc: { 'members.$.totalOwesBase': -owedAmount } }
    );
  }
};



// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildStopSubdoc(
  input: CreateStopInput,
  createdBy: string,
  order: number
): Partial<IStop> {
  const budgetBase =
    input.budget !== undefined
      ? parseFloat((input.budget * (input.currentExchangeRate ?? 1)).toFixed(2))
      : undefined;

  return {
    _id: new Types.ObjectId(),
    name: input.name,
    emoji: input.emoji,
    country: input.country,
    location: input.location,
    currency: input.currency.toUpperCase(),
    currentExchangeRate: input.currentExchangeRate ?? 1.0,
    rateLastUpdated: new Date(),
    budget: input.budget,
    budgetBase,
    order,
    startDate: input.startDate,
    endDate: input.endDate,
    notes: input.notes,
    coverImage: input.coverImage,
    totalSpentLocal: 0,
    totalSpentBase: 0,
    expenseCount: 0,
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}




// ============================================================
// TEMPLATE SYSTEM
// ============================================================

export type TripTemplate = 'quick' | 'domestic' | 'international';

interface TemplateConfig {
  autoCreateStop: boolean;
  allowMultiCurrency: boolean;
  description: string;
}

const TEMPLATE_CONFIGS: Record<TripTemplate, TemplateConfig> = {
  quick: {
    autoCreateStop: true,
    allowMultiCurrency: false,
    description: 'One stop, one currency — perfect for a single destination trip',
  },
  domestic: {
    autoCreateStop: false,
    allowMultiCurrency: false,
    description: 'Multiple stops within one country — all expenses in one currency',
  },
  international: {
    autoCreateStop: false,
    allowMultiCurrency: true,
    description: 'Multiple countries with different currencies and exchange rates',
  },
};

/**
 * Get available templates with descriptions.
 */
export const getTemplates = () => {
  return Object.entries(TEMPLATE_CONFIGS).map(([key, config]) => ({
    id: key as TripTemplate,
    name: key === 'quick' ? 'Quick Trip'
      : key === 'domestic' ? 'Domestic Multi-City'
        : 'International Tour',
    ...config,
  }));
};

/**
 * Create a trip using a template.
 */
export const createTripFromTemplate = async (
  template: TripTemplate,
  input: CreateTripInput,
  creator: UserInfo
): Promise<ITrip> => {
  const config = TEMPLATE_CONFIGS[template];

  if (!config) {
    throw new AppError(
      `Invalid template: ${template}. Must be quick, domestic, or international`,
      400
    );
  }

  // For Quick Trip: auto-create a matching stop
  if (config.autoCreateStop && !input.initialStop) {
    input.initialStop = {
      name: input.title,
      currency: input.baseCurrency,
      currentExchangeRate: 1.0,
      startDate: input.startDate,
      endDate: input.endDate,
    };
  }

  const trip = await createTrip(input, creator);
  return trip;
};