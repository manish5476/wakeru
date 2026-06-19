"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopExpenseParamSchema = exports.tripExpenseParamSchema = exports.expenseParamSchema = exports.expenseListQuerySchema = exports.updateExpenseSchema = exports.createExpenseSchema = exports.splitInputSchema = exports.personalSplitInputSchema = exports.sharesSplitInputSchema = exports.exactSplitInputSchema = exports.percentageSplitInputSchema = exports.equalSplitInputSchema = void 0;
const zod_1 = require("zod");
// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
const mongoId = zod_1.z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid ID format');
const firebaseUid = zod_1.z.string().min(1).max(128);
const currencyCode = zod_1.z.string().length(3).toUpperCase();
// ─────────────────────────────────────────────────────────────────────────────
// SPLIT INPUT SCHEMAS
// Each split method has its own shape — validated differently
// ─────────────────────────────────────────────────────────────────────────────
// Base member entry — used by all split types
const splitMemberBase = zod_1.z.object({
    userId: firebaseUid,
    displayName: zod_1.z.string().min(1).max(100),
});
// For 'equal' split — just list who's included, no amounts needed (computed server-side)
exports.equalSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('equal'),
    memberIds: zod_1.z
        .array(firebaseUid)
        .min(1, 'At least one member must be in the split'),
});
// For 'percentage' split — each member gets a percentage
exports.percentageSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('percentage'),
    members: zod_1.z
        .array(splitMemberBase.extend({
        percentage: zod_1.z
            .number()
            .positive('Percentage must be positive')
            .max(100),
    }))
        .min(1),
});
// For 'exact' split — each member's exact amount in LOCAL currency
exports.exactSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('exact'),
    members: zod_1.z
        .array(splitMemberBase.extend({
        amountLocal: zod_1.z
            .number()
            .nonnegative('Split amount cannot be negative'),
    }))
        .min(1),
});
// For 'shares' split — weighted ratios
exports.sharesSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('shares'),
    members: zod_1.z
        .array(splitMemberBase.extend({
        shares: zod_1.z
            .number()
            .positive('Shares must be greater than 0'),
    }))
        .min(1),
});
// For 'personal' — no split, payer owns full amount. No members needed.
exports.personalSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('personal'),
});
// Union — discriminated on 'method' field
exports.splitInputSchema = zod_1.z.discriminatedUnion('method', [
    exports.equalSplitInputSchema,
    exports.percentageSplitInputSchema,
    exports.exactSplitInputSchema,
    exports.sharesSplitInputSchema,
    exports.personalSplitInputSchema,
]);
// ─────────────────────────────────────────────────────────────────────────────
// CREATE EXPENSE
// ─────────────────────────────────────────────────────────────────────────────
exports.createExpenseSchema = zod_1.z.object({
    stopId: mongoId,
    title: zod_1.z
        .string()
        .trim()
        .min(1, 'Expense title is required')
        .max(200, 'Title cannot exceed 200 characters'),
    category: zod_1.z
        .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
        .default('other'),
    amountLocal: zod_1.z
        .number()
        .positive('Amount must be greater than 0'),
    paidBy: firebaseUid,
    date: zod_1.z.coerce.date().default(() => new Date()),
    notes: zod_1.z.string().max(500).optional(),
    split: exports.splitInputSchema,
});
// ─────────────────────────────────────────────────────────────────────────────
// UPDATE EXPENSE
// Only certain fields are editable — splits and amounts can be fully replaced
// ─────────────────────────────────────────────────────────────────────────────
exports.updateExpenseSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(200).optional(),
    category: zod_1.z
        .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
        .optional(),
    notes: zod_1.z.string().max(500).optional(),
    date: zod_1.z.coerce.date().optional(),
    amountLocal: zod_1.z.number().positive().optional(),
    paidBy: firebaseUid.optional(),
    split: exports.splitInputSchema.optional(),
});
// ─────────────────────────────────────────────────────────────────────────────
// QUERY / FILTER SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
exports.expenseListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    category: zod_1.z
        .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
        .optional(),
    paidBy: firebaseUid.optional(),
    isSettled: zod_1.z
        .string()
        .transform((v) => v === 'true')
        .optional(),
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
    sortBy: zod_1.z.enum(['date', 'amountBase', 'amountLocal']).default('date'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
// ─────────────────────────────────────────────────────────────────────────────
// PARAM SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
exports.expenseParamSchema = zod_1.z.object({
    expenseId: mongoId,
});
exports.tripExpenseParamSchema = zod_1.z.object({
    tripId: mongoId,
});
exports.stopExpenseParamSchema = zod_1.z.object({
    tripId: mongoId,
    stopId: mongoId,
});
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
//# sourceMappingURL=expense.validation.js.map