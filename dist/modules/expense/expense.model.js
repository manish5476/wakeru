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
// ============================================================
// SUB-SCHEMA: Split
// ============================================================
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
// ============================================================
// MAIN SCHEMA: Expense
// ============================================================
const expenseSchema = new mongoose_1.Schema({
    // Location context
    tripId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Trip',
        required: [true, 'tripId is required'],
        index: true,
    },
    tags: { type: [String], default: [], index: true },
    stopId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
            validator: (splits) => splits.length > 0,
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
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
});
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
// ============================================================
// PRE-SAVE HOOK
// ============================================================
expenseSchema.pre('save', function (next) {
    // Personal expenses are always settled — no debt created
    if (this.splitMethod === 'personal') {
        this.isSettled = true;
    }
    else {
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
exports.Expense = (0, mongoose_1.model)('Expense', expenseSchema);
//# sourceMappingURL=expense.model.js.map