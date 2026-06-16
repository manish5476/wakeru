import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export type AllowedMimeTypes = 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp';

export interface IReceiptDocument extends Document {
  receiptId: string;
  userId: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId;
  expenseId?: mongoose.Types.ObjectId;
  
  image: {
    originalUrl: string;
    thumbnailUrl: string;
    processedUrl?: string;
    mimeType: AllowedMimeTypes;
    size: number;
    width?: number;
    height?: number;
  };
  
  ocrData: {
    processed: boolean;
    confidence: number;
    rawText?: string;
    extractedItems?: Array<{
      name: string;
      category: string;
      price: number;
      quantity: number;
      confidence: number;
    }>;
    merchantName?: string;
    merchantAddress?: string;
    date?: Date;
    totalAmount?: number;
    taxAmount?: number;
    currency?: string;
    paymentMethod?: string;
    error?: string;
  };
  
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVIEWED';
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    message?: string;
  }>;
  
  metadata: {
    createdBy: mongoose.Types.ObjectId;
    isDeleted: boolean;
    version: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const ReceiptSchema = new Schema<IReceiptDocument>({
  receiptId: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomUUID()
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  groupId: {
    type: Schema.Types.ObjectId,
    ref: 'Group'
  },
  expenseId: {
    type: Schema.Types.ObjectId,
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
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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

export const Receipt = mongoose.model<IReceiptDocument>('Receipt', ReceiptSchema);