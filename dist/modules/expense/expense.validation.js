"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markSplitPaidParamSchema = exports.tripExpenseParamSchema = exports.stopExpenseParamSchema = exports.expenseParamSchema = exports.expenseListQuerySchema = exports.updateExpenseSchema = exports.createExpenseSchema = exports.splitInputSchema = exports.personalSplitInputSchema = exports.sharesSplitInputSchema = exports.exactSplitInputSchema = exports.percentageSplitInputSchema = exports.equalSplitInputSchema = void 0;
const zod_1 = require("zod");
// ============================================================
// SHARED PRIMITIVES
// ============================================================
const mongoId = zod_1.z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid ID format');
const firebaseUid = zod_1.z.string().min(1, 'User ID is required').max(128);
// ============================================================
// SPLIT INPUT SCHEMAS (Discriminated Union)
// ============================================================
const splitMemberBase = zod_1.z.object({
    userId: firebaseUid,
    displayName: zod_1.z.string().min(1).max(100),
});
exports.equalSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('equal'),
    memberIds: zod_1.z
        .array(firebaseUid)
        .min(1, 'At least one member must be included in the split'),
});
exports.percentageSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('percentage'),
    members: zod_1.z
        .array(splitMemberBase.extend({
        percentage: zod_1.z.number().positive('Percentage must be positive').max(100),
    }))
        .min(1)
        .refine((members) => {
        const sum = members.reduce((acc, m) => acc + m.percentage, 0);
        return Math.abs(sum - 100) < 0.01;
    }, { message: 'Percentages must sum to 100' }),
});
exports.exactSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('exact'),
    members: zod_1.z
        .array(splitMemberBase.extend({
        amountLocal: zod_1.z.number().nonnegative('Amount cannot be negative'),
    }))
        .min(1),
});
exports.sharesSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('shares'),
    members: zod_1.z
        .array(splitMemberBase.extend({
        shares: zod_1.z.number().positive('Shares must be greater than 0'),
    }))
        .min(1),
});
exports.personalSplitInputSchema = zod_1.z.object({
    method: zod_1.z.literal('personal'),
});
exports.splitInputSchema = zod_1.z.discriminatedUnion('method', [
    exports.equalSplitInputSchema,
    exports.percentageSplitInputSchema,
    exports.exactSplitInputSchema,
    exports.sharesSplitInputSchema,
    exports.personalSplitInputSchema,
]);
// ============================================================
// CREATE EXPENSE SCHEMA
// ============================================================
exports.createExpenseSchema = zod_1.z.object({
    stopId: mongoId,
    title: zod_1.z
        .string()
        .trim()
        .min(1, 'Expense title is required')
        .max(200, 'Title cannot exceed 200 characters'),
    category: zod_1.z
        .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'], {
        message: 'Invalid category',
    })
        .default('other'),
    amountLocal: zod_1.z.number().positive('Amount must be greater than 0'),
    paidBy: firebaseUid,
    date: zod_1.z.coerce.date().default(() => new Date()),
    notes: zod_1.z.string().max(500).optional(),
    location: zod_1.z
        .object({
        latitude: zod_1.z.number(),
        longitude: zod_1.z.number(),
        name: zod_1.z.string().optional(),
    })
        .optional(),
    split: exports.splitInputSchema,
});
// ============================================================
// UPDATE EXPENSE SCHEMA
// ============================================================
exports.updateExpenseSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(200).optional(),
    category: zod_1.z
        .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
        .optional(),
    notes: zod_1.z.string().max(500).optional(),
    date: zod_1.z.coerce.date().optional(),
    amountLocal: zod_1.z.number().positive().optional(),
    paidBy: firebaseUid.optional(),
    location: zod_1.z
        .object({
        latitude: zod_1.z.number(),
        longitude: zod_1.z.number(),
        name: zod_1.z.string().optional(),
    })
        .optional(),
    split: exports.splitInputSchema.optional(),
});
// ============================================================
// QUERY SCHEMA
// ============================================================
exports.expenseListQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    category: zod_1.z
        .enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other'])
        .optional(),
    paidBy: firebaseUid.optional(),
    isSettled: zod_1.z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
    sortBy: zod_1.z.enum(['date', 'amountBase', 'amountLocal', 'createdAt']).default('date'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
// ============================================================
// PARAM SCHEMAS
// ============================================================
exports.expenseParamSchema = zod_1.z.object({
    expenseId: mongoId,
});
exports.stopExpenseParamSchema = zod_1.z.object({
    stopId: mongoId,
});
exports.tripExpenseParamSchema = zod_1.z.object({
    tripId: mongoId,
});
exports.markSplitPaidParamSchema = zod_1.z.object({
    expenseId: mongoId,
    userId: firebaseUid,
});
//# sourceMappingURL=expense.validation.js.map