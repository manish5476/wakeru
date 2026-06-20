import { z } from 'zod';

const firebaseUid = z.string().min(1, 'User ID is required').max(128);

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

export const searchUsersSchema = z.object({
    query: z.string().min(2, 'Search query must be at least 2 characters').max(100),
});