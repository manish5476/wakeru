import { Schema, model, Document, Types } from 'mongoose';

// ============================================================
// TRANSACTION MODEL
// ============================================================

export type TransactionType = 'income' | 'expense' | 'transfer';
export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export interface ITransaction extends Document {
  userId: string; // Firebase UID
  type: TransactionType;
  amount: number;
  currency: string;
  title: string;
  category: string; // Default or custom category
  date: Date;
  time?: string;
  paymentMethod: string;
  notes?: string;
  receiptImage?: string;
  tags: string[];
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
  tripId?: Types.ObjectId; // If linked to a trip split
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

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
    paymentMethod: { type: String, required: true },
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
  },
  { timestamps: true }
);

// ============================================================
// BUDGET MODEL
// ============================================================

export interface ICategoryBudget {
  category: string;
  amount: number;
}

export interface IBudget extends Document {
  userId: string;
  month: string; // e.g. "2026-06"
  totalBudget: number;
  categoryBudgets: ICategoryBudget[];
  createdAt: Date;
  updatedAt: Date;
}

const categoryBudgetSchema = new Schema<ICategoryBudget>(
  {
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
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

// Ensure only one budget per user per month
budgetSchema.index({ userId: 1, month: 1 }, { unique: true });

// ============================================================
// BILL MODEL
// ============================================================

export interface IBill extends Document {
  userId: string;
  title: string;
  amount: number;
  dueDate: Date;
  frequency: RecurringFrequency;
  category: string;
  autoPay: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true }
);

// ============================================================
// SAVINGS GOAL MODEL
// ============================================================

export interface IGoal extends Document {
  userId: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: Date;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<IGoal>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true, min: 0 },
    savedAmount: { type: Number, default: 0, min: 0 },
    targetDate: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Exports
export const Transaction = model<ITransaction>('Transaction', transactionSchema);
export const Budget = model<IBudget>('Budget', budgetSchema);
export const Bill = model<IBill>('Bill', billSchema);
export const Goal = model<IGoal>('Goal', goalSchema);
