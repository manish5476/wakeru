import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { User } from '../../modules/auth/auth.model';
import { Trip } from '../../modules/trips/trip.model';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient } from '../../config/redis';

// ============================================================
// Types
// ============================================================

interface AuthenticatedSocket extends Socket {
    userId?: string;
    userRooms?: Set<string>;
}

interface OnlineUserInfo {
    userId: string;
    displayName: string;
    photoURL?: string;
    socketIds: string[];
    connectedAt: Date;
    lastActiveAt: Date;
    currentTripId?: string;
    deviceInfo?: {
        platform: string;
        version?: string;
    };
}

// ============================================================
// Socket Server
// ============================================================

class SocketServer {
    private io: Server | null = null;
    private userSockets: Map<string, Set<string>> = new Map(); // userId → Set<socketId>
    private onlineUsers: Map<string, OnlineUserInfo> = new Map(); // userId → OnlineUserInfo

    private async canAccessTrip(userId: string, tripId: string): Promise<boolean> {
        try {
            if (!tripId) return false;
            const trip = await Trip.findOne({ _id: tripId, isArchived: false }).select('members').lean();
            return Boolean(trip && (trip as any).members?.some((member: any) => member.userId === userId && member.isActive));
        } catch {
            return false;
        }
    }

    /**
     * Initialize Socket.IO with HTTP server.
     */
    initialize(httpServer: HttpServer): void {
        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling'],
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
                skipMiddlewares: true,
            },
        });

        if (redisClient.ready) {
            this.io.adapter(createAdapter(redisClient.publisher, redisClient.subscriber));
            logger.info('Socket.IO Redis adapter enabled');
        } else {
            logger.warn('Socket.IO Redis adapter disabled; running in single-instance mode');
        }

        // Authentication middleware
        this.io.use(async (socket: AuthenticatedSocket, next) => {
            try {
                let token = socket.handshake.auth.token || socket.handshake.query.token;

                if (!token) {
                    return next(new Error('Authentication token required'));
                }

                // Strip "Bearer " and any quotes
                token = String(token).replace(/^Bearer\s+/, '').replace(/^["']|["']$/g, '');

                const decoded = jwt.verify(token, config.JWT_SECRET) as {
                    userId: string;
                    type: string;
                };

                // Validate token type
                if (decoded.type !== 'access') {
                    return next(new Error('Invalid token type. Use access token.'));
                }

                // Verify user exists and is active
                const user = await User.findOne({
                    firebaseUid: decoded.userId,
                    isActive: true,
                    isDeleted: false,
                })
                    .select('firebaseUid displayName photoURL')
                    .lean();

                if (!user) {
                    return next(new Error('User not found or deactivated'));
                }

                socket.userId = decoded.userId;
                socket.userRooms = new Set();
                next();
            } catch (error: any) {
                logger.warn('Socket auth failed:', { error: error.message });
                next(new Error('Invalid authentication token'));
            }
        });

        // Connection handler
        this.io.on('connection', (socket: AuthenticatedSocket) => {
            this.handleConnection(socket);
        });

        // Periodic cleanup of stale connections
        setInterval(() => this.cleanupStaleConnections(), 5 * 60 * 1000); // Every 5 minutes

        logger.info('🔌 WebSocket server initialized');
    }

    /**
     * Handle new socket connection.
     */
    private handleConnection(socket: AuthenticatedSocket): void {
        const userId = socket.userId!;

        // Track user's sockets
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)!.add(socket.id);

        // Update online user info
        const existingInfo = this.onlineUsers.get(userId);
        this.onlineUsers.set(userId, {
            userId,
            displayName: existingInfo?.displayName || 'User',
            photoURL: existingInfo?.photoURL,
            socketIds: [...(this.userSockets.get(userId) || [])],
            connectedAt: existingInfo?.connectedAt || new Date(),
            lastActiveAt: new Date(),
            currentTripId: existingInfo?.currentTripId,
            deviceInfo: {
                platform: socket.handshake.headers['user-agent'] || 'unknown',
            },
        });

        // Join user's personal room
        socket.join(`user:${userId}`);

        // Store user info on socket for quick access
        socket.data.userId = userId;
        socket.data.connectedAt = new Date();

        logger.info(`✅ User connected: ${userId} (socket: ${socket.id}, total sockets: ${this.userSockets.get(userId)?.size})`);

        // ── EVENT HANDLERS ──────────────────────────────────

        // Subscribe to trip updates
        socket.on('subscribe:trip', async (tripId: string) => {
            if (!tripId) return;
            if (!(await this.canAccessTrip(userId, tripId))) {
                socket.emit('trip:subscription_denied', { tripId });
                return;
            }
            socket.join(`trip:${tripId}`);
            socket.userRooms?.add(`trip:${tripId}`);

            // Update current trip
            const userInfo = this.onlineUsers.get(userId);
            if (userInfo) {
                userInfo.currentTripId = tripId;
            }

            // Notify other members that this user is online in the trip
            socket.to(`trip:${tripId}`).emit('trip:user_online', {
                userId,
                tripId,
                timestamp: new Date().toISOString(),
            });

            logger.info(`📌 User ${userId} subscribed to trip:${tripId}`);
        });

        // Unsubscribe from trip
        socket.on('unsubscribe:trip', (tripId: string) => {
            socket.leave(`trip:${tripId}`);
            socket.userRooms?.delete(`trip:${tripId}`);

            const userInfo = this.onlineUsers.get(userId);
            if (userInfo?.currentTripId === tripId) {
                userInfo.currentTripId = undefined;
            }

            socket.to(`trip:${tripId}`).emit('trip:user_offline', {
                userId,
                tripId,
                timestamp: new Date().toISOString(),
            });

            logger.info(`📌 User ${userId} unsubscribed from trip:${tripId}`);
        });

        // Typing indicator for expense creation
        socket.on('expense:typing', async (data: { tripId: string; field?: string }) => {
            if (!data?.tripId || !socket.userRooms?.has(`trip:${data.tripId}`) || !(await this.canAccessTrip(userId, data.tripId))) return;
            socket.to(`trip:${data.tripId}`).emit('expense:typing', {
                userId,
                field: data.field || 'expense',
                timestamp: new Date().toISOString(),
            });
        });

        socket.on('expense:stop_typing', async (data: { tripId: string }) => {
            if (!data?.tripId || !socket.userRooms?.has(`trip:${data.tripId}`) || !(await this.canAccessTrip(userId, data.tripId))) return;
            socket.to(`trip:${data.tripId}`).emit('expense:stop_typing', {
                userId,
                timestamp: new Date().toISOString(),
            });
        });

        // User is viewing a specific expense (collaborative awareness)
        socket.on('expense:viewing', async (data: { tripId: string; expenseId: string }) => {
            if (!data?.tripId || !socket.userRooms?.has(`trip:${data.tripId}`) || !(await this.canAccessTrip(userId, data.tripId))) return;
            socket.to(`trip:${data.tripId}`).emit('expense:viewing', {
                userId,
                expenseId: data.expenseId,
                timestamp: new Date().toISOString(),
            });
        });

        // Ping to keep connection alive and update last active
        socket.on('ping:activity', () => {
            const userInfo = this.onlineUsers.get(userId);
            if (userInfo) {
                userInfo.lastActiveAt = new Date();
            }
        });

        // Get online members for a trip
        socket.on('trip:online_members', async (tripId: string) => {
            if (!tripId || !socket.userRooms?.has(`trip:${tripId}`) || !(await this.canAccessTrip(userId, tripId))) {
                socket.emit('trip:online_members', { tripId, members: [] });
                return;
            }
            const room = this.io?.sockets.adapter.rooms.get(`trip:${tripId}`);
            if (!room) {
                socket.emit('trip:online_members', { tripId, members: [] });
                return;
            }

            const onlineMemberIds: string[] = [];
            room.forEach((socketId: string) => {
                const sock = this.io?.sockets.sockets.get(socketId) as AuthenticatedSocket;
                if (sock?.userId && sock.userId !== userId) {
                    onlineMemberIds.push(sock.userId);
                }
            });

            const members = [...new Set(onlineMemberIds)].map(uid => {
                const info = this.onlineUsers.get(uid);
                return {
                    userId: uid,
                    displayName: info?.displayName,
                    photoURL: info?.photoURL,
                };
            });

            socket.emit('trip:online_members', { tripId, members });
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            this.handleDisconnect(socket, reason);
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error(`Socket error for user ${userId}:`, error);
        });

        // Send welcome event with online status
        socket.emit('connected', {
            message: 'Connected to TripSplit',
            userId,
            timestamp: new Date().toISOString(),
        });

        // Broadcast to all trip rooms that user is online
        socket.userRooms?.forEach(room => {
            if (room.startsWith('trip:')) {
                const tripId = room.replace('trip:', '');
                socket.to(room).emit('trip:user_online', {
                    userId,
                    tripId,
                    timestamp: new Date().toISOString(),
                });
            }
        });
    }

    /**
     * Handle socket disconnection.
     */
    private handleDisconnect(socket: AuthenticatedSocket, reason: string): void {
        const userId = socket.userId;
        if (!userId) return;

        // Remove from tracking
        if (this.userSockets.has(userId)) {
            this.userSockets.get(userId)!.delete(socket.id);

            if (this.userSockets.get(userId)!.size === 0) {
                this.userSockets.delete(userId);
                this.onlineUsers.delete(userId);

                // Notify trip rooms that user is offline
                socket.userRooms?.forEach(room => {
                    if (room.startsWith('trip:')) {
                        const tripId = room.replace('trip:', '');
                        socket.to(room).emit('trip:user_offline', {
                            userId,
                            tripId,
                            timestamp: new Date().toISOString(),
                        });
                    }
                });
            } else {
                // Update socket list in online users
                const userInfo = this.onlineUsers.get(userId);
                if (userInfo) {
                    userInfo.socketIds = [...(this.userSockets.get(userId) || [])];
                }
            }
        }

        logger.info(`❌ User disconnected: ${userId} (reason: ${reason}, remaining sockets: ${this.userSockets.get(userId)?.size || 0})`);
    }

    /**
     * Clean up stale connections (if a socket died without disconnect event).
     */
    private cleanupStaleConnections(): void {
        const now = Date.now();
        const staleThreshold = 10 * 60 * 1000; // 10 minutes

        this.onlineUsers.forEach((userInfo, userId) => {
            if (now - userInfo.lastActiveAt.getTime() > staleThreshold) {
                // User hasn't been active for 10+ minutes
                this.onlineUsers.delete(userId);
                this.userSockets.delete(userId);

                // Force leave all rooms
                this.io?.in(`user:${userId}`).disconnectSockets(true);

                logger.info(`🧹 Cleaned up stale connection: ${userId}`);
            }
        });
    }

    // ============================================================
    // GENERIC NOTIFICATION METHODS
    // ============================================================

    sendToUser(userId: string, event: string, payload: any): void {
        if (!this.io) return;
        this.io.to(`user:${userId}`).emit(event, {
            ...payload,
            _serverTimestamp: new Date().toISOString(),
        });
    }

    broadcastToAll(event: string, payload: any): void {
        if (!this.io) return;
        this.io.emit(event, {
            ...payload,
            _serverTimestamp: new Date().toISOString(),
        });
    }

    sendToTrip(tripId: string, event: string, payload: any, excludeUserId?: string): void {
        if (!this.io) return;

        if (excludeUserId) {
            // Get all sockets in the trip room except the excluded user's
            const room = this.io.sockets.adapter.rooms.get(`trip:${tripId}`);
            if (room) {
                room.forEach((socketId: string) => {
                    const sock = this.io!.sockets.sockets.get(socketId) as AuthenticatedSocket;
                    if (sock?.userId !== excludeUserId) {
                        sock?.emit(event, {
                            ...payload,
                            _serverTimestamp: new Date().toISOString(),
                        });
                    }
                });
            }
        } else {
            this.io.to(`trip:${tripId}`).emit(event, {
                ...payload,
                _serverTimestamp: new Date().toISOString(),
            });
        }
    }

    sendToUsers(userIds: string[], event: string, payload: any): void {
        if (!this.io) return;
        userIds.forEach(userId => {
            this.io!.to(`user:${userId}`).emit(event, {
                ...payload,
                _serverTimestamp: new Date().toISOString(),
            });
        });
    }

    isUserOnline(userId: string): boolean {
        return this.userSockets.has(userId) && (this.userSockets.get(userId)?.size || 0) > 0;
    }

    getOnlineCount(): number {
        return this.onlineUsers.size;
    }

    getOnlineUsersForTrip(tripId: string): OnlineUserInfo[] {
        const room = this.io?.sockets.adapter.rooms.get(`trip:${tripId}`);
        if (!room) return [];

        const onlineUserIds = new Set<string>();
        room.forEach((socketId: string) => {
            const sock = this.io?.sockets.sockets.get(socketId) as AuthenticatedSocket;
            if (sock?.userId) onlineUserIds.add(sock.userId);
        });

        return [...onlineUserIds]
            .map(uid => this.onlineUsers.get(uid))
            .filter(Boolean) as OnlineUserInfo[];
    }

    // ============================================================
    // TRIPSPLIT-SPECIFIC NOTIFICATIONS
    // ============================================================

    // ── EXPENSES ─────────────────────────────────────────────

    notifyExpenseAdded(tripId: string, expense: any, actorUid: string): void {
        this.sendToTrip(tripId, 'expense:added', {
            type: 'EXPENSE_ADDED',
            tripId,
            expenseId: expense._id,
            title: expense.title,
            amount: expense.amountLocal,
            amountBase: expense.amountBase,
            currency: expense.localCurrency,
            baseCurrency: expense.baseCurrency,
            category: expense.category,
            paidBy: expense.paidByName,
            paidByUserId: expense.paidBy,
            splitMethod: expense.splitMethod,
            date: expense.date,
            timestamp: new Date().toISOString(),
        }, actorUid);
    }

    notifyExpenseUpdated(tripId: string, expense: any, editorUid: string): void {
        this.sendToTrip(tripId, 'expense:updated', {
            type: 'EXPENSE_UPDATED',
            tripId,
            expenseId: expense._id,
            title: expense.title,
            amount: expense.amountLocal,
            currency: expense.localCurrency,
            timestamp: new Date().toISOString(),
        }, editorUid);
    }

    notifyExpenseDeleted(tripId: string, expenseTitle: string, actorUid: string): void {
        this.sendToTrip(tripId, 'expense:deleted', {
            type: 'EXPENSE_DELETED',
            tripId,
            title: expenseTitle,
            timestamp: new Date().toISOString(),
        }, actorUid);
    }

    notifyExpenseCommentAdded(tripId: string, expenseId: string, expenseTitle: string, authorName: string, actorUid: string): void {
        this.sendToTrip(tripId, 'expense:comment_added', {
            type: 'EXPENSE_COMMENT_ADDED',
            tripId,
            expenseId,
            title: expenseTitle,
            authorName,
            timestamp: new Date().toISOString(),
        }, actorUid);
    }

    notifyExpenseCommentDeleted(tripId: string, expenseId: string, expenseTitle: string, actorUid: string): void {
        this.sendToTrip(tripId, 'expense:comment_deleted', {
            type: 'EXPENSE_COMMENT_DELETED',
            tripId,
            expenseId,
            title: expenseTitle,
            timestamp: new Date().toISOString(),
        }, actorUid);
    }

    // ── BUDGET ───────────────────────────────────────────────

    notifyBudgetAlert(tripId: string, stopName: string, currency: string, pctUsed: number): void {
        const severity = pctUsed >= 100 ? 'critical' : pctUsed >= 80 ? 'warning' : 'info';
        this.sendToTrip(tripId, 'budget:alert', {
            type: 'BUDGET_ALERT',
            tripId,
            stopName,
            currency,
            pctUsed,
            severity,
            message: pctUsed >= 100
                ? `🚨 Budget exceeded for ${stopName}!`
                : `⚠️ ${pctUsed.toFixed(0)}% of budget used for ${stopName}`,
            timestamp: new Date().toISOString(),
        });
    }

    // ── SETTLEMENTS ──────────────────────────────────────────

    notifySettlementRequest(toUid: string, fromName: string, amount: number, currency: string, tripId: string): void {
        this.sendToUser(toUid, 'settlement:request', {
            type: 'SETTLEMENT_REQUEST',
            fromName,
            amount,
            currency,
            tripId,
            message: `${fromName} has requested ₹${amount} for settlement`,
            timestamp: new Date().toISOString(),
        });
    }

    notifySettlementCompleted(fromUid: string, toUid: string, amount: number, currency: string, tripId: string): void {
        this.sendToUser(fromUid, 'settlement:completed', {
            type: 'SETTLEMENT_COMPLETED',
            role: 'payer',
            amount,
            currency,
            tripId,
            message: `Payment of ${currency} ${amount} completed`,
            timestamp: new Date().toISOString(),
        });

        this.sendToUser(toUid, 'settlement:completed', {
            type: 'SETTLEMENT_COMPLETED',
            role: 'recipient',
            amount,
            currency,
            tripId,
            message: `You received ${currency} ${amount}`,
            timestamp: new Date().toISOString(),
        });
    }

    notifySettlementDisputed(userId: string, tripId: string, amount: number, currency: string, reason: string): void {
        this.sendToUser(userId, 'settlement:disputed', {
            type: 'SETTLEMENT_DISPUTED',
            tripId,
            amount,
            currency,
            reason,
            message: `A payment of ${currency} ${amount} has been disputed`,
            timestamp: new Date().toISOString(),
        });
    }

    notifyTripFullySettled(tripId: string): void {
        this.sendToTrip(tripId, 'trip:fully_settled', {
            type: 'TRIP_FULLY_SETTLED',
            tripId,
            message: '🎉 All payments settled! Trip is complete.',
            timestamp: new Date().toISOString(),
        });
    }

    notifySettlementCalculated(tripId: string, transactionCount: number, baseCurrency: string): void {
        this.sendToTrip(tripId, 'settlement:calculated', {
            type: 'SETTLEMENT_CALCULATED',
            tripId,
            transactionCount,
            baseCurrency,
            message: `Settlement calculated: ${transactionCount} transfers needed`,
            timestamp: new Date().toISOString(),
        });
    }

    notifyPaymentInitiated(toUid: string, fromName: string, amount: number, currency: string, tripId: string, transactionId: string): void {
        this.sendToUser(toUid, 'settlement:payment_initiated', {
            type: 'PAYMENT_INITIATED',
            fromName,
            amount,
            currency,
            tripId,
            transactionId,
            message: `${fromName} has marked a payment of ${currency} ${amount} as sent. Please confirm when received.`,
            timestamp: new Date().toISOString(),
        });
    }

    notifyPaymentRejected(toUid: string, rejectorName: string, amount: number, currency: string, tripId: string, transactionId: string): void {
        this.sendToUser(toUid, 'settlement:payment_rejected', {
            type: 'PAYMENT_REJECTED',
            rejectorName,
            amount,
            currency,
            tripId,
            transactionId,
            message: `${rejectorName} did not confirm receiving your payment of ${currency} ${amount}. Please check and try again.`,
            timestamp: new Date().toISOString(),
        });
    }

    notifyPaymentReminder(toUid: string, senderName: string, amount: number, currency: string, tripId: string, transactionId: string): void {
        this.sendToUser(toUid, 'settlement:reminder', {
            type: 'PAYMENT_REMINDER',
            senderName,
            amount,
            currency,
            tripId,
            transactionId,
            message: `${senderName} is waiting for your payment of ${currency} ${amount}`,
            timestamp: new Date().toISOString(),
        });
    }



    notifyTripInvitation(
        toUid: string,
        tripTitle: string,
        inviterName: string,
        tripId: string,
        invitationId: string
    ): void {
        this.sendToUser(toUid, 'invitation:received', {
            type: 'TRIP_INVITATION',
            invitationId,
            tripId,
            tripTitle,
            inviterName,
            message: `${inviterName} invited you to "${tripTitle}"`,
            timestamp: new Date().toISOString(),
        });
    }

    notifyInvitationAccepted(adminUid: string, userName: string, tripTitle: string, tripId: string): void {
        this.sendToUser(adminUid, 'invitation:accepted', {
            type: 'INVITATION_ACCEPTED',
            tripId,
            tripTitle,
            userName,
            message: `${userName} accepted your invitation to "${tripTitle}"`,
            timestamp: new Date().toISOString(),
        });
    }

    notifyInvitationDeclined(adminUid: string, userName: string, tripTitle: string, tripId: string): void {
        this.sendToUser(adminUid, 'invitation:declined', {
            type: 'INVITATION_DECLINED',
            tripId,
            tripTitle,
            userName,
            message: `${userName} declined your invitation to "${tripTitle}"`,
            timestamp: new Date().toISOString(),
        });
    }

    // ── TRIP UPDATES ─────────────────────────────────────────

    notifyTripJoined(tripId: string, joinerName: string): void {
        this.sendToTrip(tripId, 'trip:member_joined', {
            type: 'MEMBER_JOINED',
            joinerName,
            tripId,
            message: `${joinerName} joined the trip! 🎉`,
            timestamp: new Date().toISOString(),
        });
    }

    notifyMemberRemoved(tripId: string, memberName: string, removedById: string): void {
        this.sendToTrip(tripId, 'trip:member_removed', {
            type: 'MEMBER_REMOVED',
            tripId,
            memberName,
            message: `${memberName} has been removed from the trip`,
            timestamp: new Date().toISOString(),
        }, removedById);
    }

    // ── STOPS ────────────────────────────────────────────────

    notifyStopAdded(tripId: string, stopName: string, actorUid: string): void {
        this.sendToTrip(tripId, 'stop:added', {
            type: 'STOP_ADDED',
            tripId,
            stopName,
            message: `New stop added: ${stopName}`,
            timestamp: new Date().toISOString(),
        }, actorUid);
    }

    notifyExchangeRateUpdated(tripId: string, stopName: string, newRate: number, currency: string, baseCurrency: string): void {
        this.sendToTrip(tripId, 'stop:rate_updated', {
            type: 'EXCHANGE_RATE_UPDATED',
            tripId,
            stopName,
            newRate,
            currency,
            baseCurrency,
            message: `Exchange rate updated: 1 ${currency} = ${newRate} ${baseCurrency}`,
            timestamp: new Date().toISOString(),
        });
    }

    // ── FRIENDS ──────────────────────────────────────────────

    notifyFriendRequest(toUid: string, fromUserId: string, fromName: string, fromPhotoURL?: string): void {
        this.sendToUser(toUid, 'friend:request', {
            type: 'FRIEND_REQUEST',
            fromUserId,
            fromName,
            fromPhotoURL,
            message: `${fromName} wants to be your friend`,
            timestamp: new Date().toISOString(),
        });
    }

    notifyFriendAccepted(userId: string, friendName: string, friendPhotoURL?: string): void {
        this.sendToUser(userId, 'friend:accepted', {
            type: 'FRIEND_ACCEPTED',
            friendName,
            friendPhotoURL,
            message: `${friendName} accepted your friend request! 🎉`,
            timestamp: new Date().toISOString(),
        });
    }

    // ── ACHIEVEMENTS ─────────────────────────────────────────

    notifyAchievementUnlocked(userId: string, achievement: {
        achievementId: string;
        name: string;
        description: string;
        icon: string;
        tier: string;
        pointsValue: number;
    }): void {
        const tierEmoji: Record<string, string> = {
            bronze: '🥉',
            silver: '🥈',
            gold: '🥇',
            platinum: '💎',
            diamond: '👑',
        };

        this.sendToUser(userId, 'achievement:unlocked', {
            type: 'ACHIEVEMENT_UNLOCKED',
            ...achievement,
            tierEmoji: tierEmoji[achievement.tier] || '🏆',
            message: `${tierEmoji[achievement.tier] || '🏆'} Achievement Unlocked: ${achievement.name}!`,
            timestamp: new Date().toISOString(),
        });
    }

    // ── TRIP INVITES (SOCIAL FEATURE) ────────────────────────

    notifyTripFriendInvite(friendUid: string, inviteData: {
        tripId: string;
        tripTitle: string;
        tripDestination: string;
        tripStartDate: Date;
        tripEndDate: Date;
        tripCoverImage?: string;
        invitedBy: string;
        invitedByName: string;
        totalMembers: number;
        baseCurrency: string;
        message?: string;
    }): void {
        this.sendToUser(friendUid, 'trip:friend_invite', {
            type: 'TRIP_FRIEND_INVITE',
            ...inviteData,
            message: `${inviteData.invitedByName} is planning a trip to ${inviteData.tripDestination}! 🧳`,
            timestamp: new Date().toISOString(),
        });
    }

    notifyTripInviteResponse(inviterUid: string, responderName: string, response: string, tripTitle: string): void {
        const emoji: Record<string, string> = {
            interested: '👋',
            going: '✅',
            maybe: '🤔',
            declined: '❌',
        };

        this.sendToUser(inviterUid, 'trip:invite_response', {
            type: 'TRIP_INVITE_RESPONSE',
            responderName,
            response,
            tripTitle,
            message: `${emoji[response] || ''} ${responderName} is ${response} for "${tripTitle}"`,
            timestamp: new Date().toISOString(),
        });
    }

    // ── USER UPDATES ─────────────────────────────────────────

    notifyUserPreferencesUpdated(userId: string, preferences: any): void {
        this.sendToUser(userId, 'user:preferences_updated', {
            type: 'USER_PREFERENCES_UPDATED',
            preferences,
            timestamp: new Date().toISOString(),
        });
    }

    notifyUserProfileUpdated(userId: string, profile: any): void {
        this.sendToUser(userId, 'user:profile_updated', {
            type: 'USER_PROFILE_UPDATED',
            profile,
            timestamp: new Date().toISOString(),
        });

        // Also broadcast to all trips this user is in, so other users see the updated profile
        const userRooms = this.userSockets.get(userId);
        if (userRooms) {
            userRooms.forEach(socketId => {
                const sock = this.io?.sockets.sockets.get(socketId) as AuthenticatedSocket;
                if (sock?.userRooms) {
                    sock.userRooms.forEach(room => {
                        if (room.startsWith('trip:')) {
                            const tripId = room.replace('trip:', '');
                            this.sendToTrip(tripId, 'trip:member_updated', {
                                type: 'MEMBER_UPDATED',
                                userId,
                                profile,
                                tripId,
                                timestamp: new Date().toISOString(),
                            });
                        }
                    });
                }
            });
        }
    }

    
    // ============================================================
    // UTILITY
    // ============================================================

    /**
     * Get server health/stats.
     */
    getStats() {
        return {
            totalConnections: this.io?.engine.clientsCount || 0,
            onlineUsers: this.onlineUsers.size,
            totalSocketIds: this.userSockets.size,
            uptime: process.uptime(),
        };
    }

    /**
     * Graceful shutdown.
     */
    async shutdown(): Promise<void> {
        if (this.io) {
            // Notify all connected clients
            this.io.emit('server:shutdown', {
                message: 'Server is shutting down for maintenance',
                timestamp: new Date().toISOString(),
            });

            await this.io.close();
            logger.info('🔌 WebSocket server closed gracefully');
        }
    }
}

// ============================================================
// Singleton Export
// ============================================================

export const socketServer = new SocketServer();
