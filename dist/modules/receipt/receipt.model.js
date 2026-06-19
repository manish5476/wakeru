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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Receipt = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const uuid_1 = require("uuid");
// ============================================================
// SUB-SCHEMAS
// ============================================================
const ExtractedItemSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    category: { type: String, default: 'other' },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    confidence: { type: Number, default: 0 },
}, { _id: false });
const OCRDataSchema = new mongoose_1.Schema({
    processed: { type: Boolean, default: false },
    confidence: { type: Number, default: 0 },
    rawText: { type: String },
    extractedItems: { type: [ExtractedItemSchema], default: [] },
    merchantName: { type: String },
    merchantAddress: { type: String },
    date: { type: Date },
    totalAmount: { type: Number },
    taxAmount: { type: Number },
    currency: { type: String },
    paymentMethod: { type: String },
    error: { type: String },
}, { _id: false });
const ReceiptImageSchema = new mongoose_1.Schema({
    originalUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    processedUrl: { type: String },
    mimeType: {
        type: String,
        required: true,
        enum: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
    },
    size: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
}, { _id: false });
const StatusHistorySchema = new mongoose_1.Schema({
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    message: { type: String },
}, { _id: false });
// ============================================================
// MAIN SCHEMA
// ============================================================
const ReceiptSchema = new mongoose_1.Schema({
    receiptId: {
        type: String,
        required: true,
        unique: true,
        default: () => (0, uuid_1.v4)(),
        index: true,
    },
    userId: {
        type: String, // ✅ String, not ObjectId
        required: true,
        index: true,
    },
    tripId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Trip',
        index: true,
    },
    expenseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Expense',
    },
    image: {
        type: ReceiptImageSchema,
        required: true,
    },
    ocrData: {
        type: OCRDataSchema,
        default: () => ({
            processed: false,
            confidence: 0,
            extractedItems: [],
        }),
    },
    status: {
        type: String,
        enum: ['UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVIEWED'],
        default: 'UPLOADED',
    },
    statusHistory: {
        type: [StatusHistorySchema],
        default: [],
    },
    addedBy: {
        type: String, // ✅ String, not ObjectId
        required: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
});
// ============================================================
// INDEXES
// ============================================================
ReceiptSchema.index({ userId: 1, createdAt: -1 });
ReceiptSchema.index({ tripId: 1, status: 1 });
ReceiptSchema.index({ expenseId: 1 });
ReceiptSchema.index({ status: 1, createdAt: -1 });
// ============================================================
// VIRTUALS
// ============================================================
ReceiptSchema.virtual('hasExpense').get(function () {
    return !!this.expenseId;
});
ReceiptSchema.virtual('extractedTotal').get(function () {
    return this.ocrData.extractedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
});
// ============================================================
// EXPORT
// ============================================================
exports.Receipt = mongoose_1.default.model('Receipt', ReceiptSchema);
//# sourceMappingURL=receipt.model.js.map