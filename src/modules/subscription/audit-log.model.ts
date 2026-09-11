import { Schema, model, Document, Model } from 'mongoose';

export interface ISubscriptionAuditLog extends Document {
  actorUserId: string;       // Admin userId or 'system'
  targetType: 'plan' | 'subscription' | 'override';
  targetId: string;          // Plan ID, Subscription ID, or User ID
  action:
    | 'create_plan'
    | 'update_plan'
    | 'archive_plan'
    | 'price_change'
    | 'limit_change'
    | 'feature_change'
    | 'grant_subscription'
    | 'cancel_subscription'
    | 'expire_subscription';
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  reason?: string;
  ipAddress?: string;
  createdAt: Date;
}

const SubscriptionAuditLogSchema = new Schema<ISubscriptionAuditLog>(
  {
    actorUserId: { type: String, required: true, index: true },
    targetType: {
      type: String,
      enum: ['plan', 'subscription', 'override'],
      required: true,
      index: true,
    },
    targetId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    beforeState: { type: Schema.Types.Mixed, default: null },
    afterState: { type: Schema.Types.Mixed, default: null },
    reason: { type: String, default: null },
    ipAddress: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

SubscriptionAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const SubscriptionAuditLog: Model<ISubscriptionAuditLog> = model<ISubscriptionAuditLog>(
  'SubscriptionAuditLog',
  SubscriptionAuditLogSchema
);
