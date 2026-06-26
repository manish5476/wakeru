import { Schema, model, Document, Types } from 'mongoose';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export type TripRole = 'admin' | 'member' | 'viewer';
export type TripStatus = 'planning' | 'active' | 'completed' | 'archived';
export type SplitMethod = 'equal' | 'percentage' | 'exact' | 'shares' | 'personal';
// 'personal' = no split, payer owns full cost, no debt created, tracked for budget only

const TRIP_ROLES: TripRole[] = ['admin', 'member', 'viewer'];
const TRIP_STATUSES: TripStatus[] = ['planning', 'active', 'completed', 'archived'];
const SPLIT_METHODS: SplitMethod[] = ['equal', 'percentage', 'exact', 'shares', 'personal'];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-DOCUMENT INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TripMember — embedded in trip.members[]
 *
 * userId is the Firebase UID (string), NOT a Mongo ObjectId.
 * This is consistent with how auth was built — Firebase UID is the primary
 * user identity across the entire app. Do NOT mix ObjectId refs and Firebase UIDs.
 *
 * displayName + photoURL are denormalized intentionally — avoids a User join
 * on every single trip list fetch, which would be expensive at scale.
 */
export interface ITripMember {
  userId: string;          // Firebase UID — e.g. "abc123xyz"
  displayName: string;     // denormalized from User
  photoURL?: string;       // denormalized from User
  role: TripRole;
  joinedAt: Date;
  isActive: boolean;       // false = left trip; history preserved, not deleted
  totalPaidBase: number;   // cached — sum of all expenses this member paid (in baseCurrency)
  totalOwesBase: number;   // cached — sum of all splits owed by this member (in baseCurrency)
}

import { IStop } from './stop.model';

// ─────────────────────────────────────────────────────────────────────────────
// TRIP DOCUMENT INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface ITrip extends Document {
  // Core fields
  title: string;
  description?: string;
  coverImage?: string;
  startDate: Date;
  endDate: Date;
  status: TripStatus;

  // Currency — the entire financial system anchors to this
  baseCurrency: string;    // e.g. "INR" — ALL analytics & settlement display in this
  template?: 'quick' | 'domestic' | 'international';

  // Budget
  totalBudget?: number;    // optional overall budget in baseCurrency

  // Ownership & membership
  createdBy: string;       // Firebase UID of the creator (auto-added as admin)
  members: ITripMember[];

  // Stops — referenced
  stops: IStop[];

  // Cached aggregates (kept in sync by Expense service via $inc — never compute here)
  stopCount: number;       // mirrors stops.length — for list views without loading stops
  totalSpentBase: number;  // sum of all stop.totalSpentBase values

  // Invite system
  inviteCode?: string;
  inviteCodeExpiresAt?: Date;

  // Settings
  defaultSplitMethod: SplitMethod;
  allowAnyPayer: boolean;
  allowOthersToArchiveTrip: boolean;
  isArchived: boolean;

  // Timestamps (auto via mongoose)
  createdAt: Date;
  updatedAt: Date;

  // ── Instance Methods ──────────────────────────────────────────────────────
  isMember(userId: string): boolean;
  getMember(userId: string): ITripMember | undefined;
  isAdmin(userId: string): boolean;
  isViewer(userId: string): boolean;
  canEdit(userId: string): boolean;      // admin or member (not viewer)
  getStop(stopId: string): IStop | undefined;
  getActiveMembers(): ITripMember[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const tripMemberSchema = new Schema<ITripMember>(
  {
    userId: {
      type: String,
      required: [true, 'userId is required for trip member'],
      index: true,
    },
    displayName: {
      type: String,
      required: [true, 'displayName is required'],
      trim: true,
      maxlength: 100,
    },
    photoURL: { type: String },
    role: {
      type: String,
      enum: { values: TRIP_ROLES, message: '{VALUE} is not a valid role' },
      default: 'member',
    },
    joinedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    totalPaidBase: { type: Number, default: 0, min: 0 },
    totalOwesBase: { type: Number, default: 0, min: 0 },
  },
  {
    _id: false,  // members are identified by userId, not their own Mongo _id
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// TRIP SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const tripSchema = new Schema<ITrip>(
  {
    title: {
      type: String,
      required: [true, 'Trip title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    coverImage: { type: String, default: 'https://i.pinimg.com/1200x/3b/3c/86/3b3c86d3cef87a6797c96c07f3dc0124.jpg' },
    template: {
      type: String,
      enum: ['quick', 'domestic', 'international'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },

    status: {
      type: String,
      enum: { values: TRIP_STATUSES, message: '{VALUE} is not a valid status' },
      default: 'active',
      index: true,
    },

    baseCurrency: {
      type: String,
      required: [true, 'Base currency is required'],
      uppercase: true,
      minlength: [3, 'Currency code must be 3 characters'],
      maxlength: [3, 'Currency code must be 3 characters'],
    },

    totalBudget: { type: Number, min: 0 },

    createdBy: {
      type: String,
      required: [true, 'createdBy (Firebase UID) is required'],
      index: true,
    },

    members: {
      type: [tripMemberSchema],
      default: [],
    },

    stops: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Stop',
      },
    ],

    // Cached aggregates — NEVER set these directly from app code.
    // Always update via:
    //   await Trip.findByIdAndUpdate(tripId, { $inc: { totalSpentBase: amount, stopCount: 1 } })
    stopCount: { type: Number, default: 0, min: 0 },
    totalSpentBase: { type: Number, default: 0 },

    // Invite
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,   // allows multiple docs with no inviteCode (null doesn't violate unique)
      index: true,
      uppercase: true,
    },
    inviteCodeExpiresAt: { type: Date },

    defaultSplitMethod: {
      type: String,
      enum: { values: SPLIT_METHODS, message: '{VALUE} is not a valid split method' },
      default: 'equal',
    },

    allowAnyPayer: {
      type: Boolean,
      default: true,
    },
    
    allowOthersToArchiveTrip: {
      type: Boolean,
      default: false,
    },

    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,         // createdAt + updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,        // removes __v field
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

// PRIMARY — "fetch all trips for a user" — hit on nearly every app open
tripSchema.index({ 'members.userId': 1, isArchived: 1 });

// SECONDARY — "fetch active trips for a user" — home screen query
tripSchema.index({ 'members.userId': 1, status: 1, isArchived: 1 });

// OPTIMIZED for getUserTrips list endpoint
tripSchema.index({ 'members.userId': 1, 'members.isActive': 1, startDate: -1 });

// DATE SORTING — trips list ordered by most recent
tripSchema.index({ startDate: -1 });

// ─────────────────────────────────────────────────────────────────────────────
// PRE-VALIDATE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

// Validate: endDate must be on or after startDate
tripSchema.pre('validate', function (next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'endDate must be on or after startDate');
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

// Auto-generate invite code on first save if not already set
tripSchema.pre('save', function (next) {
  if (!this.inviteCode) {
    // 8-character uppercase hex code — e.g. "A3F9C12B"
    this.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Default expiry: 7 days from now
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    this.inviteCodeExpiresAt = expiry;
  }
  next();
});

// Keep stopCount in sync with stops array length
// This runs on full document saves — for $inc updates, call updateStopCount() separately
tripSchema.pre('save', function (next) {
  if (this.isModified('stops')) {
    this.stopCount = this.stops.length;
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a Firebase UID is an active member of this trip
 */
tripSchema.methods.isMember = function (userId: string): boolean {
  return this.members.some(
    (m: ITripMember) => m.userId === userId && m.isActive
  );
};

/**
 * Get the full member subdoc for a Firebase UID (active members only)
 * Returns undefined if not a member or inactive
 */
tripSchema.methods.getMember = function (userId: string): ITripMember | undefined {
  return this.members.find(
    (m: ITripMember) => m.userId === userId && m.isActive
  );
};

/**
 * Check if a user has admin role on this trip
 */
tripSchema.methods.isAdmin = function (userId: string): boolean {
  const member = this.getMember(userId);
  return !!member && member.role === 'admin';
};

/**
 * Check if a user is a viewer (read-only — cannot add expenses or stops)
 */
tripSchema.methods.isViewer = function (userId: string): boolean {
  const member = this.getMember(userId);
  return !!member && member.role === 'viewer';
};

/**
 * Check if user can make changes (admin or member — not viewer, not inactive)
 * Use this guard on all POST/PATCH expense and stop endpoints
 */
tripSchema.methods.canEdit = function (userId: string): boolean {
  const member = this.getMember(userId);
  return !!member && (member.role === 'admin' || member.role === 'member');
};

/**
 * Get a specific stop by its _id string
 * Returns undefined if stop not found
 */
tripSchema.methods.getStop = function (stopId: string): IStop | undefined {
  return this.stops.find((s: IStop | Types.ObjectId) => {
    // If stops are populated, s._id exists
    if (s && typeof s === 'object' && '_id' in s) {
      return (s as IStop)._id.toString() === stopId;
    }
    // If stops are not populated, s is just the ObjectId
    return (s as any).toString() === stopId;
  }) as IStop | undefined;
};

/**
 * Get all members who are currently active (not left the trip)
 */
tripSchema.methods.getActiveMembers = function (): ITripMember[] {
  return this.members.filter((m: ITripMember) => m.isActive);
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC HELPERS (usage examples — add more as needed in tripService.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HOW TO UPDATE CACHED TOTALS — always use $inc, never load + save the full doc
 *
 * When an expense is added to a stop:
 *
 *   await Trip.findOneAndUpdate(
 *     { _id: tripId, 'stops._id': stopId },
 *     {
 *       $inc: {
 *         totalSpentBase: amountBase,                   // trip-level cache
 *         'stops.$.totalSpentBase': amountBase,         // stop-level cache (base)
 *         'stops.$.totalSpentLocal': amountLocal,       // stop-level cache (local)
 *         'stops.$.expenseCount': 1,                    // stop expense count
 *       }
 *     },
 *     { new: true }
 *   );
 *
 * When an expense is deleted, use negative values in $inc to reverse the above.
 *
 * When a member pays/owes — update member caches:
 *
 *   await Trip.findOneAndUpdate(
 *     { _id: tripId, 'members.userId': payerFirebaseUid },
 *     { $inc: { 'members.$.totalPaidBase': amountBase } }
 *   );
 */

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const Trip = model<ITrip>('Trip', tripSchema);
