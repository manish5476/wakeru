import { Request, Response, NextFunction } from 'express';
import { reminderService } from './reminder.service';
import { notificationService } from '../notification/notification.service';
import { socketServer } from '../../infrastructure/websocket/socket.server';

const getUser = (req: Request) => {
    const user = (req as any).user;
    if (!user?.userId) throw new Error('Not authenticated');
    return user.userId;
};

export const remindersController = {
    /** POST /api/v1/reminders */
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminder = await reminderService.create(userId, req.body);
            res.status(201).json({ success: true, message: 'Reminder created', data: { reminder } });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/reminders */
    async getMyReminders(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const status = req.query.status as string | undefined;
            const reminders = await reminderService.getUserReminders(userId, status);
            res.status(200).json({ success: true, data: { reminders } });
        } catch (err) { next(err); }
    },

    /** PATCH /api/v1/reminders/:reminderId/pause */
    async pause(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminder = await reminderService.pause(req.params.reminderId, userId);
            res.status(200).json({ success: true, message: 'Reminder paused', data: { reminder } });
        } catch (err) { next(err); }
    },

    /** PATCH /api/v1/reminders/:reminderId/resume */
    async resume(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminder = await reminderService.resume(req.params.reminderId, userId);
            res.status(200).json({ success: true, message: 'Reminder resumed', data: { reminder } });
        } catch (err) { next(err); }
    },

    /** DELETE /api/v1/reminders/:reminderId */
    async cancel(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            await reminderService.cancel(req.params.reminderId, userId);
            res.status(200).json({ success: true, message: 'Reminder cancelled' });
        } catch (err) { next(err); }
    },

    /** POST /api/v1/reminders/ping */
    async pingUser(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { targetUserId, amount, tripName, message, expenseTitle } = req.body;

            const reminder = await reminderService.create(userId, {
                targetUserId,
                type: 'payment',
                title: expenseTitle ? `Payment: ${expenseTitle}` : `Payment for ${tripName}`,
                message: message || `Reminder sent to settle ₹${amount} for ${tripName}.`,
                frequency: 'once'
            });

            // 1. Create a database notification for the target user
            const dbNotification = await notificationService.create(
                targetUserId,
                'SYSTEM',
                'Pending Settlement Reminder',
                message || `You owe ₹${amount} for ${tripName}. Please settle soon.`,
                { data: { senderId: userId, tripName, amount, expenseTitle } }
            );

            // 2. Send instant websocket push notification
            socketServer.sendToUser(targetUserId, 'reminder:ping', {
                notification: dbNotification,
                senderId: userId,
                amount,
                tripName,
                expenseTitle,
                message: message || `You owe ₹${amount} for ${tripName}. Please settle soon.`
            });

            res.status(200).json({ success: true, message: 'Ping sent successfully', data: { reminder } });
        } catch (err) {
            next(err);
        }
    }
};