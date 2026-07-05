import { z } from 'zod';

const firebaseUid = z.string().min(1, 'User ID is required').max(128);
const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const sendFriendRequestSchema = z.object({
    toUserId: firebaseUid,
    message: z.string().max(200).optional(),
});

export const friendRequestParamSchema = z.object({
    requestId: z.string().min(1, 'Request ID is required'),
});

export const removeFriendParamSchema = z.object({
    friendUserId: firebaseUid,
});

export const muteFriendSchema = z.object({
    mute: z.boolean().default(true),
});

export const searchUsersSchema = z.object({
    query: z.string().min(2, 'Search query must be at least 2 characters').max(100),
});

// 🚀 Trip Invites
export const inviteFriendsToTripSchema = z.object({
    tripId: mongoId,
    friendUids: z.array(firebaseUid).min(1, 'At least one friend is required').max(50, 'Max 50 friends at once'),
    message: z.string().max(300).optional(),
});

export const respondToTripInviteSchema = z.object({
    tripId: mongoId,
    response: z.enum(['interested', 'going', 'maybe', 'declined']),
    inviterUid: firebaseUid,
});