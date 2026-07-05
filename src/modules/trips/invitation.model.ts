import { Schema, model, Document } from 'mongoose';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface IInvitation extends Document {
    tripId: Schema.Types.ObjectId;
    tripTitle: string;          // Denormalized
    fromUserId: string;          // Firebase UID — who sent the invite
    fromName: string;            // Denormalized
    toUserId: string;            // Firebase UID — who receives the invite
    toName: string;              // Denormalized
    status: InvitationStatus;
    message?: string;
    createdAt: Date;
    updatedAt: Date;
    respondedAt?: Date;
}

const invitationSchema = new Schema<IInvitation>(
    {
        tripId: {
            // Note: tripId is an ObjectId because it references the Trip document in MongoDB.
            // toUserId and fromUserId use strings (Firebase UID) because Firebase UID is the 
            // canonical identity for users across the system.
            type: Schema.Types.ObjectId,
            ref: 'Trip',
            required: true,
            index: true,
        },
        tripTitle: {
            type: String,
            required: true,
        },
        fromUserId: {
            type: String,
            required: true,
            index: true,
        },
        fromName: {
            type: String,
            required: true,
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
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined', 'expired'],
            default: 'pending',
            index: true,
        },
        message: {
            type: String,
            maxlength: 500,
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

// Index for finding pending invitations for a user
invitationSchema.index({ toUserId: 1, status: 1 });
invitationSchema.index({ tripId: 1, toUserId: 1 }, { unique: true }); // One invite per user per trip

export const Invitation = model<IInvitation>('Invitation', invitationSchema);