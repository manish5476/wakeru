import { Types } from 'mongoose';
export declare class ReceiptService {
    /**
     * Upload and process a receipt image.
     */
    uploadReceipt(userId: string, file: Express.Multer.File, tripId?: string, expenseId?: string): Promise<any>;
    /**
     * Get receipt by ID.
     */
    getReceipt(receiptId: string, userId: string): Promise<any>;
    /**
     * Get user's receipts (paginated).
     */
    getUserReceipts(userId: string, options?: {
        page?: number;
        limit?: number;
        status?: string;
    }): Promise<{
        receipts: (import("mongoose").FlattenMaps<import("./receipt.model").IReceipt> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
    }>;
    /**
     * Get trip receipts.
     */
    getTripReceipts(tripId: string, options?: {
        page?: number;
        limit?: number;
    }): Promise<{
        receipts: (import("mongoose").FlattenMaps<import("./receipt.model").IReceipt> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
    }>;
    /**
     * Update receipt (manual corrections).
     */
    updateReceipt(receiptId: string, userId: string, updateData: any): Promise<import("mongoose").Document<unknown, {}, import("./receipt.model").IReceipt, {}, {}> & import("./receipt.model").IReceipt & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    /**
     * Soft delete receipt.
     */
    deleteReceipt(receiptId: string, userId: string): Promise<void>;
    /**
     * Reprocess OCR.
     */
    reprocessReceipt(receiptId: string, userId: string): Promise<import("mongoose").Document<unknown, {}, import("./receipt.model").IReceipt, {}, {}> & import("./receipt.model").IReceipt & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    /**
     * Convert receipt data to expense input.
     */
    convertToExpense(receiptId: string, userId: string, tripId: string): Promise<{
        tripId: string;
        title: string;
        category: string;
        amountLocal: any;
        currency: any;
        date: any;
        notes: string;
        extractedItems: any;
        merchantName: any;
    }>;
    private validateFile;
    private processReceiptAsync;
}
export declare const receiptService: ReceiptService;
//# sourceMappingURL=receipt.service.d.ts.map