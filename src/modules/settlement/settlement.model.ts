import { Schema, model, Document, Types } from 'mongoose';

// ============================================================
// TYPES
// ============================================================

export type PaymentStatus = 'pending' | 'initiated' | 'confirmed' | 'disputed';

export interface ISettlementTransaction {
  from: string;           // Firebase UID — who pays
  fromName: string;       // Denormalized
  to: string;             // Firebase UID — who receives
  toName: string;         // Denormalized
  amountBase: number;     // Amount in trip's baseCurrency
  baseCurrency: string;
  status: PaymentStatus;
  upiDeepLink?: string;
  paymentId?: Types.ObjectId;
  initiatedAt?: Date;
  confirmedAt?: Date;
}

export interface ISettlement extends Document {
  tripId: Types.ObjectId;
  baseCurrency: string;
  transactions: ISettlementTransaction[];
  totalTransactions: number;
  calculatedAt: Date;
  isStale: boolean;       // True when an expense changes after calculation
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// SUB-SCHEMA: Transaction
// ============================================================

const transactionSchema = new Schema<ISettlementTransaction>(
  {
    from: { type: String, required: true },
    fromName: { type: String, required: true },
    to: { type: String, required: true },
    toName: { type: String, required: true },
    amountBase: { type: Number, required: true, min: 0 },
    baseCurrency: { type: String, required: true, uppercase: true },
    status: {
      type: String,
      enum: ['pending', 'initiated', 'confirmed', 'disputed'],
      default: 'pending',
    },
    upiDeepLink: { type: String },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    initiatedAt: { type: Date },
    confirmedAt: { type: Date },
  },
  { _id: true } // Each transaction needs its own _id for reference
);

// ============================================================
// MAIN SCHEMA: Settlement
// ============================================================

const settlementSchema = new Schema<ISettlement>(
  {
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      unique: true, // One settlement per trip
      index: true,
    },
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
    },
    transactions: {
      type: [transactionSchema],
      default: [],
    },
    totalTransactions: {
      type: Number,
      default: 0,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
    isStale: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================================
// VIRTUALS
// ============================================================

settlementSchema.virtual('totalAmount').get(function () {
  return this.transactions.reduce((sum, t) => sum + t.amountBase, 0);
});

settlementSchema.virtual('pendingCount').get(function () {
  return this.transactions.filter((t) => t.status === 'pending').length;
});

settlementSchema.virtual('confirmedCount').get(function () {
  return this.transactions.filter((t) => t.status === 'confirmed').length;
});

settlementSchema.virtual('isFullySettled').get(function () {
  return this.transactions.every((t) => t.status === 'confirmed');
});

// ============================================================
// EXPORT
// ============================================================

export const Settlement = model<ISettlement>('Settlement', settlementSchema);