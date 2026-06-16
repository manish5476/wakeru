import mongoose, { Document } from 'mongoose';
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
export declare const Receipt: mongoose.Model<IReceiptDocument, {}, {}, {}, mongoose.Document<unknown, {}, IReceiptDocument, {}, {}> & IReceiptDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=receipt.model.d.ts.map