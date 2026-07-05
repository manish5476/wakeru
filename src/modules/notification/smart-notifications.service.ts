import { User } from '../auth/auth.model';
import { Trip } from '../trips/trip.model';
import { Expense } from '../expense/expense.model';
import { Settlement } from '../settlement/settlement.model';
import { Friendship } from '../friends/friends.model';
import { notificationService } from '../notification/notification.service';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { logger } from '../../config/logger';

// ============================================================
// TYPES
// ============================================================

interface NotificationRule {
    id: string;
    name: string;
    trigger: 'scheduled' | 'event' | 'condition';
    condition: (context: any) => Promise<boolean>;
    buildNotification: (context: any) => {
        title: string;
        message: string;
        priority: 'low' | 'medium' | 'high';
        data?: any;
    };
    cooldownHours: number; // Don't send again within this period
    enabled: boolean;
}

// ============================================================
// SMART NOTIFICATION RULES
// ============================================================

const SMART_RULES: NotificationRule[] = [
    {
        id: 'forgot_expense',
        name: 'Forgot to add expense?',
        trigger: 'scheduled',
        enabled: true,
        cooldownHours: 24,
        condition: async (ctx: { userId: string }) => {
            // Check if user added any expense today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const count = await Expense.countDocuments({
                addedBy: ctx.userId,
                createdAt: { $gte: today },
            });
            return count === 0;
        },
        buildNotification: () => ({
            title: 'No expenses today? 📝',
            message: 'Don\'t forget to log your expenses for today!',
            priority: 'low',
        }),
    },
    {
        id: 'budget_warning',
        name: 'Budget Warning',
        trigger: 'event',
        enabled: true,
        cooldownHours: 12,
        condition: async (ctx: { tripId: string }) => {
            const trip = await Trip.findById(ctx.tripId);
            if (!trip?.totalBudget || !trip.totalSpentBase) return false;
            const pctUsed = (trip.totalSpentBase / trip.totalBudget) * 100;
            return pctUsed >= 80 && pctUsed < 100;
        },
        buildNotification: (ctx: { tripId: string }) => {
            const trip = ctx as any;
            const pct = ((trip.totalSpentBase / trip.totalBudget) * 100).toFixed(0);
            return {
                title: `Budget at ${pct}%! ⚠️`,
                message: `${pct}% of your budget used with ${trip.daysRemaining} days remaining`,
                priority: 'high',
                data: { tripId: ctx.tripId },
            };
        },
    },
    {
        id: 'settlement_reminder',
        name: 'Settle Up Reminder',
        trigger: 'condition',
        enabled: true,
        cooldownHours: 48,
        condition: async (ctx: { userId: string }) => {
            // Find trips where user owes money and trip ended 3+ days ago
            const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
            const trips = await Trip.find({
                'members.userId': ctx.userId,
                endDate: { $lte: threeDaysAgo },
                status: { $ne: 'archived' },
            });

            for (const trip of trips) {
                const settlement = await Settlement.findOne({ tripId: trip._id });
                if (settlement) {
                    const hasPending = settlement.transactions.some(
                        t => t.from === ctx.userId && t.status !== 'confirmed'
                    );
                    if (hasPending) return true;
                }
            }
            return false;
        },
        buildNotification: (ctx: { userId: string }) => ({
            title: 'Time to settle up! 💰',
            message: 'You have pending payments from completed trips',
            priority: 'high',
            data: { screen: 'settlements' },
        }),
    },
    {
        id: 'weekend_trip_reminder',
        name: 'Weekend Trip Reminder',
        trigger: 'scheduled',
        enabled: true,
        cooldownHours: 168, // Weekly
        condition: async (ctx: { userId: string }) => {
            const today = new Date().getDay();
            return today === 5; // Friday
        },
        buildNotification: () => ({
            title: 'Weekend plans? 🎉',
            message: 'Create a trip for this weekend and start tracking expenses!',
            priority: 'medium',
        }),
    },
    {
        id: 'friend_activity',
        name: 'Friend Started a Trip',
        trigger: 'event',
        enabled: true,
        cooldownHours: 24,
        condition: async (ctx: { userId: string; friendUserId: string }) => {
            const friendship = await Friendship.findOne({
                $or: [
                    { user1Id: ctx.userId, user2Id: ctx.friendUserId },
                    { user2Id: ctx.userId, user1Id: ctx.friendUserId },
                ],
                status: 'active',
            });
            return !!friendship;
        },
        buildNotification: (ctx: { friendName: string; tripTitle: string; tripId: string }) => ({
            title: `${ctx.friendName} started a trip! 🧳`,
            message: `${ctx.friendName} is planning "${ctx.tripTitle}"`,
            priority: 'medium',
            data: { tripId: ctx.tripId },
        }),
    },
];

// ============================================================
// SERVICE
// ============================================================

export const smartNotificationService = {
    /**
     * Run scheduled checks (called by cron job every hour).
     */
    async runScheduledChecks(): Promise<void> {
        logger.info('Running scheduled notification checks...');

        // Get active users (logged in within last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const activeUsers = await User.find({
            isActive: true,
            isDeleted: false,
            lastLoginAt: { $gte: sevenDaysAgo },
        }).select('firebaseUid').lean();

        const scheduledRules = SMART_RULES.filter(r => r.trigger === 'scheduled' && r.enabled);

        for (const user of activeUsers) {
            for (const rule of scheduledRules) {
                try {
                    const shouldNotify = await rule.condition({ userId: user.firebaseUid });
                    if (shouldNotify) {
                        const notification = rule.buildNotification({ userId: user.firebaseUid });
                        await this._sendNotification(user.firebaseUid, rule, notification);
                    }
                } catch (error) {
                    logger.error(`Notification rule ${rule.id} failed for user ${user.firebaseUid}:`, error);
                }
            }
        }

        logger.info(`Scheduled checks complete for ${activeUsers.length} users`);
    },

    /**
     * Trigger event-based notification.
     */
    async triggerEvent(eventType: string, context: any): Promise<void> {
        const eventRules = SMART_RULES.filter(
            r => r.trigger === 'event' && r.enabled && r.id.includes(eventType) || r.id === eventType
        );

        for (const rule of eventRules) {
            try {
                const shouldNotify = await rule.condition(context);
                if (shouldNotify) {
                    const notification = rule.buildNotification(context);
                    const userId = context.userId || context.toUserId;
                    await this._sendNotification(userId, rule, notification);
                }
            } catch (error) {
                logger.error(`Event notification ${rule.id} failed:`, error);
            }
        }
    },

    /**
     * Send notification with cooldown check.
     */
    async _sendNotification(
        userId: string,
        rule: NotificationRule,
        notification: { title: string; message: string; priority: string; data?: any }
    ): Promise<void> {
        // In production, check cooldown in Redis/cache
        // For now, just send
        await notificationService.create(
            userId,
            rule.id.toUpperCase(),
            notification.title,
            notification.message,
            {
                data: notification.data || {},
                priority: notification.priority as any,
            }
        );

        socketServer.sendToUser(userId, 'notification:smart', {
            type: rule.id,
            ...notification,
            timestamp: new Date().toISOString(),
        });

        logger.info(`Smart notification sent: ${rule.id} → ${userId}`);
    },

    /**
     * Get all rules (for admin/settings page).
     */
    getRules(): Omit<NotificationRule, 'condition' | 'buildNotification'>[] {
        return SMART_RULES.map(r => {
            const { condition, buildNotification, ...rest } = r;
            return rest;
        });
    },
};