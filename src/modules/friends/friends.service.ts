import { FriendRequest, IFriendRequest } from './friends.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { notificationService } from '../notification/notification.service';
import { logger } from '../../config/logger';

// ============================================================
// Types
// ============================================================

interface FriendInfo {
    userId: string;
    displayName: string;
    photoURL?: string;
    phoneNumber?: string;
    email?: string;
    upiId?: string;
    totalSharedTrips: number;
    isFriend: boolean;
    hasPendingRequest: boolean;
}

// ============================================================
// Friends Service
// ============================================================

export const friendsService = {
    /**
     * Send a friend request.
     */
    async sendRequest(
        fromUserId: string,
        toUserId: string,
        message?: string
    ): Promise<IFriendRequest> {
        // Validate users exist
        const [fromUser, toUser] = await Promise.all([
            User.findOne({ _id: fromUserId, isActive: true, isDeleted: false }).select('displayName photoURL').lean(),
            User.findOne({ _id: toUserId, isActive: true, isDeleted: false }).select('displayName photoURL').lean(),
        ]);

        if (!fromUser) throw new AppError('Your account not found', 404);
        if (!toUser) throw new AppError('User not found', 404);
        if (fromUserId === toUserId) throw new AppError('Cannot send friend request to yourself', 400);

        // Check if already friends
        const fromUserDoc = await User.findById(fromUserId).select('friendIds').lean();
        if (fromUserDoc?.friendIds?.includes(toUserId)) {
            throw new AppError('You are already friends', 409);
        }

        // Check for existing request
        const existing = await FriendRequest.findOne({
            $or: [
                { fromUserId, toUserId, status: 'pending' },
                { fromUserId: toUserId, toUserId: fromUserId, status: 'pending' },
            ],
        });

        if (existing) {
            throw new AppError('A friend request already exists between you', 409);
        }

        // Create request
        const request = new FriendRequest({
            fromUserId,
            fromName: fromUser.displayName,
            fromPhotoURL: fromUser.photoURL,
            toUserId,
            toName: toUser.displayName,
            toPhotoURL: toUser.photoURL,
            status: 'pending',
            message,
        });

        await request.save();

        // Send WebSocket notification
        socketServer.sendToUser(toUserId, 'friend:request', {
            type: 'FRIEND_REQUEST',
            requestId: request._id,
            fromUserId,
            fromName: fromUser.displayName,
            fromPhotoURL: fromUser.photoURL,
            message: message || `${fromUser.displayName} wants to be your friend`,
            timestamp: new Date().toISOString(),
        });

        // Create in-app notification
        await notificationService.create(
            toUserId,
            'FRIEND_REQUEST',
            'New Friend Request',
            `${fromUser.displayName} wants to be your friend`,
            {
                data: { requestId: request._id.toString(), fromUserId },
                isActionable: true,
                priority: 'medium',
            }
        );

        logger.info(`Friend request sent: ${fromUserId} → ${toUserId}`);
        return request;
    },

    /**
     * Accept a friend request.
     */
    async acceptRequest(requestId: string, userId: string): Promise<void> {
        const request = await FriendRequest.findById(requestId);
        if (!request) throw new AppError('Friend request not found', 404);
        if (request.toUserId !== userId) throw new AppError('This request is not for you', 403);
        if (request.status !== 'pending') throw new AppError(`Request is already ${request.status}`, 400);

        // Update request status
        request.status = 'accepted';
        request.respondedAt = new Date();
        await request.save();

        // Add to both users' friend lists (atomic update)
        await Promise.all([
            User.findByIdAndUpdate(request.fromUserId, {
                $addToSet: { friendIds: request.toUserId },
            }),
            User.findByIdAndUpdate(request.toUserId, {
                $addToSet: { friendIds: request.fromUserId },
            }),
        ]);

        // Notify sender
        const accepter = await User.findById(userId).select('displayName').lean();
        socketServer.sendToUser(request.fromUserId, 'friend:accepted', {
            type: 'FRIEND_ACCEPTED',
            userId,
            userName: accepter?.displayName || 'Someone',
            message: `${accepter?.displayName || 'Someone'} accepted your friend request`,
            timestamp: new Date().toISOString(),
        });

        logger.info(`Friend request accepted: ${request.fromUserId} ↔ ${request.toUserId}`);
    },

    /**
     * Decline a friend request.
     */
    async declineRequest(requestId: string, userId: string): Promise<void> {
        const request = await FriendRequest.findById(requestId);
        if (!request) throw new AppError('Friend request not found', 404);
        if (request.toUserId !== userId) throw new AppError('This request is not for you', 403);
        if (request.status !== 'pending') throw new AppError(`Request is already ${request.status}`, 400);

        request.status = 'declined';
        request.respondedAt = new Date();
        await request.save();

        logger.info(`Friend request declined: ${request.fromUserId} → ${request.toUserId}`);
    },

    /**
     * Remove a friend.
     */
    async removeFriend(userId: string, friendUserId: string): Promise<void> {
        // Remove from both friend lists
        await Promise.all([
            User.findByIdAndUpdate(userId, { $pull: { friendIds: friendUserId } }),
            User.findByIdAndUpdate(friendUserId, { $pull: { friendIds: userId } }),
        ]);

        // Cancel any pending requests between them
        await FriendRequest.updateMany(
            {
                $or: [
                    { fromUserId: userId, toUserId: friendUserId },
                    { fromUserId: friendUserId, toUserId: userId },
                ],
                status: 'pending',
            },
            { $set: { status: 'declined', respondedAt: new Date() } }
        );

        logger.info(`Friends removed: ${userId} ↔ ${friendUserId}`);
    },

    /**
     * Get user's friends list.
     */
    async getFriends(userId: string, search?: string): Promise<FriendInfo[]> {
        const user = await User.findById(userId)
            .select('friendIds')
            .populate('friendIds', 'displayName photoURL phoneNumber email bankingDetails.upiId')
            .lean();

        if (!user) throw new AppError('User not found', 404);

        const friends = (user as any).friendIds || [];

        let result = friends.map((f: any) => ({
            userId: f._id,
            displayName: f.displayName,
            photoURL: f.photoURL,
            phoneNumber: f.phoneNumber,
            email: f.email,
            upiId: f.bankingDetails?.upiId,
            totalSharedTrips: 0, // Will calculate from trips
            isFriend: true,
            hasPendingRequest: false,
        }));

        // Search filter
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (f: FriendInfo) =>
                    f.displayName?.toLowerCase().includes(q) ||
                    f.email?.toLowerCase().includes(q) ||
                    f.phoneNumber?.includes(q)
            );
        }

        return result;
    },

    /**
     * Get pending friend requests for a user.
     */
    async getPendingRequests(userId: string): Promise<IFriendRequest[]> {
        return FriendRequest.find({
            $or: [
                { toUserId: userId, status: 'pending' },
                { fromUserId: userId, status: 'pending' },
            ],
        })
            .sort({ createdAt: -1 })
            .lean() as unknown as Promise<IFriendRequest[]>;
    },

    /**
     * Search users by phone number or email (to add as friends).
     */
    async searchUsers(userId: string, query: string): Promise<any[]> {
        if (!query || query.length < 2) {
            throw new AppError('Search query must be at least 2 characters', 400);
        }

        const searchRegex = new RegExp(query, 'i');

        const users = await User.find({
            _id: { $ne: userId },
            isActive: true,
            isDeleted: false,
            $or: [
                { displayName: searchRegex },
                { email: searchRegex },
                { phoneNumber: searchRegex },
            ],
        })
            .select('displayName photoURL phoneNumber email')
            .limit(20)
            .lean();

        // Get current user's friends and pending requests
        const [currentUser, pendingRequests] = await Promise.all([
            User.findById(userId).select('friendIds').lean(),
            FriendRequest.find({
                $or: [
                    { fromUserId: userId, status: 'pending' },
                    { toUserId: userId, status: 'pending' },
                ],
            }).lean(),
        ]);

        const friendIds = currentUser?.friendIds || [];

        return users.map((u: any) => {
            const isFriend = friendIds.includes(u._id);
            const hasPending = pendingRequests.some(
                (r: any) =>
                    (r.fromUserId === userId && r.toUserId === u._id) ||
                    (r.toUserId === userId && r.fromUserId === u._id)
            );

            return {
                userId: u._id,
                displayName: u.displayName,
                photoURL: u.photoURL,
                phoneNumber: u.phoneNumber,
                email: u.email,
                isFriend,
                hasPendingRequest: hasPending,
            };
        });
    },

    /**
     * Get friend suggestions (mutual trips, contacts, etc.).
     */
    async getSuggestions(userId: string): Promise<any[]> {
        // Get users who are in the same trips but not yet friends
        const Trip = require('../trips/trip.model').Trip;

        const currentUser = await User.findById(userId).select('friendIds').lean();
        const friendIds = currentUser?.friendIds || [];

        // Find trip members who aren't friends
        const trips = await Trip.find({
            'members.userId': userId,
            'members.isActive': true,
            isArchived: false,
        }).select('members').lean();

        const coTravelers = new Set<string>();
        trips.forEach((trip: any) => {
            trip.members.forEach((m: any) => {
                if (m.userId !== userId && !friendIds.includes(m.userId)) {
                    coTravelers.add(m.userId);
                }
            });
        });

        if (coTravelers.size === 0) return [];

        const suggestions = await User.find({
            _id: { $in: Array.from(coTravelers) },
            isActive: true,
            isDeleted: false,
        })
            .select('displayName photoURL')
            .limit(10)
            .lean();

        return suggestions.map((u: any) => ({
            userId: u._id,
            displayName: u.displayName,
            photoURL: u.photoURL,
            reason: 'You traveled together',
        }));
    },

    /**
     * Check if two users are friends.
     */
    async areFriends(userId1: string, userId2: string): Promise<boolean> {
        const user = await User.findById(userId1).select('friendIds').lean();
        return user?.friendIds?.includes(userId2) || false;
    },
};