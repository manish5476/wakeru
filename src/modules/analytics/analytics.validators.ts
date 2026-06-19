import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const analyticsQuerySchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    groupBy: z.enum(['day', 'week', 'month', 'year']).default('month').optional(),
    category: z.enum(['food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other']).optional(),
    tripId: mongoId.optional(),
    stopId: mongoId.optional(),
    currency: z.string().length(3).toUpperCase().optional(),
    compareWith: z.enum(['previous_period', 'previous_year']).optional(),
});

export const yearlySummarySchema = z.object({
    year: z.coerce.number().int().min(2020).max(2100),
});

export const tripAnalyticsParamSchema = z.object({
    tripId: mongoId,
});