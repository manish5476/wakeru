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
  disputedAt?: Date;
  disputedBy?: string;
  disputeReason?: string;
  // Explains WHY this transfer exists (for multi-hop netting transparency)
  explanation?: string[];
}

export interface ISettlementHistory {
  action: 'calculated' | 'payment_initiated' | 'payment_confirmed' | 'payment_disputed' | 'payment_retried';
  actorUid: string;
  actorName?: string;
  transactionId?: Types.ObjectId;
  amount?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ISettlement extends Document {
  isFullySettled: boolean;
  tripId: Types.ObjectId;
  baseCurrency: string;
  transactions: ISettlementTransaction[];
  totalTransactions: number;
  calculatedAt: Date;
  isStale: boolean;
  history: ISettlementHistory[];
  createdAt: Date;
  updatedAt: Date;
  // Virtuals
  totalAmount: number;
  pendingCount: number;
  initiatedCount: number;
  confirmedCount: number;
  disputedCount: number;
  settlementProgress: number;
}

// ============================================================
// SUB-SCHEMAS
// ============================================================

const transactionSchema = new Schema<ISettlementTransaction>(
  {
    from: { type: String, required: true, index: true },
    fromName: { type: String, required: true },
    to: { type: String, required: true, index: true },
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
    disputedAt: { type: Date },
    disputedBy: { type: String },
    disputeReason: { type: String, maxlength: 500 },
    explanation: [{ type: String }],
  },
  { _id: true }
);

const settlementHistorySchema = new Schema<ISettlementHistory>(
  {
    action: {
      type: String,
      enum: ['calculated', 'payment_initiated', 'payment_confirmed', 'payment_disputed', 'payment_retried'],
      required: true,
    },
    actorUid: { type: String, required: true },
    actorName: { type: String },
    transactionId: { type: Schema.Types.ObjectId },
    amount: { type: Number },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
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
      unique: true,
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
    history: {
      type: [settlementHistorySchema],
      default: [],
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
// INDEXES
// ============================================================

settlementSchema.index({ tripId: 1, 'transactions.status': 1 });
settlementSchema.index({ 'transactions.from': 1, 'transactions.status': 1 });
settlementSchema.index({ 'transactions.to': 1, 'transactions.status': 1 });

// ============================================================
// VIRTUALS
// ============================================================

settlementSchema.virtual('totalAmount').get(function () {
  return this.transactions.reduce((sum, t) => sum + t.amountBase, 0);
});

settlementSchema.virtual('pendingCount').get(function () {
  return this.transactions.filter((t) => t.status === 'pending').length;
});

settlementSchema.virtual('initiatedCount').get(function () {
  return this.transactions.filter((t) => t.status === 'initiated').length;
});

settlementSchema.virtual('confirmedCount').get(function () {
  return this.transactions.filter((t) => t.status === 'confirmed').length;
});

settlementSchema.virtual('disputedCount').get(function () {
  return this.transactions.filter((t) => t.status === 'disputed').length;
});

settlementSchema.virtual('isFullySettled').get(function () {
  return this.transactions.length > 0 && this.transactions.every((t) => t.status === 'confirmed');
});

settlementSchema.virtual('settlementProgress').get(function () {
  if (this.transactions.length === 0) return 0;
  const confirmed = this.transactions.filter((t) => t.status === 'confirmed').length;
  return parseFloat(((confirmed / this.transactions.length) * 100).toFixed(1));
});

// ============================================================
// PRE-SAVE HOOK
// ============================================================

settlementSchema.pre('save', function (next) {
  this.totalTransactions = this.transactions.length;
  next();
});

// ============================================================
// EXPORT
// ============================================================

export const Settlement = model<ISettlement>('Settlement', settlementSchema);


// import { Schema, model, Document, Types } from 'mongoose';

// // ============================================================
// // TYPES
// // ============================================================

// export type PaymentStatus = 'pending' | 'initiated' | 'confirmed' | 'disputed';

// export interface ISettlementTransaction {
//   from: string;           // Firebase UID — who pays
//   fromName: string;       // Denormalized
//   to: string;             // Firebase UID — who receives
//   toName: string;         // Denormalized
//   amountBase: number;     // Amount in trip's baseCurrency
//   baseCurrency: string;
//   status: PaymentStatus;
//   upiDeepLink?: string;
//   paymentId?: Types.ObjectId;
//   initiatedAt?: Date;
//   confirmedAt?: Date;
// }

// export interface ISettlement extends Document {
//   tripId: Types.ObjectId;
//   baseCurrency: string;
//   transactions: ISettlementTransaction[];
//   totalTransactions: number;
//   calculatedAt: Date;
//   isStale: boolean;       // True when an expense changes after calculation
//   createdAt: Date;
//   updatedAt: Date;
// }

// // ============================================================
// // SUB-SCHEMA: Transaction
// // ============================================================

// const transactionSchema = new Schema<ISettlementTransaction>(
//   {
//     from: { type: String, required: true },
//     fromName: { type: String, required: true },
//     to: { type: String, required: true },
//     toName: { type: String, required: true },
//     amountBase: { type: Number, required: true, min: 0 },
//     baseCurrency: { type: String, required: true, uppercase: true },
//     status: {
//       type: String,
//       enum: ['pending', 'initiated', 'confirmed', 'disputed'],
//       default: 'pending',
//     },
//     upiDeepLink: { type: String },
//     paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
//     initiatedAt: { type: Date },
//     confirmedAt: { type: Date },
//   },
//   { _id: true } // Each transaction needs its own _id for reference
// );

// // ============================================================
// // MAIN SCHEMA: Settlement
// // ============================================================

// const settlementSchema = new Schema<ISettlement>(
//   {
//     tripId: {
//       type: Schema.Types.ObjectId,
//       ref: 'Trip',
//       required: true,
//       unique: true, // One settlement per trip
//       index: true,
//     },
//     baseCurrency: {
//       type: String,
//       required: true,
//       uppercase: true,
//     },
//     transactions: {
//       type: [transactionSchema],
//       default: [],
//     },
//     totalTransactions: {
//       type: Number,
//       default: 0,
//     },
//     calculatedAt: {
//       type: Date,
//       default: Date.now,
//     },
//     isStale: {
//       type: Boolean,
//       default: false,
//       index: true,
//     },
//   },
//   {
//     timestamps: true,
//     versionKey: false,
//     toJSON: { virtuals: true },
//     toObject: { virtuals: true },
//   }
// );

// // ============================================================
// // VIRTUALS
// // ============================================================

// settlementSchema.virtual('totalAmount').get(function () {
//   return this.transactions.reduce((sum, t) => sum + t.amountBase, 0);
// });

// settlementSchema.virtual('pendingCount').get(function () {
//   return this.transactions.filter((t) => t.status === 'pending').length;
// });

// settlementSchema.virtual('confirmedCount').get(function () {
//   return this.transactions.filter((t) => t.status === 'confirmed').length;
// });

// settlementSchema.virtual('isFullySettled').get(function () {
//   return this.transactions.every((t) => t.status === 'confirmed');
// });

// // ============================================================
// // EXPORT
// // ============================================================

// export const Settlement = model<ISettlement>('Settlement', settlementSchema);
