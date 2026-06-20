import { z } from 'zod';

const mongoId = z.string().min(1, 'ID is required');

export const createReminderSchema = z.object({
    targetUserId: z.string().optional(),
    tripId: z.string().optional(),
    type: z.enum(['settlement', 'payment', 'budget', 'custom']),
    title: z.string().min(1, 'Title is required').max(200),
    message: z.string().min(1, 'Message is required').max(500),
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'custom_days']).default('once'),
    customDays: z.number().int().min(1).max(30).optional(),
    escalationInterval: z.number().int().min(1).max(30).optional(),
});

export const reminderParamSchema = z.object({
    reminderId: mongoId,
});