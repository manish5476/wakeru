import { z } from 'zod';

// ============================================================
// SHARED PRIMITIVES
// ============================================================

const mongoId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

const firebaseUid = z.string().min(1, 'User ID is required').max(128);

// ============================================================
// SPLIT INPUT SCHEMAS (Discriminated Union)
// ============================================================

const splitMemberBase = z.object({
  userId: firebaseUid,
  displayName: z.string().min(1).max(100),
});

export const equalSplitInputSchema = z.object({
  method: z.literal('equal'),
  memberIds: z
    .array(firebaseUid)
    .min(1, 'At least one member must be included in the split'),
});

export const percentageSplitInputSchema = z.object({
  method: z.literal('percentage'),
  members: z
    .array(
      splitMemberBase.extend({
        percentage: z.number().positive('Percentage must be positive').max(100),
      })
    )
    .min(1)
    .refine(
      (members) => {
        const sum = members.reduce((acc, m) => acc + m.percentage, 0);
        return Math.abs(sum - 100) < 0.01;
      },
      { message: 'Percentages must sum to 100' }
    ),
});

export const exactSplitInputSchema = z.object({
  method: z.literal('exact'),
  members: z
    .array(
      splitMemberBase.extend({
        amountLocal: z.number().nonnegative('Amount cannot be negative'),
      })
    )
    .min(1),
});

export const sharesSplitInputSchema = z.object({
  method: z.literal('shares'),
  members: z
    .array(
      splitMemberBase.extend({
        shares: z.number().positive('Shares must be greater than 0'),
      })
    )
    .min(1),
});

export const personalSplitInputSchema = z.object({
  method: z.literal('personal'),
});

export const splitInputSchema = z.discriminatedUnion('method', [
  equalSplitInputSchema,
  percentageSplitInputSchema,
  exactSplitInputSchema,
  sharesSplitInputSchema,
  personalSplitInputSchema,
]);

// ============================================================
// CREATE EXPENSE SCHEMA
// ============================================================

export const createExpenseSchema = z.object({
  stopId: mongoId,

  title: z
    .string()
    .trim()
    .min(1, 'Expense title is required')
    .max(200, 'Title cannot exceed 200 characters'),

  category: z
    .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'], {
      message: 'Invalid category',
    })
    .default('other'),

  amountLocal: z.number().positive('Amount must be greater than 0'),

  paidBy: firebaseUid,

  date: z.coerce.date().default(() => new Date()),

  notes: z.string().max(500).optional(),

  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
    })
    .optional(),

  split: splitInputSchema,
});

// ============================================================
// UPDATE EXPENSE SCHEMA
// ============================================================

export const updateExpenseSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z
    .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
    .optional(),
  notes: z.string().max(500).optional(),
  date: z.coerce.date().optional(),
  amountLocal: z.number().positive().optional(),
  paidBy: firebaseUid.optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
    })
    .optional(),
  split: splitInputSchema.optional(),
});

// ============================================================
// QUERY SCHEMA
// ============================================================

export const expenseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z
    .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
    .optional(),
  paidBy: firebaseUid.optional(),
  tripId: mongoId.optional(),
  personId: firebaseUid.optional(),
  type: z.enum(['you_owe', 'you_paid', 'unsettled', 'settled', 'all']).optional(),
  isSettled: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.enum(['date', 'amountBase', 'amountLocal', 'createdAt', 'tripId', 'paidBy']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

export const expenseParamSchema = z.object({
  expenseId: mongoId,
});

export const stopExpenseParamSchema = z.object({
  stopId: mongoId,
});

export const tripExpenseParamSchema = z.object({
  tripId: mongoId,
});

export const markSplitPaidParamSchema = z.object({
  expenseId: mongoId,
  userId: firebaseUid,
});

// ============================================================
// INFERRED TYPES
// ============================================================

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
export type SplitInput = z.infer<typeof splitInputSchema>;