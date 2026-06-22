import { Schema, model, Document } from 'mongoose';

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface IJoinRequest extends Document {
    tripId: Schema.Types.ObjectId;
    tripTitle: string;
    userId: string;         // Firebase UID of the requester (matches _id)
    userName: string;
    photoURL?: string;
    status: JoinRequestStatus;
    createdAt: Date;
    updatedAt: Date;
    respondedAt?: Date;
    respondedBy?: string;   // Firebase UID of admin who responded
}

const joinRequestSchema = new Schema<IJoinRequest>(
    {
        tripId: {
            type: Schema.Types.ObjectId,
            ref: 'Trip',
            required: true,
            index: true,
        },
        tripTitle: {
            type: String,
            required: true,
        },
        userId: {
            type: String,
            required: true,
            index: true,
        },
        userName: {
            type: String,
            required: true,
        },
        photoURL: {
            type: String,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true,
        },
        respondedAt: {
            type: Date,
        },
        respondedBy: {
            type: String,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// One pending request per user per trip
joinRequestSchema.index({ tripId: 1, userId: 1 }, { unique: true });

export const JoinRequest = model<IJoinRequest>('JoinRequest', joinRequestSchema);
