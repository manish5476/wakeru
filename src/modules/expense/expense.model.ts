import { Schema, model, Document, Types } from 'mongoose';

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export type ExpenseCategory =
  | 'food'
  | 'stay'
  | 'transport'
  | 'activity'
  | 'shopping'
  | 'health'
  | 'other';

export type SplitMethod =
  | 'equal'
  | 'percentage'
  | 'exact'
  | 'shares'
  | 'personal';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other',
];

const SPLIT_METHODS: SplitMethod[] = [
  'equal', 'percentage', 'exact', 'shares', 'personal',
];

// ============================================================
// INTERFACES
// ============================================================

/**
 * Per-member split breakdown.
 * Both amountLocal and amountBase are stored so we never re-compute on read.
 * The exchange rate is locked at expense creation time.
 */
export interface ISplit {
  userId: string;          // Firebase UID
  displayName: string;     // Denormalized for fast rendering
  amountLocal: number;     // Share in stop's local currency
  amountBase: number;      // Share in trip's base currency (for settlement)
  percentage?: number;     // For 'percentage' split method
  shares?: number;         // For 'shares' split method
  isPaid: boolean;
  paidAt?: Date;
  paymentId?: Types.ObjectId;
}

/**
 * Expense document — the core transaction record.
 */
export interface IExpense extends Document {
  // Location context
  tripId: Types.ObjectId;
  stopId: Types.ObjectId;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };

  // What was spent
  title: string;
  category: ExpenseCategory;
  notes?: string;
  receiptImages: string[];
  date: Date;
  tags: string[];

  // Dual currency amounts
  amountLocal: number;       // In stop's local currency
  amountBase: number;        // In trip's base currency (computed)
  localCurrency: string;     // Denormalized from stop (e.g., "AED")
  baseCurrency: string;      // Denormalized from trip (e.g., "INR")
  exchangeRateUsed: number;  // LOCKED at creation time

  // Who paid & split details
  paidBy: string;            // Firebase UID
  paidByName: string;        // Denormalized
  splitMethod: SplitMethod;
  splits: ISplit[];

  // Status
  isSettled: boolean;
  isArchived: boolean;

  // Audit
  addedBy: string;
  editedBy?: string;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// SUB-SCHEMA: Split
// ============================================================

const splitSchema = new Schema<ISplit>(
  {
    userId: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    amountLocal: { type: Number, required: true, min: 0 },
    amountBase: { type: Number, required: true, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
    shares: { type: Number, min: 0 },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  },
  { _id: false }
);

// ============================================================
// MAIN SCHEMA: Expense
// ============================================================

const expenseSchema = new Schema<IExpense>(
  {
    // Location context
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'tripId is required'],
      index: true,
    },
    tags: { type: [String], default: [], index: true },

    stopId: {
      type: Schema.Types.ObjectId,
      required: [true, 'stopId is required'],
      index: true,
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      name: { type: String },
    },

    // Expense details
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    category: {
      type: String,
      enum: { values: EXPENSE_CATEGORIES, message: '{VALUE} is not a valid category' },
      default: 'other',
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    receiptImages: {
      type: [String],
      default: [],
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Dual currency amounts
    amountLocal: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    amountBase: {
      type: Number,
      required: true,
      min: 0,
    },
    localCurrency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    exchangeRateUsed: {
      type: Number,
      required: true,
      min: [0.000001, 'Exchange rate must be positive'],
    },

    // Payer & split
    paidBy: {
      type: String,
      required: [true, 'paidBy is required'],
      index: true,
    },
    paidByName: {
      type: String,
      required: true,
    },
    splitMethod: {
      type: String,
      enum: { values: SPLIT_METHODS, message: '{VALUE} is not a valid split method' },
      required: true,
    },
    splits: {
      type: [splitSchema],
      required: true,
      validate: {
        validator: (splits: ISplit[]) => splits.length > 0,
        message: 'Expense must have at least one split',
      },
    },

    // Status
    isSettled: {
      type: Boolean,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Audit
    addedBy: { type: String, required: true },
    editedBy: { type: String },
    editedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
  }
);

// ============================================================
// INDEXES
// ============================================================

// Primary: expenses for a stop
expenseSchema.index({ stopId: 1, date: -1 });

// Trip-wide view (across all stops)
expenseSchema.index({ tripId: 1, date: -1 });

// User's expenses across all trips
expenseSchema.index({ paidBy: 1, date: -1 });

// Category filter within a trip
expenseSchema.index({ tripId: 1, category: 1 });

// Settlement queries
expenseSchema.index({ tripId: 1, isSettled: 1 });

// User involved in splits
expenseSchema.index({ 'splits.userId': 1, date: -1 });

// User involved in splits for a specific trip
expenseSchema.index({ tripId: 1, 'splits.userId': 1 });

// ============================================================
// PRE-SAVE HOOK
// ============================================================

expenseSchema.pre('save', function (next) {
  // Personal expenses are always settled — no debt created
  if (this.splitMethod === 'personal') {
    this.isSettled = true;
  } else {
    this.isSettled = this.splits.every((s) => s.isPaid);
  }
  next();
});

// ============================================================
// VIRTUALS
// ============================================================

expenseSchema.virtual('isForeignCurrency').get(function () {
  return this.localCurrency !== this.baseCurrency;
});

expenseSchema.virtual('totalPaidCount').get(function () {
  return this.splits.filter((s) => s.isPaid).length;
});

expenseSchema.virtual('totalSplitCount').get(function () {
  return this.splits.length;
});

// ============================================================
// EXPORT
// ============================================================

export const Expense = model<IExpense>('Expense', expenseSchema);