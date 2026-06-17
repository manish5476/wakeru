import { Schema, model, Document, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'initiated' | 'confirmed' | 'disputed';

export interface ISettlementTransaction {
  _id?: Types.ObjectId;
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
