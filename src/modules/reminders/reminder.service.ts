import { Reminder, IReminder } from './reminder.model';
import { User } from '../auth/auth.model';
import { Trip } from '../trips/trip.model';
import { AppError } from '../../shared/errors/AppError';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { notificationService } from '../notification/notification.service';
import { logger } from '../../config/logger';

// Escalation messages
const ESCALATION_MESSAGES = [
    'Gentle reminder: {message}',
    'Friendly follow-up: {message}',
    'Urgent: {message} — please settle soon!',
    '⚠️ Group notification: {targetName} has been reminded {count} times about {message}',
];

export const reminderService = {
    /**
     * Create a reminder.
     */
    async create(
        userId: string,
        data: {
            targetUserId?: string;
            tripId?: string;
            type: string;
            title: string;
            message: string;
            frequency?: string;
            customDays?: number;
            escalationInterval?: number;
        }
    ): Promise<IReminder> {
        const nextTriggerAt = this.calculateNextTrigger(data.frequency || 'once', data.customDays);

        const reminder = new Reminder({
            userId,
            targetUserId: data.targetUserId,
            tripId: data.tripId,
            type: data.type,
            title: data.title,
            message: data.message,
            frequency: data.frequency || 'once',
            customDays: data.customDays,
            nextTriggerAt,
            escalationLevel: 0,
            escalationInterval: data.escalationInterval || 3,
            status: 'active',
        });

        await reminder.save();
        logger.info(`Reminder created: ${reminder._id} for user ${userId}`);
        return reminder;
    },

    /**
     * Process all due reminders (called by cron job every minute).
     */
    async processDueReminders(): Promise<void> {
        const now = new Date();

        const dueReminders = await Reminder.find({
            status: 'active',
            nextTriggerAt: { $lte: now },
        });

        logger.info(`Processing ${dueReminders.length} due reminders`);

        for (const reminder of dueReminders) {
            await this.triggerReminder(reminder);
        }
    },

    /**
     * Trigger a single reminder.
     */
    async triggerReminder(reminder: IReminder): Promise<void> {
        try {
            const escalationMsg = ESCALATION_MESSAGES[Math.min(reminder.escalationLevel, 3)]
                .replace('{message}', reminder.message)
                .replace('{targetName}', '')
                .replace('{count}', (reminder.escalationLevel + 1).toString());

            // Send in-app notification
            await notificationService.create(
                reminder.userId,
                'PAYMENT_REMINDER',
                reminder.title,
                escalationMsg,
                {
                    data: {
                        reminderId: reminder._id,
                        tripId: reminder.tripId,
                        targetUserId: reminder.targetUserId,
                    },
                    isActionable: true,
                    priority: reminder.escalationLevel >= 2 ? 'urgent' : 'high',
                    channels: { push: true, email: reminder.escalationLevel >= 1 },
                }
            );

            // If target user exists, also notify them
            if (reminder.targetUserId) {
                await notificationService.create(
                    reminder.targetUserId,
                    'PAYMENT_REMINDER',
                    'Payment Reminder',
                    escalationMsg,
                    {
                        data: { reminderId: reminder._id, tripId: reminder.tripId },
                        priority: reminder.escalationLevel >= 2 ? 'urgent' : 'high',
                        channels: { push: true },
                    }
                );

                // WebSocket
                socketServer.sendToUser(reminder.targetUserId, 'reminder:received', {
                    type: 'PAYMENT_REMINDER',
                    reminderId: reminder._id,
                    tripId: reminder.tripId,
                    message: escalationMsg,
                    escalationLevel: reminder.escalationLevel,
                    timestamp: new Date().toISOString(),
                });
            }

            // Update reminder
            reminder.lastTriggeredAt = new Date();
            reminder.escalationLevel = Math.min(reminder.escalationLevel + 1, 3);

            // Calculate next trigger
            if (reminder.frequency === 'once') {
                reminder.status = 'completed';
            } else {
                reminder.nextTriggerAt = this.calculateNextTrigger(
                    reminder.frequency,
                    reminder.customDays,
                    reminder.lastTriggeredAt
                );
            }

            await reminder.save();
            logger.info(`Reminder triggered: ${reminder._id}, escalation: ${reminder.escalationLevel}`);
        } catch (error) {
            logger.error(`Failed to trigger reminder ${reminder._id}:`, error);
        }
    },

    /**
     * Calculate next trigger date.
     */
    calculateNextTrigger(frequency: string, customDays?: number, fromDate?: Date): Date {
        const base = fromDate || new Date();
        const next = new Date(base);

        switch (frequency) {
            case 'once':
                return new Date(); // Immediately
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

        return next;
    },

    /**
     * Pause a reminder.
     */
    async pause(reminderId: string, userId: string): Promise<IReminder> {
        const reminder = await Reminder.findOne({ _id: reminderId, userId });
        if (!reminder) throw new AppError('Reminder not found', 404);
        reminder.status = 'paused';
        await reminder.save();
        return reminder;
    },

    /**
     * Resume a reminder.
     */
    async resume(reminderId: string, userId: string): Promise<IReminder> {
        const reminder = await Reminder.findOne({ _id: reminderId, userId });
        if (!reminder) throw new AppError('Reminder not found', 404);
        reminder.status = 'active';
        reminder.nextTriggerAt = this.calculateNextTrigger(reminder.frequency, reminder.customDays);
        await reminder.save();
        return reminder;
    },

    /**
     * Cancel a reminder.
     */
    async cancel(reminderId: string, userId: string): Promise<void> {
        const reminder = await Reminder.findOne({ _id: reminderId, userId });
        if (!reminder) throw new AppError('Reminder not found', 404);
        reminder.status = 'cancelled';
        await reminder.save();
    },

    /**
     * Get user's reminders.
     */
    async getUserReminders(userId: string, status?: string): Promise<IReminder[]> {
        const query: any = { userId };
        if (status) query.status = status;
        return Reminder.find(query).sort({ createdAt: -1 }).lean() as unknown as Promise<IReminder[]>;
    },
};