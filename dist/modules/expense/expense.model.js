"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expense = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const ExpenseSchema = new mongoose_1.Schema({
    expenseId: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto_1.default.randomUUID()
    },
    groupId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Group', required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    currency: { type: String, required: true, default: 'INR' },
    lineItems: [{
            itemId: { type: String, required: true },
            name: { type: String, required: true },
            category: { type: String, required: true },
            basePrice: { type: mongoose_1.Schema.Types.Decimal128, required: true },
            quantity: { type: Number, default: 1 },
            unit: String,
            consumers: [{
                    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
                    consumptionPercentage: { type: Number, required: true },
                    quantity: Number,
                    notes: String
                }]
        }],
    taxes: [{
            name: String,
            percentage: Number,
            amount: mongoose_1.Schema.Types.Decimal128,
            applicableTo: { type: String, enum: ['all', 'specific'] },
            applicableItems: [String],
            taxCode: String
        }],
    discounts: [{
            type: { type: String, enum: ['percentage', 'fixed'] },
            value: mongoose_1.Schema.Types.Decimal128,
            code: String,
            description: String,
            applicableTo: { type: String, enum: ['all', 'specific'] },
            applicableItems: [String]
        }],
    splits: [{
            userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
            baseAmount: { type: mongoose_1.Schema.Types.Decimal128, required: true },
            taxAmount: { type: mongoose_1.Schema.Types.Decimal128, default: mongoose_1.default.Types.Decimal128.fromString('0') },
            discountAmount: { type: mongoose_1.Schema.Types.Decimal128, default: mongoose_1.default.Types.Decimal128.fromString('0') },
            finalAmount: { type: mongoose_1.Schema.Types.Decimal128, required: true },
            isPayer: { type: Boolean, default: false },
            items: [{
                    itemId: String,
                    name: String,
                    category: String,
                    amount: mongoose_1.Schema.Types.Decimal128,
                    consumptionPercent: Number
                }],
            settlementStatus: {
                type: String,
                enum: ['PENDING', 'SETTLED', 'PARTIAL'],
                default: 'PENDING'
            }
        }],
    paidBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    paymentMethod: { type: String, required: true },
    paymentDate: { type: Date, default: Date.now },
    totalAmount: { type: mongoose_1.Schema.Types.Decimal128, required: true },
    subTotal: { type: mongoose_1.Schema.Types.Decimal128, required: true },
    taxTotal: { type: mongoose_1.Schema.Types.Decimal128, default: mongoose_1.default.Types.Decimal128.fromString('0') },
    discountTotal: { type: mongoose_1.Schema.Types.Decimal128, default: mongoose_1.default.Types.Decimal128.fromString('0') },
    analytics: {
        categoryBreakdown: { type: Map, of: {
                totalAmount: mongoose_1.Schema.Types.Decimal128,
                itemCount: Number,
                consumerCount: Number
            } },
        averagePerPerson: mongoose_1.Schema.Types.Decimal128,
        mostExpensiveItem: {
            name: String,
            amount: mongoose_1.Schema.Types.Decimal128
        },
        consumptionDistribution: [{
                userId: mongoose_1.Schema.Types.ObjectId,
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
        createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
        isDeleted: { type: Boolean, default: false },
        deletedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
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
ExpenseSchema.statics.getUserCategoryAnalytics = async function (userId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                'splits.userId': new mongoose_1.default.Types.ObjectId(userId),
                'metadata.isDeleted': false,
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        { $unwind: '$splits' },
        { $match: { 'splits.userId': new mongoose_1.default.Types.ObjectId(userId) } },
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
exports.Expense = mongoose_1.default.model('Expense', ExpenseSchema);
//# sourceMappingURL=expense.model.js.map