import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { User } from '../../modules/auth/auth.model';

// ============================================================
// Types
// ============================================================

interface AuthenticatedSocket extends Socket {
    userId?: string;
    userRooms?: Set<string>;
}

interface NotificationPayload {
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
}

// ============================================================
// Socket Server
// ============================================================

class SocketServer {
    private io: Server | null = null;
    private userSockets: Map<string, Set<string>> = new Map(); // userId → Set<socketId>

    /**
     * Initialize Socket.IO with HTTP server.
     */
    initialize(httpServer: HttpServer): void {
        this.io = new Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling'],
        });

        // Authentication middleware
        this.io.use(async (socket: AuthenticatedSocket, next) => {
            try {
                let token = socket.handshake.auth.token || socket.handshake.query.token;

                if (!token) {
                    return next(new Error('Authentication token required'));
                }

                // Strip "Bearer " and any quotes if present
                token = token.replace(/^Bearer\s+/, '').replace(/^["']|["']$/g, '');

                const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };

                // Verify user exists
                const user = await User.findOne({
                    _id: decoded.userId,
                    isActive: true,
                    isDeleted: false,
                }).select('_id').lean();

                if (!user) {
                    return next(new Error('User not found'));
                }

                socket.userId = decoded.userId;
                next();
            } catch (error: any) {
                logger.warn('Socket auth failed:', error.message);
                next(new Error('Invalid authentication token'));
            }
        });

        // Connection handler
        this.io.on('connection', (socket: AuthenticatedSocket) => {
            this.handleConnection(socket);
        });

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

        // Join user's personal room
        socket.join(`user:${userId}`);

        logger.info(`User connected: ${userId} (socket: ${socket.id})`);

        // Handle room subscriptions
        socket.on('subscribe:trip', (tripId: string) => {
            socket.join(`trip:${tripId}`);
            logger.info(`User ${userId} subscribed to trip:${tripId}`);
        });

        socket.on('unsubscribe:trip', (tripId: string) => {
            socket.leave(`trip:${tripId}`);
            logger.info(`User ${userId} unsubscribed from trip:${tripId}`);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error(`Socket error for user ${userId}:`, error);
        });

        // Send welcome event
        socket.emit('connected', {
            message: 'Connected to TripSplit',
            userId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Handle socket disconnection.
     */
    private handleDisconnect(socket: AuthenticatedSocket): void {
        const userId = socket.userId;
        if (userId && this.userSockets.has(userId)) {
            this.userSockets.get(userId)!.delete(socket.id);

            // Clean up if no more sockets
            if (this.userSockets.get(userId)!.size === 0) {
                this.userSockets.delete(userId);
            }
        }
        logger.info(`User disconnected: ${userId} (socket: ${socket.id})`);
    }

    // ============================================================
    // Notification Methods
    // ============================================================

    /**
     * Send notification to a specific user.
     */
    sendToUser(userId: string, event: string, payload: any): void {
        if (!this.io) return;
        this.io.to(`user:${userId}`).emit(event, payload);
    }

    /**
     * Send notification to all members of a trip.
     */
    sendToTrip(tripId: string, event: string, payload: any, excludeUserId?: string): void {
        if (!this.io) return;

        if (excludeUserId) {
            // Send to all in trip room except the excluded user
            this.io.to(`trip:${tripId}`).except(`user:${excludeUserId}`).emit(event, payload);
        } else {
            this.io.to(`trip:${tripId}`).emit(event, payload);
        }
    }

    /**
     * Send notification to multiple specific users.
     */
    sendToUsers(userIds: string[], event: string, payload: any): void {
        if (!this.io) return;
        userIds.forEach(userId => {
            this.io!.to(`user:${userId}`).emit(event, payload);
        });
    }

    /**
     * Check if a user is online.
     */
    isUserOnline(userId: string): boolean {
        return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
    }

    /**
     * Get count of online users.
     */
    getOnlineCount(): number {
        return this.userSockets.size;
    }

    // ============================================================
    // TripSplit-Specific Notifications
    // ============================================================

    /**
     * Notify trip members about a new expense.
     */
    notifyExpenseAdded(tripId: string, expense: any, actorUid: string): void {
        this.sendToTrip(tripId, 'expense:added', {
            type: 'EXPENSE_ADDED',
            tripId,
            expenseId: expense._id,
            title: expense.title,
            amount: expense.amountLocal,
            currency: expense.localCurrency,
            paidBy: expense.paidByName,
            timestamp: new Date().toISOString(),
        }, actorUid); // Don't notify the person who added it
    }

    /**
     * Notify trip members about an updated expense.
     */
    notifyExpenseUpdated(tripId: string, expense: any, editorUid: string): void {
        this.sendToTrip(tripId, 'expense:updated', {
            type: 'EXPENSE_UPDATED',
            tripId,
            expenseId: expense._id,
            title: expense.title,
            timestamp: new Date().toISOString(),
        }, editorUid);
    }

    /**
     * Notify trip members about a deleted expense.
     */
    notifyExpenseDeleted(tripId: string, expenseTitle: string, actorUid: string): void {
        this.sendToTrip(tripId, 'expense:deleted', {
            type: 'EXPENSE_DELETED',
            tripId,
            title: expenseTitle,
            timestamp: new Date().toISOString(),
        }, actorUid);
    }

    /**
     * Notify about settlement request.
     */
    notifySettlementRequest(toUid: string, fromName: string, amount: number, currency: string, tripId: string): void {
        this.sendToUser(toUid, 'settlement:request', {
            type: 'SETTLEMENT_REQUEST',
            fromName,
            amount,
            currency,
            tripId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Notify about completed settlement.
     */
    notifySettlementCompleted(fromUid: string, toUid: string, amount: number, currency: string, tripId: string): void {
        // Notify payer
        this.sendToUser(fromUid, 'settlement:completed', {
            type: 'SETTLEMENT_COMPLETED',
            role: 'payer',
            amount,
            currency,
            tripId,
            timestamp: new Date().toISOString(),
        });

        // Notify recipient
        this.sendToUser(toUid, 'settlement:completed', {
            type: 'SETTLEMENT_COMPLETED',
            role: 'recipient',
            amount,
            currency,
            tripId,
            timestamp: new Date().toISOString(),
        });
    }

    // /**
    //  * Notify user about trip invitation.
    //  */
    // notifyTripInvitation(toUid: string, tripTitle: string, inviterName: string, tripId: string): void {
    //     this.sendToUser(toUid, 'trip:invitation', {
    //         type: 'TRIP_INVITATION',
    //         tripTitle,
    //         inviterName,
    //         tripId,
    //         timestamp: new Date().toISOString(),
    //     });
    // }

    /**
     * Notify trip members that someone joined.
     */
    notifyTripJoined(tripId: string, joinerName: string): void {
        this.sendToTrip(tripId, 'trip:member_joined', {
            type: 'TRIP_JOINED',
            joinerName,
            tripId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Notify about a new stop added.
     */
    notifyStopAdded(tripId: string, stopName: string, actorUid: string): void {
        this.sendToTrip(tripId, 'stop:added', {
            type: 'STOP_ADDED',
            tripId,
            stopName,
            timestamp: new Date().toISOString(),
        }, actorUid);
    }

    /**
     * Notify about exchange rate update.
     */
    notifyExchangeRateUpdated(tripId: string, stopName: string, newRate: number, currency: string, baseCurrency: string): void {
        this.sendToTrip(tripId, 'stop:rate_updated', {
            type: 'EXCHANGE_RATE_UPDATED',
            tripId,
            stopName,
            newRate,
            currency,
            baseCurrency,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Graceful shutdown.
     */
    async shutdown(): Promise<void> {
        if (this.io) {
            await this.io.close();
            logger.info('WebSocket server closed');
        }
    }

    /**
 * Notify user about trip invitation.
 */
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

    /**
     * Notify admin that someone accepted their invitation.
     */
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

    /**
     * Notify admin that someone declined their invitation.
     */
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

}




// ============================================================
// Singleton Export
// ============================================================

export const socketServer = new SocketServer();

