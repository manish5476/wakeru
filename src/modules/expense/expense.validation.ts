import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

const mongoId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

const firebaseUid = z.string().min(1).max(128);

const currencyCode = z.string().length(3).toUpperCase();

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT INPUT SCHEMAS
// Each split method has its own shape — validated differently
// ─────────────────────────────────────────────────────────────────────────────

// Base member entry — used by all split types
const splitMemberBase = z.object({
  userId: firebaseUid,
  displayName: z.string().min(1).max(100),
});

// For 'equal' split — just list who's included, no amounts needed (computed server-side)
export const equalSplitInputSchema = z.object({
  method: z.literal('equal'),
  memberIds: z
    .array(firebaseUid)
    .min(1, 'At least one member must be in the split'),
});

// For 'percentage' split — each member gets a percentage
export const percentageSplitInputSchema = z.object({
  method: z.literal('percentage'),
  members: z
    .array(
      splitMemberBase.extend({
        percentage: z
          .number()
          .positive('Percentage must be positive')
          .max(100),
      })
    )
    .min(1),
});

// For 'exact' split — each member's exact amount in LOCAL currency
export const exactSplitInputSchema = z.object({
  method: z.literal('exact'),
  members: z
    .array(
      splitMemberBase.extend({
        amountLocal: z
          .number()
          .nonnegative('Split amount cannot be negative'),
      })
    )
    .min(1),
});

// For 'shares' split — weighted ratios
export const sharesSplitInputSchema = z.object({
  method: z.literal('shares'),
  members: z
    .array(
      splitMemberBase.extend({
        shares: z
          .number()
          .positive('Shares must be greater than 0'),
      })
    )
    .min(1),
});

// For 'personal' — no split, payer owns full amount. No members needed.
export const personalSplitInputSchema = z.object({
  method: z.literal('personal'),
});

// Union — discriminated on 'method' field
export const splitInputSchema = z.discriminatedUnion('method', [
  equalSplitInputSchema,
  percentageSplitInputSchema,
  exactSplitInputSchema,
  sharesSplitInputSchema,
  personalSplitInputSchema,
]);

// ─────────────────────────────────────────────────────────────────────────────
// CREATE EXPENSE
// ─────────────────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  stopId: mongoId,

  title: z
    .string()
    .trim()
    .min(1, 'Expense title is required')
    .max(200, 'Title cannot exceed 200 characters'),

  category: z
    .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
    .default('other'),

  amountLocal: z
    .number()
    .positive('Amount must be greater than 0'),

  paidBy: firebaseUid,

  date: z.coerce.date().default(() => new Date()),

  notes: z.string().max(500).optional(),

  split: splitInputSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE EXPENSE
// Only certain fields are editable — splits and amounts can be fully replaced
// ─────────────────────────────────────────────────────────────────────────────

export const updateExpenseSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z
    .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
    .optional(),
  notes: z.string().max(500).optional(),
  date: z.coerce.date().optional(),
  amountLocal: z.number().positive().optional(),
  paidBy: firebaseUid.optional(),
  split: splitInputSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// QUERY / FILTER SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const expenseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z
    .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
    .optional(),
  paidBy: firebaseUid.optional(),
  isSettled: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.enum(['date', 'amountBase', 'amountLocal']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─────────────────────────────────────────────────────────────────────────────
// PARAM SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const expenseParamSchema = z.object({
  expenseId: mongoId,
});

export const tripExpenseParamSchema = z.object({
  tripId: mongoId,
});

export const stopExpenseParamSchema = z.object({
  tripId: mongoId,
  stopId: mongoId,
});

// ─────────────────────────────────────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
export type SplitInput = z.infer<typeof splitInputSchema>;// import Joi from 'joi';

// export const createExpenseSchema = Joi.object({
//   groupId: Joi.string().required()
//     .messages({ 'any.required': 'Group ID is required' }),
//   description: Joi.string().trim().min(1).max(200).required()
//     .messages({ 'any.required': 'Description is required' }),
//   category: Joi.string().required()
//     .messages({ 'any.required': 'Category is required' }),
//   currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').default('INR'),
  
//   lineItems: Joi.array().items(Joi.object({
//     name: Joi.string().trim().min(1).max(100).required(),
//     category: Joi.string().required(),
//     basePrice: Joi.number().positive().required()
//       .messages({ 'number.positive': 'Price must be greater than 0' }),
//     quantity: Joi.number().integer().min(1).default(1),
//     consumers: Joi.array().items(Joi.object({
//       userId: Joi.string().required(),
//       consumptionPercentage: Joi.number().min(0).max(100).required(),
//       quantity: Joi.number().integer().min(1).optional(),
//       notes: Joi.string().max(100).optional()
//     })).min(1).required()
//   })).min(1).required()
//     .messages({ 'array.min': 'At least one line item is required' }),
  
//   taxes: Joi.array().items(Joi.object({
//     name: Joi.string().required(),
//     percentage: Joi.number().min(0).max(100).required(),
//     applicableTo: Joi.string().valid('all', 'specific').required(),
//     applicableItems: Joi.array().items(Joi.string()).optional(),
//     taxCode: Joi.string().optional()
//   })).optional(),
  
//   discounts: Joi.array().items(Joi.object({
//     type: Joi.string().valid('percentage', 'fixed').required(),
//     value: Joi.number().positive().required(),
//     code: Joi.string().optional(),
//     description: Joi.string().optional(),
//     applicableTo: Joi.string().valid('all', 'specific').required(),
//     applicableItems: Joi.array().items(Joi.string()).optional()
//   })).optional(),
  
//   paidBy: Joi.string().required()
//     .messages({ 'any.required': 'Payer is required' }),
//   paymentMethod: Joi.string().required()
//     .messages({ 'any.required': 'Payment method is required' }),
//   paymentDate: Joi.date().iso().optional()
// });

// export const updateExpenseSchema = Joi.object({
//   description: Joi.string().trim().min(1).max(200).optional(),
//   category: Joi.string().optional(),
//   lineItems: Joi.array().items(Joi.object({
//     name: Joi.string().trim().min(1).max(100).optional(),
//     category: Joi.string().optional(),
//     basePrice: Joi.number().positive().optional(),
//     quantity: Joi.number().integer().min(1).optional(),
//     consumers: Joi.array().items(Joi.object({
//       userId: Joi.string().required(),
//       consumptionPercentage: Joi.number().min(0).max(100).required()
//     })).min(1).optional()
//   })).min(1).optional(),
  
//   taxes: Joi.array().items(Joi.object({
//     name: Joi.string().optional(),
//     percentage: Joi.number().min(0).max(100).optional(),
//     applicableTo: Joi.string().valid('all', 'specific').optional(),
//     applicableItems: Joi.array().items(Joi.string()).optional()
//   })).optional(),
  
//   discounts: Joi.array().items(Joi.object({
//     type: Joi.string().valid('percentage', 'fixed').optional(),
//     value: Joi.number().positive().optional(),
//     applicableTo: Joi.string().valid('all', 'specific').optional(),
//     applicableItems: Joi.array().items(Joi.string()).optional()
//   })).optional()
// }).min(1).messages({
//   'object.min': 'At least one field must be provided for update'
// });

// export const getExpensesQuerySchema = Joi.object({
//   page: Joi.number().integer().min(1).default(1),
//   limit: Joi.number().integer().min(1).max(100).default(20),
//   category: Joi.string().optional(),
//   startDate: Joi.date().iso().optional(),
//   endDate: Joi.date().iso().optional(),
//   sortBy: Joi.string().valid('createdAt', 'totalAmount', 'category').default('createdAt'),
//   sortOrder: Joi.string().valid('asc', 'desc').default('desc')
// });
