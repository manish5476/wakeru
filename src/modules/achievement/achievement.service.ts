import { Types } from 'mongoose';
import {
    UserAchievement,
    AchievementNotification,
    IUserAchievement,
    IAchievementDefinition,
} from './achievement.model';
import {
    ACHIEVEMENT_DEFINITIONS,
    getAchievementDefinition,
} from './achievement.definitions';
import { Expense, IExpense } from '../expense/expense.model';
import { Trip } from '../trips/trip.model';
import { Friendship } from '../friends/friends.model';
import { Settlement } from '../settlement/settlement.model';
import { User } from '../auth/auth.model';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { notificationService } from '../notification/notification.service';
import { logger } from '../../config/logger';

// ============================================================
// TYPES
// ============================================================

interface AchievementProgress {
    achievementId: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    tier: string;
    pointsValue: number;
    progress: number;
    currentValue: number;
    targetValue: number;
    isUnlocked: boolean;
    unlockedAt?: Date;
    isNewlyUnlocked: boolean;
}

interface UserStats {
    expenses_added: number;
    total_spent: number;
    equal_splits: number;
    personal_expenses: number;
    unique_split_methods: Set<string>;
    unique_categories_used: Set<string>;
    receipts_uploaded: number;
    trips_created: number;
    trips_completed: number;
    countries_visited: Set<string>;
    currencies_used: Set<string>;
    max_stops_in_trip: number;
    friends_count: number;
    trip_invites_sent: number;
    friends_joined_trips: number;
    daily_expense_streak: number;
    quick_settlements: number;
    fully_settled_trips: number;
    upi_payments_made: number;
    budget_compliance: number;
    daily_spend: number;
    generous_payments: number;
    night_expense: number;
    early_expense: number;
    noon_expense: number;
}

// ============================================================
// ACHIEVEMENT SERVICE
// ============================================================

export const achievementService = {
    /**
     * Check and update all achievements for a user.
     * Called after any tracked action (add expense, create trip, etc.).
     */
    async checkAchievements(
        userId: string,
        triggerAction?: string
    ): Promise<AchievementProgress[]> {
        const stats = await this._calculateUserStats(userId);
        const results: AchievementProgress[] = [];

        for (const definition of ACHIEVEMENT_DEFINITIONS) {
            const progress = this._calculateProgress(definition, stats);
            const existing = await UserAchievement.findOne({
                userId,
                achievementId: definition.achievementId,
            });

            if (existing?.isUnlocked && !definition.repeatable) {
                // Already earned non-repeatable achievement
                results.push({
                    achievementId: definition.achievementId,
                    name: definition.name,
                    description: definition.description,
                    icon: definition.icon,
                    category: definition.category,
                    tier: definition.tier,
                    pointsValue: definition.pointsValue,
                    progress: 100,
                    currentValue: existing.targetValue,
                    targetValue: existing.targetValue,
                    isUnlocked: true,
                    unlockedAt: existing.unlockedAt,
                    isNewlyUnlocked: false,
                });
                continue;
            }

            // Check cooldown for repeatable achievements
            if (existing?.isUnlocked && definition.repeatable && definition.cooldownDays) {
                const cooldownEnd = new Date(existing.lastEarnedAt!);
                cooldownEnd.setDate(cooldownEnd.getDate() + definition.cooldownDays);
                if (new Date() < cooldownEnd) {
                    // Still in cooldown
                    results.push({
                        achievementId: definition.achievementId,
                        name: definition.name,
                        description: definition.description,
                        icon: definition.icon,
                        category: definition.category,
                        tier: definition.tier,
                        pointsValue: definition.pointsValue,
                        progress: 100,
                        currentValue: existing.currentValue,
                        targetValue: existing.targetValue,
                        isUnlocked: true,
                        unlockedAt: existing.lastEarnedAt,
                        isNewlyUnlocked: false,
                    });
                    continue;
                }
            }

            // Upsert achievement progress
            const isUnlocked = progress.progress >= 100;
            const wasPreviouslyUnlocked = existing?.isUnlocked || false;
            const isNewlyUnlocked = isUnlocked && !wasPreviouslyUnlocked;

            const update = {
                userId,
                achievementId: definition.achievementId,
                name: definition.name,
                description: definition.description,
                icon: definition.icon,
                category: definition.category,
                tier: definition.tier,
                pointsValue: definition.pointsValue,
                progress: Math.min(progress.progress, 100),
                currentValue: progress.currentValue,
                targetValue: progress.targetValue,
                isUnlocked,
                unlockedAt: isUnlocked && !existing?.unlockedAt ? new Date() : existing?.unlockedAt,
                timesEarned: (existing?.timesEarned || 0) + (isNewlyUnlocked ? 1 : 0),
                lastEarnedAt: isNewlyUnlocked ? new Date() : existing?.lastEarnedAt,
                metadata: progress.metadata,
            };

            await UserAchievement.findOneAndUpdate(
                { userId, achievementId: definition.achievementId },
                { $set: update },
                { upsert: true, new: true }
            );

            // If newly unlocked, create notification
            if (isNewlyUnlocked) {
                await this._notifyAchievement(userId, definition);
            }

            results.push({
                ...update,
                isNewlyUnlocked,
            });
        }

        // Update user's total achievement points
        if (results.some(r => r.isNewlyUnlocked)) {
            await this._updateUserAchievementPoints(userId);
        }

        return results;
    },

    /**
     * Get all achievements for a user (for profile/settings page).
     */
    async getUserAchievements(userId: string): Promise<{
        achievements: IUserAchievement[];
        stats: {
            totalPoints: number;
            totalUnlocked: number;
            totalAvailable: number;
            byCategory: Record<string, { unlocked: number; total: number }>;
            recentUnlocks: IUserAchievement[];
            nextMilestones: AchievementProgress[];
        };
    }> {
        const [userAchievements, userStats] = await Promise.all([
            UserAchievement.find({ userId }).lean(),
            this._calculateUserStats(userId),
        ]);

        const allDefinitions = ACHIEVEMENT_DEFINITIONS;

        // Calculate by-category breakdown
        const byCategory: Record<string, { unlocked: number; total: number }> = {};
        for (const def of allDefinitions) {
            if (!byCategory[def.category]) {
                byCategory[def.category] = { unlocked: 0, total: 0 };
            }
            byCategory[def.category].total++;
        }
        for (const ach of userAchievements) {
            if (ach.isUnlocked && byCategory[ach.category]) {
                byCategory[ach.category].unlocked++;
            }
        }

        // Recent unlocks (last 5)
        const recentUnlocks = userAchievements
            .filter(a => a.isUnlocked && a.unlockedAt)
            .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
            .slice(0, 5);

        // Next milestones (in-progress, closest to completion)
        const inProgress = userAchievements
            .filter(a => !a.isUnlocked && a.progress > 0)
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 5)
            .map(a => ({
                achievementId: a.achievementId,
                name: a.name,
                description: a.description,
                icon: a.icon,
                category: a.category,
                tier: a.tier,
                pointsValue: a.pointsValue,
                progress: a.progress,
                currentValue: a.currentValue,
                targetValue: a.targetValue,
                isUnlocked: false,
                isNewlyUnlocked: false,
            }));

        const totalPoints = userAchievements
            .filter(a => a.isUnlocked)
            .reduce((sum, a) => sum + a.pointsValue * (a.timesEarned || 1), 0);

        return {
            achievements: userAchievements as unknown as IUserAchievement[],
            stats: {
                totalPoints,
                totalUnlocked: userAchievements.filter(a => a.isUnlocked).length,
                totalAvailable: allDefinitions.length,
                byCategory,
                recentUnlocks: recentUnlocks as unknown as IUserAchievement[],
                nextMilestones: inProgress,
            },
        };
    },

    /**
     * Get unread achievement notifications.
     */
    async getAchievementNotifications(userId: string): Promise<any[]> {
        return AchievementNotification.find({ userId, isRead: false })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
    },

    /**
     * Mark achievement notifications as read.
     */
    async markNotificationsRead(userId: string, notificationIds?: string[]): Promise<void> {
        const query: any = { userId, isRead: false };
        if (notificationIds && notificationIds.length > 0) {
            query._id = { $in: notificationIds.map(id => new Types.ObjectId(id)) };
        }
        await AchievementNotification.updateMany(query, { $set: { isRead: true } });
    },

    /**
     * Get leaderboard for a trip.
     */
    async getTripLeaderboard(tripId: string): Promise<any[]> {
        const trip = await Trip.findById(tripId);
        if (!trip) return [];

        const memberUids = trip.getActiveMembers().map(m => m.userId);

        const achievements = await UserAchievement.find({
            userId: { $in: memberUids },
            isUnlocked: true,
        }).lean();

        // Group by user and sum points
        const leaderboard = memberUids.map(uid => {
            const member = trip.getMember(uid);
            const userAchievements = achievements.filter(a => a.userId === uid);
            const totalPoints = userAchievements.reduce(
                (sum, a) => sum + a.pointsValue * (a.timesEarned || 1), 0
            );

            return {
                userId: uid,
                displayName: member?.displayName || 'Unknown',
                photoURL: member?.photoURL,
                totalPoints,
                achievementsCount: userAchievements.length,
                topAchievement: userAchievements.sort(
                    (a, b) => b.pointsValue - a.pointsValue
                )[0] || null,
            };
        }).sort((a, b) => b.totalPoints - a.totalPoints);

        return leaderboard;
    },

    // ============================================================
    // TRIGGER HOOKS (called from other services)
    // ============================================================

    /**
     * Called after expense creation.
     */
    async onExpenseCreated(expense: IExpense, userId: string): Promise<void> {
        await this.checkAchievements(userId, 'expense_created');
        await this.checkAchievements(expense.paidBy, 'expense_paid');

        // Check for night owl / early bird
        const hour = new Date(expense.date).getHours();
        if (hour >= 2 && hour <= 4) {
            await this.checkAchievements(userId, 'night_expense');
        }
        if (hour >= 4 && hour <= 6) {
            await this.checkAchievements(userId, 'early_expense');
        }
        if (hour === 12) {
            await this.checkAchievements(userId, 'noon_expense');
        }

        // Check generous payer
        if (expense.splitMethod === 'equal' || expense.splitMethod === 'percentage' || expense.splitMethod === 'exact') {
            const payerInSplit = expense.splits.some(s => s.userId === expense.paidBy);
            if (!payerInSplit) {
                await this.checkAchievements(expense.paidBy, 'generous_payment');
            }
        }

        // Update trip members' achievements too
        const trip = await Trip.findById(expense.tripId);
        if (trip) {
            for (const member of trip.getActiveMembers()) {
                if (member.userId !== userId) {
                    await this.checkAchievements(member.userId, 'trip_activity');
                }
            }
        }
    },

    /**
     * Called after trip completion.
     */
    async onTripCompleted(tripId: string): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip) return;

        for (const member of trip.getActiveMembers()) {
            await this.checkAchievements(member.userId, 'trip_completed');
        }
    },

    /**
     * Called after settlement confirmation.
     */
    async onSettlementConfirmed(tripId: string, fromUid: string, toUid: string): Promise<void> {
        await this.checkAchievements(fromUid, 'payment_made');
        await this.checkAchievements(toUid, 'payment_received');

        // Check if trip is fully settled
        const settlement = await Settlement.findOne({ tripId: new Types.ObjectId(tripId) });
        if (settlement?.isFullySettled) {
            const trip = await Trip.findById(tripId);
            const hoursSinceEnd = trip
                ? (new Date().getTime() - new Date(trip.endDate).getTime()) / (1000 * 60 * 60)
                : Infinity;
            if (hoursSinceEnd <= 24) {
                for (const member of trip?.getActiveMembers() || []) {
                    await this.checkAchievements(member.userId, 'quick_settlement');
                }
            }
            for (const member of trip?.getActiveMembers() || []) {
                await this.checkAchievements(member.userId, 'fully_settled');
            }
        }
    },

    /**
     * Called when friendship is created.
     */
    async onFriendshipCreated(user1Id: string, user2Id: string): Promise<void> {
        await this.checkAchievements(user1Id, 'friend_added');
        await this.checkAchievements(user2Id, 'friend_added');
    },

    /**
     * Called when trip invite is sent.
     */
    async onTripInviteSent(inviterUid: string, count: number): Promise<void> {
        await this.checkAchievements(inviterUid, 'trip_invite_sent');
    },

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    async _calculateUserStats(userId: string): Promise<UserStats> {
        const [
            expenses,
            trips,
            friendships,
            settlements,
            user,
        ] = await Promise.all([
            Expense.find({
                $or: [{ paidBy: userId }, { 'splits.userId': userId }],
                isArchived: false,
            }).lean(),
            Trip.find({
                'members.userId': userId,
                'members.isActive': true,
            }).lean(),
            Friendship.find({
                $or: [{ user1Id: userId }, { user2Id: userId }],
                status: 'active',
            }).lean(),
            Settlement.find({
                $or: [
                    { 'transactions.from': userId },
                    { 'transactions.to': userId },
                ],
            }).lean(),
            User.findOne({ firebaseUid: userId }).select('friendIds').lean(),
        ]);

        // Expenses stats
        const userExpenses = expenses.filter(e => e.paidBy === userId || e.addedBy === userId);
        const paidExpenses = expenses.filter(e => e.paidBy === userId);
        const splitExpenses = expenses.filter(e => e.splits.some(s => s.userId === userId));

        const uniqueSplitMethods = new Set<string>();
        const uniqueCategories = new Set<string>();
        let totalReceipts = 0;
        let equalSplits = 0;
        let personalExpenses = 0;
        let generousPayments = 0;

        expenses.forEach(e => {
            if (e.splitMethod) uniqueSplitMethods.add(e.splitMethod);
            if (e.category) uniqueCategories.add(e.category);
            totalReceipts += (e.receiptImages || []).length;

            if (e.splitMethod === 'equal') equalSplits++;
            if (e.splitMethod === 'personal') personalExpenses++;

            // Generous: paid but not in split
            if (e.paidBy === userId && e.splitMethod !== 'personal') {
                const inSplit = e.splits.some(s => s.userId === userId);
                if (!inSplit) generousPayments++;
            }
        });

        // Trip stats
        const countriesVisited = new Set<string>();
        const currenciesUsed = new Set<string>();
        let maxStops = 0;
        let tripsCompleted = 0;

        trips.forEach(t => {
            if (t.status === 'completed') tripsCompleted++;
            if (t.stops) maxStops = Math.max(maxStops, t.stops.length);
            if (t.baseCurrency) currenciesUsed.add(t.baseCurrency);
        });

        // Get unique countries from expenses
        expenses.forEach(e => {
            if (e.localCurrency && e.localCurrency !== e.baseCurrency) {
                currenciesUsed.add(e.localCurrency);
            }
        });

        // Settlement stats
        let quickSettlements = 0;
        let fullySettledTrips = 0;
        let upiPaymentsMade = 0;

        settlements.forEach(s => {
            if (s.isFullySettled) fullySettledTrips++;
            s.transactions.forEach(t => {
                if (t.from === userId && t.status === 'confirmed') {
                    upiPaymentsMade++;
                }
            });
        });

        // Streak calculation
        const dailyExpenseStreak = this._calculateStreak(expenses, userId);

        // Budget compliance
        let budgetCompliance = 0;
        const userTrips = trips.filter(t =>
            t.members.some(m => m.userId === userId && m.role === 'admin')
        );
        if (userTrips.length > 0 && userTrips[0].totalBudget) {
            const trip = userTrips[0];
            budgetCompliance = trip.totalSpentBase
                ? (trip.totalSpentBase / trip.totalBudget!) * 100
                : 0;
        }

        // Daily spend
        let dailySpend = 0;
        if (trips.length > 0) {
            const totalTripDays = trips.reduce((sum, t) => {
                const days = Math.ceil(
                    (new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 86400000
                );
                return sum + Math.max(days, 1);
            }, 0);
            const totalSpent = userExpenses.reduce((sum, e) => sum + e.amountBase, 0);
            dailySpend = totalTripDays > 0 ? totalSpent / totalTripDays : 0;
        }

        // Friend stats
        const tripInvitesSent = friendships.reduce((sum, f) => {
            return sum + (f.tripInvites?.filter(i => i.invitedBy === userId).length || 0);
        }, 0);
        const friendsJoinedTrips = friendships.reduce((sum, f) => {
            return sum + (f.tripInvites?.filter(i =>
                i.invitedBy === userId && i.status === 'going'
            ).length || 0);
        }, 0);

        // Night/Early/Noon expense
        const nightExpense = expenses.some(e => {
            const hour = new Date(e.date).getHours();
            return hour >= 2 && hour <= 4;
        }) ? 1 : 0;
        const earlyExpense = expenses.some(e => {
            const hour = new Date(e.date).getHours();
            return hour >= 4 && hour <= 6;
        }) ? 1 : 0;
        const noonExpense = expenses.some(e => {
            const hour = new Date(e.date).getHours();
            return hour === 12;
        }) ? 1 : 0;

        return {
            expenses_added: userExpenses.length,
            total_spent: paidExpenses.reduce((sum, e) => sum + e.amountBase, 0),
            equal_splits: equalSplits,
            personal_expenses: personalExpenses,
            unique_split_methods: uniqueSplitMethods,
            unique_categories_used: uniqueCategories,
            receipts_uploaded: totalReceipts,
            trips_created: trips.filter(t => t.createdBy === userId).length,
            trips_completed: tripsCompleted,
            countries_visited: countriesVisited,
            currencies_used: currenciesUsed,
            max_stops_in_trip: maxStops,
            friends_count: user?.friendIds?.length || 0,
            trip_invites_sent: tripInvitesSent,
            friends_joined_trips: friendsJoinedTrips,
            daily_expense_streak: dailyExpenseStreak,
            quick_settlements: quickSettlements,
            fully_settled_trips: fullySettledTrips,
            upi_payments_made: upiPaymentsMade,
            budget_compliance: budgetCompliance,
            daily_spend: dailySpend,
            generous_payments: generousPayments,
            night_expense: nightExpense,
            early_expense: earlyExpense,
            noon_expense: noonExpense,
        };
    },

    _calculateProgress(
        definition: IAchievementDefinition,
        stats: UserStats
    ): { progress: number; currentValue: number; targetValue: number; metadata?: any } {
        let totalProgress = 0;
        let criteriaMet = 0;

        for (const criterion of definition.criteria) {
            const metricValue = this._getMetricValue(stats, criterion.metric);
            const target = criterion.target;
            let thisProgress = 0;

            if (criterion.comparison === 'gte') {
                thisProgress = Math.min((metricValue / target) * 100, 100);
            } else if (criterion.comparison === 'lte') {
                thisProgress = metricValue <= target ? 100 : Math.max(((target / metricValue) * 100), 0);
            } else if (criterion.comparison === 'eq') {
                thisProgress = metricValue >= target ? 100 : (metricValue / target) * 100;
            }

            totalProgress += thisProgress;
            criteriaMet++;
        }

        const progress = criteriaMet > 0 ? totalProgress / criteriaMet : 0;

        // Get the primary metric value and target for display
        const primaryMetric = definition.criteria[0].metric;
        const primaryTarget = definition.criteria[0].target;
        const currentValue = this._getMetricValue(stats, primaryMetric);

        return {
            progress: Math.round(progress),
            currentValue,
            targetValue: primaryTarget,
        };
    },

    _getMetricValue(stats: UserStats, metric: string): number {
        switch (metric) {
            case 'expenses_added': return stats.expenses_added;
            case 'total_spent': return stats.total_spent;
            case 'equal_splits': return stats.equal_splits;
            case 'personal_expenses': return stats.personal_expenses;
            case 'unique_split_methods': return stats.unique_split_methods.size;
            case 'unique_categories_used': return stats.unique_categories_used.size;
            case 'receipts_uploaded': return stats.receipts_uploaded;
            case 'trips_created': return stats.trips_created;
            case 'trips_completed': return stats.trips_completed;
            case 'countries_visited': return stats.countries_visited.size;
            case 'currencies_used': return stats.currencies_used.size;
            case 'max_stops_in_trip': return stats.max_stops_in_trip;
            case 'friends_count': return stats.friends_count;
            case 'trip_invites_sent': return stats.trip_invites_sent;
            case 'friends_joined_trips': return stats.friends_joined_trips;
            case 'daily_expense_streak': return stats.daily_expense_streak;
            case 'quick_settlements': return stats.quick_settlements;
            case 'fully_settled_trips': return stats.fully_settled_trips;
            case 'upi_payments_made': return stats.upi_payments_made;
            case 'budget_compliance': return stats.budget_compliance;
            case 'daily_spend': return stats.daily_spend;
            case 'generous_payments': return stats.generous_payments;
            case 'night_expense': return stats.night_expense;
            case 'early_expense': return stats.early_expense;
            case 'noon_expense': return stats.noon_expense;
            default: return 0;
        }
    },

    _calculateStreak(expenses: any[], userId: string): number {
        if (expenses.length === 0) return 0;

        const dates = expenses
            .filter(e => e.addedBy === userId || e.paidBy === userId)
            .map(e => new Date(e.date).toISOString().split('T')[0])
            .filter((v, i, a) => a.indexOf(v) === i) // unique
            .sort()
            .reverse();

        if (dates.length === 0) return 0;

        let streak = 1;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Streak must include today or yesterday
        if (dates[0] !== today && dates[0] !== yesterday) return 0;

        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1]);
            const curr = new Date(dates[i]);
            const diffDays = (prev.getTime() - curr.getTime()) / 86400000;

            if (Math.round(diffDays) === 1) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    },

    async _notifyAchievement(
        userId: string,
        definition: IAchievementDefinition
    ): Promise<void> {
        // Save achievement notification
        await AchievementNotification.create({
            userId,
            achievementId: definition.achievementId,
            name: definition.name,
            description: definition.description,
            icon: definition.icon,
            tier: definition.tier,
            pointsValue: definition.pointsValue,
            isRead: false,
        });

        // Send WebSocket notification
        socketServer.sendToUser(userId, 'achievement:unlocked', {
            type: 'ACHIEVEMENT_UNLOCKED',
            achievementId: definition.achievementId,
            name: definition.name,
            description: definition.description,
            icon: definition.icon,
            tier: definition.tier,
            pointsValue: definition.pointsValue,
            timestamp: new Date().toISOString(),
        });

        // Create in-app notification
        const tierEmoji: Record<string, string> = {
            bronze: '🥉',
            silver: '🥈',
            gold: '🥇',
            platinum: '💎',
            diamond: '👑',
        };

        await notificationService.create(
            userId,
            'ACHIEVEMENT_UNLOCKED',
            `${tierEmoji[definition.tier] || '🏆'} Achievement Unlocked!`,
            `${definition.icon} ${definition.name}: ${definition.description}`,
            {
                data: {
                    achievementId: definition.achievementId,
                    tier: definition.tier,
                    pointsValue: definition.pointsValue,
                },
                priority: 'high',
            }
        );

        logger.info(`Achievement unlocked: ${userId} - ${definition.name}`);
    },

    async _updateUserAchievementPoints(userId: string): Promise<void> {
        const achievements = await UserAchievement.find({
            userId,
            isUnlocked: true,
        }).lean();

        const totalPoints = achievements.reduce(
            (sum, a) => sum + a.pointsValue * (a.timesEarned || 1), 0
        );

        // Store total points on User model if needed
        await User.findOneAndUpdate(
            { firebaseUid: userId },
            { $set: { 'gamification.totalPoints': totalPoints } }
        );
    },
};