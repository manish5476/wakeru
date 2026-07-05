// finance.model.ts
import { Schema, model, Document, Types } from 'mongoose';

// ============================================================
// TYPES
// ============================================================

export type TransactionType = 'income' | 'expense' | 'transfer';
export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';
export type PaymentMethod = 'Cash' | 'Card' | 'UPI' | 'Net Banking' | 'Other';

export interface ITransaction extends Document {
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  title: string;
  category: string;
  date: Date;
  time?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  receiptImage?: string;
  tags: string[];
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
  tripId?: Types.ObjectId;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryBudget {
  category: string;
  amount: number;
  spent: number;
}

export interface IBudget extends Document {
  userId: string;
  month: string;
  totalBudget: number;
  categoryBudgets: ICategoryBudget[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IBill extends Document {
  userId: string;
  title: string;
  amount: number;
  dueDate: Date;
  frequency: RecurringFrequency;
  category: string;
  autoPay: boolean;
  isActive: boolean;
  paidThisMonth: boolean;
  lastPaidDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGoal extends Document {
  userId: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: Date;
  isCompleted: boolean;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// SCHEMAS
// ============================================================

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now },
    time: { type: String },
    paymentMethod: { type: String, enum: ['Cash', 'Card', 'UPI', 'Net Banking', 'Other'], required: true },
    notes: { type: String },
    receiptImage: { type: String },
    tags: { type: [String], default: [] },
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: { type: String, enum: ['weekly', 'monthly', 'yearly'] },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      name: { type: String },
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1 });
transactionSchema.index({ userId: 1, type: 1 });

const categoryBudgetSchema = new Schema<ICategoryBudget>(
  {
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    spent: { type: Number, default: 0 },
  },
  { _id: false }
);

const budgetSchema = new Schema<IBudget>(
  {
    userId: { type: String, required: true, index: true },
    month: { type: String, required: true },
    totalBudget: { type: Number, required: true, min: 0 },
    categoryBudgets: { type: [categoryBudgetSchema], default: [] },
  },
  { timestamps: true }
);

budgetSchema.index({ userId: 1, month: 1 }, { unique: true });

const billSchema = new Schema<IBill>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    frequency: { type: String, enum: ['weekly', 'monthly', 'yearly'], required: true },
    category: { type: String, required: true },
    autoPay: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    paidThisMonth: { type: Boolean, default: false },
    lastPaidDate: { type: Date },
  },
  { timestamps: true }
);

const goalSchema = new Schema<IGoal>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true, min: 0 },
    savedAmount: { type: Number, default: 0, min: 0 },
    targetDate: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false },
    progress: { type: Number, default: 0 },
  },
  { timestamps: true }
);

goalSchema.pre('save', function (next) {
  if (this.targetAmount > 0) {
    this.progress = (this.savedAmount / this.targetAmount) * 100;
  }
  next();
});

// ============================================================
// MODELS
// ============================================================

export const Transaction = model<ITransaction>('Transaction', transactionSchema);
export const Budget = model<IBudget>('Budget', budgetSchema);
export const Bill = model<IBill>('Bill', billSchema);
export const Goal = model<IGoal>('Goal', goalSchema);
