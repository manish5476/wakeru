import { Notification, INotification, NotificationType } from './notification.model';
import { User } from '../auth/auth.model';
import { Trip } from '../trips/trip.model';
import { Expense } from '../expense/expense.model';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors/AppError';
import { getMessaging } from 'firebase-admin/messaging';

// ============================================================
// TYPES
// ============================================================

interface CreateNotificationOptions {
  data?: Record<string, any>;
  isActionable?: boolean;
  actionButtons?: {
    label: string;
    action: string;
    value: string;
    icon?: string;
    style?: 'primary' | 'secondary' | 'danger';
  }[];
  actionUrl?: string;
  deepLink?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  expiryInDays?: number;
  channels?: Partial<{
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  }>;
  icon?: string;
  imageUrl?: string;
  category?: string;
  body?: string;
}

interface NotificationQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
  category?: string;
  priority?: string;
}

// ============================================================
// NOTIFICATION SERVICE
// ============================================================

export class NotificationService {

  /**
   * Create a notification for a user.
   * Also sends via WebSocket if user is online.
   */
  async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    options: CreateNotificationOptions = {}
  ): Promise<INotification> {
    try {
      const notification = new Notification({
        userId,
        type,
        title,
        message,
        body: options.body,
        data: options.data || {},
        isActionable: options.isActionable ?? false,
        actionButtons: options.actionButtons || [],
        actionUrl: options.actionUrl,
        deepLink: options.deepLink,
        priority: options.priority ?? 'medium',
        channels: {
          inApp: options.channels?.inApp ?? true,
          email: options.channels?.email ?? false,
          push: options.channels?.push ?? true,
          sms: options.channels?.sms ?? false,
        },
        icon: options.icon,
        imageUrl: options.imageUrl,
        category: options.category,
        ttl: options.expiryInDays ? options.expiryInDays * 24 * 60 * 60 : undefined,
      });

      await notification.save();

      // Send via WebSocket if user is online
      if (socketServer.isUserOnline(userId)) {
        socketServer.sendToUser(userId, 'notification:new', {
          type: 'NOTIFICATION_NEW',
          notification: notification.toJSON(),
          timestamp: new Date().toISOString(),
        });
      }

      // Fire-and-forget: send through other channels
      this.sendThroughChannels(notification).catch((err) => {
        logger.error('Channel delivery failed:', { userId, type, error: err.message });
      });

      logger.info(`Notification created: ${type} → ${userId}`);
      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', { userId, type, error });
      throw error;
    }
  }

  /**
   * Create multiple notifications at once (bulk).
   */
  async createBulk(
    notifications: Array<{
      userId: string;
      type: string;
      title: string;
      message: string;
      options?: CreateNotificationOptions;
    }>
  ): Promise<void> {
    const docs = notifications.map(n => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      body: n.options?.body,
      data: n.options?.data || {},
      isActionable: n.options?.isActionable ?? false,
      actionButtons: n.options?.actionButtons || [],
      actionUrl: n.options?.actionUrl,
      deepLink: n.options?.deepLink,
      priority: n.options?.priority ?? 'medium',
      channels: {
        inApp: n.options?.channels?.inApp ?? true,
        email: n.options?.channels?.email ?? false,
        push: n.options?.channels?.push ?? true,
        sms: n.options?.channels?.sms ?? false,
      },
      icon: n.options?.icon,
      imageUrl: n.options?.imageUrl,
      category: n.options?.category,
      ttl: n.options?.expiryInDays ? n.options.expiryInDays * 24 * 60 * 60 : undefined,
    }));

    await Notification.insertMany(docs);

    // Notify online users via WebSocket
    const uniqueUserIds = [...new Set(notifications.map(n => n.userId))];
    for (const uid of uniqueUserIds) {
      if (socketServer.isUserOnline(uid)) {
        socketServer.sendToUser(uid, 'notification:batch', {
          type: 'NOTIFICATION_BATCH',
          count: notifications.filter(n => n.userId === uid).length,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Get user's notifications (paginated, filterable).
   */
  async getUserNotifications(userId: string, options: NotificationQuery = {}) {
    const { page = 1, limit = 20, unreadOnly = false, type, category, priority } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { userId };
    if (unreadOnly) query.isRead = false;
    if (type) query.type = type;
    if (category) query.category = category;
    if (priority) query.priority = priority;

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
   * Get unread notification count.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ userId, isRead: false });
  }

  /**
   * Get notification stats (grouped by type).
   */
  async getNotificationStats(userId: string) {
    return (Notification as any).getNotificationStats(userId);
  }

  /**
   * Mark single notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<INotification> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) throw new AppError('Notification not found', 404);
    return notification;
  }

  /**
   * Mark notification as clicked.
   */
  async markAsClicked(notificationId: string, userId: string): Promise<void> {
    await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { clickedAt: new Date() } }
    );
  }

  /**
   * Mark notification as dismissed.
   */
  async markAsDismissed(notificationId: string, userId: string): Promise<void> {
    await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { dismissedAt: new Date(), isRead: true } }
    );
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
   * Mark notifications as read by type.
   */
  async markAsReadByType(userId: string, type: string): Promise<void> {
    await Notification.updateMany(
      { userId, type, isRead: false },
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
   * Delete old notifications.
   */
  async deleteOldNotifications(userId: string, olderThanDays: number = 30): Promise<void> {
    await (Notification as any).deleteOldNotifications(userId, olderThanDays);
  }

  /**
   * Clear ALL notifications for a user.
   */
  async clearAll(userId: string): Promise<void> {
    await Notification.deleteMany({ userId });
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

    const actor = trip.members.find((m: any) => m.userId === actorUid);
    const actorName = actor?.displayName || 'Someone';

    const notifications = trip.members
      .filter((m: any) => m.userId !== actorUid && m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'EXPENSE_ADDED' as const,
        title: 'New Expense Added 💰',
        message: `${actorName} added "${expense.title}" — ${expense.amountLocal} ${expense.localCurrency}`,
        options: {
          data: { tripId, expenseId: expense._id.toString(), stopId: expense.stopId.toString() },
          isActionable: true,
          actionUrl: `/trips/${tripId}/expenses/${expense._id}`,
          priority: 'medium' as const,
          category: 'expense',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify trip members about an updated expense.
   */
  async notifyExpenseUpdated(
    tripId: string,
    expenseId: string,
    expenseTitle: string,
    editorUid: string
  ): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const editor = trip.members.find((m: any) => m.userId === editorUid);
    const editorName = editor?.displayName || 'Someone';

    const notifications = trip.members
      .filter((m: any) => m.userId !== editorUid && m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'EXPENSE_UPDATED' as const,
        title: 'Expense Updated 📝',
        message: `${editorName} updated "${expenseTitle}"`,
        options: {
          data: { tripId, expenseId },
          priority: 'low' as const,
          category: 'expense',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify trip members about a deleted expense.
   */
  async notifyExpenseDeleted(
    tripId: string,
    expenseTitle: string,
    actorUid: string
  ): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const actor = trip.members.find((m: any) => m.userId === actorUid);
    const actorName = actor?.displayName || 'Someone';

    const notifications = trip.members
      .filter((m: any) => m.userId !== actorUid && m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'EXPENSE_DELETED' as const,
        title: 'Expense Deleted 🗑️',
        message: `${actorName} deleted "${expenseTitle}"`,
        options: {
          data: { tripId },
          priority: 'low' as const,
          category: 'expense',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify about a comment on an expense.
   */
  async notifyExpenseComment(
    expenseId: string,
    commenterUid: string,
    commenterName: string,
    commentText: string,
    tripId: string
  ): Promise<void> {
    const expense = await Expense.findById(expenseId).lean();
    if (!expense) return;

    // Notify the expense payer + anyone who commented
    const notifiedUsers = new Set<string>();

    if (expense.paidBy !== commenterUid) {
      notifiedUsers.add(expense.paidBy);
    }

    expense.comments?.forEach((c: any) => {
      if (c.userId !== commenterUid) {
        notifiedUsers.add(c.userId);
      }
    });

    for (const uid of notifiedUsers) {
      await this.create(
        uid,
        'EXPENSE_COMMENT_ADDED',
        'New Comment 💬',
        `${commenterName} commented on "${expense.title}": "${commentText.substring(0, 100)}"`,
        {
          data: { tripId, expenseId },
          isActionable: true,
          actionUrl: `/trips/${tripId}/expenses/${expenseId}`,
          priority: 'medium',
          category: 'expense',
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
      User.findOne({ $or: [{ _id: fromUid }, { firebaseUid: fromUid }] }).select('displayName').lean(),
      User.findOne({ $or: [{ _id: toUid }, { firebaseUid: toUid }] }).select('displayName').lean(),
    ]);

    await this.create(
      toUid,
      'SETTLEMENT_REQUEST',
      'Settlement Request 💸',
      `${fromUser?.displayName || 'Someone'} requests ${baseCurrency} ${amount}`,
      {
        data: { tripId, fromUid, amount, baseCurrency },
        isActionable: true,
        actionButtons: [
          { label: '💸 Pay Now', action: 'open_upi', value: 'pay', style: 'primary' },
          { label: '📋 View Details', action: 'view_settlement', value: 'view' },
        ],
        actionUrl: `/trips/${tripId}/settle`,
        priority: 'high',
        category: 'settlement',
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
      User.findOne({ $or: [{ _id: fromUid }, { firebaseUid: fromUid }] }).select('displayName').lean(),
      User.findOne({ $or: [{ _id: toUid }, { firebaseUid: toUid }] }).select('displayName').lean(),
    ]);

    // Notify payer
    await this.create(
      fromUid,
      'SETTLEMENT_COMPLETED',
      'Payment Sent ✅',
      `You paid ${toUser?.displayName || 'Someone'} ${baseCurrency} ${amount}`,
      {
        data: { tripId, toUid, amount, baseCurrency },
        priority: 'high',
        category: 'settlement',
        channels: { push: true },
      }
    );

    // Notify recipient
    await this.create(
      toUid,
      'SETTLEMENT_COMPLETED',
      'Payment Received 🎉',
      `${fromUser?.displayName || 'Someone'} paid you ${baseCurrency} ${amount}`,
      {
        data: { tripId, fromUid, amount, baseCurrency },
        priority: 'high',
        category: 'settlement',
        channels: { push: true },
      }
    );
  }

  /**
   * Notify that a settlement was disputed.
   */
  async notifySettlementDisputed(
    userId: string,
    tripId: string,
    amount: number,
    baseCurrency: string,
    reason: string
  ): Promise<void> {
    await this.create(
      userId,
      'SETTLEMENT_DISPUTED',
      'Payment Disputed ⚠️',
      `A payment of ${baseCurrency} ${amount} was disputed: "${reason}"`,
      {
        data: { tripId, amount, baseCurrency, reason },
        isActionable: true,
        priority: 'urgent',
        category: 'settlement',
        channels: { push: true, email: true },
      }
    );
  }

  /**
   * Notify that settlement was calculated.
   */
  async notifySettlementCalculated(
    tripId: string,
    transactionCount: number,
    baseCurrency: string
  ): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const notifications = trip.members
      .filter((m: any) => m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'SETTLEMENT_CALCULATED' as const,
        title: 'Settlement Calculated 🧮',
        message: `${transactionCount} transfers needed to settle up`,
        options: {
          data: { tripId, transactionCount, baseCurrency },
          isActionable: true,
          actionUrl: `/trips/${tripId}/settle`,
          priority: 'medium' as const,
          category: 'settlement',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify that trip is fully settled.
   */
  async notifyTripFullySettled(tripId: string): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const notifications = trip.members
      .filter((m: any) => m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'TRIP_FULLY_SETTLED' as const,
        title: 'Trip Fully Settled! 🎉🏁',
        message: `All payments for "${trip.title}" are complete!`,
        options: {
          data: { tripId },
          priority: 'high' as const,
          category: 'settlement',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify user about trip invitation.
   */
  // async notifyTripInvitation(
  //   toUid: string,
  //   tripId: string,
  //   tripTitle: string,
  //   inviterName: string
  // ): Promise<void> {
  //   await this.create(
  //     toUid,
  //     'TRIP_INVITATION',
  //     'Trip Invitation! 🧳',
  //     `${inviterName} invited you to "${tripTitle}"`,
  //     {
  //       data: { tripId },
  //       isActionable: true,
  //       actionButtons: [
  //         { label: '✅ Accept', action: 'accept_invitation', value: 'accept', style: 'primary' },
  //         { label: '❌ Decline', action: 'decline_invitation', value: 'decline', style: 'danger' },
  //       ],
  //       actionUrl: `/trips/${tripId}/join`,
  //       priority: 'high',
  //       category: 'trip',
  //       channels: { push: true, email: true },
  //     }
  //   );
  // }
// In notification.service.ts, update these methods:

  /**
   * Notify user about trip invitation.
   */
  async notifyTripInvitation(
    toUid: string,
    tripId: string,
    tripTitle: string,
    inviterName: string,
    invitationId: string  // ✅ Added invitationId parameter
  ): Promise<void> {
    await this.create(
      toUid,
      'TRIP_INVITATION',
      'Trip Invitation! 🧳',
      `${inviterName} invited you to "${tripTitle}"`,
      {
        data: { 
          tripId, 
          invitationId,  // ✅ Store in notification data
          type: 'invitation' 
        },
        isActionable: true,
        actionButtons: [
          { 
            label: '✅ Accept', 
            action: 'accept',  // ✅ Simplified
            value: 'accept', 
            style: 'primary' 
          },
          { 
            label: '❌ Decline', 
            action: 'decline',  // ✅ Simplified
            value: 'decline', 
            style: 'danger' 
          },
        ],
        actionUrl: `/trips/${tripId}`,
        priority: 'high',
        category: 'trip',
        channels: { push: true, email: true },
      }
    );
  }

  /**
   * Notify about a join request.
   */
  async notifyJoinRequest(
    adminUid: string,
    requesterName: string,
    tripTitle: string,
    tripId: string,
    requestId: string
  ): Promise<void> {
    await this.create(
      adminUid,
      'TRIP_JOIN_REQUEST',
      'New Join Request 🙋',
      `${requesterName} wants to join "${tripTitle}"`,
      {
        data: { 
          tripId, 
          requestId,  // ✅ Store requestId in data
          type: 'join_request' 
        },
        isActionable: true,
        actionButtons: [
          { 
            label: '✅ Approve', 
            action: 'accept',  // ✅ Unified
            value: 'approve', 
            style: 'primary' 
          },
          { 
            label: '❌ Reject', 
            action: 'decline',  // ✅ Unified
            value: 'reject', 
            style: 'danger' 
          },
        ],
        priority: 'high',
        category: 'trip',
        channels: { push: true },
      }
    );
  }

  /**
   * Notify that friend request was accepted.
   */
  async notifyFriendAccepted(
    userId: string,
    friendName: string,
    friendId?: string
  ): Promise<void> {
    await this.create(
      userId,
      'FRIEND_ACCEPTED',
      'Friend Request Accepted! 🎉',
      `${friendName} accepted your friend request`,
      {
        data: { friendName, friendId },
        priority: 'medium',
        category: 'social',
        channels: { push: true },
      }
    );
  }


  /**
   * Notify admin that invitation was accepted.
   */
  async notifyInvitationAccepted(
    adminUid: string,
    userName: string,
    tripTitle: string,
    tripId: string
  ): Promise<void> {
    await this.create(
      adminUid,
      'TRIP_INVITATION_ACCEPTED',
      'Invitation Accepted ✅',
      `${userName} accepted your invitation to "${tripTitle}"`,
      {
        data: { tripId, userName },
        priority: 'medium',
        category: 'trip',
      }
    );
  }

  /**
   * Notify admin that invitation was declined.
   */
  async notifyInvitationDeclined(
    adminUid: string,
    userName: string,
    tripTitle: string,
    tripId: string
  ): Promise<void> {
    await this.create(
      adminUid,
      'TRIP_INVITATION_DECLINED',
      'Invitation Declined ❌',
      `${userName} declined your invitation to "${tripTitle}"`,
      {
        data: { tripId, userName },
        priority: 'low',
        category: 'trip',
      }
    );
  }

  // /**
//  * Notify about a join request.
  //  */
  // async notifyJoinRequest(
  //   adminUid: string,
  //   requesterName: string,
  //   tripTitle: string,
  //   tripId: string,
  //   requestId: string
  // ): Promise<void> {
  //   await this.create(
  //     adminUid,
  //     'TRIP_JOIN_REQUEST',
  //     'New Join Request 🙋',
  //     `${requesterName} wants to join "${tripTitle}"`,
  //     {
  //       data: { tripId, requestId },
  //       isActionable: true,
  //       actionButtons: [
  //         { label: '✅ Approve', action: 'approve_join', value: 'approve', style: 'primary' },
  //         { label: '❌ Reject', action: 'reject_join', value: 'reject', style: 'danger' },
  //       ],
  //       priority: 'high',
  //       category: 'trip',
  //       channels: { push: true },
  //     }
  //   );
  // }

  /**
   * Notify that join request was approved.
   */
  async notifyJoinApproved(
    userId: string,
    tripTitle: string,
    tripId: string
  ): Promise<void> {
    await this.create(
      userId,
      'TRIP_JOIN_APPROVED',
      'Join Request Approved! 👍',
      `Your request to join "${tripTitle}" has been approved!`,
      {
        data: { tripId },
        isActionable: true,
        actionUrl: `/trips/${tripId}`,
        priority: 'high',
        category: 'trip',
        channels: { push: true },
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

    const joiner = trip.members.find((m: any) => m.userId === joinerUid);
    const joinerName = joiner?.displayName || 'Someone';

    const notifications = trip.members
      .filter((m: any) => m.userId !== joinerUid && m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'TRIP_JOINED' as const,
        title: 'New Member Joined 🎊',
        message: `${joinerName} joined "${trip.title}"`,
        options: {
          data: { tripId, joinerUid },
          priority: 'low' as const,
          category: 'trip',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify that a member was removed.
   */
  async notifyMemberRemoved(
    tripId: string,
    memberName: string,
    removedByUid: string
  ): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const notifications = trip.members
      .filter((m: any) => m.userId !== removedByUid && m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'TRIP_MEMBER_REMOVED' as const,
        title: 'Member Removed 👤',
        message: `${memberName} has been removed from "${trip.title}"`,
        options: {
          data: { tripId },
          priority: 'medium' as const,
          category: 'trip',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify that trip is completed.
   */
  async notifyTripCompleted(tripId: string): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const notifications = trip.members
      .filter((m: any) => m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'TRIP_COMPLETED' as const,
        title: 'Trip Completed! 🏆',
        message: `"${trip.title}" has been completed. Check your trip insights!`,
        options: {
          data: { tripId },
          isActionable: true,
          actionUrl: `/trips/${tripId}/insights`,
          priority: 'medium' as const,
          category: 'trip',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify about a new stop added.
   */
  async notifyStopAdded(
    tripId: string,
    stopName: string,
    actorUid: string
  ): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const actor = trip.members.find((m: any) => m.userId === actorUid);
    const actorName = actor?.displayName || 'Someone';

    const notifications = trip.members
      .filter((m: any) => m.userId !== actorUid && m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'STOP_ADDED' as const,
        title: 'New Stop Added 📍',
        message: `${actorName} added "${stopName}" to the trip`,
        options: {
          data: { tripId, stopName },
          priority: 'low' as const,
          category: 'trip',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify about exchange rate update.
   */
  async notifyExchangeRateUpdated(
    tripId: string,
    stopName: string,
    newRate: number,
    currency: string,
    baseCurrency: string
  ): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const notifications = trip.members
      .filter((m: any) => m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: 'EXCHANGE_RATE_UPDATED' as const,
        title: 'Exchange Rate Updated 💱',
        message: `1 ${currency} = ${newRate} ${baseCurrency} for ${stopName}`,
        options: {
          data: { tripId, stopName, newRate, currency, baseCurrency },
          priority: 'low' as const,
          category: 'trip',
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify about friend request.
   */
  async notifyFriendRequest(
    toUid: string,
    fromUserId: string,
    fromName: string,
    requestId: string
  ): Promise<void> {
    await this.create(
      toUid,
      'FRIEND_REQUEST',
      'New Friend Request 🤝',
      `${fromName} wants to be your friend`,
      {
        data: { fromUserId, requestId },
        isActionable: true,
        actionButtons: [
          { label: '✅ Accept', action: 'accept_friend', value: 'accept', style: 'primary' },
          { label: '❌ Decline', action: 'decline_friend', value: 'decline', style: 'danger' },
        ],
        priority: 'medium',
        category: 'social',
        channels: { push: true },
      }
    );
  }

  // /**
  //  * Notify that friend request was accepted.
  //  */
  // async notifyFriendAccepted(
  //   userId: string,
  //   friendName: string
  // ): Promise<void> {
  //   await this.create(
  //     userId,
  //     'FRIEND_ACCEPTED',
  //     'Friend Request Accepted! 🎉',
  //     `${friendName} accepted your friend request`,
  //     {
  //       data: { friendName },
  //       priority: 'medium',
  //       category: 'social',
  //       channels: { push: true },
  //     }
  //   );
  // }

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
    const toUser = await User.findOne({ $or: [{ _id: toUid }, { firebaseUid: toUid }] })
      .select('displayName')
      .lean();

    await this.create(
      fromUid,
      'PAYMENT_REMINDER',
      'Payment Reminder ⏰',
      `Reminder: You owe ${toUser?.displayName || 'Someone'} ${baseCurrency} ${amount}`,
      {
        data: { tripId, toUid, amount, baseCurrency },
        isActionable: true,
        actionButtons: [
          { label: '💸 Pay Now', action: 'open_upi', value: 'pay', style: 'primary' },
        ],
        actionUrl: `/trips/${tripId}/settle`,
        priority: 'urgent',
        category: 'settlement',
        channels: { push: true, email: true },
      }
    );
  }

  /**
   * Notify about budget warning/exceeded.
   */
  async notifyBudgetAlert(
    tripId: string,
    stopName: string,
    pctUsed: number,
    currency: string
  ): Promise<void> {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) return;

    const isExceeded = pctUsed >= 100;
    const type = isExceeded ? 'BUDGET_EXCEEDED' : 'BUDGET_WARNING';

    const notifications = trip.members
      .filter((m: any) => m.isActive)
      .map((m: any) => ({
        userId: m.userId,
        type: type as NotificationType,
        title: isExceeded ? '🚨 Budget Exceeded!' : '⚠️ Budget Warning',
        message: `${pctUsed.toFixed(0)}% of budget used for ${stopName}`,
        options: {
          data: { tripId, stopName, pctUsed, currency },
          isActionable: true,
          actionUrl: `/trips/${tripId}`,
          priority: isExceeded ? 'urgent' as const : 'high' as const,
          category: 'budget',
          channels: { push: true },
        },
      }));

    if (notifications.length > 0) {
      await this.createBulk(notifications);
    }
  }

  /**
   * Notify about achievement unlocked.
   */
  async notifyAchievementUnlocked(
    userId: string,
    achievementId: string,
    name: string,
    description: string,
    icon: string,
    tier: string,
    pointsValue: number
  ): Promise<void> {
    const tierEmoji: Record<string, string> = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎',
      diamond: '👑',
    };

    await this.create(
      userId,
      'ACHIEVEMENT_UNLOCKED',
      `${tierEmoji[tier] || '🏆'} Achievement Unlocked!`,
      `${icon} ${name}: ${description}`,
      {
        data: { achievementId, tier, pointsValue },
        priority: 'high',
        icon,
        category: 'achievement',
        channels: { push: true },
      }
    );
  }

  /**
   * Notify about exchange rate alert.
   */
  async notifyRateAlert(
    userId: string,
    alertId: string,
    fromCurrency: string,
    toCurrency: string,
    currentRate: number,
    targetRate: number,
    direction: string,
    tripName?: string
  ): Promise<void> {
    await this.create(
      userId,
      'RATE_ALERT_TRIGGERED',
      'Exchange Rate Alert! 💱',
      `${fromCurrency}/${toCurrency} is now ${currentRate.toFixed(4)} (${direction} ${targetRate})`,
      {
        data: { alertId, currentRate, targetRate, direction, tripName },
        priority: 'high',
        category: 'rate_alert',
        channels: { push: true },
      }
    );
  }

  /**
   * Notify friends about a trip (social invite).
   */
  async notifyTripFriendInvite(
    friendUid: string,
    inviteData: {
      tripId: string;
      tripTitle: string;
      tripDestination: string;
      tripStartDate: Date;
      tripEndDate: Date;
      inviterName: string;
      totalMembers: number;
      baseCurrency: string;
      coverImage?: string;
      message?: string;
    }
  ): Promise<void> {
    await this.create(
      friendUid,
      'TRIP_FRIEND_INVITE',
      `${inviteData.inviterName} is planning a trip! 🧳`,
      `${inviteData.inviterName} is going to ${inviteData.tripDestination}`,
      {
        data: inviteData,
        isActionable: true,
        imageUrl: inviteData.coverImage,
        actionButtons: [
          { label: '👋 Interested', action: 'trip_interest', value: 'interested', style: 'primary' },
          { label: '✅ Going!', action: 'trip_interest', value: 'going', style: 'primary' },
          { label: '🤔 Maybe', action: 'trip_interest', value: 'maybe' },
          { label: '❌ Pass', action: 'trip_interest', value: 'declined', style: 'danger' },
        ],
        priority: 'high',
        category: 'social',
        expiryInDays: 14,
        channels: { push: true },
      }
    );
  }

  /**
   * Broadcast an app update / system notification to all active users.
   */
  async broadcastSystemUpdate(title: string, message: string, link?: string): Promise<void> {
    const activeUsers = await User.find({ isActive: true, isDeleted: false })
      .select('firebaseUid')
      .lean();

    if (!activeUsers.length) return;

    const notifications = activeUsers.map((u: any) => ({
      userId: u.firebaseUid,
      type: 'SYSTEM_UPDATE' as const,
      title: title || '🚀 New Update Available!',
      message: message || 'A new version of the app has been released.',
      isActionable: !!link,
      actionUrl: link,
      priority: 'high' as const,
      channels: {
        inApp: true,
        email: false,
        push: false,
        sms: false,
      },
    }));

    await Notification.insertMany(notifications);
    logger.info(`System update broadcast to ${activeUsers.length} users`);
  }

  /**
   * Send welcome notification to new user.
   */
  async sendWelcomeNotification(userId: string, displayName: string): Promise<void> {
    await this.create(
      userId,
      'WELCOME',
      'Welcome to TripSplit! 👋',
      `Hey ${displayName}! Start by creating your first trip or adding friends.`,
      {
        isActionable: true,
        actionButtons: [
          { label: '🗺️ Create Trip', action: 'create_trip', value: 'create', style: 'primary' },
          { label: '👥 Add Friends', action: 'add_friends', value: 'friends' },
        ],
        priority: 'high',
        category: 'system',
      }
    );
  }

  // ============================================================
  // CHANNEL DELIVERY
  // ============================================================

  private async sendThroughChannels(notification: any): Promise<void> {
    const user = await User.findOne({
      $or: [
        { _id: notification.userId },
        { firebaseUid: notification.userId }
      ]
    })
      .select('_id firebaseUid email phoneNumber fcmTokens')
      .lean();
    if (!user) return;

    const promises: Promise<void>[] = [];

    if (notification.channels?.push && (user as any).fcmTokens?.length > 0) {
      promises.push(this.sendPush(user, notification));
    }
    if (notification.channels?.email && (user as any).email) {
      promises.push(this.sendEmail((user as any).email, notification));
    }
    if (notification.channels?.sms && (user as any).phoneNumber) {
      promises.push(this.sendSMS((user as any).phoneNumber, notification));
    }

    await Promise.allSettled(promises);
  }

  private async sendPush(user: any, notification: any): Promise<void> {
    try {
      const message = {
        notification: {
          title: notification.title,
          body: notification.message || notification.body,
        },
        data: notification.options?.data ? Object.fromEntries(
          Object.entries(notification.options.data).map(([k, v]) => [k, String(v)])
        ) : {},
        tokens: user.fcmTokens,
      };

      const response = await getMessaging().sendEachForMulticast(message);
      
      // Cleanup invalid tokens
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(user.fcmTokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        await User.updateOne(
          { _id: user._id },
          { $pull: { fcmTokens: { $in: failedTokens } } }
        );
        logger.info(`Removed ${failedTokens.length} invalid FCM tokens for user ${user._id}`);
      }
      
      logger.info(`📱 Push sent to ${user.firebaseUid} (${response.successCount} successful, ${response.failureCount} failed): ${notification.title}`);
    } catch (error) {
      logger.error(`Failed to send push notification to ${user.firebaseUid}:`, error);
    }
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

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const notificationService = new NotificationService();


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
//   expiryInDays?: number;
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
//     // FIX: fromUid/toUid are Firebase UIDs (same convention as everywhere
//     // else in this app), not Mongo _id — findById() always returned null
//     // here, so every settlement notification silently said "Someone"
//     // instead of the real name.
//     const [fromUser, toUser] = await Promise.all([
//       User.findByFirebaseUid(fromUid),
//       User.findByFirebaseUid(toUid),
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
//     // FIX: same Firebase UID lookup correction as notifySettlementRequest.
//     const [fromUser, toUser] = await Promise.all([
//       User.findByFirebaseUid(fromUid),
//       User.findByFirebaseUid(toUid),
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
//     // FIX: same Firebase UID lookup correction.
//     const toUser = await User.findByFirebaseUid(toUid);

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
//     // FIX: was selecting/using `_id`, but every read path
//     // (getUserNotifications, markAllAsRead, etc.) queries Notification.userId
//     // by Firebase UID. Broadcasts were being created but were invisible to
//     // every single user because the userId never matched anything.
//     const activeUsers = await User.find({ isActive: true, isDeleted: false })
//       .select('firebaseUid')
//       .lean();
//     if (!activeUsers.length) return;

//     const notifications = activeUsers.map((u: any) => ({
//       userId: u.firebaseUid,
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
//     // FIX: notification.userId is a Firebase UID; this was always querying
//     // by Mongo _id and always getting null back, so push/email/SMS never
//     // actually fired for anyone even when the channel flags were true.
//     const user = await User.findByFirebaseUid(notification.userId);
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
//     logger.info(`📱 Push to ${user.firebaseUid}: ${notification.title}`);
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
