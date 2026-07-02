import { Types } from 'mongoose';
import { Invitation, IInvitation } from './invitation.model';
import { Trip } from './trip.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';
import { socketServer } from '../../infrastructure/websocket/socket.server';
import { notificationService } from '../notification/notification.service';

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

        // Check sender is admin
        if (!trip.isAdmin(fromUserId)) {
            throw new AppError('Only trip admins can send invitations', 403);
        }

        // Check receiver exists
        // NOTE: `toUserId` as passed in by callers (addMemberSchema, createTrip's
        // memberIds) is the User document's Mongo _id, so we look it up that way —
        // but everywhere else in this app (Trip.members[].userId, Expense.paidBy,
        // etc.) identity is tracked by Firebase UID. From here on we resolve to
        // `receiver.firebaseUid` and use THAT consistently, so the invitation
        // can actually be matched against req.user.userId (Firebase UID) later
        // in acceptInvitation/declineInvitation.
        const receiver = await User.findOne({
            _id: toUserId,
            isActive: true,
            isDeleted: false,
        });
        if (!receiver) throw new AppError('User not found', 404);

        const receiverFirebaseUid = receiver.firebaseUid;

        // Check not already a member
        if (trip.isMember(receiverFirebaseUid)) {
            throw new AppError('User is already a member of this trip', 409);
        }

        // Check no pending invitation already
        const existing = await Invitation.findOne({
            tripId: new Types.ObjectId(tripId),
            toUserId: receiverFirebaseUid,
            status: 'pending',
        });
        if (existing) {
            throw new AppError('An invitation is already pending for this user', 409);
        }

        // Get sender info
        const sender = trip.getMember(fromUserId);
        const senderName = sender?.displayName || 'Someone';

        // Create invitation
        const invitation = new Invitation({
            tripId: new Types.ObjectId(tripId),
            tripTitle: trip.title,
            fromUserId,
            fromName: senderName,
            toUserId: receiverFirebaseUid,
            toName: receiver.displayName,
            status: 'pending',
            message,
        });

        await invitation.save();

        // Send real-time WebSocket notification
        socketServer.notifyTripInvitation(
            receiverFirebaseUid,
            trip.title,
            senderName,
            tripId,
            invitation._id.toString()
        );

        // Also create in-app notification
        await notificationService.notifyTripInvitation(
            receiverFirebaseUid,
            tripId,
            trip.title,
            senderName
        );

        return invitation;
    },

    /**
     * Accept an invitation.
     */
    async acceptInvitation(invitationId: string, userId: string): Promise<void> {
        const invitation = await Invitation.findById(invitationId);
        if (!invitation) throw new AppError('Invitation not found', 404);
        if (invitation.toUserId !== userId) throw new AppError('This invitation is not for you', 403);
        if (invitation.status !== 'pending') {
            throw new AppError(`Invitation is already ${invitation.status}`, 400);
        }

        // Load trip
        const trip = await Trip.findById(invitation.tripId);
        if (!trip) throw new AppError('Trip not found', 404);
        if (trip.isArchived) throw new AppError('Trip is archived', 400);

        // Get user info
        // userId here is the Firebase UID (req.user.userId) — findByFirebaseUid
        // keeps this consistent with how toUserId is now stored.
        const user = await User.findByFirebaseUid(userId).select('displayName photoURL').lean();
        if (!user) throw new AppError('User not found', 404);

        // Add member to trip
        const existingMember = trip.members.find((m) => m.userId === userId && !m.isActive);
        if (existingMember) {
            existingMember.isActive = true;
            existingMember.displayName = user.displayName;
            existingMember.photoURL = user.photoURL || '';
            existingMember.joinedAt = new Date();
        } else {
            trip.members.push({
                userId,
                displayName: user.displayName,
                photoURL: user.photoURL || '',
                role: 'member',
                joinedAt: new Date(),
                isActive: true,
                totalPaidBase: 0,
                totalOwesBase: 0,
            });
        }

        await trip.save();

        // Update invitation status
        invitation.status = 'accepted';
        invitation.respondedAt = new Date();
        await invitation.save();

        // Notify trip members via WebSocket
        socketServer.notifyTripJoined(
            invitation.tripId.toString(),
            user.displayName
        );

        // Notify sender
        socketServer.sendToUser(invitation.fromUserId, 'invitation:accepted', {
            type: 'INVITATION_ACCEPTED',
            tripId: invitation.tripId.toString(),
            tripTitle: invitation.tripTitle,
            userName: user.displayName,
            timestamp: new Date().toISOString(),
        });
    },

    /**
     * Decline an invitation.
     */
    async declineInvitation(invitationId: string, userId: string): Promise<void> {
        const invitation = await Invitation.findById(invitationId);
        if (!invitation) throw new AppError('Invitation not found', 404);
        if (invitation.toUserId !== userId) throw new AppError('This invitation is not for you', 403);
        if (invitation.status !== 'pending') {
            throw new AppError(`Invitation is already ${invitation.status}`, 400);
        }

        invitation.status = 'declined';
        invitation.respondedAt = new Date();
        await invitation.save();

        // Notify sender
        const user = await User.findByFirebaseUid(userId).select('displayName').lean();
        socketServer.sendToUser(invitation.fromUserId, 'invitation:declined', {
            type: 'INVITATION_DECLINED',
            tripId: invitation.tripId.toString(),
            tripTitle: invitation.tripTitle,
            userName: user?.displayName || 'Someone',
            timestamp: new Date().toISOString(),
        });
    },

    /**
     * Get pending invitations for a user.
     */
    async getPendingInvitations(userId: string): Promise<IInvitation[]> {
        return Invitation.find({
            toUserId: userId,
            status: 'pending',
        })
            .sort({ createdAt: -1 })
            .exec();
    },

    /**
     * Get sent invitations for a trip.
     */
    async getTripInvitations(tripId: string, userId: string): Promise<IInvitation[]> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new AppError('Trip not found', 404);
        if (!trip.isAdmin(userId)) throw new AppError('Only admins can view invitations', 403);

        return Invitation.find({
            tripId: new Types.ObjectId(tripId),
            fromUserId: userId,
        })
            .sort({ createdAt: -1 })
            .exec();
    },
};
// import { Types } from 'mongoose';
// import { Invitation, IInvitation } from './invitation.model';
// import { Trip } from './trip.model';
// import { User } from '../auth/auth.model';
// import { AppError } from '../../shared/errors/AppError';
// import { socketServer } from '../../infrastructure/websocket/socket.server';
// import { notificationService } from '../notification/notification.service';

// export const invitationService = {
//     /**
//      * Send an invitation to a user.
//      */
//     async sendInvitation(
//         tripId: string,
//         toUserId: string,
//         fromUserId: string,
//         message?: string
//     ): Promise<IInvitation> {
//         // Load trip
//         const trip = await Trip.findById(tripId);
//         if (!trip) throw new AppError('Trip not found', 404);

//         // Check sender is admin
//         if (!trip.isAdmin(fromUserId)) {
//             throw new AppError('Only trip admins can send invitations', 403);
//         }

//         // Check receiver exists
//         const receiver = await User.findOne({
//             _id: toUserId,
//             isActive: true,
//             isDeleted: false,
//         });
//         if (!receiver) throw new AppError('User not found', 404);

//         // Check not already a member
//         if (trip.isMember(toUserId)) {
//             throw new AppError('User is already a member of this trip', 409);
//         }

//         // Check no pending invitation already
//         const existing = await Invitation.findOne({
//             tripId: new Types.ObjectId(tripId),
//             toUserId,
//             status: 'pending',
//         });
//         if (existing) {
//             throw new AppError('An invitation is already pending for this user', 409);
//         }

//         // Get sender info
//         const sender = trip.getMember(fromUserId);
//         const senderName = sender?.displayName || 'Someone';

//         // Create invitation
//         const invitation = new Invitation({
//             tripId: new Types.ObjectId(tripId),
//             tripTitle: trip.title,
//             fromUserId,
//             fromName: senderName,
//             toUserId,
//             toName: receiver.displayName,
//             status: 'pending',
//             message,
//         });

//         await invitation.save();

//         // Send real-time WebSocket notification
//         socketServer.notifyTripInvitation(
//             toUserId,
//             trip.title,
//             senderName,
//             tripId,
//             invitation._id.toString()
//         );

//         // Also create in-app notification
//         await notificationService.notifyTripInvitation(
//             toUserId,
//             tripId,
//             trip.title,
//             senderName
//         );

//         return invitation;
//     },

//     /**
//      * Accept an invitation.
//      */
//     async acceptInvitation(invitationId: string, userId: string): Promise<void> {
//         const invitation = await Invitation.findById(invitationId);
//         if (!invitation) throw new AppError('Invitation not found', 404);
//         if (invitation.toUserId !== userId) throw new AppError('This invitation is not for you', 403);
//         if (invitation.status !== 'pending') {
//             throw new AppError(`Invitation is already ${invitation.status}`, 400);
//         }

//         // Load trip
//         const trip = await Trip.findById(invitation.tripId);
//         if (!trip) throw new AppError('Trip not found', 404);
//         if (trip.isArchived) throw new AppError('Trip is archived', 400);

//         // Get user info
//         const user = await User.findById(userId).select('displayName photoURL').lean();
//         if (!user) throw new AppError('User not found', 404);

//         // Add member to trip
//         const existingMember = trip.members.find((m) => m.userId === userId && !m.isActive);
//         if (existingMember) {
//             existingMember.isActive = true;
//             existingMember.displayName = user.displayName;
//             existingMember.photoURL = user.photoURL || '';
//             existingMember.joinedAt = new Date();
//         } else {
//             trip.members.push({
//                 userId,
//                 displayName: user.displayName,
//                 photoURL: user.photoURL || '',
//                 role: 'member',
//                 joinedAt: new Date(),
//                 isActive: true,
//                 totalPaidBase: 0,
//                 totalOwesBase: 0,
//             });
//         }

//         await trip.save();

//         // Update invitation status
//         invitation.status = 'accepted';
//         invitation.respondedAt = new Date();
//         await invitation.save();

//         // Notify trip members via WebSocket
//         socketServer.notifyTripJoined(
//             invitation.tripId.toString(),
//             user.displayName
//         );

//         // Notify sender
//         socketServer.sendToUser(invitation.fromUserId, 'invitation:accepted', {
//             type: 'INVITATION_ACCEPTED',
//             tripId: invitation.tripId.toString(),
//             tripTitle: invitation.tripTitle,
//             userName: user.displayName,
//             timestamp: new Date().toISOString(),
//         });
//     },

//     /**
//      * Decline an invitation.
//      */
//     async declineInvitation(invitationId: string, userId: string): Promise<void> {
//         const invitation = await Invitation.findById(invitationId);
//         if (!invitation) throw new AppError('Invitation not found', 404);
//         if (invitation.toUserId !== userId) throw new AppError('This invitation is not for you', 403);
//         if (invitation.status !== 'pending') {
//             throw new AppError(`Invitation is already ${invitation.status}`, 400);
//         }

//         invitation.status = 'declined';
//         invitation.respondedAt = new Date();
//         await invitation.save();

//         // Notify sender
//         const user = await User.findById(userId).select('displayName').lean();
//         socketServer.sendToUser(invitation.fromUserId, 'invitation:declined', {
//             type: 'INVITATION_DECLINED',
//             tripId: invitation.tripId.toString(),
//             tripTitle: invitation.tripTitle,
//             userName: user?.displayName || 'Someone',
//             timestamp: new Date().toISOString(),
//         });
//     },

//     /**
//      * Get pending invitations for a user.
//      */
//     async getPendingInvitations(userId: string): Promise<IInvitation[]> {
//         return Invitation.find({
//             toUserId: userId,
//             status: 'pending',
//         })
//             .sort({ createdAt: -1 })
//             .exec();
//     },

//     /**
//      * Get sent invitations for a trip.
//      */
//     async getTripInvitations(tripId: string, userId: string): Promise<IInvitation[]> {
//         const trip = await Trip.findById(tripId);
//         if (!trip) throw new AppError('Trip not found', 404);
//         if (!trip.isAdmin(userId)) throw new AppError('Only admins can view invitations', 403);

//         return Invitation.find({
//             tripId: new Types.ObjectId(tripId),
//             fromUserId: userId,
//         })
//             .sort({ createdAt: -1 })
//             .exec();
//     },
// };