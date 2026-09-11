import { Schema, model, Document, Model } from 'mongoose';

export interface IUsageCounter extends Document {
  userId: string;
  key: string;            // 'monthlyExports', 'monthlyReceiptOCR', etc.
  periodKey: string;      // e.g. '2026-09' (YYYY-MM) or 'lifetime'
  count: number;
  updatedAt: Date;
}

const UsageCounterSchema = new Schema<IUsageCounter>(
  {
    userId: { type: String, required: true, index: true },
    key: { type: String, required: true, index: true },
    periodKey: { type: String, required: true, index: true },
    count: { type: Number, required: true, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

UsageCounterSchema.index({ userId: 1, key: 1, periodKey: 1 }, { unique: true });

export const UsageCounter: Model<IUsageCounter> = model<IUsageCounter>(
  'UsageCounter',
  UsageCounterSchema
);

/**
 * Utility to get current period key e.g. "2026-09"
 */
export function getCurrentPeriodKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
