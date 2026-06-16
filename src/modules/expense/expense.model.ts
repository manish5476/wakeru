import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IExpenseDocument extends Document {
  expenseId: string;
  groupId: mongoose.Types.ObjectId;
  description: string;
  category: string;
  currency: string;
  
  lineItems: Array<{
    itemId: string;
    name: string;
    category: string;
    basePrice: mongoose.Types.Decimal128;
    quantity: number;
    unit?: string;
    consumers: Array<{
      userId: mongoose.Types.ObjectId;
      consumptionPercentage: number;
      quantity?: number;
      notes?: string;
    }>;
  }>;

  taxes: Array<{
    name: string;
    percentage: number;
    amount: mongoose.Types.Decimal128;
    applicableTo: 'all' | 'specific';
    applicableItems?: string[];
    taxCode?: string;
  }>;

  discounts: Array<{
    type: 'percentage' | 'fixed';
    value: mongoose.Types.Decimal128;
    code?: string;
    description?: string;
    applicableTo: 'all' | 'specific';
    applicableItems?: string[];
  }>;

  splits: Array<{
    userId: mongoose.Types.ObjectId;
    baseAmount: mongoose.Types.Decimal128;
    taxAmount: mongoose.Types.Decimal128;
    discountAmount: mongoose.Types.Decimal128;
    finalAmount: mongoose.Types.Decimal128;
    isPayer: boolean;
    items: Array<{
      itemId: string;
      name: string;
      category: string;
      amount: mongoose.Types.Decimal128;
      consumptionPercent: number;
    }>;
    settlementStatus: 'PENDING' | 'SETTLED' | 'PARTIAL';
  }>;

  paidBy: mongoose.Types.ObjectId;
  paymentMethod: string;
  paymentDate: Date;
  
  totalAmount: mongoose.Types.Decimal128;
  subTotal: mongoose.Types.Decimal128;
  taxTotal: mongoose.Types.Decimal128;
  discountTotal: mongoose.Types.Decimal128;
  
  analytics: {
    categoryBreakdown: Map<string, {
      totalAmount: mongoose.Types.Decimal128;
      itemCount: number;
      consumerCount: number;
    }>;
    averagePerPerson: mongoose.Types.Decimal128;
    mostExpensiveItem?: {
      name: string;
      amount: mongoose.Types.Decimal128;
    };
    consumptionDistribution: Array<{
      userId: mongoose.Types.ObjectId;
      percentage: number;
    }>;
  };
  
  receipt?: {
    imageUrl: string;
    thumbnailUrl: string;
    ocrProcessed: boolean;
    ocrConfidence?: number;
    uploadedAt: Date;
  };
  
  metadata: {
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;
    deletedBy?: mongoose.Types.ObjectId;
    deletedAt?: Date;
    version: number;
  };
  
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpenseDocument>({
  expenseId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => crypto.randomUUID()
  },
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  currency: { type: String, required: true, default: 'INR' },
  
  lineItems: [{
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    basePrice: { type: Schema.Types.Decimal128, required: true },
    quantity: { type: Number, default: 1 },
    unit: String,
    consumers: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      consumptionPercentage: { type: Number, required: true },
      quantity: Number,
      notes: String
    }]
  }],
  
  taxes: [{
    name: String,
    percentage: Number,
    amount: Schema.Types.Decimal128,
    applicableTo: { type: String, enum: ['all', 'specific'] },
    applicableItems: [String],
    taxCode: String
  }],
  
  discounts: [{
    type: { type: String, enum: ['percentage','fixed'] },
    value: Schema.Types.Decimal128,
    code: String,
    description: String,
    applicableTo: { type: String, enum: ['all', 'specific'] },
    applicableItems: [String]
  }],
  
  splits: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    baseAmount: { type: Schema.Types.Decimal128, required: true },
    taxAmount: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
    discountAmount: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
    finalAmount: { type: Schema.Types.Decimal128, required: true },
    isPayer: { type: Boolean, default: false },
    items: [{
      itemId: String,
      name: String,
      category: String,
      amount: Schema.Types.Decimal128,
      consumptionPercent: Number
    }],
    settlementStatus: { 
      type: String, 
      enum: ['PENDING', 'SETTLED', 'PARTIAL'],
      default: 'PENDING'
    }
  }],
  
  paidBy: { type: Schema.Types.ObjectId, ref: 'User', required:true },
  paymentMethod: { type: String, required: true },
  paymentDate: { type: Date, default: Date.now },
  
  totalAmount: { type: Schema.Types.Decimal128, required: true },
  subTotal: { type: Schema.Types.Decimal128, required: true },
  taxTotal: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
  discountTotal: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
  
  analytics: {
    categoryBreakdown: { type: Map, of: {
      totalAmount: Schema.Types.Decimal128,
      itemCount: Number,
      consumerCount: Number
    }},
    averagePerPerson: Schema.Types.Decimal128,
    mostExpensiveItem: {
      name: String,
      amount: Schema.Types.Decimal128
    },
    consumptionDistribution: [{
      userId: Schema.Types.ObjectId,
      percentage: Number
    }]
  },
  
  receipt: {
    imageUrl: String,
    thumbnailUrl: String,
    ocrProcessed: { type: Boolean, default: false },
    ocrConfidence: Number,
    uploadedAt: Date
  },
  
  metadata: {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
    version: { type: Number, default: 1 }
  },
  
  idempotencyKey: { type: String, required: true, unique: true }
}, {
  timestamps: true
});

// Indexes for performance
ExpenseSchema.index({ groupId: 1, createdAt: -1 });
ExpenseSchema.index({ 'splits.userId': 1, createdAt: -1 });
ExpenseSchema.index({ category: 1, 'splits.userId': 1 });
ExpenseSchema.index({ idempotencyKey: 1 });
ExpenseSchema.index({ 'metadata.isDeleted': 1 });
ExpenseSchema.index({ paidBy: 1, createdAt: -1 });

// Static methods for analytics
ExpenseSchema.statics.getUserCategoryAnalytics = async function(
  userId: string, 
  startDate: Date, 
  endDate: Date
) {
  return this.aggregate([
    {
      $match: {
        'splits.userId': new mongoose.Types.ObjectId(userId),
        'metadata.isDeleted': false,
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    { $unwind: '$splits' },
    { $match: { 'splits.userId': new mongoose.Types.ObjectId(userId) } },
    { $unwind: '$splits.items' },
    {
      $group: {
        _id: '$splits.items.category',
        totalSpent: { $sum: { $toDouble: '$splits.items.amount' } },
        count: { $sum: 1 },
        expenses: { $addToSet: '$_id' }
      }
    },
    {
      $project: {
        category: '$_id',
        totalSpent: 1,
        count: 1,
        uniqueExpenses: { $size: '$expenses' },
        averagePerExpense: { $divide: ['$totalSpent', '$count'] }
      }
    },
    { $sort: { totalSpent: -1 } }
  ]);
};

export const Expense = mongoose.model<IExpenseDocument>('Expense', ExpenseSchema);
