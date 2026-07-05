import { Expense, IExpense } from './expense.model';
import { Trip } from '../trips/trip.model';
import { AppError } from '../../shared/errors/AppError';
import { ExpenseCategory, SplitMethod } from './expense.model';
import { logger } from '../../config/logger';

// ============================================================
// TYPES
// ============================================================

interface QuickAction {
    id: string;
    title: string;
    icon: string;
    amount?: number;
    category: ExpenseCategory;
    splitMethod?: SplitMethod;
    isTemplate: boolean;
    usageCount?: number;
}

interface ExpenseTemplate {
    id: string;
    userId: string;
    title: string;
    icon: string;
    category: ExpenseCategory;
    defaultAmount?: number;
    splitMethod: SplitMethod;
    splitConfig: {
        memberIds?: string[];
        percentages?: { userId: string; percentage: number }[];
        shares?: { userId: string; shares: number }[];
    };
    tags: string[];
    usageCount: number;
    lastUsedAt: Date;
    tripId?: string; // null = global template
    createdAt: Date;
    updatedAt: Date;
}

// ============================================================
// TIME-BASED QUICK ACTIONS
// ============================================================

const TIME_BASED_ACTIONS: Record<string, QuickAction[]> = {
    morning: [
        { id: 'morning_chai', title: '☕ Morning Chai', icon: '☕', amount: 30, category: 'food', isTemplate: false },
        { id: 'morning_breakfast', title: '🍳 Breakfast', icon: '🍳', amount: 200, category: 'food', isTemplate: false },
        { id: 'morning_transport', title: '🚗 Morning Transport', icon: '🚗', amount: 150, category: 'transport', isTemplate: false },
    ],
    afternoon: [
        { id: 'afternoon_lunch', title: '🍱 Lunch', icon: '🍱', amount: 300, category: 'food', isTemplate: false },
        { id: 'afternoon_cafe', title: '☕ Cafe Break', icon: '☕', amount: 150, category: 'food', isTemplate: false },
        { id: 'afternoon_shopping', title: '🛍️ Shopping', icon: '🛍️', amount: 500, category: 'shopping', isTemplate: false },
    ],
    evening: [
        { id: 'evening_dinner', title: '🍽️ Dinner', icon: '🍽️', amount: 500, category: 'food', isTemplate: false },
        { id: 'evening_drinks', title: '🍺 Drinks', icon: '🍺', amount: 300, category: 'food', isTemplate: false },
        { id: 'evening_taxi', title: '🚕 Evening Taxi', icon: '🚕', amount: 200, category: 'transport', isTemplate: false },
    ],
    night: [
        { id: 'night_snack', title: '🌙 Late Night Snack', icon: '🌙', amount: 100, category: 'food', isTemplate: false },
        { id: 'night_ride', title: '🚗 Night Ride', icon: '🚗', amount: 250, category: 'transport', isTemplate: false },
    ],
};

// Common expense templates
const DEFAULT_TEMPLATES: Omit<ExpenseTemplate, 'userId' | 'usageCount' | 'lastUsedAt' | 'createdAt' | 'updatedAt'>[] = [
    {
        id: 'template_equal_meal',
        title: 'Split Meal Equally',
        icon: '🍽️',
        category: 'food',
        splitMethod: 'equal',
        splitConfig: {},
        tags: ['food', 'frequent'],
    },
    {
        id: 'template_personal_taxi',
        title: 'Personal Taxi Ride',
        icon: '🚕',
        category: 'transport',
        splitMethod: 'personal',
        splitConfig: {},
        tags: ['transport', 'personal'],
    },
    {
        id: 'template_group_activity',
        title: 'Group Activity',
        icon: '🎯',
        category: 'activity',
        splitMethod: 'equal',
        splitConfig: {},
        tags: ['activity', 'group'],
    },
    {
        id: 'template_hotel_room',
        title: 'Hotel/Airbnb',
        icon: '🏨',
        category: 'stay',
        splitMethod: 'equal',
        splitConfig: {},
        tags: ['stay', 'big_expense'],
    },
];

// ============================================================
// SERVICE
// ============================================================

export const expenseTemplatesService = {
    /**
     * Get quick actions based on time of day + frequent templates.
     */
    async getQuickActions(tripId: string, userId: string): Promise<QuickAction[]> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new AppError('Trip not found', 404);

        const actions: QuickAction[] = [];

        // 1. Time-based actions
        const hour = new Date().getHours();
        if (hour >= 6 && hour <= 10) {
            actions.push(...TIME_BASED_ACTIONS.morning);
        } else if (hour >= 11 && hour <= 15) {
            actions.push(...TIME_BASED_ACTIONS.afternoon);
        } else if (hour >= 16 && hour <= 21) {
            actions.push(...TIME_BASED_ACTIONS.evening);
        } else {
            actions.push(...TIME_BASED_ACTIONS.night);
        }

        // 2. Recent/frequent templates
        const recentTemplates = await this.getUserTemplates(userId, tripId);
        const topTemplates = recentTemplates
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, 5)
            .map(t => ({
                id: t.id,
                title: `⭐ ${t.title}`,
                icon: t.icon,
                amount: t.defaultAmount,
                category: t.category,
                splitMethod: t.splitMethod,
                isTemplate: true,
                usageCount: t.usageCount,
            }));

        actions.push(...topTemplates);

        return actions.slice(0, 10); // Max 10 actions
    },

    /**
     * Get user's templates (both global and trip-specific).
     */
    async getUserTemplates(userId: string, tripId?: string): Promise<ExpenseTemplate[]> {
        // In a real implementation, these would be stored in a collection
        // For now, return default templates adapted for the user
        const existingTemplates = DEFAULT_TEMPLATES.map(t => ({
            ...t,
            userId,
            tripId,
            usageCount: Math.floor(Math.random() * 20),
            lastUsedAt: new Date(Date.now() - Math.random() * 7 * 86400000),
            createdAt: new Date(Date.now() - 30 * 86400000),
            updatedAt: new Date(),
        }));

        return existingTemplates;
    },

    /**
     * Save a new template from an existing expense.
     */
    async saveAsTemplate(expenseId: string, userId: string, title: string, icon: string): Promise<void> {
        const expense = await Expense.findById(expenseId);
        if (!expense) throw new AppError('Expense not found', 404);
        if (expense.paidBy !== userId) throw new AppError('Only the payer can save templates', 403);

        // In production, save to ExpenseTemplate collection
        logger.info(`Template saved: ${title} from expense ${expenseId}`);
    },

    /**
     * Create expense from template.
     */
    async createFromTemplate(
        templateId: string,
        tripId: string,
        stopId: string,
        userId: string,
        overrides?: { amountLocal?: number; notes?: string }
    ) {
        const templates = await this.getUserTemplates(userId, tripId);
        const template = templates.find(t => t.id === templateId);

        if (!template) throw new AppError('Template not found', 404);

        return {
            stopId,
            title: template.title,
            category: template.category,
            amountLocal: overrides?.amountLocal || template.defaultAmount || 0,
            notes: overrides?.notes,
            paidBy: userId,
            split: {
                method: template.splitMethod,
                ...template.splitConfig,
            },
            tags: template.tags,
        };
    },
};