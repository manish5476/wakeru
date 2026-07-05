import { Schema, model, Document, Types } from 'mongoose';

export type ReminderType =
    | 'settlement'
    | 'payment'
    | 'budget'
    | 'custom'
    | 'expense_added'
    | 'expense_updated'
    | 'trip_created'
    | 'trip_ending'
    | 'bill_due'
    | 'goal_target'
    | 'friend_request';

export type ReminderFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom_days';
export type ReminderStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type ReminderChannel = 'in_app' | 'push' | 'email' | 'sms' | 'all';

export interface IReminder extends Document {
    // Core fields
    userId: string;                    // Who created the reminder (Firebase UID)
    targetUserId?: string;             // Who needs to be reminded (Firebase UID)
    targetUserName?: string;           // Denormalized for display

    // Trip/Expense linkage
    tripId?: Types.ObjectId;
    tripName?: string;                 // Denormalized
    expenseId?: Types.ObjectId;
    expenseTitle?: string;             // Denormalized
    settlementId?: Types.ObjectId;
    financeTransactionId?: Types.ObjectId;

    // Reminder details
    type: ReminderType;
    title: string;
    message: string;
    frequency: ReminderFrequency;
    customDays?: number;

    // Timing
    nextTriggerAt: Date;
    lastTriggeredAt?: Date;
    triggerCount: number;              // How many times triggered
    maxTriggers?: number;              // Max triggers before auto-complete

    // Escalation
    escalationLevel: number;           // 0=gentle, 1=firm, 2=urgent, 3=group_notify
    escalationInterval: number;        // Days between escalations
    escalateToGroup: boolean;          // Notify trip members at max escalation

    // Channels
    channels: {
        inApp: boolean;
        push: boolean;
        email: boolean;
        sms: boolean;
    };

    // Status
    status: ReminderStatus;
    completedAt?: Date;
    cancelledAt?: Date;
    cancelledReason?: string;

    // Metadata
    metadata?: Record<string, any>;
    tags: string[];

    createdAt: Date;
    updatedAt: Date;
}

// ============================================================
// SCHEMA
// ============================================================

const reminderSchema = new Schema<IReminder>(
    {
        // Core
        userId: { type: String, required: true, index: true },
        targetUserId: { type: String, index: true },
        targetUserName: { type: String },

        // Trip/Expense linkage
        tripId: { type: Schema.Types.ObjectId, ref: 'Trip', index: true },
        tripName: { type: String },
        expenseId: { type: Schema.Types.ObjectId, ref: 'Expense' },
        expenseTitle: { type: String },
        settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement' },
        financeTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },

        // Details
        type: {
            type: String,
            enum: [
                'settlement', 'payment', 'budget', 'custom',
                'expense_added', 'expense_updated', 'trip_created',
                'trip_ending', 'bill_due', 'goal_target', 'friend_request',
            ],
            required: true,
            index: true,
        },
        title: { type: String, required: true, maxlength: 200 },
        message: { type: String, required: true, maxlength: 500 },
        frequency: {
            type: String,
            enum: ['once', 'daily', 'weekly', 'monthly', 'custom_days'],
            default: 'once',
        },
        customDays: { type: Number, min: 1, max: 30 },

        // Timing
        nextTriggerAt: { type: Date, required: true, index: true },
        lastTriggeredAt: { type: Date },
        triggerCount: { type: Number, default: 0 },
        maxTriggers: { type: Number, default: 10 },

        // Escalation
        escalationLevel: { type: Number, default: 0, min: 0, max: 3 },
        escalationInterval: { type: Number, default: 3, min: 1, max: 30 },
        escalateToGroup: { type: Boolean, default: false },

        // Channels
        channels: {
            inApp: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            sms: { type: Boolean, default: false },
        },

        // Status
        status: {
            type: String,
            enum: ['active', 'paused', 'completed', 'cancelled'],
            default: 'active',
            index: true,
        },
        completedAt: { type: Date },
        cancelledAt: { type: Date },
        cancelledReason: { type: String },

        // Extra
        metadata: { type: Schema.Types.Mixed },
        tags: { type: [String], default: [] },
    },
    { timestamps: true, versionKey: false }
);

// Indexes
reminderSchema.index({ userId: 1, status: 1, nextTriggerAt: 1 });
reminderSchema.index({ targetUserId: 1, status: 1 });
reminderSchema.index({ tripId: 1, type: 1 });
reminderSchema.index({ status: 1, nextTriggerAt: 1 }); // Cron query

// Virtual: is overdue
reminderSchema.virtual('isOverdue').get(function () {
    return this.status === 'active' && this.nextTriggerAt < new Date();
});

// Virtual: days until next trigger
reminderSchema.virtual('daysUntilNextTrigger').get(function () {
    const diff = this.nextTriggerAt.getTime() - Date.now();
    return Math.ceil(diff / 86400000);
});

export const Reminder = model<IReminder>('Reminder', reminderSchema);