import { Schema, model, Document, Model } from 'mongoose';

export interface ILimitConfig {
  value: number | null; // null represents explicit UNLIMITED
  unlimited: boolean;
  unit?: string;        // 'per account', 'per trip', 'per month', etc.
}

export interface IPlanPricing {
  amount: number;       // e.g. 0 for Free, 499 for Pro, 1499 for Super Pro
  currency: string;     // 'INR', 'USD', etc.
  billingInterval: 'free' | 'month' | 'year' | 'lifetime';
}

export interface IPlan extends Document {
  key: string;              // unique plan identifier: 'free', 'pro', 'super_pro', 'business', etc.
  name: string;             // 'Free', 'Pro Explorer', 'Super Pro Nomad'
  description: string;
  status: 'active' | 'draft' | 'archived';
  pricing: IPlanPricing;
  features: Map<string, boolean> | Record<string, boolean>;
  limits: Map<string, ILimitConfig> | Record<string, ILimitConfig>;
  permissions: string[];
  metadata: Record<string, any>;
  displayOrder: number;
  isDefault: boolean;       // true for the default Free fallback plan
  isPublic: boolean;        // visible in user-facing pricing comparison
  createdAt: Date;
  updatedAt: Date;
}

const LimitConfigSchema = new Schema<ILimitConfig>(
  {
    value: { type: Number, default: null },
    unlimited: { type: Boolean, default: false },
    unit: { type: String, default: 'per account' },
  },
  { _id: false }
);

const PlanPricingSchema = new Schema<IPlanPricing>(
  {
    amount: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, required: true, default: 'INR', uppercase: true },
    billingInterval: {
      type: String,
      enum: ['free', 'month', 'year', 'lifetime'],
      required: true,
      default: 'month',
    },
  },
  { _id: false }
);

const PlanSchema = new Schema<IPlan>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'draft', 'archived'],
      default: 'active',
      index: true,
    },
    pricing: { type: PlanPricingSchema, required: true },
    features: {
      type: Map,
      of: Boolean,
      default: {},
    },
    limits: {
      type: Map,
      of: LimitConfigSchema,
      default: {},
    },
    permissions: {
      type: [String],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    displayOrder: { type: Number, default: 0, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    isPublic: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        // Convert Mongoose Maps to plain JS objects for clean JSON API contracts
        if (ret.features instanceof Map) {
          ret.features = Object.fromEntries(ret.features);
        }
        if (ret.limits instanceof Map) {
          ret.limits = Object.fromEntries(ret.limits);
        }
        return ret;
      },
    },
  }
);

export const Plan: Model<IPlan> = model<IPlan>('Plan', PlanSchema);

/**
 * Seed initial default plans dynamically if none exist in the database.
 * Admins can later modify any of these values without requiring code changes.
 */
export async function seedDefaultPlans(): Promise<void> {
  const existingCount = await Plan.countDocuments();
  if (existingCount > 0) {
    return;
  }

  const defaultPlans = [
    {
      key: 'free',
      name: 'Free Traveler',
      description: 'Essential split ledger for casual trips with close friends and family.',
      status: 'active',
      isDefault: true,
      isPublic: true,
      displayOrder: 1,
      pricing: {
        amount: 0,
        currency: 'INR',
        billingInterval: 'free',
      },
      limits: {
        trips: { value: 5, unlimited: false, unit: 'trips per account' },
        peoplePerTrip: { value: 10, unlimited: false, unit: 'travelers per trip' },
        stopsPerTrip: { value: 5, unlimited: false, unit: 'stops per itinerary' },
        expensesPerTrip: { value: null, unlimited: true, unit: 'unlimited expenses' },
        monthlyExports: { value: 1, unlimited: false, unit: 'exports per month' },
        monthlyReceiptOCR: { value: 3, unlimited: false, unit: 'scans per month' },
      },
      features: {
        trip_creation: true,
        advanced_analytics: false,
        custom_trip_cover: false,
        expense_export: false,
        receipt_ocr: true,
        recurring_expenses: false,
        priority_support: false,
      },
    },
    {
      key: 'pro',
      name: 'Pro Explorer',
      description: 'Ideal for frequent travelers, travel planners, and larger groups.',
      status: 'active',
      isDefault: false,
      isPublic: true,
      displayOrder: 2,
      pricing: {
        amount: 399,
        currency: 'INR',
        billingInterval: 'month',
      },
      limits: {
        trips: { value: 50, unlimited: false, unit: 'trips per account' },
        peoplePerTrip: { value: 50, unlimited: false, unit: 'travelers per trip' },
        stopsPerTrip: { value: 25, unlimited: false, unit: 'stops per itinerary' },
        expensesPerTrip: { value: null, unlimited: true, unit: 'unlimited expenses' },
        monthlyExports: { value: 25, unlimited: false, unit: 'exports per month' },
        monthlyReceiptOCR: { value: 30, unlimited: false, unit: 'scans per month' },
      },
      features: {
        trip_creation: true,
        advanced_analytics: true,
        custom_trip_cover: true,
        expense_export: true,
        receipt_ocr: true,
        recurring_expenses: true,
        priority_support: false,
      },
    },
    {
      key: 'super_pro',
      name: 'Super Pro Nomad',
      description: 'Uncapped power for digital nomads, tour organizers, and global expeditions.',
      status: 'active',
      isDefault: false,
      isPublic: true,
      displayOrder: 3,
      pricing: {
        amount: 899,
        currency: 'INR',
        billingInterval: 'month',
      },
      limits: {
        trips: { value: null, unlimited: true, unit: 'unlimited trips' },
        peoplePerTrip: { value: 200, unlimited: false, unit: 'travelers per trip' },
        stopsPerTrip: { value: 100, unlimited: false, unit: 'stops per itinerary' },
        expensesPerTrip: { value: null, unlimited: true, unit: 'unlimited expenses' },
        monthlyExports: { value: null, unlimited: true, unit: 'unlimited exports' },
        monthlyReceiptOCR: { value: null, unlimited: true, unit: 'unlimited scans' },
      },
      features: {
        trip_creation: true,
        advanced_analytics: true,
        custom_trip_cover: true,
        expense_export: true,
        receipt_ocr: true,
        recurring_expenses: true,
        priority_support: true,
      },
    },
  ];

  await Plan.insertMany(defaultPlans);
}
