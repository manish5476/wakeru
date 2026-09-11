import { Schema, model, Document, Types, Model } from 'mongoose';
import { ILimitConfig } from './plan.model';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete';

export type SubscriptionProvider =
  | 'stripe'
  | 'razorpay'
  | 'in_app_purchase'
  | 'manual_admin'
  | 'mock';

export interface ISubscriptionSnapshot {
  key: string;
  name: string;
  pricing: {
    amount: number;
    currency: string;
    billingInterval: string;
  };
  limits: Record<string, ILimitConfig>;
  features: Record<string, boolean>;
}

export interface ISubscription extends Document {
  userId: string;                   // Firebase UID (indexed)
  planId: Types.ObjectId;           // Reference to Plan
  planKey: string;                  // e.g. 'pro', 'super_pro'
  status: SubscriptionStatus;

  // Historical snapshot captured at purchase/renewal time
  planSnapshot: ISubscriptionSnapshot;

  provider: SubscriptionProvider;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerPaymentId?: string;

  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  expiresAt?: Date;
  canceledAt?: Date;
  cancelAtPeriodEnd: boolean;
  autoRenew: boolean;

  entitlementPolicy: 'dynamic_latest' | 'locked_snapshot';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  isActive(): boolean;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
      index: true,
    },
    planKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceled', 'expired', 'incomplete'],
      required: true,
      default: 'active',
      index: true,
    },
    planSnapshot: {
      key: { type: String, required: true },
      name: { type: String, required: true },
      pricing: {
        amount: { type: Number, required: true },
        currency: { type: String, required: true },
        billingInterval: { type: String, required: true },
      },
      limits: { type: Schema.Types.Mixed, default: {} },
      features: { type: Schema.Types.Mixed, default: {} },
    },
    provider: {
      type: String,
      enum: ['stripe', 'razorpay', 'in_app_purchase', 'manual_admin', 'mock'],
      required: true,
      default: 'mock',
    },
    providerCustomerId: { type: String, default: null },
    providerSubscriptionId: { type: String, default: null, index: true },
    providerPaymentId: { type: String, default: null },

    startedAt: { type: Date, default: Date.now },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
      index: true,
    },
    expiresAt: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    autoRenew: { type: Boolean, default: true },

    entitlementPolicy: {
      type: String,
      enum: ['dynamic_latest', 'locked_snapshot'],
      default: 'dynamic_latest',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ userId: 1, currentPeriodEnd: -1 });

SubscriptionSchema.methods.isActive = function (): boolean {
  if (this.status !== 'active' && this.status !== 'trialing') {
    return false;
  }
  if (this.currentPeriodEnd && new Date(this.currentPeriodEnd).getTime() < Date.now()) {
    return false;
  }
  return true;
};

export const Subscription: Model<ISubscription> = model<ISubscription>(
  'Subscription',
  SubscriptionSchema
);
