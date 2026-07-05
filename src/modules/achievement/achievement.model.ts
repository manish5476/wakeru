import { Schema, model, Document, Types } from 'mongoose';

// ============================================================
// TYPES
// ============================================================

export type AchievementCategory =
    | 'expense_management'
    | 'budget_mastery'
    | 'social'
    | 'travel'
    | 'settlement'
    | 'streak'
    | 'special';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface IAchievementDefinition {
    achievementId: string;
    name: string;
    description: string;
    icon: string;
    category: AchievementCategory;
    tier: AchievementTier;
    pointsValue: number;
    isHidden: boolean;          // Secret achievements
    criteria: {
        type: 'count' | 'sum' | 'streak' | 'first' | 'milestone' | 'ratio';
        metric: string;          // e.g., 'expenses_added', 'total_spent', 'trips_completed'
        target: number;
        comparison: 'gte' | 'eq' | 'lte';
    }[];
    repeatable: boolean;        // Can be earned multiple times (e.g., every 100 expenses)
    cooldownDays?: number;      // Days before it can be earned again
}

export interface IUserAchievement extends Document {
    userId: string;             // Firebase UID
    achievementId: string;
    name: string;
    description: string;
    icon: string;
    category: AchievementCategory;
    tier: AchievementTier;
    pointsValue: number;
    progress: number;           // 0-100 (% complete)
    currentValue: number;       // e.g., 47 out of 50 expenses
    targetValue: number;
    isUnlocked: boolean;
    unlockedAt?: Date;
    timesEarned: number;        // For repeatable achievements
    lastEarnedAt?: Date;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface IAchievementNotification {
    userId: string;
    achievementId: string;
    name: string;
    description: string;
    icon: string;
    tier: AchievementTier;
    pointsValue: number;
    isRead: boolean;
    createdAt: Date;
}

// ============================================================
// SCHEMAS
// ============================================================

const userAchievementSchema = new Schema<IUserAchievement>(
    {
        userId: { type: String, required: true, index: true },
        achievementId: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        icon: { type: String, required: true },
        category: {
            type: String,
            enum: ['expense_management', 'budget_mastery', 'social', 'travel', 'settlement', 'streak', 'special'],
            required: true,
        },
        tier: {
            type: String,
            enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
            required: true,
        },
        pointsValue: { type: Number, default: 0 },
        progress: { type: Number, default: 0, min: 0, max: 100 },
        currentValue: { type: Number, default: 0 },
        targetValue: { type: Number, required: true },
        isUnlocked: { type: Boolean, default: false, index: true },
        unlockedAt: { type: Date },
        timesEarned: { type: Number, default: 0 },
        lastEarnedAt: { type: Date },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true, versionKey: false }
);

const achievementNotificationSchema = new Schema<IAchievementNotification>(
    {
        userId: { type: String, required: true, index: true },
        achievementId: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        icon: { type: String, required: true },
        tier: {
            type: String,
            enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
            required: true,
        },
        pointsValue: { type: Number, default: 0 },
        isRead: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
);

// Indexes
userAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
userAchievementSchema.index({ userId: 1, isUnlocked: 1 });
userAchievementSchema.index({ userId: 1, category: 1 });
achievementNotificationSchema.index({ userId: 1, isRead: 1 });

export const UserAchievement = model<IUserAchievement>('UserAchievement', userAchievementSchema);
export const AchievementNotification = model<IAchievementNotification>('AchievementNotification', achievementNotificationSchema);