import { Schema, model, Document, Types } from 'mongoose';

// ============================================================
// TYPES
// ============================================================

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type FriendshipStatus = 'active' | 'blocked' | 'muted';
export type TripInterestStatus = 'interested' | 'going' | 'maybe' | 'declined';

export interface IFriendRequest extends Document {
    fromUserId: string;
    fromName: string;
    fromPhotoURL?: string;
    toUserId: string;
    toName: string;
    toPhotoURL?: string;
    status: FriendRequestStatus;
    message?: string;
    respondedAt?: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IFriendship extends Document {
    user1Id: string;          // Firebase UID (alphabetically first)
    user2Id: string;          // Firebase UID (alphabetically second)
    user1Name: string;
    user2Name: string;
    user1PhotoURL?: string;
    user2PhotoURL?: string;
    status: FriendshipStatus;
    blockedBy?: string;
    mutedBy?: string[];
    sharedTripCount: number;
    lastInteractionAt: Date;
    // Trip invitations between friends
    tripInvites: ITripInvite[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ITripInvite {
    tripId: Types.ObjectId;
    tripTitle: string;
    tripDestination: string;
    tripStartDate: Date;
    tripEndDate: Date;
    tripCoverImage?: string;
    invitedBy: string;        // Firebase UID
    invitedByName: string;
    status: TripInterestStatus;
    respondedAt?: Date;
    message?: string;
    createdAt: Date;
}

// ============================================================
// SUB-SCHEMAS
// ============================================================

const tripInviteSchema = new Schema<ITripInvite>(
    {
        tripId: {
            type: Schema.Types.ObjectId,
            ref: 'Trip',
            required: true,
        },
        tripTitle: { type: String, required: true },
        tripDestination: { type: String, default: '' },
        tripStartDate: { type: Date, required: true },
        tripEndDate: { type: Date, required: true },
        tripCoverImage: { type: String },
        invitedBy: { type: String, required: true },
        invitedByName: { type: String, required: true },
        status: {
            type: String,
            enum: ['interested', 'going', 'maybe', 'declined'],
            default: 'interested',
        },
        respondedAt: { type: Date },
        message: { type: String, maxlength: 300 },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

// ============================================================
// SCHEMAS
// ============================================================

const friendRequestSchema = new Schema<IFriendRequest>(
    {
        fromUserId: { type: String, required: true, index: true },
        fromName: { type: String, required: true },
        fromPhotoURL: { type: String },
        toUserId: { type: String, required: true, index: true },
        toName: { type: String, required: true },
        toPhotoURL: { type: String },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined', 'expired'],
            default: 'pending',
            index: true,
        },
        message: { type: String, maxlength: 200 },
        respondedAt: { type: Date },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
    },
    { timestamps: true, versionKey: false }
);

const friendshipSchema = new Schema<IFriendship>(
    {
        user1Id: { type: String, required: true, index: true },
        user2Id: { type: String, required: true, index: true },
        user1Name: { type: String, required: true },
        user2Name: { type: String, required: true },
        user1PhotoURL: { type: String },
        user2PhotoURL: { type: String },
        status: {
            type: String,
            enum: ['active', 'blocked', 'muted'],
            default: 'active',
        },
        blockedBy: { type: String },
        mutedBy: [{ type: String }],
        sharedTripCount: { type: Number, default: 0 },
        lastInteractionAt: { type: Date, default: Date.now },
        tripInvites: { type: [tripInviteSchema], default: [] },
    },
    { timestamps: true, versionKey: false }
);

// Indexes
friendRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });
friendRequestSchema.index({ toUserId: 1, status: 1 });
friendRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-delete

friendshipSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });
friendshipSchema.index({ user1Id: 1, status: 1 });
friendshipSchema.index({ user2Id: 1, status: 1 });

// Virtual: get the other user's info
friendshipSchema.methods.getOtherUser = function (myUserId: string) {
    if (this.user1Id === myUserId) {
        return {
            userId: this.user2Id,
            displayName: this.user2Name,
            photoURL: this.user2PhotoURL,
        };
    }
    return {
        userId: this.user1Id,
        displayName: this.user1Name,
        photoURL: this.user1PhotoURL,
    };
};

export const FriendRequest = model<IFriendRequest>('FriendRequest', friendRequestSchema);
export const Friendship = model<IFriendship>('Friendship', friendshipSchema);



// import { Schema, model, Document } from 'mongoose';

// // ============================================================
// // Types
// // ============================================================

// export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

// export interface IFriendRequest extends Document {
//     fromUserId: string;       // Firebase UID — who sent the request
//     fromName: string;
//     fromPhotoURL?: string;
//     toUserId: string;         // Firebase UID — who receives the request
//     toName: string;
//     toPhotoURL?: string;
//     status: FriendRequestStatus;
//     message?: string;
//     respondedAt?: Date;
//     createdAt: Date;
//     updatedAt: Date;
// }

// // ============================================================
// // Schema
// // ============================================================

// const friendRequestSchema = new Schema<IFriendRequest>(
//     {
//         fromUserId: {
//             type: String,
//             required: true,
//             index: true,
//         },
//         fromName: {
//             type: String,
//             required: true,
//         },
//         fromPhotoURL: {
//             type: String,
//         },
//         toUserId: {
//             type: String,
//             required: true,
//             index: true,
//         },
//         toName: {
//             type: String,
//             required: true,
//         },
//         toPhotoURL: {
//             type: String,
//         },
//         status: {
//             type: String,
//             enum: ['pending', 'accepted', 'declined'],
//             default: 'pending',
//             index: true,
//         },
//         message: {
//             type: String,
//             maxlength: 200,
//         },
//         respondedAt: {
//             type: Date,
//         },
//     },
//     {
//         timestamps: true,
//         versionKey: false,
//     }
// );

// // Indexes
// friendRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true }); // One request per pair
// friendRequestSchema.index({ toUserId: 1, status: 1 }); // Pending requests for a user

// export const FriendRequest = model<IFriendRequest>('FriendRequest', friendRequestSchema);