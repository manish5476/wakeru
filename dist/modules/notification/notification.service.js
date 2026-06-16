"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const notification_model_1 = require("./notification.model");
const auth_model_1 = require("../auth/auth.model");
const logger_1 = require("../../config/logger");
const mongoose_1 = require("mongoose");
const redis_1 = require("../../config/redis");
const group_model_1 = require("../group/group.model");
const expense_model_1 = require("../expense/expense.model");
class NotificationService {
    /**
     * Create a notification
     */
    async createNotification(userId, type, title, message, options = {}) {
        try {
            const notification = new notification_model_1.Notification({
                userId: new mongoose_1.Types.ObjectId(userId),
                type,
                title,
                message,
                data: options.data,
                isActionable: options.isActionable || false,
                actionUrl: options.actionUrl,
                priority: options.priority || 'medium',
                channels: {
                    inApp: options.channels?.inApp ?? true,
                    email: options.channels?.email ?? false,
                    push: options.channels?.push ?? false,
                    sms: options.channels?.sms ?? false
                }
            });
            await notification.save();
            // Send through other channels
            this.sendThroughChannels(notification, userId).catch(err => {
                logger_1.logger.error('Failed to send notification through channels:', err);
            });
            // Invalidate notification cache
            await redis_1.redisClient.delete(`notifications:${userId}:unread`);
            return notification;
        }
        catch (error) {
            logger_1.logger.error('Failed to create notification:', error);
            throw error;
        }
    }
    /**
     * Get user's notifications
     */
    async getUserNotifications(userId, options = {}) {
        const { page = 1, limit = 20, unreadOnly = false, type } = options;
        const skip = (page - 1) * limit;
        const query = { userId: new mongoose_1.Types.ObjectId(userId) };
        if (unreadOnly) {
            query.isRead = false;
        }
        if (type) {
            query.type = type;
        }
        const [notifications, total, unreadCount] = await Promise.all([
            notification_model_1.Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            notification_model_1.Notification.countDocuments(query),
            notification_model_1.Notification.countDocuments({ userId: new mongoose_1.Types.ObjectId(userId), isRead: false })
        ]);
        return {
            notifications,
            total,
            unreadCount,
            page,
            limit
        };
    }
    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        const notification = await notification_model_1.Notification.findOneAndUpdate({ _id: notificationId, userId: new mongoose_1.Types.ObjectId(userId) }, {
            $set: {
                isRead: true,
                readAt: new Date()
            }
        }, { new: true });
        if (notification) {
            await redis_1.redisClient.delete(`notifications:${userId}:unread`);
        }
        return notification;
    }
    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId) {
        await notification_model_1.Notification.updateMany({ userId: new mongoose_1.Types.ObjectId(userId), isRead: false }, {
            $set: {
                isRead: true,
                readAt: new Date()
            }
        });
        await redis_1.redisClient.delete(`notifications:${userId}:unread`);
    }
    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        await notification_model_1.Notification.findOneAndDelete({
            _id: notificationId,
            userId: new mongoose_1.Types.ObjectId(userId)
        });
    }
    /**
     * Get unread count
     */
    async getUnreadCount(userId) {
        const cacheKey = `notifications:${userId}:unread`;
        const cached = await redis_1.redisClient.get(cacheKey);
        if (cached) {
            return parseInt(cached);
        }
        const count = await notification_model_1.Notification.countDocuments({
            userId: new mongoose_1.Types.ObjectId(userId),
            isRead: false
        });
        await redis_1.redisClient.set(cacheKey, count.toString(), 300); // 5 minutes
        return count;
    }
    /**
     * Send expense notification
     */
    async notifyExpenseAdded(groupId, expenseId, createdBy) {
        const [group, expense] = await Promise.all([
            group_model_1.Group.findOne({ groupId }).populate('members.userId', 'userId email preferences'),
            expense_model_1.Expense.findOne({ expenseId })
        ]);
        if (!group || !expense)
            return;
        const creator = group.members.find((m) => m.userId._id.toString() === createdBy);
        for (const member of group.members) {
            if (member.userId._id.toString() === createdBy)
                continue;
            const notificationPreferences = member.userId.preferences?.get('notificationPreferences');
            if (!notificationPreferences?.muteExpenses) {
                await this.createNotification(member.userId._id.toString(), 'EXPENSE_ADDED', 'New Expense Added', `${creator?.userId?.displayName || 'Someone'} added "${expense.description}" - ₹${expense.totalAmount}`, {
                    data: { groupId, expenseId },
                    isActionable: true,
                    actionUrl: `/groups/${groupId}/expenses/${expenseId}`,
                    priority: 'medium',
                    channels: { email: notificationPreferences?.email }
                });
            }
        }
    }
    /**
     * Notify settlement completed
     */
    async notifySettlementCompleted(settlement) {
        const [fromUser, toUser] = await Promise.all([
            auth_model_1.User.findById(settlement.fromUser),
            auth_model_1.User.findById(settlement.toUser)
        ]);
        // Notify payer
        await this.createNotification(settlement.fromUser.toString(), 'SETTLEMENT_COMPLETED', 'Payment Sent', `You paid ${toUser?.displayName} ₹${settlement.amount}`, {
            data: { settlementId: settlement.settlementId },
            priority: 'high',
            channels: { push: true }
        });
        // Notify recipient
        await this.createNotification(settlement.toUser.toString(), 'SETTLEMENT_COMPLETED', 'Payment Received', `${fromUser?.displayName} paid you ₹${settlement.amount}`, {
            data: { settlementId: settlement.settlementId },
            priority: 'high',
            channels: { push: true }
        });
    }
    /**
     * Notify payment reminder
     */
    async notifyPaymentReminder(fromUserId, toUserId, amount) {
        const [fromUser, toUser] = await Promise.all([
            auth_model_1.User.findById(fromUserId),
            auth_model_1.User.findById(toUserId)
        ]);
        await this.createNotification(fromUserId, 'PAYMENT_REMINDER', 'Payment Reminder', `Reminder: You owe ${toUser?.displayName} ₹${amount}`, {
            priority: 'urgent',
            channels: { push: true, email: true }
        });
    }
    /**
     * Send monthly report notification
     */
    async notifyMonthlyReport(userId, reportData) {
        const user = await auth_model_1.User.findById(userId);
        if (user?.preferences.get('notificationPreferences')?.monthlyReports) {
            await this.createNotification(userId, 'MONTHLY_REPORT', 'Monthly Spending Report', `Your monthly spending report is ready. Total: ₹${reportData.totalSpent}`, {
                data: { reportUrl: `/reports/monthly` },
                isActionable: true,
                priority: 'low',
                channels: { email: true }
            });
        }
    }
    /**
     * Send through different channels
     */
    async sendThroughChannels(notification, userId) {
        const user = await auth_model_1.User.findById(userId);
        if (!user)
            return;
        // Send push notification
        if (notification.channels.push) {
            this.sendPushNotification(userId, notification).catch(err => {
                logger_1.logger.error('Push notification failed:', err);
            });
        }
        // Send email
        if (notification.channels.email) {
            this.sendEmailNotification(user.email, notification).catch(err => {
                logger_1.logger.error('Email notification failed:', err);
            });
        }
        // Send SMS
        if (notification.channels.sms && user.phoneNumber) {
            this.sendSMSNotification(user.phoneNumber, notification).catch(err => {
                logger_1.logger.error('SMS notification failed:', err);
            });
        }
    }
    /**
     * Send push notification (placeholder)
     */
    async sendPushNotification(userId, notification) {
        // TODO: Integrate with Firebase Cloud Messaging or APNs
        logger_1.logger.info(`Push notification sent to user ${userId}: ${notification.title}`);
    }
    /**
     * Send email notification (placeholder)
     */
    async sendEmailNotification(email, notification) {
        // TODO: Integrate with email service (SendGrid, SES, etc.)
        logger_1.logger.info(`Email sent to ${email}: ${notification.title}`);
    }
    /**
     * Send SMS notification (placeholder)
     */
    async sendSMSNotification(phone, notification) {
        // TODO: Integrate with SMS service (Twilio, etc.)
        logger_1.logger.info(`SMS sent to ${phone}: ${notification.title}`);
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.service.js.map