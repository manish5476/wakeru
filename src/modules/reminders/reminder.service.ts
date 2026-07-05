import { Types } from 'mongoose';
import { Reminder, IReminder, ReminderType } from './reminder.model';
import { User } from '../auth/auth.model';
import { Trip } from '../trips/trip.model';
import { Expense } from '../expense/expense.model';
import { Settlement } from '../settlement/settlement.model';
import { Bill } from '../finance/finance.model';
import { AppError } from '../../shared/errors/AppError';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { notificationService } from '../notification/notification.service';
import { logger } from '../../config/logger';

// ============================================================
// ESCALATION TEMPLATES
// ============================================================

const ESCALATION_TEMPLATES = [
    {
        level: 0,
        prefix: '💡 Gentle Reminder',
        tone: 'friendly',
        channels: { push: true, email: false, sms: false },
    },
    {
        level: 1,
        prefix: '📣 Friendly Follow-up',
        tone: 'firm',
        channels: { push: true, email: true, sms: false },
    },
    {
        level: 2,
        prefix: '⚠️ Urgent Reminder',
        tone: 'urgent',
        channels: { push: true, email: true, sms: true },
    },
    {
        level: 3,
        prefix: '🚨 Final Notice',
        tone: 'critical',
        channels: { push: true, email: true, sms: true },
    },
];

// ============================================================
// SERVICE
// ============================================================

export const reminderService = {

    // ============================================================
    // CREATE
    // ============================================================

    async create(
        userId: string,
        data: {
            targetUserId?: string;
            tripId?: string;
            expenseId?: string;
            settlementId?: string;
            type: ReminderType | string;
            title: string;
            message: string;
            frequency?: string;
            customDays?: number;
            escalationInterval?: number;
            escalateToGroup?: boolean;
            channels?: Partial<{ inApp: boolean; push: boolean; email: boolean; sms: boolean }>;
            maxTriggers?: number;
            nextTriggerAt?: Date;
        }
    ): Promise<IReminder> {
        let tripName: string | undefined;
        let expenseTitle: string | undefined;
        let targetUserName: string | undefined;

        // Resolve linked entities
        if (data.tripId) {
            const trip = await Trip.findById(data.tripId).select('title').lean();
            tripName = trip?.title;
        }
        if (data.expenseId) {
            const expense = await Expense.findById(data.expenseId).select('title').lean();
            expenseTitle = expense?.title;
        }
        if (data.targetUserId) {
            const user = await User.findOne({ firebaseUid: data.targetUserId })
                .select('displayName')
                .lean();
            targetUserName = user?.displayName;
        }

        const nextTriggerAt = data.nextTriggerAt ||
            this.calculateNextTrigger(data.frequency || 'once', data.customDays);

        const reminder = new Reminder({
            userId,
            targetUserId: data.targetUserId,
            targetUserName,
            tripId: data.tripId ? new Types.ObjectId(data.tripId) : undefined,
            tripName,
            expenseId: data.expenseId ? new Types.ObjectId(data.expenseId) : undefined,
            expenseTitle,
            settlementId: data.settlementId ? new Types.ObjectId(data.settlementId) : undefined,
            type: data.type,
            title: data.title,
            message: data.message,
            frequency: data.frequency || 'once',
            customDays: data.customDays,
            nextTriggerAt,
            escalationLevel: 0,
            escalationInterval: data.escalationInterval || 3,
            escalateToGroup: data.escalateToGroup || false,
            channels: {
                inApp: data.channels?.inApp ?? true,
                push: data.channels?.push ?? true,
                email: data.channels?.email ?? false,
                sms: data.channels?.sms ?? false,
            },
            maxTriggers: data.maxTriggers || 10,
            status: 'active',
            triggerCount: 0,
        });

        await reminder.save();
        logger.info(`Reminder created: ${reminder._id} type=${data.type} by ${userId}`);
        return reminder;
    },

    // ============================================================
    // CONVENIENCE: Create reminders for common scenarios
    // ============================================================

    /**
     * Create a settlement reminder for a trip member.
     */
    async createSettlementReminder(
        fromUid: string,
        toUid: string,
        amount: number,
        currency: string,
        tripId: string,
        expenseId?: string
    ): Promise<IReminder> {
        const trip = await Trip.findById(tripId).select('title').lean();
        const toUser = await User.findOne({ firebaseUid: toUid }).select('displayName').lean();

        return this.create(fromUid, {
            targetUserId: toUid,
            tripId,
            expenseId,
            type: 'settlement',
            title: `Settle up for ${trip?.title || 'trip'}`,
            message: `${toUser?.displayName || 'Friend'} owes you ${currency} ${amount}. Please settle soon!`,
            frequency: 'daily',
            escalationInterval: 2,
            escalateToGroup: true,
            channels: { push: true, email: true },
            maxTriggers: 7,
        });
    },

    /**
     * Create a bill due reminder.
     */
    async createBillDueReminder(userId: string, billId: string): Promise<IReminder> {
        const { Bill } = await import('../finance/finance.model');
        const bill = await Bill.findById(billId);
        if (!bill) throw new AppError('Bill not found', 404);

        return this.create(userId, {
            type: 'bill_due',
            title: `Bill Due: ${bill.title}`,
            message: `Your ${bill.title} bill of ${bill.currency} ${bill.amount} is due on ${bill.dueDate.toLocaleDateString()}`,
            frequency: 'daily',
            nextTriggerAt: new Date(bill.dueDate.getTime() - bill.reminderDays * 86400000),
            maxTriggers: bill.reminderDays + 3,
            channels: { push: true, email: true },
        });
    },

    /**
     * Create a budget warning reminder.
     */
    async createBudgetReminder(
        userId: string,
        category: string,
        spentPercent: number,
        month: string
    ): Promise<IReminder> {
        const isExceeded = spentPercent >= 100;
        return this.create(userId, {
            type: 'budget',
            title: isExceeded ? '🚨 Budget Exceeded!' : '⚠️ Budget Warning',
            message: isExceeded
                ? `You've exceeded your ${category} budget! ${spentPercent.toFixed(0)}% used.`
                : `You've used ${spentPercent.toFixed(0)}% of your ${category} budget.`,
            frequency: 'daily',
            escalationInterval: 1,
            maxTriggers: isExceeded ? 5 : 3,
            channels: { push: true },
        });
    },

    /**
     * Create a goal progress reminder.
     */
    async createGoalReminder(userId: string, goalId: string, progress: number): Promise<IReminder> {
        const { Goal } = await import('../finance/finance.model');
        const goal = await Goal.findById(goalId);
        if (!goal) throw new AppError('Goal not found', 404);

        const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000);
        const remaining = goal.targetAmount - goal.savedAmount;

        return this.create(userId, {
            type: 'goal_target',
            title: `Goal Progress: ${goal.title}`,
            message: `${progress.toFixed(0)}% complete! ${goal.currency} ${remaining} remaining in ${daysLeft} days.`,
            frequency: 'weekly',
            maxTriggers: Math.ceil(daysLeft / 7),
            channels: { push: true, email: true },
        });
    },

    /**
     * Create a trip ending soon reminder.
     */
    async createTripEndingReminder(tripId: string): Promise<void> {
        const trip = await Trip.findById(tripId).populate('members');
        if (!trip) return;

        const daysLeft = Math.ceil((new Date(trip.endDate).getTime() - Date.now()) / 86400000);
        if (daysLeft > 3 || daysLeft < 0) return;

        for (const member of trip.members) {
            if (!member.isActive) continue;

            // Check if member has unsettled expenses
            const hasUnsettled = await Expense.exists({
                tripId: trip._id,
                $or: [
                    { paidBy: member.userId, isSettled: false },
                    { 'splits.userId': member.userId, 'splits.isPaid': false },
                ],
                isArchived: false,
            });

            if (hasUnsettled) {
                await this.create(member.userId, {
                    tripId: tripId,
                    type: 'trip_ending',
                    title: `Trip Ending Soon: ${trip.title}`,
                    message: `${daysLeft} day(s) left! Don't forget to settle up before the trip ends.`,
                    frequency: 'daily',
                    maxTriggers: daysLeft + 1,
                    channels: { push: true, email: true },
                });
            }
        }
    },

    // ============================================================
    // CRON: Process due reminders
    // ============================================================

    async processDueReminders(): Promise<void> {
        const now = new Date();
        const dueReminders = await Reminder.find({
            status: 'active',
            nextTriggerAt: { $lte: now },
        });

        if (dueReminders.length === 0) return;

        logger.info(`Processing ${dueReminders.length} due reminders`);

        for (const reminder of dueReminders) {
            try {
                await this.triggerReminder(reminder);
            } catch (error) {
                logger.error(`Failed to process reminder ${reminder._id}:`, error);
            }
        }
    },

    /**
     * Trigger a specific reminder.
     */
    async triggerReminder(reminder: IReminder): Promise<void> {
        const escalation = ESCALATION_TEMPLATES[Math.min(reminder.escalationLevel, 3)];
        const fullMessage = `${escalation.prefix}: ${reminder.message}`;

        // ── 1. Send to creator ──────────────────────────────
        await notificationService.create(
            reminder.userId,
            'PAYMENT_REMINDER',
            reminder.title,
            fullMessage,
            {
                data: {
                    reminderId: reminder._id,
                    tripId: reminder.tripId,
                    expenseId: reminder.expenseId,
                    targetUserId: reminder.targetUserId,
                    escalationLevel: reminder.escalationLevel,
                },
                isActionable: true,
                priority: reminder.escalationLevel >= 2 ? 'urgent' : 'high',
                channels: {
                    push: escalation.channels.push,
                    email: escalation.channels.email,
                    sms: escalation.channels.sms,
                },
            }
        );

        // ── 2. Send to target user ──────────────────────────
        if (reminder.targetUserId) {
            await notificationService.create(
                reminder.targetUserId,
                'PAYMENT_REMINDER',
                reminder.title,
                fullMessage,
                {
                    data: {
                        reminderId: reminder._id,
                        tripId: reminder.tripId,
                        expenseId: reminder.expenseId,
                        escalationLevel: reminder.escalationLevel,
                    },
                    isActionable: true,
                    priority: reminder.escalationLevel >= 2 ? 'urgent' : 'high',
                    channels: { push: true },
                }
            );

            socketServer.sendToUser(reminder.targetUserId, 'reminder:received', {
                type: 'PAYMENT_REMINDER',
                reminderId: reminder._id,
                tripId: reminder.tripId,
                expenseId: reminder.expenseId,
                title: reminder.title,
                message: fullMessage,
                escalationLevel: reminder.escalationLevel,
                timestamp: new Date().toISOString(),
            });
        }

        // ── 3. Escalate to trip members ─────────────────────
        if (reminder.escalationLevel >= 3 && reminder.escalateToGroup && reminder.tripId) {
            const trip = await Trip.findById(reminder.tripId);
            if (trip) {
                const targetName = reminder.targetUserName || 'someone';
                for (const member of trip.members) {
                    if (!member.isActive) continue;
                    if (member.userId === reminder.userId || member.userId === reminder.targetUserId) continue;

                    await notificationService.create(
                        member.userId,
                        'PAYMENT_REMINDER',
                        'Group Settlement Notice',
                        `🔔 ${targetName} has pending payments in "${trip.title}". Please help resolve.`,
                        {
                            data: { tripId: reminder.tripId, reminderId: reminder._id },
                            priority: 'medium',
                        }
                    );
                }
            }
        }

        // ── 4. Update reminder state ────────────────────────
        reminder.lastTriggeredAt = new Date();
        reminder.triggerCount += 1;
        reminder.escalationLevel = Math.min(reminder.escalationLevel + 1, 3);

        // Check if should complete
        if (reminder.maxTriggers !== undefined && reminder.triggerCount >= reminder.maxTriggers) {
            reminder.status = 'completed';
            reminder.completedAt = new Date();
        } else {
            reminder.nextTriggerAt = this.calculateNextTrigger(
                reminder.frequency,
                reminder.customDays,
                reminder.lastTriggeredAt
            );
        }

        await reminder.save();
        logger.info(`Reminder triggered: ${reminder._id} (count: ${reminder.triggerCount}, escalation: ${reminder.escalationLevel})`);
    },

    // ============================================================
    // CRUD
    // ============================================================

    calculateNextTrigger(frequency: string, customDays?: number, fromDate?: Date): Date {
        const base = fromDate || new Date();
        const next = new Date(base);

        switch (frequency) {
            case 'once':
                return new Date();
            case 'daily':
                next.setDate(next.getDate() + 1);
                break;
            case 'weekly':
                next.setDate(next.getDate() + 7);
                break;
            case 'monthly':
                next.setMonth(next.getMonth() + 1);
                break;
            case 'custom_days':
                next.setDate(next.getDate() + (customDays || 3));
                break;
            default:
                next.setDate(next.getDate() + 1);
        }

        // Set to 9 AM
        next.setHours(9, 0, 0, 0);
        return next;
    },

    async pause(reminderId: string, userId: string): Promise<IReminder> {
        const reminder = await Reminder.findOne({ _id: reminderId, userId });
        if (!reminder) throw new AppError('Reminder not found', 404);
        if (reminder.status !== 'active') throw new AppError('Reminder is not active', 400);
        reminder.status = 'paused';
        await reminder.save();
        return reminder;
    },

    async resume(reminderId: string, userId: string): Promise<IReminder> {
        const reminder = await Reminder.findOne({ _id: reminderId, userId });
        if (!reminder) throw new AppError('Reminder not found', 404);
        if (reminder.status !== 'paused') throw new AppError('Reminder is not paused', 400);
        reminder.status = 'active';
        reminder.nextTriggerAt = this.calculateNextTrigger(reminder.frequency, reminder.customDays);
        await reminder.save();
        return reminder;
    },

    async cancel(reminderId: string, userId: string, reason?: string): Promise<IReminder> {
        const reminder = await Reminder.findOne({ _id: reminderId, userId });
        if (!reminder) throw new AppError('Reminder not found', 404);
        reminder.status = 'cancelled';
        reminder.cancelledAt = new Date();
        reminder.cancelledReason = reason;
        await reminder.save();
        return reminder;
    },

    async getUserReminders(
        userId: string,
        options: {
            status?: string;
            type?: string;
            tripId?: string;
            targetUserId?: string;
            page?: number;
            limit?: number;
        } = {}
    ): Promise<{ reminders: IReminder[]; total: number; activeCount: number }> {
        const query: any = { userId };

        if (options.status) query.status = options.status;
        if (options.type) query.type = options.type;
        if (options.tripId) query.tripId = new Types.ObjectId(options.tripId);
        if (options.targetUserId) query.targetUserId = options.targetUserId;

        const page = options.page || 1;
        const limit = Math.min(options.limit || 20, 50);
        const skip = (page - 1) * limit;

        const [reminders, total, activeCount] = await Promise.all([
            Reminder.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Reminder.countDocuments(query),
            Reminder.countDocuments({ userId, status: 'active' }),
        ]);

        return {
            reminders: reminders as unknown as IReminder[],
            total,
            activeCount,
        };
    },

    /**
     * Get reminders targeted at a user (sent by others).
     */
    async getIncomingReminders(userId: string): Promise<IReminder[]> {
        return Reminder.find({
            targetUserId: userId,
            status: 'active',
        })
            .sort({ nextTriggerAt: 1 })
            .lean() as unknown as Promise<IReminder[]>;
    },

    /**
     * Get reminders for a specific trip.
     */
    async getTripReminders(tripId: string): Promise<IReminder[]> {
        return Reminder.find({
            tripId: new Types.ObjectId(tripId),
            status: 'active',
        })
            .sort({ nextTriggerAt: 1 })
            .lean() as unknown as Promise<IReminder[]>;
    },
};