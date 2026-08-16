import { Types } from 'mongoose';
import { FriendRequest, Friendship, IFriendRequest, IFriendship } from './friends.model';
import { User } from '../auth/auth.model';
import { Trip } from '../trips/trip.model';
import { Expense } from '../expense/expense.model';
import { Settlement } from '../settlement/settlement.model';
import { AppError } from '../../shared/errors/AppError';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { notificationService } from '../notification/notification.service';
import { achievementService } from '../achievement/achievement.service';
import { logger } from '../../config/logger';

// ============================================================
// TYPES
// ============================================================

interface FriendInfo {
    userId: string;           // Firebase UID
    displayName: string;
    photoURL?: string;
    phoneNumber?: string;
    email?: string;
    upiId?: string;
    totalSharedTrips: number;
    isFriend: boolean;
    hasPendingRequest: boolean;
    friendshipStatus?: string;
    isMuted?: boolean;
}

interface TripInviteNotificationData {
    tripId: string;
    tripTitle: string;
    tripDestination: string;
    tripStartDate: Date;
    tripEndDate: Date;
    tripCoverImage?: string;
    invitedBy: string;
    invitedByName: string;
    totalMembers: number;
    memberPreview: { displayName: string; photoURL?: string }[];
    totalBudget?: number;
    baseCurrency: string;
    stops: { name: string; emoji?: string }[];
    message?: string;
}

// ============================================================
// IMPORTANT ID CONVENTION:
// ============================================================
// - req.user.userId = Firebase UID (e.g., "abc123xyz")
// - User._id = UUID (auto-generated, e.g., "550e8400-e29b-...")
// - User.firebaseUid = Firebase UID (indexed, unique)
// - Friendship.user1Id/user2Id = Firebase UID
// - FriendRequest.fromUserId/toUserId = Firebase UID
// - Trip.members[].userId = Firebase UID
// - Expense.paidBy / splits[].userId = Firebase UID
//
// RULE: Always query User by `firebaseUid` when the value comes from
// req.user.userId or any external source. Only use `_id` for internal
// MongoDB references (which we don't use for users in this app).
// ============================================================

export const friendsService = {
    // ============================================================
    // FRIEND REQUESTS
    // ============================================================

    async sendRequest(
        fromUserId: string,   // Firebase UID
        toUserId: string,     // Firebase UID
        message?: string
    ): Promise<IFriendRequest> {
        // ✅ FIXED: Query by firebaseUid, not _id
        const [fromUser, toUser] = await Promise.all([
            User.findOne({ firebaseUid: fromUserId, isActive: true, isDeleted: false })
                .select('firebaseUid displayName photoURL')
                .lean(),
            User.findOne({ firebaseUid: toUserId, isActive: true, isDeleted: false })
                .select('firebaseUid displayName photoURL')
                .lean(),
        ]);

        if (!fromUser) throw new AppError('Your account not found', 404);
        if (!toUser) throw new AppError('User not found', 404);
        if (fromUserId === toUserId) throw new AppError('Cannot send friend request to yourself', 400);

        // Check existing friendship (uses Firebase UIDs directly — correct)
        const existingFriendship = await Friendship.findOne({
            $or: [
                { user1Id: fromUserId, user2Id: toUserId },
                { user1Id: toUserId, user2Id: fromUserId },
            ],
            status: { $ne: 'blocked' },
        }).lean();
        if (existingFriendship) throw new AppError('You are already friends', 409);

        // Check existing request (uses Firebase UIDs directly — correct)
        const existing = await FriendRequest.findOne({
            $or: [
                { fromUserId, toUserId, status: 'pending' },
                { fromUserId: toUserId, toUserId: fromUserId, status: 'pending' },
            ],
        }).lean();
        if (existing) throw new AppError('A friend request already exists', 409);

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

        // Notifications
        socketServer.sendToUser(toUserId, 'friend:request', {
            type: 'FRIEND_REQUEST',
            requestId: request._id,
            fromUserId,
            fromName: fromUser.displayName,
            fromPhotoURL: fromUser.photoURL,
            message: message || `${fromUser.displayName} wants to be your friend`,
            timestamp: new Date().toISOString(),
        });

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

    async acceptRequest(requestId: string, userId: string): Promise<void> {
        const request = await FriendRequest.findById(requestId);
        if (!request) throw new AppError('Friend request not found', 404);
        if (request.toUserId !== userId) throw new AppError('This request is not for you', 403);
        if (request.status !== 'pending') throw new AppError(`Request is already ${request.status}`, 400);

        request.status = 'accepted';
        request.respondedAt = new Date();
        await request.save();

        // Create Friendship — user1Id/user2Id are Firebase UIDs (correct)
        const [u1, u2] = [request.fromUserId, request.toUserId].sort();
        const isFromFirst = u1 === request.fromUserId;

        await Friendship.findOneAndUpdate(
            { user1Id: u1, user2Id: u2 },
            {
                user1Id: u1,
                user2Id: u2,
                user1Name: isFromFirst ? request.fromName : request.toName,
                user2Name: isFromFirst ? request.toName : request.fromName,
                user1PhotoURL: isFromFirst ? request.fromPhotoURL : request.toPhotoURL,
                user2PhotoURL: isFromFirst ? request.toPhotoURL : request.fromPhotoURL,
                status: 'active',
                lastInteractionAt: new Date(),
            },
            { upsert: true, new: true }
        );

        const accepter = await User.findOne({ firebaseUid: userId })
            .select('displayName')
            .lean();

        socketServer.sendToUser(request.fromUserId, 'friend:accepted', {
            type: 'FRIEND_ACCEPTED',
            userId,
            userName: accepter?.displayName || 'Someone',
            timestamp: new Date().toISOString(),
        });

        await notificationService.create(
            request.fromUserId,
            'FRIEND_ACCEPTED',
            'Friend Request Accepted',
            `${accepter?.displayName || 'Someone'} accepted your friend request.`,
            {
                data: {
                    userId: userId,
                    userName: accepter?.displayName || 'Someone',
                },
                priority: 'medium',
            }
        );

        await achievementService.onFriendshipCreated(request.fromUserId, request.toUserId);

        logger.info(`Friendship created: ${request.fromUserId} ↔ ${request.toUserId}`);
    },

    async declineRequest(requestId: string, userId: string): Promise<void> {
        const request = await FriendRequest.findById(requestId);
        if (!request) throw new AppError('Friend request not found', 404);
        if (request.toUserId !== userId) throw new AppError('This request is not for you', 403);
        if (request.status !== 'pending') throw new AppError(`Request is already ${request.status}`, 400);

        request.status = 'declined';
        request.respondedAt = new Date();
        await request.save();

        const decliner = await User.findOne({ firebaseUid: userId })
            .select('displayName')
            .lean();

        socketServer.sendToUser(request.fromUserId, 'friend:declined', {
            type: 'FRIEND_DECLINED',
            requestId: request._id,
            fromUserId: request.fromUserId,
            declinedBy: userId,
            declinedByName: decliner?.displayName || 'Someone',
            timestamp: new Date().toISOString(),
        });

        await notificationService.create(
            request.fromUserId,
            'FRIEND_DECLINED',
            'Friend Request Declined',
            `${decliner?.displayName || 'Someone'} declined your friend request.`,
            {
                data: {
                    requestId: request._id.toString(),
                    declinedBy: userId,
                },
                priority: 'low',
            }
        );

        logger.info(`Friend request declined: ${request.fromUserId} → ${request.toUserId}`);
    },

    async removeFriend(userId: string, friendUserId: string): Promise<void> {
        // Both are Firebase UIDs — correct for Friendship lookup
        const [u1, u2] = [userId, friendUserId].sort();
        await Friendship.deleteOne({ user1Id: u1, user2Id: u2 });

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

        logger.info(`Friendship removed: ${userId} ↔ ${friendUserId}`);
    },

    async blockFriend(userId: string, friendUserId: string): Promise<void> {
        const [u1, u2] = [userId, friendUserId].sort();
        await Friendship.findOneAndUpdate(
            { user1Id: u1, user2Id: u2 },
            { $set: { status: 'blocked', blockedBy: userId } }
        );
        logger.info(`User ${userId} blocked ${friendUserId}`);
    },

    async muteFriend(userId: string, friendUserId: string, mute: boolean = true): Promise<void> {
        const [u1, u2] = [userId, friendUserId].sort();
        const update = mute
            ? { $addToSet: { mutedBy: userId } }
            : { $pull: { mutedBy: userId } };
        await Friendship.findOneAndUpdate({ user1Id: u1, user2Id: u2 }, update);
    },

    // ============================================================
    // FRIENDS LIST
    // ============================================================

    async getFriends(userId: string, search?: string): Promise<FriendInfo[]> {
        // Friendship stores Firebase UIDs — correct
        const friendships = await Friendship.find({
            $or: [{ user1Id: userId }, { user2Id: userId }],
            status: 'active',
        }).lean();

        if (friendships.length === 0) return [];

        const friendFirebaseUids = friendships.map((f: any) =>
            f.user1Id === userId ? f.user2Id : f.user1Id
        );

        // Fetch user profiles
        const users = await User.find({
            firebaseUid: { $in: friendFirebaseUids },
            isActive: true,
            isDeleted: false,
        })
            .select('firebaseUid displayName photoURL phoneNumber email bankingDetails.upiId')
            .lean();

        const userMap = new Map(users.map((u: any) => [u.firebaseUid, u]));

        // Fetch mutual trips and countries visited together
        const userTrips = await Trip.find({
            'members.userId': userId,
            'members.isActive': true,
            isArchived: false,
        }).select('_id members stops').lean();

        const friendTripCountMap = new Map<string, number>();
        const friendCountryCountMap = new Map<string, Set<string>>();

        userTrips.forEach((trip: any) => {
            const activeMemberUids = new Set(
                trip.members?.filter((m: any) => m.isActive).map((m: any) => m.userId)
            );
            if (!activeMemberUids.has(userId)) return;

            friendFirebaseUids.forEach(fUid => {
                if (activeMemberUids.has(fUid)) {
                    friendTripCountMap.set(fUid, (friendTripCountMap.get(fUid) || 0) + 1);
                    if (!friendCountryCountMap.has(fUid)) {
                        friendCountryCountMap.set(fUid, new Set<string>());
                    }
                    trip.stops?.forEach((s: any) => {
                        if (s.country) friendCountryCountMap.get(fUid)?.add(s.country);
                    });
                }
            });
        });

        // Compute balances with friends
        const sharedExpenses = await Expense.find({
            isArchived: false,
            isSettled: false,
            $and: [
                { $or: [{ paidBy: userId }, { 'splits.userId': userId }] },
                { $or: [{ paidBy: { $in: friendFirebaseUids } }, { 'splits.userId': { $in: friendFirebaseUids } }] },
            ],
        }).select('paidBy splits amountBase').lean();

        const balanceMap = new Map<string, number>(); // friendUid -> netBalance (positive = they owe user)
        sharedExpenses.forEach((e: any) => {
            friendFirebaseUids.forEach(fUid => {
                const userSplit = e.splits?.find((s: any) => s.userId === userId && !s.isPaid);
                const friendSplit = e.splits?.find((s: any) => s.userId === fUid && !s.isPaid);

                let delta = 0;
                if (e.paidBy === fUid && userSplit) {
                    delta -= (userSplit.amountBase || 0); // user owes friend
                } else if (e.paidBy === userId && friendSplit) {
                    delta += (friendSplit.amountBase || 0); // friend owes user
                }
                if (delta !== 0) {
                    balanceMap.set(fUid, (balanceMap.get(fUid) || 0) + delta);
                }
            });
        });

        let result: FriendInfo[] = friendships.map((f: any) => {
            const friendFirebaseUid = f.user1Id === userId ? f.user2Id : f.user1Id;
            const friendUser = userMap.get(friendFirebaseUid);
            const sharedTrips = friendTripCountMap.get(friendFirebaseUid) || f.sharedTripCount || 0;
            const countriesCount = friendCountryCountMap.get(friendFirebaseUid)?.size || 0;
            const netBalance = Math.round((balanceMap.get(friendFirebaseUid) || 0) * 100) / 100;

            return {
                userId: friendFirebaseUid,
                displayName: friendUser?.displayName || (f.user1Id === userId ? f.user2Name : f.user1Name),
                photoURL: friendUser?.photoURL,
                phoneNumber: friendUser?.phoneNumber,
                email: friendUser?.email,
                upiId: friendUser?.bankingDetails?.upiId,
                totalSharedTrips: sharedTrips,
                countries: countriesCount,
                settlementBalance: netBalance,
                isFriend: true,
                hasPendingRequest: false,
                friendshipStatus: f.status,
                isMuted: f.mutedBy?.includes(userId) || false,
            };
        });

        if (search) {
            const q = search.toLowerCase();
            result = result.filter(f =>
                f.displayName?.toLowerCase().includes(q) ||
                f.email?.toLowerCase().includes(q) ||
                f.phoneNumber?.includes(q)
            );
        }

        return result;
    },

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

    // ============================================================
    // SEARCH & SUGGESTIONS
    // ============================================================

    async searchUsers(userId: string, query: string): Promise<any[]> {
        if (!query || query.length < 2) throw new AppError('Search query must be at least 2 characters', 400);

        const searchRegex = new RegExp(query, 'i');

        // ✅ FIXED: Query by firebaseUid, return firebaseUid
        const users = await User.find({
            firebaseUid: { $ne: userId },
            isActive: true,
            isDeleted: false,
            $or: [
                { displayName: searchRegex },
                { email: searchRegex },
                { phoneNumber: searchRegex },
            ],
        })
            .select('firebaseUid displayName photoURL phoneNumber email')
            .limit(20)
            .lean();

        const userFirebaseUids = users.map((u: any) => u.firebaseUid);

        // Check friendship status
        const [friendships, pendingRequests] = await Promise.all([
            Friendship.find({
                $or: [
                    { user1Id: userId, user2Id: { $in: userFirebaseUids } },
                    { user2Id: userId, user1Id: { $in: userFirebaseUids } },
                ],
            }).lean(),
            FriendRequest.find({
                $or: [
                    { fromUserId: userId, toUserId: { $in: userFirebaseUids }, status: 'pending' },
                    { toUserId: userId, fromUserId: { $in: userFirebaseUids }, status: 'pending' },
                ],
            }).lean(),
        ]);

        const friendSet = new Set(
            friendships.flatMap((f: any) => [f.user1Id, f.user2Id])
        );
        const pendingFromMe = new Set(
            pendingRequests.filter((r: any) => r.fromUserId === userId).map((r: any) => r.toUserId)
        );
        const pendingToMe = new Set(
            pendingRequests.filter((r: any) => r.toUserId === userId).map((r: any) => r.fromUserId)
        );

        return users.map((u: any) => ({
            userId: u.firebaseUid,  // ✅ Return Firebase UID
            displayName: u.displayName,
            photoURL: u.photoURL,
            phoneNumber: u.phoneNumber,
            email: u.email,
            isFriend: friendSet.has(u.firebaseUid),
            hasPendingRequest: pendingFromMe.has(u.firebaseUid) || pendingToMe.has(u.firebaseUid),
            incomingRequest: pendingToMe.has(u.firebaseUid),  // They sent me a request
            outgoingRequest: pendingFromMe.has(u.firebaseUid),  // I sent them a request
        }));
    },

    async getSuggestions(userId: string): Promise<any[]> {
        // 1. Co-travelers from trips
        const trips = await Trip.find({
            'members.userId': userId,
            'members.isActive': true,
            isArchived: false,
        })
            .select('members')
            .lean();

        const friendFirebaseUids = await this._getFriendFirebaseUids(userId);
        const coTravelerUids = new Set<string>();

        trips.forEach((trip: any) => {
            trip.members?.forEach((m: any) => {
                if (m.userId !== userId && !friendFirebaseUids.has(m.userId)) {
                    coTravelerUids.add(m.userId);
                }
            });
        });

        // 2. Friends of friends (from Friendship collection)
        const friendOfFriendUids = new Set<string>();
        const friendships = await Friendship.find({
            $or: [
                { user1Id: userId, status: 'active' },
                { user2Id: userId, status: 'active' },
            ],
        }).lean();

        // Get all friend Firebase UIDs
        const myFriendUids = friendships.map((f: any) =>
            f.user1Id === userId ? f.user2Id : f.user1Id
        );

        // Find their friends
        const fofFriendships = await Friendship.find({
            $or: [
                { user1Id: { $in: myFriendUids }, status: 'active' },
                { user2Id: { $in: myFriendUids }, status: 'active' },
            ],
        }).lean();

        fofFriendships.forEach((f: any) => {
            [f.user1Id, f.user2Id].forEach((uid: string) => {
                if (uid !== userId && !friendFirebaseUids.has(uid)) {
                    friendOfFriendUids.add(uid);
                }
            });
        });

        const allSuggestions = new Set([...coTravelerUids, ...friendOfFriendUids]);
        if (allSuggestions.size === 0) return [];

        const users = await User.find({
            firebaseUid: { $in: Array.from(allSuggestions).slice(0, 20) },
            isActive: true,
            isDeleted: false,
        })
            .select('firebaseUid displayName photoURL')
            .lean();

        return users.map((u: any) => ({
            userId: u.firebaseUid,
            displayName: u.displayName,
            photoURL: u.photoURL,
            reason: coTravelerUids.has(u.firebaseUid)
                ? 'You traveled together'
                : 'Friend of a friend',
        }));
    },

    async areFriends(userId1: string, userId2: string): Promise<boolean> {
        const [u1, u2] = [userId1, userId2].sort();
        const friendship = await Friendship.findOne({
            user1Id: u1,
            user2Id: u2,
            status: 'active',
        }).lean();
        return !!friendship;
    },

    // ============================================================
    // 🚀 TRIP INVITES
    // ============================================================

    async inviteFriendsToTrip(
        tripId: string,
        inviterUid: string,
        friendUids: string[],
        message?: string
    ): Promise<void> {
        const trip = await Trip.findById(tripId)
            .populate('stops', 'name emoji country')
            .lean();

        if (!trip) throw new AppError('Trip not found', 404);

        const inviter = await User.findOne({ firebaseUid: inviterUid })
            .select('displayName photoURL')
            .lean();
        if (!inviter) throw new AppError('User not found', 404);

        const memberPreviews = (trip as any).members
            ?.filter((m: any) => m.isActive)
            .slice(0, 5)
            .map((m: any) => ({
                displayName: m.displayName,
                photoURL: m.photoURL,
            })) || [];

        const inviteData: TripInviteNotificationData = {
            tripId: tripId,
            tripTitle: trip.title,
            tripDestination: (trip as any).stops?.[0]?.name || trip.title,
            tripStartDate: trip.startDate,
            tripEndDate: trip.endDate,
            tripCoverImage: trip.coverImage,
            invitedBy: inviterUid,
            invitedByName: inviter.displayName,
            totalMembers: (trip as any).members?.filter((m: any) => m.isActive).length || 1,
            memberPreview: memberPreviews,
            totalBudget: trip.totalBudget,
            baseCurrency: trip.baseCurrency,
            stops: (trip as any).stops?.map((s: any) => ({
                name: s.name,
                emoji: s.emoji,
            })) || [],
            message,
        };

        for (const friendUid of friendUids) {
            const [u1, u2] = [inviterUid, friendUid].sort();
            const isMuted = await this._isFriendMuted(inviterUid, friendUid);

            // Save invite in Friendship document
            await Friendship.findOneAndUpdate(
                { user1Id: u1, user2Id: u2, status: 'active' },
                {
                    $push: {
                        tripInvites: {
                            tripId: new Types.ObjectId(tripId),
                            tripTitle: trip.title,
                            tripDestination: inviteData.tripDestination,
                            tripStartDate: trip.startDate,
                            tripEndDate: trip.endDate,
                            tripCoverImage: trip.coverImage,
                            invitedBy: inviterUid,
                            invitedByName: inviter.displayName,
                            status: 'interested',
                            message: message || '',
                            createdAt: new Date(),
                        },
                    },
                }
            );

            // Send rich notification with trip card
            await notificationService.create(
                friendUid,
                'TRIP_INVITE',
                `${inviter.displayName} is planning a trip! 🧳`,
                `${inviter.displayName} is going to ${inviteData.tripDestination}`,
                {
                    data: {
                        ...inviteData,
                        actionButtons: [
                            { label: '👋 I\'m Interested', action: 'trip_interest', value: 'interested' },
                            { label: '✅ I\'m Going!', action: 'trip_interest', value: 'going' },
                            { label: '🤔 Maybe', action: 'trip_interest', value: 'maybe' },
                            { label: '❌ Not This Time', action: 'trip_interest', value: 'declined' },
                        ],
                    },
                    expiryInDays: 14,
                    isActionable: true,
                    priority: 'high',
                }
            );

            if (!isMuted) {
                socketServer.sendToUser(friendUid, 'trip:friend_invite', {
                    type: 'TRIP_FRIEND_INVITE',
                    ...inviteData,
                    timestamp: new Date().toISOString(),
                });
            }
        }

        logger.info(`Trip invite sent to ${friendUids.length} friends for trip ${tripId}`);
    },

    async respondToTripInvite(
        tripId: string,
        userId: string,
        response: 'interested' | 'going' | 'maybe' | 'declined',
        inviterUid: string
    ): Promise<void> {
        const [u1, u2] = [userId, inviterUid].sort();
        const friendship = await Friendship.findOne({ user1Id: u1, user2Id: u2 });

        if (!friendship) throw new AppError('Friendship not found', 404);

        const invite = friendship.tripInvites.find(
            (i: any) =>
                i.tripId.toString() === tripId &&
                i.status === 'interested' &&
                !i.respondedAt
        );

        if (!invite) throw new AppError('Trip invite not found or already responded', 404);

        invite.status = response;
        invite.respondedAt = new Date();

        // If they're going, auto-create join request
        if (response === 'going') {
            const trip = await Trip.findById(tripId);
            if (trip && !trip.isMember(userId)) {
                const { JoinRequest } = await import('../trips/join_request.model');
                const existingRequest = await JoinRequest.findOne({
                    tripId: new Types.ObjectId(tripId),
                    userId,
                    status: 'pending',
                });

                if (!existingRequest) {
                    const user = await User.findOne({ firebaseUid: userId })
                        .select('displayName photoURL')
                        .lean();
                    await new JoinRequest({
                        tripId: new Types.ObjectId(tripId),
                        tripTitle: trip.title,
                        userId,
                        userName: user?.displayName || 'Unknown',
                        photoURL: user?.photoURL,
                        status: 'pending',
                    }).save();
                }
            }
        }

        await friendship.save();

        // Notify inviter
        const responder = await User.findOne({ firebaseUid: userId })
            .select('displayName')
            .lean();
        const responseEmoji: Record<string, string> = {
            interested: '👋',
            going: '✅',
            maybe: '🤔',
            declined: '❌',
        };

        socketServer.sendToUser(inviterUid, 'trip:invite_response', {
            type: 'TRIP_INVITE_RESPONSE',
            tripId,
            userId,
            userName: responder?.displayName,
            response,
            emoji: responseEmoji[response],
            timestamp: new Date().toISOString(),
        });

        await notificationService.create(
            inviterUid,
            'TRIP_INVITE_RESPONSE',
            `${responder?.displayName} responded`,
            `${responseEmoji[response]} ${responder?.displayName} is ${response} for your trip`,
            {
                data: { tripId, userId, response },
                priority: 'medium',
            }
        );
    },

    async getMyTripInvites(userId: string): Promise<any[]> {
        const friendships = await Friendship.find({
            $or: [{ user1Id: userId }, { user2Id: userId }],
            status: 'active',
        }).lean();

        const allInvites: any[] = [];

        friendships.forEach((f: any) => {
            // Invites sent TO me
            (f.tripInvites || [])
                .filter((i: any) => i.invitedBy !== userId)
                .forEach((invite: any) => {
                    allInvites.push({
                        ...invite,
                        friendshipId: f._id,
                        fromUserId: invite.invitedBy,
                        fromName: invite.invitedByName,
                        isSentToMe: true,
                    });
                });

            // Invites sent BY me
            (f.tripInvites || [])
                .filter((i: any) => i.invitedBy === userId)
                .forEach((invite: any) => {
                    const otherUid = f.user1Id === userId ? f.user2Id : f.user1Id;
                    const otherName = f.user1Id === userId ? f.user2Name : f.user1Name;
                    const otherPhoto = f.user1Id === userId ? f.user2PhotoURL : f.user1PhotoURL;
                    allInvites.push({
                        ...invite,
                        friendshipId: f._id,
                        sentTo: {
                            userId: otherUid,
                            displayName: otherName,
                            photoURL: otherPhoto,
                        },
                        isSentByMe: true,
                    });
                });
        });

        return allInvites.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    },

    // ============================================================
    // GET FRIEND DETAILS
    // ============================================================

    async getFriendDetails(userId: string, friendUserId: string): Promise<any> {
        // Verify friendship
        const [u1, u2] = [userId, friendUserId].sort();
        const friendship = await Friendship.findOne({ user1Id: u1, user2Id: u2, status: 'active' }).lean();
        if (!friendship) throw new AppError('You are not friends with this user', 403);

        const friendInfo = await User.findOne({ firebaseUid: friendUserId })
            .select('displayName photoURL email phoneNumber createdAt bio bankingDetails.upiId')
            .lean();
        if (!friendInfo) throw new AppError('Friend not found', 404);

        // Fetch mutual trips where both users are active members
        const mutualTrips = await Trip.find({
            $and: [
                { 'members.userId': userId, 'members.isActive': true },
                { 'members.userId': friendUserId, 'members.isActive': true },
            ],
            isArchived: false,
        }).select('_id title coverImage startDate endDate stops totalBudget baseCurrency totalSpentBase status').sort({ startDate: -1 }).lean();

        // Fetch all shared expenses between userId and friendUserId
        const sharedExpensesDocs = await Expense.find({
            isArchived: false,
            $and: [
                { $or: [{ paidBy: userId }, { 'splits.userId': userId }] },
                { $or: [{ paidBy: friendUserId }, { 'splits.userId': friendUserId }] },
            ],
        }).sort({ date: -1 }).lean();

        let expensesTogether = 0;
        let youOwe = 0;
        let theyOwe = 0;
        let pendingCount = 0;

        sharedExpensesDocs.forEach((e: any) => {
            expensesTogether += (e.amountBase || 0);

            if (!e.isSettled) {
                pendingCount++;
                const userSplit = e.splits?.find((s: any) => s.userId === userId && !s.isPaid);
                const friendSplit = e.splits?.find((s: any) => s.userId === friendUserId && !s.isPaid);

                if (e.paidBy === friendUserId && userSplit) {
                    youOwe += (userSplit.amountBase || 0);
                } else if (e.paidBy === userId && friendSplit) {
                    theyOwe += (friendSplit.amountBase || 0);
                }
            }
        });

        const countries = new Set<string>();
        const cities = new Set<string>();
        mutualTrips.forEach(t => {
            t.stops?.forEach((s: any) => {
                if (s.country) countries.add(s.country);
                if (s.name) cities.add(s.name);
            });
        });

        // Compute per-trip stats for mutual trips
        const tripDetailsList = mutualTrips.map((t: any) => {
            const tripExpenses = sharedExpensesDocs.filter((e: any) => e.tripId?.toString() === t._id.toString());
            let tripYouOwe = 0;
            let tripTheyOwe = 0;
            let tripSharedTotal = 0;

            tripExpenses.forEach((e: any) => {
                tripSharedTotal += (e.amountBase || 0);
                if (!e.isSettled) {
                    const uSplit = e.splits?.find((s: any) => s.userId === userId && !s.isPaid);
                    const fSplit = e.splits?.find((s: any) => s.userId === friendUserId && !s.isPaid);
                    if (e.paidBy === friendUserId && uSplit) tripYouOwe += (uSplit.amountBase || 0);
                    if (e.paidBy === userId && fSplit) tripTheyOwe += (fSplit.amountBase || 0);
                }
            });

            return {
                id: t._id.toString(),
                name: t.title,
                date: t.startDate,
                startDate: t.startDate,
                endDate: t.endDate,
                image: t.coverImage || 'https://images.unsplash.com/photo-1508009603885-247a5fb04156?q=80&w=2070&auto=format&fit=crop',
                stopsCount: t.stops?.length || 0,
                totalExpenses: t.totalSpentBase || tripSharedTotal,
                sharedSpentTogether: tripSharedTotal,
                tripBalance: Math.round((tripTheyOwe - tripYouOwe) * 100) / 100,
                tripYouOwe: Math.round(tripYouOwe * 100) / 100,
                tripTheyOwe: Math.round(tripTheyOwe * 100) / 100,
                status: t.status || 'active',
            };
        });

        // Eligible trips that user is in, but friend is NOT yet in (for "Add to Trip" feature)
        const otherTrips = await Trip.find({
            'members.userId': userId,
            'members.isActive': true,
            isArchived: false,
            'members.userId': { $ne: friendUserId },
        }).select('_id title coverImage startDate endDate status').sort({ startDate: -1 }).limit(20).lean();

        const recentExpensesFormatted = sharedExpensesDocs.slice(0, 10).map((e: any) => {
            const userSplit = e.splits?.find((s: any) => s.userId === userId);
            const friendSplit = e.splits?.find((s: any) => s.userId === friendUserId);
            return {
                _id: e._id.toString(),
                title: e.title,
                amountBase: e.amountBase,
                date: e.date,
                category: e.category,
                paidBy: e.paidBy,
                paidByName: e.paidByName,
                isSettled: e.isSettled,
                yourShare: userSplit ? userSplit.amountBase : 0,
                theirShare: friendSplit ? friendSplit.amountBase : 0,
                direction: e.paidBy === userId ? 'you_paid' : 'they_paid',
            };
        });

        const netBalance = Math.round((theyOwe - youOwe) * 100) / 100;

        return {
            userId: friendUserId,
            displayName: friendInfo.displayName || `Traveler ${friendUserId.substring(0, 5)}`,
            email: friendInfo.email,
            phoneNumber: friendInfo.phoneNumber,
            photoURL: friendInfo.photoURL,
            coverImage: friendInfo.photoURL || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop',
            friendSince: friendship.createdAt || friendInfo.createdAt,
            travelScore: mutualTrips.length > 0 ? Math.min(4.0 + mutualTrips.length * 0.2, 5.0) : 4.5,
            tripsTogether: mutualTrips.length,
            countries: Array.from(countries),
            cities: Array.from(cities),
            expensesTogether: Math.round(expensesTogether * 100) / 100,
            settlementBalance: netBalance,
            youOwe: Math.round(youOwe * 100) / 100,
            theyOwe: Math.round(theyOwe * 100) / 100,
            pendingSettlementCount: pendingCount,
            recentTrips: tripDetailsList,
            mutualTrips: tripDetailsList,
            eligibleTripsToInvite: otherTrips.map((t: any) => ({
                id: t._id.toString(),
                title: t.title,
                coverImage: t.coverImage,
                startDate: t.startDate,
                endDate: t.endDate,
                status: t.status,
            })),
            recentExpenses: recentExpensesFormatted,
            achievements: ['Travel Buddy', 'Verified Companion'],
            timeline: [],
            sharedExpenses: recentExpensesFormatted,
        };
    },

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    async _getFriendFirebaseUids(userId: string): Promise<Set<string>> {
        const friendships = await Friendship.find({
            $or: [{ user1Id: userId }, { user2Id: userId }],
            status: 'active',
        }).lean();
        return new Set(
            friendships.flatMap((f: any) => [f.user1Id, f.user2Id]).filter(uid => uid !== userId)
        );
    },

    async _isFriendMuted(userId: string, friendUid: string): Promise<boolean> {
        const [u1, u2] = [userId, friendUid].sort();
        const friendship = await Friendship.findOne({ user1Id: u1, user2Id: u2 }).lean();
        return friendship?.mutedBy?.includes(friendUid) || false;
    },
};
