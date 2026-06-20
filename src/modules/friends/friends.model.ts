import { Schema, model, Document } from 'mongoose';

// ============================================================
// Types
// ============================================================

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface IFriendRequest extends Document {
    fromUserId: string;       // Firebase UID — who sent the request
    fromName: string;
    fromPhotoURL?: string;
    toUserId: string;         // Firebase UID — who receives the request
    toName: string;
    toPhotoURL?: string;
    status: FriendRequestStatus;
    message?: string;
    respondedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================================
// Schema
// ============================================================

const friendRequestSchema = new Schema<IFriendRequest>(
    {
        fromUserId: {
            type: String,
            required: true,
            index: true,
        },
        fromName: {
            type: String,
            required: true,
        },
        fromPhotoURL: {
            type: String,
        },
        toUserId: {
            type: String,
            required: true,
            index: true,
        },
        toName: {
            type: String,
            required: true,
        },
        toPhotoURL: {
            type: String,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined'],
            default: 'pending',
            index: true,
        },
        message: {
            type: String,
            maxlength: 200,
        },
        respondedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Indexes
friendRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true }); // One request per pair
friendRequestSchema.index({ toUserId: 1, status: 1 }); // Pending requests for a user

export const FriendRequest = model<IFriendRequest>('FriendRequest', friendRequestSchema);