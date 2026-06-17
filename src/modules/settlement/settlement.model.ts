import { Schema, model, Document, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'initiated' | 'confirmed' | 'disputed';

export interface ISettlementTransaction {
  from: string;        // Firebase UID — who pays
  fromName: string;
  to: string;          // Firebase UID — who receives
  toName: string;
  amountBase: number;  // amount in trip baseCurrency
  baseCurrency: string;
  status: PaymentStatus;
  upiDeepLink?: string;
  paymentId?: Types.ObjectId;
  initiatedAt?: Date;
  confirmedAt?: Date;
}

export interface ISettlement extends Document {
  tripId: Types.ObjectId;
  transactions: ISettlementTransaction[];
  totalTransactions: number;
  calculatedAt: Date;
  isStale: boolean;    // true when any expense changes after this was computed
  createdAt: Date;
  updatedAt: Date;
}

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
  { _id: true }
);

const settlementSchema = new Schema<ISettlement>(
  {
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    transactions: { type: [transactionSchema], default: [] },
    totalTransactions: { type: Number, default: 0 },
    calculatedAt: { type: Date, default: Date.now },
    isStale: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false }
);

export const Settlement = model<ISettlement>('Settlement', settlementSchema);

// import mongoose, { Schema, Document } from 'mongoose';
// import crypto from 'crypto';

// export interface ISettlementDocument extends Document {
//   settlementId: string;
//   groupId: mongoose.Types.ObjectId;
//   fromUser: mongoose.Types.ObjectId;
//   toUser: mongoose.Types.ObjectId;
//   amount: mongoose.Types.Decimal128;
//   currency: string;
//   expenses: mongoose.Types.ObjectId[];
//   paymentMethod: string;
//   paymentDetails?: {
//     transactionId?: string;
//     upiReference?: string;
//     bankReference?: string;
//     walletTransactionId?: string;
//     paymentGateway: string;
//     paidAt: Date;
//   };
//   status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
//   statusHistory: Array<{
//     status: string;
//     timestamp: Date;
//     updatedBy: mongoose.Types.ObjectId;
//     remarks?: string;
//   }>;
//   notes?: string;
//   createdBy: mongoose.Types.ObjectId;
//   settlementDate: Date;
//   completedAt?: Date;
//   idempotencyKey: string;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const SettlementSchema = new Schema<ISettlementDocument>({
//   settlementId: {
//     type: String,
//     required: true,
//     unique: true,
//     default: () => crypto.randomUUID()
//   },
//   groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
//   fromUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//   toUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//   amount: { type: Schema.Types.Decimal128, required: true },
//   currency: { type: String, required: true, default: 'INR' },
//   expenses: [{ type: Schema.Types.ObjectId, ref: 'Expense' }],
//   paymentMethod: { type: String, required: true },
//   paymentDetails: {
//     transactionId: String,
//     upiReference: String,
//     bankReference: String,
//     walletTransactionId: String,
//     paymentGateway: String,
//     paidAt: Date
//   },
//   status: {
//     type: String,
//     enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
//     default: 'PENDING'
//   },
//   statusHistory: [{
//     status: String,
//     timestamp: { type: Date, default: Date.now },
//     updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
//     remarks: String
//   }],
//   notes: String,
//   createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//   settlementDate: { type: Date, default: Date.now },
//   completedAt: Date,
//   idempotencyKey: { type: String, required: true, unique: true }
// }, {
//   timestamps: true
// });

// // Indexes
// SettlementSchema.index({ groupId: 1, status: 1 });
// SettlementSchema.index({ fromUser: 1, status: 1 });
// SettlementSchema.index({ toUser: 1, status: 1 });
// SettlementSchema.index({ idempotencyKey: 1 });
// SettlementSchema.index({ settlementDate: -1 });

// export const Settlement = mongoose.model<ISettlementDocument>('Settlement', SettlementSchema);