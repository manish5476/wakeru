// backend/src/modules/invitation/invitation.service.ts

import { Types } from 'mongoose';
import { Invitation, IInvitation } from './invitation.model';
import { Trip } from './trip.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { notificationService } from '../notification/notification.service';
import { entitlementService } from '../subscription';

export const invitationService = {
    /**
     * Send an invitation to a user.
     */
    async sendInvitation(
        tripId: string,
        toUserId: string,
        fromUserId: string,
        message?: string
    ): Promise<IInvitation> {
        // Load trip
        const trip = await Trip.findById(tripId);
        if (!trip) throw new AppError('Trip not found', 404);

        // Check sender is admin or trip creator
        if (!trip.isAdmin(fromUserId) && trip.createdBy !== fromUserId) {
            throw new AppError('Only trip admins can send invitations', 403);
        }

        // Authoritative peoplePerTrip subscription limit check
        const activeMembersCount = trip.members.filter((m) => m.isActive).length;
        const pendingInvitesCount = await Invitation.countDocuments({
            tripId: trip._id,
            status: 'pending',
        });
        const currentCommittedPeople = activeMembersCount + pendingInvitesCount;
        await entitlementService.assertWithinLimit(
            trip.createdBy,
            'peoplePerTrip',
            1,
            currentCommittedPeople
        );

        // Check receiver exists
        const trimmedToUserId = toUserId.trim();
        const receiver = await User.findOne({
            $or: [
                ...(Types.ObjectId.isValid(trimmedToUserId) ? [{ _id: trimmedToUserId }] : []),
                { firebaseUid: trimmedToUserId }, 
                { email: trimmedToUserId.toLowerCase() }
            ],
            isActive: true,
            isDeleted: false,
        });

        let canonicalToUserId: string;
        let canonicalToName: string;
        let receiverCandidateIds: string[];

        if (receiver) {
            canonicalToUserId = receiver.firebaseUid || (receiver as any)._id?.toString();
            canonicalToName = receiver.displayName || 'Friend';
            receiverCandidateIds = [
                receiver.firebaseUid,
                (receiver as any)._id?.toString(),
                receiver.email?.toLowerCase(),
                trimmedToUserId.toLowerCase(),
            ].filter(Boolean);
        } else {
            // Check if valid email address
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedToUserId);
            if (!isEmail) {
                throw new AppError('User not found', 404);
            }
            canonicalToUserId = trimmedToUserId.toLowerCase();
            canonicalToName = trimmedToUserId.split('@')[0];
            receiverCandidateIds = [canonicalToUserId];
        }

        // Check not already a member
        if (receiverCandidateIds.some((id) => trip.isMember(id))) {
            throw new AppError('User is already a member of this trip', 409);
        }

        // Get sender info
        const sender = trip.getMember(fromUserId);
        const senderName = sender?.displayName || 'Someone';

        // Check if an invitation already exists (pending, declined, expired, or accepted)
        const existing = await Invitation.findOne({
            tripId: new Types.ObjectId(tripId),
            toUserId: { $in: receiverCandidateIds },
        });

        if (existing) {
            if (existing.status === 'pending') {
                throw new AppError('An invitation is already pending for this user', 409);
            }
            if (existing.status === 'accepted') {
                throw new AppError('User has already accepted an invitation to this trip', 409);
            }

            // Reactivate declined or expired invitation to avoid duplicate key error
            existing.status = 'pending';
            existing.fromUserId = fromUserId;
            existing.fromName = senderName;
            existing.tripTitle = trip.title;
            existing.toUserId = canonicalToUserId;
            existing.toName = canonicalToName;
            existing.message = message;
            existing.respondedAt = undefined;
            await existing.save();

            if (receiver) {
                socketServer.notifyTripInvitation(
                    receiver._id.toString(),
                    trip.title,
                    senderName,
                    tripId,
                    existing._id.toString()
                );
                await notificationService.notifyTripInvitation(
                    receiver._id.toString(),
                    tripId,
                    trip.title,
                    senderName,
                    existing._id.toString()
                );
            }

            return existing;
        }

        // Create new invitation
        const invitation = new Invitation({
            tripId: new Types.ObjectId(tripId),
            tripTitle: trip.title,
            fromUserId,
            fromName: senderName,
            toUserId: canonicalToUserId,
            toName: canonicalToName,
            status: 'pending',
            message,
        });

        await invitation.save();

        if (receiver) {
            // Send real-time WebSocket notification
            socketServer.notifyTripInvitation(
                receiver._id.toString(),
                trip.title,
                senderName,
                tripId,
                invitation._id.toString()
            );

            // ✅ Create in-app notification WITH invitation ID
            await notificationService.notifyTripInvitation(
                receiver._id.toString(),
                tripId,
                trip.title,
                senderName,
                invitation._id.toString()
            );
        }

        return invitation;
    },

    /**
     * Get a single invitation by its ID.
     */
    async getInvitationById(invitationId: string, userId: string): Promise<IInvitation> {
        const invitation = await Invitation.findById(invitationId);
        if (!invitation) throw new AppError('Invitation not found', 404);

        const user = await User.findOne({
            $or: [
                { firebaseUid: userId },
                ...(Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
                { email: userId.toLowerCase() }
            ]
        }).select('_id firebaseUid email').lean();

        const candidateIds = [
            userId,
            user?.firebaseUid,
            (user as any)?._id?.toString(),
            user?.email?.toLowerCase(),
            user?.email
        ].filter(Boolean);

        if (!candidateIds.includes(invitation.toUserId)) {
            throw new AppError('This invitation is not for you', 403);
        }
        return invitation;
    },

    /**
     * Accept an invitation.
     */
    async acceptInvitation(invitationId: string, userId: string): Promise<any> {
        const invitation = await Invitation.findById(invitationId);
        if (!invitation) throw new AppError('Invitation not found', 404);
        if (invitation.status !== 'pending') {
            throw new AppError(`Invitation is already ${invitation.status}`, 400);
        }

        // Get user info with multi-identity resolution
        const user = await User.findOne({
            $or: [
                { firebaseUid: userId },
                ...(Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
                { email: userId.toLowerCase() }
            ]
        })
            .select('displayName photoURL firebaseUid email')
            .lean();
        if (!user) throw new AppError('User not found', 404);

        const candidateIds = [
            userId,
            user.firebaseUid,
            (user as any)._id?.toString(),
            user.email?.toLowerCase(),
            user.email
        ].filter(Boolean);
        if (!candidateIds.includes(invitation.toUserId)) {
            throw new AppError('This invitation is not for you', 403);
        }

        const memberUserId = user.firebaseUid || (user as any)._id.toString();

        // Load trip
        const trip = await Trip.findById(invitation.tripId);
        if (!trip || trip.isArchived) {
            await Invitation.deleteOne({ _id: invitation._id });
            throw new AppError('This trip no longer exists. The invitation has been removed.', 404);
        }
        if (trip.isArchived) throw new AppError('Trip is archived', 400);

        // Add member to trip (idempotent — do not duplicate active members)
        const isAlreadyActiveMember = trip.members.some(
            (m) => candidateIds.includes(m.userId) && m.isActive
        );

        if (!isAlreadyActiveMember) {
            const existingMember = trip.members.find(
                (m) => candidateIds.includes(m.userId) && !m.isActive
            );
            if (existingMember) {
                existingMember.isActive = true;
                existingMember.userId = memberUserId;
                existingMember.displayName = user.displayName;
                existingMember.photoURL = user.photoURL || '';
                existingMember.joinedAt = new Date();
            } else {
                // Authoritative limit check before admitting new member
                const activeMembersCount = trip.members.filter((m) => m.isActive).length;
                await entitlementService.assertWithinLimit(
                    trip.createdBy,
                    'peoplePerTrip',
                    1,
                    activeMembersCount
                );

                trip.members.push({
                    userId: memberUserId,
                    displayName: user.displayName,
                    photoURL: user.photoURL || '',
                    role: 'member',
                    joinedAt: new Date(),
                    isActive: true,
                    totalPaidBase: 0,
                    totalOwesBase: 0,
                });
            }

            trip.markModified('members');
            await trip.save();
        }

        // Update invitation status
        invitation.status = 'accepted';
        invitation.respondedAt = new Date();
        await invitation.save();

        // Notify trip members via WebSocket
        socketServer.notifyTripJoined(
            invitation.tripId.toString(),
            user.displayName
        );

        // Notify sender via WebSocket
        socketServer.sendToUser(invitation.fromUserId, 'invitation:accepted', {
            type: 'INVITATION_ACCEPTED',
            tripId: invitation.tripId.toString(),
            tripTitle: invitation.tripTitle,
            userName: user.displayName,
            timestamp: new Date().toISOString(),
        });

        // ✅ Also send in-app notification to sender
        await notificationService.notifyInvitationAccepted(
            invitation.fromUserId,
            user.displayName,
            invitation.tripTitle,
            invitation.tripId.toString()
        );

        // ✅ Mark receiver's invitation notification as resolved & non-actionable
        const { Notification } = await import('../notification/notification.model');
        await Notification.updateMany(
            {
                userId: userId,
                $or: [
                    { 'data.invitationId': invitation._id.toString() },
                    { 'data.invitationId': invitation._id },
                    { 'data.tripId': invitation.tripId.toString(), type: 'TRIP_INVITATION' }
                ]
            },
            {
                $set: {
                    isRead: true,
                    isActionable: false,
                    actionButtons: [],
                    message: `You joined "${invitation.tripTitle}"`,
                    readAt: new Date()
                }
            }
        );

        return trip;
    },

    /**
     * Decline an invitation.
     */
    async declineInvitation(invitationId: string, userId: string): Promise<void> {
        const invitation = await Invitation.findById(invitationId);
        if (!invitation) throw new AppError('Invitation not found', 404);
        if (invitation.status !== 'pending') {
            throw new AppError(`Invitation is already ${invitation.status}`, 400);
        }

        const user = await User.findOne({
            $or: [
                { firebaseUid: userId },
                ...(Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
                { email: userId.toLowerCase() }
            ]
        }).select('_id firebaseUid email displayName').lean();

        const candidateIds = [
            userId,
            user?.firebaseUid,
            (user as any)?._id?.toString(),
            user?.email?.toLowerCase(),
            user?.email
        ].filter(Boolean);
        if (!candidateIds.includes(invitation.toUserId)) {
            throw new AppError('This invitation is not for you', 403);
        }

        const trip = await Trip.findById(invitation.tripId);
        if (!trip || trip.isArchived) {
            await Invitation.deleteOne({ _id: invitation._id });
            return;
        }

        invitation.status = 'declined';
        invitation.respondedAt = new Date();
        await invitation.save();

        // Notify sender via WebSocket
        socketServer.sendToUser(invitation.fromUserId, 'invitation:declined', {
            type: 'INVITATION_DECLINED',
            tripId: invitation.tripId.toString(),
            tripTitle: invitation.tripTitle,
            userName: user?.displayName || 'Someone',
            timestamp: new Date().toISOString(),
        });

        // ✅ Also send in-app notification to sender
        await notificationService.notifyInvitationDeclined(
            invitation.fromUserId,
            user?.displayName || 'Someone',
            invitation.tripTitle,
            invitation.tripId.toString()
        );

        // ✅ Mark receiver's invitation notification as resolved & non-actionable
        const { Notification } = await import('../notification/notification.model');
        await Notification.updateMany(
            {
                userId: { $in: candidateIds },
                $or: [
                    { 'data.invitationId': invitation._id.toString() },
                    { 'data.invitationId': invitation._id },
                    { 'data.tripId': invitation.tripId.toString(), type: 'TRIP_INVITATION' }
                ]
            },
            {
                $set: {
                    isRead: true,
                    isActionable: false,
                    actionButtons: [],
                    message: `You declined the invitation to "${invitation.tripTitle}"`,
                    readAt: new Date()
                }
            }
        );
    },

    /**
     * Get pending invitations for a user with fast caching and sender hydration.
     */
    async getPendingInvitations(
        userId: string,
        userContext?: { userId?: string; firebaseUid?: string; email?: string }
    ): Promise<any[]> {
        const userIdsToMatch = new Set<string>([userId]);
        if (userContext?.firebaseUid) userIdsToMatch.add(userContext.firebaseUid);
        if (userContext?.userId) userIdsToMatch.add(userContext.userId);
        if (userContext?.email) userIdsToMatch.add(userContext.email.toLowerCase());

        // If context was not provided, do a single fallback lookup
        if (userIdsToMatch.size <= 1) {
            const user = await User.findOne({
                $or: [
                    { firebaseUid: userId },
                    ...(Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
                    { email: userId.toLowerCase() }
                ]
            }).select('_id firebaseUid email').lean();

            if (user) {
                if (user.firebaseUid) userIdsToMatch.add(user.firebaseUid);
                if ((user as any)._id) userIdsToMatch.add((user as any)._id.toString());
                if (user.email) userIdsToMatch.add(user.email.toLowerCase());
            }
        }

        const invites = await Invitation.find({
            toUserId: { $in: Array.from(userIdsToMatch) },
            status: 'pending',
        })
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        if (!invites.length) return [];

        const tripIds = invites.map((i) => i.tripId);
        const [existingTrips, senders] = await Promise.all([
            Trip.find({
                _id: { $in: tripIds },
                isArchived: { $ne: true },
            }).select('_id title description startDate endDate coverImage status inviteCode baseCurrency totalBudget').lean(),
            User.find({
                firebaseUid: { $in: invites.map((i) => i.fromUserId) },
            }).select('firebaseUid displayName photoURL').lean(),
        ]);

        const existingTripMap = new Map(
            existingTrips.map((t: any) => [t._id.toString(), {
                _id: t._id.toString(),
                title: t.title,
                description: t.description,
                startDate: t.startDate,
                endDate: t.endDate,
                coverImage: t.coverImage,
                status: t.status,
                inviteCode: t.inviteCode,
                baseCurrency: t.baseCurrency,
                totalBudget: t.totalBudget,
            }])
        );
        const senderMap = new Map(
            senders.map((s) => [s.firebaseUid, { displayName: s.displayName, photoURL: s.photoURL }])
        );

        // Auto-cleanup orphan invitations asynchronously in background
        const orphanIds = invites
            .filter((i) => !existingTripMap.has(i.tripId.toString()))
            .map((i) => i._id);

        if (orphanIds.length > 0) {
            Invitation.deleteMany({ _id: { $in: orphanIds } }).catch(() => {});
        }

        return invites
            .filter((i) => existingTripMap.has(i.tripId.toString()))
            .map((i) => ({
                ...i,
                tripId: existingTripMap.get(i.tripId.toString()) || i.tripId,
                fromUser: senderMap.get(i.fromUserId) || {
                    displayName: i.fromName || 'Trip Organizer',
                    photoURL: '',
                },
            }));
    },

    /**
     * Get sent invitations for a trip.
     */
    async getTripInvitations(tripId: string, userId: string): Promise<IInvitation[]> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new AppError('Trip not found', 404);
        if (!trip.isAdmin(userId)) {
            throw new AppError('Only admins can view invitations', 403);
        }

        return Invitation.find({
            tripId: new Types.ObjectId(tripId),
            fromUserId: userId,
        })
            .sort({ createdAt: -1 })
            .lean()
            .exec() as unknown as Promise<IInvitation[]>;
    },

    /**
     * Get all pending invitations sent by the current user across all trips.
     */
    async getSentInvitations(
        userId: string,
        userContext?: { userId?: string; firebaseUid?: string; email?: string }
    ): Promise<any[]> {
        const userIdsToMatch = new Set<string>([userId]);
        if (userContext?.firebaseUid) userIdsToMatch.add(userContext.firebaseUid);
        if (userContext?.userId) userIdsToMatch.add(userContext.userId);

        if (userIdsToMatch.size <= 1) {
            const user = await User.findOne({
                $or: [
                    { firebaseUid: userId },
                    ...(Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
                    { email: userId.toLowerCase() }
                ]
            }).select('_id firebaseUid email').lean();

            if (user) {
                if (user.firebaseUid) userIdsToMatch.add(user.firebaseUid);
                if ((user as any)._id) userIdsToMatch.add((user as any)._id.toString());
            }
        }

        const invites = await Invitation.find({
            fromUserId: { $in: Array.from(userIdsToMatch) },
            status: 'pending',
        })
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        if (!invites.length) return [];

        const tripIds = invites.map((i) => i.tripId);
        const existingTrips = await Trip.find({
            _id: { $in: tripIds },
            isArchived: { $ne: true },
        })
            .select('_id title description startDate endDate coverImage status inviteCode baseCurrency totalBudget')
            .lean();

        const existingTripMap = new Map(
            existingTrips.map((t: any) => [t._id.toString(), {
                _id: t._id.toString(),
                title: t.title,
                description: t.description,
                startDate: t.startDate,
                endDate: t.endDate,
                coverImage: t.coverImage,
                status: t.status,
                inviteCode: t.inviteCode,
                baseCurrency: t.baseCurrency,
                totalBudget: t.totalBudget,
            }])
        );

        return invites
            .filter((i) => existingTripMap.has(i.tripId.toString()))
            .map((i) => ({
                ...i,
                tripId: existingTripMap.get(i.tripId.toString()) || i.tripId,
            }));
    },

    /**
     * Cancel/revoke a pending invitation by the sender or trip admin.
     */
    async cancelInvitation(invitationId: string, userId: string): Promise<void> {
        const invitation = await Invitation.findById(invitationId);
        if (!invitation) throw new AppError('Invitation not found', 404);
        if (invitation.status !== 'pending') {
            throw new AppError(`Invitation is already ${invitation.status}`, 400);
        }

        const user = await User.findOne({
            $or: [
                { firebaseUid: userId },
                ...(Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
                { email: userId.toLowerCase() }
            ]
        }).select('_id firebaseUid email').lean();

        const candidateIds = [
            userId,
            user?.firebaseUid,
            (user as any)?._id?.toString(),
            user?.email?.toLowerCase(),
            user?.email
        ].filter(Boolean);

        const trip = await Trip.findById(invitation.tripId);
        const isSender = candidateIds.includes(invitation.fromUserId);
        const isAdmin = trip && candidateIds.some(id => trip.isAdmin(id) || trip.createdBy === id);

        if (!isSender && !isAdmin) {
            throw new AppError('Only the sender or a trip admin can cancel this invitation', 403);
        }

        // Delete invitation document
        await Invitation.deleteOne({ _id: invitation._id });

        // Clean up receiver's in-app notifications
        try {
            const { Notification } = await import('../notification/notification.model');
            await Notification.updateMany(
                {
                    $or: [
                        { 'data.invitationId': invitation._id.toString() },
                        { 'data.invitationId': invitation._id },
                    ]
                },
                {
                    $set: {
                        isRead: true,
                        isActionable: false,
                        actionButtons: [],
                        message: `Invitation to "${invitation.tripTitle}" was cancelled by sender`,
                        readAt: new Date()
                    }
                }
            );
        } catch {
            // Notification cleanup non-blocking
        }

        // Notify receiver via WebSocket
        socketServer.sendToUser(invitation.toUserId, 'invitation:cancelled', {
            type: 'INVITATION_CANCELLED',
            invitationId: invitation._id.toString(),
            tripId: invitation.tripId.toString(),
            tripTitle: invitation.tripTitle,
            timestamp: new Date().toISOString(),
        });
    },
};