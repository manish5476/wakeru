import mongoose, { Document, Types } from 'mongoose';
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
    receiptId: string;
    userId: string;
    tripId?: Types.ObjectId;
    expenseId?: Types.ObjectId;
    image: IReceiptImage;
    ocrData: IOCRData;
    status: ReceiptStatus;
    statusHistory: IStatusHistory[];
    addedBy: string;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Receipt: mongoose.Model<IReceipt, {}, {}, {}, mongoose.Document<unknown, {}, IReceipt, {}, {}> & IReceipt & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=receipt.model.d.ts.map