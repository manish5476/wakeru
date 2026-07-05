import { z } from 'zod';

const mongoId = z.string().min(1, 'ID is required');
const firebaseUid = z.string().min(1, 'User ID is required').max(128);

export const createReminderSchema = z.object({
    targetUserId: firebaseUid.optional(),
    tripId: mongoId.optional(),
    expenseId: mongoId.optional(),
    settlementId: mongoId.optional(),
    type: z.enum([
        'settlement', 'payment', 'budget', 'custom',
        'expense_added', 'expense_updated', 'trip_created',
        'trip_ending', 'bill_due', 'goal_target', 'friend_request',
    ]),
    title: z.string().min(1, 'Title is required').max(200),
    message: z.string().min(1, 'Message is required').max(500),
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'custom_days']).default('once'),
    customDays: z.number().int().min(1).max(30).optional(),
    escalationInterval: z.number().int().min(1).max(30).optional(),
    escalateToGroup: z.boolean().optional(),
    channels: z.object({
        inApp: z.boolean().optional(),
        push: z.boolean().optional(),
        email: z.boolean().optional(),
        sms: z.boolean().optional(),
    }).optional(),
    maxTriggers: z.number().int().min(1).max(50).optional(),
    nextTriggerAt: z.coerce.date().optional(),
});

export const createSettlementReminderSchema = z.object({
    toUserId: firebaseUid,
    amount: z.number().positive(),
    currency: z.string().length(3).default('INR'),
    tripId: mongoId,
    expenseId: mongoId.optional(),
});

export const createBudgetReminderSchema = z.object({
    category: z.string().min(1),
    spentPercent: z.number().min(0),
    month: z.string().length(7),
});

export const pingUserSchema = z.object({
    targetUserId: firebaseUid,
    amount: z.number().positive().optional(),
    tripName: z.string().optional(),
    expenseTitle: z.string().optional(),
    message: z.string().max(500),
});

export const reminderParamSchema = z.object({
    reminderId: mongoId,
});

export const reminderQuerySchema = z.object({
    status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional(),
    type: z.string().optional(),
    tripId: mongoId.optional(),
    targetUserId: firebaseUid.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});