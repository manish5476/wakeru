import { Request, Response, NextFunction } from 'express';
import { reminderService } from './reminder.service';
import { notificationService } from '../notification/notification.service';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { AppError } from '../../shared/errors/AppError';

const getUser = (req: Request) => {
    const user = (req as any).user;
    if (!user?.userId) throw new AppError('Not authenticated', 401);
    return user.userId;
};

export const remindersController = {

    // ============================================================
    // CREATE
    // ============================================================

    /** POST /api/v1/reminders */
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminder = await reminderService.create(userId, req.body);
            res.status(201).json({
                success: true,
                message: 'Reminder created',
                data: { reminder }
            });
        } catch (err) { next(err); }
    },

    /** POST /api/v1/reminders/settlement */
    async createSettlementReminder(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { toUserId, amount, currency, tripId, expenseId } = req.body;
            const reminder = await reminderService.createSettlementReminder(
                userId, toUserId, amount, currency, tripId, expenseId
            );
            res.status(201).json({
                success: true,
                message: 'Settlement reminder created',
                data: { reminder }
            });
        } catch (err) { next(err); }
    },

    /** POST /api/v1/reminders/budget */
    async createBudgetReminder(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { category, spentPercent, month } = req.body;
            const reminder = await reminderService.createBudgetReminder(
                userId, category, spentPercent, month
            );
            res.status(201).json({
                success: true,
                message: 'Budget reminder created',
                data: { reminder }
            });
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
                title: expenseTitle ? `Payment: ${expenseTitle}` : `Payment for ${tripName || 'trip'}`,
                message: message || `Reminder sent to settle ₹${amount || 0} for ${tripName || 'trip'}.`,
                frequency: 'once',
            });

            // Create notification for target user
            const dbNotification = await notificationService.create(
                targetUserId,
                'PAYMENT_REMINDER',
                'Pending Settlement Reminder',
                message || `You owe ₹${amount || 0} for ${tripName || 'trip'}. Please settle soon.`,
                {
                    data: { senderId: userId, tripName, amount, expenseTitle, reminderId: reminder._id },
                    isActionable: true,
                    priority: 'high',
                    channels: { push: true },
                }
            );

            // Send instant WebSocket ping
            socketServer.sendToUser(targetUserId, 'reminder:ping', {
                type: 'REMINDER_PING',
                notification: dbNotification,
                senderId: userId,
                amount,
                tripName,
                expenseTitle,
                reminderId: reminder._id,
                message: message || `You owe ₹${amount || 0} for ${tripName || 'trip'}. Please settle soon.`,
                timestamp: new Date().toISOString(),
            });

            res.status(200).json({
                success: true,
                message: 'Ping sent successfully',
                data: { reminder, notification: dbNotification }
            });
        } catch (err) { next(err); }
    },

    // ============================================================
    // READ
    // ============================================================

    /** GET /api/v1/reminders */
    async getMyReminders(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { status, type, tripId, targetUserId, page, limit } = req.query;

            const result = await reminderService.getUserReminders(userId, {
                status: status as string | undefined,
                type: type as string | undefined,
                tripId: tripId as string | undefined,
                targetUserId: targetUserId as string | undefined,
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 20,
            });

            res.status(200).json({
                success: true,
                data: {
                    reminders: result.reminders,
                    total: result.total,
                    activeCount: result.activeCount,
                }
            });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/reminders/incoming */
    async getIncomingReminders(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminders = await reminderService.getIncomingReminders(userId);
            res.status(200).json({
                success: true,
                data: { reminders, count: reminders.length }
            });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/reminders/trip/:tripId */
    async getTripReminders(req: Request, res: Response, next: NextFunction) {
        try {
            const { tripId } = req.params;
            const reminders = await reminderService.getTripReminders(tripId);
            res.status(200).json({
                success: true,
                data: { reminders, count: reminders.length }
            });
        } catch (err) { next(err); }
    },

    // ============================================================
    // MANAGE
    // ============================================================

    /** PATCH /api/v1/reminders/:reminderId/pause */
    async pause(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminder = await reminderService.pause(req.params.reminderId, userId);
            res.status(200).json({
                success: true,
                message: 'Reminder paused',
                data: { reminder }
            });
        } catch (err) { next(err); }
    },

    /** PATCH /api/v1/reminders/:reminderId/resume */
    async resume(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminder = await reminderService.resume(req.params.reminderId, userId);
            res.status(200).json({
                success: true,
                message: 'Reminder resumed',
                data: { reminder }
            });
        } catch (err) { next(err); }
    },

    /** DELETE /api/v1/reminders/:reminderId */
    async cancel(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reason = req.query.reason as string | undefined;
            const reminder = await reminderService.cancel(req.params.reminderId, userId, reason);
            res.status(200).json({
                success: true,
                message: 'Reminder cancelled',
                data: { reminder }
            });
        } catch (err) { next(err); }
    },
};


// import { Request, Response, NextFunction } from 'express';
// import { reminderService } from './reminder.service';
// import { notificationService } from '../notification/notification.service';
// import { socketServer } from '../../infrastructure/websocket/socket.server';

// const getUser = (req: Request) => {
//     const user = (req as any).user;
//     if (!user?.userId) throw new Error('Not authenticated');
//     return user.userId;
// };

// export const remindersController = {
//     /** POST /api/v1/reminders */
//     async create(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const reminder = await reminderService.create(userId, req.body);
//             res.status(201).json({ success: true, message: 'Reminder created', data: { reminder } });
//         } catch (err) { next(err); }
//     },

//     /** GET /api/v1/reminders */
//     async getMyReminders(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const status = req.query.status as string | undefined;
//             const reminders = await reminderService.getUserReminders(userId, status);
//             res.status(200).json({ success: true, data: { reminders } });
//         } catch (err) { next(err); }
//     },

//     /** PATCH /api/v1/reminders/:reminderId/pause */
//     async pause(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const reminder = await reminderService.pause(req.params.reminderId, userId);
//             res.status(200).json({ success: true, message: 'Reminder paused', data: { reminder } });
//         } catch (err) { next(err); }
//     },

//     /** PATCH /api/v1/reminders/:reminderId/resume */
//     async resume(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const reminder = await reminderService.resume(req.params.reminderId, userId);
//             res.status(200).json({ success: true, message: 'Reminder resumed', data: { reminder } });
//         } catch (err) { next(err); }
//     },

//     /** DELETE /api/v1/reminders/:reminderId */
//     async cancel(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             await reminderService.cancel(req.params.reminderId, userId);
//             res.status(200).json({ success: true, message: 'Reminder cancelled' });
//         } catch (err) { next(err); }
//     },

//     /** POST /api/v1/reminders/ping */
//     async pingUser(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const { targetUserId, amount, tripName, message, expenseTitle } = req.body;

//             const reminder = await reminderService.create(userId, {
//                 targetUserId,
//                 type: 'payment',
//                 title: expenseTitle ? `Payment: ${expenseTitle}` : `Payment for ${tripName}`,
//                 message: message || `Reminder sent to settle ₹${amount} for ${tripName}.`,
//                 frequency: 'once'
//             });

//             // 1. Create a database notification for the target user
//             const dbNotification = await notificationService.create(
//                 targetUserId,
//                 'SYSTEM',
//                 'Pending Settlement Reminder',
//                 message || `You owe ₹${amount} for ${tripName}. Please settle soon.`,
//                 { data: { senderId: userId, tripName, amount, expenseTitle } }
//             );

//             // 2. Send instant websocket push notification
//             socketServer.sendToUser(targetUserId, 'reminder:ping', {
//                 notification: dbNotification,
//                 senderId: userId,
//                 amount,
//                 tripName,
//                 expenseTitle,
//                 message: message || `You owe ₹${amount} for ${tripName}. Please settle soon.`
//             });

//             res.status(200).json({ success: true, message: 'Ping sent successfully', data: { reminder } });
//         } catch (err) {
//             next(err);
//         }
//     }
// };