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
exports.Receipt = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const ReceiptSchema = new mongoose_1.Schema({
    receiptId: {
        type: String,
        required: true,
        unique: true,
        default: () => crypto_1.default.randomUUID()
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    groupId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Group'
    },
    expenseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Expense'
    },
    image: {
        originalUrl: { type: String, required: true },
        thumbnailUrl: { type: String, required: true },
        processedUrl: String,
        mimeType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'] },
        size: { type: Number, required: true },
        width: Number,
        height: Number
    },
    ocrData: {
        processed: { type: Boolean, default: false },
        confidence: { type: Number, default: 0 },
        rawText: String,
        extractedItems: [{
                name: String,
                category: String,
                price: Number,
                quantity: Number,
                confidence: Number
            }],
        merchantName: String,
        merchantAddress: String,
        date: Date,
        totalAmount: Number,
        taxAmount: Number,
        currency: String,
        paymentMethod: String,
        error: String
    },
    status: {
        type: String,
        enum: ['UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVIEWED'],
        default: 'UPLOADED'
    },
    statusHistory: [{
            status: String,
            timestamp: { type: Date, default: Date.now },
            message: String
        }],
    metadata: {
        createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
        isDeleted: { type: Boolean, default: false },
        version: { type: Number, default: 1 }
    }
}, {
    timestamps: true
});
// Indexes
ReceiptSchema.index({ userId: 1, createdAt: -1 });
ReceiptSchema.index({ groupId: 1, status: 1 });
ReceiptSchema.index({ expenseId: 1 });
ReceiptSchema.index({ status: 1, createdAt: -1 });
exports.Receipt = mongoose_1.default.model('Receipt', ReceiptSchema);
//# sourceMappingURL=receipt.model.js.map