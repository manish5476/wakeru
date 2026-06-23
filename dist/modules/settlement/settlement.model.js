"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settlement = void 0;
const mongoose_1 = require("mongoose");
// ============================================================
// SUB-SCHEMA: Transaction
// ============================================================
const transactionSchema = new mongoose_1.Schema({
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
    paymentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Payment' },
    initiatedAt: { type: Date },
    confirmedAt: { type: Date },
}, { _id: true } // Each transaction needs its own _id for reference
);
// ============================================================
// MAIN SCHEMA: Settlement
// ============================================================
const settlementSchema = new mongoose_1.Schema({
    tripId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Trip',
        required: true,
        unique: true, // One settlement per trip
        index: true,
    },
    baseCurrency: {
        type: String,
        required: true,
        uppercase: true,
    },
    transactions: {
        type: [transactionSchema],
        default: [],
    },
    totalTransactions: {
        type: Number,
        default: 0,
    },
    calculatedAt: {
        type: Date,
        default: Date.now,
    },
    isStale: {
        type: Boolean,
        default: false,
        index: true,
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// ============================================================
// VIRTUALS
// ============================================================
settlementSchema.virtual('totalAmount').get(function () {
    return this.transactions.reduce((sum, t) => sum + t.amountBase, 0);
});
settlementSchema.virtual('pendingCount').get(function () {
    return this.transactions.filter((t) => t.status === 'pending').length;
});
settlementSchema.virtual('confirmedCount').get(function () {
    return this.transactions.filter((t) => t.status === 'confirmed').length;
});
settlementSchema.virtual('isFullySettled').get(function () {
    return this.transactions.every((t) => t.status === 'confirmed');
});
// ============================================================
// EXPORT
// ============================================================
exports.Settlement = (0, mongoose_1.model)('Settlement', settlementSchema);
//# sourceMappingURL=settlement.model.js.map