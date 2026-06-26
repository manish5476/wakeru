import { Notification } from './notification.model';
import { User } from '../auth/auth.model';
import { Trip } from '../trips/trip.model';
import { Expense } from '../expense/expense.model';
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors/AppError';

// ============================================================
// TYPES
// ============================================================

interface CreateNotificationOptions {
  data?: Record<string, any>;
  isActionable?: boolean;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  channels?: Partial<{
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  }>;
}

interface NotificationQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
}

// ============================================================
// NOTIFICATION SERVICE
// ============================================================

export class NotificationService {
  
  /**
   * Create a notification for a user.
   */
  async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    options: CreateNotificationOptions = {}
  ) {
    try {
      const notification = new Notification({
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
        logger.error('Channel delivery failed:', err);
      });

      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications (paginated).
   */
  async getUserNotifications(userId: string, options: NotificationQuery = {}) {
    const { page = 1, limit = 20, unreadOnly = false, type } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { userId };
    if (unreadOnly) query.isRead = false;
    if (type) query.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false }),
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
  async markAsRead(notificationId: string, userId: string) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) throw new AppError('Notification not found', 404);
    return notification;
  }

  /**
   * Mark ALL notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
  }

  /**
   * Delete a notification.
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!result) throw new AppError('Notification not found', 404);
  }

  /**
   * Clear ALL notifications.
   */
  async clearAll(userId: string): Promise<void> {
    await Notification.deleteMany({ userId });
  }

  /**
   * Get unread count.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ userId, isRead: false });
  }

  // ============================================================
  // TRIPSPLIT-SPECIFIC NOTIFICATIONS
  // ============================================================

  /**
   * Notify all trip members (except the actor) about a new expense.
   */
  async notifyExpenseAdded(
    tripId: string,
    expenseId: string,
    actorUid: string
  ): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const expense = await Expense.findById(expenseId).lean();
    if (!expense) return;

    const actor = trip.members.find((m) => m.userId === actorUid);
    const actorName = actor?.displayName || 'Someone';

    for (const member of trip.members) {
      if (member.userId === actorUid || !member.isActive) continue;

      await this.create(
        member.userId,
        'EXPENSE_ADDED',
        'New Expense Added',
        `${actorName} added "${expense.title}" — ${expense.amountLocal} ${expense.localCurrency}`,
        {
          data: { tripId, expenseId: expense._id.toString(), stopId: expense.stopId.toString() },
          isActionable: true,
          actionUrl: `/trips/${tripId}/expenses/${expense._id}`,
          priority: 'medium',
        }
      );
    }
  }

  /**
   * Notify about settlement request.
   */
  async notifySettlementRequest(
    fromUid: string,
    toUid: string,
    amount: number,
    baseCurrency: string,
    tripId: string
  ): Promise<void> {
    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUid).lean(),
      User.findById(toUid).lean(),
    ]);

    await this.create(
      toUid,
      'SETTLEMENT_REQUEST',
      'Settlement Request',
      `${fromUser?.displayName || 'Someone'} requests ₹${amount} ${baseCurrency}`,
      {
        data: { tripId, fromUid, amount, baseCurrency },
        isActionable: true,
        actionUrl: `/trips/${tripId}/settle`,
        priority: 'high',
        channels: { push: true, email: true },
      }
    );
  }

  /**
   * Notify about completed settlement.
   */
  async notifySettlementCompleted(
    fromUid: string,
    toUid: string,
    amount: number,
    baseCurrency: string,
    tripId: string
  ): Promise<void> {
    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUid).lean(),
      User.findById(toUid).lean(),
    ]);

    // Notify payer
    await this.create(
      fromUid,
      'SETTLEMENT_COMPLETED',
      'Payment Sent',
      `You paid ${toUser?.displayName || 'Someone'} ₹${amount} ${baseCurrency}`,
      {
        data: { tripId, toUid, amount },
        priority: 'high',
        channels: { push: true },
      }
    );

    // Notify recipient
    await this.create(
      toUid,
      'SETTLEMENT_COMPLETED',
      'Payment Received',
      `${fromUser?.displayName || 'Someone'} paid you ₹${amount} ${baseCurrency}`,
      {
        data: { tripId, fromUid, amount },
        priority: 'high',
        channels: { push: true },
      }
    );
  }

  /**
   * Notify user about trip invitation.
   */
  async notifyTripInvitation(
    toUid: string,
    tripId: string,
    tripTitle: string,
    inviterName: string
  ): Promise<void> {
    await this.create(
      toUid,
      'TRIP_INVITATION',
      'Trip Invitation',
      `${inviterName} invited you to "${tripTitle}"`,
      {
        data: { tripId },
        isActionable: true,
        actionUrl: `/trips/${tripId}/join`,
        priority: 'high',
        channels: { push: true, email: true },
      }
    );
  }

  /**
   * Notify trip members that someone joined.
   */
  async notifyTripJoined(
    tripId: string,
    joinerUid: string
  ): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const joiner = trip.members.find((m) => m.userId === joinerUid);
    const joinerName = joiner?.displayName || 'Someone';

    for (const member of trip.members) {
      if (member.userId === joinerUid || !member.isActive) continue;

      await this.create(
        member.userId,
        'TRIP_JOINED',
        'New Member Joined',
        `${joinerName} joined "${trip.title}"`,
        {
          data: { tripId, joinerUid },
          priority: 'low',
        }
      );
    }
  }

  /**
   * Notify user about payment reminder.
   */
  async notifyPaymentReminder(
    fromUid: string,
    toUid: string,
    amount: number,
    baseCurrency: string,
    tripId: string
  ): Promise<void> {
    const toUser = await User.findById(toUid).lean();

    await this.create(
      fromUid,
      'PAYMENT_REMINDER',
      'Payment Reminder',
      `Reminder: You owe ${toUser?.displayName || 'Someone'} ₹${amount} ${baseCurrency}`,
      {
        data: { tripId, toUid, amount },
        isActionable: true,
        actionUrl: `/trips/${tripId}/settle`,
        priority: 'urgent',
        channels: { push: true, email: true },
      }
    );
  }

  /**
   * Broadcast an app update / system notification to all active users.
   */
  async broadcastSystemUpdate(link: string): Promise<void> {
    const activeUsers = await User.find({ isActive: true, isDeleted: false }).select('_id').lean();
    if (!activeUsers.length) return;

    const notifications = activeUsers.map((u) => ({
      userId: u._id.toString(),
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

    await Notification.insertMany(notifications);
  }

  // ============================================================
  // CHANNEL DELIVERY (Placeholders)
  // ============================================================

  private async sendThroughChannels(notification: any): Promise<void> {
    const user = await User.findById(notification.userId).lean();
    if (!user) return;

    const promises: Promise<void>[] = [];

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

  private async sendPush(user: any, notification: any): Promise<void> {
    if (!user.fcmToken) return;
    // TODO: Integrate with Firebase Cloud Messaging
    logger.info(`📱 Push to ${user._id}: ${notification.title}`);
  }

  private async sendEmail(email: string, notification: any): Promise<void> {
    // TODO: Integrate with SendGrid / SES
    logger.info(`📧 Email to ${email}: ${notification.title}`);
  }

  private async sendSMS(phone: string, notification: any): Promise<void> {
    // TODO: Integrate with Twilio
    logger.info(`💬 SMS to ${phone}: ${notification.title}`);
  }
}

export const notificationService = new NotificationService();