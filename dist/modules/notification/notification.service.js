"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const notification_model_1 = require("./notification.model");
const auth_model_1 = require("../auth/auth.model");
const trip_model_1 = require("../trips/trip.model");
const expense_model_1 = require("../expense/expense.model");
const logger_1 = require("../../config/logger");
const AppError_1 = require("../../shared/errors/AppError");
// ============================================================
// NOTIFICATION SERVICE
// ============================================================
class NotificationService {
    /**
     * Create a notification for a user.
     */
    async create(userId, type, title, message, options = {}) {
        try {
            const notification = new notification_model_1.Notification({
                userId,
                type,
                title,
                message,
                data: options.data,
                isActionable: options.isActionable ?? false,
                actionUrl: options.actionUrl,
                priority: options.priority ?? 'medium',
                channels: {
                    inApp: options.channels?.inApp ?? true,
                    email: options.channels?.email ?? false,
                    push: options.channels?.push ?? false,
                    sms: options.channels?.sms ?? false,
                },
            });
            await notification.save();
            // Fire-and-forget: send through other channels
            this.sendThroughChannels(notification).catch((err) => {
                logger_1.logger.error('Channel delivery failed:', err);
            });
            return notification;
        }
        catch (error) {
            logger_1.logger.error('Failed to create notification:', error);
            throw error;
        }
    }
    /**
     * Get user's notifications (paginated).
     */
    async getUserNotifications(userId, options = {}) {
        const { page = 1, limit = 20, unreadOnly = false, type } = options;
        const skip = (page - 1) * limit;
        const query = { userId };
        if (unreadOnly)
            query.isRead = false;
        if (type)
            query.type = type;
        const [notifications, total, unreadCount] = await Promise.all([
            notification_model_1.Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            notification_model_1.Notification.countDocuments(query),
            notification_model_1.Notification.countDocuments({ userId, isRead: false }),
        ]);
        return {
            notifications,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
                hasMore: skip + notifications.length < total,
            },
            unreadCount,
        };
    }
    /**
     * Mark single notification as read.
     */
    async markAsRead(notificationId, userId) {
        const notification = await notification_model_1.Notification.findOneAndUpdate({ _id: notificationId, userId }, { $set: { isRead: true, readAt: new Date() } }, { new: true });
        if (!notification)
            throw new AppError_1.AppError('Notification not found', 404);
        return notification;
    }
    /**
     * Mark ALL notifications as read for a user.
     */
    async markAllAsRead(userId) {
        await notification_model_1.Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    }
    /**
     * Delete a notification.
     */
    async delete(notificationId, userId) {
        const result = await notification_model_1.Notification.findOneAndDelete({
            _id: notificationId,
            userId,
        });
        if (!result)
            throw new AppError_1.AppError('Notification not found', 404);
    }
    /**
     * Clear ALL notifications.
     */
    async clearAll(userId) {
        await notification_model_1.Notification.deleteMany({ userId });
    }
    /**
     * Get unread count.
     */
    async getUnreadCount(userId) {
        return notification_model_1.Notification.countDocuments({ userId, isRead: false });
    }
    // ============================================================
    // TRIPSPLIT-SPECIFIC NOTIFICATIONS
    // ============================================================
    /**
     * Notify all trip members (except the actor) about a new expense.
     */
    async notifyExpenseAdded(tripId, expenseId, actorUid) {
        const trip = await trip_model_1.Trip.findById(tripId).lean();
        if (!trip)
            return;
        const expense = await expense_model_1.Expense.findById(expenseId).lean();
        if (!expense)
            return;
        const actor = trip.members.find((m) => m.userId === actorUid);
        const actorName = actor?.displayName || 'Someone';
        for (const member of trip.members) {
            if (member.userId === actorUid || !member.isActive)
                continue;
            await this.create(member.userId, 'EXPENSE_ADDED', 'New Expense Added', `${actorName} added "${expense.title}" — ${expense.amountLocal} ${expense.localCurrency}`, {
                data: { tripId, expenseId: expense._id.toString(), stopId: expense.stopId.toString() },
                isActionable: true,
                actionUrl: `/trips/${tripId}/expenses/${expense._id}`,
                priority: 'medium',
            });
        }
    }
    /**
     * Notify about settlement request.
     */
    async notifySettlementRequest(fromUid, toUid, amount, baseCurrency, tripId) {
        // FIX: fromUid/toUid are Firebase UIDs (same convention as everywhere
        // else in this app), not Mongo _id — findById() always returned null
        // here, so every settlement notification silently said "Someone"
        // instead of the real name.
        const [fromUser, toUser] = await Promise.all([
            auth_model_1.User.findByFirebaseUid(fromUid),
            auth_model_1.User.findByFirebaseUid(toUid),
        ]);
        await this.create(toUid, 'SETTLEMENT_REQUEST', 'Settlement Request', `${fromUser?.displayName || 'Someone'} requests ₹${amount} ${baseCurrency}`, {
            data: { tripId, fromUid, amount, baseCurrency },
            isActionable: true,
            actionUrl: `/trips/${tripId}/settle`,
            priority: 'high',
            channels: { push: true, email: true },
        });
    }
    /**
     * Notify about completed settlement.
     */
    async notifySettlementCompleted(fromUid, toUid, amount, baseCurrency, tripId) {
        // FIX: same Firebase UID lookup correction as notifySettlementRequest.
        const [fromUser, toUser] = await Promise.all([
            auth_model_1.User.findByFirebaseUid(fromUid),
            auth_model_1.User.findByFirebaseUid(toUid),
        ]);
        // Notify payer
        await this.create(fromUid, 'SETTLEMENT_COMPLETED', 'Payment Sent', `You paid ${toUser?.displayName || 'Someone'} ₹${amount} ${baseCurrency}`, {
            data: { tripId, toUid, amount },
            priority: 'high',
            channels: { push: true },
        });
        // Notify recipient
        await this.create(toUid, 'SETTLEMENT_COMPLETED', 'Payment Received', `${fromUser?.displayName || 'Someone'} paid you ₹${amount} ${baseCurrency}`, {
            data: { tripId, fromUid, amount },
            priority: 'high',
            channels: { push: true },
        });
    }
    /**
     * Notify user about trip invitation.
     */
    async notifyTripInvitation(toUid, tripId, tripTitle, inviterName) {
        await this.create(toUid, 'TRIP_INVITATION', 'Trip Invitation', `${inviterName} invited you to "${tripTitle}"`, {
            data: { tripId },
            isActionable: true,
            actionUrl: `/trips/${tripId}/join`,
            priority: 'high',
            channels: { push: true, email: true },
        });
    }
    /**
     * Notify trip members that someone joined.
     */
    async notifyTripJoined(tripId, joinerUid) {
        const trip = await trip_model_1.Trip.findById(tripId).lean();
        if (!trip)
            return;
        const joiner = trip.members.find((m) => m.userId === joinerUid);
        const joinerName = joiner?.displayName || 'Someone';
        for (const member of trip.members) {
            if (member.userId === joinerUid || !member.isActive)
                continue;
            await this.create(member.userId, 'TRIP_JOINED', 'New Member Joined', `${joinerName} joined "${trip.title}"`, {
                data: { tripId, joinerUid },
                priority: 'low',
            });
        }
    }
    /**
     * Notify user about payment reminder.
     */
    async notifyPaymentReminder(fromUid, toUid, amount, baseCurrency, tripId) {
        // FIX: same Firebase UID lookup correction.
        const toUser = await auth_model_1.User.findByFirebaseUid(toUid);
        await this.create(fromUid, 'PAYMENT_REMINDER', 'Payment Reminder', `Reminder: You owe ${toUser?.displayName || 'Someone'} ₹${amount} ${baseCurrency}`, {
            data: { tripId, toUid, amount },
            isActionable: true,
            actionUrl: `/trips/${tripId}/settle`,
            priority: 'urgent',
            channels: { push: true, email: true },
        });
    }
    /**
     * Broadcast an app update / system notification to all active users.
     */
    async broadcastSystemUpdate(link) {
        // FIX: was selecting/using `_id`, but every read path
        // (getUserNotifications, markAllAsRead, etc.) queries Notification.userId
        // by Firebase UID. Broadcasts were being created but were invisible to
        // every single user because the userId never matched anything.
        const activeUsers = await auth_model_1.User.find({ isActive: true, isDeleted: false })
            .select('firebaseUid')
            .lean();
        if (!activeUsers.length)
            return;
        const notifications = activeUsers.map((u) => ({
            userId: u.firebaseUid,
            type: 'SYSTEM_UPDATE',
            title: '🚀 New Update Available!',
            message: 'A new version of the app has been released. Please download it now for the best experience.',
            isActionable: true,
            actionUrl: link,
            priority: 'high',
            channels: {
                inApp: true,
                email: false,
                push: false,
                sms: false,
            },
        }));
        await notification_model_1.Notification.insertMany(notifications);
    }
    // ============================================================
    // CHANNEL DELIVERY (Placeholders)
    // ============================================================
    async sendThroughChannels(notification) {
        // FIX: notification.userId is a Firebase UID; this was always querying
        // by Mongo _id and always getting null back, so push/email/SMS never
        // actually fired for anyone even when the channel flags were true.
        const user = await auth_model_1.User.findByFirebaseUid(notification.userId);
        if (!user)
            return;
        const promises = [];
        if (notification.channels.push) {
            promises.push(this.sendPush(user, notification));
        }
        if (notification.channels.email) {
            promises.push(this.sendEmail(user.email, notification));
        }
        if (notification.channels.sms && user.phoneNumber) {
            promises.push(this.sendSMS(user.phoneNumber, notification));
        }
        await Promise.allSettled(promises);
    }
    async sendPush(user, notification) {
        if (!user.fcmToken)
            return;
        // TODO: Integrate with Firebase Cloud Messaging
        logger_1.logger.info(`📱 Push to ${user.firebaseUid}: ${notification.title}`);
    }
    async sendEmail(email, notification) {
        // TODO: Integrate with SendGrid / SES
        logger_1.logger.info(`📧 Email to ${email}: ${notification.title}`);
    }
    async sendSMS(phone, notification) {
        // TODO: Integrate with Twilio
        logger_1.logger.info(`💬 SMS to ${phone}: ${notification.title}`);
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
// import { Notification } from './notification.model';
// import { User } from '../auth/auth.model';
// import { Trip } from '../trips/trip.model';
// import { Expense } from '../expense/expense.model';
// import { logger } from '../../config/logger';
// import { AppError } from '../../shared/errors/AppError';
// // ============================================================
// // TYPES
// // ============================================================
// interface CreateNotificationOptions {
//   data?: Record<string, any>;
//   isActionable?: boolean;
//   actionUrl?: string;
//   priority?: 'low' | 'medium' | 'high' | 'urgent';
//   channels?: Partial<{
//     inApp: boolean;
//     email: boolean;
//     push: boolean;
//     sms: boolean;
//   }>;
// }
// interface NotificationQuery {
//   page?: number;
//   limit?: number;
//   unreadOnly?: boolean;
//   type?: string;
// }
// // ============================================================
// // NOTIFICATION SERVICE
// // ============================================================
// export class NotificationService {
//   /**
//    * Create a notification for a user.
//    */
//   async create(
//     userId: string,
//     type: string,
//     title: string,
//     message: string,
//     options: CreateNotificationOptions = {}
//   ) {
//     try {
//       const notification = new Notification({
//         userId,
//         type,
//         title,
//         message,
//         data: options.data,
//         isActionable: options.isActionable ?? false,
//         actionUrl: options.actionUrl,
//         priority: options.priority ?? 'medium',
//         channels: {
//           inApp: options.channels?.inApp ?? true,
//           email: options.channels?.email ?? false,
//           push: options.channels?.push ?? false,
//           sms: options.channels?.sms ?? false,
//         },
//       });
//       await notification.save();
//       // Fire-and-forget: send through other channels
//       this.sendThroughChannels(notification).catch((err) => {
//         logger.error('Channel delivery failed:', err);
//       });
//       return notification;
//     } catch (error) {
//       logger.error('Failed to create notification:', error);
//       throw error;
//     }
//   }
//   /**
//    * Get user's notifications (paginated).
//    */
//   async getUserNotifications(userId: string, options: NotificationQuery = {}) {
//     const { page = 1, limit = 20, unreadOnly = false, type } = options;
//     const skip = (page - 1) * limit;
//     const query: Record<string, any> = { userId };
//     if (unreadOnly) query.isRead = false;
//     if (type) query.type = type;
//     const [notifications, total, unreadCount] = await Promise.all([
//       Notification.find(query)
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),
//       Notification.countDocuments(query),
//       Notification.countDocuments({ userId, isRead: false }),
//     ]);
//     return {
//       notifications,
//       pagination: {
//         total,
//         page,
//         limit,
//         pages: Math.ceil(total / limit),
//         hasMore: skip + notifications.length < total,
//       },
//       unreadCount,
//     };
//   }
//   /**
//    * Mark single notification as read.
//    */
//   async markAsRead(notificationId: string, userId: string) {
//     const notification = await Notification.findOneAndUpdate(
//       { _id: notificationId, userId },
//       { $set: { isRead: true, readAt: new Date() } },
//       { new: true }
//     );
//     if (!notification) throw new AppError('Notification not found', 404);
//     return notification;
//   }
//   /**
//    * Mark ALL notifications as read for a user.
//    */
//   async markAllAsRead(userId: string): Promise<void> {
//     await Notification.updateMany(
//       { userId, isRead: false },
//       { $set: { isRead: true, readAt: new Date() } }
//     );
//   }
//   /**
//    * Delete a notification.
//    */
//   async delete(notificationId: string, userId: string): Promise<void> {
//     const result = await Notification.findOneAndDelete({
//       _id: notificationId,
//       userId,
//     });
//     if (!result) throw new AppError('Notification not found', 404);
//   }
//   /**
//    * Clear ALL notifications.
//    */
//   async clearAll(userId: string): Promise<void> {
//     await Notification.deleteMany({ userId });
//   }
//   /**
//    * Get unread count.
//    */
//   async getUnreadCount(userId: string): Promise<number> {
//     return Notification.countDocuments({ userId, isRead: false });
//   }
//   // ============================================================
//   // TRIPSPLIT-SPECIFIC NOTIFICATIONS
//   // ============================================================
//   /**
//    * Notify all trip members (except the actor) about a new expense.
//    */
//   async notifyExpenseAdded(
//     tripId: string,
//     expenseId: string,
//     actorUid: string
//   ): Promise<void> {
//     const trip = await Trip.findById(tripId).lean();
//     if (!trip) return;
//     const expense = await Expense.findById(expenseId).lean();
//     if (!expense) return;
//     const actor = trip.members.find((m) => m.userId === actorUid);
//     const actorName = actor?.displayName || 'Someone';
//     for (const member of trip.members) {
//       if (member.userId === actorUid || !member.isActive) continue;
//       await this.create(
//         member.userId,
//         'EXPENSE_ADDED',
//         'New Expense Added',
//         `${actorName} added "${expense.title}" — ${expense.amountLocal} ${expense.localCurrency}`,
//         {
//           data: { tripId, expenseId: expense._id.toString(), stopId: expense.stopId.toString() },
//           isActionable: true,
//           actionUrl: `/trips/${tripId}/expenses/${expense._id}`,
//           priority: 'medium',
//         }
//       );
//     }
//   }
//   /**
//    * Notify about settlement request.
//    */
//   async notifySettlementRequest(
//     fromUid: string,
//     toUid: string,
//     amount: number,
//     baseCurrency: string,
//     tripId: string
//   ): Promise<void> {
//     const [fromUser, toUser] = await Promise.all([
//       User.findById(fromUid).lean(),
//       User.findById(toUid).lean(),
//     ]);
//     await this.create(
//       toUid,
//       'SETTLEMENT_REQUEST',
//       'Settlement Request',
//       `${fromUser?.displayName || 'Someone'} requests ₹${amount} ${baseCurrency}`,
//       {
//         data: { tripId, fromUid, amount, baseCurrency },
//         isActionable: true,
//         actionUrl: `/trips/${tripId}/settle`,
//         priority: 'high',
//         channels: { push: true, email: true },
//       }
//     );
//   }
//   /**
//    * Notify about completed settlement.
//    */
//   async notifySettlementCompleted(
//     fromUid: string,
//     toUid: string,
//     amount: number,
//     baseCurrency: string,
//     tripId: string
//   ): Promise<void> {
//     const [fromUser, toUser] = await Promise.all([
//       User.findById(fromUid).lean(),
//       User.findById(toUid).lean(),
//     ]);
//     // Notify payer
//     await this.create(
//       fromUid,
//       'SETTLEMENT_COMPLETED',
//       'Payment Sent',
//       `You paid ${toUser?.displayName || 'Someone'} ₹${amount} ${baseCurrency}`,
//       {
//         data: { tripId, toUid, amount },
//         priority: 'high',
//         channels: { push: true },
//       }
//     );
//     // Notify recipient
//     await this.create(
//       toUid,
//       'SETTLEMENT_COMPLETED',
//       'Payment Received',
//       `${fromUser?.displayName || 'Someone'} paid you ₹${amount} ${baseCurrency}`,
//       {
//         data: { tripId, fromUid, amount },
//         priority: 'high',
//         channels: { push: true },
//       }
//     );
//   }
//   /**
//    * Notify user about trip invitation.
//    */
//   async notifyTripInvitation(
//     toUid: string,
//     tripId: string,
//     tripTitle: string,
//     inviterName: string
//   ): Promise<void> {
//     await this.create(
//       toUid,
//       'TRIP_INVITATION',
//       'Trip Invitation',
//       `${inviterName} invited you to "${tripTitle}"`,
//       {
//         data: { tripId },
//         isActionable: true,
//         actionUrl: `/trips/${tripId}/join`,
//         priority: 'high',
//         channels: { push: true, email: true },
//       }
//     );
//   }
//   /**
//    * Notify trip members that someone joined.
//    */
//   async notifyTripJoined(
//     tripId: string,
//     joinerUid: string
//   ): Promise<void> {
//     const trip = await Trip.findById(tripId).lean();
//     if (!trip) return;
//     const joiner = trip.members.find((m) => m.userId === joinerUid);
//     const joinerName = joiner?.displayName || 'Someone';
//     for (const member of trip.members) {
//       if (member.userId === joinerUid || !member.isActive) continue;
//       await this.create(
//         member.userId,
//         'TRIP_JOINED',
//         'New Member Joined',
//         `${joinerName} joined "${trip.title}"`,
//         {
//           data: { tripId, joinerUid },
//           priority: 'low',
//         }
//       );
//     }
//   }
//   /**
//    * Notify user about payment reminder.
//    */
//   async notifyPaymentReminder(
//     fromUid: string,
//     toUid: string,
//     amount: number,
//     baseCurrency: string,
//     tripId: string
//   ): Promise<void> {
//     const toUser = await User.findById(toUid).lean();
//     await this.create(
//       fromUid,
//       'PAYMENT_REMINDER',
//       'Payment Reminder',
//       `Reminder: You owe ${toUser?.displayName || 'Someone'} ₹${amount} ${baseCurrency}`,
//       {
//         data: { tripId, toUid, amount },
//         isActionable: true,
//         actionUrl: `/trips/${tripId}/settle`,
//         priority: 'urgent',
//         channels: { push: true, email: true },
//       }
//     );
//   }
//   /**
//    * Broadcast an app update / system notification to all active users.
//    */
//   async broadcastSystemUpdate(link: string): Promise<void> {
//     const activeUsers = await User.find({ isActive: true, isDeleted: false }).select('_id').lean();
//     if (!activeUsers.length) return;
//     const notifications = activeUsers.map((u) => ({
//       userId: u._id.toString(),
//       type: 'SYSTEM_UPDATE',
//       title: '🚀 New Update Available!',
//       message: 'A new version of the app has been released. Please download it now for the best experience.',
//       isActionable: true,
//       actionUrl: link,
//       priority: 'high',
//       channels: {
//         inApp: true,
//         email: false,
//         push: false,
//         sms: false,
//       },
//     }));
//     await Notification.insertMany(notifications);
//   }
//   // ============================================================
//   // CHANNEL DELIVERY (Placeholders)
//   // ============================================================
//   private async sendThroughChannels(notification: any): Promise<void> {
//     const user = await User.findById(notification.userId).lean();
//     if (!user) return;
//     const promises: Promise<void>[] = [];
//     if (notification.channels.push) {
//       promises.push(this.sendPush(user, notification));
//     }
//     if (notification.channels.email) {
//       promises.push(this.sendEmail(user.email, notification));
//     }
//     if (notification.channels.sms && user.phoneNumber) {
//       promises.push(this.sendSMS(user.phoneNumber, notification));
//     }
//     await Promise.allSettled(promises);
//   }
//   private async sendPush(user: any, notification: any): Promise<void> {
//     if (!user.fcmToken) return;
//     // TODO: Integrate with Firebase Cloud Messaging
//     logger.info(`📱 Push to ${user._id}: ${notification.title}`);
//   }
//   private async sendEmail(email: string, notification: any): Promise<void> {
//     // TODO: Integrate with SendGrid / SES
//     logger.info(`📧 Email to ${email}: ${notification.title}`);
//   }
//   private async sendSMS(phone: string, notification: any): Promise<void> {
//     // TODO: Integrate with Twilio
//     logger.info(`💬 SMS to ${phone}: ${notification.title}`);
//   }
// }
// export const notificationService = new NotificationService();
//# sourceMappingURL=notification.service.js.map