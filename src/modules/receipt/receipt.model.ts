import mongoose, { Schema, Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// TYPES
// ============================================================

export type AllowedMimeType = 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp';
export type ReceiptStatus = 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVIEWED';

export interface IExtractedItem {
  name: string;
  category: string;
  price: number;
  quantity: number;
  confidence: number;
}

export interface IOCRData {
  // INDEXES
  // ============================================================
  toObject(): IOCRData;
  processed: boolean;
  confidence: number;
  rawText?: string;
  extractedItems: IExtractedItem[];
  merchantName?: string;
  merchantAddress?: string;
  date?: Date;
  totalAmount?: number;
  taxAmount?: number;
  currency?: string;
  paymentMethod?: string;
  error?: string;
}

export interface IReceiptImage {
  originalUrl: string;
  thumbnailUrl: string;
  processedUrl?: string;
  mimeType: AllowedMimeType;
  size: number;
  width?: number;
  height?: number;
}

export interface IStatusHistory {
  status: string;
  timestamp: Date;
  message?: string;
}

export interface IReceipt extends Document {
  receiptId: string;         // UUID — public identifier
  userId: string;            // Firebase UID / UUID (matches User._id)
  tripId?: Types.ObjectId;   // Optional — link to trip
  expenseId?: Types.ObjectId; // Optional — link to expense after conversion
  
  image: IReceiptImage;
  ocrData: IOCRData;
  
  status: ReceiptStatus;
  statusHistory: IStatusHistory[];
  
  addedBy: string;           // Firebase UID
  isDeleted: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// SUB-SCHEMAS
// ============================================================

const ExtractedItemSchema = new Schema<IExtractedItem>(
  {
    name: { type: String, required: true },
    category: { type: String, default: 'other' },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    confidence: { type: Number, default: 0 },
  },
  { _id: false }
);

const OCRDataSchema = new Schema<IOCRData>(
  {
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
  },
  { _id: false }
);

const ReceiptImageSchema = new Schema<IReceiptImage>(
  {
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
  },
  { _id: false }
);

const StatusHistorySchema = new Schema<IStatusHistory>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    message: { type: String },
  },
  { _id: false }
);

// ============================================================
// MAIN SCHEMA
// ============================================================

const ReceiptSchema = new Schema<IReceipt>(
  {
    receiptId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    userId: {
      type: String,               // ✅ String, not ObjectId
      required: true,
      index: true,
    },
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      index: true,
    },
    expenseId: {
      type: Schema.Types.ObjectId,
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
      type: String,               // ✅ String, not ObjectId
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
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
  return this.ocrData.extractedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
});

// ============================================================
// EXPORT
// ============================================================

export const Receipt = mongoose.model<IReceipt>('Receipt', ReceiptSchema);