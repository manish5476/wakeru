import { Notification } from './notification.model';
import { User } from '../auth/auth.model';
import { logger } from '../../config/logger';
import { Types } from 'mongoose';
import { redisClient } from '../../config/redis';

export class NotificationService {
  /**
   * Create a notification
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    options: {
      data?: any;
      isActionable?: boolean;
      actionUrl?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      channels?: Partial<{ inApp: boolean; email: boolean; push: boolean; sms: boolean }>;
    } = {}
  ): Promise<any> {
    try {
      const notification = new Notification({
        userId: new Types.ObjectId(userId),
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
        logger.error('Failed to send notification through channels:', err);
      });

      // Invalidate notification cache
      await redisClient.delete(`notifications:${userId}:unread`);

      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: string;
    } = {}
  ): Promise<any> {
    const { page = 1, limit = 20, unreadOnly = false, type } = options;
    const skip = (page - 1) * limit;

    const query: any = { userId: new Types.ObjectId(userId) };
    
    if (unreadOnly) {
      query.isRead = false;
    }

    if (type) {
      query.type = type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: new Types.ObjectId(userId), isRead: false })
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
  async markAsRead(notificationId: string, userId: string): Promise<any> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: new Types.ObjectId(userId) },
      { 
        $set: { 
          isRead: true,
          readAt: new Date()
        } 
      },
      { new: true }
    );

    if (notification) {
      await redisClient.delete(`notifications:${userId}:unread`);
    }

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { 
        $set: { 
          isRead: true,
          readAt: new Date()
        } 
      }
    );

    await redisClient.delete(`notifications:${userId}:unread`);
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await Notification.findOneAndDelete({
      _id: notificationId,
      userId: new Types.ObjectId(userId)
    });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `notifications:${userId}:unread`;
    
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return parseInt(cached);
    }

    const count = await Notification.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false
    });

    await redisClient.set(cacheKey, count.toString(), 300); // 5 minutes

    return count;
  }

  /**
   * Send expense notification
   */
  async notifyExpenseAdded(groupId: string, expenseId: string, createdBy: string): Promise<void> {
    const { Group } = require('../group/group.model');
    const { Expense } = require('../expense/expense.model');
    
    const [group, expense] = await Promise.all([
      Group.findOne({ groupId }).populate('members.userId', 'userId email preferences'),
      Expense.findOne({ expenseId })
    ]);

    if (!group || !expense) return;

    const creator = group.members.find(m => m.userId._id.toString() === createdBy);
    
    for (const member of group.members) {
      if (member.userId._id.toString() === createdBy) continue;
      
      if (!member.preferences?.notificationSettings?.muteExpenses) {
        await this.createNotification(
          member.userId._id.toString(),
          'EXPENSE_ADDED',
          'New Expense Added',
          `${creator?.userId?.firstName || 'Someone'} added "${expense.description}" - ₹${expense.totalAmount}`,
          {
            data: { groupId, expenseId },
            isActionable: true,
            actionUrl: `/groups/${groupId}/expenses/${expenseId}`,
            priority: 'medium',
            channels: { email: member.userId.preferences?.notificationPreferences?.email }
          }
        );
      }
    }
  }

  /**
   * Notify settlement completed
   */
  async notifySettlementCompleted(settlement: any): Promise<void> {
    const { Group } = require('../group/group.model');
    
    const [fromUser, toUser] = await Promise.all([
      User.findById(settlement.fromUser),
      User.findById(settlement.toUser)
    ]);

    // Notify payer
    await this.createNotification(
      settlement.fromUser.toString(),
      'SETTLEMENT_COMPLETED',
      'Payment Sent',
      `You paid ${toUser?.firstName} ₹${settlement.amount}`,
      {
        data: { settlementId: settlement.settlementId },
        priority: 'high',
        channels: { push: true }
      }
    );

    // Notify recipient
    await this.createNotification(
      settlement.toUser.toString(),
      'SETTLEMENT_COMPLETED',
      'Payment Received',
      `${fromUser?.firstName} paid you ₹${settlement.amount}`,
      {
        data: { settlementId: settlement.settlementId },
        priority: 'high',
        channels: { push: true }
      }
    );
  }

  /**
   * Notify payment reminder
   */
  async notifyPaymentReminder(fromUserId: string, toUserId: string, amount: number): Promise<void> {
    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUserId),
      User.findById(toUserId)
    ]);

    await this.createNotification(
      fromUserId,
      'PAYMENT_REMINDER',
      'Payment Reminder',
      `Reminder: You owe ${toUser?.firstName} ₹${amount}`,
      {
        priority: 'urgent',
        channels: { push: true, email: true }
      }
    );
  }

  /**
   * Send monthly report notification
   */
  async notifyMonthlyReport(userId: string, reportData: any): Promise<void> {
    const user = await User.findById(userId);
    
    if (user?.preferences?.notificationPreferences?.monthlyReports) {
      await this.createNotification(
        userId,
        'MONTHLY_REPORT',
        'Monthly Spending Report',
        `Your monthly spending report is ready. Total: ₹${reportData.totalSpent}`,
        {
          data: { reportUrl: `/reports/monthly` },
          isActionable: true,
          priority: 'low',
          channels: { email: true }
        }
      );
    }
  }

  /**
   * Send through different channels
   */
  private async sendThroughChannels(notification: any, userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    // Send push notification
    if (notification.channels.push) {
      this.sendPushNotification(userId, notification).catch(err => {
        logger.error('Push notification failed:', err);
      });
    }

    // Send email
    if (notification.channels.email) {
      this.sendEmailNotification(user.email, notification).catch(err => {
        logger.error('Email notification failed:', err);
      });
    }

    // Send SMS
    if (notification.channels.sms && user.phoneNumber) {
      this.sendSMSNotification(user.phoneNumber, notification).catch(err => {
        logger.error('SMS notification failed:', err);
      });
    }
  }

  /**
   * Send push notification (placeholder)
   */
  private async sendPushNotification(userId: string, notification: any): Promise<void> {
    // TODO: Integrate with Firebase Cloud Messaging or APNs
    logger.info(`Push notification sent to user ${userId}: ${notification.title}`);
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(email: string, notification: any): Promise<void> {
    // TODO: Integrate with email service (SendGrid, SES, etc.)
    logger.info(`Email sent to ${email}: ${notification.title}`);
  }

  /**
   * Send SMS notification (placeholder)
   */
  private async sendSMSNotification(phone: string, notification: any): Promise<void> {
    // TODO: Integrate with SMS service (Twilio, etc.)
    logger.info(`SMS sent to ${phone}: ${notification.title}`);
  }
}

export const notificationService = new NotificationService();