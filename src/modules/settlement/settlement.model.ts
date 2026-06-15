import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface ISettlementDocument extends Document {
  settlementId: string;
  groupId: mongoose.Types.ObjectId;
  fromUser: mongoose.Types.ObjectId;
  toUser: mongoose.Types.ObjectId;
  amount: mongoose.Types.Decimal128;
  currency: string;
  expenses: mongoose.Types.ObjectId[];
  paymentMethod: string;
  paymentDetails?: {
    transactionId?: string;
    upiReference?: string;
    bankReference?: string;
    walletTransactionId?: string;
    paymentGateway: string;
    paidAt: Date;
  };
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    updatedBy: mongoose.Types.ObjectId;
    remarks?: string;
  }>;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  settlementDate: Date;
  completedAt?: Date;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettlementSchema = new Schema<ISettlementDocument>({
  settlementId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => crypto.randomUUID()
  },
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  fromUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  toUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Schema.Types.Decimal128, required: true },
  currency: { type: String, required: true, default: 'INR' },
  expenses: [{ type: Schema.Types.ObjectId, ref: 'Expense' }],
  paymentMethod: { type: String, required: true },
  paymentDetails: {
    transactionId: String,
    upiReference: String,
    bankReference: String,
    walletTransactionId: String,
    paymentGateway: String,
    paidAt: Date
  },
  status: { 
    type: String, 
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    remarks: String
  }],
  notes: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  settlementDate: { type: Date, default: Date.now },
  completedAt: Date,
  idempotencyKey: { type: String, required: true, unique: true }
}, {
  timestamps: true
});

// Indexes
SettlementSchema.index({ groupId: 1, status: 1 });
SettlementSchema.index({ fromUser: 1, status: 1 });
SettlementSchema.index({ toUser: 1, status: 1 });
SettlementSchema.index({ idempotencyKey: 1 });
SettlementSchema.index({ settlementDate: -1 });

export const Settlement = mongoose.model<ISettlementDocument>('Settlement', SettlementSchema);