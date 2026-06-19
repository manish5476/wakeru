import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

const currencyCode = z
  .string()
  .length(3, 'Currency code must be exactly 3 characters')
  .toUpperCase();

const mongoId = z
  .string()
  .min(1, 'ID is required')
  .max(128, 'ID too long');
  // Accepts both MongoDB ObjectId (24 hex) and UUID v4 strings

const firebaseUid = z
  .string()
  .min(1, 'User ID is required')
  .max(128, 'User ID too long');

// ─────────────────────────────────────────────────────────────────────────────
// STOP VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

export const createStopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Stop name is required')
    .max(100, 'Stop name cannot exceed 100 characters'),

  emoji: z.string().max(10).optional(),

  country: z
    .string()
    .length(2, 'Country must be a 2-letter ISO code')
    .toUpperCase()
    .optional(),

  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      formattedAddress: z.string().max(300),
    })
    .optional(),

  currency: currencyCode,

  currentExchangeRate: z
    .number()
    .positive('Exchange rate must be a positive number')
    .default(1.0),

  budget: z
    .number()
    .nonnegative('Budget cannot be negative')
    .optional(),

  order: z.number().int().nonnegative().optional(),

  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),

  notes: z
    .string()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional(),

  coverImage: z.string().url('Cover image must be a valid URL').optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  { message: 'Stop endDate must be on or after startDate', path: ['endDate'] }
);

export const updateStopSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  emoji: z.string().max(10).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      formattedAddress: z.string().max(300),
    })
    .optional(),
  currency: currencyCode.optional(),
  currentExchangeRate: z.number().positive().optional(),
  budget: z.number().nonnegative().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  coverImage: z.string().url().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  { message: 'Stop endDate must be on or after startDate', path: ['endDate'] }
);

export const reorderStopsSchema = z.object({
  // Array of stopId strings in the desired new order
  stopIds: z
    .array(mongoId)
    .min(1, 'At least one stop ID is required'),
});

export const updateExchangeRateSchema = z.object({
  currentExchangeRate: z
    .number()
    .positive('Exchange rate must be a positive number'),
  notes: z.string().max(500).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TRIP VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

export const createTripSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Trip title is required')
    .max(150, 'Title cannot exceed 150 characters'),

  description: z
    .string()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional(),

  coverImage: z.string().url('Cover image must be a valid URL').optional(),

  startDate: z.coerce.date({ message: 'Start date is required' }),
  endDate: z.coerce.date({ message: 'End date is required' }),

  baseCurrency: currencyCode,

  totalBudget: z
    .number()
    .nonnegative('Total budget cannot be negative')
    .optional(),

  defaultSplitMethod: z
    .enum(['equal', 'percentage', 'exact', 'shares', 'personal'])
    .default('equal'),

  memberIds: z.array(mongoId).optional(),

  // Optionally create the first stop inline during trip creation
  initialStop: createStopSchema.optional(),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

export const updateTripSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(1000).optional(),
  coverImage: z.string().url().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  totalBudget: z.number().nonnegative().optional(),
  defaultSplitMethod: z
    .enum(['equal', 'percentage', 'exact', 'shares', 'personal'])
    .optional(),
  status: z
    .enum(['planning', 'active', 'completed', 'archived'])
    .optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer'], {
    message: 'Role must be admin, member, or viewer',
  }),
});

export const addMemberSchema = z.object({
  userId: mongoId, // Accept UUID via the mongoId alias
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export const joinTripSchema = z.object({
  inviteCode: z
    .string()
    .length(8, 'Invite code must be exactly 8 characters')
    .toUpperCase(),
});

export const generateInviteSchema = z.object({
  expiresInDays: z
    .number()
    .int()
    .min(1, 'Minimum 1 day')
    .max(30, 'Maximum 30 days')
    .default(7),
});

// ─────────────────────────────────────────────────────────────────────────────
// PARAM VALIDATORS (for route params)
// ─────────────────────────────────────────────────────────────────────────────

export const tripIdParamSchema = z.object({
  tripId: mongoId,
});

export const stopIdParamSchema = z.object({
  tripId: mongoId,
  stopId: mongoId,
});

export const memberParamSchema = z.object({
  tripId: mongoId,
  userId: firebaseUid,
});

// ─────────────────────────────────────────────────────────────────────────────
// INFERRED TYPES (use these in service & controller — no duplicating interfaces)
// ─────────────────────────────────────────────────────────────────────────────

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateStopInput = z.infer<typeof createStopSchema>;
export type UpdateStopInput = z.infer<typeof updateStopSchema>;
export type ReorderStopsInput = z.infer<typeof reorderStopsSchema>;
export type UpdateExchangeRateInput = z.infer<typeof updateExchangeRateSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type JoinTripInput = z.infer<typeof joinTripSchema>;
export type GenerateInviteInput = z.infer<typeof generateInviteSchema>;
