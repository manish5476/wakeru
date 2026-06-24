import { Schema, model, Document, Types } from 'mongoose';

export type ReminderType = 'settlement' | 'payment' | 'budget' | 'custom';
export type ReminderFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom_days';
export type ReminderStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface IReminder extends Document {
    userId: string;              // Who created the reminder
    targetUserId?: string;       // Who needs to pay (for payment reminders)
    tripId?: Types.ObjectId;
    type: ReminderType;
    title: string;
    message: string;
    frequency: ReminderFrequency;
    customDays?: number;         // For custom_days (every X days)
    nextTriggerAt: Date;
    lastTriggeredAt?: Date;
    escalationLevel: number;     // 0=gentle, 1=firm, 2=urgent, 3=group_notify
    escalationInterval: number;  // Days between escalations
    status: ReminderStatus;
    createdAt: Date;
    updatedAt: Date;
}

const reminderSchema = new Schema<IReminder>(
    {
        userId: { type: String, required: true, index: true },
        targetUserId: { type: String, index: true },
        tripId: { type: Schema.Types.ObjectId, ref: 'Trip', index: true },
        type: {
            type: String,
            enum: ['settlement', 'payment', 'budget', 'custom',''],
            required: true,
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        frequency: {
            type: String,
            enum: ['once', 'daily', 'weekly', 'monthly', 'custom_days'],
            default: 'once',
        },
        customDays: { type: Number },
        nextTriggerAt: { type: Date, required: true, index: true },
        lastTriggeredAt: { type: Date },
        escalationLevel: { type: Number, default: 0, min: 0, max: 3 },
        escalationInterval: { type: Number, default: 3 },
        status: {
            type: String,
            enum: ['active', 'paused', 'completed', 'cancelled'],
            default: 'active',
            index: true,
        },
    },
    { timestamps: true, versionKey: false }
);

reminderSchema.index({ status: 1, nextTriggerAt: 1 });

export const Reminder = model<IReminder>('Reminder', reminderSchema);