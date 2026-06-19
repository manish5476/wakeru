"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expense = void 0;
const mongoose_1 = require("mongoose");
const EXPENSE_CATEGORIES = [
    'food', 'stay', 'transport', 'activity', 'shopping', 'health', 'other',
];
const SPLIT_METHODS = [
    'equal', 'percentage', 'exact', 'shares', 'personal',
];
// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const splitSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    amountLocal: { type: Number, required: true, min: 0 },
    amountBase: { type: Number, required: true, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
    shares: { type: Number, min: 0 },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    paymentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Payment' },
}, { _id: false });
// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const expenseSchema = new mongoose_1.Schema({
    tripId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Trip',
        required: [true, 'tripId is required'],
        index: true,
    },
    stopId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: [true, 'stopId is required'],
        index: true,
    },
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
    notes: { type: String, maxlength: [500, 'Notes cannot exceed 500 characters'] },
    receiptImages: { type: [String], default: [] },
    date: { type: Date, default: Date.now, index: true },
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
    paidBy: { type: String, required: [true, 'paidBy is required'], index: true },
    paidByName: { type: String, required: true },
    splitMethod: {
        type: String,
        enum: { values: SPLIT_METHODS, message: '{VALUE} is not a valid split method' },
        required: true,
    },
    splits: {
        type: [splitSchema],
        required: true,
        validate: {
            validator: (splits) => splits.length > 0,
            message: 'Expense must have at least one split',
        },
    },
    isSettled: { type: Boolean, default: false, index: true },
    addedBy: { type: String, required: true },
    editedBy: { type: String },
    editedAt: { type: Date },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
});
// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────
// Primary fetch pattern: "all expenses for a stop"
expenseSchema.index({ stopId: 1, date: -1 });
// Trip-wide expense view (across all stops)
expenseSchema.index({ tripId: 1, date: -1 });
// "My expenses across all trips"
expenseSchema.index({ paidBy: 1, date: -1 });
// Filter by category within a trip
expenseSchema.index({ tripId: 1, category: 1 });
// Settlement queries — find unsettled expenses
expenseSchema.index({ tripId: 1, isSettled: 1 });
// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE HOOK — auto-update isSettled
// ─────────────────────────────────────────────────────────────────────────────
expenseSchema.pre('save', function (next) {
    // 'personal' expenses are always settled — no debt created
    if (this.splitMethod === 'personal') {
        this.isSettled = true;
    }
    else {
        this.isSettled = this.splits.every((s) => s.isPaid);
    }
    next();
});
// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────
exports.Expense = (0, mongoose_1.model)('Expense', expenseSchema); // import mongoose, { Schema, Document } from 'mongoose';
// import crypto from 'crypto';
// export interface IExpenseDocument extends Document {
//   expenseId: string;
//   groupId: mongoose.Types.ObjectId;
//   description: string;
//   category: string;
//   currency: string;
//   lineItems: Array<{
//     itemId: string;
//     name: string;
//     category: string;
//     basePrice: mongoose.Types.Decimal128;
//     quantity: number;
//     unit?: string;
//     consumers: Array<{
//       userId: mongoose.Types.ObjectId;
//       consumptionPercentage: number;
//       quantity?: number;
//       notes?: string;
//     }>;
//   }>;
//   taxes: Array<{
//     name: string;
//     percentage: number;
//     amount: mongoose.Types.Decimal128;
//     applicableTo: 'all' | 'specific';
//     applicableItems?: string[];
//     taxCode?: string;
//   }>;
//   discounts: Array<{
//     type: 'percentage' | 'fixed';
//     value: mongoose.Types.Decimal128;
//     code?: string;
//     description?: string;
//     applicableTo: 'all' | 'specific';
//     applicableItems?: string[];
//   }>;
//   splits: Array<{
//     userId: mongoose.Types.ObjectId;
//     baseAmount: mongoose.Types.Decimal128;
//     taxAmount: mongoose.Types.Decimal128;
//     discountAmount: mongoose.Types.Decimal128;
//     finalAmount: mongoose.Types.Decimal128;
//     isPayer: boolean;
//     items: Array<{
//       itemId: string;
//       name: string;
//       category: string;
//       amount: mongoose.Types.Decimal128;
//       consumptionPercent: number;
//     }>;
//     settlementStatus: 'PENDING' | 'SETTLED' | 'PARTIAL';
//   }>;
//   paidBy: mongoose.Types.ObjectId;
//   paymentMethod: string;
//   paymentDate: Date;
//   totalAmount: mongoose.Types.Decimal128;
//   subTotal: mongoose.Types.Decimal128;
//   taxTotal: mongoose.Types.Decimal128;
//   discountTotal: mongoose.Types.Decimal128;
//   analytics: {
//     categoryBreakdown: Map<string, {
//       totalAmount: mongoose.Types.Decimal128;
//       itemCount: number;
//       consumerCount: number;
//     }>;
//     averagePerPerson: mongoose.Types.Decimal128;
//     mostExpensiveItem?: {
//       name: string;
//       amount: mongoose.Types.Decimal128;
//     };
//     consumptionDistribution: Array<{
//       userId: mongoose.Types.ObjectId;
//       percentage: number;
//     }>;
//   };
//   receipt?: {
//     imageUrl: string;
//     thumbnailUrl: string;
//     ocrProcessed: boolean;
//     ocrConfidence?: number;
//     uploadedAt: Date;
//   };
//   metadata: {
//     createdBy: mongoose.Types.ObjectId;
//     updatedBy?: mongoose.Types.ObjectId;
//     isDeleted: boolean;
//     deletedBy?: mongoose.Types.ObjectId;
//     deletedAt?: Date;
//     version: number;
//   };
//   idempotencyKey: string;
//   createdAt: Date;
//   updatedAt: Date;
// }
// const ExpenseSchema = new Schema<IExpenseDocument>({
//   expenseId: { 
//     type: String, 
//     required: true, 
//     unique: true,
//     default: () => crypto.randomUUID()
//   },
//   groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
//   description: { type: String, required: true },
//   category: { type: String, required: true },
//   currency: { type: String, required: true, default: 'INR' },
//   lineItems: [{
//     itemId: { type: String, required: true },
//     name: { type: String, required: true },
//     category: { type: String, required: true },
//     basePrice: { type: Schema.Types.Decimal128, required: true },
//     quantity: { type: Number, default: 1 },
//     unit: String,
//     consumers: [{
//       userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//       consumptionPercentage: { type: Number, required: true },
//       quantity: Number,
//       notes: String
//     }]
//   }],
//   taxes: [{
//     name: String,
//     percentage: Number,
//     amount: Schema.Types.Decimal128,
//     applicableTo: { type: String, enum: ['all', 'specific'] },
//     applicableItems: [String],
//     taxCode: String
//   }],
//   discounts: [{
//     type: { type: String, enum: ['percentage','fixed'] },
//     value: Schema.Types.Decimal128,
//     code: String,
//     description: String,
//     applicableTo: { type: String, enum: ['all', 'specific'] },
//     applicableItems: [String]
//   }],
//   splits: [{
//     userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//     baseAmount: { type: Schema.Types.Decimal128, required: true },
//     taxAmount: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
//     discountAmount: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
//     finalAmount: { type: Schema.Types.Decimal128, required: true },
//     isPayer: { type: Boolean, default: false },
//     items: [{
//       itemId: String,
//       name: String,
//       category: String,
//       amount: Schema.Types.Decimal128,
//       consumptionPercent: Number
//     }],
//     settlementStatus: { 
//       type: String, 
//       enum: ['PENDING', 'SETTLED', 'PARTIAL'],
//       default: 'PENDING'
//     }
//   }],
//   paidBy: { type: Schema.Types.ObjectId, ref: 'User', required:true },
//   paymentMethod: { type: String, required: true },
//   paymentDate: { type: Date, default: Date.now },
//   totalAmount: { type: Schema.Types.Decimal128, required: true },
//   subTotal: { type: Schema.Types.Decimal128, required: true },
//   taxTotal: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
//   discountTotal: { type: Schema.Types.Decimal128, default: mongoose.Types.Decimal128.fromString('0') },
//   analytics: {
//     categoryBreakdown: { type: Map, of: {
//       totalAmount: Schema.Types.Decimal128,
//       itemCount: Number,
//       consumerCount: Number
//     }},
//     averagePerPerson: Schema.Types.Decimal128,
//     mostExpensiveItem: {
//       name: String,
//       amount: Schema.Types.Decimal128
//     },
//     consumptionDistribution: [{
//       userId: Schema.Types.ObjectId,
//       percentage: Number
//     }]
//   },
//   receipt: {
//     imageUrl: String,
//     thumbnailUrl: String,
//     ocrProcessed: { type: Boolean, default: false },
//     ocrConfidence: Number,
//     uploadedAt: Date
//   },
//   metadata: {
//     createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//     updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
//     isDeleted: { type: Boolean, default: false },
//     deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
//     deletedAt: Date,
//     version: { type: Number, default: 1 }
//   },
//   idempotencyKey: { type: String, required: true, unique: true }
// }, {
//   timestamps: true
// });
// // Indexes for performance
// ExpenseSchema.index({ groupId: 1, createdAt: -1 });
// ExpenseSchema.index({ 'splits.userId': 1, createdAt: -1 });
// ExpenseSchema.index({ category: 1, 'splits.userId': 1 });
// ExpenseSchema.index({ idempotencyKey: 1 });
// ExpenseSchema.index({ 'metadata.isDeleted': 1 });
// ExpenseSchema.index({ paidBy: 1, createdAt: -1 });
// // Static methods for analytics
// ExpenseSchema.statics.getUserCategoryAnalytics = async function(
//   userId: string, 
//   startDate: Date, 
//   endDate: Date
// ) {
//   return this.aggregate([
//     {
//       $match: {
//         'splits.userId': new mongoose.Types.ObjectId(userId),
//         'metadata.isDeleted': false,
//         createdAt: { $gte: startDate, $lte: endDate }
//       }
//     },
//     { $unwind: '$splits' },
//     { $match: { 'splits.userId': new mongoose.Types.ObjectId(userId) } },
//     { $unwind: '$splits.items' },
//     {
//       $group: {
//         _id: '$splits.items.category',
//         totalSpent: { $sum: { $toDouble: '$splits.items.amount' } },
//         count: { $sum: 1 },
//         expenses: { $addToSet: '$_id' }
//       }
//     },
//     {
//       $project: {
//         category: '$_id',
//         totalSpent: 1,
//         count: 1,
//         uniqueExpenses: { $size: '$expenses' },
//         averagePerExpense: { $divide: ['$totalSpent', '$count'] }
//       }
//     },
//     { $sort: { totalSpent: -1 } }
//   ]);
// };
// export const Expense = mongoose.model<IExpenseDocument>('Expense', ExpenseSchema);
//# sourceMappingURL=expense.model.js.map